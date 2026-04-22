import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";
import { assertZapiDeviceConnected } from "../_shared/zapi-device.ts";

const getZapiAckId = (payload: any) => {
  return payload?.messageId || payload?.zapiMessageId || payload?.zaapId || payload?.id || payload?.key?.id || payload?.message?.id || null;
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
    } = await req.json()

    console.log(`📨 Envio solicitado — phone: ${phone}, requestedInstanceId: ${requestedInstanceId || 'nenhum'}, mediaType: ${mediaType || 'none'}, isPtv: ${isPtv}, viewOnce: ${viewOnce}`);

    const hasInteractivePayload =
      (Array.isArray(buttonActions) && buttonActions.length > 0) ||
      (buttonList?.buttons && Array.isArray(buttonList.buttons) && buttonList.buttons.length > 0) ||
      (optionList?.options && Array.isArray(optionList.options) && optionList.options.length > 0);

    if (!phone || (!message && !mediaUrl && !hasInteractivePayload)) {
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
      // Try matching by zapi_instance_id first, then by table id (UUID)
      let reqInstance = null;
      const { data: byZapiId } = await adminClient
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key')
        .eq('zapi_instance_id', requestedInstanceId)
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .maybeSingle();
      
      reqInstance = byZapiId;
      
      if (!reqInstance) {
        const { data: byTableId } = await adminClient
          .from('zapi_instances')
          .select('zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key')
          .eq('id', requestedInstanceId)
          .eq('user_id', credentials.userId)
          .eq('is_active', true)
          .maybeSingle();
        reqInstance = byTableId;
      }

      if (reqInstance) {
        console.log(`📌 Using requested instance: ${reqInstance.zapi_instance_id} (requested: ${requestedInstanceId})`);
        instanceId = reqInstance.zapi_instance_id;
        token = reqInstance.zapi_token;
        clientToken = reqInstance.zapi_client_token;
        if ((reqInstance as any).api_provider === 'uazapi') {
          uazapiOverride = {
            apiUrl: ((reqInstance as any).evolution_api_url || '').replace(/\/+$/, ''),
            apiToken: (reqInstance as any).evolution_api_key || '',
          };
        }
      }
    } else {
      const { data: defaultInstance } = await adminClient
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key')
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .or(`zapi_instance_id.eq.${instanceId},id.eq.${instanceId}`)
        .maybeSingle();

      if (defaultInstance) {
        instanceId = defaultInstance.zapi_instance_id;
        token = defaultInstance.zapi_token;
        clientToken = defaultInstance.zapi_client_token;
        if ((defaultInstance as any).api_provider === 'uazapi') {
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
      const cleanPhone = String(phone).replace(/[@\-].*$/, '').replace(/\D/g, '');
      const targetNumber = normalizedGroupId || cleanPhone;
      const logPhone = isGroupPhone
        ? `${String(phone).replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '')}-group`
        : cleanPhone;
      let endpoint = '/send/text';
      let body: Record<string, unknown> = { number: targetNumber, text: message || '' };

      if (mediaUrl && mediaType) {
        endpoint = '/send/media';
        const typeMap: Record<string, string> = { image: 'image', video: 'video', audio: 'audio', document: 'document' };
        body = {
          number: targetNumber,
          type: typeMap[mediaType] || 'document',
          file: mediaUrl,
          text: message || '',
        };
      }

      console.log(`📤 UAZAPI send → ${apiUrl}${endpoint} for ${targetNumber}`);
      const uazRes = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: uazHeaders,
        body: JSON.stringify(body),
      });
      const uazRaw = await uazRes.text();
      let uazData: any = {};
      try { uazData = JSON.parse(uazRaw); } catch { uazData = { message: uazRaw }; }

      if (!uazRes.ok) {
        return new Response(
          JSON.stringify({ error: uazData?.error || uazData?.message || `UAZAPI error ${uazRes.status}`, details: uazData }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
        const { data: correctInstance } = await adminClient
          .from('zapi_instances')
          .select('zapi_instance_id, zapi_token, zapi_client_token')
          .or(`zapi_instance_id.eq.${resolvedGroupInstanceId},id.eq.${resolvedGroupInstanceId}`)
          .eq('user_id', credentials.userId)
          .eq('is_active', true)
          .maybeSingle();

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
          const { data: lidInstance } = await adminClient
            .from('zapi_instances')
            .select('zapi_instance_id, zapi_token, zapi_client_token')
            .eq('zapi_instance_id', mapping.instance_id)
            .eq('user_id', credentials.userId)
            .eq('is_active', true)
            .maybeSingle();

          if (lidInstance) {
            console.log(`✅ Using instance ${mapping.instance_id} for resolved LID`);
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

    if (Array.isArray(buttonActions) && buttonActions.length > 0) {
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

    return new Response(
      JSON.stringify({ success: true, data: zapiData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})