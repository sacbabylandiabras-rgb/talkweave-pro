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

  const instanceSelect = 'id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key';
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let q = admin.from('zapi_instances')
    .select(instanceSelect)
    .eq('user_id', user.id)
    .eq('api_provider', 'zapi');
  if (instanceDbId) {
    q = uuidLike.test(instanceDbId)
      ? q.eq('id', instanceDbId)
      : q.eq('zapi_instance_id', instanceDbId);
  } else {
    q = q.eq('is_default', true);
  }
  let { data: inst } = await q.maybeSingle();
  if (!inst) {
    const r = await admin.from('zapi_instances')
      .select(instanceSelect)
      .eq('user_id', user.id).eq('api_provider', 'zapi').eq('is_active', true).limit(1).maybeSingle();
    inst = r.data as any;
  }
  if (!inst?.zapi_instance_id || !inst?.zapi_token || !inst?.zapi_client_token) {
    throw new Error('Z-API credentials not configured');
  }
  return {
    instanceId: inst.zapi_instance_id,
    token: inst.zapi_token,
    clientToken: inst.zapi_client_token,
    apiProvider: inst.api_provider || 'zapi',
    evolutionUrl: inst.evolution_api_url,
    evolutionKey: inst.evolution_api_key,
  };
}

function endpointFor(action: string, phone: string, payload: any, apiProvider: string) {
  const zapiPhone = phone.includes('-group') ? phone.replace(/-group$/i, '@g.us') : phone;
  const expirationMap: Record<string, string> = {
    '0': 'OFF',
    '86400': '24_HOURS',
    '604800': '7_DAYS',
    '7776000': '90_DAYS',
  };

  switch (action) {
    case 'list-chats':
      return { method: 'GET', path: "/chats?page=" + (payload?.page ?? 1) + "&pageSize=" + (payload?.pageSize ?? 50) };
    case 'metadata':
      return { method: 'GET', path: "/chats/" + zapiPhone };
    case 'read':
      return { method: 'POST', path: "/read-chat", body: { phone: zapiPhone, action: "read" } };
    case 'unread':
      return { method: 'POST', path: "/read-chat", body: { phone: zapiPhone, action: "unread" } };
    case 'archive':
      return { method: 'POST', path: "/archive-chat", body: { phone: zapiPhone, action: "archive" } };
    case 'unarchive':
      return { method: 'POST', path: "/archive-chat", body: { phone: zapiPhone, action: "unarchive" } };
    case 'pin':
      return { method: 'POST', path: "/pin-chat", body: { phone: zapiPhone, action: "pin" } };
    case 'unpin':
      return { method: 'POST', path: "/pin-chat", body: { phone: zapiPhone, action: "unpin" } };
    case 'mute':
      return { method: 'POST', path: "/mute-chat", body: { phone: zapiPhone, action: "mute" } };
    case 'unmute':
      return { method: 'POST', path: "/mute-chat", body: { phone: zapiPhone, action: "unmute" } };
    case 'clear':
      return { method: 'POST', path: "/clear-chat/" + zapiPhone, body: { phone: zapiPhone, action: "clear" } };
    case 'delete':
      return { method: 'DELETE', path: "/delete-chat/" + zapiPhone, body: { phone: zapiPhone, action: "delete" } };
     case 'expiration':
        return { method: 'POST', path: "/send-chat-expiration", body: { phone: zapiPhone, chatExpiration: expirationMap[String(payload?.expiration ?? 0)] || 'OFF' } };
 
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
       return { method: 'GET', path: "/phone-exists/" + phone };
     case 'get-iswhatsapp-batch':
       return { method: 'POST', path: "/phone-exists-batch", body: { phones: payload?.phones || [] } };
     case 'block-contact':
       return { method: 'POST', path: "/contacts/modify-blocked", body: { phone, action: payload?.action || 'block' } };
     case 'unblock-contact':
       return { method: 'POST', path: "/contacts/modify-blocked", body: { phone, action: 'unblock' } };
     case 'report-contact':
       return { method: 'POST', path: "/contacts/" + phone + "/report", body: null };
 
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

    // Call Actions
    case 'send-call':
      return { method: 'POST', path: '/send-call', body: payload };
    case 'call-token':
      return { method: 'GET', path: '/call-token' };
    case 'sip-token':
      return { method: 'GET', path: '/sip-token' };
     case 'sip-info':
       return { method: 'GET', path: '/sip-info' };

    // Status Actions
    case 'send-text-status':
      return { method: 'POST', path: "/send-text-status", body: payload };
    case 'send-image-status':
      return { method: 'POST', path: "/send-image-status", body: payload };
    case 'send-video-status':
      return { method: 'POST', path: "/send-video-status", body: payload };
    case 'reply-status-text':
      return { method: 'POST', path: "/reply-status-text", body: payload };
    case 'reply-status-gif':
      return { method: 'POST', path: "/reply-status-gif", body: payload };
    case 'reply-status-sticker':
      return { method: 'POST', path: "/reply-status-sticker", body: payload };

    // Group Actions
    case 'get-groups':
      return { method: 'GET', path: "/groups?page=" + (payload?.page ?? 1) + "&pageSize=" + (payload?.pageSize ?? 50) };
    case 'create-group':
      return { method: 'POST', path: "/create-group", body: payload };
    case 'update-group-name':
      return { method: 'POST', path: "/update-group-name", body: payload };
    case 'update-group-photo':
      return { method: 'POST', path: "/update-group-photo", body: payload };
    case 'add-participant':
      return { method: 'POST', path: "/add-participant", body: payload };
    case 'remove-participant':
      return { method: 'POST', path: "/remove-participant", body: payload };
    case 'approve-participant':
      return { method: 'POST', path: "/approve-participant", body: payload };
    case 'reject-participant':
      return { method: 'POST', path: "/reject-participant", body: payload };
    case 'mention-participant':
      return { method: 'POST', path: "/mention-participant", body: payload };
    case 'mention-group':
      return { method: 'POST', path: "/mention-group", body: payload };
    case 'mention-all':
      return { method: 'POST', path: "/mention-all", body: payload };
    case 'add-admin':
      return { method: 'POST', path: "/add-admin", body: payload };
    case 'remove-admin':
      return { method: 'POST', path: "/remove-admin", body: payload };
    case 'leave-group':
      return { method: 'POST', path: "/leave-group", body: payload };
    case 'metadata-group':
      return { method: 'GET', path: "/metadata-group/" + phone };
    case 'light-group-metadata':
      return { method: 'GET', path: "/light-group-metadata/" + phone };
    case 'group-invitation-metadata':
      return { method: 'GET', path: "/group-invitation-metadata?inviteUrl=" + encodeURIComponent(payload?.inviteUrl || '') };
    case 'update-group-settings':
      return { method: 'POST', path: "/update-group-settings", body: payload };
    case 'update-group-description':
      return { method: 'POST', path: "/update-group-description", body: payload };
    case 'redefine-invitation-link':
      return { method: 'POST', path: "/redefine-invitation-link", body: payload };
    case 'get-invitation-link':
      return { method: 'GET', path: "/get-invitation-link/" + phone };
    case 'accept-group-invite':
      return { method: 'POST', path: "/accept-group-invite", body: payload };

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

    const creds = await resolveCreds(req, instanceDbId || undefined);
    const base = "https://api.z-api.io/instances/" + creds.instanceId + "/token/" + creds.token;
    const ep = endpointFor(action, phone, payload, creds.apiProvider);

   let url: string;
    url = base + ep.path;

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
      console.error(`[zapi-chat-actions] ${ep.method} ${url} -> ${resp.status}`, text);
      return new Response(JSON.stringify({ error: data, status: resp.status }), {
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
