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

const normalizeParticipantIdentifier = (value: unknown) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.includes('@lid')) return raw
  if (raw.includes('@c.us')) return raw.replace('@c.us', '').replace(/\D/g, '')
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 8 ? digits : raw
}

const extractParticipantArray = (payload: any) => {
  const candidates = [
    payload?.participants,
    payload?.members,
    payload?.groupParticipants,
    payload?.data?.participants,
    payload?.data?.members,
  ]

  return candidates.find(Array.isArray) || []
}

const resolveLidFromParticipants = (participants: any[], targetLid: string) => {
  for (const participant of participants || []) {
    const identifiers = [
      participant?.phone,
      participant?.id,
      participant?.participant,
      participant?.jid,
      participant?.lid,
      participant?.participantLid,
      participant?.user,
      participant?.waId,
      participant?.number,
    ].map((value) => String(value || '').trim()).filter(Boolean)

    const matchesTarget = identifiers.some((value) => value === targetLid)
    if (!matchesTarget) continue

    const resolved = identifiers
      .map((value) => normalizeParticipantIdentifier(value))
      .find((value) => value && !value.includes('@lid') && value.length >= 8)

    if (resolved) return resolved
  }

  return ''
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

    // === GROUP PARTICIPANT JOIN DETECTION ===
    // Z-API sends group join events in multiple formats:
    // 1. action/event: 'add'/'join'
    // 2. status: 'MEMBER_ADD'
    // 3. type: 'notification' with code 27 (added) or 32 (joined via link)
    const webhookAction = webhook?.action || webhook?.event || ''
    const webhookType = webhook?.type || ''
    const notificationCode = webhook?.code || webhook?.notification?.code || ''
    const notificationText = String(webhook?.notification || webhook?.notification?.text || '').toLowerCase()
    const notificationParams = webhook?.notificationParameters || webhook?.notification?.parameters || []
    const hasParticipantHint = Boolean(
      webhook?.participantPhone ||
      webhook?.participant ||
      webhook?.participantLid ||
      webhook?.groupParticipant?.phone ||
      (Array.isArray(notificationParams) && notificationParams.length > 0)
    )
    const isStatusCallback = webhookType === 'MessageStatusCallback' || Array.isArray(webhook?.ids)
    const noTextPayload = !webhook?.text?.message && !webhook?.message?.text && !webhook?.body && !webhook?.caption
    
    const isDirectJoinAction = 
      webhookAction === 'add' || 
      webhookAction === 'join' ||
      webhook?.status === 'MEMBER_ADD' ||
      webhook?.groupParticipant?.action === 'add' ||
      webhook?.participantAction === 'add'
    
    // Z-API notification format: code 27=added, 32=joined via invite link
    // The event type can be 'notification' OR 'ReceivedCallback' with notification/code fields
    const hasNotificationCode = ['27', '32'].includes(String(notificationCode))
    const hasJoinNotificationText = [
      'entrou',
      'joined',
      'added',
      'adicionado',
      'adicionou',
      'invite',
      'convite',
    ].some((term) => notificationText.includes(term))
    const hasLeaveNotificationText = [
      'leave',
      'left',
      'remove',
      'removed',
      'removeu',
      'saiu',
      'group_participant_leave',
    ].some((term) => notificationText.includes(term))
    const isNotificationJoin = 
      webhook?.isGroup === true &&
      !isStatusCallback &&
      noTextPayload &&
      !hasLeaveNotificationText &&
      (
        hasNotificationCode ||
        ((webhookType === 'notification' || webhookType === 'ReceivedCallback' || !!webhook?.notification) &&
          (hasParticipantHint || hasJoinNotificationText || webhook?.senderName === 'invite'))
      )

    const isParticipantEvent = isDirectJoinAction || isNotificationJoin

    if (isParticipantEvent) {
      console.log('👋 Group participant JOIN event detected:', JSON.stringify({
        type: webhookType,
        action: webhookAction,
        code: notificationCode,
        notification: webhook?.notification,
        notificationParameters: notificationParams,
        participantPhone: webhook?.participantPhone,
        participant: webhook?.participant,
        senderName: webhook?.senderName,
        phone: webhook?.phone,
        instanceId: webhook?.instanceId || webhook?.instance_id,
      }).substring(0, 800))
      
      const groupPhone = webhook?.phone || webhook?.chatPhone || webhook?.groupId || ''
      
      // For notification events, the joined phone is in notificationParameters or participantPhone
      let joinedPhone = normalizeParticipantIdentifier(
        webhook?.participantPhone || webhook?.participant || webhook?.senderPhone || webhook?.groupParticipant?.phone || ''
      )
      // notificationParameters typically contains the phone(s) of added participants
      if (!joinedPhone && Array.isArray(notificationParams) && notificationParams.length > 0) {
        joinedPhone = normalizeParticipantIdentifier(notificationParams[0])
      }
      
      const joinedName = webhook?.participantName || webhook?.senderName || webhook?.groupParticipant?.name || ''
      const eventInstanceId = webhook?.instanceId || webhook?.instance_id || ''

      if (groupPhone && joinedPhone && eventInstanceId) {
        // Find user by instanceId
        const { data: instData } = await supabase
          .from('zapi_instances')
          .select('user_id, zapi_instance_id, zapi_token, zapi_client_token')
          .eq('zapi_instance_id', eventInstanceId)
          .eq('is_active', true)
          .maybeSingle()

        if (instData) {
          // Normalize group ID
          let normalizedGroupId = groupPhone
          if (groupPhone.includes('@g.us')) {
            normalizedGroupId = groupPhone.replace('@g.us', '-group')
          } else if (!groupPhone.includes('-group')) {
            normalizedGroupId = groupPhone + '-group'
          }

          if (joinedPhone.includes('@lid')) {
            const lidIdentifier = joinedPhone

            const { data: existingMap } = await supabase
              .from('message_logs')
              .select('phone')
              .eq('user_id', instData.user_id)
              .eq('keyword_matched', '__lid_map__')
              .eq('message_received', lidIdentifier)
              .limit(1)
              .maybeSingle()

            if (existingMap?.phone) {
              joinedPhone = String(existingMap.phone).replace(/\D/g, '')
              console.log(`✅ Resolved join participant LID from cache: ${lidIdentifier} → ${joinedPhone}`)
            } else {
              try {
                const metadataHeaders = {
                  'Content-Type': 'application/json',
                  'Client-Token': instData.zapi_client_token,
                }

                const groupCandidates = [normalizedGroupId, normalizedGroupId.replace(/-group$/i, '@g.us')]
                for (const candidate of groupCandidates) {
                  const metadataResponse = await fetch(
                    `https://api.z-api.io/instances/${instData.zapi_instance_id}/token/${instData.zapi_token}/group-metadata/${candidate}`,
                    { method: 'GET', headers: metadataHeaders },
                  )

                  if (!metadataResponse.ok) {
                    console.log(`⚠️ Failed loading group metadata for ${candidate}:`, metadataResponse.status, await metadataResponse.text())
                    continue
                  }

                  const metadata = await metadataResponse.json()
                  const resolvedPhone = resolveLidFromParticipants(extractParticipantArray(metadata), lidIdentifier)
                  if (resolvedPhone) {
                    joinedPhone = resolvedPhone
                    console.log(`✅ Resolved join participant LID from group metadata: ${lidIdentifier} → ${joinedPhone}`)
                    break
                  }
                }
              } catch (resolveError) {
                console.error('❌ Error resolving join participant LID:', resolveError)
              }
            }
          }

          if (!joinedPhone || joinedPhone.includes('@lid') || joinedPhone.length < 8) {
            console.log('⚠️ Group join detected but participant phone could not be resolved:', JSON.stringify({
              joinedPhone,
              notificationParameters: notificationParams,
              participantPhone: webhook?.participantPhone,
              participant: webhook?.participant,
              groupId: normalizedGroupId,
            }))
            return new Response('group_participant_unresolved', { status: 200, headers: corsHeaders })
          }

          // Check if welcome message is configured for this group
          const { data: welcomeConfig } = await supabase
            .from('group_welcome_config')
            .select('*')
            .eq('user_id', instData.user_id)
            .eq('group_id', normalizedGroupId)
            .eq('active', true)
            .maybeSingle()

          if (welcomeConfig) {
            console.log('✅ Group welcome config found for group:', normalizedGroupId, 'type:', welcomeConfig.response_type)
            const responseType = welcomeConfig.response_type || 'text'
            const baseUrl = `https://api.z-api.io/instances/${instData.zapi_instance_id}/token/${instData.zapi_token}`
            const headers = { 'Content-Type': 'application/json', 'Client-Token': instData.zapi_client_token }

            if (responseType === 'flow' && welcomeConfig.flow_id) {
              // Trigger the flow for this contact by invoking webhook-zapi recursively with a virtual message
              const { data: flowData } = await supabase
                .from('flow_automations')
                .select('keyword')
                .eq('id', welcomeConfig.flow_id)
                .eq('user_id', instData.user_id)
                .eq('active', true)
                .maybeSingle()

              if (flowData?.keyword) {
                // Send a virtual trigger to webhook-zapi itself
                const selfUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/webhook-zapi'
                await fetch(selfUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    phone: joinedPhone,
                    message: { text: flowData.keyword, fromMe: false },
                    instanceId: instData.zapi_instance_id,
                    senderName: joinedName,
                    __manual_flow_trigger__: true,
                  }),
                })
                console.log('🔄 Flow triggered for group welcome:', flowData.keyword, '→', joinedPhone)
              }

              await supabase.from('message_logs').insert({
                phone: joinedPhone,
                message_received: null,
                response_sent: `[fluxo:${welcomeConfig.flow_id}]`,
                keyword_matched: '__group_welcome__',
                timestamp: new Date().toISOString(),
                user_id: instData.user_id,
                instance_id: instData.zapi_instance_id,
              })

            } else if (responseType === 'template' && welcomeConfig.template_id) {
              // Load template and send its content
              const { data: tpl } = await supabase
                .from('message_templates')
                .select('content, media_url, type, buttons, header, footer')
                .eq('id', welcomeConfig.template_id)
                .maybeSingle()

              if (tpl) {
                let tplMessage = (tpl.content || '')
                  .replace(/\{\{nome\}\}/gi, joinedName || 'novo membro')
                  .replace(/\{\{telefone\}\}/gi, joinedPhone)
                  .replace(/\{\{grupo\}\}/gi, welcomeConfig.group_name || 'grupo')

                if (tpl.media_url && (tpl.type === 'imagem' || tpl.type === 'image')) {
                  const sendResponse = await fetch(`${baseUrl}/send-image`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone: joinedPhone, image: tpl.media_url, caption: tplMessage }),
                  })
                  console.log('📤 Welcome template image status:', sendResponse.status, await sendResponse.text())
                } else if (tpl.media_url && (tpl.type === 'video' || tpl.type === 'vídeo')) {
                  const sendResponse = await fetch(`${baseUrl}/send-video`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone: joinedPhone, video: tpl.media_url, caption: tplMessage }),
                  })
                  console.log('📤 Welcome template video status:', sendResponse.status, await sendResponse.text())
                } else if (tpl.media_url && (tpl.type === 'audio' || tpl.type === 'áudio')) {
                  const audioResponse = await fetch(`${baseUrl}/send-audio`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone: joinedPhone, audio: tpl.media_url }),
                  })
                  console.log('📤 Welcome template audio status:', audioResponse.status, await audioResponse.text())
                  if (tplMessage) {
                    const textResponse = await fetch(`${baseUrl}/send-text`, {
                      method: 'POST', headers,
                      body: JSON.stringify({ phone: joinedPhone, message: tplMessage }),
                    })
                    console.log('📤 Welcome template text-after-audio status:', textResponse.status, await textResponse.text())
                  }
                } else {
                  const textResponse = await fetch(`${baseUrl}/send-text`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone: joinedPhone, message: tplMessage }),
                  })
                  console.log('📤 Welcome template text status:', textResponse.status, await textResponse.text())
                }

                // Send buttons if present
                const buttons = tpl.buttons as any[]
                if (buttons && buttons.length > 0) {
                  for (const btn of buttons) {
                    const btnUrl = btn.url || btn.value || ''
                    const btnLabel = btn.label || btn.text || 'Acessar'
                    const btnType = btn.type || (btnUrl ? 'url' : 'reply')

                    if (btnType === 'url' && btnUrl) {
                      const buttonResponse = await fetch(`${baseUrl}/send-link`, {
                        method: 'POST', headers,
                        body: JSON.stringify({
                          phone: joinedPhone,
                          message: btnLabel,
                          image: '',
                          linkUrl: btnUrl,
                          title: btnLabel,
                          linkDescription: '',
                        }),
                      })
                      console.log('📤 Welcome URL button status:', buttonResponse.status, await buttonResponse.text())
                    } else if (btnType === 'reply' && btnLabel) {
                      // Reply buttons are informational only in welcome context, skip empty values
                    }
                  }
                }

                console.log('📋 Template welcome sent to', joinedPhone)
              }

              await supabase.from('message_logs').insert({
                phone: joinedPhone,
                message_received: null,
                response_sent: `[modelo:${welcomeConfig.template_id}]`,
                keyword_matched: '__group_welcome__',
                timestamp: new Date().toISOString(),
                user_id: instData.user_id,
                instance_id: instData.zapi_instance_id,
              })

            } else {
              // Default: plain text message
              let finalMessage = welcomeConfig.message
                .replace(/\{\{nome\}\}/gi, joinedName || 'novo membro')
                .replace(/\{\{telefone\}\}/gi, joinedPhone)
                .replace(/\{\{grupo\}\}/gi, welcomeConfig.group_name || 'grupo')

              const textResponse = await fetch(`${baseUrl}/send-text`, {
                method: 'POST', headers,
                body: JSON.stringify({ phone: joinedPhone, message: finalMessage }),
              })
              console.log('📤 Welcome text status:', textResponse.status, await textResponse.text())

              console.log('📨 Text welcome sent to', joinedPhone)

              await supabase.from('message_logs').insert({
                phone: joinedPhone,
                message_received: null,
                response_sent: finalMessage,
                keyword_matched: '__group_welcome__',
                timestamp: new Date().toISOString(),
                user_id: instData.user_id,
                instance_id: instData.zapi_instance_id,
              })
            }
          }
        }
      } else {
        console.log('⚠️ Group join ignored after detection due to missing data:', JSON.stringify({
          groupPhone,
          joinedPhone,
          eventInstanceId,
          notificationParameters: notificationParams,
          participantPhone: webhook?.participantPhone,
          participant: webhook?.participant,
        }))
      }

      return new Response('group_participant_event_handled', { status: 200, headers: corsHeaders })
    }

    // Detect outgoing messages sent by this same WhatsApp instance
    const fromMe = webhook?.message?.fromMe ?? webhook?.fromMe ?? false

    const messageRaw = extractMessageText(webhook)
    const messageText = messageRaw.toLowerCase()
    const normalizedMessage = normalizeForMatch(messageRaw)

    if (!messageRaw) {
      console.log('Evento sem texto detectado, ignorando. Chaves:', Object.keys(webhook || {}))
      // Log full payload for button-response debugging
      const webhookType = webhook?.type || ''
      if (webhookType) {
        console.log('Webhook type:', webhookType, '| Full payload:', JSON.stringify(webhook).substring(0, 500))
      }
      return new Response('ignored_no_text', { status: 200, headers: corsHeaders })
    }

    // Extract phone — handle groups vs private chats differently
    let phone = ''
    const rawPhone = webhook?.phone || ''
    const participantPhone = webhook?.participantPhone || ''
    const senderPhone = webhook?.senderPhone || ''
    const chatPhone = webhook?.chatPhone || ''
    const chatLid = webhook?.chatLid || ''
    const senderName = webhook?.senderName || ''
    const chatName = webhook?.chatName || ''
    const isGroupMessage = webhook?.isGroup === true

    // Log ALL phone-related fields when @lid is detected for debugging
    if (rawPhone.includes('@lid') || chatLid) {
      console.log('🔍 LID DETECTED — All phone fields:', JSON.stringify({
        phone: rawPhone,
        participantPhone,
        senderPhone,
        chatPhone,
        chatLid,
        senderName,
        chatName,
        isGroup: isGroupMessage,
        allKeys: Object.keys(webhook || {}),
      }))
    }

    if (isGroupMessage) {
      // For group messages: use the group ID (rawPhone typically has @g.us format)
      // Convert @g.us to -group format for consistency with existing data
      if (rawPhone.includes('@g.us')) {
        phone = rawPhone.replace('@g.us', '-group')
      } else if (rawPhone.includes('-group')) {
        phone = rawPhone
      } else {
        phone = rawPhone ? rawPhone + '-group' : ''
      }
      console.log('👥 Group message from:', senderName || senderPhone || participantPhone, '| Group:', phone)
    } else {
      // For private messages: prefer clean number over @lid format
      if (senderPhone && !senderPhone.includes('@lid')) {
        phone = senderPhone
      } else if (participantPhone && !participantPhone.includes('@lid')) {
        phone = participantPhone
      } else if (chatPhone && !chatPhone.includes('@lid')) {
        phone = chatPhone
      } else if (rawPhone && !rawPhone.includes('@lid')) {
        phone = rawPhone
      } else {
        // Fallback: use @lid if nothing else available
        phone = rawPhone || participantPhone || chatLid || ''
        if (phone.includes('@lid')) {
          console.log('⚠️ Using @lid phone as fallback — no clean number found:', phone)
        }
      }
    }

    let instanceId = webhook?.instanceId || webhook?.instance_id
    const isManualFlowTrigger = webhook?.__manual_flow_trigger__ === true
    
    console.log('Processando mensagem:', messageText, 'do telefone:', phone)

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

    // Manual flow trigger safeguard:
    // Always use the instance of the latest inbound message from this contact.
    if (isManualFlowTrigger && userId && phone) {
      const { data: inboundCandidates } = await supabase
        .from('message_logs')
        .select('instance_id, created_at, keyword_matched, message_received')
        .eq('user_id', userId)
        .eq('phone', phone)
        .not('instance_id', 'is', null)
        .not('message_received', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20)

      const lastInbound = (inboundCandidates || []).find((row: any) => {
        const keyword = row?.keyword_matched || ''
        return keyword !== '__processing__' && keyword !== '__lid_map__'
      })

      if (lastInbound?.instance_id && lastInbound.instance_id !== instanceId) {
        const { data: contactInstance } = await supabase
          .from('zapi_instances')
          .select('zapi_instance_id, zapi_token, zapi_client_token')
          .eq('user_id', userId)
          .eq('zapi_instance_id', lastInbound.instance_id)
          .eq('is_active', true)
          .maybeSingle()

        if (contactInstance) {
          console.log(`🔁 Manual trigger instance adjusted: ${instanceId} → ${contactInstance.zapi_instance_id}`)
          instanceId = contactInstance.zapi_instance_id
          zapiConfig = {
            zapi_instance_id: contactInstance.zapi_instance_id,
            zapi_token: contactInstance.zapi_token,
            zapi_client_token: contactInstance.zapi_client_token,
          }
        }
      }
    }

    if (!userId || !zapiConfig?.zapi_token || !zapiConfig?.zapi_client_token) {
      console.error('User has incomplete Z-API credentials')
      return new Response('incomplete_credentials', { status: 400, headers: corsHeaders })
    }

    // === LID ↔ PHONE MAPPING ===
    // When incoming message has clean phone + chatLid, store the mapping
    const webhookChatLid = webhook?.chatLid || ''
    if (!phone.includes('@lid') && webhookChatLid && webhookChatLid.includes('@lid')) {
      const { data: existingMap } = await supabase
        .from('message_logs')
        .select('id')
        .eq('keyword_matched', '__lid_map__')
        .eq('message_received', webhookChatLid)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (!existingMap) {
        console.log(`📌 Storing LID mapping: ${webhookChatLid} → ${phone}`)
        await supabase.from('message_logs').insert({
          phone,
          message_received: webhookChatLid,
          response_sent: null,
          keyword_matched: '__lid_map__',
          user_id: userId,
          instance_id: instanceId,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // When phone is @lid, try to resolve to clean phone
    if (phone.includes('@lid') && userId) {
      const lidToResolve = phone
      const { data: mapping } = await supabase
        .from('message_logs')
        .select('phone')
        .eq('keyword_matched', '__lid_map__')
        .eq('message_received', lidToResolve)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (mapping) {
        console.log(`✅ Resolved @lid: ${lidToResolve} → ${mapping.phone}`)
        phone = mapping.phone
      } else {
        console.log(`⚠️ No LID mapping found for ${lidToResolve}, using as-is`)
      }
    }

    if (fromMe) {
      const rawTimestamp = webhook?.momment ?? webhook?.messageTimestamp ?? webhook?.timestamp ?? webhook?.createdAt
      const numericTimestamp = Number(rawTimestamp)
      const outgoingTimestamp = Number.isFinite(numericTimestamp) && numericTimestamp > 0
        ? new Date(numericTimestamp < 1_000_000_000_000 ? numericTimestamp * 1000 : numericTimestamp).toISOString()
        : new Date().toISOString()

      const { error: outgoingLogError } = await supabase
        .from('message_logs')
        .insert({
          phone,
          message_received: null,
          response_sent: messageRaw,
          keyword_matched: '__manual_send__',
          timestamp: outgoingTimestamp,
          user_id: userId,
          instance_id: instanceId || zapiConfig.zapi_instance_id || null,
        })

      if (outgoingLogError) {
        console.error('Erro ao registrar mensagem enviada no histórico:', outgoingLogError)
      }

      return new Response('outgoing_logged', { status: 200, headers: corsHeaders })
    }

    // Verifica se o sistema está ativo (filtra pelo user_id correto)
    const { data: config } = await supabase
      .from('auto_response_config')
      .select('active')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (config && !config.active) {
      console.log('Sistema desativado para o usuário:', userId)
      return new Response('system_disabled', { status: 200, headers: corsHeaders })
    }

    // Dedupe idempotente: cria um lock por usuário+telefone+mensagem em janela de 15s
    const lockResult = await acquireMessageProcessingLock(supabase, {
      userId,
      phone,
      normalizedMessage,
      rawMessage: messageRaw,
      instanceId,
    })

    if (!lockResult.acquired) {
      console.log('Mensagem duplicada detectada, ignorando para manter ordem do fluxo')
      return new Response('ignored_duplicate', { status: 200, headers: corsHeaders })
    }

    processingLockId = lockResult.lockId
    const lockId = lockResult.lockId

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
          const shouldStop = await sendNodeContent(targetNode, flowNodes, flowEdges, phone, zapiConfig, visited, supabase, userId, flow.name)
          // Only continue processing children if the node doesn't have button branching
          if (!shouldStop) {
            await processFlowNode(targetNode.id, flowNodes, flowEdges, phone, zapiConfig, supabase, visited, userId, flow.name)
          } else {
            console.log('Fluxo pausado no nó alvo - aguardando próximo clique de botão')
          }
        }

        await finalizeMessageLog(supabase, lockId, {
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
            new Set<string>(),
            userId,
            matchedFlow.name
          )
          
          // Log the interaction
          await finalizeMessageLog(supabase, lockId, {
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
      await releaseMessageProcessingLock(supabase, lockId)
      return new Response('responses_error', { status: 500, headers: corsHeaders })
    }

    const matchedResponse = responses?.find(response => 
      messageText.includes(response.keyword.toLowerCase())
    )

    if (matchedResponse) {
      console.log('Palavra-chave encontrada:', matchedResponse.keyword)
      
      await finalizeMessageLog(supabase, lockId, {
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

    // === FALLBACK: AI AGENT ===
    const { data: agentConfig } = await supabase
      .from('agent_config')
      .select('active, agent_name, system_prompt')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle()

    if (agentConfig) {
      console.log('🤖 Agente IA ativo, gerando resposta...')

      try {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
        if (!LOVABLE_API_KEY) {
          console.error('LOVABLE_API_KEY não configurada para agente IA')
        } else {
          // Fetch knowledge base
          const { data: knowledge } = await supabase
            .from('agent_knowledge')
            .select('type, question, answer, content, title')
            .eq('user_id', userId)
            .eq('active', true)

          let systemPrompt = agentConfig.system_prompt || 'Você é um assistente virtual prestativo.'
          systemPrompt += '\n\n--- REGRAS ---'
          systemPrompt += '\n- Responda sempre de forma educada e objetiva.'
          systemPrompt += '\n- Use a base de conhecimento abaixo para responder.'
          systemPrompt += '\n- Se não souber a resposta, diga que vai encaminhar para um atendente humano.'
          systemPrompt += `\n- Nome do agente: ${agentConfig.agent_name || 'Assistente'}`
          systemPrompt += '\n- Responda de forma curta e direta, como em uma conversa de WhatsApp.'

          if (knowledge && knowledge.length > 0) {
            systemPrompt += '\n\n--- BASE DE CONHECIMENTO ---'
            for (const item of knowledge) {
              if (item.type === 'faq') {
                systemPrompt += `\n\nPergunta: ${item.question}\nResposta: ${item.answer}`
              } else if (item.type === 'document') {
                systemPrompt += `\n\nDocumento "${item.title || 'Sem título'}":\n${item.content}`
              }
            }
          }

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: messageRaw },
              ],
              stream: false,
            }),
          })

          if (aiResponse.ok) {
            const aiData = await aiResponse.json()
            const aiReply = aiData.choices?.[0]?.message?.content || ''

            if (aiReply) {
              // Send AI reply via Z-API
              const zapiAiResponse = await fetch(
                `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/send-text`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Client-Token': zapiConfig.zapi_client_token,
                  },
                  body: JSON.stringify({ phone, message: aiReply }),
                }
              )

              const zapiAiResult = await zapiAiResponse.text()
              console.log('🤖 Resposta IA enviada:', zapiAiResponse.status, zapiAiResult.substring(0, 200))

              await finalizeMessageLog(supabase, lockId, {
                keywordMatched: '[Agente IA]',
                responseSent: aiReply,
              })

              return new Response('ai_agent_response_sent', { status: 200, headers: corsHeaders })
            }
          } else {
            const errText = await aiResponse.text()
            console.error('Erro AI Gateway:', aiResponse.status, errText.substring(0, 300))
          }
        }
      } catch (aiError) {
        console.error('Erro ao processar agente IA:', aiError)
      }
    }

    await releaseMessageProcessingLock(supabase, lockId)
    console.log('Nenhuma palavra-chave correspondente encontrada e agente IA não disponível')
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
  visited: Set<string>,
  supabase?: any,
  userId?: string | null,
  flowName?: string
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
    // Log the sent message to message_logs for chat history
    if (supabase && userId) {
      try {
        const buttonLabels = allSendButtons.map(b => b.text).filter(Boolean).join(' | ')
        let logContent = content || ''
        
        // Add media tag for proper rendering in chat
        if (mediaUrl && contentType && contentType !== 'text') {
          const mediaTag = `[media:${contentType}:${mediaUrl}]`
          logContent = logContent ? `${mediaTag}\n${logContent}` : mediaTag
        }
        
        if (buttonLabels) {
          logContent = logContent ? `${logContent}\n\n[Botões: ${buttonLabels}]` : `[Botões: ${buttonLabels}]`
        }
        
        if (logContent) {
          await supabase.from('message_logs').insert({
            phone,
            message_received: null,
            response_sent: logContent,
            keyword_matched: `__flow_send__${flowName ? `:${flowName}` : ''}`,
            timestamp: new Date().toISOString(),
            user_id: userId,
            instance_id: zapiConfig?.zapi_instance_id || null,
          })
        }
      } catch (logErr) {
        console.error('Erro ao logar mensagem do fluxo:', logErr)
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
  visited: Set<string>,
  userId?: string | null,
  flowName?: string
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

  // Default path: any handle that is NOT a button-specific handle
  const isDefaultHandle = (handle: string | undefined | null) => {
    if (!handle) return true
    if (handle === 'default') return true
    // Handles from the visual editor (source-right, source-bottom, etc.)
    if (handle.startsWith('source-') || handle.startsWith('target-')) return true
    // Legacy handles (right, bottom, left, top, a, b)
    if (['right', 'bottom', 'left', 'top', 'a', 'b'].includes(handle)) return true
    return false
  }

  const defaultOutgoing = edges.filter(
    e => e.source === nodeId && !e.sourceHandle?.startsWith('button-') && isDefaultHandle(e.sourceHandle)
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
      const shouldStop = await sendNodeContent(targetNode, nodes, edges, phone, zapiConfig, visited, supabase, userId, flowName)
      if (shouldStop) continue
    }

    await processFlowNode(targetNode.id, nodes, edges, phone, zapiConfig, supabase, visited, userId, flowName)
  }
}


async function acquireMessageProcessingLock(
  supabase: any,
  params: { userId: string; phone: string; normalizedMessage: string; rawMessage: string; instanceId?: string }
): Promise<{ acquired: boolean; lockId: string }> {
  const { userId, phone, normalizedMessage, rawMessage, instanceId } = params
  const norm = normalizedMessage || normalizeForMatch(rawMessage)
  const now = Date.now()
  const bucketSize = 15000
  const currentBucket = Math.floor(now / bucketSize)
  const prevBucket = currentBucket - 1

  // Check both current and previous bucket to avoid boundary race conditions
  const currentKey = `${userId}|${phone}|${norm}|${currentBucket}`
  const prevKey = `${userId}|${phone}|${norm}|${prevBucket}`
  const lockId = await stableUuidFromText(currentKey)
  const prevLockId = await stableUuidFromText(prevKey)

  // First check if previous bucket lock exists (means message was just processed)
  const { data: prevLock } = await supabase
    .from('message_logs')
    .select('id')
    .eq('id', prevLockId)
    .maybeSingle()

  if (prevLock) {
    console.log('Lock do bucket anterior encontrado, mensagem duplicada')
    return { acquired: false, lockId }
  }

  // Try to acquire current bucket lock
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
      instance_id: instanceId || null,
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
  // Instead of deleting, finalize the log so the received message appears in chat
  await supabase
    .from('message_logs')
    .update({
      keyword_matched: null,
      response_sent: null,
      timestamp: new Date().toISOString(),
    })
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

    // send-button-actions response formats (Z-API)
    webhook?.title,
    webhook?.selectedButtonId,
    webhook?.response?.title,
    webhook?.response?.text,
    webhook?.response?.selectedDisplayText,
    webhook?.message?.interactiveResponseMessage?.body?.text,
    webhook?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson,
    webhook?.interactiveResponseMessage?.body?.text,
    webhook?.message?.templateButtonReplyMessage?.selectedDisplayText,
    webhook?.message?.templateButtonReplyMessage?.selectedId,
    webhook?.templateButtonReplyMessage?.selectedDisplayText,
    webhook?.templateButtonReplyMessage?.selectedId,
    webhook?.message?.listResponseMessage?.title,
    webhook?.message?.listResponseMessage?.singleSelectReply?.selectedRowId,

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
