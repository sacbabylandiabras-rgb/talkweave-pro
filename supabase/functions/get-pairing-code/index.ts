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

const parseResponseBody = async (response: Response) => {
  const rawText = await response.text();

  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch {
    return { message: rawText };
  }
};

const getPairingCodeValue = (payload: any) => {
  return pickFirstString(
    payload?.pairingCode,
    payload?.paircode,
    payload?.pairCode,
    payload?.code,
    payload?.data?.pairingCode,
    payload?.data?.paircode,
    payload?.data?.pairCode,
    payload?.data?.code,
    payload?.instance?.pairingCode,
    payload?.instance?.paircode,
    payload?.instance?.pairCode,
    payload?.instance?.code,
    payload?.response?.pairingCode,
    payload?.response?.paircode,
    payload?.response?.pairCode,
    payload?.response?.code,
    payload?.status?.pairingCode,
    payload?.status?.paircode,
    payload?.status?.pairCode,
    payload?.status?.code,
  );
};

const getQrCodeValue = (payload: any) => {
  return pickFirstString(
    payload?.qrCode,
    payload?.qrcode,
    payload?.qr,
    payload?.value,
    payload?.data?.qrCode,
    payload?.data?.qrcode,
    payload?.data?.qr,
    payload?.data?.value,
    payload?.instance?.qrCode,
    payload?.instance?.qrcode,
    payload?.instance?.qr,
    payload?.response?.qrCode,
    payload?.response?.qrcode,
    payload?.response?.qr,
    payload?.response?.value,
    payload?.status?.qrCode,
    payload?.status?.qrcode,
    payload?.status?.qr,
    payload?.status?.value,
  );
};

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
      
      // UAZAPI provider routing
      if ((instance as any).api_provider === 'uazapi' || (instance as any).api_provider === 'uazapi_warmup') {
        const apiUrl = ((instance as any).evolution_api_url || '').replace(/\/+$/, '');
        const apiToken = (instance as any).evolution_api_key || (instance as any).zapi_token || '';
        if (!apiUrl || !apiToken) {
          return new Response(JSON.stringify({ error: 'Configuração de conexão incompleta', message: 'Não foi possível iniciar a conexão agora.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const withToken = (path: string) => `${apiUrl}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(apiToken)}`;

        // Ensure instance is disconnected so /connect with phone returns a paircode
        try {
          await fetch(withToken('/instance/disconnect'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: apiToken },
          });
        } catch (e) {
          console.warn('[get-pairing-code] disconnect before pairing failed:', e);
        }

        const uazRes = await fetch(withToken('/instance/connect'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify({ phone: phoneNumber }),
        });

        let uazData: any = await parseResponseBody(uazRes);
        let code = getPairingCodeValue(uazData);
        let qr = getQrCodeValue(uazData);

        if (!code) {
          for (let attempt = 0; attempt < 4; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 800));

            const statusRes = await fetch(withToken('/instance/status'), {
              method: 'GET',
              headers: { 'Content-Type': 'application/json', token: apiToken },
            });
            const statusData = await parseResponseBody(statusRes);
            const statusCode = getPairingCodeValue(statusData);
            const statusQr = getQrCodeValue(statusData);

            if (!qr && statusQr) qr = statusQr;
            if (statusCode) {
              code = statusCode;
              uazData = statusData;
              break;
            }
          }
        }

        if (!code && !qr) {
          return new Response(JSON.stringify({ error: 'Falha ao gerar código de conexão', message: 'Não foi possível gerar o código de conexão agora.', details: uazData }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
          success: true,
          data: { code, pairingCode: code, qrCode: qr, isReal: true, method: 'phone-number' },
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
    const response = await fetch(zapiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': credentials.clientToken }
    });
    const rawText = await response.text();
    let result: any = {};
    try { result = JSON.parse(rawText); } catch { result = { message: rawText }; }

    if (!response.ok || !result.code) {
      return new Response(
        JSON.stringify({ error: result.error || 'Falha ao gerar código de conexão', message: result.message || 'Não foi possível gerar o código de conexão agora.', details: result }),
        { status: response.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, data: { code: result.code, pairingCode: result.code, isReal: true, method: 'phone-number' } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[get-pairing-code] error', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
