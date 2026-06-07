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

// Robust UAZAPI / Evolution connection detection, mirroring get-whatsapp-groups.
const detectUazapiConnection = (j: any): { connected: boolean; status: string } => {
  const statusRaw =
    j?.instance?.status ||
    j?.status?.checked_instance?.connection_status ||
    j?.status?.connection_status ||
    j?.status ||
    j?.connectionStatus ||
    j?.state ||
    j?.instance?.state ||
    j?.instance?.connectionStatus ||
    '';
  let status = typeof statusRaw === 'string' ? statusRaw.toLowerCase() : '';
  if (
    !status &&
    (j?.connected === true ||
      j?.instance?.connected === true ||
      j?.status?.connected === true ||
      j?.status?.loggedIn === true ||
      j?.status?.checked_instance?.connection_status === 'connected')
  ) {
    status = 'open';
  }
  const negativeStates = ['disconnected', 'disconnect', 'closed', 'close', 'logout', 'logged_out', 'loggedout', 'offline', 'refused', 'connecting'];
  const isDisconnected =
    j?.connected === false ||
    j?.loggedIn === false ||
    j?.status?.connected === false ||
    j?.status?.loggedIn === false ||
    j?.instance?.connected === false ||
    negativeStates.some((s) => status === s || status.includes(s));
  const connected =
    !isDisconnected &&
    (j?.connected === true ||
      j?.loggedIn === true ||
      j?.status?.connected === true ||
      j?.status?.loggedIn === true ||
      j?.instance?.connected === true ||
      j?.status?.checked_instance?.connection_status === 'connected' ||
      ['connected', 'open', 'online', 'logged_in', 'loggedin', 'connected_in', 'true'].some(
        (s) => status === s || status.includes(s),
      ));
  return { connected, status };
};

const fetchUazapiStatus = async (apiUrl: string, apiToken: string, instanceName?: string | null) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    token: apiToken,
    apikey: apiToken,
    Authorization: `Bearer ${apiToken}`,
  };
  const endpoints = ['/instance/status', '/status', '/instance', '/instance/connectionStatus'];
  if (instanceName) {
    endpoints.unshift(`/instance/status/${instanceName}`);
    endpoints.unshift(`/instance/connectionStatus/${instanceName}`);
  }
  let lastRaw: any = null;
  for (const ep of endpoints) {
    try {
      const separator = ep.includes('?') ? '&' : '?';
      const url = `${apiUrl}${ep}${separator}token=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}`;
      const r = await fetch(url, { method: 'GET', headers });
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      if (!j) continue;
      lastRaw = j;
      const { connected, status } = detectUazapiConnection(j);
      console.log(`[get-device-status] UAZAPI ${ep} -> connected=${connected} status=${status}`);
      if (connected) return { connected: true, status, raw: j };
      // Keep trying further endpoints; UAZAPI sometimes only reports correctly on /instance.
    } catch (e) {
      console.log(`[get-device-status] UAZAPI ${ep} error:`, String(e));
    }
  }
  if (lastRaw) {
    const { connected, status } = detectUazapiConnection(lastRaw);
    return { connected, status, raw: lastRaw };
  }
  return { connected: false, status: 'disconnected', raw: null };
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
        const apiToken = (instance as any).evolution_api_key || (instance as any).zapi_token || '';
        if (!apiUrl || !apiToken) {
          return new Response(JSON.stringify({ error: 'UAZAPI URL/Token não configurados' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { connected, status, raw } = await fetchUazapiStatus(apiUrl, apiToken, (instance as any).instance_name);
        const normalized = {
          connected,
          session: connected,
          smartphoneConnected: connected,
          status,
          raw,
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

      const { connected, status, raw } = await fetchUazapiStatus(apiUrl, apiToken, (activeInstance as any).instance_name);
      const normalized = {
        connected,
        session: connected,
        smartphoneConnected: connected,
        status,
        raw,
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