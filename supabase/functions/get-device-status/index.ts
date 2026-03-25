import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";
import { buildEvolutionUrlCandidates, getEvolutionErrorMessage, isEvolutionInstanceNotFound, parseEvolutionResponse } from "../_shared/evolution.ts";

const isEvolutionConnected = (payload: any) => {
  const state = payload?.instance?.state || payload?.state || payload?.status || payload?.instance?.status || null;
  return ['open', 'connected'].includes(String(state).toLowerCase());
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

    // Check if a specific instance was requested via body
    let specificInstanceId: string | null = null;
    try {
      if (req.method === 'POST') {
        const body = await req.json();
        specificInstanceId = body?.instanceId || null;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    let instanceId: string;
    let token: string;
    let clientToken: string;

    if (specificInstanceId) {
      // Fetch the specific instance from DB
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
        .select('zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key')
        .eq('id', specificInstanceId)
        .eq('user_id', user.id)
        .single();

      if (instError || !instance) {
        throw new Error('Instance not found');
      }

      // Handle Evolution API
      if (instance.api_provider === 'evolution') {
        const evoUrl = instance.evolution_api_url?.replace(/\/$/, '');
        const evoKey = instance.evolution_api_key;
        const evoInstanceName = instance.zapi_instance_id;
        
        if (!evoUrl || !evoKey) {
          throw new Error('Evolution API URL or Key not configured');
        }

        console.log(`📋 Checking Evolution API status for: ${evoInstanceName}`);

        const evoUrls = buildEvolutionUrlCandidates(evoUrl);
        let evoData: any = null;
        let rawText = '';
        let lastStatus = 500;

        for (const candidateUrl of evoUrls) {
          const evoResponse = await fetch(`${candidateUrl}/instance/connectionState/${encodeURIComponent(evoInstanceName)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evoKey,
            }
          });

          lastStatus = evoResponse.status;
          const parsed = await parseEvolutionResponse(evoResponse);
          evoData = parsed.data;
          rawText = parsed.rawText;

          if (evoResponse.ok || !isEvolutionInstanceNotFound(evoData, rawText)) {
            break;
          }
        }

        if (lastStatus < 200 || lastStatus >= 300) {
          return new Response(
            JSON.stringify({
              error: 'Failed to get device status',
              message: getEvolutionErrorMessage(evoData, lastStatus, 'Evolution status request failed'),
              details: evoData,
              rawText,
            }),
            {
              status: lastStatus,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        // Normalize Evolution API response to match Z-API format
        const isConnected = isEvolutionConnected(evoData);
        const normalizedData = {
          connected: isConnected,
          session: isConnected,
          smartphoneConnected: isConnected,
          provider: 'evolution',
          raw: evoData,
        };

        return new Response(
          JSON.stringify({ success: true, data: normalizedData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      instanceId = instance.zapi_instance_id;
      token = instance.zapi_token;
      clientToken = instance.zapi_client_token;
      console.log(`📋 Checking status for specific instance: ${instanceId}`);
    } else {
      // Use default credentials
      const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);

      if (credentials.apiProvider === 'evolution') {
        const evoUrl = credentials.evolutionApiUrl?.replace(/\/$/, '');
        const evoKey = credentials.evolutionApiKey;
        const evoInstanceName = credentials.instanceId;

        if (!evoUrl || !evoKey) {
          throw new Error('Evolution API URL or Key not configured');
        }

        console.log(`📋 Checking default Evolution API status for: ${evoInstanceName}`);

        const evoResponse = await fetch(`${evoUrl}/instance/connectionState/${encodeURIComponent(evoInstanceName)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evoKey,
          }
        });

        const { data: evoData, rawText } = await parseApiResponse(evoResponse);

        if (!evoResponse.ok) {
          return new Response(
            JSON.stringify({
              error: 'Failed to get device status',
              message: evoData?.message || evoData?.error || `Evolution status request failed with ${evoResponse.status}`,
              details: evoData,
              rawText,
            }),
            {
              status: evoResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        const isConnected = isEvolutionConnected(evoData);
        const normalizedData = {
          connected: isConnected,
          session: isConnected,
          smartphoneConnected: isConnected,
          provider: 'evolution',
          raw: evoData,
        };

        return new Response(
          JSON.stringify({ success: true, data: normalizedData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      instanceId = credentials.instanceId;
      token = credentials.token;
      clientToken = credentials.clientToken;
    }

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`

    const zapiResponse = await fetch(zapiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      }
    })

    const zapiData = await zapiResponse.json()

    if (!zapiResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to get device status', details: zapiData }),
        { 
          status: zapiResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: zapiData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
