import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const getQrCodeValue = (payload: any) => {
  return pickFirstString(
    payload?.qrcode,
    payload?.qrCode,
    payload?.qr,
    payload?.base64,
    payload?.instance?.qrcode,
    payload?.instance?.qrCode,
    payload?.instance?.qr,
    payload?.instance?.base64,
    payload?.data?.qrcode,
    payload?.data?.qrCode,
    payload?.data?.qr,
    payload?.data?.base64,
    payload?.response?.qrcode,
    payload?.response?.qrCode,
    payload?.response?.qr,
    payload?.response?.base64
  );
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

const unavailableQrResponse = (raw: any, issue: string) =>
  new Response(JSON.stringify({
    success: true,
    data: {
      value: null,
      qrCode: null,
      connected: false,
      issue,
      raw: issue === 'credentials_invalid' ? { error: 'credentials_invalid' } : raw,
    },
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
      if ((instance as any).api_provider === 'uazapi' || (instance as any).api_provider === 'uazapi_warmup') {
        const apiUrl = ((instance as any).evolution_api_url || '').replace(/\/+$/, '');
        const apiToken = (instance as any).evolution_api_key || '';
        if (!apiUrl || !apiToken) {
          return new Response(JSON.stringify({ error: 'UAZAPI URL/Token não configurados' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const withToken = (path: string) => `${apiUrl}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(apiToken)}`;

        // Trigger connect to ensure instance is in QR mode
        const uazRes = await fetch(withToken('/instance/connect'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify({}),
        });
        
        const uazRaw = await uazRes.text();
        let uazData: any = {};
        try { uazData = JSON.parse(uazRaw); } catch { uazData = { message: uazRaw }; }
        
        let qr = getQrCodeValue(uazData);

        // If not in response, poll status a few times
        if (!qr) {
          for (let i = 0; i < 3; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const statusRes = await fetch(withToken('/instance/status'), {
              method: 'GET',
              headers: { 'Content-Type': 'application/json', token: apiToken },
            });
            const statusData = await statusRes.json().catch(() => ({}));
            qr = getQrCodeValue(statusData);
            if (qr) {
              uazData = statusData;
              break;
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          data: { value: qr, qrCode: qr, connected: uazData?.connected === true, raw: uazData },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const zapiUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/qr-code/image`;
      const zapiResponse = await fetch(zapiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapi_client_token }
      });
      const zapiData = await parseJsonResponse(zapiResponse);

      if (!zapiResponse.ok) {
        const upstreamMsg = getUpstreamMessage(zapiData);
        if (zapiResponse.status === 401 || zapiResponse.status === 403 || upstreamMsg.includes('client-token') || upstreamMsg.includes('not allowed')) {
          return unavailableQrResponse(zapiData, 'credentials_invalid');
        }
        if (zapiResponse.status === 400 && upstreamMsg.includes('not responding')) {
          return unavailableQrResponse(zapiData, 'whatsapp_unavailable');
        }
        return new Response(JSON.stringify({ error: 'Failed to get QR code', details: zapiData }),
          { status: zapiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, data: zapiData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Default credentials path
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);

    const zapiUrl = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/qr-code/image`;
    const zapiResponse = await fetch(zapiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': credentials.clientToken }
    });
    const zapiData = await parseJsonResponse(zapiResponse);

    if (!zapiResponse.ok) {
      const upstreamMsg = getUpstreamMessage(zapiData);
      if (zapiResponse.status === 401 || zapiResponse.status === 403 || upstreamMsg.includes('client-token') || upstreamMsg.includes('not allowed')) {
        return unavailableQrResponse(zapiData, 'credentials_invalid');
      }
      if (zapiResponse.status === 400 && upstreamMsg.includes('not responding')) {
        return unavailableQrResponse(zapiData, 'whatsapp_unavailable');
      }
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
