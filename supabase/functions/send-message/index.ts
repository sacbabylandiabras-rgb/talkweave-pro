import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";
import { assertZapiDeviceConnected } from "../_shared/zapi-device.ts";

const getZapiAckId = (payload: any) => {
  return payload?.messageId || payload?.zapiMessageId || payload?.zaapId || payload?.id || payload?.key?.id || payload?.message?.id || null;
};

const getUazapiAckId = (payload: any) => {
  return getZapiAckId(payload) || payload?.data?.messageId || payload?.data?.id || payload?.message?.key?.id || payload?.queueId || null;
};

const hasExplicitZapiError = (payload: any) => {
  return payload?.error || payload?.erro || (payload?.success === false ? payload?.message : null) || null;
};

const isZapiSendConfirmed = (payload: any) => {
  const ackId = getZapiAckId(payload);
  return Boolean(ackId);
};

const hasUazapiExplicitError = (payload: any) => {
  // Extrai a mensagem de erro mais legível possível.
  // Importante: se o provedor retornar apenas `error: true` (booleano), traduzimos
  // para uma mensagem clara em vez de gravar a string "true" no banco.
  const candidates = [
    payload?.error,
    payload?.erro,
    payload?.details?.error,
    payload?.details?.message,
    payload?.message,
    payload?.reason,
    payload?.response,
    payload?.success === false ? payload?.message : null,
  ];

  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'object') {
      const nested = (c as any).message || (c as any).error || (c as any).reason;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }

  // Provedor sinalizou falha sem mensagem (ex.: { error: true } ou { success: false })
  if (payload?.error === true || payload?.success === false) {
    return 'Número não está no WhatsApp ou recusou a mensagem (@lid/desconhecido).';
  }

  return null;
};

const isUazapiSendConfirmed = (payload: any) => {
  const ackId = getUazapiAckId(payload);
  const status = String(payload?.status || payload?.messageStatus || payload?.state || payload?.result || '').toLowerCase();

  return Boolean(
    ackId ||
    payload?.queued === true ||
    payload?.enqueued === true ||
    ['success', 'queued', 'queue', 'pending', 'processing', 'accepted'].includes(status)
  );
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

const parseUazapiResponse = async (response: Response, phone: string, instanceId: string, label: string) => {
  const raw = await response.text();
  let data: any = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = raw ? { message: raw } : {};
  }

  const explicitError = hasUazapiExplicitError(data);
  const confirmed = isUazapiSendConfirmed(data);

  console.log(
    `📬 UAZAPI response [${label}] for ${phone} (instance ${instanceId}): status=${response.status}, confirmed=${confirmed}, ack=${getUazapiAckId(data) || 'none'}, body=${JSON.stringify(data).substring(0, 300)}`
  );

  if (!response.ok || explicitError || !confirmed) {
    throw new Response(
      JSON.stringify({
        error: explicitError || `UAZAPI did not confirm message acceptance (${label})`,
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

const isUazapiProvider = (value: unknown) => String(value || '').trim().toLowerCase() === 'uazapi';

const logProviderSend = async (
  adminClient: any,
  params: {
    userId: string;
    provider: 'uazapi' | 'zapi';
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
      viewOnce,
      isPtv,
      specialType,
      specialPayload,
      carouselCards,
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
    let uazapiOverride: { apiUrl: string; apiToken: string } | null = null;

    // Detect group phones
    const isGroupPhone = phone.includes('-group') || phone.includes('@g.us') || /^12036\d{13,}$/.test(phone.replace(/\D/g, ''));

    if (requestedInstanceId) {
      const reqInstance = await findUserInstance(adminClient, credentials.userId, requestedInstanceId);

      if (reqInstance) {
        console.log(`📌 Using requested instance: ${reqInstance.zapi_instance_id} (requested: ${requestedInstanceId})`);
        instanceId = reqInstance.zapi_instance_id;
        token = reqInstance.zapi_token;
        clientToken = reqInstance.zapi_client_token;
        if (isUazapiProvider((reqInstance as any).api_provider)) {
          uazapiOverride = {
            apiUrl: ((reqInstance as any).evolution_api_url || '').replace(/\/+$/, ''),
            apiToken: (reqInstance as any).evolution_api_key || '',
          };
        }
      }
    } else {
      const defaultInstance = await findUserInstance(adminClient, credentials.userId, instanceId);

      if (defaultInstance) {
        instanceId = defaultInstance.zapi_instance_id;
        token = defaultInstance.zapi_token;
        clientToken = defaultInstance.zapi_client_token;
        if (isUazapiProvider((defaultInstance as any).api_provider)) {
          uazapiOverride = {
            apiUrl: ((defaultInstance as any).evolution_api_url || '').replace(/\/+$/, ''),
            apiToken: (defaultInstance as any).evolution_api_key || '',
          };
          console.log(`📌 Using default UAZAPI instance: ${instanceId}`);
        }
      }
    }

    // ===== UAZAPI ROUTING (short-circuit) =====
      if (uazapiOverride && uazapiOverride.apiUrl && uazapiOverride.apiToken) {
      const { apiUrl, apiToken } = uazapiOverride;
      const uazHeaders = { 'Content-Type': 'application/json', token: apiToken };
      const normalizedGroupId = isGroupPhone
        ? `${String(phone).replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '')}@g.us`
        : null;
      const isLidPhone = String(phone).includes('@lid');
      // Try to resolve @lid → real phone via message_logs mapping before falling back to LID id
      let resolvedLidNumber: string | null = null;
      if (isLidPhone && !isGroupPhone) {
        try {
          const adminClientLid = createClient(supabaseUrl, supabaseServiceKey);
          const { data: lidMap } = await adminClientLid
            .from('message_logs')
            .select('phone')
            .eq('keyword_matched', '__lid_map__')
            .eq('message_received', String(phone))
            .eq('user_id', credentials.userId)
            .limit(1)
            .maybeSingle();
          if (lidMap?.phone) {
            resolvedLidNumber = String(lidMap.phone).replace(/\D/g, '');
            console.log(`✅ UAZAPI resolved LID ${phone} → ${resolvedLidNumber}`);
          } else {
            console.log(`⚠️ UAZAPI no LID mapping for ${phone}, sending as @lid`);
          }
        } catch (e) {
          console.warn('UAZAPI LID lookup failed:', e);
        }
      }
      const cleanPhone = isLidPhone
        ? (resolvedLidNumber || String(phone)) // keep '<id>@lid' as-is when unresolved
        : String(phone).replace(/^\+/, '').replace(/[@\-].*$/, '').replace(/\D/g, '');
      const targetNumber = normalizedGroupId || cleanPhone;
      const logPhone = isGroupPhone
        ? `${String(phone).replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '')}-group`
        : cleanPhone;
      let endpoint = '/send/text';
      let body: Record<string, unknown> = { number: targetNumber, text: message || '' };

      // Special template types (PIX / Location / Contact) — UAZAPI dedicated endpoints
      if (specialType === 'pix' && specialPayload) {
        endpoint = '/send/text';
        const pixLines = [
          `💰 *Cobrança PIX*`,
          specialPayload.merchantName ? `Recebedor: ${specialPayload.merchantName}` : '',
          specialPayload.amount ? `Valor: R$ ${specialPayload.amount}` : '',
          `Chave (${specialPayload.pixKeyType || 'pix'}): ${specialPayload.pixKey || ''}`,
          specialPayload.description ? `\n${specialPayload.description}` : '',
        ].filter(Boolean).join('\n');
        body = { number: targetNumber, text: pixLines };
      } else if (specialType === 'localizacao' && specialPayload) {
        endpoint = '/send/location';
        body = {
          number: targetNumber,
          latitude: Number(String(specialPayload.latitude ?? '').replace(',', '.')) || 0,
          longitude: Number(String(specialPayload.longitude ?? '').replace(',', '.')) || 0,
          name: specialPayload.title || '',
          address: specialPayload.address || '',
        };
      } else if (specialType === 'contato' && specialPayload) {
        endpoint = '/send/contact';
        body = {
          number: targetNumber,
          fullName: specialPayload.contactName || '',
          phoneNumber: String(specialPayload.contactPhone || '').replace(/\D/g, ''),
        };
      }
      // Interactive buttons (REPLY/URL/CALL) — UAZAPI uses /send/menu with type=button
      else if (Array.isArray(buttonActions) && buttonActions.length > 0) {
        const choices = buttonActions.slice(0, 10).map((b: any, idx: number) => {
          const t = String(b?.type || 'REPLY').toUpperCase();
          const label = String(b?.label || `Botão ${idx + 1}`).trim();
          if (t === 'URL' && b?.url) return `${label}|${b.url}`;
          if (t === 'CALL' && b?.phone) return `${label}|${b.phone}`;
          return label;
        });
        endpoint = '/send/menu';
        body = {
          number: targetNumber,
          type: 'button',
          text: message || 'Selecione uma opção:',
          ...(footer ? { footerText: footer } : {}),
          choices,
        };
      } else if (buttonList?.buttons && Array.isArray(buttonList.buttons) && buttonList.buttons.length > 0) {
        const choices = buttonList.buttons.slice(0, 10).map((b: any, idx: number) =>
          String(b?.label || `Opção ${idx + 1}`).trim()
        );
        endpoint = '/send/menu';
        body = {
          number: targetNumber,
          type: 'button',
          text: message || 'Selecione uma opção:',
          ...(footer ? { footerText: footer } : {}),
          choices,
          ...(buttonList?.image ? { image: buttonList.image } : {}),
        };
      } else if (optionList?.options && Array.isArray(optionList.options) && optionList.options.length > 0) {
        const choices = optionList.options.slice(0, 10).map((opt: any, idx: number) =>
          String(opt?.title || opt?.label || opt?.description || `Opção ${idx + 1}`).trim()
        );
        endpoint = '/send/menu';
        body = {
          number: targetNumber,
          type: 'list',
          text: message || optionList?.title || 'Selecione uma opção:',
          ...(footer ? { footerText: footer } : {}),
          ...(optionList?.buttonLabel ? { buttonText: optionList.buttonLabel } : {}),
          choices,
        };
      } else if (Array.isArray(carouselCards) && carouselCards.length > 0) {
        endpoint = '/send/carousel';
        const carousel = carouselCards.map((card: any, cardIndex: number) => {
          const image = String(card?.image || '').trim();
          const text = [String(card?.title || '').trim(), String(card?.description || '').trim()]
            .filter(Boolean)
            .join('\n');
          const buttons = Array.isArray(card?.buttons)
            ? card.buttons.slice(0, 3).map((b: any, idx: number) => {
                const t = String(b?.type || 'REPLY').toUpperCase();
                const label = String(b?.text || b?.label || `Botão ${idx + 1}`).trim();
                let id = b?.id || label;
                if (t === 'URL' && (b?.value || b?.url)) id = b.value || b.url;
                if (t === 'CALL' && (b?.value || b?.phone)) id = b.value || b.phone;
                if (t === 'COPY' && (b?.value || b?.copyText)) id = b.value || b.copyText;
                return { id: String(id).trim(), text: label, type: t };
              }).filter((button: any) => button.id && button.text)
            : [];

          if (!image) {
            throw new Response(
              JSON.stringify({ error: `Card ${cardIndex + 1}: imagem obrigatória para carrossel` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (!text) {
            throw new Response(
              JSON.stringify({ error: `Card ${cardIndex + 1}: título ou descrição obrigatórios para carrossel` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (!buttons.length) {
            throw new Response(
              JSON.stringify({ error: `Card ${cardIndex + 1}: adicione ao menos 1 botão no carrossel` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return { text, image, buttons };
        });
        body = {
          number: targetNumber,
          text: message || '',
          carousel,
        };
      } else if (mediaUrl && mediaType) {
        endpoint = '/send/media';
        // For audio, use 'ptt' so it plays as a live voice note (gravação ao vivo)
        // instead of a regular audio attachment.
        const typeMap: Record<string, string> = { image: 'image', video: isPtv ? 'ptv' : 'video', audio: 'ptt', document: 'document' };
        body = {
          number: targetNumber,
          type: typeMap[mediaType] || 'document',
          file: mediaUrl,
          ...(message && !isPtv ? { text: message } : {}),
          ...(viewOnce ? { viewOnce: true } : {}),
        };
      }

      console.log(`📤 UAZAPI send → ${apiUrl}${endpoint} for ${targetNumber}`);
      const uazStartTs = Date.now();
      const uazRes = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: uazHeaders,
        body: JSON.stringify(body),
      });
      const uazData = await parseUazapiResponse(uazRes, logPhone, instanceId, endpoint.replace('/send/', ''));
      const uazDuration = Date.now() - uazStartTs;

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const logTag = mediaUrl && mediaType ? `[media:${mediaType}:${mediaUrl}]` : '';
      const logContent = logTag ? (message ? `${logTag}\n${message}` : logTag) : (message || '');
      await supabase.from('message_logs').insert({
        phone: logPhone,
        message_received: null,
        response_sent: logContent,
        keyword_matched: '__manual_send__',
        timestamp: new Date().toISOString(),
        user_id: credentials.userId,
        instance_id: instanceId,
      });

      await logProviderSend(adminClient, {
        userId: credentials.userId,
        provider: 'uazapi',
        instanceId,
        phone: logPhone,
        endpoint,
        status: 'success',
        httpStatus: uazRes.status,
        durationMs: uazDuration,
        payloadSummary: { mediaType: mediaType || null, hasButtons: Array.isArray(buttonActions) && buttonActions.length > 0 },
      });

      return new Response(
        JSON.stringify({ success: true, provider: 'uazapi', data: uazData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ===== END UAZAPI ROUTING =====

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
    if (deviceStatus.explicitlyDisconnected && !deviceStatus.connected) {
      return new Response(
        JSON.stringify({
          error: 'Instância WhatsApp desconectada',
          details: deviceStatus.payload,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!deviceStatus.ok) {
      return new Response(
        JSON.stringify({
          error: deviceStatus.message || 'Falha ao verificar status da instância',
          details: deviceStatus.payload,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

    let zapiResponse: Response;
    let zapiData: any = null;
    let logMessage = message || '';
    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

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
      zapiResponse = await fetch(`${baseUrl}/send-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          latitude: Number(String(specialPayload.latitude ?? '').replace(',', '.')) || 0,
          longitude: Number(String(specialPayload.longitude ?? '').replace(',', '.')) || 0,
          title: specialPayload.title || '',
          address: specialPayload.address || '',
        }),
      });
      logMessage = `📍 ${specialPayload.title || 'Localização'}`;
      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'location');
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
    } else if (Array.isArray(buttonActions) && buttonActions.length > 0) {
      const interactiveMessage = message || 'Selecione uma opção:';

      // Check if any button is an action type (URL/CALL) — these require /send-button-actions
      const hasActionButtons = buttonActions.some((b: any) => {
        const t = (b.type || '').toUpperCase();
        return t === 'URL' || t === 'CALL';
      });

      if (mediaUrl && mediaType === 'image' && !hasActionButtons) {
        // REPLY-only buttons + image → use /send-button-list with image inside buttonList
        const buttonListPayload = {
          phone: resolvedPhone,
          message: interactiveMessage,
          buttonList: {
            image: mediaUrl,
            buttons: buttonActions.slice(0, 3).map((b: any, index: number) => ({
              id: b.id || String(index + 1),
              label: b.label,
            })),
          },
        };

        console.log(`📤 Sending button-list with image for ${resolvedPhone}: ${JSON.stringify(buttonListPayload).substring(0, 300)}`);

        zapiResponse = await fetch(`${baseUrl}/send-button-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify(buttonListPayload),
        });

        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'button-list-image');
        logMessage = logMessage || '🔘 Botões com imagem';
      } else {
        // Action buttons (URL/CALL) or no image → use /send-button-actions
        const interactivePayload: Record<string, unknown> = {
          phone: resolvedPhone,
          message: interactiveMessage,
          ...(title ? { title } : {}),
          ...(footer ? { footer } : {}),
          buttonActions: buttonActions.map((b: any, index: number) => {
            const action: any = {
              id: b.id || String(index + 1),
              type: b.type,
              label: b.label,
            };
            if (b.type === 'URL' && b.url) action.url = b.url;
            if (b.type === 'CALL') action.phone = b.phone ?? b.phoneNumber;
            return action;
          }),
        };

        // If there's an image but we have action buttons, send image separately first
        if (mediaUrl && mediaType === 'image') {
          console.log(`📤 Sending image separately before action buttons for ${resolvedPhone}`);
          const imgResponse = await fetch(`${baseUrl}/send-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
            body: JSON.stringify({ phone: resolvedPhone, image: mediaUrl, caption: '' }),
          });
          await parseZapiResponse(imgResponse, resolvedPhone, instanceId, 'pre-button-image');
        }

        zapiResponse = await fetch(`${baseUrl}/send-button-actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify(interactivePayload),
        });

        zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'button-actions');
        logMessage = logMessage || '🔘 Botões de ação';
      }
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
        const c: any = {
          title: card.title || '',
          description: card.description || '',
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
      console.log(`📤 Z-API send-carousel for ${resolvedPhone}: ${cards.length} cards`);
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
        zapiResponse = await fetch(`${baseUrl}/send-document/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, document: mediaUrl, fileName: message || 'arquivo', caption: '' }),
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