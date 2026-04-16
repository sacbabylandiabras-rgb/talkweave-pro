import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
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
    let { instanceId, token, clientToken } = credentials;

    // Detect group phones
    const isGroupPhone = phone.includes('-group') || phone.includes('@g.us') || /^12036\d{13,}$/.test(phone.replace(/\D/g, ''));

    if (requestedInstanceId && requestedInstanceId !== instanceId) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      
      // Try matching by zapi_instance_id first, then by table id (UUID)
      let reqInstance = null;
      const { data: byZapiId } = await adminClient
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token')
        .eq('zapi_instance_id', requestedInstanceId)
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .maybeSingle();
      
      reqInstance = byZapiId;
      
      if (!reqInstance) {
        const { data: byTableId } = await adminClient
          .from('zapi_instances')
          .select('zapi_instance_id, zapi_token, zapi_client_token')
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
      }
    }

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

      if (mediaUrl && mediaType === 'image') {
        interactivePayload.image = mediaUrl;
      }

      zapiResponse = await fetch(`${baseUrl}/send-button-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify(interactivePayload),
      });

      zapiData = await parseZapiResponse(zapiResponse, resolvedPhone, instanceId, 'button-actions');

      logMessage = logMessage || '🔘 Botões de ação';
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