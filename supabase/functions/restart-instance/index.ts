import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('No authorization header');

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { instanceId } = await req.json();
    if (!instanceId) throw new Error('instanceId is required');

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: instance, error: instError } = await adminClient
      .from('zapi_instances')
      .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .single();

    if (instError || !instance) throw new Error('Instance not found');

    if (instance.api_provider === 'evolution') {
      const evoUrl = instance.evolution_api_url?.replace(/\/$/, '');
      const evoKey = instance.evolution_api_key;
      if (!evoUrl || !evoKey) throw new Error('Evolution API URL or Key not configured');

      const evoInstanceName = instance.zapi_instance_id;
      console.log(`🔄 Restarting Evolution instance: ${evoInstanceName}`);

      // Try restart endpoint
      const restartRes = await fetch(`${evoUrl}/instance/restart/${encodeURIComponent(evoInstanceName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
      });

      console.log(`🔄 Restart response: ${restartRes.status}`);

      if (restartRes.ok) {
        const data = await restartRes.json().catch(() => ({}));
        return new Response(JSON.stringify({ success: true, data, method: 'restart' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fallback: try logout then connect
      console.log(`🔄 Restart failed (${restartRes.status}), trying logout + connect...`);

      const logoutRes = await fetch(`${evoUrl}/instance/logout/${encodeURIComponent(evoInstanceName)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
      });
      console.log(`🔄 Logout response: ${logoutRes.status}`);

      // Wait a moment then reconnect
      await new Promise(r => setTimeout(r, 2000));

      const connectRes = await fetch(`${evoUrl}/instance/connect/${encodeURIComponent(evoInstanceName)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
      });
      const connectData = await connectRes.json().catch(() => ({}));
      console.log(`🔄 Connect response: ${connectRes.status}`);

      return new Response(JSON.stringify({ success: true, data: connectData, method: 'logout-connect' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Z-API restart
    const zapiUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/restart`;
    const zapiRes = await fetch(zapiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapi_client_token },
    });
    const zapiData = await zapiRes.json();

    if (!zapiRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to restart', details: zapiData }), {
        status: zapiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data: zapiData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
