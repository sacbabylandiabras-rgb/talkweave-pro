import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  let q = admin.from('zapi_instances')
    .select('id, zapi_instance_id, zapi_token, zapi_client_token')
    .eq('user_id', user.id);
  if (instanceDbId) {
    q = q.eq('id', instanceDbId);
  } else {
    q = q.eq('is_default', true);
  }
  let { data: inst } = await q.maybeSingle();
  if (!inst) {
    const r = await admin.from('zapi_instances')
      .select('id, zapi_instance_id, zapi_token, zapi_client_token')
      .eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle();
    inst = r.data as any;
  }
  if (!inst?.zapi_instance_id || !inst?.zapi_token || !inst?.zapi_client_token) {
    throw new Error('Z-API credentials not configured');
  }
  return {
    instanceId: inst.zapi_instance_id,
    token: inst.zapi_token,
    clientToken: inst.zapi_client_token,
  };
}

function buildBase(c: { instanceId: string; token: string }) {
  return "https://api.z-api.io/instances/" + c.instanceId + "/token/" + c.token;
}

function endpointFor(action: string, phone: string, payload: any) {
  switch (action) {
    case 'list-chats':
      return { method: 'GET', path: "/chats?page=" + (payload?.page ?? 1) + "&pageSize=" + (payload?.pageSize ?? 50) };
    case 'metadata':
      return { method: 'GET', path: "/chats/" + phone };
    case 'read':
      return { method: 'POST', path: "/chats/" + phone + "/read" };
    case 'unread':
      return { method: 'POST', path: "/chats/" + phone + "/unread" };
    case 'archive':
      return { method: 'POST', path: "/modify-chat", body: { phone, action: 'archive' } };
    case 'unarchive':
      return { method: 'POST', path: "/modify-chat", body: { phone, action: 'unarchive' } };
    case 'pin':
      return { method: 'POST', path: "/modify-chat", body: { phone, action: 'pin' } };
    case 'unpin':
      return { method: 'POST', path: "/modify-chat", body: { phone, action: 'unpin' } };
    case 'mute':
      return { method: 'POST', path: "/mute-chat", body: { phone, muteFor: payload?.muteFor ?? 28800 } };
    case 'unmute':
      return { method: 'POST', path: "/mute-chat", body: { phone, muteFor: 0 } };
    case 'clear':
      return { method: 'POST', path: "/clear-chat", body: { phone } };
    case 'delete':
      return { method: 'DELETE', path: "/chats/" + phone };
     case 'expiration':
       return { method: 'POST', path: "/send-chat-expiration", body: { phone, expiration: payload?.expiration ?? 0 } };
 
     // Contact Actions
     case 'get-contacts':
       return { method: 'GET', path: "/contacts?page=" + (payload?.page ?? 1) + "&pageSize=" + (payload?.pageSize ?? 50) };
     case 'add-contacts':
       return { method: 'POST', path: "/add-contact", body: payload };
     case 'remove-contacts':
       return { method: 'POST', path: "/remove-contact", body: payload };
     case 'get-metadata-contact':
       return { method: 'GET', path: "/contacts/" + phone };
     case 'get-profile-picture':
       return { method: 'GET', path: "/profile-picture?phone=" + phone };
     case 'get-iswhatsapp':
       return { method: 'GET', path: "/is-whatsapp/" + phone };
     case 'get-iswhatsapp-batch':
       return { method: 'POST', path: "/is-whatsapp-batch", body: { phones: payload?.phones || [] } };
     case 'block-contact':
       return { method: 'POST', path: "/block-contact", body: { phone } };
     case 'report-contact':
       return { method: 'POST', path: "/report-contact", body: { phone } };
 
     case 'get-disallowed-contacts':
      return { method: 'GET', path: '/privacy/disallowed-contacts' };
    case 'set-last-seen':
      return { method: 'POST', path: '/privacy/last-seen', body: { visualizationType: payload?.visualizationType } };
    case 'set-photo-visualization':
      return { method: 'POST', path: '/privacy/photo-visualization', body: { visualizationType: payload?.visualizationType } };
    case 'set-privacy-description':
      return { method: 'POST', path: '/privacy/privacy-description', body: { visualizationType: payload?.visualizationType } };
    case 'set-group-add-permission':
      return { method: 'POST', path: '/privacy/group-add-permission', body: { visualizationType: payload?.visualizationType } };
    case 'set-privacy-online':
      return { method: 'POST', path: '/privacy/privacy-online', body: { visualizationType: payload?.visualizationType } };
    case 'set-read-receipts':
      return { method: 'POST', path: '/privacy/read-receipts', body: { active: payload?.active } };
    case 'set-messages-duration':
      return { method: 'POST', path: '/privacy/messages-duration', body: { duration: payload?.duration } };

    default:
      throw new Error("Unknown action: " + action);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, phone = '', instanceDbId, payload } = body;
    if (!action) throw new Error('Missing action');

    const creds = await resolveCreds(req, instanceDbId);
    const base = buildBase(creds);
    const ep = endpointFor(action, phone, payload);

    const url = base + ep.path;
    const init: RequestInit = {
      method: ep.method,
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': creds.clientToken,
      },
    };
    if (ep.body) init.body = JSON.stringify(ep.body);

    const resp = await fetch(url, init);
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data, status: resp.status }), {
        status: resp.status,
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
