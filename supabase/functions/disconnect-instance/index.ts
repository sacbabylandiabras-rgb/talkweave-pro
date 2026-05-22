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

    const { instanceId, zapiInstanceId } = await req.json();
    if (!instanceId && !zapiInstanceId) throw new Error('instanceId or zapiInstanceId is required');

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    let query = adminClient.from('zapi_instances').select('*').eq('user_id', user.id);
    
    if (instanceId) {
      query = query.eq('id', instanceId);
    } else {
      query = query.eq('zapi_instance_id', zapiInstanceId);
    }

    const { data: instance, error: instError } = await query.single();

    if (instError || !instance) throw new Error('Instance not found');

    const provider = instance.api_provider || 'zapi';

    if (provider === 'uazapi' || provider === 'uazapi_warmup') {
      const apiUrl = (instance.evolution_api_url || '').replace(/\/+$/, '');
      const apiToken = instance.evolution_api_key || instance.zapi_token || '';

      if (!apiUrl || !apiToken) {
        throw new Error('UAZAPI URL/Token não configurados');
      }

      const disconnectEndpoints = [`${apiUrl}/instance/disconnect`, `${apiUrl}/instance/logout`];
      let disconnectData: any = {};
      let disconnectStatus = 500;
      let disconnected = false;

      for (const endpoint of disconnectEndpoints) {
        try {
          const disconnectRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: apiToken },
          });

          const disconnectText = await disconnectRes.text();
          try { disconnectData = JSON.parse(disconnectText); } catch { disconnectData = { message: disconnectText }; }
          disconnectStatus = disconnectRes.status;

          if (disconnectRes.ok) {
            disconnected = true;
            break;
          }
        } catch (e) {
          console.error(`Error disconnecting ${endpoint}:`, e);
        }
      }

      if (!disconnected) {
        return new Response(JSON.stringify({ error: 'Failed to disconnect', details: disconnectData }), {
          status: disconnectStatus,
          headers: jsonHeaders,
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Instância desconectada com sucesso.' }), {
        headers: jsonHeaders,
      });
    }

    // Z-API disconnect
    const zapiUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/disconnect`;
    
    // Z-API disconnect can be GET or POST depending on the version, but GET is common for their URL structure
    const zapiRes = await fetch(zapiUrl, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json', 
        'Client-Token': instance.zapi_client_token 
      },
    });

    const zapiText = await zapiRes.text();
    let zapiData: any = {};
    try { zapiData = JSON.parse(zapiText); } catch { zapiData = { message: zapiText }; }

    if (!zapiRes.ok) {
      // If GET failed, try POST as a fallback
      if (zapiRes.status === 405 || zapiRes.status === 400) {
        const zapiResPost = await fetch(zapiUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Client-Token': instance.zapi_client_token 
          },
          body: JSON.stringify({})
        });
        
        if (zapiResPost.ok) {
          const zapiDataPost = await zapiResPost.json().catch(() => ({ success: true }));
          return new Response(JSON.stringify({ success: true, data: zapiDataPost }), {
            headers: jsonHeaders,
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Failed to disconnect', details: zapiData }), {
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
