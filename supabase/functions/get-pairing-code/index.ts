import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
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

    const body = await req.json();
    const { phoneNumber, instanceId } = body;
    console.log('[get-pairing-code] request received', { phoneNumber, instanceId });

    if (!phoneNumber) {
      return new Response(JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let credentials;

    if (instanceId) {
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
        .eq('id', instanceId)
        .eq('user_id', user.id)
        .single();

      if (instError || !instance) throw new Error('Instance not found');
      console.log('[get-pairing-code] instance loaded', {
        provider: (instance as any).api_provider,
        hasZapiId: Boolean((instance as any).zapi_instance_id),
        hasZapiToken: Boolean((instance as any).zapi_token),
        hasClientToken: Boolean((instance as any).zapi_client_token),
      });

      // UAZAPI provider routing
      if ((instance as any).api_provider === 'uazapi') {
        const apiUrl = ((instance as any).evolution_api_url || '').replace(/\/+$/, '');
        const apiToken = (instance as any).evolution_api_key || '';
        if (!apiUrl || !apiToken) {
          return new Response(JSON.stringify({ error: 'UAZAPI URL/Token não configurados' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const uazRes = await fetch(`${apiUrl}/instance/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify({ phone: phoneNumber }),
        });
        const uazRaw = await uazRes.text();
        let uazData: any = {};
        try { uazData = JSON.parse(uazRaw); } catch { uazData = { message: uazRaw }; }
        const code = uazData?.paircode || uazData?.pairingCode || uazData?.code || uazData?.instance?.paircode || null;
        const qr = uazData?.qrcode || uazData?.qrCode || null;
        if (!code && !qr) {
          return new Response(JSON.stringify({ error: 'UAZAPI não retornou código', details: uazData }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({
          success: true,
          data: { code, pairingCode: code, qrCode: qr, isReal: true, method: 'uazapi' },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      credentials = {
        instanceId: instance.zapi_instance_id,
        token: instance.zapi_token,
        clientToken: instance.zapi_client_token,
        instanceName: instance.instance_name || instance.zapi_instance_id,
      };
    } else {
      credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    }

    // Z-API pairing code
    const zapiUrl = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/phone-code/${phoneNumber}`;
    console.log('[get-pairing-code] calling Z-API', { url: zapiUrl.replace(credentials.token, '***') });
    const response = await fetch(zapiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': credentials.clientToken }
    });
    const rawText = await response.text();
    let result: any = {};
    try { result = JSON.parse(rawText); } catch { result = { message: rawText }; }
    console.log('[get-pairing-code] Z-API response', { status: response.status, body: rawText.slice(0, 500) });

    if (!response.ok || !result.code) {
      return new Response(
        JSON.stringify({ error: result.error || 'Falha ao gerar código na Z-API', details: result }),
        { status: response.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, data: { code: result.code, isReal: true, method: 'zapi' } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[get-pairing-code] error', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})