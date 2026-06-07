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
  if (!auth) { console.error('No auth header'); throw new Error('Unauthorized'); }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = auth.replace(/^Bearer\s+/i, '');
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) { console.error('getUser failed', error?.message, 'tokenLen', token.length); throw new Error('Unauthorized'); }

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
    apiProvider: inst?.api_provider || 'uazapi',
    instanceType: inst?.instance_type,
    evolutionUrl: inst?.evolution_api_url,
    evolutionKey: inst?.evolution_api_key,
    instanceName: inst?.instance_name,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const jsonPayload = await req.json().catch(() => ({}));
    const { action, phone, instanceDbId, payload } = jsonPayload;
    console.log(`[zapi-chat-actions] Request: action=${action}, phone=${phone}, instanceDbId=${instanceDbId}`);
    const creds = await resolveCreds(req, instanceDbId);
    const provider = creds.apiProvider.toLowerCase();

    if (provider === 'uazapi' || provider === 'uazapi_warmup' || provider === 'evolution') {
      const apiUrl = (creds.evolutionUrl || '').replace(/\/+$/, '');
      const apiToken = creds.evolutionKey || creds.token || '';
      const inst = creds.instanceName || creds.instanceId || '1';
      
      if (!apiUrl || !apiToken) throw new Error('UAZAPI config missing');

      // Helper to construct Evolution API / UAZAPI URLs with token in query string
      const withToken = (path: string) => `${apiUrl}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(apiToken)}`;
      const evolutionHeaders = { 'Content-Type': 'application/json', 'token': apiToken, 'apikey': apiToken };

      if (action === 'get-privacy') {
        const res = await fetch(withToken(`/instance/fetchPrivacy/${inst}`), { headers: evolutionHeaders });
        return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'get-messages-limits') {
        const res = await fetch(withToken(`/instance/wa-messages-limits/${inst}`), { headers: evolutionHeaders });
        return new Response(JSON.stringify(await res.json()), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'get-disallowed-contacts') {
        const res = await fetch(withToken(`/chat/blocklist/${inst}`), { headers: evolutionHeaders });
        const raw = await res.json();
        const arr: string[] = Array.isArray(raw?.blockList) ? raw.blockList : (Array.isArray(raw) ? raw : []);
        const list = arr.map((j) => ({ phone: String(j).replace(/@.+$/, '') }));
        return new Response(JSON.stringify({ data: { value: list } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'business-profile') {
        const statusRes = await fetch(withToken(`/instance/status/${inst}`), { headers: evolutionHeaders });
        const statusRaw = await statusRes.json().catch(() => ({}));
        const instData = statusRaw?.instance || {};
        let business = statusRaw?.business || statusRaw?.businessProfile || {};

        if (instData.owner) {
          const jid = String(instData.owner).includes('@') ? String(instData.owner) : `${String(instData.owner).replace(/\D/g, '')}@s.whatsapp.net`;
          const businessRes = await fetch(withToken(`/business/get/profile/${inst}`), {
            method: 'POST',
            headers: evolutionHeaders,
            body: JSON.stringify({ jid }),
          });
          const businessRaw = await businessRes.json().catch(() => ({}));
          business = businessRaw?.response || businessRaw?.data || businessRaw?.profile || business;
        }

        const profile = {
          description: business.description || instData.profileName || creds.instanceName || '',
          email: business.email || '',
          address: business.address || '',
          websites: Array.isArray(business.websites) ? business.websites : [],
          categories: Array.isArray(business.categories)
            ? business.categories.map((category: any) => ({
                id: String(category.id || category.value || ''),
                label: String(category.localized_display_name || category.label || category.name || category.id || ''),
              })).filter((category: any) => category.id || category.label)
            : [],
          businessHours: null,
          profileName: instData.profileName || null,
          profilePicUrl: instData.profilePicUrl || null,
          owner: instData.owner || null,
          status: instData.status || null,
          isBusiness: instData.isBusiness ?? null,
        };
        return new Response(JSON.stringify({ data: profile }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'get-business-categories') {
        const res = await fetch(withToken(`/business/get/categories/${inst}`), {
          method: 'GET',
          headers: evolutionHeaders,
        });
        const data = await res.json().catch(() => ({}));
        const raw = Array.isArray(data) ? data : (data?.response || data?.categories || data?.data || data?.result || []);
        const normalized = (Array.isArray(raw) ? raw : []).map((c: any) => ({
          id: String(c?.id ?? c?.value ?? c?.code ?? c?.key ?? ''),
          label: String(c?.localized_display_name ?? c?.name ?? c?.label ?? c?.display_name ?? c?.title ?? c?.id ?? ''),
        })).filter((c: any) => c.id && c.label);
        return new Response(JSON.stringify({ response: normalized, raw: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'update-business-categories') {
        const res = await fetch(withToken(`/business/update/profile/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ categories: payload?.categories || [] }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro ao atualizar categorias' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'list-products') {
        let jid: string | null = null;
        if (payload?.phone) {
          jid = String(payload.phone).includes('@') ? payload.phone : `${String(payload.phone).replace(/\D/g, '')}@s.whatsapp.net`;
        } else {
          try {
            const statusRes = await fetch(withToken(`/instance/status/${inst}`), { headers: evolutionHeaders });
            const statusRaw = await statusRes.json().catch(() => ({}));
            const owner = statusRaw?.instance?.owner;
            if (owner) {
              jid = String(owner).includes('@') ? String(owner) : `${String(owner).replace(/\D/g, '')}@s.whatsapp.net`;
            }
          } catch (_) {}
        }

        if (!jid) return new Response(JSON.stringify({ error: 'Conexão não está ativa ou número não identificado.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const res = await fetch(withToken(`/business/catalog/list/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ jid }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro ao carregar catálogo' }), { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        const rawProducts = data?.response || data?.data || [];
        const products = Array.isArray(rawProducts) ? rawProducts.map((p: any) => ({
          id: p.id,
          name: p.name || p.title || '',
          description: p.description || '',
          price: p.price ? Number(p.price) / 1000 : 0,
          currency: p.currency || 'BRL',
          isHidden: p.isHidden ?? p.hidden ?? false,
          imageUrls: p.imageUrls || (p.images && p.images[0]?.url) || '',
        })) : [];

        return new Response(JSON.stringify({ data: { products, nextCursor: null } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'delete-product') {
        const res = await fetch(withToken(`/business/catalog/delete/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ productIds: [payload?.id] }),
        });
        const data = await res.json().catch(() => ({}));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'show-product' || action === 'hide-product') {
        const path = action === 'show-product' ? `/business/catalog/show/${inst}` : `/business/catalog/hide/${inst}`;
        const res = await fetch(withToken(path), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ productIds: [payload?.id] }),
        });
        const data = await res.json().catch(() => ({}));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'create-product' || action === 'edit-product' || action === 'create-product-v2') {
        return new Response(JSON.stringify({ 
          error: 'A criação/edição de produtos não está disponível por esta conexão. Adicione os produtos diretamente pelo WhatsApp Business no celular conectado e use o botão Atualizar para listá-los aqui.' 
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'save-catalog-config') {
        return new Response(JSON.stringify({ data: { ok: true }, unsupported: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'company-description' || action === 'company-email' || action === 'company-address' || action === 'company-websites' || action === 'update-business-profile') {
        const busBody: any = {};
        if (payload?.description !== undefined) busBody.description = payload.description;
        if (payload?.email !== undefined) busBody.email = payload.email;
        if (payload?.address !== undefined) busBody.address = payload.address;
        if (payload?.websites !== undefined) busBody.websites = Array.isArray(payload.websites) ? payload.websites : [payload.websites].filter(Boolean);
        if (Object.keys(busBody).length === 0) return new Response(JSON.stringify({ error: 'Nenhum campo para atualizar' }), { status: 400, headers: corsHeaders });
        
        const res = await fetch(withToken(`/business/update/profile/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify(busBody),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'company-name' || action === 'update-profile-name') {
        const res = await fetch(withToken(`/profile/update/name/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ name: payload?.name ?? payload?.description ?? '' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'company-status' || action === 'update-profile-status') {
        const res = await fetch(withToken(`/profile/update/status/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ status: payload?.status ?? payload?.description ?? '' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'update-profile-image' || action === 'company-image') {
        const res = await fetch(withToken(`/profile/update/image/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ image: payload?.image || payload?.url || payload?.value || '' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }


      if (action.startsWith('set-')) {
         const setBody: any = {};
         const val = String(payload.visualizationType || '').toLowerCase();
         if (action === 'set-last-seen') setBody.last = val;
         if (action === 'set-photo-visualization') setBody.profile = val;
         if (action === 'set-privacy-description') setBody.status = val;
         if (action === 'set-group-add-permission') setBody.groupadd = val;
         if (action === 'set-privacy-online') setBody.online = val;
         if (action === 'set-read-receipts') setBody.readreceipts = payload.active ? 'all' : 'none';
          if (Object.keys(setBody).length === 0) return new Response(JSON.stringify({ error: 'Action not supported' }), { status: 400, headers: corsHeaders });

         const res = await fetch(withToken(`/instance/updatePrivacy/${inst}`), {
           method: 'POST',
           headers: evolutionHeaders,
           body: JSON.stringify(setBody) 
         });
         const data = await res.json();
         if (!res.ok) return new Response(JSON.stringify({ error: data.message || 'Erro' }), { status: res.status, headers: corsHeaders });
         return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // skip send-call (already handled)

      if (action === 'send-call') {
        const number = (phone || '').replace(/\D/g, '');
        if (!number) {
          return new Response(JSON.stringify({ error: 'Número inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const callDur = Number(payload?.callDuration ?? payload?.duration ?? 15) || 15;
        // Try multiple known endpoints across providers
        const callAtts = [
          { url: withToken(`/message/sendCall/${inst}`), body: { number, delay: callDur } },
          { url: withToken(`/message/fake-call/${inst}`), body: { number, duration: callDur } },
          { url: withToken(`/call/make/${inst}`), body: { number, duration: callDur } },
          { url: withToken(`/message/sendCall/${inst}`), body: { number, duration: callDur } },
        ];
        let lastStatus = 0;
        let lastData: any = null;
        for (const a of callAtts) {
          try {
            console.log(`[zapi-chat-actions] Attempting call: ${a.url}`);
            const r = await fetch(a.url, { method: 'POST', headers: evolutionHeaders, body: JSON.stringify(a.body) });
            lastStatus = r.status;
            lastData = await r.json().catch(() => ({}));
            console.log(`[zapi-chat-actions] Call attempt status: ${r.status}, data:`, lastData);
            if (r.ok) {
              return new Response(JSON.stringify({ value: true, ...lastData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          } catch (e) {
            lastData = { error: (e as Error).message };
          }
        }
        return new Response(JSON.stringify({ error: formatErrorMessage(lastData) || 'Erro ao realizar chamada' }), { status: lastStatus || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'list-tags') {
        const endpoints = [
          `/label/findLabels/${inst}`,
          `/chat/getlabels/${inst}`,
          `/labels/list/${inst}`,
        ];
        for (const ep of endpoints) {
          const r = await fetch(withToken(ep), { headers: evolutionHeaders });
          if (r.ok) {
            const d = await r.json().catch(() => ([]));
            const arr = Array.isArray(d) ? d : (d?.labels || d?.data || d?.response || []);
            const value = (Array.isArray(arr) ? arr : []).map((t: any) => ({
              id: String(t.id ?? t.labelId ?? t._id ?? ''),
              name: t.name ?? t.title ?? '',
              color: t.color ?? t.colorHex ?? '',
            })).filter((t: any) => t.id);
            return new Response(JSON.stringify({ data: { value } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
        return new Response(JSON.stringify({ data: { value: [] } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'save-privacy') {
        const privBody: any = {};
        const lc = (v: any) => (v === undefined || v === null || v === '') ? undefined : String(v).toLowerCase();
        if (payload.last !== undefined) privBody.last = lc(payload.last);
        if (payload.profile !== undefined) privBody.profile = lc(payload.profile);
        if (payload.status !== undefined) privBody.status = lc(payload.status);
        if (payload.groupadd !== undefined) privBody.groupadd = lc(payload.groupadd);
        if (payload.online !== undefined) privBody.online = lc(payload.online);
        if (payload.readreceipts !== undefined) privBody.readreceipts = lc(payload.readreceipts);
        Object.keys(privBody).forEach(k => privBody[k] === undefined && delete privBody[k]);
        if (Object.keys(privBody).length === 0) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        
        const res = await fetch(withToken(`/instance/updatePrivacy/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify(privBody),
        });
        const data = await res.json();
        if (!res.ok) return new Response(JSON.stringify({ error: data.message || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'get-chat-details') {
        const jid = payload?.phone || payload?.jid || '';
        const number = jid.includes('@') ? jid.split('@')[0] : jid.replace(/\D/g, '');
        const res = await fetch(withToken(`/chat/findChat/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ number }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'add-tag' || action === 'remove-tag') {
        const path = action === 'add-tag' ? `/chat/tag/add/${inst}` : `/chat/tag/remove/${inst}`;
        const jid = phone || payload?.phone || '';
        const number = jid.includes('@') ? jid.split('@')[0] : jid.replace(/\D/g, '');
        const res = await fetch(withToken(path), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ number, tagId: payload?.tagId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'create-tag') {
        const res = await fetch(withToken(`/chat/tag/create/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ name: payload?.name, color: payload?.color }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      if (action === 'add-contacts') {
        const res = await fetch(withToken(`/contact/create/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({
            number: payload?.phone || phone,
            name: payload?.name || payload?.firstName || 'Contato'
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'check-numbers') {
        const numbers = Array.isArray(payload?.numbers) ? payload.numbers : [payload?.phone || phone].filter(Boolean);
        const res = await fetch(withToken(`/chat/whatsappNumbers/${inst}`), {
          method: 'POST',
          headers: evolutionHeaders,
          body: JSON.stringify({ numbers }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Action not supported for this provider' }), { status: 400, headers: corsHeaders });



    }

    // Default Z-API path
    const zURL = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}`;
    const zH = { 'Content-Type': 'application/json', 'Client-Token': creds.clientToken };

    // This is a minimal Z-API bridge for the privacy actions called by Dispositivos.tsx
    let zMeth = 'GET';
    let zPathStr = '';
    let zBod = null;

    if (action === 'get-disallowed-contacts') zPathStr = '/privacy/disallowed-contacts';
    if (action === 'set-last-seen') { zMeth = 'POST'; zPathStr = '/privacy/last-seen'; zBod = { visualizationType: payload.visualizationType }; }
    if (action === 'set-photo-visualization') { zMeth = 'POST'; zPathStr = '/privacy/photo'; zBod = { visualizationType: payload.visualizationType }; }
    if (action === 'set-privacy-description') { zMeth = 'POST'; zPathStr = '/privacy/description'; zBod = { visualizationType: payload.visualizationType }; }
    if (action === 'set-group-add-permission') { zMeth = 'POST'; zPathStr = '/privacy/group-add'; zBod = { visualizationType: payload.visualizationType }; }
    if (action === 'set-privacy-online') { zMeth = 'POST'; zPathStr = '/privacy/online'; zBod = { visualizationType: payload.visualizationType }; }
    if (action === 'set-read-receipts') { zMeth = 'POST'; zPathStr = `/privacy/read-receipts?value=${payload.active ? 'enable' : 'disable'}`; }
    if (action === 'set-messages-duration') {
       const map: any = { '0': 'disable', '86400': 'hours24', '604800': 'days7', '7776000': 'days90' };
       zPathStr = `/privacy/messages-duration?value=${map[String(payload.duration)] || 'disable'}`;
       zMeth = 'POST';
    }

    if (!zPathStr) return new Response(JSON.stringify({ error: 'Action not supported' }), { status: 400, headers: corsHeaders });

    const finalRes = await fetch(zURL + zPathStr, { method: zMeth, headers: zH, body: zBod ? JSON.stringify(zBod) : null });
    const finalData = await finalRes.json();
    return new Response(JSON.stringify(finalData), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: finalRes.status });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});