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

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase configuration');

    let specificInstanceId: string | null = null;
    try {
      if (req.method === 'POST') {
        const body = await req.json();
        specificInstanceId = body?.instanceId || null;
      }
    } catch { /* no body */ }

    if (specificInstanceId) {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) throw new Error('No authorization header');

      const userClient = createClient(supabaseUrl, supabaseServiceKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) throw new Error('Unauthorized');

      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: instance, error: instError } = await adminClient
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
        .eq('id', specificInstanceId)
        .eq('user_id', user.id)
        .single();

      if (instError || !instance) throw new Error('Instance not found');

      // UAZAPI provider routing
      if ((instance as any).api_provider === 'uazapi') {
        const apiUrl = ((instance as any).evolution_api_url || '').replace(/\/+$/, '');
        const apiToken = (instance as any).evolution_api_key || '';
        if (!apiUrl || !apiToken) {
          return new Response(JSON.stringify({ error: 'UAZAPI URL/Token não configurados' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Auto-configure webhook to point to our webhook-zapi endpoint
        try {
          const webhookUrl = `${supabaseUrl}/functions/v1/webhook-zapi?provider=uazapi&instanceId=${specificInstanceId}`;
          await fetch(`${apiUrl}/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: apiToken },
            body: JSON.stringify({
              url: webhookUrl,
              enabled: true,
              events: ['messages', 'messages_update', 'connection', 'history', 'groups', 'contacts', 'chats'],
              excludeEvents: ['wasSentByApi'],
              addUrlEvents: false,
              addUrlTypesMessages: false,
            }),
          }).catch((e) => console.error('UAZAPI webhook config failed:', e));
        } catch (e) {
          console.error('UAZAPI webhook setup error:', e);
        }
        // POST /instance/connect generates QR + pairing code
        const uazRes = await fetch(`${apiUrl}/instance/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify({}),
        });
        const uazRaw = await uazRes.text();
        let uazData: any = {};
        try { uazData = JSON.parse(uazRaw); } catch { uazData = { message: uazRaw }; }
        const qr = uazData?.qrcode || uazData?.qrCode || uazData?.instance?.qrcode || uazData?.instance?.qrCode || uazData?.data?.qrcode || null;
        return new Response(JSON.stringify({
          success: true,
          data: { value: qr, qrCode: qr, connected: uazData?.connected === true, raw: uazData },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const zapiUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/qr-code`;
      const zapiResponse = await fetch(zapiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapi_client_token }
      });
      const zapiData = await zapiResponse.json();

      if (!zapiResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to get QR code', details: zapiData }),
          { status: zapiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, data: zapiData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default credentials path
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);

    const zapiUrl = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/qr-code`;
    const zapiResponse = await fetch(zapiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': credentials.clientToken }
    });
    const zapiData = await zapiResponse.json();

    if (!zapiResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to get QR code', details: zapiData }),
        { status: zapiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true, data: zapiData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})