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

    const {
      phone,
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
    } = await req.json()

    console.log(`📨 Envio solicitado — phone: ${phone}, requestedInstanceId: ${requestedInstanceId || 'nenhum'}, mediaType: ${mediaType || 'none'}, isPtv: ${isPtv}, viewOnce: ${viewOnce}`);

    const hasInteractivePayload =
      (Array.isArray(buttonActions) && buttonActions.length > 0) ||
      (buttonList?.buttons && Array.isArray(buttonList.buttons) && buttonList.buttons.length > 0) ||
      (optionList?.options && Array.isArray(optionList.options) && optionList.options.length > 0) ||
      (Array.isArray(carouselCards) && carouselCards.length > 0);

    const hasSpecialPayload = !!specialType && !!specialPayload;

    if (!phone || (!message && !mediaUrl && !hasInteractivePayload && !hasSpecialPayload)) {
      return new Response(
        JSON.stringify({ error: 'Phone and message, mediaUrl, or interactive payload are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

     const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
     const adminClient = createClient(supabaseUrl, supabaseServiceKey);
     let { instanceId, token, clientToken } = credentials;
 
     // Detect group phones
     const isGroupPhone = phone.includes('-group') || phone.includes('@g.us') || /^12036\d{13,}$/.test(phone.replace(/\D/g, ''));

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

    const deviceStatus = await assertZapiDeviceConnected(instanceId, token, clientToken);
    if (!deviceStatus.ok || (deviceStatus.explicitlyDisconnected && !deviceStatus.connected)) {
      console.warn(
        `⚠️ Status pré-envio da instância ${instanceId} retornou indisponível, mas o envio será tentado para evitar bloqueio falso do provedor.`,
        JSON.stringify(deviceStatus.payload).substring(0, 300),
      );
    }

      let resolvedPhone = phone;
    // Z-API expects group IDs with "-group" suffix (e.g. 120363019502650977-group)
    // See: https://developer.z-api.io/group/introduction
    if (isGroupPhone && !phone.includes('@lid')) {
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
      let payload: any = { phone: resolvedPhone };

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
      } else {
        const ext = getDocumentExtension(url, text);
        endpoint = `/send-document/${ext}`;
        payload.document = url;
        payload.fileName = text || `arquivo.${ext}`;
      }
      return sendZapi(endpoint, payload, `media-${type}`);
    };

    // Define common button logic to be used if needed
    const handleButtons = async () => {
      // Normalizar botões
      const normalized = (buttonActions || []).slice(0, 10).map((b: any, index: number) => {
        let type = String(b?.type || b?.buttonType || 'REPLY').toUpperCase();
        let url = b.url || b.value || b.urlValue || b.link || b.website || b.url_value;
        let phone = b.phone || b.phoneNumber || b.value || b.phoneValue;
        let label = String(b?.label || b?.text || b?.buttonText || `Botão ${index + 1}`).trim().slice(0, 25);
        
        if (type === 'COPY' && url) {
          type = 'URL';
          url = `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${encodeURIComponent(url)}`;
        }

        return { id: b.id || String(index + 1), type, label, url, phone };
      }).filter(b => {
        if (!['REPLY', 'URL', 'CALL'].includes(b.type)) return false;
        if (b.type === 'URL' && !b.url) return false;
        if (b.type === 'CALL' && !b.phone) return false;
        if (!b.label) return false;
        return true;
      });

      const actionBtns = normalized.filter(b => b.type === 'URL' || b.type === 'CALL').slice(0, 3);
      const replyBtns = normalized.filter(b => b.type === 'REPLY').slice(0, 3);
      const groups = [];
      if (actionBtns.length > 0) groups.push({ kind: 'action', buttons: actionBtns });
      if (replyBtns.length > 0) groups.push({ kind: 'reply', buttons: replyBtns });

      console.log(`📤 Sending ${groups.length} button group(s) for ${resolvedPhone}`);

      // 1. Send button groups
      let lastRes = null;
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        // If media was already sent, don't repeat the message text if there are multiple groups?
        // Actually, Z-API requires a message. We'll use the original message.
        const payload: any = {
          phone: resolvedPhone,
          message: message || 'Escolha uma opção:',
          buttonActions: g.buttons,
        };
        if (title) payload.title = title;
        if (footer) payload.footer = footer;

        // Try to attach media to the first button group
        if (i === 0 && mediaUrl && mediaType) {
          if (mediaType === 'image') payload.image = mediaUrl;
          else if (mediaType === 'video') {
            payload.video = mediaUrl;
            if (viewOnce) payload.viewOnce = true;
          }
        }

        lastRes = await sendZapi('/send-button-actions', payload, `buttons-${g.kind}`);
        if (i < groups.length - 1) await new Promise(r => setTimeout(r, 1000));
      }

      // Fallback: If no buttons were actually valid but groups were empty, send at least the message/media
      if (groups.length === 0) {
        if (mediaUrl && mediaType) {
          return sendZapiMedia(mediaUrl, mediaType, message);
        } else {
          return sendZapi('/send-text', { phone: resolvedPhone, message: message || '' }, 'text-fallback');
        }
      }
      return lastRes;
    };

    if (specialType === 'pix' && specialPayload) {
      // Z-API: /send-payment-pix sends PIX charge with brcode
      const pixBody: Record<string, unknown> = {
        phone: resolvedPhone,
        pixKey: specialPayload.pixKey || '',
        type: String(specialPayload.pixKeyType || 'cpf').toUpperCase(),
        merchantName: specialPayload.merchantName || '',
      };
      if (specialPayload.amount) pixBody.value = Number(String(specialPayload.amount).replace(',', '.')) || 0;
      if (specialPayload.city) pixBody.city = specialPayload.city;
      if (specialPayload.description) pixBody.description = specialPayload.description;

      zapiResponse = await fetch(`${baseUrl}/send-payment-pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify(pixBody),
      });
      logMessage = `💰 PIX ${specialPayload.merchantName || ''}`.trim();
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'pix');
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
        }),
      });
      logMessage = `📋 ${copyLabel}`;
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'copy-paste');
     } else if (specialType === 'uaz_status' && specialPayload) {
       // Status Actions - Z-API
       const statusKind = String(specialPayload.statusType || specialPayload.kind || 'text').toLowerCase();
       let endpoint = '/send-text-status';
       let payload: Record<string, unknown> = {};

       if (statusKind === 'text') {
         endpoint = '/send-text-status';
         payload = {
           message: specialPayload.text || message || '',
           backgroundColor: specialPayload.backgroundColor || "#000000",
           font: specialPayload.font || 1
         };
       } else if (statusKind === 'image') {
         endpoint = '/send-image-status';
         payload = {
           image: specialPayload.image,
           caption: specialPayload.caption || specialPayload.text || message || ''
         };
       } else if (statusKind === 'video') {
         endpoint = '/send-video-status';
         payload = {
           video: specialPayload.video,
           caption: specialPayload.caption || specialPayload.text || message || ''
         };
       } else if (statusKind === 'reply-text') {
         endpoint = '/reply-status-text';
         payload = {
           phone: specialPayload.phone || resolvedPhone,
           msgId: specialPayload.statusId,
           message: specialPayload.message || message || ''
         };
       } else if (statusKind === 'reply-gif') {
         endpoint = '/reply-status-gif';
         payload = {
           phone: specialPayload.phone || resolvedPhone,
           msgId: specialPayload.statusId,
           gif: specialPayload.gif || mediaUrl
         };
       } else if (statusKind === 'reply-sticker') {
         endpoint = '/reply-status-sticker';
         payload = {
           phone: specialPayload.phone || resolvedPhone,
           msgId: specialPayload.statusId,
           sticker: specialPayload.sticker || mediaUrl
         };
       }

       console.log(`📤 Z-API ${endpoint} (status action)`);
       zapiResponse = await fetch(`${baseUrl}${endpoint}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
         body: JSON.stringify(payload),
       });
       logMessage = `📰 Status (${statusKind})`;
       zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, `status-${statusKind}`);
     } else if (specialType === 'uaz_location_button' && specialPayload) {
      // Botão com localização — Z-API não tem endpoint dedicado.
      // Estratégia: enviar localização + mensagem com botão URL para Google Maps.
      const lat = Number(String(specialPayload.latitude ?? '').replace(',', '.')) || 0;
      const lng = Number(String(specialPayload.longitude ?? '').replace(',', '.')) || 0;
      const title = String(specialPayload.title || 'Localização');
      const address = String(specialPayload.address || '');
      const buttonLabel = String(specialPayload.buttonLabel || 'Abrir no mapa').slice(0, 25);
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      // 1) localização
      await fetch(`${baseUrl}/send-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({ phone: resolvedPhone, latitude: lat, longitude: lng, title, address }),
      });
      // 2) botão URL com link do mapa
      zapiResponse = await fetch(`${baseUrl}/send-button-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          message: message || title,
          ...(footer ? { footer } : {}),
          buttonActions: [{ id: '1', type: 'URL', label: buttonLabel, url: mapsUrl }],
        }),
      });
      logMessage = `📍 ${title} (com botão)`;
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'location-button');
    } else if (specialType === 'uaz_request_payment' && specialPayload) {
      // Solicitar pagamento — Z-API roteia para /send-payment-pix (mesmo motor PIX cobrança).
      const pixBody: Record<string, unknown> = {
        phone: resolvedPhone,
        pixKey: specialPayload.pixKey || '',
        type: String(specialPayload.pixKeyType || 'cpf').toUpperCase(),
        merchantName: specialPayload.merchantName || specialPayload.recipientName || '',
      };
      if (specialPayload.amount) pixBody.value = Number(String(specialPayload.amount).replace(',', '.')) || 0;
      if (specialPayload.city) pixBody.city = specialPayload.city;
      if (specialPayload.description) pixBody.description = specialPayload.description;
      zapiResponse = await fetch(`${baseUrl}/send-payment-pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify(pixBody),
      });
      logMessage = `💳 Solicitação de pagamento ${specialPayload.amount ? `R$ ${specialPayload.amount}` : ''}`.trim();
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'request-payment');
    } else if (Array.isArray(buttonActions) && buttonActions.length > 0) {
      zapiData = await handleButtons();
      logMessage = logMessage || '🔘 Botões interativos';
    } else if (buttonList?.buttons && Array.isArray(buttonList.buttons) && buttonList.buttons.length > 0) {
      zapiResponse = await fetch(`${baseUrl}/send-button-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          message: message || 'Selecione uma opção:',
          buttonList: {
            buttons: buttonList.buttons.slice(0, 3).map((button: any, index: number) => ({
              id: button.id || String(index + 1),
              label: button.label,
            })),
          },
        }),
      });
      logMessage = logMessage || '🔘 Lista de botões';
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'button-list');
    } else if (optionList?.options && Array.isArray(optionList.options) && optionList.options.length > 0) {
      zapiResponse = await fetch(`${baseUrl}/send-option-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          message: message || optionList.title || 'Selecione uma opção:',
          optionList,
        }),
      });
      logMessage = logMessage || '📋 Lista de opções';
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'option-list');
    } else if (Array.isArray(carouselCards) && carouselCards.length > 0) {
      // Z-API: /send-carousel — cards com image, title, description, buttons[]
      const cards = carouselCards.map((card: any) => {
        // Z-API espera o campo `text` (não title/description). Concatenamos ambos.
        const cardText = [card.title, card.description]
          .filter((v: any) => v && String(v).trim() !== '')
          .join('\n\n');
        const c: any = {
          text: cardText || card.text || '',
        };
        if (card.image && String(card.image).trim() !== '') c.image = card.image;
        if (Array.isArray(card.buttons) && card.buttons.length > 0) {
          c.buttons = card.buttons.slice(0, 3).map((b: any, idx: number) => {
            const t = String(b.type || 'REPLY').toUpperCase();
            const btn: any = {
              id: b.id || String(idx + 1),
              type: t,
              label: b.text || b.label || `Botão ${idx + 1}`,
            };
            if (t === 'URL' && (b.value || b.url)) btn.url = b.value || b.url;
            if (t === 'CALL' && (b.value || b.phone)) btn.phone = b.value || b.phone;
            return btn;
          });
        }
        return c;
      });
      console.log(`📤 Z-API send-carousel for ${resolvedPhone}: ${cards.length} cards`, JSON.stringify(cards).slice(0, 500));
      zapiResponse = await fetch(`${baseUrl}/send-carousel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          message: message || '',
          carousel: cards,
        }),
      });
      logMessage = logMessage || '🎠 Carrossel';
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'carousel');
    } else if (mediaUrl && mediaType) {
      if (mediaType === 'audio') {
        zapiResponse = await fetch(`${baseUrl}/send-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, audio: mediaUrl, waveform: true }),
        });
        logMessage = logMessage || '🎤 Áudio';
        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'audio');
      } else if (mediaType === 'image') {
        zapiResponse = await fetch(`${baseUrl}/send-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, image: mediaUrl, caption: message || '' }),
        });
        logMessage = logMessage || '📷 Imagem';
        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'image');
      } else if (mediaType === 'video' && isPtv) {
        zapiResponse = await fetch(`${baseUrl}/send-ptv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, ptv: mediaUrl }),
        });
        logMessage = logMessage || '🎬 Vídeo Instantâneo';
        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'video');
      } else if (mediaType === 'video') {
        zapiResponse = await fetch(`${baseUrl}/send-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, video: mediaUrl, caption: message || '', ...(viewOnce ? { viewOnce: true } : {}) }),
        });
        logMessage = logMessage || '🎥 Vídeo';
        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'video');
      } else {
        const extension = getDocumentExtension(mediaUrl, message);
        zapiResponse = await fetch(`${baseUrl}/send-document/${extension}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, document: mediaUrl, fileName: message || `arquivo.${extension}`, caption: '' }),
        });
        logMessage = logMessage || '📎 Arquivo';
        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'document');
      }
    } else {
      zapiResponse = await fetch(`${baseUrl}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({ phone: resolvedPhone, message }),
      });
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'text');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let logContent = logMessage;
    if (templateId) {
      logContent = `[modelo:${templateId}]`;
    }
    if (mediaUrl && mediaType) {
      const mediaTag = `[media:${mediaType}:${mediaUrl}]`;
      logContent = logContent ? `${mediaTag}\n${logContent}` : mediaTag;
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