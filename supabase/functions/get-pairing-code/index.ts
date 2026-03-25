import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";
import {
  buildEvolutionInstanceCandidates,
  buildEvolutionUrlCandidates,
  buildPairingCodeStrategies,
  executeStrategies,
  extractPairingCode,
  extractQrCodeValue,
  getEvolutionErrorMessage,
} from "../_shared/evolution.ts";

const handleEvolutionPairing = async (evoUrl: string, evoKey: string, evoInstanceId: string, evoInstanceName: string | undefined, phone: string) => {
  const evoUrls = buildEvolutionUrlCandidates(evoUrl);
  const instanceCandidates = buildEvolutionInstanceCandidates(evoInstanceId, evoInstanceName);
  const sanitizedPhone = String(phone).replace(/\D/g, '');

  console.log(`📱 Evolution pairing for: ${evoInstanceName}, phone: ${sanitizedPhone}`);

  const result = await executeStrategies(
    evoUrls,
    (cfg) => buildPairingCodeStrategies(cfg, sanitizedPhone),
    evoKey,
    evoInstanceName,
    '📱',
  );

  if (result.status >= 200 && result.status < 300) {
    const pairingCode = extractPairingCode(result.data);
    const qrCode = extractQrCodeValue(result.data);

    if (pairingCode || qrCode) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            code: pairingCode || qrCode,
            pairingCode,
            qrCode,
            phoneNumber: sanitizedPhone,
            method: 'evolution',
            isReal: true,
            raw: result.data,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({
      error: 'Failed to get pairing code',
      message: getEvolutionErrorMessage(result.data, result.status, 'Evolution did not return a valid pairing code or QR code'),
      details: result.data,
    }),
    { status: result.status >= 400 ? result.status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

      credentials = {
        instanceId: instance.zapi_instance_id,
        token: instance.zapi_token,
        clientToken: instance.zapi_client_token,
        apiProvider: (instance.api_provider || 'zapi') as 'zapi' | 'evolution',
        evolutionApiUrl: instance.evolution_api_url || undefined,
        evolutionApiKey: instance.evolution_api_key || undefined,
      };
    } else {
      credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    }

    if (credentials.apiProvider === 'evolution') {
      const evoUrl = credentials.evolutionApiUrl?.replace(/\/$/, '');
      const evoKey = credentials.evolutionApiKey;
      if (!evoUrl || !evoKey) throw new Error('Evolution API URL or Key not configured');
      return await handleEvolutionPairing(evoUrl, evoKey, credentials.instanceId, phoneNumber);
    }

    // Z-API path
    const zapiUrl = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/phone-code/${phoneNumber}`;
    const response = await fetch(zapiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': credentials.clientToken }
    });
    const result = await response.json();

    if (!response.ok || !result.code) {
      return new Response(
        JSON.stringify({ error: result.error || 'Falha ao gerar código na Z-API', details: result }),
        { status: response.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, data: { code: result.code, isReal: true, method: 'zapi' } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
