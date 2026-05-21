import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

const normalizeZapiStatus = (raw: any) => {
  const status = String(raw?.status || raw?.device?.status || '').toLowerCase();
  const connected =
    raw?.connected === true ||
    raw?.session === true ||
    raw?.smartphoneConnected === true ||
    raw?.device?.connected === true ||
    ['connected', 'open', 'online'].includes(status);

  return {
    ...raw,
    connected,
    session: connected,
    smartphoneConnected: connected,
    status,
    raw,
  };
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const getUpstreamMessage = (payload: any) =>
  String(payload?.error || payload?.message || payload?.details?.error || '').toLowerCase();

const disconnectedResponse = (raw: any, issue: string, status = 200) =>
  new Response(JSON.stringify({
    success: true,
    data: {
      connected: false,
      session: false,
      smartphoneConnected: false,
      status: issue,
      issue,
      raw: issue === 'credentials_invalid' ? { error: 'credentials_invalid' } : raw,
    }
  }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
      const { data: byTableId, error: byTableIdError } = await adminClient
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
        .eq('id', specificInstanceId)
        .eq('user_id', user.id)
        .maybeSingle();

      const instance = byTableId || (await adminClient
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
        .eq('zapi_instance_id', specificInstanceId)
        .eq('user_id', user.id)
        .maybeSingle()).data;

      if ((byTableIdError && !byTableId) || !instance) throw new Error('Instance not found');

      // UAZAPI provider routing
      if ((instance as any).api_provider === 'uazapi' || (instance as any).api_provider === 'uazapi_warmup') {
        const apiUrl = ((instance as any).evolution_api_url || '').replace(/\/+$/, '');
        const apiToken = (instance as any).evolution_api_key || '';
        if (!apiUrl || !apiToken) {
          return new Response(JSON.stringify({ error: 'UAZAPI URL/Token não configurados' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const uazRes = await fetch(`${apiUrl}/instance/status?token=${encodeURIComponent(apiToken)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', token: apiToken },
        });
        const uazRaw = await uazRes.text();
        let uazData: any = {};
        try { uazData = JSON.parse(uazRaw); } catch { uazData = { message: uazRaw }; }
        const status = String(uazData?.instance?.status || uazData?.status || '').toLowerCase();
        const connected = uazData?.connected === true || uazData?.loggedIn === true || status === 'connected';
        const normalized = {
          connected,
          session: connected,
          smartphoneConnected: connected,
          status,
          raw: uazData,
        };
        return new Response(JSON.stringify({ success: true, data: normalized }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const zapiUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/status`;
      console.log(`[get-device-status] Fetching status for instance ${instance.zapi_instance_id} at ${zapiUrl}`);
      
      const zapiResponse = await fetch(zapiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapi_client_token }
      });
      const zapiData = await parseJsonResponse(zapiResponse);

      if (!zapiResponse.ok) {
        console.warn(`[get-device-status] Z-API error for ${instance.zapi_instance_id}:`, zapiResponse.status, zapiData);
        const upstreamMsg = getUpstreamMessage(zapiData);
        if (zapiResponse.status === 401 || zapiResponse.status === 403 || upstreamMsg.includes('client-token') || upstreamMsg.includes('not allowed')) {
          return disconnectedResponse(zapiData, 'credentials_invalid');
        }
        if (zapiResponse.status === 400 || zapiResponse.status === 404 || upstreamMsg.includes('not found') || upstreamMsg.includes('not responding')) {
          return disconnectedResponse(zapiData, 'disconnected');
        }
        return new Response(JSON.stringify({ error: 'Failed to get device status', details: zapiData }),
          { status: zapiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, data: normalizeZapiStatus(zapiData) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default credentials path
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('authorization');

    if (!authHeader) throw new Error('No authorization header');

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: preferredInstance } = await adminClient
      .from('zapi_instances')
      .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();

    const fallbackInstance = preferredInstance || (await adminClient
      .from('zapi_instances')
      .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()).data;

    const activeInstance = fallbackInstance || {
      zapi_instance_id: credentials.instanceId,
      zapi_token: credentials.token,
      zapi_client_token: credentials.clientToken,
      api_provider: null,
      evolution_api_url: null,
      evolution_api_key: null,
    };

    if ((activeInstance as any).api_provider === 'uazapi' || (activeInstance as any).api_provider === 'uazapi_warmup') {
      const apiUrl = String((activeInstance as any).evolution_api_url || '').replace(/\/+$/, '');
      const apiToken = String((activeInstance as any).evolution_api_key || '');
      if (!apiUrl || !apiToken) {
        return new Response(JSON.stringify({ error: 'UAZAPI URL/Token não configurados' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const uazRes = await fetch(`${apiUrl}/instance/status?token=${encodeURIComponent(apiToken)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', token: apiToken },
      });
      const uazRaw = await uazRes.text();
      let uazData: any = {};
      try { uazData = JSON.parse(uazRaw); } catch { uazData = { message: uazRaw }; }

      const status = String(uazData?.instance?.status || uazData?.status || '').toLowerCase();
      const connected = uazData?.connected === true || uazData?.loggedIn === true || status === 'connected' || status === 'open';
      const normalized = {
        connected,
        session: connected,
        smartphoneConnected: connected,
        status,
        raw: uazData,
      };

      return new Response(JSON.stringify({ success: true, data: normalized }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const zapiUrl = `https://api.z-api.io/instances/${activeInstance.zapi_instance_id}/token/${activeInstance.zapi_token}/status`;
    const zapiResponse = await fetch(zapiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': activeInstance.zapi_client_token }
    });
    const zapiData = await parseJsonResponse(zapiResponse);

    if (!zapiResponse.ok) {
      const upstreamMsg = getUpstreamMessage(zapiData);
      if (zapiResponse.status === 401 || zapiResponse.status === 403 || upstreamMsg.includes('client-token') || upstreamMsg.includes('not allowed')) {
        return disconnectedResponse(zapiData, 'credentials_invalid');
      }
      if (zapiResponse.status === 400 || zapiResponse.status === 404 || upstreamMsg.includes('not found') || upstreamMsg.includes('not responding')) {
        return disconnectedResponse(zapiData, 'disconnected');
      }
      return new Response(JSON.stringify({ error: 'Failed to get device status', details: zapiData }),
        { status: zapiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true, data: normalizeZapiStatus(zapiData) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})