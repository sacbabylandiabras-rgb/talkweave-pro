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
      console.log('Mensagem vazia no payload. Chaves:', Object.keys(webhook || {}))
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
      const buttonLabel = targetNode.data.buttonLabel || ''
      const buttonUrl = targetNode.data.buttonUrl || ''

      const baseUrl = `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}`
      const headers = {
        'Content-Type': 'application/json',
        'Client-Token': zapiConfig.zapi_client_token,
      }

      try {
        // === CAROUSEL ===
        if (contentType === 'carousel') {
          const carouselCards = (targetNode.data.carouselCards || [])
            .map((card: any, idx: number) => {
              const title = (card.title || '').trim() || `Card ${idx + 1}`
              const description = (card.description || '').trim() || 'Confira os detalhes'
              const image = (card.image || '').trim()
              if (!image) return null

              const cardData: any = { title, description, image }

              if (card.buttonLabel || card.buttonUrl) {
                const label = (card.buttonLabel || '').trim() || 'Abrir'
                const rawUrl = (card.buttonUrl || '').trim()
                if (rawUrl) {
                  const url = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`
                  cardData.buttonActions = [{ type: 'URL', url, label }]
                }
              }

              return cardData
            })
            .filter(Boolean)

          if (carouselCards.length >= 2) {
            const res = await fetch(`${baseUrl}/send-carousel`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ phone, cards: carouselCards }),
            })
            const result = await res.text()
            console.log(`Bloco ${targetNode.id} (carousel): ${res.status}`, result)
          } else {
            console.log(`Bloco ${targetNode.id}: carrossel precisa de ao menos 2 cards`)
          }
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        // === BUTTON MESSAGES ===
        else if (buttonLabel && buttonUrl && contentType === 'text') {
          const finalUrl = buttonUrl.match(/^https?:\/\//) ? buttonUrl : `https://${buttonUrl}`
          const res = await fetch(`${baseUrl}/send-button-actions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              phone,
              message: content,
              buttonActions: [{ id: '1', type: 'URL', url: finalUrl, label: buttonLabel }],
            }),
          })
          const result = await res.text()
          console.log(`Bloco ${targetNode.id} (text+button): ${res.status}`, result)
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        else if (buttonLabel && buttonUrl && (contentType === 'image' || contentType === 'video')) {
          // Send media first
          const mediaEndpoint = contentType === 'image' ? '/send-image' : '/send-video'
          const mediaBody: any = { phone }
          mediaBody[contentType] = mediaUrl
          await fetch(`${baseUrl}${mediaEndpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(mediaBody),
          })
          await new Promise(resolve => setTimeout(resolve, 1500))

          // Then button message
          const finalUrl = buttonUrl.match(/^https?:\/\//) ? buttonUrl : `https://${buttonUrl}`
          const res = await fetch(`${baseUrl}/send-button-actions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              phone,
              message: content,
              buttonActions: [{ id: '1', type: 'URL', url: finalUrl, label: buttonLabel }],
            }),
          })
          const result = await res.text()
          console.log(`Bloco ${targetNode.id} (${contentType}+button): ${res.status}`, result)
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
        // === PLAIN MEDIA ===
        else {
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
            const res = await fetch(`${baseUrl}${endpoint}`, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            })
            const result = await res.text()
            console.log(`Bloco ${targetNode.id} (${contentType}): ${res.status}`, result)
            await new Promise(resolve => setTimeout(resolve, 1500))
          }
        }
      } catch (e) {
        console.error(`Erro ao processar bloco ${targetNode.id}:`, e)
      }
    }

    // Continue processing the flow
    await processFlowNode(targetNode.id, nodes, edges, phone, zapiConfig, supabase, visited)
  }
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
    webhook?.text?.message,
    webhook?.text,
    webhook?.body,
    webhook?.image?.caption,
    webhook?.video?.caption,
    webhook?.document?.caption,
    webhook?.buttonResponseMessage?.selectedDisplayText,
    webhook?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.listResponseMessage?.title,
    webhook?.listResponseMessage?.singleSelectReply?.selectedRowId,
    webhook?.interactiveResponse?.title,
    webhook?.interactiveResponse?.description,
    webhook?.data?.message?.text,
    webhook?.data?.text?.message,
    webhook?.data?.body,
    webhook?.data?.image?.caption,
    webhook?.data?.video?.caption,
    webhook?.data?.document?.caption,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
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
