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
  position?: {
    x?: number
    y?: number
  }
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

  let processingLockId: string | null = null

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

    // Dedupe idempotente: cria um lock por usuário+telefone+mensagem em janela de 15s
    const lockResult = await acquireMessageProcessingLock(supabase, {
      userId,
      phone,
      normalizedMessage,
      rawMessage: messageRaw,
    })

    if (!lockResult.acquired) {
      console.log('Mensagem duplicada detectada, ignorando para manter ordem do fluxo')
      return new Response('ignored_duplicate', { status: 200, headers: corsHeaders })
    }

    processingLockId = lockResult.lockId

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
        console.log('=== BOTÃO MATCH ===')
        console.log('Fluxo:', buttonMatch.flowName, '| Botão:', buttonMatch.buttonText, '| Target:', buttonMatch.targetNodeId)
        const { flow, targetNodeId } = buttonMatch
        const flowNodes: FlowNode[] = flow.nodes || []
        const flowEdges: FlowEdge[] = flow.edges || []

        console.log('Total nodes:', flowNodes.length, '| Total edges:', flowEdges.length)
        console.log('Target node:', JSON.stringify(flowNodes.find(n => n.id === targetNodeId)?.data))

        // Process flow starting FROM the target node directly
        // First send the target node itself, then continue its children
        const targetNode = flowNodes.find(n => n.id === targetNodeId)
        if (targetNode) {
          const visited = new Set<string>()
          // Send target node content
          await sendNodeContent(targetNode, flowNodes, flowEdges, phone, zapiConfig, visited)
          // Then continue processing children from target node
          await processFlowNode(targetNode.id, flowNodes, flowEdges, phone, zapiConfig, supabase, visited)
        }

        await finalizeMessageLog(supabase, processingLockId, {
          keywordMatched: `[Botão: ${buttonMatch.buttonText}]`,
          responseSent: `[Fluxo: ${flow.name}]`,
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
          await finalizeMessageLog(supabase, processingLockId, {
            keywordMatched: matchedFlow.keyword,
            responseSent: `[Fluxo: ${matchedFlow.name}]`,
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
      await releaseMessageProcessingLock(supabase, processingLockId)
      return new Response('responses_error', { status: 500, headers: corsHeaders })
    }

    const matchedResponse = responses?.find(response => 
      messageText.includes(response.keyword.toLowerCase())
    )

    if (matchedResponse) {
      console.log('Palavra-chave encontrada:', matchedResponse.keyword)
      
      await finalizeMessageLog(supabase, processingLockId, {
        keywordMatched: matchedResponse.keyword,
        responseSent: matchedResponse.response,
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

    await releaseMessageProcessingLock(supabase, processingLockId)
    console.log('Nenhuma palavra-chave correspondente encontrada')
    return new Response('no_match', { status: 200, headers: corsHeaders })
    
  } catch (error) {
    if (processingLockId) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await releaseMessageProcessingLock(supabase, processingLockId)
      } catch (releaseError) {
        console.error('Erro ao liberar lock de processamento:', releaseError)
      }
    }
    console.error('Erro no webhook:', error)
    return new Response('error', { status: 500, headers: corsHeaders })
  }
})

async function sendNodeContent(
  targetNode: any,
  nodes: FlowNode[],
  edges: FlowEdge[],
  phone: string,
  zapiConfig: any,
  visited: Set<string>
): Promise<boolean> {
  if (visited.has(targetNode.id)) return false
  visited.add(targetNode.id)

  if (targetNode.type !== 'blocoConteudo') return false

  const contentType = targetNode.data.contentType || 'text'
  const content = targetNode.data.content || ''
  const mediaUrl = targetNode.data.mediaUrl || ''
  const buttons: Array<{text: string, type: string, value: string}> = targetNode.data.buttons || []

  const sendableButtons = buttons.filter(b => b.type !== 'flow')
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
    console.log(`>>> Enviando bloco ${targetNode.id} tipo=${contentType} buttons=${allSendButtons.length}`)

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
    console.error(`Erro ao enviar bloco ${targetNode.id}:`, e)
  }

  // Return whether this node has button branching (should stop auto-flow)
  const hasButtonEdges = buttons.some((btn, idx) => {
    return edges.some(e => e.source === targetNode.id && e.sourceHandle === `button-${idx}`)
  })
  
  if (hasButtonEdges) {
    console.log(`Bloco ${targetNode.id} tem saídas por botão — aguardando resposta do usuário`)
    return true // signals: stop processing
  }

  return false // signals: continue processing children
}

async function processFlowNode(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  phone: string,
  zapiConfig: any,
  supabase: any,
  visited: Set<string>
) {
  const currentNode = nodes.find(n => n.id === nodeId)
  const sortEdgesByCanvasPosition = (list: FlowEdge[]) => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    return [...list].sort((a, b) => {
      const aTarget = nodeMap.get(a.target)
      const bTarget = nodeMap.get(b.target)
      const ay = aTarget?.position?.y ?? 0
      const by = bTarget?.position?.y ?? 0
      if (ay !== by) return ay - by
      const ax = aTarget?.position?.x ?? 0
      const bx = bTarget?.position?.x ?? 0
      return ax - bx
    })
  }

  // Default path (bottom handle) keeps existing behavior for content + button branching
  const defaultOutgoing = edges.filter(
    e => e.source === nodeId && (!e.sourceHandle || e.sourceHandle === 'default' || e.sourceHandle === null)
  )

  // Condição fallback: if no default edge exists, follow configured branch handles (a/b)
  const outgoing =
    defaultOutgoing.length > 0
      ? sortEdgesByCanvasPosition(defaultOutgoing)
      : currentNode?.type === 'blocoCondicao'
      ? sortEdgesByCanvasPosition(edges.filter(e => e.source === nodeId))
      : []

  console.log(
    `processFlowNode(${nodeId}): ${outgoing.length} outgoing edges${
      defaultOutgoing.length === 0 && currentNode?.type === 'blocoCondicao' ? ' (fallback condicao)' : ' (default)'
    }`
  )

  for (const edge of outgoing) {
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!targetNode) continue

    if (targetNode.type === 'blocoConteudo') {
      const shouldStop = await sendNodeContent(targetNode, nodes, edges, phone, zapiConfig, visited)
      if (shouldStop) continue
    }

    await processFlowNode(targetNode.id, nodes, edges, phone, zapiConfig, supabase, visited)
  }
}


async function acquireMessageProcessingLock(
  supabase: any,
  params: { userId: string; phone: string; normalizedMessage: string; rawMessage: string }
): Promise<{ acquired: boolean; lockId: string }> {
  const { userId, phone, normalizedMessage, rawMessage } = params
  const bucket = Math.floor(Date.now() / 15000)
  const baseKey = `${userId}|${phone}|${normalizedMessage || normalizeForMatch(rawMessage)}|${bucket}`
  const lockId = await stableUuidFromText(baseKey)

  const { error } = await supabase
    .from('message_logs')
    .insert({
      id: lockId,
      phone,
      message_received: rawMessage,
      keyword_matched: '__processing__',
      response_sent: '__processing__',
      timestamp: new Date().toISOString(),
      user_id: userId,
    })

  if (!error) return { acquired: true, lockId }

  const isDuplicate =
    error?.code === '23505' ||
    (typeof error?.message === 'string' && error.message.toLowerCase().includes('duplicate key'))

  if (isDuplicate) return { acquired: false, lockId }

  throw new Error(`Erro ao adquirir lock de dedupe: ${error.message}`)
}

async function finalizeMessageLog(
  supabase: any,
  lockId: string,
  params: { keywordMatched: string; responseSent: string }
) {
  const { keywordMatched, responseSent } = params
  await supabase
    .from('message_logs')
    .update({
      keyword_matched: keywordMatched,
      response_sent: responseSent,
      timestamp: new Date().toISOString(),
    })
    .eq('id', lockId)
}

async function releaseMessageProcessingLock(supabase: any, lockId: string) {
  await supabase
    .from('message_logs')
    .delete()
    .eq('id', lockId)
    .eq('keyword_matched', '__processing__')
}

async function stableUuidFromText(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
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
          // First try: specific button edge
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

          // Fallback: follow the default edge from this node (bottom handle)
          const defaultEdge = edges.find((e: any) =>
            e.source === node.id && (!e.sourceHandle || e.sourceHandle === 'default' || e.sourceHandle === null)
          )

          if (defaultEdge) {
            return {
              flow,
              targetNodeId: defaultEdge.target,
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

    // Interactive/button replies (Z-API variations)
    webhook?.buttonReply?.title,
    webhook?.buttonReply?.text,
    webhook?.buttonReply?.label,
    webhook?.buttonReply?.selectedDisplayText,
    webhook?.buttonReply?.selectedRowId,
    webhook?.buttonReply?.id,
    webhook?.message?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.message?.buttonResponseMessage?.selectedDisplayText,
    webhook?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.buttonResponseMessage?.selectedDisplayText,
    webhook?.listResponseMessage?.title,
    webhook?.listResponseMessage?.singleSelectReply?.selectedRowId,
    webhook?.interactiveResponse?.title,
    webhook?.interactiveResponse?.description,

    webhook?.waitingMessage?.text,
    webhook?.waitingMessage?.message,
    webhook?.waitingMessage?.body,
    webhook?.waitingMessage?.buttonReply?.title,
    webhook?.waitingMessage?.buttonReply?.text,
    webhook?.waitingMessage?.buttonReply?.label,
    webhook?.waitingMessage?.buttonReply?.selectedDisplayText,

    webhook?.text?.message,
    webhook?.text,
    webhook?.body,
    webhook?.message,
    webhook?.conversation,
    webhook?.image?.caption,
    webhook?.video?.caption,
    webhook?.document?.caption,

    webhook?.data?.message?.text,
    webhook?.data?.message,
    webhook?.data?.text?.message,
    webhook?.data?.body,
    webhook?.data?.conversation,
    webhook?.data?.image?.caption,
    webhook?.data?.video?.caption,
    webhook?.data?.document?.caption,
    webhook?.data?.buttonReply?.title,
    webhook?.data?.buttonReply?.text,
    webhook?.data?.buttonReply?.label,
    webhook?.data?.buttonReply?.selectedDisplayText,
    webhook?.data?.waitingMessage?.text,
    webhook?.data?.waitingMessage?.message,
    webhook?.data?.waitingMessage?.body,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  const objectCandidates = [
    webhook?.buttonReply,
    webhook?.message,
    webhook?.waitingMessage,
    webhook?.data?.buttonReply,
    webhook?.data?.message,
    webhook?.data?.waitingMessage,
  ]

  const fallbackKeys = ['text', 'message', 'body', 'caption', 'conversation', 'title', 'description', 'label', 'selectedDisplayText', 'selectedRowId', 'id']
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
