import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function resolveCreds(req: Request, instanceDbId?: string) {
  const auth = req.headers.get('authorization');
  if (!auth) throw new Error('Unauthorized');
  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const sel = 'id, zapi_instance_id, zapi_token, zapi_client_token, api_provider';
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let q = admin.from('zapi_instances').select(sel).eq('user_id', user.id).eq('api_provider', 'zapi');
  if (instanceDbId) {
    q = uuidLike.test(instanceDbId) ? q.eq('id', instanceDbId) : q.eq('zapi_instance_id', instanceDbId);
  } else {
    q = q.eq('is_default', true);
  }
  let { data: inst } = await q.maybeSingle();
  if (!inst) {
    const r = await admin.from('zapi_instances').select(sel).eq('user_id', user.id).eq('api_provider', 'zapi').eq('is_active', true).limit(1).maybeSingle();
    inst = r.data as any;
  }
  if (!inst?.zapi_instance_id || !inst?.zapi_token || !inst?.zapi_client_token) {
    throw new Error('Credenciais da conexão WhatsApp não configuradas');
  }
  return {
    instanceId: inst.zapi_instance_id,
    token: inst.zapi_token,
    clientToken: inst.zapi_client_token,
  };
}

const ACTION_PATHS: Record<string, string> = {
  'registration-available': '/mobile/registration-available',
  'request-code': '/mobile/request-code',
  'captcha-confirm': '/mobile/captcha-confirm',
  'confirm-code': '/mobile/confirm-code',
  'confirm-security-code': '/mobile/confirm-security-code',
  'forgot-security-code': '/mobile/forgot-security-code',
  'request-unbanning': '/mobile/request-unbanning',
  'device-transfer-confirmed': '/mobile/device-transfer-confirmed',
};

function formatErr(value: unknown, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message || fallback;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const n = o.error || o.message || o.reason || o.details;
    if (n && n !== value) return formatErr(n, fallback);
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return String(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, instanceDbId, payload } = body || {};
    if (!action) throw new Error('Missing action');
    const path = ACTION_PATHS[action];
    if (!path) throw new Error('Unknown action: ' + action);

    const creds = await resolveCreds(req, instanceDbId || undefined);
    const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}${path}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': creds.clientToken,
      },
      body: JSON.stringify(payload || {}),
    });
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: formatErr(data, `Erro HTTP ${resp.status}`), details: data, status: resp.status }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});