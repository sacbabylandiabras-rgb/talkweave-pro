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
    collectName?: boolean
    collectWhatsapp?: boolean
    collectEmail?: boolean
    namePrompt?: string
    whatsappPrompt?: string
    emailPrompt?: string
    nameFollowUp?: string
    whatsappFollowUp?: string
    emailFollowUp?: string
  }
}

interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
}

interface PendingCaptureState {
  flowId?: string
  flowName?: string
  nodeId: string
  field: 'name' | 'whatsapp' | 'email'
  instanceId?: string | null
  captured?: {
    nome?: string
    whatsapp?: string
    email?: string
  }
}

const FLOW_CAPTURE_PREFIX = '__flow_capture__:'

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

const normalizePhoneCandidate = (value: unknown) => {
  return String(value || '')
    .replace('@c.us', '')
    .replace('@s.whatsapp.net', '')
    .replace(/\D/g, '')
}

const normalizeGroupCampaignPhone = (value: unknown) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.includes('-group@g.us')) return raw.replace(/-group@g\.us$/i, '@g.us')
  if (raw.endsWith('-group')) return raw.replace(/-group$/i, '@g.us')
  return raw
}

const normalizeInstanceIdentifier = (value: unknown) => {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

const resolveWebhookInstanceReference = (webhook: any) => {
  const raw = webhook?.instanceId || webhook?.instance_id || webhook?.instanceName || webhook?.instance_name || ''
  return {
    raw,
    normalized: normalizeInstanceIdentifier(raw),
  }
}

const isLikelyTechnicalIdentifier = (value: unknown) => {
  const raw = String(value || '').trim()
  const digits = normalizePhoneCandidate(raw)
  return !raw.includes('@') && /^\d{14,16}$/.test(digits) && !digits.startsWith('55')
}

const resolveWebhookPhone = (webhook: any) => {
  const rawPhone = String(webhook?.phone || '')
  const participantPhone = String(webhook?.participantPhone || '')
  const senderPhone = String(webhook?.senderPhone || '')
  const chatPhone = String(webhook?.chatPhone || '')
  const chatLid = String(webhook?.chatLid || '')
  const isGroupMessage = webhook?.isGroup === true

  if (isGroupMessage) {
    return normalizeGroupCampaignPhone(rawPhone)
  }

  if (senderPhone && !senderPhone.includes('@lid')) return senderPhone
  if (participantPhone && !participantPhone.includes('@lid')) return participantPhone
  if (chatPhone && !chatPhone.includes('@lid')) return chatPhone
  if (chatLid && chatLid.includes('@lid') && isLikelyTechnicalIdentifier(rawPhone)) return chatLid
  if (rawPhone && !rawPhone.includes('@lid')) return rawPhone

  return rawPhone || participantPhone || chatLid || ''
}

const parseBooleanLike = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }
  return null
}

const resolveFromMe = (webhook: any): boolean => {
  const candidates = [
    webhook?.message?.fromMe,
    webhook?.fromMe,
    webhook?.data?.fromMe,
    webhook?.data?.message?.fromMe,
    webhook?.waitingMessage?.fromMe,
    webhook?.message?.key?.fromMe,
    webhook?.data?.message?.key?.fromMe,
    webhook?.key?.fromMe,
    webhook?.isFromMe,
    webhook?.data?.isFromMe,
  ]

  for (const candidate of candidates) {
    const parsed = parseBooleanLike(candidate)
    if (parsed !== null) return parsed
  }

  const connectedPhone = normalizePhoneCandidate(webhook?.connectedPhone)
  const senderPhone = normalizePhoneCandidate(webhook?.senderPhone)
  const participantPhone = normalizePhoneCandidate(webhook?.participantPhone)

  if (connectedPhone) {
    if (senderPhone && senderPhone === connectedPhone) return true
    if (participantPhone && participantPhone === connectedPhone) return true
  }

  return false
}

const mapCampaignSendStatusFromWebhook = (webhook: any): 'sent' | 'delivered' | null => {
  const webhookType = String(webhook?.type || '')
  const webhookStatus = String(webhook?.status || '').toUpperCase()
  const fromMe = resolveFromMe(webhook)

  if (webhookType === 'DeliveryCallback') return 'delivered'
  if (webhookType === 'MessageStatusCallback') {
    if (webhookStatus === 'SENT') return 'sent'
    if (webhookStatus === 'RECEIVED' || webhookStatus === 'DELIVERED') return 'delivered'
  }
  // For ReceivedCallback with fromMe: treat as delivery confirmation
  // For groups, fromMe callbacks WITH text are the normal delivery pattern
  // For contacts, only treat as status update if no text content (pure status callback)
  if (webhookType === 'ReceivedCallback' && fromMe) {
    const phone = resolveWebhookPhone(webhook)
    const isGroup = phone?.includes('@g.us') || phone?.includes('-group')
    
    if (isGroup) {
      // Group fromMe callbacks (with or without text) = delivery confirmation
      return 'delivered'
    }
    
    const hasTextContent = Boolean(
      webhook?.text?.message || webhook?.text || webhook?.body ||
      webhook?.message?.text || webhook?.message?.conversation ||
      webhook?.message?.extendedTextMessage?.text
    )
    if (!hasTextContent) {
      if (webhookStatus === 'SENT') return 'sent'
      if (webhookStatus === 'RECEIVED' || webhookStatus === 'DELIVERED') return 'delivered'
    }
  }

  return null
}

const isAdminParticipant = (participant: any) => {
  const adminRole = String(participant?.admin || participant?.role || '').toLowerCase()
  return Boolean(
    participant?.isAdmin ||
    participant?.isSuperAdmin ||
    participant?.isSuperadmin ||
    adminRole === 'admin' ||
    adminRole === 'superadmin' ||
    adminRole === 'super_admin'
  )
}

const inferCountryCode = (value: unknown) => {
  const digits = normalizePhoneCandidate(value)
  if (digits.length >= 12) {
    return digits.slice(0, digits.length - 11)
  }
  return ''
}

const expandPhoneCandidates = (values: unknown[], referencePhone?: unknown) => {
  const countryCode = inferCountryCode(referencePhone)
  const unique = new Set<string>()
  const expanded: string[] = []

  for (const value of values) {
    const digits = normalizePhoneCandidate(value)
    if (digits.length < 8) continue

    const variants = [digits]
    if (countryCode && digits.length >= 10 && digits.length <= 11 && !digits.startsWith(countryCode)) {
      variants.unshift(`${countryCode}${digits}`)
    }

    for (const variant of variants) {
      if (variant.length < 10 || variant.length > 15 || unique.has(variant)) continue
      unique.add(variant)
      expanded.push(variant)
    }
  }

  return expanded
}

const resolveCreateGroupPhones = async (baseUrl: string, headers: Record<string, string>, phones: string[]) => {
  const uniquePhones = Array.from(new Set(phones.filter((phone) => phone.length >= 10 && phone.length <= 15)))
  if (uniquePhones.length === 0) return []

  try {
    const response = await fetch(`${baseUrl}/phone-exists-batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phones: uniquePhones }),
    })

    const raw = await response.text()
    const data = JSON.parse(raw)
    const normalized = (Array.isArray(data) ? data : [])
      .filter((item: any) => item?.exists)
      .map((item: any) => normalizePhoneCandidate(item?.outputPhone || item?.inputPhone || ''))
      .filter((phone: string) => phone.length >= 10 && phone.length <= 15)

    return Array.from(new Set(normalized))
  } catch (error) {
    console.error('❌ Failed to validate auto-create phones:', error)
    return uniquePhones
  }
}

const TEMP_PARTICIPANT_PHONE = '5518981939571'

const WHATSAPP_VERIFY_TOKEN = "zaplynx_whatsapp_verify_2024";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Meta webhook verification (GET request)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("📋 WhatsApp webhook verification:", { mode, token, challenge });

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("✅ WhatsApp webhook verified");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    console.error("❌ WhatsApp webhook verification failed");
    return new Response("Forbidden", { status: 403 });
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

    // === UAZAPI PAYLOAD NORMALIZATION ===
    // UAZAPI sends a different schema; normalize to Z-API-like shape so the
    // downstream engine works without changes.
    try {
      const reqUrl = new URL(req.url)
      const isUazapi = reqUrl.searchParams.get('provider') === 'uazapi'
        || webhook?.EventType !== undefined
        || webhook?.event !== undefined && webhook?.message?.sender !== undefined
      const uazInstanceId = reqUrl.searchParams.get('instanceId') || ''

      if (isUazapi) {
        const m = webhook?.message || webhook?.data || {}
        const eventType = String(webhook?.EventType || webhook?.event || '').toLowerCase()

        // Extract phone/chat
        const chatId = String(m?.chatid || m?.chatId || m?.remoteJid || m?.from || '')
        const isGroup = chatId.includes('@g.us') || m?.isGroup === true
        const phone = chatId.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@g.us', '').replace(/\D/g, '')
        const fromMe = Boolean(m?.fromMe || m?.fromme || m?.key?.fromMe)
        const text = m?.text || m?.message?.text || m?.body || m?.conversation
          || m?.message?.conversation || m?.message?.extendedTextMessage?.text || ''
        const senderName = m?.senderName || m?.pushName || m?.notifyName || m?.sender_name || ''
        const senderPhone = String(m?.sender || m?.participant || m?.author || phone).replace('@s.whatsapp.net','').replace('@c.us','').replace(/\D/g,'')

        // Map to Z-API ReceivedCallback shape
        const normalized: any = {
          ...webhook,
          phone,
          isGroup,
          fromMe,
          instanceId: uazInstanceId || webhook?.instanceId || '',
          senderName,
          senderPhone,
          chatName: m?.chatName || m?.groupName || senderName,
          messageId: m?.id || m?.messageId || m?.key?.id,
          type: 'ReceivedCallback',
          text: text ? { message: text } : undefined,
        }

        // Connection event normalization
        if (eventType.includes('connection')) {
          normalized.type = 'ConnectionStatusCallback'
          normalized.connected = webhook?.connected === true || webhook?.status === 'connected'
        }

        webhook = normalized
        console.log('🔄 UAZAPI payload normalized:', JSON.stringify({ phone, isGroup, fromMe, hasText: !!text, instanceId: normalized.instanceId }).substring(0, 300))
      }
    } catch (normErr) {
      console.error('UAZAPI normalization error:', normErr)
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
      const connectedPhone = String(webhook?.connectedPhone || '').replace(/\D/g, '')
      
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

      if (groupPhone && eventInstanceId) {
        // Find user by instanceId (normalized matching)
        const normalizedEventId = normalizeInstanceIdentifier(eventInstanceId)
        const { data: allActiveInstances } = await supabase
          .from('zapi_instances')
          .select('user_id, zapi_instance_id, zapi_token, zapi_client_token')
          .eq('is_active', true)

        const instData = (allActiveInstances || []).find((item: any) =>
          normalizeInstanceIdentifier(item?.zapi_instance_id) === normalizedEventId
        )

        if (instData) {
          // Normalize group ID
          let normalizedGroupId = groupPhone
          if (groupPhone.includes('@g.us')) {
            normalizedGroupId = groupPhone.replace('@g.us', '-group')
          } else if (!groupPhone.includes('-group')) {
            normalizedGroupId = groupPhone + '-group'
          }

          const metadataHeaders = {
            'Content-Type': 'application/json',
            'Client-Token': instData.zapi_client_token,
          }

          const fetchGroupMetadata = async () => {
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

              return await metadataResponse.json()
            }

            return null
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
                const metadata = await fetchGroupMetadata()
                if (metadata) {
                  const resolvedPhone = resolveLidFromParticipants(extractParticipantArray(metadata), lidIdentifier)
                  if (resolvedPhone) {
                    joinedPhone = resolvedPhone
                    console.log(`✅ Resolved join participant LID from group metadata: ${lidIdentifier} → ${joinedPhone}`)
                  }
                }
              } catch (resolveError) {
                console.error('❌ Error resolving join participant LID:', resolveError)
              }
            }
          }

          const canHandleParticipant = !!joinedPhone && !joinedPhone.includes('@lid') && joinedPhone.length >= 8

          if (!canHandleParticipant) {
            console.log('⚠️ Group join detected but participant phone could not be resolved:', JSON.stringify({
              joinedPhone,
              notificationParameters: notificationParams,
              participantPhone: webhook?.participantPhone,
              participant: webhook?.participant,
              groupId: normalizedGroupId,
            }))
          }

          if (canHandleParticipant) {
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

              // === DEDUPLICATION: Prevent duplicate welcome messages from multiple instances ===
              const dedupeWindow = new Date(Date.now() - 60 * 1000).toISOString()
              const { data: recentWelcome } = await supabase
              .from('message_logs')
              .select('id')
              .eq('user_id', instData.user_id)
              .eq('phone', joinedPhone)
              .eq('keyword_matched', '__group_welcome__')
              .gte('created_at', dedupeWindow)
              .limit(1)
              .maybeSingle()

              if (recentWelcome) {
                console.log('⚠️ Duplicate group welcome blocked for', joinedPhone, 'in group', normalizedGroupId, '(already sent in last 60s)')
                return new Response('group_welcome_deduplicated', { status: 200, headers: corsHeaders })
              }

              const responseType = welcomeConfig.response_type || 'text'

              // If a specific instance_id is configured, use that instance's credentials
              let sendInstData = instData
              if (welcomeConfig.instance_id) {
                const { data: overrideInst } = await supabase
                  .from('zapi_instances')
                  .select('zapi_instance_id, zapi_token, zapi_client_token')
                  .eq('user_id', instData.user_id)
                  .eq('id', welcomeConfig.instance_id)
                  .eq('is_active', true)
                  .maybeSingle()
                if (overrideInst) {
                  console.log('🔄 Using override instance for welcome:', welcomeConfig.instance_id)
                  sendInstData = { ...instData, ...overrideInst }
                } else {
                  console.log('⚠️ Override instance not found or inactive, using original')
                }
              }

              const baseUrl = `https://api.z-api.io/instances/${sendInstData.zapi_instance_id}/token/${sendInstData.zapi_token}`
              const headers = { 'Content-Type': 'application/json', 'Client-Token': sendInstData.zapi_client_token }

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

                const rawButtons = Array.isArray(tpl.buttons) ? tpl.buttons : []
                const formattedButtons = rawButtons
                  .map((btn: any) => {
                    const btnType = String(btn?.type || (btn?.url || btn?.value ? 'url' : 'reply')).toUpperCase()
                    const label = btn?.text || btn?.label || 'Acessar'

                    if (!label) return null

                    const buttonData: any = { label }

                    if (btnType === 'CALL') {
                      const phoneValue = btn?.phone || btn?.value || ''
                      if (!phoneValue) return null
                      buttonData.type = 'CALL'
                      buttonData.phone = phoneValue
                    } else if (btnType === 'REPLY' || btnType === 'OPTION') {
                      buttonData.type = 'REPLY'
                    } else if (btnType === 'COPY') {
                      const copyValue = btn?.copyText || btn?.value || ''
                      if (!copyValue) return null
                      buttonData.type = 'URL'
                      buttonData.url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(copyValue)}`
                    } else {
                      const urlValue = btn?.url || btn?.value || ''
                      if (!urlValue) return null
                      buttonData.type = 'URL'
                      buttonData.url = urlValue
                    }

                    if (btn?.id) {
                      buttonData.id = btn.id
                    }

                    return buttonData
                  })
                  .filter(Boolean)
                  .slice(0, 3)

                const canSendInteractiveButtons = formattedButtons.length > 0 && !(tpl.media_url && (tpl.type === 'video' || tpl.type === 'vídeo' || tpl.type === 'audio' || tpl.type === 'áudio'))

                // Build reply buttons and URL/CALL text suffix
                const replyBtns = formattedButtons.filter((b: any) => b.type === 'REPLY').slice(0, 3)
                const urlCallParts: string[] = []
                for (const b of formattedButtons) {
                  if (b.type === 'URL' && b.url) urlCallParts.push(`🔗 ${b.label}: ${b.url}`)
                  if (b.type === 'CALL' && b.phone) urlCallParts.push(`📞 ${b.label}: ${b.phone}`)
                }
                const urlCallSuffix = urlCallParts.length > 0 ? '\n\n' + urlCallParts.join('\n') : ''

                if (tpl.media_url && (tpl.type === 'imagem' || tpl.type === 'image') && canSendInteractiveButtons) {
                  // Send image first, then buttons
                  await fetch(`${baseUrl}/send-image`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone: joinedPhone, image: tpl.media_url, caption: '' }),
                  })
                  await new Promise(resolve => setTimeout(resolve, 1000))
                  if (replyBtns.length > 0) {
                    const buttonResponse = await fetch(`${baseUrl}/send-button-list`, {
                      method: 'POST', headers,
                      body: JSON.stringify({
                        phone: joinedPhone,
                        message: tplMessage + urlCallSuffix,
                        buttonList: { buttons: replyBtns.map((b: any) => ({ label: b.label })) },
                      }),
                    })
                    console.log('📤 Welcome template image+buttons status:', buttonResponse.status, await buttonResponse.text())
                  } else {
                    const buttonResponse = await fetch(`${baseUrl}/send-text`, {
                      method: 'POST', headers,
                      body: JSON.stringify({ phone: joinedPhone, message: tplMessage + urlCallSuffix }),
                    })
                    console.log('📤 Welcome template image+text-buttons status:', buttonResponse.status, await buttonResponse.text())
                  }
                } else if (!tpl.media_url && canSendInteractiveButtons) {
                  if (replyBtns.length > 0) {
                    const buttonResponse = await fetch(`${baseUrl}/send-button-list`, {
                      method: 'POST', headers,
                      body: JSON.stringify({
                        phone: joinedPhone,
                        message: tplMessage + urlCallSuffix,
                        buttonList: { buttons: replyBtns.map((b: any) => ({ label: b.label })) },
                      }),
                    })
                    console.log('📤 Welcome template text+buttons status:', buttonResponse.status, await buttonResponse.text())
                  } else {
                    const buttonResponse = await fetch(`${baseUrl}/send-text`, {
                      method: 'POST', headers,
                      body: JSON.stringify({ phone: joinedPhone, message: tplMessage + urlCallSuffix }),
                    })
                    console.log('📤 Welcome template text-only-buttons status:', buttonResponse.status, await buttonResponse.text())
                  }
                } else if (tpl.media_url && (tpl.type === 'imagem' || tpl.type === 'image')) {
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

                console.log('📋 Template welcome sent to', joinedPhone)
              }

              // Build a readable log of what was sent
              let logContent = tplMessage || '';
              if (tpl.media_url) {
                const mediaTag = `[media:${tpl.type === 'imagem' || tpl.type === 'imagem_botoes' ? 'image' : tpl.type === 'video' || tpl.type === 'video_botoes' ? 'video' : tpl.type === 'audio' || tpl.type === 'áudio' ? 'audio' : 'document'}:${tpl.media_url}]`;
                logContent = logContent ? `${mediaTag}\n${logContent}` : mediaTag;
              }
              if (rawButtons && rawButtons.length > 0) {
                const btnLabels = rawButtons.map((b: any) => b?.text || b?.label || '').filter(Boolean);
                if (btnLabels.length > 0) logContent += `\n[Botões: ${btnLabels.join(' | ')}]`;
              }

              await supabase.from('message_logs').insert({
                phone: joinedPhone,
                message_received: null,
                response_sent: logContent || `Modelo: ${tpl.name || welcomeConfig.template_id}`,
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

            // === LOG GROUP JOIN EVENT ===
            // Find redirect link for this group to associate the join
            let joinRedirectLinkId: string | null = null
            try {
              const { data: rlg } = await supabase
                .from('redirect_link_groups')
                .select('redirect_link_id, group_name')
                .eq('group_id', normalizedGroupId)
                .limit(1)
                .maybeSingle()
              if (rlg) joinRedirectLinkId = rlg.redirect_link_id
            } catch {}

            await supabase.from('message_logs').insert({
              phone: joinedPhone,
              message_received: normalizedGroupId,
              response_sent: joinedName || '',
              keyword_matched: '__group_join__',
              timestamp: new Date().toISOString(),
              user_id: instData.user_id,
              instance_id: instData.zapi_instance_id,
            })
            console.log(`📝 Logged group join: ${joinedPhone} → ${normalizedGroupId}`)

            // === REDIRECT LINK AUTOMATION ===
            // If no per-group welcome was sent, check if the redirect link has automation
            try {
              const { data: rlgData } = await supabase
                .from('redirect_link_groups')
                .select('redirect_link_id, group_name')
                .eq('group_id', normalizedGroupId)
                .limit(1)
                .maybeSingle()

              if (rlgData) {
                const { data: redirectLink } = await supabase
                  .from('redirect_links')
                  .select('*')
                  .eq('id', rlgData.redirect_link_id)
                  .eq('active', true)
                  .maybeSingle()

                if (redirectLink) {
                  const rlWelcomeType = redirectLink.welcome_type || 'none'
                  const groupName = rlgData.group_name || 'grupo'

                  // Check if per-group welcome already sent (dedup)
                  const dedupeWindow2 = new Date(Date.now() - 60 * 1000).toISOString()
                  const { data: alreadySent } = await supabase
                    .from('message_logs')
                    .select('id')
                    .eq('user_id', instData.user_id)
                    .eq('phone', joinedPhone)
                    .eq('keyword_matched', '__group_welcome__')
                    .gte('created_at', dedupeWindow2)
                    .limit(1)
                    .maybeSingle()

                  if (!alreadySent && rlWelcomeType !== 'none') {
                    console.log(`🔗 Redirect link automation: type=${rlWelcomeType} for ${joinedPhone}`)

                    // Resolve instance
                    let rlInstData = instData
                    if (redirectLink.welcome_instance_id) {
                      const { data: overrideInst } = await supabase
                        .from('zapi_instances')
                        .select('zapi_instance_id, zapi_token, zapi_client_token')
                        .eq('user_id', instData.user_id)
                        .eq('id', redirectLink.welcome_instance_id)
                        .eq('is_active', true)
                        .maybeSingle()
                      if (overrideInst) {
                        rlInstData = { ...instData, ...overrideInst }
                      }
                    }

                    const rlBaseUrl = `https://api.z-api.io/instances/${rlInstData.zapi_instance_id}/token/${rlInstData.zapi_token}`
                    const rlHeaders = { 'Content-Type': 'application/json', 'Client-Token': rlInstData.zapi_client_token }

                    if (rlWelcomeType === 'text' && redirectLink.welcome_message) {
                      const msg = (redirectLink.welcome_message || '')
                        .replace(/\{\{nome\}\}/gi, joinedName || 'novo membro')
                        .replace(/\{\{telefone\}\}/gi, joinedPhone)
                        .replace(/\{\{grupo\}\}/gi, groupName)

                      await fetch(`${rlBaseUrl}/send-text`, {
                        method: 'POST', headers: rlHeaders,
                        body: JSON.stringify({ phone: joinedPhone, message: msg }),
                      })
                      console.log(`📤 Redirect link welcome text sent to ${joinedPhone}`)

                      await supabase.from('message_logs').insert({
                        phone: joinedPhone, message_received: null, response_sent: msg,
                        keyword_matched: '__group_welcome__', timestamp: new Date().toISOString(),
                        user_id: instData.user_id, instance_id: rlInstData.zapi_instance_id,
                      })
                    } else if (rlWelcomeType === 'template' && redirectLink.welcome_template_id) {
                      // Re-use webhook-zapi self-invocation pattern or send template inline
                      const { data: tpl } = await supabase
                        .from('message_templates')
                        .select('content, media_url, type, buttons, header, footer, name')
                        .eq('id', redirectLink.welcome_template_id)
                        .maybeSingle()

                      if (tpl) {
                        let tplMsg = (tpl.content || '')
                          .replace(/\{\{nome\}\}/gi, joinedName || 'novo membro')
                          .replace(/\{\{telefone\}\}/gi, joinedPhone)
                          .replace(/\{\{grupo\}\}/gi, groupName)

                        if (tpl.media_url && (tpl.type === 'imagem' || tpl.type === 'image')) {
                          await fetch(`${rlBaseUrl}/send-image`, {
                            method: 'POST', headers: rlHeaders,
                            body: JSON.stringify({ phone: joinedPhone, image: tpl.media_url, caption: tplMsg }),
                          })
                        } else if (tpl.media_url && (tpl.type === 'video' || tpl.type === 'vídeo')) {
                          await fetch(`${rlBaseUrl}/send-video`, {
                            method: 'POST', headers: rlHeaders,
                            body: JSON.stringify({ phone: joinedPhone, video: tpl.media_url, caption: tplMsg }),
                          })
                        } else if (tpl.media_url && (tpl.type === 'audio' || tpl.type === 'áudio')) {
                          await fetch(`${rlBaseUrl}/send-audio`, {
                            method: 'POST', headers: rlHeaders,
                            body: JSON.stringify({ phone: joinedPhone, audio: tpl.media_url }),
                          })
                          if (tplMsg) {
                            await fetch(`${rlBaseUrl}/send-text`, {
                              method: 'POST', headers: rlHeaders,
                              body: JSON.stringify({ phone: joinedPhone, message: tplMsg }),
                            })
                          }
                        } else {
                          await fetch(`${rlBaseUrl}/send-text`, {
                            method: 'POST', headers: rlHeaders,
                            body: JSON.stringify({ phone: joinedPhone, message: tplMsg }),
                          })
                        }

                        console.log(`📤 Redirect link welcome template sent to ${joinedPhone}`)
                        await supabase.from('message_logs').insert({
                          phone: joinedPhone, message_received: null,
                          response_sent: `[rl-tpl:${tpl.name || redirectLink.welcome_template_id}] ${tplMsg}`,
                          keyword_matched: '__group_welcome__', timestamp: new Date().toISOString(),
                          user_id: instData.user_id, instance_id: rlInstData.zapi_instance_id,
                        })
                      }
                    } else if (rlWelcomeType === 'flow' && redirectLink.welcome_flow_id) {
                      const { data: flowData } = await supabase
                        .from('flow_automations')
                        .select('keyword')
                        .eq('id', redirectLink.welcome_flow_id)
                        .eq('user_id', instData.user_id)
                        .eq('active', true)
                        .maybeSingle()

                      if (flowData?.keyword) {
                        const selfUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/webhook-zapi'
                        await fetch(selfUrl, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            phone: joinedPhone,
                            message: { text: flowData.keyword, fromMe: false },
                            instanceId: rlInstData.zapi_instance_id,
                            senderName: joinedName,
                            __manual_flow_trigger__: true,
                          }),
                        })
                        console.log(`🔄 Redirect link flow triggered: ${flowData.keyword} → ${joinedPhone}`)
                      }

                      await supabase.from('message_logs').insert({
                        phone: joinedPhone, message_received: null,
                        response_sent: `[rl-fluxo:${redirectLink.welcome_flow_id}]`,
                        keyword_matched: '__group_welcome__', timestamp: new Date().toISOString(),
                        user_id: instData.user_id, instance_id: rlInstData.zapi_instance_id,
                      })
                    }
                  }

                  // === GROUP MESSAGE (send inside the group) ===
                  const gmType = redirectLink.group_message_type || 'none'
                  if (gmType !== 'none') {
                    const groupChatId = normalizedGroupId.endsWith('-group') ? normalizedGroupId : normalizedGroupId.replace(/@g\.us$/i, '') + '-group'

                    let gmInstData = instData
                    if (redirectLink.group_message_instance_id) {
                      const { data: overrideInst } = await supabase
                        .from('zapi_instances')
                        .select('zapi_instance_id, zapi_token, zapi_client_token')
                        .eq('user_id', instData.user_id)
                        .eq('id', redirectLink.group_message_instance_id)
                        .eq('is_active', true)
                        .maybeSingle()
                      if (overrideInst) gmInstData = { ...instData, ...overrideInst }
                    }

                    const gmBaseUrl = `https://api.z-api.io/instances/${gmInstData.zapi_instance_id}/token/${gmInstData.zapi_token}`
                    const gmHeaders = { 'Content-Type': 'application/json', 'Client-Token': gmInstData.zapi_client_token }

                    if (gmType === 'text' && redirectLink.group_message_text) {
                      const groupMsg = (redirectLink.group_message_text || '')
                        .replace(/\{\{nome\}\}/gi, joinedName || 'novo membro')
                        .replace(/\{\{telefone\}\}/gi, joinedPhone)
                        .replace(/\{\{grupo\}\}/gi, groupName)
                      await fetch(`${gmBaseUrl}/send-text`, {
                        method: 'POST', headers: gmHeaders,
                        body: JSON.stringify({ phone: groupChatId, message: groupMsg }),
                      })
                      console.log(`📢 Group text message sent to ${groupChatId}`)
                    } else if (gmType === 'template' && redirectLink.group_message_template_id) {
                      const { data: tpl } = await supabase
                        .from('message_templates')
                        .select('*')
                        .eq('id', redirectLink.group_message_template_id)
                        .maybeSingle()
                      if (tpl) {
                        const tplContent = (tpl.content || '')
                          .replace(/\{\{nome\}\}/gi, joinedName || 'novo membro')
                          .replace(/\{\{telefone\}\}/gi, joinedPhone)
                          .replace(/\{\{grupo\}\}/gi, groupName)

                        if (tpl.media_url) {
                          const fileType = tpl.file_type || 'image'
                          const endpoint = fileType === 'video' ? 'send-video' : fileType === 'audio' ? 'send-audio' : fileType === 'document' ? 'send-document' : 'send-image'
                          await fetch(`${gmBaseUrl}/${endpoint}`, {
                            method: 'POST', headers: gmHeaders,
                            body: JSON.stringify({ phone: groupChatId, image: tpl.media_url, video: tpl.media_url, audio: tpl.media_url, document: tpl.media_url, caption: tplContent }),
                          })
                        } else {
                          await fetch(`${gmBaseUrl}/send-text`, {
                            method: 'POST', headers: gmHeaders,
                            body: JSON.stringify({ phone: groupChatId, message: tplContent }),
                          })
                        }
                        console.log(`📢 Group template message sent to ${groupChatId}`)
                      }
                    } else if (gmType === 'flow' && redirectLink.group_message_flow_id) {
                      // Trigger flow for group chat
                      const { data: flowData } = await supabase
                        .from('flow_automations')
                        .select('*')
                        .eq('id', redirectLink.group_message_flow_id)
                        .maybeSingle()
                      if (flowData) {
                        const flowPayload = {
                          instanceId: gmInstData.zapi_instance_id || '',
                          phone: groupChatId,
                          message: { text: { message: '__manual_flow_trigger__' } },
                          senderName: joinedName || '',
                          momment: 'received',
                          isGroup: true,
                        }
                        const fnUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/webhook-zapi'
                        await fetch(fnUrl, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
                          body: JSON.stringify(flowPayload),
                        })
                        console.log(`📢 Group flow triggered for ${groupChatId}`)
                      }
                    }
                  }

                  // === ADMIN NOTIFICATION ===
                  if (redirectLink.notify_admin && redirectLink.notify_phone) {
                    const notifyMsg = `🔔 *Novo membro no link rotativo*\n\n👤 ${joinedName || 'Desconhecido'}\n📱 ${joinedPhone}\n📋 Grupo: ${groupName}\n🔗 Link: ${redirectLink.name}`

                    // Use same instance resolution
                    let notifyInstData = rlWelcomeType !== 'none' ? (instData as any) : instData
                    if (redirectLink.welcome_instance_id) {
                      const { data: overrideInst } = await supabase
                        .from('zapi_instances')
                        .select('zapi_instance_id, zapi_token, zapi_client_token')
                        .eq('user_id', instData.user_id)
                        .eq('id', redirectLink.welcome_instance_id)
                        .eq('is_active', true)
                        .maybeSingle()
                      if (overrideInst) {
                        notifyInstData = { ...instData, ...overrideInst }
                      }
                    }

                    const notifyBase = `https://api.z-api.io/instances/${notifyInstData.zapi_instance_id}/token/${notifyInstData.zapi_token}`
                    await fetch(`${notifyBase}/send-text`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Client-Token': notifyInstData.zapi_client_token },
                      body: JSON.stringify({ phone: redirectLink.notify_phone, message: notifyMsg }),
                    })
                    console.log(`🔔 Admin notification sent to ${redirectLink.notify_phone}`)
                  }
                }
              }
            } catch (rlAutoErr) {
              console.error('❌ Redirect link automation error:', rlAutoErr)
            }
          }

          // === REDIRECT LINK: Update member count and auto-create group if full ===
          try {
            const { data: redirectGroups } = await supabase
              .from('redirect_link_groups')
              .select('*, redirect_links:redirect_link_id(*)')
              .eq('group_id', normalizedGroupId)

            if (redirectGroups && redirectGroups.length > 0) {
              for (const rg of redirectGroups) {
                const redirectLink = (rg as any).redirect_links
                if (!redirectLink) continue

                const maxMembers = redirectLink.max_members_per_group || 250

                // Get real member count
                let realCount = (rg.current_members || 0) + 1
                try {
                  const meta = await fetchGroupMetadata()
                  if (meta) {
                    realCount = meta.participants?.length || realCount
                  }
                } catch {
                  // use incremented count
                }

                const isFull = realCount >= maxMembers
                console.log(`📊 Redirect link group "${rg.group_name}": ${realCount}/${maxMembers} members${isFull ? ' → FULL!' : ''}`)

                await supabase
                  .from('redirect_link_groups')
                  .update({ current_members: realCount, is_full: isFull })
                  .eq('id', rg.id)

                // If full, auto-create a new group
                if (isFull && redirectLink.active) {
                  console.log(`🔄 Group "${rg.group_name}" reached limit. Auto-creating new group...`)

                  // Get all groups for this redirect link
                  const { data: allLinkGroups } = await supabase
                    .from('redirect_link_groups')
                    .select('*')
                    .eq('redirect_link_id', redirectLink.id)
                    .order('sort_order', { ascending: true })

                  const allFull = (allLinkGroups || []).every((g: any) => 
                    g.id === rg.id ? true : g.is_full
                  )

                  if (allFull) {
                    try {
                      const base = `https://api.z-api.io/instances/${instData.zapi_instance_id}/token/${instData.zapi_token}`
                      const headers = { 'Content-Type': 'application/json', 'Client-Token': instData.zapi_client_token }
                      const groupCount = (allLinkGroups || []).length

                      // Get template group metadata
                      let groupName = rg.group_name
                      let description = ''
                      let admins: string[] = []
                      let participantPhones: string[] = []
                      let photoUrl: string | null = rg.group_photo || null
                      let groupSettings = {
                        adminOnlyMessage: true,
                        adminOnlySettings: false,
                        requireAdminApproval: false,
                        adminOnlyAddMember: true,
                      }

                      const meta = await fetchGroupMetadata()
                      if (meta) {
                        description = meta.description || ''
                        groupSettings = {
                          adminOnlyMessage: Boolean(meta?.adminOnlyMessage),
                          adminOnlySettings: Boolean(meta?.adminOnlySettings),
                          requireAdminApproval: Boolean(meta?.requireAdminApproval),
                          adminOnlyAddMember: typeof meta?.adminOnlyAddMember === 'boolean' ? meta.adminOnlyAddMember : true,
                        }
                        const participants = extractParticipantArray(meta)
                        if (participants.length > 0) {
                          participantPhones = participants
                            .map((p: any) => normalizePhoneCandidate(p.phone || p.id || p.participant || p.jid || p.user || p.waId || p.number || ''))
                            .filter((p: string) => p.length > 0)

                          admins = participants
                            .filter((p: any) => isAdminParticipant(p))
                            .map((p: any) => normalizePhoneCandidate(p.phone || p.id || p.participant || p.jid || p.user || ''))
                            .filter((p: string) => p.length > 0)
                        }
                        if (meta.subject) groupName = meta.subject
                        if (!photoUrl && (meta.profileThumbnail || meta.groupPhoto || meta.imgUrl)) {
                          photoUrl = meta.profileThumbnail || meta.groupPhoto || meta.imgUrl
                        }
                      }

                      if (!photoUrl) {
                        try {
                          const groupsRes = await fetch(`${base}/groups`, {
                            method: 'GET',
                            headers,
                          })
                          if (groupsRes.ok) {
                            const groupsData = await groupsRes.json()
                            const matchedGroup = (Array.isArray(groupsData) ? groupsData : []).find((group: any) => {
                              const candidateId = group?.phone || group?.id || ''
                              return candidateId === normalizedGroupId || candidateId === rg.group_id
                            })
                            const listPhoto = matchedGroup?.imgUrl || matchedGroup?.profilePicture || matchedGroup?.image || matchedGroup?.photo || null
                            if (listPhoto) photoUrl = listPhoto
                          }
                        } catch (e) {
                          console.error('Failed to fetch group photo from groups list:', e)
                        }
                      }

                      if (!photoUrl) {
                        try {
                          const { data, error } = await supabase.functions.invoke('get-profile-picture', {
                            body: { phone: normalizedGroupId },
                          })
                          if (!error) {
                            const link = data?.data?.link || data?.data?.imgUrl || data?.data?.profilePictureUrl || data?.link || null
                            if (link && link !== 'null') {
                              photoUrl = link
                            }
                          }
                        } catch (e) {
                          console.error('Failed to fetch group photo:', e)
                        }
                      }

                      const numberMatch = groupName.match(/^(.*?)(\s+(\d+))?\s*$/)
                      let baseName = groupName
                      let nextNumber = groupCount + 1
                      if (numberMatch && numberMatch[3]) {
                        baseName = numberMatch[1]
                        nextNumber = parseInt(numberMatch[3]) + 1
                      }
                      const newGroupName = `${baseName} ${nextNumber}`

                      console.log(`🔄 Creating group: "${newGroupName}"`)

                      console.log(`📞 Auto-create using temp participant: ${TEMP_PARTICIPANT_PHONE}`)

                      const createRes = await fetch(`${base}/create-group`, {
                        method: 'POST', headers,
                        body: JSON.stringify({ autoInvite: true, groupName: newGroupName, phones: [TEMP_PARTICIPANT_PHONE] }),
                      })
                      const createData = await createRes.json()
                      console.log('📦 Auto-create group response:', JSON.stringify(createData))

                      const newGroupPhone = createData.phone || createData.groupId || null

                      if (newGroupPhone) {
                        const newGroupId = newGroupPhone.includes('-group')
                          ? newGroupPhone
                          : newGroupPhone.replace('@g.us', '-group')

                        await new Promise(r => setTimeout(r, 2000))

                        if (description) {
                          await fetch(`${base}/update-group-description`, {
                            method: 'POST', headers,
                            body: JSON.stringify({ groupId: newGroupId, groupDescription: description }),
                          }).catch(() => {})
                        }

                        if (photoUrl) {
                          await fetch(`${base}/update-group-photo`, {
                            method: 'POST', headers,
                            body: JSON.stringify({ groupId: newGroupId.replace('-group', '@g.us'), groupPhoto: photoUrl }),
                          }).catch(() => {})
                        }

                        if (admins.length > 0) {
                          const expandedAdmins = expandPhoneCandidates(admins)
                            .filter((phone) => phone !== TEMP_PARTICIPANT_PHONE)
                          if (expandedAdmins.length > 0) {
                            await fetch(`${base}/add-admin`, {
                              method: 'POST', headers,
                              body: JSON.stringify({ groupId: newGroupId, phones: expandedAdmins }),
                            }).catch(() => {})
                          }
                        }

                        await fetch(`${base}/update-group-settings`, {
                          method: 'POST', headers,
                          body: JSON.stringify({
                            phone: newGroupId,
                            adminOnlyMessage: groupSettings.adminOnlyMessage,
                            adminOnlySettings: groupSettings.adminOnlySettings,
                            requireAdminApproval: groupSettings.requireAdminApproval,
                            adminOnlyAddMember: groupSettings.adminOnlyAddMember,
                          }),
                        }).catch(() => {})

                        // Remove temporary participant
                        await fetch(`${base}/remove-participant`, {
                          method: 'POST', headers,
                          body: JSON.stringify({ groupId: newGroupId, phones: [TEMP_PARTICIPANT_PHONE] }),
                        }).catch(() => {})

                        // Get invite link
                        let inviteLink: string | null = null
                        const inviteRes = await fetch(`${base}/group-invitation-link/${newGroupId}`, {
                          method: 'GET', headers,
                        })
                        if (inviteRes.ok) {
                          const inviteData = await inviteRes.json()
                          inviteLink = inviteData.invitationLink || inviteData.inviteLink || inviteData.link || null
                        }

                        // Save to DB
                        await supabase.from('redirect_link_groups').insert({
                          redirect_link_id: redirectLink.id,
                          user_id: redirectLink.user_id,
                          group_id: newGroupId,
                          group_name: newGroupName,
                          invite_link: inviteLink,
                          instance_id: instData.zapi_instance_id,
                          sort_order: groupCount,
                          current_members: 0,
                          is_full: false,
                          group_photo: photoUrl,
                        })

                        console.log(`✅ Auto-created group "${newGroupName}" for link "${redirectLink.name}"`)
                      }
                    } catch (autoCreateErr) {
                      console.error('❌ Auto-create group failed:', autoCreateErr)
                    }
                  }
                }
              }
            }
          } catch (redirectErr) {
            console.error('❌ Redirect link tracking error:', redirectErr)
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

    // === GROUP PARTICIPANT LEAVE DETECTION ===
    const isLeaveEvent = 
      webhook?.isGroup === true &&
      !isStatusCallback &&
      noTextPayload &&
      hasLeaveNotificationText &&
      (hasParticipantHint || hasNotificationCode || webhookAction === 'remove' || webhookAction === 'leave')

    if (isLeaveEvent) {
      const groupPhone = webhook?.phone || webhook?.chatPhone || webhook?.groupId || ''
      const leaveInstanceId = webhook?.instanceId || webhook?.instance_id || ''
      
      let leftPhone = normalizeParticipantIdentifier(
        webhook?.participantPhone || webhook?.participant || webhook?.senderPhone || webhook?.groupParticipant?.phone || ''
      )
      if (!leftPhone && Array.isArray(notificationParams) && notificationParams.length > 0) {
        leftPhone = normalizeParticipantIdentifier(notificationParams[0])
      }
      const leftName = webhook?.participantName || webhook?.senderName || webhook?.groupParticipant?.name || ''

      if (groupPhone && leaveInstanceId && leftPhone && !leftPhone.includes('@lid') && leftPhone.length >= 8) {
        const normalizedLeaveId = normalizeInstanceIdentifier(leaveInstanceId)
        const { data: leaveInstances } = await supabase
          .from('zapi_instances')
          .select('user_id, zapi_instance_id')
          .eq('is_active', true)

        const instData = (leaveInstances || []).find((item: any) =>
          normalizeInstanceIdentifier(item?.zapi_instance_id) === normalizedLeaveId
        )

        if (instData) {
          let normalizedGroupId = groupPhone
          if (groupPhone.includes('@g.us')) normalizedGroupId = groupPhone.replace('@g.us', '-group')
          else if (!groupPhone.includes('-group')) normalizedGroupId = groupPhone + '-group'

          await supabase.from('message_logs').insert({
            phone: leftPhone,
            message_received: normalizedGroupId,
            response_sent: leftName || '',
            keyword_matched: '__group_leave__',
            timestamp: new Date().toISOString(),
            user_id: instData.user_id,
            instance_id: instData.zapi_instance_id,
          })
          console.log(`📝 Logged group leave: ${leftPhone} left ${normalizedGroupId}`)
        }
      }

      return new Response('group_leave_handled', { status: 200, headers: corsHeaders })
    }

    // Detect outgoing messages sent by this same WhatsApp instance
    const fromMe = resolveFromMe(webhook)

    const campaignSendStatus = mapCampaignSendStatusFromWebhook(webhook)

    if (campaignSendStatus) {
      const { raw: instanceId } = resolveWebhookInstanceReference(webhook)
      const phone = resolveWebhookPhone(webhook)
      const isGroupFromMeWithText = fromMe && (phone?.includes('@g.us') || phone?.includes('-group'))

      if (!instanceId || !phone) {
        console.log('⚠️ Status callback sem instanceId/phone suficiente para atualizar campaign_sends')
        if (!isGroupFromMeWithText) {
          return new Response('status_callback_missing_data', { status: 200, headers: corsHeaders })
        }
      } else {
        const normalizedCbInstanceId = normalizeInstanceIdentifier(instanceId)
        const { data: cbInstances } = await supabase
          .from('zapi_instances')
          .select('user_id, instance_name, zapi_instance_id')
          .eq('is_active', true)

        const instanceData = (cbInstances || []).find((item: any) => {
          return normalizeInstanceIdentifier(item?.zapi_instance_id) === normalizedCbInstanceId ||
            normalizeInstanceIdentifier(item?.instance_name) === normalizedCbInstanceId
        })

        const userId = instanceData?.user_id
        const instanceName = instanceData?.instance_name
        if (!userId) {
          console.log(`⚠️ Status callback sem user encontrado para instance ${instanceId}`)
          if (!isGroupFromMeWithText) {
            return new Response('status_callback_user_not_found', { status: 200, headers: corsHeaders })
          }
        } else {
          let resolvedPhone = phone
          if (resolvedPhone.includes('@lid')) {
            const { data: mapping } = await supabase
              .from('message_logs')
              .select('phone')
              .eq('keyword_matched', '__lid_map__')
              .eq('message_received', resolvedPhone)
              .eq('user_id', userId)
              .limit(1)
              .maybeSingle()

            if (mapping?.phone) {
              resolvedPhone = mapping.phone
            }
          }

          const nowIso = new Date().toISOString()
          const expandCampaignCallbackPhones = (value?: string | null) => {
            if (!value) return []

            const normalizedValue = normalizeGroupCampaignPhone(value)

            const candidates = new Set<string>([value, normalizedValue].filter(Boolean))

            if (normalizedValue.endsWith('@g.us')) {
              candidates.add(normalizedValue.replace(/@g\.us$/i, ''))
              candidates.add(normalizedValue.replace(/@g\.us$/i, '-group'))
              candidates.add(normalizedValue.replace(/@g\.us$/i, '-group@g.us'))
            } else if (normalizedValue.endsWith('-group')) {
              candidates.add(normalizedValue.replace(/-group$/i, '@g.us'))
              candidates.add(normalizedValue.replace(/-group$/i, ''))
              candidates.add(`${normalizedValue}@g.us`)
            } else if (/^\d+$/.test(normalizedValue)) {
              candidates.add(`${normalizedValue}@g.us`)
              candidates.add(`${normalizedValue}-group`)
              candidates.add(`${normalizedValue}-group@g.us`)
            }

            return Array.from(candidates)
          }

          const candidatePhones = Array.from(
            new Set([
              ...expandCampaignCallbackPhones(phone),
              ...expandCampaignCallbackPhones(resolvedPhone),
            ].filter(Boolean))
          )

          let campaignSendQuery = supabase
            .from('campaign_sends')
            .select('id, campaign_id, status, phone, sent_at, delivered_at, instance_name')
            .eq('user_id', userId)
            .in('phone', candidatePhones)

          if (instanceName) {
            campaignSendQuery = campaignSendQuery.eq('instance_name', instanceName)
          }

          const { data: campaignSendRows, error: campaignSendLookupError } = await campaignSendQuery
            .order('created_at', { ascending: false })
            .limit(5)

          if (campaignSendLookupError) {
            console.error('❌ Erro buscando campaign_sends para callback:', campaignSendLookupError)
          } else {
            const campaignSend = campaignSendRows?.find((row) => row.status === 'pending') || campaignSendRows?.[0]

            if (!campaignSend) {
              console.log(`⚠️ Nenhum campaign_send encontrado para callback ${campaignSendStatus} no telefone ${resolvedPhone}`)
            } else {
              const nextStatus = campaignSendStatus === 'delivered' || campaignSend.status === 'delivered'
                ? 'delivered'
                : 'sent'

              const updatePayload: Record<string, string> = {
                status: nextStatus,
              }

              if (!campaignSend.sent_at) {
                updatePayload.sent_at = nowIso
              }

              if (nextStatus === 'delivered') {
                updatePayload.delivered_at = nowIso
                if (!campaignSend.sent_at) {
                  updatePayload.sent_at = nowIso
                }
              }

              const { error: campaignSendUpdateError } = await supabase
                .from('campaign_sends')
                .update(updatePayload)
                .eq('id', campaignSend.id)

              if (campaignSendUpdateError) {
                console.error('❌ Erro atualizando campaign_send via callback:', campaignSendUpdateError)
              } else {
                console.log(`✅ campaign_send atualizado via callback: ${campaignSend.id} -> ${nextStatus} (${campaignSend.phone})`)

                if (campaignSend.campaign_id) {
                  const { data: campaignData, error: campaignLookupError } = await supabase
                    .from('campaigns')
                    .select('status, target_audience')
                    .eq('id', campaignSend.campaign_id)
                    .maybeSingle()

                  if (campaignLookupError) {
                    console.error('❌ Erro carregando campanha após callback:', campaignLookupError)
                  } else if (campaignData && (campaignData.status === 'active' || campaignData.status === 'draft')) {
                    const targetContacts = Array.isArray((campaignData.target_audience as any)?.contacts)
                      ? (campaignData.target_audience as any).contacts.length
                      : 0

                    const [pendingCountRes, processedCountRes, successCountRes] = await Promise.all([
                      supabase
                        .from('campaign_sends')
                        .select('id', { count: 'exact', head: true })
                        .eq('campaign_id', campaignSend.campaign_id)
                        .eq('status', 'pending'),
                      supabase
                        .from('campaign_sends')
                        .select('id', { count: 'exact', head: true })
                        .eq('campaign_id', campaignSend.campaign_id),
                      supabase
                        .from('campaign_sends')
                        .select('id', { count: 'exact', head: true })
                        .eq('campaign_id', campaignSend.campaign_id)
                        .in('status', ['sent', 'delivered']),
                    ])

                    const pendingCount = pendingCountRes.count ?? 0
                    const processedCount = processedCountRes.count ?? 0
                    const successCount = successCountRes.count ?? 0
                    const hasAllAudienceProcessed = targetContacts === 0 || processedCount >= targetContacts

                    if (pendingCount === 0 && hasAllAudienceProcessed) {
                      // Also check if there are contacts in target_audience that were never persisted as campaign_sends
                      const targetContacts = Array.isArray((campaignData.target_audience as any)?.contacts)
                        ? (campaignData.target_audience as any).contacts
                        : []
                      const missingContacts = targetContacts.length > 0 && processedCount < targetContacts.length
                      const nextCampaignStatus = processedCount === 0 || successCount === 0 || missingContacts ? 'paused' : 'completed'
                      const { error: campaignStatusError } = await supabase
                        .from('campaigns')
                        .update({ status: nextCampaignStatus, updated_at: nowIso })
                        .eq('id', campaignSend.campaign_id)

                      if (campaignStatusError) {
                        console.error('❌ Erro finalizando campanha após callback:', campaignStatusError)
                      } else {
                        console.log(`✅ Campanha ${campaignSend.campaign_id} finalizada após callback com status ${nextCampaignStatus}`)
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // For group fromMe messages with text, continue processing normally (don't return early)
      // so the message gets logged in message_logs for the chat
      if (!isGroupFromMeWithText) {
        return new Response('status_callback_processed', { status: 200, headers: corsHeaders })
      }
    }

    const isManualFlowTriggerEarly = webhook?.__manual_flow_trigger__ === true
    let messageRaw = extractMessageText(webhook)
    const audioUrl = extractAudioUrl(webhook)
    
    // For manual flow triggers from campaigns, inject a synthetic message text
    if (!messageRaw && isManualFlowTriggerEarly && webhook?.flowId) {
      messageRaw = `__flow_trigger_${webhook.flowId}__`
      console.log('🔄 Manual flow trigger detected, injecting synthetic message:', messageRaw)
    }
    
    let messageText = messageRaw.toLowerCase()
    let normalizedMessage = normalizeForMatch(messageRaw)
    let audioTranscription = ''

    if (!messageRaw && !audioUrl) {
      console.log('Evento sem texto detectado, ignorando. Chaves:', Object.keys(webhook || {}))
      const webhookType = webhook?.type || ''
      if (webhookType) {
        console.log('Webhook type:', webhookType, '| Full payload:', JSON.stringify(webhook).substring(0, 500))
      }
      return new Response('ignored_no_text', { status: 200, headers: corsHeaders })
    }

    // If audio message with no text, try to transcribe
    if (!messageRaw && audioUrl) {
      console.log('🎤 Audio message detected, attempting transcription...')
      audioTranscription = await transcribeAudio(audioUrl)
      if (audioTranscription && audioTranscription !== '[áudio não reconhecido]') {
        messageText = audioTranscription.toLowerCase()
        normalizedMessage = normalizeForMatch(audioTranscription)
        console.log('✅ Audio transcribed successfully, using as message text for matching')
      } else {
        console.log('⚠️ Audio could not be transcribed, logging as audio-only')
      }
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
      } else if (chatLid && chatLid.includes('@lid') && isLikelyTechnicalIdentifier(rawPhone)) {
        phone = chatLid
        console.log('⚠️ Raw phone parece ID técnico; usando chatLid para tentar resolução real:', chatLid)
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

    let instanceId = resolveWebhookInstanceReference(webhook).raw
    const normalizedInstanceId = resolveWebhookInstanceReference(webhook).normalized
    const isManualFlowTrigger = isManualFlowTriggerEarly
    
    console.log('Processando mensagem:', messageText, 'do telefone:', phone)
    console.log('🔎 Instance recebido no webhook:', {
      raw: instanceId,
      normalized: normalizedInstanceId,
      availableKeys: Object.keys(webhook || {}).filter((key) => key.toLowerCase().includes('instance')),
    })

    if (!normalizedInstanceId) {
      console.error('No instance reference in webhook data')
      return new Response('missing_instance_id', { status: 400, headers: corsHeaders })
    }

    instanceId = normalizedInstanceId

    // Find user and credentials by instanceId (prefer dedicated zapi_instances table)
    let userId: string | null = null
    let zapiConfig: { zapi_instance_id: string; zapi_token: string; zapi_client_token: string } | null = null

    // Extract authenticated user ID from Authorization header (for manual triggers from the frontend)
    let authenticatedUserId: string | null = null
    const authHeader = req.headers.get('authorization') || ''
    if (authHeader.startsWith('Bearer ') && isManualFlowTrigger) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: authUser } } = await supabase.auth.getUser(token)
        if (authUser?.id) {
          authenticatedUserId = authUser.id
          console.log('🔑 Authenticated user for manual flow:', authenticatedUserId)
        }
      } catch (authError) {
        console.log('⚠️ Could not extract authenticated user from token')
      }
    }

    const { data: instancesData, error: instancesError } = await supabase
      .from('zapi_instances')
      .select('user_id, instance_name, zapi_instance_id, zapi_token, zapi_client_token')
      .eq('is_active', true)

    if (instancesError) {
      console.error('Erro ao buscar instâncias ativas:', instancesError)
    }

    // When multiple users share the same zapi_instance_id, prefer the authenticated user's instance
    const matchingInstances = (instancesData || []).filter((item: any) => {
      return normalizeInstanceIdentifier(item?.zapi_instance_id) === normalizedInstanceId ||
        normalizeInstanceIdentifier(item?.instance_name) === normalizedInstanceId
    })

    let instanceData: any = null
    if (matchingInstances.length > 1 && authenticatedUserId) {
      instanceData = matchingInstances.find((item: any) => item.user_id === authenticatedUserId) || matchingInstances[0]
      console.log(`🔀 Multiple instances found for ${normalizedInstanceId}, resolved to user: ${instanceData.user_id}`)
    } else {
      instanceData = matchingInstances[0] || null
    }

    // When multiple users share the same instance and it's NOT a manual trigger,
    // try to find which user has recent conversation with this phone number
    if (matchingInstances.length > 1 && !authenticatedUserId && phone) {
      const candidateUserIds = matchingInstances.map((item: any) => item.user_id)
      const { data: recentLogs } = await supabase
        .from('message_logs')
        .select('user_id')
        .in('user_id', candidateUserIds)
        .eq('phone', phone)
        .not('keyword_matched', 'eq', '__lid_map__')
        .not('keyword_matched', 'eq', '__processing__')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentLogs && recentLogs.length > 0) {
        const bestUserId = recentLogs[0].user_id
        const bestInstance = matchingInstances.find((item: any) => item.user_id === bestUserId)
        if (bestInstance) {
          instanceData = bestInstance
          console.log(`🔀 Multiple instances for ${normalizedInstanceId}, resolved via recent conversation to user: ${bestUserId}`)
        }
      } else {
        // No conversation history — log the message for ALL users so nobody misses it
        console.log(`🔀 Multiple instances for ${normalizedInstanceId}, no conversation history for ${phone} — will process for all ${matchingInstances.length} users`)
      }
    }

    const hasExplicitRequestedInstance = Boolean(webhook?.instanceId || webhook?.instance_id || webhook?.instanceName || webhook?.instance_name)

    if (instanceData) {
      userId = instanceData.user_id
      instanceId = instanceData.zapi_instance_id
      zapiConfig = {
        zapi_instance_id: instanceData.zapi_instance_id,
        zapi_token: instanceData.zapi_token,
        zapi_client_token: instanceData.zapi_client_token,
      }
    } else if (isManualFlowTrigger && hasExplicitRequestedInstance) {
      console.error('Manual flow requested invalid or inactive instance:', {
        requested: webhook?.instanceId || webhook?.instance_id,
        normalized: normalizedInstanceId,
      })
      return new Response('selected_instance_not_found', { status: 400, headers: corsHeaders })
    } else {
      userId = profile.id
      zapiConfig = {
        zapi_instance_id: profile.zapi_instance_id,
        zapi_token: profile.zapi_token,
        zapi_client_token: profile.zapi_client_token,
      }
    }

    // Manual flow trigger safeguard:
    // Respect the explicitly requested instance from the UI.
    // Only auto-adjust when the trigger did not provide an instanceId.
    if (isManualFlowTrigger && userId && phone && !hasExplicitRequestedInstance) {
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

    if (isManualFlowTrigger && zapiConfig?.zapi_instance_id && zapiConfig?.zapi_token && zapiConfig?.zapi_client_token) {
      try {
        const statusResponse = await fetch(`https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiConfig.zapi_client_token,
          },
        })
        const statusPayload = await statusResponse.json().catch(() => ({}))
        const status = String(statusPayload?.status || '').toLowerCase()
        const connectedFlag = statusPayload?.connected
        const connected = connectedFlag === true || (typeof connectedFlag === 'string' && connectedFlag.toLowerCase() === 'true') || status === 'connected'
        const explicitlyDisconnected = connectedFlag === false || status === 'disconnected' || status === 'close' || status === 'closed'

        if (!statusResponse.ok || (explicitlyDisconnected && !connected)) {
          console.error('Manual flow blocked: selected instance disconnected', {
            instanceId: zapiConfig.zapi_instance_id,
            status: statusPayload,
          })
          return new Response('selected_instance_disconnected', { status: 503, headers: corsHeaders })
        }
      } catch (deviceError) {
        console.error('Failed to validate selected instance connectivity before manual flow send:', deviceError)
        return new Response('selected_instance_status_error', { status: 502, headers: corsHeaders })
      }
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

      // Build outgoing content with audio tag if applicable
      let outgoingContent = messageRaw
      if (audioUrl) {
        const audioTag = `[media:audio:${audioUrl}]`
        outgoingContent = audioTag + (messageRaw ? `\n${messageRaw}` : '')
      }

      const { error: outgoingLogError } = await supabase
        .from('message_logs')
        .insert({
          phone,
          message_received: null,
          response_sent: outgoingContent,
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

    // Build the raw message content for storage (include audio tag + transcription)
    let storedMessage = messageRaw
    if (audioUrl) {
      const audioTag = `[media:audio:${audioUrl}]`
      if (audioTranscription && audioTranscription !== '[áudio não reconhecido]') {
        storedMessage = `${audioTag}\n🎙️ ${audioTranscription}`
      } else {
        storedMessage = audioTag + (messageRaw ? `\n${messageRaw}` : '')
      }
    }

    // Dedupe idempotente: cria um lock por usuário+telefone+mensagem em janela de 15s
    const lockResult = await acquireMessageProcessingLock(supabase, {
      userId,
      phone,
      normalizedMessage: normalizedMessage || normalizeForMatch(storedMessage),
      rawMessage: storedMessage,
      instanceId,
    })

    if (!lockResult.acquired) {
      console.log('Mensagem duplicada detectada, ignorando para manter ordem do fluxo')
      return new Response('ignored_duplicate', { status: 200, headers: corsHeaders })
    }

    processingLockId = lockResult.lockId
    const lockId = lockResult.lockId

    await makeMessageVisibleInInbox(supabase, lockId)

    // Do not forward regular inbound WhatsApp messages to payment/webhook integrations.
    // These integrations are reserved for gateway transaction events (approved, pending, refunded, etc).
    console.log('Encaminhamento para gateway_integrations ignorado no webhook-zapi para evitar disparos indevidos')

    const { data: pendingCaptureLog } = await supabase
      .from('message_logs')
      .select('id, response_sent, instance_id')
      .eq('user_id', userId)
      .eq('phone', phone)
      .eq('keyword_matched', `${FLOW_CAPTURE_PREFIX}${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pendingCaptureLog?.response_sent) {
      try {
        const pendingState = JSON.parse(String(pendingCaptureLog.response_sent || '{}')) as PendingCaptureState
        const flowId = pendingState.flowId
        if (flowId) {
          const { data: pendingFlow } = await supabase
            .from('flow_automations')
            .select('*')
            .eq('id', flowId)
            .eq('user_id', userId)
            .eq('active', true)
            .maybeSingle()

          if (pendingFlow) {
            const updatedCaptured = { ...(pendingState.captured || {}) }
            if (pendingState.field === 'name') updatedCaptured.nome = messageRaw
            if (pendingState.field === 'whatsapp') updatedCaptured.whatsapp = normalizePhoneCandidate(messageRaw) || messageRaw
            if (pendingState.field === 'email') updatedCaptured.email = messageRaw.trim()

            // Persist captured data for reporting (upsert by user_id + flow_id + phone)
            try {
              const { data: existingCapture } = await supabase
                .from('flow_captured_data')
                .select('id')
                .eq('user_id', userId)
                .eq('flow_id', pendingFlow.id)
                .eq('phone', phone)
                .maybeSingle()

              const captureRow = {
                user_id: userId,
                flow_id: pendingFlow.id,
                flow_name: pendingFlow.name,
                phone,
                nome: updatedCaptured.nome || null,
                whatsapp: updatedCaptured.whatsapp || null,
                email: updatedCaptured.email || null,
                source: 'whatsapp',
                updated_at: new Date().toISOString(),
              }

              if (existingCapture) {
                await supabase.from('flow_captured_data').update(captureRow).eq('id', existingCapture.id)
              } else {
                await supabase.from('flow_captured_data').insert(captureRow)
              }
              console.log(`💾 Captured data saved for ${phone} on flow ${pendingFlow.name}`)
            } catch (capSaveErr) {
              console.error('⚠️ Failed to save captured data:', capSaveErr)
            }

            const flowNodes: FlowNode[] = pendingFlow.nodes || []
            const flowEdges: FlowEdge[] = pendingFlow.edges || []
            const sourceNode = flowNodes.find(n => n.id === pendingState.nodeId)
            const resumeEdge = flowEdges.find(e => e.source === pendingState.nodeId && e.sourceHandle === `collect-${pendingState.field}`)

            await supabase.from('message_logs').delete().eq('id', pendingCaptureLog.id)

            if (sourceNode) {
              const followUpMap = {
                name: sourceNode.data.nameFollowUp || '',
                whatsapp: sourceNode.data.whatsappFollowUp || '',
                email: sourceNode.data.emailFollowUp || '',
              }
              const followUpMessage = String(followUpMap[pendingState.field] || '')
                .replace(/\{\{nome\}\}/gi, updatedCaptured.nome || '')
                .replace(/\{\{whatsapp\}\}/gi, updatedCaptured.whatsapp || phone || '')
                .replace(/\{\{telefone\}\}/gi, updatedCaptured.whatsapp || phone || '')
                .replace(/\{\{email\}\}/gi, updatedCaptured.email || '')

              if (followUpMessage.trim()) {
                await fetch(`https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/send-text`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Client-Token': zapiConfig.zapi_client_token,
                  },
                  body: JSON.stringify({ phone, message: followUpMessage }),
                })
              }
            }

            if (resumeEdge) {
              const visited = new Set<string>()
              const targetNode = flowNodes.find(n => n.id === resumeEdge.target)
              if (targetNode?.type === 'blocoConteudo') {
                const shouldStop = await sendNodeContent(targetNode, flowNodes, flowEdges, phone, zapiConfig, visited, supabase, userId, pendingFlow.name, {
                  resumeCaptured: updatedCaptured,
                  flowId: pendingFlow.id,
                })
                if (!shouldStop) {
                  await processFlowNode(targetNode.id, flowNodes, flowEdges, phone, zapiConfig, supabase, visited, userId, pendingFlow.name, {
                    resumeCaptured: updatedCaptured,
                    flowId: pendingFlow.id,
                  })
                }
              } else if (targetNode) {
                await processFlowNode(targetNode.id, flowNodes, flowEdges, phone, zapiConfig, supabase, visited, userId, pendingFlow.name, {
                  resumeCaptured: updatedCaptured,
                  flowId: pendingFlow.id,
                })
              }

              await finalizeMessageLog(supabase, lockId, {
                keywordMatched: `__flow_capture_resume__:${pendingFlow.id}`,
                responseSent: `[Captura ${pendingState.field}]`,
              })
              return new Response('flow_capture_resumed', { status: 200, headers: corsHeaders })
            }
          }
        }
      } catch (captureResumeError) {
        console.error('Erro ao retomar captura pendente:', captureResumeError)
      }
    }

    // === CHECK FLOW AUTOMATIONS FIRST ===
    const { data: flowAutomations, error: flowError } = await supabase
      .from('flow_automations')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)

    if (!flowError && flowAutomations && flowAutomations.length > 0) {
      if (isManualFlowTrigger && webhook?.flowId) {
        const directFlow = flowAutomations.find((flow: any) => flow.id === webhook.flowId)

        if (directFlow) {
          console.log('Fluxo manual encontrado por ID:', directFlow.id, directFlow.name)

          const nodes: FlowNode[] = directFlow.nodes || []
          const edges: FlowEdge[] = directFlow.edges || []
          const initialNode = nodes.find(n => n.type === 'blocoInicial')

          if (initialNode) {
            await processFlowNode(
              initialNode.id,
              nodes,
              edges,
              phone,
              zapiConfig,
              supabase,
              new Set<string>(),
              userId,
              directFlow.name,
              { flowId: directFlow.id }
            )

            await finalizeMessageLog(supabase, lockId, {
              keywordMatched: `__manual_flow_trigger__:${directFlow.id}`,
              responseSent: `[Fluxo: ${directFlow.name}]`,
            })

            return new Response('manual_flow_sent', { status: 200, headers: corsHeaders })
          }
        }

        console.log('⚠️ Fluxo manual não encontrado por ID, tentando fallback por palavra-chave')
      }

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
          const shouldStop = await sendNodeContent(targetNode, flowNodes, flowEdges, phone, zapiConfig, visited, supabase, userId, flow.name, { flowId: flow.id })
          // Only continue processing children if the node doesn't have button branching
          if (!shouldStop) {
            await processFlowNode(targetNode.id, flowNodes, flowEdges, phone, zapiConfig, supabase, visited, userId, flow.name, { flowId: flow.id })
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
            matchedFlow.name,
            { flowId: matchedFlow.id }
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
    const { data: latestAgentConfig, error: agentConfigError } = await supabase
      .from('agent_config')
      .select('id, active, agent_name, system_prompt, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (agentConfigError) {
      console.error('Erro ao carregar configuração do agente IA:', agentConfigError)
    }

    const isAgentEnabled = latestAgentConfig?.active === true

    if (!isAgentEnabled) {
      console.log('🤖 Agente IA desativado para o usuário:', userId, '| instância:', zapiConfig.zapi_instance_id)
      await releaseMessageProcessingLock(supabase, lockId)
      return new Response('ai_agent_disabled', { status: 200, headers: corsHeaders })
    }

    console.log('🤖 Agente IA ativo, gerando resposta...', {
      userId,
      instanceId: zapiConfig.zapi_instance_id,
      agentConfigId: latestAgentConfig?.id,
    })

    try {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
      if (!LOVABLE_API_KEY) {
        console.error('LOVABLE_API_KEY não configurada para agente IA')
      } else {
        const { data: knowledge } = await supabase
          .from('agent_knowledge')
          .select('type, question, answer, content, title')
          .eq('user_id', userId)
          .eq('active', true)

        let systemPrompt = latestAgentConfig.system_prompt || 'Você é um assistente virtual prestativo.'
        systemPrompt += '\n\n--- REGRAS ---'
        systemPrompt += '\n- Responda sempre de forma educada e objetiva.'
        systemPrompt += '\n- Use a base de conhecimento abaixo para responder.'
        systemPrompt += '\n- Se não souber a resposta, diga que vai encaminhar para um atendente humano.'
        systemPrompt += `\n- Nome do agente: ${latestAgentConfig.agent_name || 'Assistente'}`
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
  flowName?: string,
  options?: { resumeCaptured?: PendingCaptureState['captured']; skipCapturePromptForField?: PendingCaptureState['field'] | null; flowId?: string | null }
): Promise<boolean> {
  if (visited.has(targetNode.id)) return false
  visited.add(targetNode.id)

  if (targetNode.type !== 'blocoConteudo') return false

  const getZapiAckId = (payload: any) => {
    return payload?.messageId || payload?.zapiMessageId || payload?.zaapId || payload?.id || payload?.key?.id || payload?.message?.id || null
  }

  const hasExplicitZapiError = (payload: any) => {
    return payload?.error || payload?.erro || (payload?.success === false ? payload?.message : null) || null
  }

  const isZapiSendConfirmed = (payload: any) => {
    const ackId = getZapiAckId(payload)
    const status = String(payload?.status || payload?.message?.status || '').toUpperCase()
    const result = String(payload?.result || '').toUpperCase()
    const hasPositiveStatus = ['PENDING', 'QUEUED', 'QUEUE', 'SENT', 'SUCCESS', 'OK'].includes(status) || ['PENDING', 'QUEUED', 'SUCCESS', 'OK'].includes(result)
    return Boolean(ackId || hasPositiveStatus)
  }

  const parseZapiResponse = async (res: Response, context: string) => {
    const raw = await res.text()
    let payload: any = null

    try {
      payload = raw ? JSON.parse(raw) : null
    } catch {
      payload = { raw }
    }

    const explicitError = hasExplicitZapiError(payload)
    const confirmed = isZapiSendConfirmed(payload)

    console.log(`${context}: status=${res.status} confirmed=${confirmed} ack=${getZapiAckId(payload) || 'none'} body=${raw.substring(0, 300)}`)

    if (!res.ok || explicitError || !confirmed) {
      throw new Error(explicitError || `Z-API não confirmou o envio do bloco (${context})`)
    }

    return payload
  }

  const contentType = targetNode.data.contentType || 'text'
  const replaceCapturedVars = (text: string) => {
    const captured = options?.resumeCaptured || {}
    return String(text || '')
      .replace(/\{\{nome\}\}/gi, captured.nome || '')
      .replace(/\{\{whatsapp\}\}/gi, captured.whatsapp || phone || '')
      .replace(/\{\{telefone\}\}/gi, captured.whatsapp || phone || '')
      .replace(/\{\{email\}\}/gi, captured.email || '')
  }
  const content = replaceCapturedVars(targetNode.data.content || '')
  const mediaUrl = targetNode.data.mediaUrl || ''
  const buttons: Array<{text: string, type: string, value: string}> = targetNode.data.buttons || []
  console.log(`🎥 Node data flags: isPtv=${targetNode.data?.isPtv}, viewOnce=${targetNode.data?.viewOnce}, contentType=${contentType}`)

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''

  const captureSteps: Array<{ field: PendingCaptureState['field']; enabled: boolean; prompt: string; followUp: string; handle: string }> = [
    { field: 'name' as const, enabled: !!targetNode.data.collectName, prompt: targetNode.data.content || targetNode.data.namePrompt || 'Qual o seu nome?', followUp: targetNode.data.nameFollowUp || '', handle: 'collect-name' },
    { field: 'whatsapp' as const, enabled: !!targetNode.data.collectWhatsapp, prompt: targetNode.data.content || targetNode.data.whatsappPrompt || 'Qual seu WhatsApp?', followUp: targetNode.data.whatsappFollowUp || '', handle: 'collect-whatsapp' },
    { field: 'email' as const, enabled: !!targetNode.data.collectEmail, prompt: targetNode.data.content || targetNode.data.emailPrompt || 'Qual seu melhor email?', followUp: targetNode.data.emailFollowUp || '', handle: 'collect-email' },
  ].filter(step => step.enabled)

  const nextCaptureStep = captureSteps.find(step => {
    if (options?.skipCapturePromptForField === step.field) return false
    if (step.field === 'name') return !options?.resumeCaptured?.nome
    if (step.field === 'whatsapp') return !options?.resumeCaptured?.whatsapp
    if (step.field === 'email') return !options?.resumeCaptured?.email
    return false
  })

  function wrapUrlWithTracking(rawUrl: string, btnText: string): string {
    if (!supabaseUrl || !flowName || !userId) return rawUrl
    const finalUrl = rawUrl.match(/^https?:\/\//) ? rawUrl : `https://${rawUrl}`
    const params = new URLSearchParams({
      url: finalUrl,
      flow: flowName,
      btn: btnText,
      uid: userId,
      ph: phone,
    })
    return `${supabaseUrl}/functions/v1/track-flow-click?${params.toString()}`
  }

  function buildReplyButtons(btns: typeof allSendButtons) {
    return btns
      .filter(b => b.type === 'reply' || b.type === 'flow')
      .slice(0, 3)
      .map(btn => ({ label: (btn.text || '').trim() || 'Botão' }))
  }

  function buildUrlCallSuffix(btns: typeof allSendButtons): string {
    const parts: string[] = []
    for (const btn of btns) {
      const label = (btn.text || '').trim()
      if (btn.type === 'url' && btn.value) {
        const url = wrapUrlWithTracking(btn.value.trim(), label || 'Link')
        parts.push(`🔗 ${label}: ${url}`)
      } else if (btn.type === 'call' && btn.value) {
        parts.push(`📞 ${label}: ${btn.value.trim()}`)
      }
    }
    return parts.length > 0 ? '\n\n' + parts.join('\n') : ''
  }

  try {
    console.log(`>>> Enviando bloco ${targetNode.id} tipo=${contentType} buttons=${allSendButtons.length}`)

    if (nextCaptureStep) {
      const captureRes = await fetch(`${baseUrl}/send-text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, message: replaceCapturedVars(nextCaptureStep.prompt) }),
      })
      await parseZapiResponse(captureRes, `Bloco ${targetNode.id} (capture:${nextCaptureStep.field})`)

      if (supabase && userId) {
        await supabase.from('message_logs').insert({
          phone,
          message_received: null,
          response_sent: JSON.stringify({
            flowId: options?.flowId || null,
            flowName: flowName || null,
            nodeId: targetNode.id,
            field: nextCaptureStep.field,
            instanceId: zapiConfig?.zapi_instance_id || null,
            captured: options?.resumeCaptured || {},
          }),
          keyword_matched: `${FLOW_CAPTURE_PREFIX}${userId}`,
          timestamp: new Date().toISOString(),
          user_id: userId,
          instance_id: zapiConfig?.zapi_instance_id || null,
        })
      }

      return true
    }

    if (hasButtons) {
      if ((contentType === 'image' || contentType === 'video') && mediaUrl) {
        let mediaEndpoint: string
        const mediaBody: any = { phone }
        if (contentType === 'video' && targetNode.data?.isPtv) {
          mediaEndpoint = '/send-ptv'
          mediaBody.ptv = mediaUrl
        } else if (contentType === 'video') {
          mediaEndpoint = '/send-video'
          mediaBody.video = mediaUrl
          if (targetNode.data?.viewOnce) mediaBody.viewOnce = true
        } else {
          mediaEndpoint = '/send-image'
          mediaBody.image = mediaUrl
        }
        const mediaRes = await fetch(`${baseUrl}${mediaEndpoint}`, { method: 'POST', headers, body: JSON.stringify(mediaBody) })
        await parseZapiResponse(mediaRes, `Bloco ${targetNode.id} (${contentType} mídia pré-botões)`)
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      const replyButtons = buildReplyButtons(allSendButtons)
      const urlCallSuffix = buildUrlCallSuffix(allSendButtons)
      const fullMessage = (content || '') + urlCallSuffix

      let res: Response
      if (replyButtons.length > 0) {
        res = await fetch(`${baseUrl}/send-button-list`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            phone,
            message: fullMessage,
            buttonList: { buttons: replyButtons },
          }),
        })
      } else {
        // URL/Call buttons only — use send-button-actions
        const actionButtons = allSendButtons
          .filter(b => b.type === 'url' || b.type === 'call')
          .slice(0, 3)
          .map((btn, idx) => {
            const action: any = {
              id: String(idx + 1),
              type: btn.type === 'url' ? 'URL' : 'CALL',
              label: (btn.text || '').trim() || 'Botão',
            }
            if (btn.type === 'url' && btn.value) {
              const label = (btn.text || '').trim() || 'Link'
              action.url = wrapUrlWithTracking(btn.value.trim(), label)
            }
            if (btn.type === 'call' && btn.value) {
              action.phone = btn.value.trim()
            }
            return action
          })

        if (actionButtons.length > 0) {
          res = await fetch(`${baseUrl}/send-button-actions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              phone,
              message: content || 'Selecione uma opção:',
              buttonActions: actionButtons,
            }),
          })
        } else {
          res = await fetch(`${baseUrl}/send-text`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ phone, message: fullMessage }),
          })
        }
      }
      await parseZapiResponse(res, `Bloco ${targetNode.id} (${contentType}+buttons)`)
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
          if (targetNode.data?.isPtv) {
            endpoint = '/send-ptv'
            body.ptv = mediaUrl
          } else {
            endpoint = '/send-video'
            body.video = mediaUrl
            body.caption = content
            if (targetNode.data?.viewOnce) body.viewOnce = true
          }
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
        await parseZapiResponse(res, `Bloco ${targetNode.id} (${contentType})`)
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    }

    if (supabase && userId) {
      try {
        const buttonLabels = allSendButtons.map(b => b.text).filter(Boolean).join(' | ')
        let logContent = content || ''

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
    throw e
  }

  const hasCaptureEdges = edges.some(e => e.source === targetNode.id && String(e.sourceHandle || '').startsWith('collect-'))
  const hasButtonEdges = buttons.some((btn, idx) => {
    return edges.some(e => e.source === targetNode.id && e.sourceHandle === `button-${idx}`)
  })

  if (hasButtonEdges || hasCaptureEdges) {
    console.log(`Bloco ${targetNode.id} tem saídas de botão/captura — aguardando resposta do usuário`)
    return true
  }

  return false
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
  flowName?: string,
  options?: { resumeCaptured?: PendingCaptureState['captured']; skipCapturePromptForField?: PendingCaptureState['field'] | null; flowId?: string | null }
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
      const shouldStop = await sendNodeContent(targetNode, nodes, edges, phone, zapiConfig, visited, supabase, userId, flowName, options)
      if (shouldStop) continue
    }

    await processFlowNode(targetNode.id, nodes, edges, phone, zapiConfig, supabase, visited, userId, flowName, options)
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

async function makeMessageVisibleInInbox(supabase: any, lockId: string) {
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

function extractButtonReplyCandidates(webhook: any): string[] {
  const values = new Set<string>()

  const push = (value: unknown) => {
    if (typeof value !== 'string') return
    const trimmed = value.trim()
    if (trimmed) values.add(trimmed)
  }

  const candidateValues = [
    webhook?.buttonReply?.title,
    webhook?.buttonReply?.text,
    webhook?.buttonReply?.label,
    webhook?.buttonReply?.selectedDisplayText,
    webhook?.buttonReply?.selectedRowId,
    webhook?.buttonReply?.id,
    webhook?.message?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.message?.buttonResponseMessage?.selectedDisplayText,
    webhook?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.buttonsResponseMessage?.selectedButtonId,
    webhook?.buttonsResponseMessage?.selectedButtonText,
    webhook?.buttonsResponseMessage?.message,
    webhook?.buttonsResponseMessage?.text,
    webhook?.buttonResponseMessage?.selectedDisplayText,
    webhook?.buttonResponseMessage?.selectedButtonId,
    webhook?.listResponseMessage?.title,
    webhook?.listResponseMessage?.singleSelectReply?.selectedRowId,
    webhook?.interactiveResponse?.title,
    webhook?.interactiveResponse?.description,
    webhook?.title,
    webhook?.selectedButtonId,
    webhook?.response?.title,
    webhook?.response?.text,
    webhook?.response?.selectedDisplayText,
    webhook?.message?.templateButtonReplyMessage?.selectedDisplayText,
    webhook?.message?.templateButtonReplyMessage?.selectedId,
    webhook?.templateButtonReplyMessage?.selectedDisplayText,
    webhook?.templateButtonReplyMessage?.selectedId,
    webhook?.waitingMessage?.buttonReply?.title,
    webhook?.waitingMessage?.buttonReply?.text,
    webhook?.waitingMessage?.buttonReply?.label,
    webhook?.waitingMessage?.buttonReply?.selectedDisplayText,
    webhook?.data?.buttonReply?.title,
    webhook?.data?.buttonReply?.text,
    webhook?.data?.buttonReply?.label,
    webhook?.data?.buttonReply?.selectedDisplayText,
  ]

  candidateValues.forEach(push)

  const paramsJsonCandidates = [
    webhook?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson,
    webhook?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson,
  ]

  for (const paramsJson of paramsJsonCandidates) {
    if (typeof paramsJson !== 'string' || !paramsJson.trim()) continue

    push(paramsJson)

    try {
      const parsed = JSON.parse(paramsJson)
      if (parsed && typeof parsed === 'object') {
        ;[
          parsed.id,
          parsed.selectedId,
          parsed.selectedButtonId,
          parsed.selectedDisplayText,
          parsed.selectedButtonText,
          parsed.title,
          parsed.text,
          parsed.value,
        ].forEach(push)
      }
    } catch {
      // ignore malformed nativeFlow params
    }
  }

  return Array.from(values)
}

function findButtonEdgeMatch(flows: any[], normalizedMessage: string, rawMessage: string, webhook?: any): { flow: any, targetNodeId: string, buttonText: string, flowName: string } | null {
  const normalizedRaw = normalizeForMatch(rawMessage)
  const replyCandidates = Array.from(new Set([
    rawMessage,
    normalizedMessage,
    ...extractButtonReplyCandidates(webhook),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)))

  const normalizedCandidates = new Set(
    replyCandidates
      .map((value) => normalizeForMatch(value))
      .filter(Boolean)
  )

  console.log('🎛️ Button reply candidates:', replyCandidates)

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

        const buttonIndexValues = [
          String(idx + 1),
          `button-${idx}`,
          `button_${idx}`,
          `btn-${idx + 1}`,
          `btn_${idx + 1}`,
        ]
        const normalizedIndexValues = buttonIndexValues
          .map((value) => normalizeForMatch(value))
          .filter(Boolean)

        const didMatch =
          normalizedRaw === normalizedBtn ||
          normalizedMessage === normalizedBtn ||
          normalizedCandidates.has(normalizedBtn) ||
          normalizedIndexValues.some((value) => normalizedCandidates.has(value))

        if (didMatch) {
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

function extractAudioUrl(webhook: any): string {
  const candidates = [
    webhook?.audio?.audioUrl,
    webhook?.audio?.url,
    webhook?.audioMessage?.url,
    webhook?.message?.audioMessage?.url,
    webhook?.data?.audio?.audioUrl,
    webhook?.data?.audio?.url,
    webhook?.data?.audioMessage?.url,
    webhook?.data?.message?.audioMessage?.url,
    webhook?.waitingMessage?.audio?.audioUrl,
    webhook?.waitingMessage?.audioMessage?.url,
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().startsWith('http')) return value.trim()
  }

  return ''
}

async function transcribeAudio(audioUrl: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    console.log('⚠️ LOVABLE_API_KEY not set, skipping audio transcription')
    return ''
  }

  try {
    // Download audio as base64
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      console.error('❌ Failed to download audio:', audioResponse.status)
      return ''
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    const uint8Array = new Uint8Array(audioBuffer)
    let binary = ''
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64Audio = btoa(binary)

    // Detect mime type from URL or default to audio/ogg
    let mimeType = 'audio/ogg'
    if (audioUrl.includes('.mp3') || audioUrl.includes('audio/mpeg')) mimeType = 'audio/mpeg'
    else if (audioUrl.includes('.wav')) mimeType = 'audio/wav'
    else if (audioUrl.includes('.m4a') || audioUrl.includes('.mp4')) mimeType = 'audio/mp4'

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um transcritor de áudio. Transcreva o áudio fielmente, palavra por palavra. Retorne APENAS a transcrição, sem comentários, sem aspas, sem prefixos como "Transcrição:". Se não conseguir entender o áudio, retorne "[áudio não reconhecido]".',
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Audio,
                  format: mimeType === 'audio/wav' ? 'wav' : 'mp3',
                },
              },
              {
                type: 'text',
                text: 'Transcreva este áudio.',
              },
            ],
          },
        ],
        stream: false,
      }),
    })

    if (!response.ok) {
      console.error('❌ AI transcription failed:', response.status, await response.text())
      return ''
    }

    const data = await response.json()
    const transcription = data.choices?.[0]?.message?.content?.trim() || ''
    console.log(`🎙️ Transcription result (${transcription.length} chars):`, transcription.substring(0, 200))
    return transcription
  } catch (error) {
    console.error('❌ Audio transcription error:', error)
    return ''
  }
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
    webhook?.buttonsResponseMessage?.selectedButtonId,
    webhook?.buttonsResponseMessage?.selectedButtonText,
    webhook?.buttonsResponseMessage?.message,
    webhook?.buttonsResponseMessage?.text,
    webhook?.buttonResponseMessage?.selectedDisplayText,
    webhook?.buttonResponseMessage?.selectedButtonId,
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
    webhook?.buttonsResponseMessage,
    webhook?.buttonResponseMessage,
    webhook?.waitingMessage,
    webhook?.data?.buttonReply,
    webhook?.data?.message,
    webhook?.data?.waitingMessage,
    webhook?.data?.buttonsResponseMessage,
  ]

  const fallbackKeys = ['text', 'message', 'body', 'caption', 'conversation', 'title', 'description', 'label', 'selectedDisplayText', 'selectedButtonId', 'selectedButtonText', 'selectedRowId', 'id']
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
