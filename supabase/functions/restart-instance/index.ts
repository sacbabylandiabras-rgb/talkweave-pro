import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from '../_shared/cors.ts';
import {
  buildEvolutionInstanceCandidates,
  buildEvolutionUrlCandidates,
  buildStatusStrategies,
  executeStrategies,
  getEvolutionErrorMessage,
  isEvolutionConnected,
  parseEvolutionResponse,
} from '../_shared/evolution.ts';

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RestartStrategy {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  label: string;
}

const buildRestartStrategies = (baseUrl: string, apiKey: string, instanceName: string): RestartStrategy[] => {
  const encodedName = encodeURIComponent(instanceName);

  return [
    {
      url: `${baseUrl}/instance/restart/${encodedName}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      label: 'evo-restart-put',
    },
    {
      url: `${baseUrl}/instance/restart/${encodedName}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      label: 'evo-restart-post',
    },
    {
      url: `${baseUrl}/instance/restart/${encodedName}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      label: 'evo-restart-get',
    },
    {
      url: `${baseUrl}/instances/${encodedName}/restart`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
      label: 'custom-restart-post',
    },
    {
      url: `${baseUrl}/instances/${encodedName}/restart`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
      label: 'custom-restart-get',
    },
  ];
};

const buildRecoveryStrategies = (baseUrl: string, apiKey: string, instanceName: string): RestartStrategy[] => {
  const encodedName = encodeURIComponent(instanceName);

  return [
    {
      url: `${baseUrl}/instance/logout/${encodedName}`,
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      label: 'evo-logout-delete',
    },
    {
      url: `${baseUrl}/instance/logout/${encodedName}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      label: 'evo-logout-get',
    },
    {
      url: `${baseUrl}/instances/${encodedName}/logout`,
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
      label: 'custom-logout-delete',
    },
    {
      url: `${baseUrl}/instances/${encodedName}/logout`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
      label: 'custom-logout-post',
    },
    {
      url: `${baseUrl}/instance/connect/${encodedName}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      label: 'evo-connect-get',
    },
    {
      url: `${baseUrl}/instance/connect/${encodedName}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({}),
      label: 'evo-connect-post',
    },
    {
      url: `${baseUrl}/instances/${encodedName}/connect`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
      label: 'custom-connect-get',
    },
    {
      url: `${baseUrl}/instances/${encodedName}/connect`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
      body: JSON.stringify({}),
      label: 'custom-connect-post',
    },
  ];
};

const executeRestartStrategies = async (
  urlCandidates: string[],
  instanceCandidates: string[],
  apiKey: string,
  buildStrategies: (baseUrl: string, apiKey: string, instanceName: string) => RestartStrategy[],
  logPrefix: string,
) => {
  let lastResult: { status: number; data: any; rawText: string; strategy: string } = {
    status: 500,
    data: null,
    rawText: '',
    strategy: '',
  };

  for (const baseUrl of urlCandidates) {
    for (const instanceName of instanceCandidates) {
      for (const strategy of buildStrategies(baseUrl, apiKey, instanceName)) {
        try {
          console.log(`${logPrefix} Trying ${strategy.label} with instance '${instanceName}': ${strategy.url}`);
          const response = await fetch(strategy.url, {
            method: strategy.method,
            headers: strategy.headers,
            body: strategy.body,
          });

          const parsed = await parseEvolutionResponse(response);
          lastResult = {
            status: response.status,
            data: parsed.data,
            rawText: parsed.rawText,
            strategy: `${strategy.label}:${instanceName}`,
          };

          console.log(`${logPrefix} ${strategy.label} instance='${instanceName}' status=${response.status} body=${parsed.rawText.substring(0, 300)}`);

          if (response.ok) {
            return lastResult;
          }
        } catch (error) {
          lastResult = {
            status: 500,
            data: { error: String(error) },
            rawText: String(error),
            strategy: `${strategy.label}:${instanceName}`,
          };
          console.log(`${logPrefix} ${strategy.label} instance='${instanceName}' fetch error: ${error}`);
        }
      }
    }
  }

  return lastResult;
};

const getEvolutionStatus = async (urlCandidates: string[], instanceCandidates: string[], apiKey: string) => {
  return await executeStrategies(
    urlCandidates,
    (cfg) => buildStatusStrategies(cfg),
    apiKey,
    instanceCandidates,
    '🔍',
  );
};

const pollUntilRecovered = async (urlCandidates: string[], instanceCandidates: string[], apiKey: string) => {
  let lastStatus = await getEvolutionStatus(urlCandidates, instanceCandidates, apiKey);

  for (let attempt = 0; attempt < 4; attempt++) {
    if (lastStatus.status >= 200 && lastStatus.status < 300 && isEvolutionConnected(lastStatus.data)) {
      return { recovered: true, status: lastStatus };
    }

    await sleep(1500);
    lastStatus = await getEvolutionStatus(urlCandidates, instanceCandidates, apiKey);
  }

  return { recovered: false, status: lastStatus };
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

      // Try restart endpoint
      const restartRes = await fetch(`${evoUrl}/instance/restart/${encodeURIComponent(evoInstanceName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
      });

      console.log(`🔄 Restart response: ${restartRes.status}`);

      if (restartRes.ok) {
        const data = await restartRes.json().catch(() => ({}));
        const evoUrls = buildEvolutionUrlCandidates(evoUrl);
        const instanceCandidates = buildEvolutionInstanceCandidates(instance.zapi_instance_id, instance.instance_name);
        const statusCheck = await pollUntilRecovered(evoUrls, instanceCandidates, evoKey);

        if (statusCheck.recovered) {
          return new Response(JSON.stringify({ success: true, data, method: 'restart', status: statusCheck.status.data }), {
            headers: jsonHeaders,
          });
        }

        console.log(`🔄 Restart endpoint respondeu mas a instância continua travada; iniciando recuperação...`);
      }

      const evoUrls = buildEvolutionUrlCandidates(evoUrl);
      const instanceCandidates = buildEvolutionInstanceCandidates(instance.zapi_instance_id, instance.instance_name);

      console.log(`🔄 Restart falhou/não destravou, tentando estratégias alternativas...`);

      const restartAttempt = await executeRestartStrategies(
        evoUrls,
        instanceCandidates,
        evoKey,
        buildRestartStrategies,
        '🔄',
      );

      if (restartAttempt.status < 200 || restartAttempt.status >= 300) {
        console.log(`🔄 Restart direto sem sucesso (${restartAttempt.status}), tentando logout + connect...`);
      }

      const recoveryAttempt = await executeRestartStrategies(
        evoUrls,
        instanceCandidates,
        evoKey,
        buildRecoveryStrategies,
        '♻️',
      );

      const statusCheck = await pollUntilRecovered(evoUrls, instanceCandidates, evoKey);

      if (!statusCheck.recovered) {
        return new Response(JSON.stringify({
          error: 'Failed to restart',
          message: `A instância continua em '${statusCheck.status.data?.instance?.state || statusCheck.status.data?.state || statusCheck.status.data?.status || 'connecting'}' após a tentativa de reinício.`,
          details: {
            restartAttempt,
            recoveryAttempt,
            finalStatus: statusCheck.status,
          },
        }), {
          status: 409,
          headers: jsonHeaders,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          restartAttempt,
          recoveryAttempt,
          finalStatus: statusCheck.status.data,
        },
        method: recoveryAttempt.strategy || restartAttempt.strategy,
      }), {
        headers: jsonHeaders,
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
