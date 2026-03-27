import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

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
    } = await req.json()

    console.log(`📨 Envio solicitado — phone: ${phone}, requestedInstanceId: ${requestedInstanceId || 'nenhum'}`);

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

    // If a specific instanceId was requested, look it up
    if (requestedInstanceId && requestedInstanceId !== instanceId) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: reqInstance } = await adminClient
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token')
        .eq('zapi_instance_id', requestedInstanceId)
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .maybeSingle();

      if (reqInstance) {
        console.log(`📌 Using requested instance: ${requestedInstanceId}`);
        instanceId = reqInstance.zapi_instance_id;
        token = reqInstance.zapi_token;
        clientToken = reqInstance.zapi_client_token;
      }
    }

    // If phone is @lid format, resolve to clean phone using LID mapping
    let resolvedPhone = phone;
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
    let logMessage = message || '';
    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

    if (Array.isArray(buttonActions) && buttonActions.length > 0) {
      zapiResponse = await fetch(`${baseUrl}/send-button-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          message: message || '',
          buttonActions,
          ...(title ? { title } : {}),
          ...(footer ? { footer } : {}),
        }),
      });
      logMessage = logMessage || '🔘 Botões de ação';
    } else if (buttonList?.buttons && Array.isArray(buttonList.buttons) && buttonList.buttons.length > 0) {
      zapiResponse = await fetch(`${baseUrl}/send-button-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          message: message || '',
          buttonList,
        }),
      });
      logMessage = logMessage || '🔘 Lista de botões';
    } else if (optionList?.options && Array.isArray(optionList.options) && optionList.options.length > 0) {
      zapiResponse = await fetch(`${baseUrl}/send-option-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({
          phone: resolvedPhone,
          message: message || '',
          optionList,
        }),
      });
      logMessage = logMessage || '📋 Lista de opções';
    } else if (mediaUrl && mediaType) {
      if (mediaType === 'audio') {
        zapiResponse = await fetch(`${baseUrl}/send-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, audio: mediaUrl, waveform: true }),
        });
        logMessage = logMessage || '🎤 Áudio';
      } else if (mediaType === 'image') {
        zapiResponse = await fetch(`${baseUrl}/send-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, image: mediaUrl, caption: message || '' }),
        });
        logMessage = logMessage || '📷 Imagem';
      } else if (mediaType === 'video') {
        zapiResponse = await fetch(`${baseUrl}/send-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, video: mediaUrl, caption: message || '' }),
        });
        logMessage = logMessage || '🎥 Vídeo';
      } else {
        zapiResponse = await fetch(`${baseUrl}/send-document/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: resolvedPhone, document: mediaUrl, fileName: message || 'arquivo', caption: '' }),
        });
        logMessage = logMessage || '📎 Arquivo';
      }
    } else {
      zapiResponse = await fetch(`${baseUrl}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({ phone: resolvedPhone, message }),
      });
    }

    const zapiData = await zapiResponse.json()

    if (!zapiResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to send message', details: zapiData }),
        { status: zapiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the sent message
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let logContent = message || '';
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
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})