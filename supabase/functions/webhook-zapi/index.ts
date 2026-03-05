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

    const messageRaw = (
      webhook?.message?.text ??
      webhook?.text?.message ??
      webhook?.text ??
      ''
    ).toString()
    const messageText = messageRaw.toLowerCase()

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

    // Find user by instanceId
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, zapi_instance_id, zapi_token, zapi_client_token')
      .eq('zapi_instance_id', instanceId)
      .single()

    if (profileError || !profile) {
      console.error('User profile not found for instanceId:', instanceId)
      return new Response('user_not_found', { status: 404, headers: corsHeaders })
    }

    if (!profile.zapi_token || !profile.zapi_client_token) {
      console.error('User has incomplete Z-API credentials')
      return new Response('incomplete_credentials', { status: 400, headers: corsHeaders })
    }

    // Forward to gateway integrations
    const { data: gateways } = await supabase
      .from('gateway_integrations')
      .select('*')
      .eq('user_id', profile.id)
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
      .eq('user_id', profile.id)
      .eq('active', true)

    if (!flowError && flowAutomations && flowAutomations.length > 0) {
      const matchedFlow = flowAutomations.find((flow: any) => {
        const keyword = (flow.keyword || '').toLowerCase().trim()
        return keyword && messageText.includes(keyword)
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
            profile,
            supabase,
            new Set<string>()
          )
          
          // Log the interaction
          await supabase.from('message_logs').insert({
            phone,
            message_received: webhook.message.text,
            keyword_matched: matchedFlow.keyword,
            response_sent: `[Fluxo: ${matchedFlow.name}]`,
            timestamp: new Date().toISOString(),
            user_id: profile.id,
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
      .eq('user_id', profile.id)
    
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
        message_received: webhook.message.text,
        keyword_matched: matchedResponse.keyword,
        response_sent: matchedResponse.response,
        timestamp: new Date().toISOString(),
        user_id: profile.id,
      })

      const zapiResponse = await fetch(
        `https://api.z-api.io/instances/${profile.zapi_instance_id}/token/${profile.zapi_token}/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': profile.zapi_client_token,
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
  profile: any,
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

      const baseUrl = `https://api.z-api.io/instances/${profile.zapi_instance_id}/token/${profile.zapi_token}`
      const headers = {
        'Content-Type': 'application/json',
        'Client-Token': profile.zapi_client_token,
      }

      try {
        let endpoint = ''
        let body: any = { phone }

        if (buttonLabel && buttonUrl && contentType === 'text') {
          // Send as button message
          endpoint = '/send-button-list'
          body = {
            phone,
            message: content,
            buttonList: {
              buttons: [
                {
                  id: '1',
                  label: buttonLabel,
                  action: { type: 'URL', url: buttonUrl }
                }
              ]
            }
          }
        } else {
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
        }

        if (endpoint) {
          const res = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          })
          const result = await res.text()
          console.log(`Bloco ${targetNode.id} (${contentType}): ${res.status}`, result)
          
          // Delay between messages
          await new Promise(resolve => setTimeout(resolve, 1500))
        }
      } catch (e) {
        console.error(`Erro ao processar bloco ${targetNode.id}:`, e)
      }
    }

    // Continue processing the flow
    await processFlowNode(targetNode.id, nodes, edges, phone, profile, supabase, visited)
  }
}
