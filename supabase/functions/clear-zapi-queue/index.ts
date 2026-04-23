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
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const requestedInstanceId = typeof body?.instanceId === 'string' ? body.instanceId : undefined;
    const clearAllActive = body?.clearAllActive === true;
    const internalAdminKey = req.headers.get('x-internal-admin-key');
    const requestedUserId = typeof body?.userId === 'string' ? body.userId : undefined;
    const isInternalAdminCall = internalAdminKey === supabaseServiceKey;

    const credentials = isInternalAdminCall
      ? {
          userId: requestedUserId,
          instanceId: '',
          token: '',
          clientToken: '',
          instanceName: 'Internal Admin Call',
        }
      : await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);

    if (isInternalAdminCall && !requestedUserId) {
      throw new Error('userId is required for internal admin calls');
    }

    let instancesToClear: Array<{ instanceId: string; token: string; clientToken: string; instanceName: string; apiProvider: string }> = [];

    if (clearAllActive) {
      const { data: activeInstances, error } = await supabase
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider')
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      instancesToClear = (activeInstances || []).map((instance: any) => ({
        instanceId: instance.zapi_instance_id,
        token: instance.zapi_token,
        clientToken: instance.zapi_client_token,
        instanceName: instance.instance_name || 'Instância Ativa',
        apiProvider: String(instance.api_provider || 'zapi').toLowerCase(),
      }));
    } else if (requestedInstanceId) {
      const { data: specificInstance, error } = await supabase
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider')
        .eq('id', requestedInstanceId)
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!specificInstance) {
        throw new Error('Requested instance not found or inactive');
      }

      instancesToClear = [{
        instanceId: specificInstance.zapi_instance_id,
        token: specificInstance.zapi_token,
        clientToken: specificInstance.zapi_client_token,
        instanceName: specificInstance.instance_name || 'Instância Selecionada',
        apiProvider: String((specificInstance as any).api_provider || 'zapi').toLowerCase(),
      }];
    } else {
      instancesToClear = [{
        instanceId: credentials.instanceId,
        token: credentials.token,
        clientToken: credentials.clientToken,
        instanceName: credentials.instanceName,
        apiProvider: 'zapi',
      }];
    }

    if (instancesToClear.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active queues to clear', results: [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const results = [];

    for (const instance of instancesToClear) {
      console.log(`🧹 Clearing Z-API queue for instance ${instance.instanceName} (${instance.instanceId})`);

      const zapiUrl = `https://api.z-api.io/instances/${instance.instanceId}/token/${instance.token}/queue`;
      const zapiResponse = await fetch(zapiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': instance.clientToken
        }
      });

      let zapiData: any = {};
      try {
        const responseText = await zapiResponse.text();
        if (responseText && responseText.trim()) {
          zapiData = JSON.parse(responseText);
        }
      } catch (_parseErr) {
        // Empty or non-JSON response is fine for DELETE
      }

      results.push({
        instanceId: instance.instanceId,
        instanceName: instance.instanceName,
        success: zapiResponse.ok,
        status: zapiResponse.status,
        data: zapiData,
      });
    }

    const failed = results.filter(result => !result.success);
    if (failed.length > 0) {
      console.error('❌ Failed to clear one or more Z-API queues:', failed);
      return new Response(
        JSON.stringify({ error: 'Failed to clear one or more Z-API queues', results }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`✅ Cleared ${results.length} Z-API queue(s) successfully`);

    return new Response(
      JSON.stringify({ success: true, message: 'Z-API queue(s) cleared', results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error clearing Z-API queue:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
