import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts';
import { parseEvolutionResponse } from '../_shared/evolution.ts';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * For Evolution API: delete the stuck instance and recreate it.
 * This is the only reliable way to unstick "connecting" state in v2.2.x.
 */
const deleteAndRecreate = async (baseUrl: string, apiKey: string, name: string) => {
  const h = { 'Content-Type': 'application/json', apikey: apiKey };
  const enc = encodeURIComponent(name);

  // 1) Delete
  console.log(`🗑️ DELETE instance '${name}'`);
  const del = await fetch(`${baseUrl}/instance/delete/${enc}`, { method: 'DELETE', headers: h });
  const delP = await parseEvolutionResponse(del);
  console.log(`🗑️ status=${del.status} body=${delP.rawText.substring(0, 200)}`);
  if (!del.ok && del.status !== 404) {
    return { ok: false, step: 'delete', status: del.status, data: delP.data };
  }

  await sleep(2000);

  // 2) Recreate
  console.log(`🆕 CREATE instance '${name}'`);
  const create = await fetch(`${baseUrl}/instance/create`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ instanceName: name, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
  });
  const createP = await parseEvolutionResponse(create);
  console.log(`🆕 status=${create.status} body=${createP.rawText.substring(0, 200)}`);

  return { ok: create.ok, step: 'create', status: create.status, data: createP.data };
};

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

      // Step 1: Try logout (works if actually connected)
      const logoutRes = await fetch(`${evoUrl}/instance/logout/${encodeURIComponent(evoInstanceName)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
      });
      console.log(`🔄 Logout: ${logoutRes.status}`);

      if (logoutRes.ok) {
        await sleep(2000);
        const connectRes = await fetch(`${evoUrl}/instance/connect/${encodeURIComponent(evoInstanceName)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
        });
        const connectData = await connectRes.json().catch(() => ({}));
        console.log(`🔄 Connect after logout: ${connectRes.status}`);

        return new Response(JSON.stringify({
          success: true, data: connectData, method: 'logout-connect',
          message: 'Instância desconectada. Escaneie o QR Code para reconectar.',
        }), { headers: jsonHeaders });
      }

      // Step 2: Logout failed (stuck in connecting) — delete & recreate
      console.log(`🔄 Logout falhou (${logoutRes.status}), deletando e recriando...`);
      const result = await deleteAndRecreate(evoUrl, evoKey, evoInstanceName);

      return new Response(JSON.stringify({
        success: result.ok,
        data: result.data,
        method: 'delete-recreate',
        message: result.ok
          ? 'Instância recriada com sucesso. Escaneie o QR Code para conectar.'
          : `Falha ao ${result.step === 'delete' ? 'deletar' : 'recriar'} a instância.`,
      }), { status: result.ok ? 200 : 500, headers: jsonHeaders });
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
