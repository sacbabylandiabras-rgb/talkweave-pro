import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

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
      .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .single();

    if (instError || !instance) throw new Error('Instance not found');

    // Z-API restart
    const zapiUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/restart`;
    const zapiRes = await fetch(zapiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapi_client_token },
    });
    const zapiData = await zapiRes.json();

    if (!zapiRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to restart', details: zapiData }), {
        status: zapiRes.status, headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true, data: zapiData }), {
      headers: jsonHeaders,
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});