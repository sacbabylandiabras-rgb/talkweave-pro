import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface WebhookMessage {
  phone: string
  message: {
    text?: string
    fromMe: boolean
  }
  instanceId?: string
  timestamp: number
}

interface FlowNode {
  id: string
  type: string
  data: {
    content?: string
    contentType?: string
    mediaUrl?: string
    buttonLabel?: string
    buttonUrl?: string
    actionType?: string
    actionConfig?: string
    condition?: string
    conditionType?: string
  }
}

interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Webhook recebido - Method:', req.method)
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const rawBody = await req.text()
    let webhook: any

    try {
      webhook = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('Payload JSON inválido:', parseError)
      return new Response('invalid_json', { status: 400, headers: corsHeaders })
    }

    // Ignora mensagens enviadas por nós (compatível com múltiplos formatos da Z-API)
    const fromMe = webhook?.message?.fromMe ?? webhook?.fromMe ?? false
    if (fromMe) {
      return new Response('ignored', { status: 200, headers: corsHeaders })
    }

    const messageRaw = extractMessageText(webhook)
    const messageText = messageRaw.toLowerCase()
    const normalizedMessage = normalizeForMatch(messageRaw)

    if (!messageRaw) {
      console.log('Evento sem texto detectado, ignorando. Chaves:', Object.keys(webhook || {}))
      return new Response('ignored_no_text', { status: 200, headers: corsHeaders })
    }

    const phone = webhook?.phone || webhook?.participantPhone || webhook?.chatLid || ''
    const instanceId = webhook?.instanceId || webhook?.instance_id
    
    console.log('Processando mensagem:', messageText, 'do telefone:', phone)
    
    // Verifica se o sistema está ativo
    const { data: config, error: configError } = await supabase
      .from('auto_response_config')
      .select('active')
      .single()
    
    if (configError) {
      console.error('Erro ao buscar config:', configError)
      return new Response('config_error', { status: 500, headers: corsHeaders })
    }
    
    if (!config?.active) {
      console.log('Sistema desativado')
      return new Response('system_disabled', { status: 200, headers: corsHeaders })
    }

    if (!instanceId) {
      console.error('No instanceId in webhook data')
      return new Response('missing_instance_id', { status: 400, headers: corsHeaders })
    }

    // Find user and credentials by instanceId (prefer dedicated zapi_instances table)
    let userId: string | null = null
    let zapiConfig: { zapi_instance_id: string; zapi_token: string; zapi_client_token: string } | null = null

    const { data: instanceData } = await supabase
      .from('zapi_instances')
      .select('user_id, zapi_instance_id, zapi_token, zapi_client_token')
      .eq('zapi_instance_id', instanceId)
      .eq('is_active', true)
      .maybeSingle()

    if (instanceData) {
      userId = instanceData.user_id
      zapiConfig = {
        zapi_instance_id: instanceData.zapi_instance_id,
        zapi_token: instanceData.zapi_token,
        zapi_client_token: instanceData.zapi_client_token,
      }
    } else {
      // Legacy fallback: profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, zapi_instance_id, zapi_token, zapi_client_token')
        .eq('zapi_instance_id', instanceId)
        .single()

      if (profileError || !profile) {
        console.error('User profile not found for instanceId:', instanceId)
        return new Response('user_not_found', { status: 404, headers: corsHeaders })
      }

      userId = profile.id
      zapiConfig = {
        zapi_instance_id: profile.zapi_instance_id,
        zapi_token: profile.zapi_token,
        zapi_client_token: profile.zapi_client_token,
      }
    }

    if (!userId || !zapiConfig?.zapi_token || !zapiConfig?.zapi_client_token) {
      console.error('User has incomplete Z-API credentials')
      return new Response('incomplete_credentials', { status: 400, headers: corsHeaders })
    }

    // Forward to gateway integrations
    const { data: gateways } = await supabase
      .from('gateway_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)

    if (gateways && gateways.length > 0) {
      console.log(`Encaminhando para ${gateways.length} gateway(s)`)
      const gatewayPayload = {
        event: 'message_received',
        phone,
        message: messageRaw || null,
        timestamp: new Date().toISOString(),
        raw: webhook,
      }

      await Promise.allSettled(gateways.map(async (gw) => {
        try {
          const gwHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(gw.headers as Record<string, string> || {}),
          }
          if (gw.auth_type === 'bearer' && gw.auth_token) {
            gwHeaders['Authorization'] = `Bearer ${gw.auth_token}`
          } else if (gw.auth_type === 'api_key' && gw.auth_token) {
            gwHeaders['X-API-Key'] = gw.auth_token
          }
          const opts: RequestInit = { method: gw.method || 'POST', headers: gwHeaders }
          if (gw.method !== 'GET') {
            opts.body = JSON.stringify(gatewayPayload)
          }
          const res = await fetch(gw.webhook_url, opts)
          console.log(`Gateway ${gw.name}: status ${res.status}`)
        } catch (e) {
          console.error(`Gateway ${gw.name} erro:`, e)
        }
      }))
    }

    // === CHECK FLOW AUTOMATIONS FIRST ===
    const { data: flowAutomations, error: flowError } = await supabase
      .from('flow_automations')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)

    if (!flowError && flowAutomations && flowAutomations.length > 0) {
      // === CHECK IF MESSAGE IS A BUTTON REPLY THAT MATCHES A FLOW BUTTON ===
      const buttonMatch = findButtonEdgeMatch(flowAutomations, normalizedMessage, messageRaw)
      if (buttonMatch) {
        console.log('Botão encontrado no fluxo:', buttonMatch.flowName, '-> botão:', buttonMatch.buttonText)
        const { flow, targetNodeId } = buttonMatch
        const flowNodes: FlowNode[] = flow.nodes || []
        const flowEdges: FlowEdge[] = flow.edges || []

        // Create a virtual edge pointing to the target so processFlowNode sends it
        const virtualSourceId = '__button_entry__'
        await processFlowNode(
          virtualSourceId,
          flowNodes,
          [{ id: 'virtual', source: virtualSourceId, target: targetNodeId }, ...flowEdges],
          phone,
          zapiConfig,
          supabase,
          new Set<string>()
        )

        await supabase.from('message_logs').insert({
          phone,
          message_received: messageRaw,
          keyword_matched: `[Botão: ${buttonMatch.buttonText}]`,
          response_sent: `[Fluxo: ${flow.name}]`,
          timestamp: new Date().toISOString(),
          user_id: userId,
        })

        return new Response('button_flow_sent', { status: 200, headers: corsHeaders })
      }

      // === CHECK KEYWORD MATCH ===
      const matchedFlow = flowAutomations.find((flow: any) => {
        const keywords = extractFlowKeywords(flow)
        return keywords.some((keyword) => isKeywordMatch(normalizedMessage, keyword))
      })

      if (matchedFlow) {
        console.log('Fluxo encontrado para palavra-chave:', matchedFlow.keyword)
        
        const nodes: FlowNode[] = matchedFlow.nodes || []
        const edges: FlowEdge[] = matchedFlow.edges || []

        // Find initial node
        const initialNode = nodes.find(n => n.type === 'blocoInicial')
        if (initialNode) {
          // Process flow sequentially
          await processFlowNode(
            initialNode.id,
            nodes,
            edges,
            phone,
            zapiConfig,
            supabase,
            new Set<string>()
          )
          
          // Log the interaction
          await supabase.from('message_logs').insert({
            phone,
            message_received: messageRaw,
            keyword_matched: matchedFlow.keyword,
            response_sent: `[Fluxo: ${matchedFlow.name}]`,
            timestamp: new Date().toISOString(),
            user_id: userId,
          })

          return new Response('flow_sent', { status: 200, headers: corsHeaders })
        }
      }
    }

    // === FALLBACK: CHECK AUTO RESPONSES ===
    const { data: responses, error: responsesError } = await supabase
      .from('auto_responses')
      .select('*')
      .eq('active', true)
      .eq('user_id', userId)
    
    if (responsesError) {
      console.error('Erro ao buscar respostas:', responsesError)
      return new Response('responses_error', { status: 500, headers: corsHeaders })
    }

    const matchedResponse = responses?.find(response => 
      messageText.includes(response.keyword.toLowerCase())
    )

    if (matchedResponse) {
      console.log('Palavra-chave encontrada:', matchedResponse.keyword)
      
      await supabase.from('message_logs').insert({
        phone,
        message_received: messageRaw,
        keyword_matched: matchedResponse.keyword,
        response_sent: matchedResponse.response,
        timestamp: new Date().toISOString(),
        user_id: userId,
      })

      const zapiResponse = await fetch(
        `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiConfig.zapi_client_token,
          },
          body: JSON.stringify({ phone, message: matchedResponse.response }),
        }
      )

      const zapiResult = await zapiResponse.text()
      console.log('Resposta Z-API:', zapiResponse.status, zapiResult)

      return new Response(zapiResponse.ok ? 'response_sent' : 'send_error', {
        status: zapiResponse.ok ? 200 : 500,
        headers: corsHeaders,
      })
    }

    console.log('Nenhuma palavra-chave correspondente encontrada')
    return new Response('no_match', { status: 200, headers: corsHeaders })
    
  } catch (error) {
    console.error('Erro no webhook:', error)
    return new Response('error', { status: 500, headers: corsHeaders })
  }
})

async function processFlowNode(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  phone: string,
  zapiConfig: any,
  supabase: any,
  visited: Set<string>
) {
  if (visited.has(nodeId)) return
  visited.add(nodeId)

  const outgoing = edges.filter(e => e.source === nodeId)
  
  for (const edge of outgoing) {
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!targetNode) continue

    if (targetNode.type === 'blocoConteudo') {
      const contentType = targetNode.data.contentType || 'text'
      const content = targetNode.data.content || ''
      const mediaUrl = targetNode.data.mediaUrl || ''

      // Support new buttons array AND legacy single button fields
      const buttons: Array<{text: string, type: string, value: string}> = targetNode.data.buttons || []
      const legacyLabel = targetNode.data.buttonLabel || ''
      const legacyUrl = targetNode.data.buttonUrl || ''
      if (buttons.length === 0 && legacyLabel && legacyUrl) {
        buttons.push({ text: legacyLabel, type: 'url', value: legacyUrl })
      }

      // Filter out "flow" type buttons — they are for internal routing only
      const sendableButtons = buttons.filter(b => b.type !== 'flow')
      // "flow" buttons are sent as REPLY so the user can click them
      const flowButtons = buttons.filter(b => b.type === 'flow')
      const allSendButtons = [
        ...sendableButtons,
        ...flowButtons.map(b => ({ ...b, type: 'reply' })),
      ]
      const hasButtons = allSendButtons.length > 0

      const baseUrl = `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}`
      const headers = {
        'Content-Type': 'application/json',
        'Client-Token': zapiConfig.zapi_client_token,
      }

      function buildButtonActions(btns: typeof allSendButtons) {
        return btns.map((btn, i) => {
          const label = (btn.text || '').trim() || `Botão ${i + 1}`
          if (btn.type === 'url') {
            const rawUrl = (btn.value || '').trim()
            const url = rawUrl.match(/^https?:\/\//) ? rawUrl : `https://${rawUrl}`
            return { id: String(i + 1), type: 'URL', url, label }
          }
          if (btn.type === 'call') {
            return { id: String(i + 1), type: 'CALL', phoneNumber: (btn.value || '').trim(), label }
          }
          return { id: String(i + 1), type: 'REPLY', label }
        })
      }

      try {
        if (hasButtons) {
          if ((contentType === 'image' || contentType === 'video') && mediaUrl) {
            const mediaEndpoint = contentType === 'image' ? '/send-image' : '/send-video'
            const mediaBody: any = { phone }
            mediaBody[contentType] = mediaUrl
            await fetch(`${baseUrl}${mediaEndpoint}`, { method: 'POST', headers, body: JSON.stringify(mediaBody) })
            await new Promise(resolve => setTimeout(resolve, 1500))
          }

          const buttonActions = buildButtonActions(allSendButtons)
          const res = await fetch(`${baseUrl}/send-button-actions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ phone, message: content, buttonActions }),
          })
          const result = await res.text()
          console.log(`Bloco ${targetNode.id} (${contentType}+buttons): ${res.status}`, result)
          await new Promise(resolve => setTimeout(resolve, 1500))
        } else {
          let endpoint = ''
          let body: any = { phone }

          switch (contentType) {
            case 'text':
              endpoint = '/send-text'
              body.message = content
              break
            case 'image':
              endpoint = '/send-image'
              body.image = mediaUrl
              body.caption = content
              break
            case 'video':
              endpoint = '/send-video'
              body.video = mediaUrl
              body.caption = content
              break
            case 'audio':
              endpoint = '/send-audio'
              body.audio = mediaUrl
              body.waveform = true
              break
            case 'document':
              endpoint = '/send-document-url'
              body.document = mediaUrl
              body.fileName = 'documento'
              body.caption = content
              break
            default:
              endpoint = '/send-text'
              body.message = content
          }

          if (endpoint) {
            const res = await fetch(`${baseUrl}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) })
            const result = await res.text()
            console.log(`Bloco ${targetNode.id} (${contentType}): ${res.status}`, result)
            await new Promise(resolve => setTimeout(resolve, 1500))
          }
        }
      } catch (e) {
        console.error(`Erro ao processar bloco ${targetNode.id}:`, e)
      }

      // Check if any button has a per-button edge connection
      const hasButtonEdges = buttons.some((btn, idx) => {
        return edges.some(e => e.source === targetNode.id && e.sourceHandle === `button-${idx}`)
      })

      if (hasButtonEdges) {
        // Don't follow the default output — button edges handle routing
        // The next message from the user will re-trigger the webhook
        // and match via the flow's condition nodes or button text
        console.log(`Bloco ${targetNode.id} tem saídas por botão — aguardando resposta do usuário`)
        continue
      }
    }

    // Continue processing the flow via default edges
    await processFlowNode(targetNode.id, nodes, edges, phone, zapiConfig, supabase, visited)
  }
}


function findButtonEdgeMatch(flows: any[], normalizedMessage: string, rawMessage: string): { flow: any, targetNodeId: string, buttonText: string, flowName: string } | null {
  const normalizedRaw = normalizeForMatch(rawMessage)

  for (const flow of flows) {
    const nodes = Array.isArray(flow?.nodes) ? flow.nodes : []
    const edges = Array.isArray(flow?.edges) ? flow.edges : []

    for (const node of nodes) {
      if (node?.type !== 'blocoConteudo') continue
      const buttons = Array.isArray(node?.data?.buttons) ? node.data.buttons : []

      for (let idx = 0; idx < buttons.length; idx++) {
        const btn = buttons[idx]
        if (btn.type !== 'flow' && btn.type !== 'reply') continue
        const btnText = (btn.text || '').trim()
        if (!btnText) continue

        const normalizedBtn = normalizeForMatch(btnText)
        if (!normalizedBtn) continue

        if (normalizedRaw === normalizedBtn || normalizedMessage === normalizedBtn) {
          const handleId = `button-${idx}`
          const buttonEdge = edges.find((e: any) => e.source === node.id && e.sourceHandle === handleId)

          if (buttonEdge) {
            return {
              flow,
              targetNodeId: buttonEdge.target,
              buttonText: btnText,
              flowName: flow.name,
            }
          }
        }
      }
    }
  }

  return null
}

function extractFlowKeywords(flow: any): string[] {
  const keywords = new Set<string>()

  const flowKeyword = (flow?.keyword || '').trim()
  if (flowKeyword) keywords.add(flowKeyword)

  const nodes = Array.isArray(flow?.nodes) ? flow.nodes : []
  for (const node of nodes) {
    if (node?.type !== 'blocoCondicao') continue

    const conditionType = (node?.data?.conditionType || 'keyword').toString().toLowerCase()
    const condition = (node?.data?.condition || '').trim()

    if ((conditionType === 'keyword' || !conditionType) && condition) {
      keywords.add(condition)
    }
  }

  return Array.from(keywords)
}

function extractMessageText(webhook: any): string {
  const candidates = [
    webhook?.message?.text,
    webhook?.message?.conversation,
    webhook?.message?.extendedTextMessage?.text,
    webhook?.message?.imageMessage?.caption,
    webhook?.message?.videoMessage?.caption,
    webhook?.message?.documentMessage?.caption,
    webhook?.text?.message,
    webhook?.text,
    webhook?.body,
    webhook?.message,
    webhook?.conversation,
    webhook?.image?.caption,
    webhook?.video?.caption,
    webhook?.document?.caption,
    webhook?.buttonResponseMessage?.selectedDisplayText,
    webhook?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.listResponseMessage?.title,
    webhook?.listResponseMessage?.singleSelectReply?.selectedRowId,
    webhook?.interactiveResponse?.title,
    webhook?.interactiveResponse?.description,
    webhook?.waitingMessage?.text,
    webhook?.waitingMessage?.message,
    webhook?.waitingMessage?.body,
    webhook?.data?.message?.text,
    webhook?.data?.message,
    webhook?.data?.text?.message,
    webhook?.data?.body,
    webhook?.data?.conversation,
    webhook?.data?.image?.caption,
    webhook?.data?.video?.caption,
    webhook?.data?.document?.caption,
    webhook?.data?.waitingMessage?.text,
    webhook?.data?.waitingMessage?.message,
    webhook?.data?.waitingMessage?.body,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  const objectCandidates = [
    webhook?.message,
    webhook?.waitingMessage,
    webhook?.data?.message,
    webhook?.data?.waitingMessage,
  ]

  const fallbackKeys = ['text', 'message', 'body', 'caption', 'conversation', 'title', 'description']
  for (const candidate of objectCandidates) {
    if (!candidate || typeof candidate !== 'object') continue
    for (const key of fallbackKeys) {
      const value = candidate?.[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }

  return ''
}

function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isKeywordMatch(message: string, keyword: string): boolean {
  const normalizedKeyword = normalizeForMatch(keyword)
  if (!normalizedKeyword || !message) return false

  if (message.includes(normalizedKeyword)) return true

  const words = normalizedKeyword.split(' ').filter(w => w.length >= 3)
  if (words.length === 0) return false
  const hits = words.filter(w => message.includes(w)).length
  return hits / words.length >= 0.7
}
