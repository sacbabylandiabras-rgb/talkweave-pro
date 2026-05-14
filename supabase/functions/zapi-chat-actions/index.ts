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

  const instanceSelect = 'id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key';
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let q = admin.from('zapi_instances' as any)
    .select(instanceSelect)
    .eq('user_id', user.id);

  // Filter by provider if needed, but for list-tags etc we might want to be flexible
  // For now let's just find any active instance if none specified
  if (instanceDbId) {
    q = uuidLike.test(instanceDbId)
      ? q.eq('id', instanceDbId)
      : q.eq('zapi_instance_id', instanceDbId);
  } else {
    q = q.eq('is_default', true);
  }
  let { data: inst } = await q.or(`api_provider.eq.zapi,api_provider.eq.meta,api_provider.is.null`).maybeSingle();
  if (!inst) {
    const r = await admin.from('zapi_instances' as any)
      .select(instanceSelect)
      .eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle();
    inst = r.data as any;
  }

  // If it's a Meta instance, the structure is different
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
    instanceId: inst.zapi_instance_id,
    token: inst.zapi_token,
    clientToken: inst.zapi_client_token,
    apiProvider: inst.api_provider || 'zapi',
    evolutionUrl: inst.evolution_api_url,
    evolutionKey: inst.evolution_api_key,
  };
}

const normalizeMessageText = (value: unknown) => String(value || '')
  .replace(/^\[sender:[^\]]*\]\s*/i, '')
  .replace(/^\[msgid:[^\]]*\]\s*/i, '')
  .replace(/^\[media:[^\]]+\]\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const extractProviderMessageId = (msg: any) => String(
  msg?.id || msg?.messageId || msg?.messageid || msg?.zaapId || msg?.key?.id || ''
).trim();

const extractProviderMessageText = (msg: any) => String(
  msg?.content?.conversation
    || msg?.content?.extendedTextMessage?.text
    || msg?.content
    || msg?.text
    || msg?.body
    || msg?.message
    || msg?.caption
    || ''
).trim();

const toMillis = (value: unknown) => {
  const raw = Number(value);
  if (Number.isFinite(raw) && raw > 0) return raw < 4102444800 ? raw * 1000 : raw;
  const parsed = new Date(String(value || '')).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

async function resolveStoredMessageId(admin: any, creds: any, phone: string, payload: any) {
  const rawMessageId = String(payload?.messageId || '').trim();
  const logMatch = rawMessageId.match(/^log-(?:recv|sent)-(.+)$/);
  if (!logMatch) return rawMessageId;

  const { data: log } = await admin
    .from('message_logs')
    .select('id, phone, message_received, response_sent, keyword_matched, timestamp, created_at')
    .eq('user_id', creds.userId)
    .eq('id', logMatch[1])
    .maybeSingle();

  const keywordId = String(log?.keyword_matched || '').match(/^__msg_import__:(.+)$/)?.[1];
  if (keywordId) return keywordId;

  const contentWithPrefix = String(log?.message_received || log?.response_sent || '');
  const prefixedId = contentWithPrefix.match(/^\[msgid:([^\]]+)\]/i)?.[1];
  if (prefixedId) return prefixedId;

  const chatPhone = String(log?.phone || phone || '').replace(/-group$/i, '').replace(/\D/g, '');
  const expectedText = normalizeMessageText(contentWithPrefix);
  if (!chatPhone || !expectedText) return rawMessageId;

  const base = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}`;
  const resp = await fetch(`${base}/chat-messages/${chatPhone}?amount=80`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Client-Token': creds.clientToken },
  });
  if (!resp.ok) return rawMessageId;

  const data = await resp.json().catch(() => null);
  const messages = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : []);
  const logTime = toMillis(log?.timestamp || log?.created_at);

  let best: { id: string; score: number } | null = null;
  for (const item of messages) {
    const id = extractProviderMessageId(item);
    if (!id) continue;
    const itemText = normalizeMessageText(extractProviderMessageText(item));
    if (!itemText || itemText !== expectedText) continue;
    const itemTime = toMillis(item?.messageTimestamp || item?.timestamp || item?.t || item?.sent_at);
    const score = logTime && itemTime ? Math.abs(logTime - itemTime) : 0;
    if (!best || score < best.score) best = { id, score };
  }

  return best?.id || rawMessageId;
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
      return { method: 'PUT', path: "/chats/" + zapiPhone + "/read", body: { value: true } };
    case 'unread':
      return { method: 'PUT', path: "/chats/" + zapiPhone + "/read", body: { value: false } };
    case 'archive':
      return { method: 'PUT', path: "/chats/" + zapiPhone + "/archive", body: { value: true } };
    case 'unarchive':
      return { method: 'PUT', path: "/chats/" + zapiPhone + "/archive", body: { value: false } };
    case 'pin':
      return { method: 'PUT', path: "/chats/" + zapiPhone + "/pin", body: { value: true } };
    case 'unpin':
      return { method: 'PUT', path: "/chats/" + zapiPhone + "/pin", body: { value: false } };
    case 'mute':
      return { method: 'PUT', path: "/chats/" + zapiPhone + "/mute", body: { value: true, muteFor: payload?.muteFor ?? 28800 } };
    case 'unmute':
      return { method: 'PUT', path: "/chats/" + zapiPhone + "/mute", body: { value: false } };
    case 'clear':
      return { method: 'DELETE', path: "/chats/" + zapiPhone + "/messages" };
    case 'delete':
      return { method: 'DELETE', path: "/chats/" + zapiPhone };
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
    case 'set-read-receipts': {
      const value = payload?.active === true || payload?.active === 'true' || payload?.value === 'enable' ? 'enable' : 'disable';
      return { method: 'POST', path: `/privacy/read-receipts?value=${value}` };
    }
    case 'set-messages-duration': {
      const durationMap: Record<string, string> = {
        '0': 'disable',
        '86400': 'hours24',
        '604800': 'days7',
        '7776000': 'days90',
      };
      const value = durationMap[String(payload?.duration ?? 0)] || 'disable';
      return { method: 'POST', path: `/privacy/messages-duration?value=${value}` };
    }

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

    // Business / Catalog Actions
    case 'list-collections':
      return { method: 'GET', path: `/catalogs/collections?phone=${phone}` };
    case 'create-collection':
      return { method: 'POST', path: "/catalogs/collection", body: payload };
    case 'edit-collection':
      return { method: 'POST', path: `/catalogs/collection-edit/${payload?.collectionId}`, body: { name: payload?.name } };
    case 'delete-collection':
      return { method: 'DELETE', path: `/catalogs/collection/${payload?.collectionId}` };
    case 'add-products-to-collection':
      return { method: 'POST', path: "/catalogs/collection/add-product", body: payload };
    case 'remove-products-from-collection':
      return { method: 'POST', path: "/catalogs/collection/remove-product", body: payload };
    case 'list-collection-products':
      return { method: 'GET', path: `/catalogs/collection-products/${payload?.collectionId}?phone=${phone}` };
    case 'company-description':
      return { method: 'POST', path: "/business/company-description", body: { value: payload?.description ?? payload?.value } };
    case 'company-email':
      return { method: 'POST', path: "/business/company-email", body: { value: payload?.email ?? payload?.value } };
    case 'company-address':
      return { method: 'POST', path: "/business/company-address", body: { value: payload?.address ?? payload?.value } };
     case 'company-websites':
       return { method: 'POST', path: "/business/company-websites", body: { websites: payload?.websites || (payload?.value ? [payload.value] : []) } };
    case 'business-hours':
      return { method: 'POST', path: "/business/hours", body: payload };
    case 'available-categories':
      return { method: 'GET', path: "/business/available-categories" };
    case 'company-categories':
      return { method: 'POST', path: "/business/categories", body: payload };
     case 'business-profile':
       return { method: 'GET', path: "/business/profile" };
      case 'list-products':
        if (payload?.phone) {
          return { method: 'GET', path: `/catalogs-v2?phone=${payload.phone}` };
        }
        return { method: 'POST', path: "/catalogs", body: { nextCursor: payload?.nextCursor || null } };
     case 'edit-product':
     case 'create-product':
       return { method: 'POST', path: "/products", body: payload };
     case 'delete-product':
       return { method: 'DELETE', path: `/products/${payload?.id}` };
      case 'get-product':
        return { method: 'GET', path: `/products/${payload?.id}` };

    // Tag Actions (WhatsApp Business)
    case 'list-tags':
      return { method: 'GET', path: "/tags" };
    case 'create-tag': {
      const body: any = { name: payload?.name };
      if (payload?.color !== undefined) {
        body.color = payload.color;
      }
      return { method: 'POST', path: "/business/create-tag", body };
    }
    case 'delete-tag':
      return { method: 'DELETE', path: `/business/tag/${payload?.id}` };
    case 'edit-tag':
      return { method: 'POST', path: `/business/edit-tag/${payload?.id}`, body: { name: payload?.name, color: payload?.color } };
    case 'add-tag-chat': {
      const target = phone.includes('-group') ? phone.replace(/-group$/i, '@g.us') : phone;
      return { method: 'PUT', path: `/chats/${target}/tags/${payload?.tagId}/add` };
    }
    case 'remove-tag-chat': {
      const target = phone.includes('-group') ? phone.replace(/-group$/i, '@g.us') : phone;
      return { method: 'PUT', path: `/chats/${target}/tags/${payload?.tagId}/remove` };
    }
    case 'search-tags':
      return { method: 'GET', path: `/tags/search?tagId=${payload?.tagId}` };
    case 'tag-colors':
      return { method: 'GET', path: "/business/tags/colors" };
    case 'save-chat-notes': {
      const target = phone.includes('-group') ? phone.replace(/-group$/i, '@g.us') : phone;
      return { method: 'POST', path: `/chat-notes/${target}`, body: { notes: payload?.notes } };
    }

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

    // Business / Catalog Config Actions
    case 'save-catalog-config':
      return { method: 'POST', path: "/business/save-catalog-config", body: payload };

     // Message Actions
     case 'forward-message':
      return { method: 'POST', path: "/forward-message", body: { ...payload, phone: zapiPhone } };
    case 'send-message-reaction':
      return { method: 'POST', path: "/send-reaction", body: { ...payload, phone: zapiPhone } };
    case 'send-remove-reaction':
      return { method: 'POST', path: "/send-remove-reaction", body: payload };

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

    if (creds.apiProvider === 'meta') {
       // Gracefully return empty data for actions not supported by Meta yet
       if (action === 'tag-colors') return new Response(JSON.stringify({ data: {} }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       if (action === 'list-tags') return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       if (action === 'status') return new Response(JSON.stringify({ data: { connected: true } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       
       return new Response(JSON.stringify({ error: 'Ação não suportada para Meta API' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let finalPayload = payload;

    if ((action === 'send-message-reaction' || action === 'send-remove-reaction' || action === 'forward-message') && payload?.messageId) {
      const resolvedMessageId = await resolveStoredMessageId(admin, creds, phone, payload);
      finalPayload = { ...payload, messageId: resolvedMessageId };
    }

    const base = "https://api.z-api.io/instances/" + creds.instanceId + "/token/" + creds.token;
    const ep = endpointFor(action, phone, finalPayload, creds.apiProvider);
    
    console.log(`[zapi-chat-actions] Executing ${action} for ${phone} via ${creds.instanceId}`);
    console.log(`[zapi-chat-actions] URL: ${ep.method} ${base}${ep.path}`);
    if (ep.body) console.log(`[zapi-chat-actions] Body:`, JSON.stringify(ep.body));

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

    console.log(`[zapi-chat-actions] Z-API Response (${resp.status}):`, text);

    if (!resp.ok) {
      console.error(`[zapi-chat-actions] Z-API Error: ${ep.method} ${url} -> ${resp.status}`, text);
      return new Response(JSON.stringify({ error: formatErrorMessage(data, `Erro HTTP ${resp.status}`), details: data, status: resp.status }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normaliza resposta de cores: API retorna { "0": "#FF9485", ... }
    // UI espera: [{ id, hex, label }]
    if (action === 'tag-colors' && data && typeof data === 'object' && !Array.isArray(data)) {
      data = Object.entries(data)
        .map(([id, hex]) => ({
          id: Number(id),
          hex: String(hex),
          label: `Cor ${Number(id) + 1}`,
        }))
        .sort((a, b) => a.id - b.id);
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
