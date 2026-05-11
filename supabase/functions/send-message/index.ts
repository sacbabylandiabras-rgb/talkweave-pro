import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";
import { assertZapiDeviceConnected } from "../_shared/zapi-device.ts";

const getZapiAckId = (payload: any) => {
  return payload?.messageId || payload?.zapiMessageId || payload?.zaapId || payload?.id || payload?.key?.id || payload?.message?.id || null;
};

const getDocumentExtension = (fileUrl: string, fileName?: string) => {
  const source = String(fileName || fileUrl || '')
    .split('?')[0]
    .split('#')[0];
  const ext = source.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  return ext && ext !== source.toLowerCase() ? ext : 'pdf';
};

const hasExplicitZapiError = (payload: any) => {
  return payload?.error || payload?.erro || (payload?.success === false ? payload?.message : null) || null;
};

const isZapiSendConfirmed = (payload: any) => {
  const ackId = getZapiAckId(payload);
  return Boolean(ackId);
};

const parseZapiResponse = async (response: Response, phone: string, instanceId: string, label: string) => {
  const data = await response.json().catch(() => ({}));
  const explicitError = hasExplicitZapiError(data);
  const confirmed = isZapiSendConfirmed(data);

  console.log(
    `📬 Z-API response [${label}] for ${phone} (instance ${instanceId}): status=${response.status}, confirmed=${confirmed}, ack=${getZapiAckId(data) || 'none'}, body=${JSON.stringify(data).substring(0, 300)}`
  );

  if (!response.ok || explicitError || !confirmed) {
    throw new Response(
      JSON.stringify({
        error: explicitError || `Z-API did not confirm message acceptance (${label})`,
        details: data,
      }),
      {
        status: response.ok ? 502 : response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return data;
};

const pickPreferredInstance = (instances: any[] | null | undefined) => {
  if (!Array.isArray(instances) || instances.length === 0) return null;
  return [...instances].sort((a, b) => {
    if (Boolean(a.is_default) !== Boolean(b.is_default)) return a.is_default ? -1 : 1;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  })[0] || null;
};

const findUserInstance = async (adminClient: any, userId: string, instanceRef: string) => {
  if (!instanceRef) return null;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = UUID_RE.test(instanceRef);
  const baseSelect = 'id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key, is_default, created_at';

  // Build filter safely: only include id.eq when ref is a valid UUID, otherwise Postgres throws 22P02.
  const orFilter = isUuid
    ? `zapi_instance_id.eq.${instanceRef},id.eq.${instanceRef}`
    : `zapi_instance_id.eq.${instanceRef}`;

  const { data, error } = await adminClient
    .from('zapi_instances')
    .select(baseSelect)
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(orFilter);

  if (error) {
    console.error(`❌ Failed to resolve instance ${instanceRef}:`, error);
    // Fallback: try matching by zapi_instance_id only (string col, no UUID cast)
    const { data: fallback, error: fbError } = await adminClient
      .from('zapi_instances')
      .select(baseSelect)
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('zapi_instance_id', instanceRef);
    if (fbError) {
      console.error(`❌ Fallback resolve failed for ${instanceRef}:`, fbError);
      return null;
    }
    return pickPreferredInstance(fallback);
  }

  return pickPreferredInstance(data);
};

const findPreferredStandardInstance = async (adminClient: any, userId: string) => {
  const { data, error } = await adminClient
    .from('zapi_instances')
    .select('id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, is_default, created_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or('api_provider.is.null,api_provider.eq.zapi')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('⚠️ Falha ao buscar conexão padrão para envio:', error);
    return null;
  }

  return data || null;
};

const logProviderSend = async (
  adminClient: any,
   params: {
     userId: string;
     provider: 'zapi';
     instanceId?: string | null;
     phone?: string | null;
     endpoint?: string | null;
     status: 'success' | 'error';
     httpStatus?: number | null;
     errorMessage?: string | null;
     durationMs?: number | null;
     payloadSummary?: Record<string, unknown>;
   }
 ) => {
  try {
    await adminClient.from('provider_send_logs').insert({
      user_id: params.userId,
      provider: params.provider,
      instance_id: params.instanceId || null,
      phone: params.phone || null,
      endpoint: params.endpoint || null,
      status: params.status,
      http_status: params.httpStatus ?? null,
      error_message: params.errorMessage || null,
      duration_ms: params.durationMs ?? null,
      payload_summary: params.payloadSummary || {},
    });
  } catch (e) {
    console.error('⚠️ Falha ao gravar provider_send_logs:', e);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const payloadRaw = await req.json();
    const {
      phone, // can be a string or array of strings for multiple contacts
      message,
      mediaUrl,
      mediaType,
      instanceId: requestedInstanceId,
      title,
      footer,
      buttonActions,
      buttonList,
      optionList,
      forceReplyButtons,
      viewOnce,
      isPtv,
      specialType,
      specialPayload,
      carouselCards,
      templateId,
      preferStandardConnection,
      mentionAll,
      catalogId,
      productId,
    } = payloadRaw;
    const replyMessageId = payloadRaw.messageId || payloadRaw.replyMessageId || null;

    const mentionFlag = (p: string) => {
      const isGroup = typeof p === 'string' && (p.includes('-group') || p.includes('@g.us'));
      return (mentionAll && isGroup) ? { mentionAll: true } : {};
    };
      
    console.log(`📨 Envio solicitado — phone: ${phone}, requestedInstanceId: ${requestedInstanceId || 'nenhum'}, mediaType: ${mediaType || 'none'}, isPtv: ${isPtv}, viewOnce: ${viewOnce}`);

    const hasInteractivePayload =
      (Array.isArray(buttonActions) && buttonActions.length > 0) ||
      (buttonList?.buttons && Array.isArray(buttonList.buttons) && buttonList.buttons.length > 0) ||
      (optionList?.options && Array.isArray(optionList.options) && optionList.options.length > 0) ||
      (Array.isArray(carouselCards) && carouselCards.length > 0);

    const hasSpecialPayload = !!specialType && !!specialPayload;

    const phones = Array.isArray(phone) ? phone : [phone];
    const isMultiple = Array.isArray(phone) && phone.length > 1;

    if (!phone || (Array.isArray(phone) && phone.length === 0) || (!message && !mediaUrl && !hasInteractivePayload && !hasSpecialPayload)) {
      return new Response(
        JSON.stringify({ error: 'Phone and message, mediaUrl, or interactive payload are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

     const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
     const adminClient = createClient(supabaseUrl, supabaseServiceKey);
     let { instanceId, token, clientToken } = credentials;
 
     // Detect group phones
     const isGroupPhone = (phone.includes('-group') || phone.includes('@g.us') || /^12036\d{13,}$/.test(phone.replace(/\D/g, ''))) && !phone.includes('@newsletter') && !phone.includes('-community');
     const isCommunityPhone = phone.includes('-community');
     const isChannelPhone = phone.includes('@newsletter');

    // SERVER-SIDE GROUP INSTANCE RESOLUTION
    // For group phones, verify the correct instance by checking which instance
    // actually receives messages from this group. Z-API returns 200 even when
    // sending from an instance that doesn't have the group, causing silent failures.
    if (isGroupPhone) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      // Normalize group ID to find matches in message_logs
      const numericGroupId = phone.replace(/[@\-].*$/, '').replace(/\D/g, '');
      const groupVariants = [
        `${numericGroupId}-group`,
        `${numericGroupId}@g.us`,
        numericGroupId,
      ];

      // Find the instance that has RECEIVED messages from this group (inbound = real ownership)
      const { data: groupLogs } = await adminClient
        .from('message_logs')
        .select('instance_id')
        .in('phone', groupVariants)
        .not('instance_id', 'is', null)
        .is('keyword_matched', null)  // null keyword = organic inbound, not manual/flow
        .eq('user_id', credentials.userId)
        .order('timestamp', { ascending: false })
        .limit(1);

      // Fallback: also check for any inbound message (non-manual) from the group
      let resolvedGroupInstanceId = groupLogs?.[0]?.instance_id || null;

      if (!resolvedGroupInstanceId) {
        const { data: groupLogs2 } = await adminClient
          .from('message_logs')
          .select('instance_id, keyword_matched')
          .in('phone', groupVariants)
          .not('instance_id', 'is', null)
          .not('message_received', 'is', null)
          .eq('user_id', credentials.userId)
          .order('timestamp', { ascending: false })
          .limit(5);

        // Pick the first log that isn't a manual send
        const inboundLog = groupLogs2?.find(l => l.keyword_matched !== '__manual_send__');
        resolvedGroupInstanceId = inboundLog?.instance_id || null;
      }

      if (resolvedGroupInstanceId && resolvedGroupInstanceId !== instanceId) {
        // Switch to the correct instance
        const correctInstance = await findUserInstance(adminClient, credentials.userId, resolvedGroupInstanceId);

        if (correctInstance) {
          console.log(`🔄 GROUP INSTANCE OVERRIDE: switching from ${instanceId} to ${correctInstance.zapi_instance_id} (verified from inbound logs)`);
          instanceId = correctInstance.zapi_instance_id;
          token = correctInstance.zapi_token;
          clientToken = correctInstance.zapi_client_token;
        } else {
          console.log(`⚠️ Group instance ${resolvedGroupInstanceId} found in logs but not active, keeping ${instanceId}`);
        }
      } else if (resolvedGroupInstanceId) {
        console.log(`✅ Group instance confirmed: ${instanceId} matches inbound logs`);
      } else {
        console.log(`⚠️ No inbound logs found for group ${numericGroupId}, using instance ${instanceId} as-is`);
      }
    }

    // Omit physical device check to allow sending regardless of reported status
    // as some Z-API instances report "disconnected" while still capable of sending
    console.log(`ℹ️ Bypassing physical device connectivity check for instance ${instanceId}`);

    let resolvedPhone = phone;
    // Z-API expects group IDs with "-group" suffix (e.g. 120363019502650977-group)
    // See: https://developer.z-api.io/group/introduction
    if (isGroupPhone && !phone.includes('@lid') && !isCommunityPhone && !isChannelPhone) {
      const numericId = phone.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '');
      resolvedPhone = numericId ? `${numericId}-group` : phone;
      if (resolvedPhone !== phone) {
        console.log(`📌 Normalized group phone: ${phone} → ${resolvedPhone}`);
      }
    }

    if (phone.includes('@lid')) {
      console.log(`📌 Phone is LID format: ${phone} — resolving to clean number`);
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: mapping } = await adminClient
        .from('message_logs')
        .select('phone, instance_id')
        .eq('keyword_matched', '__lid_map__')
        .eq('message_received', phone)
        .eq('user_id', credentials.userId)
        .limit(1)
        .maybeSingle();

      if (mapping) {
        console.log(`✅ Resolved LID: ${phone} → ${mapping.phone}`);
        resolvedPhone = mapping.phone;
        
        if (mapping.instance_id) {
            const lidInstance = await findUserInstance(adminClient, credentials.userId, mapping.instance_id);

            if (lidInstance) {
              console.log(`✅ Using mapped instance ${lidInstance.zapi_instance_id} for resolved LID`);
              instanceId = lidInstance.zapi_instance_id;
              token = lidInstance.zapi_token;
              clientToken = lidInstance.zapi_client_token;
          }
        }
      } else {
        console.log(`⚠️ No LID mapping found for ${phone}, sending as-is`);
      }
    }

    let zapiResponse: Response | null = null;
    let zapiData: any = null;
    let logMessage = message || '';

    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
    const sendZapi = async (endpoint: string, body: any, label: string) => {
      console.log(`📤 Z-API [${label}] to ${endpoint}:`, JSON.stringify(body).substring(0, 500));
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify(body),
      });
      const data = await parseZapiResponse(response, resolvedPhone, instanceId, label);
      // Update global zapiResponse for logging
      zapiResponse = response;
      return data;
    };

    const sendZapiMedia = async (url: string, type: string, text?: string) => {
      let endpoint = '/send-text';
      const payload: any = { phone: resolvedPhone, ...mentionFlag(resolvedPhone) };
      if (replyMessageId) payload.messageId = replyMessageId;

      if (type === 'image') {
        endpoint = '/send-image';
        payload.image = url;
        payload.caption = text || '';
      } else if (type === 'video') {
        endpoint = isPtv ? '/send-ptv' : '/send-video';
        if (isPtv) {
          payload.ptv = url;
        } else {
          payload.video = url;
          payload.caption = text || '';
          if (viewOnce) payload.viewOnce = true;
        }
      } else if (type === 'audio') {
        endpoint = '/send-audio';
        payload.audio = url;
        payload.waveform = true;
       } else if (type === 'sticker') {
         endpoint = '/send-sticker';
         payload.sticker = url;
       } else if (type === 'gif') {
         endpoint = '/send-gif';
         payload.gif = url;
         payload.caption = text || '';
       } else if (type === 'product-catalog') {
       } else if (type === 'contact') {
         endpoint = '/send-contact';
         payload.contactName = specialPayload?.contactName || '';
         payload.contactPhone = specialPayload?.contactPhone || '';
         payload.contactBusinessDescription = specialPayload?.contactBusinessDescription || '';
         endpoint = '/send-message-catalog';
         payload.catalogId = specialPayload?.catalogId || catalogId || '';
         payload.productId = specialPayload?.productId || productId || '';
         payload.body = message || '';
         payload.footer = footer || '';
       } else {
         const ext = getDocumentExtension(url, text);
         endpoint = `/send-document/${ext}`;
         payload.document = url;
         payload.fileName = text || `arquivo.${ext}`;
       }

       return sendZapi(endpoint, payload, `media-${type}`);
     };

    // Define common button logic to be used if needed
    const smartSendButtons = async () => {
      const rawButtons = [
        ...(buttonActions || []),
        ...(buttonList?.buttons || []).map((b: any) => ({ ...b, type: 'REPLY' }))
      ];

      const normalized = rawButtons.slice(0, 10).map((b: any, index: number) => {
        let type = String(b?.type || b?.buttonType || 'REPLY').toUpperCase();
        let url = b.url || b.value || b.urlValue || b.link || b.website;
        let phone = b.phone || b.phoneNumber || b.value || b.phoneValue;
        let label = String(b?.label || b?.text || b?.buttonText || `Botão ${index + 1}`).trim().slice(0, 25);
        
        if (type === 'COPY' && url) {
          type = 'URL';
          url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(url)}`;
        }
        if (type === 'QUICK_REPLY') type = 'REPLY';

        return { id: b.id || String(index + 1), type, label, url, phone };
      }).filter(b => {
        if (!['REPLY', 'URL', 'CALL'].includes(b.type)) return false;
        if (b.type === 'URL' && !b.url) return false;
        if (b.type === 'CALL' && !b.phone) return false;
        if (!b.label) return false;
        return true;
      });

      const buttons = normalized.slice(0, 3);
      if (buttons.length === 0) {
        if (mediaUrl && mediaType) return sendZapiMedia(mediaUrl, mediaType, message);
        return sendZapi('/send-text', { phone: resolvedPhone, message: message || '' }, 'text-fallback');
      }

      const hasActionButtons = buttons.some(b => b.type === 'URL' || b.type === 'CALL');

      // Case 1: Media + Action Buttons -> Prefer /send-button-actions-image or video if possible, else carousel
      if (mediaUrl && (hasActionButtons || mediaType === 'video')) {
        const payload: any = {
          phone: resolvedPhone,
          message: message || 'Escolha uma opção:',
          ...(title ? { title } : {}),
          ...(footer ? { footer } : {}),
          ...mentionFlag(resolvedPhone),
          buttonActions: buttons.map(b => ({
            id: b.id,
            type: b.type,
            label: b.label,
            ...(b.type === 'URL' ? { url: b.url } : {}),
            ...(b.type === 'CALL' ? { phone: b.phone } : {}),
          }))
        };

        if (mediaType === 'image') {
          payload.image = mediaUrl;
          return sendZapi('/send-button-actions-image', payload, 'buttons-actions-image');
        } else {
          // Z-API não possui endpoint /send-button-actions-video.
          // Enviamos o vídeo separado e depois os botões em /send-button-actions.
          await sendZapiMedia(mediaUrl, mediaType || 'video', '');
          const { image: _img, video: _vid, ...rest } = payload;
          return sendZapi('/send-button-actions', rest, 'buttons-actions-after-video');
        }
      }

      // Case 2: Media + Only Reply Buttons -> Use /send-button-list-image or video
      if (mediaUrl && !hasActionButtons) {
        const endpoint = mediaType === 'image' ? '/send-button-list-image' : '/send-button-list-video';
        const payload: any = {
          phone: resolvedPhone,
          message: message || 'Escolha uma opção:',
          ...mentionFlag(resolvedPhone),
          buttonList: {
            buttons: buttons.map(b => ({ id: b.id, label: b.label }))
          }
        };
        if (mediaType === 'image') payload.buttonList.image = mediaUrl;
        else payload.buttonList.video = mediaUrl;
        return sendZapi(endpoint, payload, 'buttons-media-reply');
      }

      // Case 3: No Media + Any Buttons -> Use /send-button-actions if any action btns present
      if (!mediaUrl && hasActionButtons) {
        return sendZapi('/send-button-actions', {
          phone: resolvedPhone,
          message: message || 'Escolha uma opção:',
          title,
          footer,
          ...mentionFlag(resolvedPhone),
          buttonActions: buttons.map(b => ({
            id: b.id,
            type: b.type,
            label: b.label,
            url: b.url,
            phone: b.phone
          }))
        }, 'buttons-actions-text');
      }

      // Case 4: No Media + Only Reply Buttons -> Use /send-button-list
      if (!mediaUrl && !hasActionButtons) {
        return sendZapi('/send-button-list', {
          phone: resolvedPhone,
          message: message || 'Escolha uma opção:',
          ...mentionFlag(resolvedPhone),
          buttonList: {
            buttons: buttons.map(b => ({ id: b.id, label: b.label }))
          }
        }, 'buttons-reply-text');
      }

      return sendZapi('/send-text', { phone: resolvedPhone, message: message || '', ...mentionFlag(resolvedPhone) }, 'buttons-final-fallback');
    };

    // OTP support
    if (payloadRaw.otpCode && payloadRaw.otpExpiration) {
      zapiData = await sendZapi('/send-button-otp', {
        phone: resolvedPhone,
        message: message || "Seu código de verificação é",
        code: payloadRaw.otpCode,
        expirationInSeconds: payloadRaw.otpExpiration,
        footer: footer || ""
      }, 'otp');
      logMessage = `🔐 Código OTP: ${payloadRaw.otpCode}`;
    } else if ((specialType === 'pix' || specialType === 'gateway-billing' || specialType === 'request-payment' || specialType === 'pagamento') && specialPayload) {
      const amountReais = Number(String(specialPayload.amount || specialPayload.pixAmount || specialPayload.paymentAmount || '0.00').replace(',', '.'));
      const amountCents = Math.round(amountReais * 100);
      const description = String(specialPayload.description || specialPayload.text || specialPayload.pixDescription || specialPayload.paymentDescription || message || 'Pagamento').trim();
      const isGateway = specialPayload.pixSource === 'gateway' || specialPayload.paymentSource === 'gateway' || specialType === 'gateway-billing';

      let brCode = '';
      if (isGateway && amountCents > 0) {
        try {
          const chargeRes = await fetch(`${supabaseUrl}/functions/v1/gateway-flow-charge`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              userId: credentials.userId,
              amount: amountCents,
              description,
              customerPhone: resolvedPhone,
            }),
          });
          const chargeData = await chargeRes.json();
          brCode = chargeData?.brCode || "";
        } catch (e) {
          console.error("❌ [Gateway SendMessage] Failed to generate charge:", e);
        }
      }

      if (brCode) {
        // Envia como Copia e Cola (OTP) para melhor UX
        zapiResponse = await fetch(`${baseUrl}/send-button-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({
            phone: resolvedPhone,
            message: description,
            code: brCode,
            footer: 'Clique abaixo para copiar o código PIX'
          }),
        });
        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'gateway-billing-otp');
      } else {
      const pixPayload: any = {
        phone: resolvedPhone,
          pixKey: specialPayload.pixKey || specialPayload.paymentReceiver || '',
        type: String(specialPayload.pixKeyType || 'cpf').toUpperCase(),
        merchantName: (specialPayload.merchantName || specialPayload.recipientName || '').slice(0, 25),
      };
        if (amountReais) pixPayload.value = amountReais;
      if (specialPayload.city) pixPayload.city = specialPayload.city.slice(0, 15);
        if (description) pixPayload.description = description;

      // Use /send-button-pix if buttons are present, otherwise /send-payment-pix
      if (Array.isArray(buttonActions) && buttonActions.length > 0) {
        const btns = (buttonActions || []).slice(0, 3).map((b: any, idx: number) => ({
          id: b.id || String(idx + 1),
          label: (b.label || b.text || `Botão ${idx + 1}`).slice(0, 25)
        }));
        pixPayload.message = message || 'Escaneie o QR Code para pagar';
        pixPayload.buttonActions = btns;
        zapiData = await sendZapi('/send-button-pix', pixPayload, 'button-pix');
      } else {
        zapiData = await sendZapi('/send-payment-pix', pixPayload, 'pix');
      }
        logMessage = `💰 PIX ${pixPayload.merchantName || ''}`.trim();
      }
    } else if (specialType === 'order-status' || specialType === 'status_pedido' || specialType === 'order_status') {
      zapiResponse = await fetch(`${baseUrl}/order-status-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          orderStatus: specialPayload.orderStatus || 'PROCESSING',
          referenceId: specialPayload.referenceId || '',
          order: specialPayload.order || {},
        }),
      });
      logMessage = `📦 Status Pedido: ${specialPayload.orderStatus}`;
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'order-status');
    } else if (specialType === 'order-payment' || specialType === 'pagamento_pedido' || specialType === 'order_payment') {
      zapiResponse = await fetch(`${baseUrl}/order-status-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          paymentStatus: specialPayload.paymentStatus || 'PAID',
          referenceId: specialPayload.referenceId || '',
          order: specialPayload.order || {},
        }),
      });
      logMessage = `💳 Pagamento Pedido: ${specialPayload.paymentStatus}`;
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'order-payment');
    } else if (specialType === 'localizacao' && specialPayload) {
      const lat = Number(String(specialPayload.latitude ?? '').replace(',', '.')) || 0;
      const lng = Number(String(specialPayload.longitude ?? '').replace(',', '.')) || 0;
      const title = String(specialPayload.title || 'Localização');
      const address = String(specialPayload.address || '');
      const fallbackText = [title, address, `https://maps.google.com/?q=${lat},${lng}`].filter(Boolean).join('\n');
      logMessage = `📍 ${title}`;

      if (!lat || !lng) {
        zapiData = await sendZapi('/send-text', { phone: resolvedPhone, message: fallbackText }, 'location-fallback-empty');
      } else {
        try {
          zapiResponse = await fetch(`${baseUrl}/send-location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
            body: JSON.stringify({ phone: resolvedPhone, latitude: lat, longitude: lng, title, address }),
          });
          zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'location');
        } catch (error) {
          console.error('⚠️ Falha ao enviar localização nativa; enviando link do mapa:', error);
          zapiData = await sendZapi('/send-text', { phone: resolvedPhone, message: fallbackText }, 'location-fallback-link');
        }
      }
    } else if (specialType === 'contato' && specialPayload) {
      const contactPhoneClean = String(specialPayload.contactPhone || '').replace(/\D/g, '');
      zapiResponse = await fetch(`${baseUrl}/send-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          contactName: specialPayload.contactName || '',
          contactPhone: contactPhoneClean,
          contactBusinessDescription: specialPayload.description || '',
        }),
      });
      logMessage = `👤 ${specialPayload.contactName || 'Contato'}`;
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'contact');
    } else if (specialType === 'copia_cola' && specialPayload) {
      // Cópia e cola — Z-API /send-text com botão COPY (send-button-actions)
      const copyText = String(specialPayload.copyText || specialPayload.text || message || '').trim();
      const copyLabel = String(specialPayload.buttonLabel || 'Copiar').slice(0, 25);
      const headerText = String(specialPayload.message || message || '').trim();
      if (!copyText) {
        return new Response(
          JSON.stringify({ error: 'Texto para copiar é obrigatório (copia e cola)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      zapiResponse = await fetch(`${baseUrl}/send-button-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          message: headerText || copyLabel,
          ...(footer ? { footer } : {}),
          buttonActions: [
            { id: '1', type: 'COPY', label: copyLabel, copyCode: copyText },
          ],
          ...mentionFlag(resolvedPhone),
        }),
      });
      logMessage = `📋 ${copyLabel}`;
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'copy-paste');
      } else if (specialType === 'status_action' && specialPayload) {
        const statusKind = String(specialPayload.statusType || specialPayload.kind || 'text').toLowerCase();
        let endpoint = '/send-text-status';
        let payload: Record<string, unknown> = {};
        if (statusKind === 'text') {
          endpoint = '/send-text-status';
          payload = { message: specialPayload.text || message || '', backgroundColor: specialPayload.backgroundColor || "#000000", font: specialPayload.font || 1 };
        } else if (statusKind === 'image') {
          endpoint = '/send-image-status';
          payload = { image: specialPayload.image, caption: specialPayload.caption || specialPayload.text || message || '' };
        } else if (statusKind === 'video') {
          endpoint = '/send-video-status';
          payload = { video: specialPayload.video, caption: specialPayload.caption || specialPayload.text || message || '' };
        } else if (statusKind === 'reply-text') {
          endpoint = '/reply-status-text';
          payload = { phone: specialPayload.phone || resolvedPhone, msgId: specialPayload.statusId, message: specialPayload.message || message || '' };
        } else if (statusKind === 'reply-gif') {
          endpoint = '/reply-status-gif';
          payload = { phone: specialPayload.phone || resolvedPhone, msgId: specialPayload.statusId, gif: specialPayload.gif || mediaUrl };
        } else if (statusKind === 'reply-sticker') {
          endpoint = '/reply-status-sticker';
          payload = { phone: specialPayload.phone || resolvedPhone, msgId: specialPayload.statusId, sticker: specialPayload.sticker || mediaUrl };
        }
        zapiResponse = await fetch(`${baseUrl}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken }, body: JSON.stringify(payload) });
        logMessage = `📰 Status (${statusKind})`;
        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, `status-${statusKind}`);
      } else if (specialType === 'location_button' && specialPayload) {
        const lat = Number(String(specialPayload.latitude ?? '').replace(',', '.')) || 0;
        const lng = Number(String(specialPayload.longitude ?? '').replace(',', '.')) || 0;
        const title = String(specialPayload.title || 'Localização');
        const address = String(specialPayload.address || '');
        const buttonLabel = String(specialPayload.buttonLabel || 'Abrir no mapa').slice(0, 25);
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        await fetch(`${baseUrl}/send-location`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken }, body: JSON.stringify({ phone: resolvedPhone, latitude: lat, longitude: lng, title, address }) });
        zapiResponse = await fetch(`${baseUrl}/send-button-actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken }, body: JSON.stringify({ phone: resolvedPhone, message: message || title, ...(footer ? { footer } : {}), buttonActions: [{ id: '1', type: 'URL', label: buttonLabel, url: mapsUrl }] }) });
        logMessage = `📍 ${title} (com botão)`;
        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'location-button');
      } else if (specialType === 'request_payment' && specialPayload) {
        const pixBody: Record<string, unknown> = { phone: resolvedPhone, pixKey: specialPayload.pixKey || '', type: String(specialPayload.pixKeyType || 'cpf').toUpperCase(), merchantName: specialPayload.merchantName || specialPayload.recipientName || '' };
        if (specialPayload.amount) pixBody.value = Number(String(specialPayload.amount).replace(',', '.')) || 0;
        if (specialPayload.city) pixBody.city = specialPayload.city;
        if (specialPayload.description) pixBody.description = specialPayload.description;
        zapiResponse = await fetch(`${baseUrl}/send-payment-pix`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken }, body: JSON.stringify(pixBody) });
        logMessage = `💳 Solicitação de pagamento ${specialPayload.amount ? `R$ ${specialPayload.amount}` : ''}`.trim();
        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'request-payment');
    } else if (Array.isArray(carouselCards) && carouselCards.length > 0) {
      const cards = carouselCards.map((card: any) => {
        const cardText = [card.title, card.description].filter(v => v && String(v).trim() !== '').join('\n\n');
        const c: any = { text: cardText || card.text || '' };
        if (card.image) c.image = card.image;
        if (Array.isArray(card.buttons)) {
          c.buttons = card.buttons.slice(0, 3).map((b: any, idx: number) => {
            const t = String(b.type || 'REPLY').toUpperCase();
            const btn: any = { id: b.id || String(idx + 1), type: t, label: b.text || b.label || `Botão ${idx + 1}` };
            if (t === 'URL') btn.url = b.value || b.url;
            if (t === 'CALL') btn.phone = b.value || b.phone;
            return btn;
          });
        }
        return c;
      });
      zapiData = await sendZapi('/send-carousel', { 
        phone: resolvedPhone, 
        message: message || '', 
        carousel: cards,
        ...mentionFlag(resolvedPhone)
      }, 'carousel');
      logMessage = logMessage || '🎠 Carrossel';
    } else if ((Array.isArray(buttonActions) && buttonActions.length > 0) || (buttonList?.buttons && buttonList.buttons.length > 0)) {
      zapiData = await smartSendButtons();
      logMessage = logMessage || '🔘 Botões';
    } else if (optionList?.options && Array.isArray(optionList.options) && optionList.options.length > 0) {
      zapiResponse = await fetch(`${baseUrl}/send-option-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          message: message || optionList.title || 'Selecione uma opção:',
          optionList,
          ...mentionFlag(resolvedPhone),
        }),
      });
      logMessage = logMessage || '📋 Lista de opções';
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'option-list');
     } else if (mediaType === 'product' && specialPayload?.productId) {
       zapiResponse = await fetch(`${baseUrl}/send-product`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
         body: JSON.stringify({
           phone: resolvedPhone,
           message: message || '',
           productId: specialPayload.productId,
           ...mentionFlag(resolvedPhone),
         }),
       });
       logMessage = logMessage || `📦 Produto: ${specialPayload.productId}`;
       zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'product');
     } else if (mediaUrl && mediaType) {
      zapiData = await sendZapiMedia(mediaUrl, mediaType, message);
      const emojiMap: any = { audio: '🎤', image: '📷', video: '🎬', sticker: '🖼️', document: '📄' };
      logMessage = logMessage || `${emojiMap[mediaType] || '📎'} Mídia`;
    } else if (isMultiple) {
      zapiResponse = await fetch(`${baseUrl}/send-message-multiple-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({ phones: phones, message }),
      });
      logMessage = message || '';
      zapiData = await parseZapiResponse(zapiResponse, phones[0], instanceId, 'multiple-contacts');
    } else {
      zapiResponse = await fetch(`${baseUrl}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({ phone: resolvedPhone, message, ...(replyMessageId ? { messageId: replyMessageId } : {}), ...mentionFlag(resolvedPhone) }),
      });
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'text');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let logContent = logMessage;
    if (templateId) {
      logContent = `[modelo:${templateId}]`;
    }
    if (mediaUrl && mediaType && !logContent?.includes('[media:')) {
      const mediaTag = `[media:${mediaType}:${mediaUrl}]`;
      logContent = logContent ? `${mediaTag}\n${logContent}` : mediaTag;
    }

    if (Array.isArray(buttonActions) && buttonActions.length > 0 && !logContent?.includes('[Botões:')) {
      const buttonLabels = buttonActions.map((b: any) => String(b.label || b.text || '').trim()).filter(Boolean);
      if (buttonLabels.length > 0) {
        logContent = logContent ? `${logContent}\n\n[Botões: ${buttonLabels.join(' | ')}]` : `[Botões: ${buttonLabels.join(' | ')}]`;
      }
    }

    await supabase.from('message_logs').insert({
      phone: resolvedPhone,
      message_received: null,
      response_sent: logContent,
      keyword_matched: '__manual_send__',
      timestamp: new Date().toISOString(),
      user_id: credentials.userId,
      instance_id: instanceId,
    });

    await logProviderSend(adminClient, {
      userId: credentials.userId,
      provider: 'zapi',
      instanceId,
      phone: resolvedPhone,
      endpoint: zapiResponse?.url ? new URL(zapiResponse.url).pathname.split('/').pop() : 'send',
      status: 'success',
      httpStatus: zapiResponse?.status ?? null,
      payloadSummary: { mediaType: mediaType || null, hasButtons: Array.isArray(buttonActions) && buttonActions.length > 0 },
    });

    return new Response(
      JSON.stringify({ success: true, data: zapiData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
        if (auth) {
          const { data: { user } } = await adminClient.auth.getUser(auth);
          if (user) {
            const errMsg = error instanceof Response
              ? `HTTP ${error.status}`
              : (error instanceof Error ? error.message : 'Unknown error');
            await logProviderSend(adminClient, {
              userId: user.id,
              provider: 'zapi',
              status: 'error',
              errorMessage: errMsg,
            });
          }
        }
      }
    } catch (_) { /* swallow */ }

    if (error instanceof Response) {
      return error;
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})