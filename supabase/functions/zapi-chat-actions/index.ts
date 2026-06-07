import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function formatErrorMessage(value: unknown, fallback = 'Erro ao processar solicitação'): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || fallback;
  if (Array.isArray(value)) return value.map((item) => formatErrorMessage(item, '')).filter(Boolean).join(' | ') || fallback;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const nested = obj.error || obj.message || obj.details || obj.description;
    if (nested && nested !== value) return formatErrorMessage(nested, fallback);
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return String(value);
}

async function resolveCreds(req: Request, instanceDbId?: string) {
  const auth = req.headers.get('authorization');
  if (!auth) throw new Error('Unauthorized');
  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const instanceSelect = 'id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, instance_type, evolution_api_url, evolution_api_key, instance_name';
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let q = admin.from('zapi_instances' as any)
    .select(instanceSelect)
    .eq('user_id', user.id);

  if (instanceDbId) {
    q = uuidLike.test(instanceDbId)
      ? q.eq('id', instanceDbId)
      : q.eq('zapi_instance_id', instanceDbId);
  } else {
    q = q.eq('is_default', true);
  }
  let { data: inst } = await q.or(`api_provider.eq.zapi,api_provider.eq.uazapi,api_provider.eq.uazapi_warmup,api_provider.eq.meta,api_provider.is.null`).maybeSingle();
  if (!inst) {
    const r = await admin.from('zapi_instances' as any)
      .select(instanceSelect)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .or('api_provider.eq.zapi,api_provider.eq.uazapi,api_provider.eq.uazapi_warmup,api_provider.eq.meta,api_provider.is.null')
      .limit(1)
      .maybeSingle();
    inst = r.data as any;
  }

  if (inst?.api_provider === 'meta' || (instanceDbId && instanceDbId.startsWith('meta:'))) {
     const metaId = instanceDbId ? instanceDbId.replace('meta:', '') : '';
     const { data: metaCreds } = await admin.from('meta_credentials' as any)
       .select('*')
       .eq('user_id', user.id)
       .or(`phone_number_id.eq.${metaId},waba_id.eq.${metaId}`)
       .eq('connected', true)
       .maybeSingle();
     
     if (metaCreds) {
       return {
         userId: user.id,
         instanceId: metaCreds.phone_number_id || metaCreds.waba_id,
         token: metaCreds.access_token,
         clientToken: '',
         apiProvider: 'meta',
       };
     }
  }

  return {
    userId: user.id,
    instanceId: inst?.zapi_instance_id ?? null,
    token: inst?.zapi_token ?? null,
    clientToken: inst?.zapi_client_token ?? null,
    apiProvider: inst?.api_provider || 'zapi',
    instanceType: inst?.instance_type,
    evolutionUrl: inst?.evolution_api_url,
    evolutionKey: inst?.evolution_api_key,
    instanceName: inst?.instance_name,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, phone, instanceDbId, payload } = await req.json();
    const creds = await resolveCreds(req, instanceDbId);
    const provider = creds.apiProvider.toLowerCase();

    if (provider === 'uazapi' || provider === 'uazapi_warmup') {
      const apiUrl = (creds.evolutionUrl || '').replace(/\/+$/, '');
      const apiToken = creds.evolutionKey || creds.token || '';
      
      if (!apiUrl || !apiToken) throw new Error('UAZAPI config missing');

      const withToken = (path: string) => `${apiUrl}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(apiToken)}`;

      if (action === 'get-privacy') {
        const res = await fetch(withToken('/instance/privacy'), { headers: { token: apiToken } });
        return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'get-messages-limits') {
        const res = await fetch(withToken('/instance/wa-messages-limits'), { headers: { token: apiToken } });
        return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action.startsWith('set-')) {
         const body: any = {};
         if (action === 'set-last-seen') body.lastSeen = payload.visualizationType;
         if (action === 'set-photo-visualization') body.profilePicture = payload.visualizationType;
         if (action === 'set-privacy-description') body.status = payload.visualizationType;
         if (action === 'set-group-add-permission') body.groupsAdd = payload.visualizationType;
         if (action === 'set-read-receipts') body.readReceipts = payload.active ? 'all' : 'none';
         if (action === 'set-messages-duration') body.disappearingMessages = String(payload.duration);

         const res = await fetch(withToken('/instance/privacy'), {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', token: apiToken },
           body: JSON.stringify(body) 
         });
         return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      return new Response(JSON.stringify({ error: 'Action not supported for this provider' }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Action not supported for this provider' }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});