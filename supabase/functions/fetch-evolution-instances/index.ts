import { corsHeaders } from "../_shared/cors.ts";
import {
  buildEvolutionUrlCandidates,
  executeStrategies,
  getEvolutionErrorMessage,
} from "../_shared/evolution.ts";

const buildFetchInstancesStrategies = (baseUrl: string, apiKey: string) => [
  {
    url: `${baseUrl}/instance/fetchInstances`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    label: 'evo-v2-fetchInstances',
  },
  {
    url: `${baseUrl}/instance/fetchInstances`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
    label: 'client-token-fetchInstances',
  },
  {
    url: `${baseUrl}/instance/fetchInstances`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    label: 'bearer-fetchInstances',
  },
  {
    url: `${baseUrl}/instance/fetchInstances`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    label: 'raw-auth-fetchInstances',
  },
  {
    url: `${baseUrl}/instances`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Client-Token': apiKey },
    label: 'custom-list-instances',
  },
];

const normalizeInstances = (payload: any) => {
  const rawList =
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.instances) && payload.instances) ||
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.response) && payload.response) ||
    (payload && typeof payload === 'object' && (
      payload.instanceName ||
      payload.instance?.instanceName ||
      payload.name ||
      payload.id ||
      payload.instance?.id
    ) ? [payload] : []);

  return rawList.map((item: any) => ({
    raw: item,
    instanceName:
      item?.instance?.instanceName ||
      item?.instanceName ||
      item?.instance?.name ||
      item?.name ||
      item?.instance?.id ||
      item?.instanceId ||
      item?.id ||
      '',
    status:
      item?.instance?.status ||
      item?.status ||
      item?.connectionStatus ||
      item?.instance?.state ||
      'unknown',
  }));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { evolution_api_url, evolution_api_key } = await req.json();

    if (!evolution_api_url || !evolution_api_key) {
      return new Response(JSON.stringify({ error: 'URL e API Key são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const urlCandidates = buildEvolutionUrlCandidates(evolution_api_url);
    const result = await executeStrategies(
      urlCandidates,
      (cfg) => buildFetchInstancesStrategies(cfg.baseUrl, cfg.apiKey),
      evolution_api_key,
      ['list'],
      '📲',
    );

    if (result.status < 200 || result.status >= 300) {
      return new Response(JSON.stringify({
        error: getEvolutionErrorMessage(
          result.data,
          result.status,
          `Servidor Evolution retornou HTTP ${result.status}`,
        ),
        strategy: result.strategy,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = normalizeInstances(result.data);

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});