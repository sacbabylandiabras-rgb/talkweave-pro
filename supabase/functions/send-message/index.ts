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

    const { phone, message, mediaUrl, mediaType } = await req.json()

    if (!phone || (!message && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: 'Phone and message or mediaUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    let { instanceId, token, clientToken } = credentials;

    // If phone is @lid format, find the instance that originally received messages from this LID
    const isLidPhone = phone.includes('@lid');
    if (isLidPhone) {
      console.log(`📌 Phone is LID format: ${phone} — looking up original instance`);
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      
      // Find which instance received messages from this LID phone
      const { data: logEntry } = await adminClient
        .from('message_logs')
        .select('instance_id')
        .eq('phone', phone)
        .eq('user_id', credentials.userId)
        .not('instance_id', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logEntry?.instance_id) {
        // Find the instance credentials by zapi_instance_id
        const { data: lidInstance } = await adminClient
          .from('zapi_instances')
          .select('zapi_instance_id, zapi_token, zapi_client_token')
          .eq('zapi_instance_id', logEntry.instance_id)
          .eq('user_id', credentials.userId)
          .eq('is_active', true)
          .maybeSingle();

        if (lidInstance) {
          console.log(`✅ Switching to instance ${logEntry.instance_id} for LID phone`);
          instanceId = lidInstance.zapi_instance_id;
          token = lidInstance.zapi_token;
          clientToken = lidInstance.zapi_client_token;
        } else {
          console.log(`⚠️ Instance ${logEntry.instance_id} not found or inactive, using default`);
        }
      } else {
        console.log(`⚠️ No message_log found for LID phone, using default instance`);
      }
    }

    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

    let zapiResponse: Response;
    let logMessage = message || '';

    if (mediaUrl && mediaType) {
      // Send media based on type
      if (mediaType === 'audio') {
        // Send as PTT (voice message)
        zapiResponse = await fetch(`${baseUrl}/send-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone, audio: mediaUrl, waveform: true }),
        });
        logMessage = logMessage || '🎤 Áudio';
      } else if (mediaType === 'image') {
        zapiResponse = await fetch(`${baseUrl}/send-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone, image: mediaUrl, caption: message || '' }),
        });
        logMessage = logMessage || '📷 Imagem';
      } else if (mediaType === 'video') {
        zapiResponse = await fetch(`${baseUrl}/send-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone, video: mediaUrl, caption: message || '' }),
        });
        logMessage = logMessage || '🎥 Vídeo';
      } else {
        // Document/file
        zapiResponse = await fetch(`${baseUrl}/send-document/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone, document: mediaUrl, fileName: message || 'arquivo', caption: '' }),
        });
        logMessage = logMessage || '📎 Arquivo';
      }
    } else {
      // Send text only
      zapiResponse = await fetch(`${baseUrl}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({ phone, message }),
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
    
    // Build log message: include media info for display in chat
    let logContent = message || '';
    if (mediaUrl && mediaType) {
      const mediaTag = `[media:${mediaType}:${mediaUrl}]`;
      logContent = logContent ? `${mediaTag}\n${logContent}` : mediaTag;
    }
    
    await supabase.from('message_logs').insert({
      phone,
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
