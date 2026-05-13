import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const VERIFY_TOKEN = "zaplynx_whatsapp_verify_2024"
 const WHATSAPP_META_APP_ID = "26985190684454065"
const API_VERSION = "v21.0"
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface FlowNode {
  id: string
  type: string
  position?: { x?: number; y?: number }
  data: {
    content?: string
    contentType?: string
    mediaUrl?: string
    buttons?: Array<{ text: string; type: string; value: string }>
    condition?: string
    conditionType?: string
    isPtv?: boolean
    viewOnce?: boolean
  }
}

interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

interface MetaReplyButton {
  id: string
  title: string
}

interface MetaCredentialRow {
  user_id: string
  access_token: string
  phone_number_id?: string | null
  waba_id?: string | null
  business_account_id?: string | null
}

const FLOW_CAPTURE_PREFIX = "__flow_capture__:"
const FLOW_BUTTON_PREFIX = "__flow_button__:"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    console.log('[webhook-meta] Verification request:', { mode, token, challenge })

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[webhook-meta] ✅ Verification successful')
      return new Response(challenge || '', { status: 200 })
    }

    console.log('[webhook-meta] ❌ Verification failed - token mismatch')
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json()
       console.log('[webhook-meta-v2] Received event:', JSON.stringify(body).slice(0, 500))

      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const entries = body?.entry || []
      const credentialCache = new Map<string, MetaCredentialRow | null>()

      for (const entry of entries) {
        const changes = entry?.changes || []
        for (const change of changes) {
          const field = change?.field
          const value = change?.value

          if (field === 'messages') {
            const messages = value?.messages || []
            const contacts = value?.contacts || []
            const phoneNumberId = value?.metadata?.phone_number_id

            if (!phoneNumberId) continue

            // Try to find user by phone_number_id first, then by any phone in the WABA
            const cred = await resolveMetaCredentialByPhoneNumber(supabase, phoneNumberId, credentialCache)

            if (!cred) {
              console.log('[webhook-meta] No user found for phone_number_id:', phoneNumberId)
              continue
            }

            const userId = cred.user_id
            const accessToken = cred.access_token

            for (const msg of messages) {
              const fromPhone = msg?.from || ''
              const contactName = contacts?.find((c: any) => c?.wa_id === fromPhone)?.profile?.name || ''

              // Extract message text from various Meta message types
              let msgText = ''
              let buttonReplyTitle = ''
              let buttonReplyId = ''

              if (msg?.type === 'text') {
                msgText = msg?.text?.body || ''
              } else if (msg?.type === 'interactive') {
                // Interactive button reply
                if (msg?.interactive?.type === 'button_reply') {
                  buttonReplyTitle = msg?.interactive?.button_reply?.title || ''
                  buttonReplyId = msg?.interactive?.button_reply?.id || ''
                  msgText = buttonReplyTitle
                } else if (msg?.interactive?.type === 'list_reply') {
                  msgText = msg?.interactive?.list_reply?.title || ''
                }
              } else if (msg?.type === 'button') {
                // Template button reply
                buttonReplyTitle = msg?.button?.text || ''
                msgText = buttonReplyTitle
              }

               console.log(`[webhook-meta] Message from ${fromPhone}: type=${msg?.type} text="${msgText?.slice(0, 100)}" buttonReply="${buttonReplyTitle}" | contact: ${contactName}`)

               // Only log if it's NOT a message we just sent (Meta webhooks sometimes echo back)
               // Actually, Meta normally doesn't echo, but let's log everything for visibility first
               try {
                 await supabase.from('message_logs').insert({
                   user_id: userId,
                   phone: fromPhone,
                   message_received: msgText,
                   keyword_matched: null,
                   response_sent: null,
                   instance_id: `meta:${phoneNumberId}`,
                 })
               } catch (logErr) {
                 console.error('[webhook-meta] Error logging received message:', logErr)
               }

              if (!msgText || !accessToken) continue

              // === CHECK FLOW AUTOMATIONS ===

               // Resume pending capture/button flows first - check specifically for meta instance
                const { data: pendingFlowLog, error: pendingError } = await supabase
                  .from('message_logs')
                  .select('*')
                  .eq('user_id', userId)
                  .eq('phone', fromPhone)
                  .in('keyword_matched', [
                    `${FLOW_CAPTURE_PREFIX}${userId}`,
                    `${FLOW_BUTTON_PREFIX}${userId}`,
                  ])
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle()

               if (pendingError) {
                 console.error('[webhook-meta] Error fetching pending flow log:', pendingError)
               }

              if (pendingFlowLog) {
                const isCapture = pendingFlowLog.keyword_matched.startsWith(FLOW_CAPTURE_PREFIX)
                const pendingState = JSON.parse(pendingFlowLog.response_sent || '{}')
                const flowId = pendingState.flowId

                if (flowId) {
                  const { data: pendingFlow } = await supabase
                    .from('flow_automations')
                    .select('*')
                    .eq('id', flowId)
                    .eq('active', true)
                    .maybeSingle()

                  if (pendingFlow) {
                    if (isCapture) {
                      // Resume capture flow
                      console.log(`[webhook-meta] Resuming capture flow ${pendingFlow.name} for ${fromPhone}`)
                      const nodes = pendingFlow.nodes || []
                      const edges = pendingFlow.edges || []
                      const currentNode = nodes.find((n: any) => n.id === pendingState.nodeId)

                      if (currentNode) {
                        // Delete the pending log so it doesn't trigger again
                        await supabase.from('message_logs').delete().eq('id', pendingFlowLog.id)
                        
                        const captured = pendingState.captured || {}
                        captured[pendingState.field] = msgText
                        
                        const metaCreds = { access_token: accessToken, phone_number_id: phoneNumberId }
                        const options = { resumeCaptured: captured, flowId: pendingFlow.id }
                        await processFlowNodeMeta(currentNode.id, nodes, edges, fromPhone, metaCreds, supabase, new Set<string>(), userId, pendingFlow.name, options)
                        continue
                      }
                    } else {
                      // Check for button match in the current flow
                      const buttonMatch = findButtonEdgeMatch([pendingFlow], normalizeForMatch(msgText), msgText, buttonReplyTitle, buttonReplyId)
                      if (buttonMatch) {
                        console.log(`[webhook-meta] Matched pending flow button: ${buttonMatch.buttonText}`)
                        await supabase.from('message_logs').delete().eq('id', pendingFlowLog.id)
                        
                        const metaCreds = { access_token: accessToken, phone_number_id: phoneNumberId }
                        const visited = new Set<string>()
                        const targetNode = pendingFlow.nodes.find((n: any) => n.id === buttonMatch.targetNodeId)
                        if (targetNode) {
                          const options = { resumeCaptured: pendingState.captured || {}, flowId: pendingFlow.id }
                          const shouldStop = await sendNodeContentMeta(targetNode, pendingFlow.nodes, pendingFlow.edges, fromPhone, metaCreds, visited, supabase, userId, pendingFlow.name, options)
                          if (!shouldStop) {
                            await processFlowNodeMeta(targetNode.id, pendingFlow.nodes, pendingFlow.edges, fromPhone, metaCreds, supabase, visited, userId, pendingFlow.name, options)
                          }
                        }
                        continue
                      }
                    }
                  }
                }
              }

              const { data: flowAutomations } = await supabase
                .from('flow_automations')
                .select('*')
                .eq('user_id', userId)
                .eq('active', true)

              if (flowAutomations && flowAutomations.length > 0) {
                const normalizedMessage = normalizeForMatch(msgText)

                // === CHECK BUTTON REPLY MATCH ===
                const buttonMatch = findButtonEdgeMatch(flowAutomations, normalizedMessage, msgText, buttonReplyTitle, buttonReplyId)
                if (buttonMatch) {
                  console.log(`[webhook-meta] === BOTÃO MATCH === Flow: ${buttonMatch.flowName} | Button: ${buttonMatch.buttonText} | Target: ${buttonMatch.targetNodeId}`)

                  const { flow, targetNodeId } = buttonMatch
                  const flowNodes: FlowNode[] = flow.nodes || []
                  const flowEdges: FlowEdge[] = flow.edges || []

                  const targetNode = flowNodes.find(n => n.id === targetNodeId)
                  if (targetNode) {
                    const metaCreds = { access_token: accessToken, phone_number_id: phoneNumberId }
                    const visited = new Set<string>()
                    const options = { flowId: flow.id }
                    const shouldStop = await sendNodeContentMeta(targetNode, flowNodes, flowEdges, fromPhone, metaCreds, visited, supabase, userId, flow.name, options)
                    if (!shouldStop) {
                      await processFlowNodeMeta(targetNode.id, flowNodes, flowEdges, fromPhone, metaCreds, supabase, visited, userId, flow.name, options)
                    }
                  }

                  // Update the message log
                  await supabase.from('message_logs').insert({
                    user_id: userId,
                    phone: fromPhone,
                    message_received: null,
                    keyword_matched: `[Botão: ${buttonMatch.buttonText}]`,
                    response_sent: `[Fluxo: ${flow.name}]`,
                    instance_id: `meta:${phoneNumberId}`,
                  })

                  continue
                }

                // === CHECK KEYWORD MATCH ===
                const matchedFlow = flowAutomations.find((flow: any) => {
                  const keywords = extractFlowKeywords(flow)
                  return keywords.some((keyword) => isKeywordMatch(normalizedMessage, keyword))
                })

                if (matchedFlow) {
                  console.log(`[webhook-meta] Flow matched keyword: ${matchedFlow.keyword}`)

                  const nodes: FlowNode[] = matchedFlow.nodes || []
                  const edges: FlowEdge[] = matchedFlow.edges || []
                  const initialNode = nodes.find(n => n.type === 'blocoInicial')

                  if (initialNode) {
                    const metaCreds = { access_token: accessToken, phone_number_id: phoneNumberId }
                    await processFlowNodeMeta(initialNode.id, nodes, edges, fromPhone, metaCreds, supabase, new Set<string>(), userId, matchedFlow.name)

                    await supabase.from('message_logs').insert({
                      user_id: userId,
                      phone: fromPhone,
                      message_received: null,
                      keyword_matched: matchedFlow.keyword,
                      response_sent: `[Fluxo: ${matchedFlow.name}]`,
                      instance_id: `meta:${phoneNumberId}`,
                    })

                    continue
                  }
                }
              }

              // === FALLBACK: AUTO RESPONSES ===
              const { data: autoResponses } = await supabase
                .from('auto_responses')
                .select('*')
                .eq('user_id', userId)
                .eq('active', true)

              if (autoResponses && msgText) {
                const normalizedMsg = msgText.toLowerCase().trim()
                for (const ar of autoResponses) {
                  if (normalizedMsg.includes(ar.keyword.toLowerCase().trim())) {
                    await metaSendText(accessToken, phoneNumberId, fromPhone, ar.response)

                    console.log(`[webhook-meta] Auto-response sent for keyword "${ar.keyword}"`)

                    await supabase.from('message_logs').insert({
                      user_id: userId,
                      phone: fromPhone,
                      message_received: msgText,
                      keyword_matched: ar.keyword,
                      response_sent: ar.response,
                      instance_id: `meta:${phoneNumberId}`,
                    })
                    break
                  }
                }
              }
            }
          }

          // Status updates
          if (field === 'messages' && value?.statuses) {
            for (const status of value.statuses) {
              console.log(`[webhook-meta] Status update: ${status?.id} → ${status?.status}`)
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      console.error('[webhook-meta] Error processing webhook:', err)
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})

// =================== META API SEND HELPERS ===================

async function metaSendText(accessToken: string, phoneNumberId: string, to: string, message: string) {
  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'text',
      text: { body: message },
    }),
  })
  const data = await res.json()
  if (!res.ok) console.error('[webhook-meta] Send text error:', data)
  return data
}

async function metaSendMedia(accessToken: string, phoneNumberId: string, to: string, mediaType: string, mediaUrl: string, caption?: string) {
  const typeMap: Record<string, string> = { image: 'image', video: 'video', audio: 'audio', document: 'document' }
  const metaType = typeMap[mediaType] || 'document'
  const mediaPayload: Record<string, any> = { link: mediaUrl }
  if (caption && metaType !== 'audio') mediaPayload.caption = caption
  if (metaType === 'document') mediaPayload.filename = mediaUrl.split('/').pop() || 'file'

  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: metaType,
      [metaType]: mediaPayload,
    }),
  })
  const data = await res.json()
  if (!res.ok) console.error(`[webhook-meta] Send ${metaType} error:`, data)
  return data
}

async function metaSendInteractive(accessToken: string, phoneNumberId: string, to: string, message: string, buttons: MetaReplyButton[]) {
  const metaButtons = buttons.slice(0, 3).map(btn => ({
    type: 'reply',
    reply: { id: btn.id, title: btn.title.slice(0, 20) },
  }))

  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message },
        action: { buttons: metaButtons },
      },
    }),
  })
  const data = await res.json()
  if (!res.ok) console.error('[webhook-meta] Send interactive error:', data)
  return data
}

// =================== FLOW EXECUTION (SERVER-SIDE) ===================

async function sendNodeContentMeta(
  targetNode: FlowNode,
  nodes: FlowNode[],
  edges: FlowEdge[],
  phone: string,
  metaCreds: { access_token: string; phone_number_id: string },
  visited: Set<string>,
  supabase: any,
  userId: string,
  flowName: string,
  options?: {
    resumeCaptured?: Record<string, string>;
    flowId?: string;
  }
): Promise<boolean> {
  if (targetNode.type !== 'blocoConteudo') return false
  if (visited.has(targetNode.id)) return false
  visited.add(targetNode.id)

  // Handle delay before sending content
  const delaySeconds = Number(targetNode.data.delaySeconds || 0)
  if (delaySeconds > 0) {
    const safeDelay = Math.min(delaySeconds, 50) // Limit to 50s for backend
    console.log(`[webhook-meta] Bloco de conteúdo com delay de ${safeDelay}s`)
    await new Promise(resolve => setTimeout(resolve, safeDelay * 1000))
  }

  const contentType = targetNode.data.contentType || 'text'
  const replaceVars = (text: string) => {
    const captured = options?.resumeCaptured || {}
    return String(text || '')
      .replace(/\{\{nome\}\}/gi, captured.nome || '')
      .replace(/\{\{whatsapp\}\}/gi, captured.whatsapp || phone || '')
      .replace(/\{\{telefone\}\}/gi, captured.whatsapp || phone || '')
      .replace(/\{\{email\}\}/gi, captured.email || '')
  }

  const content = replaceVars(targetNode.data.content || '')
  const mediaUrl = targetNode.data.mediaUrl || ''
  const buttons: Array<{ text: string; type: string; value: string }> = targetNode.data.buttons || []

  const sendableButtons = buttons.filter(b => b.type !== 'flow')
  const flowButtons = buttons.filter(b => b.type === 'flow')
  const allSendButtons = [
    ...sendableButtons,
    ...flowButtons.map(b => ({ ...b, type: 'reply' })),
  ]
  const hasButtons = allSendButtons.length > 0

  console.log(`[webhook-meta] >>> Sending node ${targetNode.id} type=${contentType} buttons=${allSendButtons.length}`)

  try {
    if (hasButtons) {
      // Send media first if applicable
      if ((contentType === 'image' || contentType === 'video' || contentType === 'audio' || contentType === 'document') && mediaUrl) {
        await metaSendMedia(metaCreds.access_token, metaCreds.phone_number_id, phone, contentType, mediaUrl, '')
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      // Send interactive buttons (only reply buttons, Meta doesn't support URL/Call as interactive)
      const replyButtons = buildMetaReplyButtons(targetNode.id, allSendButtons)

      if (replyButtons.length > 0) {
        // Build message with URL/Call suffixes
        const urlCallParts: string[] = []
        for (const btn of allSendButtons) {
          if (btn.type === 'url' && btn.value) urlCallParts.push(`🔗 ${btn.text}: ${btn.value}`)
          if (btn.type === 'call' && btn.value) urlCallParts.push(`📞 ${btn.text}: ${btn.value}`)
        }
        const fullMessage = (content || 'Escolha uma opção:') + (urlCallParts.length > 0 ? '\n\n' + urlCallParts.join('\n') : '')
        await metaSendInteractive(metaCreds.access_token, metaCreds.phone_number_id, phone, fullMessage, replyButtons)
      } else {
        // Only URL/Call buttons — send as text with links
        const urlCallParts: string[] = []
        for (const btn of allSendButtons) {
          if (btn.type === 'url' && btn.value) urlCallParts.push(`🔗 ${btn.text}: ${btn.value}`)
          if (btn.type === 'call' && btn.value) urlCallParts.push(`📞 ${btn.text}: ${btn.value}`)
        }
        const fullMessage = (content || '') + (urlCallParts.length > 0 ? '\n\n' + urlCallParts.join('\n') : '')
        if (fullMessage) await metaSendText(metaCreds.access_token, metaCreds.phone_number_id, phone, fullMessage)
      }
    } else {
      // No buttons — send content based on type
      switch (contentType) {
        case 'text':
          if (content) await metaSendText(metaCreds.access_token, metaCreds.phone_number_id, phone, content)
          break
        case 'image':
        case 'video':
        case 'audio':
        case 'document':
          if (mediaUrl) await metaSendMedia(metaCreds.access_token, metaCreds.phone_number_id, phone, contentType, mediaUrl, content || undefined)
          break
        default:
          if (content) await metaSendText(metaCreds.access_token, metaCreds.phone_number_id, phone, content)
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1500))

    // Log the sent message
    if (supabase && userId) {
      try {
        const buttonLabels = allSendButtons.map(b => b.text).filter(Boolean).join(' | ')
        let logContent = content || ''
        if (mediaUrl && contentType !== 'text') logContent = `[media:${contentType}:${mediaUrl}]\n${logContent}`
        if (buttonLabels) logContent = `${logContent}\n\n[Botões: ${buttonLabels}]`

        if (logContent) {
          const isCapture = Boolean(targetNode.data.collectName || targetNode.data.collectWhatsapp || targetNode.data.collectEmail);
          const hasButtons = (targetNode.data.buttons || []).length > 0;
          
          let keywordMatched = `__flow_send__:${flowName}`;
          let responseSent = logContent.trim();

          if (isCapture || hasButtons) {
            keywordMatched = isCapture ? `${FLOW_CAPTURE_PREFIX}${userId}` : `${FLOW_BUTTON_PREFIX}${userId}`;
            responseSent = JSON.stringify({
              flowId: options?.flowId,
              flowName: flowName,
              nodeId: targetNode.id,
              field: targetNode.data.collectName ? 'nome' : targetNode.data.collectEmail ? 'email' : 'whatsapp',
              captured: options?.resumeCaptured || {}
            });
          }

          await supabase.from('message_logs').insert({
            phone,
            message_received: null,
            response_sent: responseSent,
            keyword_matched: keywordMatched,
            timestamp: new Date().toISOString(),
            user_id: userId,
            instance_id: `meta:${metaCreds.phone_number_id}`,
          })
        }
      } catch (logErr) {
        console.error('[webhook-meta] Error logging flow message:', logErr)
      }
    }
  } catch (e) {
    console.error(`[webhook-meta] Error sending node ${targetNode.id}:`, e)
    throw e
  }

  // Check if node has button edges or capture (should pause for user response)
  const hasButtonEdges = buttons.some((_btn, idx) => {
    const aliases = [
      `button-${idx}`,
      `button_${idx}`,
      `btn-${idx}`,
      `btn_${idx}`,
      `button-${idx + 1}`,
      `button_${idx + 1}`,
      `btn-${idx + 1}`,
      `btn_${idx + 1}`,
    ]
    return edges.some(e => e.source === targetNode.id && aliases.includes(String(e.sourceHandle || "")))
  })

  const hasCapture = Boolean(
    targetNode.data.collectName ||
    targetNode.data.collectWhatsapp ||
    targetNode.data.collectEmail ||
    edges.some(e => e.source === targetNode.id && String(e.sourceHandle || "").startsWith("collect-"))
  )

  if (hasButtonEdges || hasCapture) {
    console.log(`[webhook-meta] Node ${targetNode.id} has button edges or capture — waiting for user response`)
    return true
  }

  return false
}

async function processFlowNodeMeta(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  phone: string,
  metaCreds: { access_token: string; phone_number_id: string },
  supabase: any,
  visited: Set<string>,
  userId: string,
  flowName: string,
  options?: {
    resumeCaptured?: Record<string, string>;
    flowId?: string;
  }
) {
  const currentNode = nodes.find(n => n.id === nodeId)

  const sortEdgesByCanvasPosition = (list: FlowEdge[]) => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    return [...list].sort((a, b) => {
      const ay = nodeMap.get(a.target)?.position?.y ?? 0
      const by = nodeMap.get(b.target)?.position?.y ?? 0
      if (ay !== by) return ay - by
      return (nodeMap.get(a.target)?.position?.x ?? 0) - (nodeMap.get(b.target)?.position?.x ?? 0)
    })
  }

  const isDefaultHandle = (handle: string | undefined | null) => {
    if (!handle) return true
    if (handle === 'default') return true
    if (handle.startsWith('source-') || handle.startsWith('target-')) return true
    if (['right', 'bottom', 'left', 'top', 'a', 'b'].includes(handle)) return true
    return false
  }

  const defaultOutgoing = edges.filter(
    e => e.source === nodeId && !e.sourceHandle?.startsWith('button-') && isDefaultHandle(e.sourceHandle)
  )

  const outgoing =
    defaultOutgoing.length > 0
      ? sortEdgesByCanvasPosition(defaultOutgoing)
      : currentNode?.type === 'blocoCondicao'
      ? sortEdgesByCanvasPosition(edges.filter(e => e.source === nodeId))
      : []

  console.log(`[webhook-meta] processFlowNode(${nodeId}): ${outgoing.length} outgoing edges`)

  for (const edge of outgoing) {
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!targetNode) continue

    if (targetNode.type === 'blocoConteudo' || targetNode.type === 'blocoAcao') {
      const isActionDelay = targetNode.type === 'blocoAcao' && targetNode.data.actionType === 'delay'
      
      if (isActionDelay) {
        const seconds = Number(targetNode.data.delaySeconds ?? targetNode.data.actionConfig ?? 0) || 0
        if (seconds > 0) {
          const safeSeconds = Math.min(seconds, 50)
          console.log(`[webhook-meta] Aplicando delay de ${safeSeconds}s para o nó ${targetNode.id}`)
          await new Promise((resolve) => setTimeout(resolve, safeSeconds * 1000))
        }
      }

      if (targetNode.type === 'blocoConteudo') {
      const shouldStop = await sendNodeContentMeta(targetNode, nodes, edges, phone, metaCreds, visited, supabase, userId, flowName)
      if (shouldStop) continue
      }
    }

    await processFlowNodeMeta(targetNode.id, nodes, edges, phone, metaCreds, supabase, visited, userId, flowName)
  }
}

// =================== FLOW MATCHING UTILITIES ===================

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

function findButtonEdgeMatch(
  flows: any[],
  normalizedMessage: string,
  rawMessage: string,
  buttonReplyTitle: string,
  buttonReplyId: string
): { flow: any; targetNodeId: string; buttonText: string; flowName: string } | null {
  const normalizedRaw = normalizeForMatch(rawMessage)
  const normalizedButtonTitle = buttonReplyTitle ? normalizeForMatch(buttonReplyTitle) : ''
  const normalizedReplyId = buttonReplyId ? normalizeForMatch(buttonReplyId) : ''

  if (normalizedReplyId.startsWith('node:')) {
    const directMatch = findButtonEdgeMatchByReplyId(flows, normalizedReplyId)
    if (directMatch) return directMatch
  }

  const candidates = new Set(
    [rawMessage, normalizedMessage, buttonReplyTitle, buttonReplyId]
      .filter(v => v && v.trim())
      .map(v => normalizeForMatch(v))
      .filter(Boolean)
  )

  console.log('[webhook-meta] Button reply candidates:', Array.from(candidates))

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

        // Match by button text or by button index ID
        const buttonIndexValues = [
          String(idx + 1),
          `button-${idx}`,
          `button_${idx}`,
          `btn-${idx + 1}`,
        ].map(v => normalizeForMatch(v)).filter(Boolean)

        const didMatch =
          normalizedRaw === normalizedBtn ||
          normalizedMessage === normalizedBtn ||
          normalizedButtonTitle === normalizedBtn ||
          candidates.has(normalizedBtn) ||
          buttonIndexValues.some(v => candidates.has(v))

        if (didMatch) {
          const handleId = `button-${idx}`
          const buttonEdge = edges.find((e: any) => e.source === node.id && e.sourceHandle === handleId)

          if (buttonEdge) {
            return { flow, targetNodeId: buttonEdge.target, buttonText: btnText, flowName: flow.name }
          }

          // Fallback: default edge
          const defaultEdge = edges.find((e: any) =>
            e.source === node.id && (!e.sourceHandle || e.sourceHandle === 'default' || e.sourceHandle === null)
          )
          if (defaultEdge) {
            return { flow, targetNodeId: defaultEdge.target, buttonText: btnText, flowName: flow.name }
          }
        }
      }
    }
  }

  return null
}

function buildMetaReplyButtons(
  nodeId: string,
  buttons: Array<{ text: string; type: string; value: string }>
): MetaReplyButton[] {
  return buttons
    .filter(b => b.type === 'reply' || b.type === 'flow')
    .slice(0, 3)
    .map((btn, idx) => ({
      id: `node:${nodeId}:button:${idx}`,
      title: (btn.text || `Botão ${idx + 1}`).slice(0, 20),
    }))
}

function findButtonEdgeMatchByReplyId(
  flows: any[],
  normalizedReplyId: string
): { flow: any; targetNodeId: string; buttonText: string; flowName: string } | null {
  const match = normalizedReplyId.match(/^node:([^:]+):button:(\d+)$/)
  if (!match) return null

  const [, nodeId, buttonIndexRaw] = match
  const buttonIndex = Number(buttonIndexRaw)
  if (!Number.isFinite(buttonIndex)) return null

  for (const flow of flows) {
    const nodes = Array.isArray(flow?.nodes) ? flow.nodes : []
    const edges = Array.isArray(flow?.edges) ? flow.edges : []
    const node = nodes.find((candidate: any) => candidate?.id === nodeId && candidate?.type === 'blocoConteudo')
    if (!node) continue

    const buttons = Array.isArray(node?.data?.buttons) ? node.data.buttons : []
    const button = buttons[buttonIndex]
    if (!button) return null

    const buttonEdge = edges.find((e: any) => e.source === nodeId && e.sourceHandle === `button-${buttonIndex}`)
    if (!buttonEdge) return null

    return {
      flow,
      targetNodeId: buttonEdge.target,
      buttonText: button.text || `Botão ${buttonIndex + 1}`,
      flowName: flow.name,
    }
  }

  return null
}

async function resolveMetaCredentialByPhoneNumber(
  supabase: any,
  phoneNumberId: string,
  cache: Map<string, MetaCredentialRow | null>
): Promise<MetaCredentialRow | null> {
  if (cache.has(phoneNumberId)) {
    return cache.get(phoneNumberId) ?? null
  }

  const { data: directMatch, error: directError } = await supabase
    .from('meta_credentials')
    .select('user_id, access_token, phone_number_id, waba_id, business_account_id')
    .eq('phone_number_id', phoneNumberId)
    .eq('app_id', WHATSAPP_META_APP_ID)
    .eq('connected', true)
    .maybeSingle()

  if (directError) {
    console.error('[webhook-meta] Error loading direct Meta credential:', directError)
  }

  if (directMatch?.access_token) {
    cache.set(phoneNumberId, directMatch)
    return directMatch
  }

  const { data: candidates, error: candidatesError } = await supabase
    .from('meta_credentials')
    .select('user_id, access_token, phone_number_id, waba_id, business_account_id')
    .eq('app_id', WHATSAPP_META_APP_ID)
    .eq('connected', true)
    .not('access_token', 'is', null)

  if (candidatesError) {
    console.error('[webhook-meta] Error loading Meta credential candidates:', candidatesError)
    cache.set(phoneNumberId, null)
    return null
  }

  const matches = await Promise.all(
    (candidates || []).map(async (candidate: MetaCredentialRow) => {
      if (!candidate.access_token) return null

      if (candidate.phone_number_id === phoneNumberId) {
        return candidate
      }

      try {
        const numbers = await listAccessiblePhoneNumbers(candidate, API_VERSION)
        return numbers.some((number) => number.id === phoneNumberId) ? candidate : null
      } catch (error) {
        console.warn('[webhook-meta] Failed to inspect accessible phone numbers for credential:', candidate.user_id, error)
        return null
      }
    })
  )

  const fallbackMatch = matches.find((c): c is MetaCredentialRow => Boolean(c)) ?? null

  if (fallbackMatch) {
    console.log('[webhook-meta] Resolved phone_number_id via accessible WABA lookup:', phoneNumberId, 'user:', fallbackMatch.user_id)
  }

  cache.set(phoneNumberId, fallbackMatch)
  return fallbackMatch
}

// =================== INLINE PHONE DISCOVERY ===================

async function safeMetaGet<T>(url: string, accessToken: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    const payload = await res.json().catch(() => null)
    if (!res.ok) return null
    return payload as T
  } catch { return null }
}

async function listAccessiblePhoneNumbers(
  creds: { access_token: string; waba_id?: string | null; business_account_id?: string | null; phone_number_id?: string | null },
  apiVersion: string
) {
  const wabaIds = new Set<string>()
  if (creds.waba_id) wabaIds.add(creds.waba_id)

  const collectFromBiz = async (bizId: string) => {
    for (const ep of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
      const r = await safeMetaGet<{ data?: { id: string }[] }>(`https://graph.facebook.com/${apiVersion}/${bizId}/${ep}?limit=250`, creds.access_token)
      for (const a of r?.data || []) { if (a?.id) wabaIds.add(a.id) }
    }
  }

  if (creds.business_account_id) await collectFromBiz(creds.business_account_id)

  const biz = await safeMetaGet<{ data?: { id: string }[] }>(`https://graph.facebook.com/${apiVersion}/me/businesses?fields=id&limit=250`, creds.access_token)
  for (const b of biz?.data || []) { if (b?.id) await collectFromBiz(b.id) }

  const numbers: { id: string; display_phone_number?: string }[] = []
  const seen = new Set<string>()

  for (const wId of wabaIds) {
    const r = await safeMetaGet<{ data?: { id: string; display_phone_number?: string }[] }>(
      `https://graph.facebook.com/${apiVersion}/${wId}/phone_numbers?fields=id,display_phone_number&limit=250`, creds.access_token)
    for (const n of r?.data || []) { if (n?.id && !seen.has(n.id)) { seen.add(n.id); numbers.push(n) } }
  }

  return numbers
}
