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

      if (action === 'get-disallowed-contacts') {
        const res = await fetch(withToken('/chat/blocklist'), { headers: { token: apiToken } });
        const raw = await res.json();
        const arr: string[] = Array.isArray(raw?.blockList) ? raw.blockList : (Array.isArray(raw) ? raw : []);
        const list = arr.map((j) => ({ phone: String(j).replace(/@.+$/, '') }));
        return new Response(JSON.stringify({ data: { value: list } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'business-profile') {
        const statusRes = await fetch(withToken('/instance/status'), { headers: { token: apiToken } });
        const raw = await statusRes.json().catch(() => ({}));
        const inst = raw?.instance || {};
        let business = raw?.business || raw?.businessProfile || {};

        if (inst.owner) {
          const jid = String(inst.owner).includes('@') ? String(inst.owner) : `${String(inst.owner).replace(/\D/g, '')}@s.whatsapp.net`;
          const businessRes = await fetch(`${apiUrl}/business/get/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: apiToken },
            body: JSON.stringify({ jid }),
          });
          const businessRaw = await businessRes.json().catch(() => ({}));
          business = businessRaw?.response || businessRaw?.data || businessRaw?.profile || business;
        }

        const profile = {
          description: business.description || inst.profileName || creds.instanceName || '',
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
          profileName: inst.profileName || null,
          profilePicUrl: inst.profilePicUrl || null,
          owner: inst.owner || null,
          status: inst.status || null,
          isBusiness: inst.isBusiness ?? null,
        };
        return new Response(JSON.stringify({ data: profile }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'get-business-categories') {
        const res = await fetch(`${apiUrl}/business/get/categories`, {
          method: 'GET',
          headers: { token: apiToken },
        });
        const data = await res.json().catch(() => ({}));
        // Normalize various possible shapes into { response: [{ id, label }] }
        const raw = Array.isArray(data) ? data
          : (data?.response || data?.categories || data?.data || data?.result || []);
        const normalized = (Array.isArray(raw) ? raw : []).map((c: any) => ({
          id: String(c?.id ?? c?.value ?? c?.code ?? c?.key ?? ''),
          label: String(c?.localized_display_name ?? c?.name ?? c?.label ?? c?.display_name ?? c?.title ?? c?.id ?? ''),
        })).filter((c: any) => c.id && c.label);
        return new Response(JSON.stringify({ response: normalized, raw: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'update-business-categories') {
        const res = await fetch(`${apiUrl}/business/update/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
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
          // Buscar owner via /instance/status
          try {
            const statusRes = await fetch(`${apiUrl}/instance/status`, { headers: { token: apiToken } });
            const statusRaw = await statusRes.json().catch(() => ({}));
            const owner = statusRaw?.instance?.owner;
            if (owner) {
              jid = String(owner).includes('@') ? String(owner) : `${String(owner).replace(/\D/g, '')}@s.whatsapp.net`;
            }
          } catch (_) {}
        }

        if (!jid) return new Response(JSON.stringify({ error: 'Conexão não está ativa ou número não identificado. Verifique se o WhatsApp está conectado.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const res = await fetch(`${apiUrl}/business/catalog/list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify({ jid }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro ao carregar catálogo' }), { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        // Map UAZAPI catalog list response to match frontend expectations
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
        const res = await fetch(`${apiUrl}/business/catalog/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify({ productIds: [payload?.id] }),
        });
        const data = await res.json().catch(() => ({}));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'show-product' || action === 'hide-product') {
        const path = action === 'show-product' ? '/business/catalog/show' : '/business/catalog/hide';
        const res = await fetch(`${apiUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
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
        const body: any = {};
        if (payload?.description !== undefined) body.description = payload.description;
        if (payload?.email !== undefined) body.email = payload.email;
        if (payload?.address !== undefined) body.address = payload.address;
        if (payload?.websites !== undefined) body.websites = Array.isArray(payload.websites) ? payload.websites : [payload.websites].filter(Boolean);
        if (Object.keys(body).length === 0) {
          return new Response(JSON.stringify({ error: 'Nenhum campo para atualizar' }), { status: 400, headers: corsHeaders });
        }
        const res = await fetch(`${apiUrl}/business/update/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.failed > 0 || data?.updated === 0) {
          const details = data?.response ? formatErrorMessage(data.response) : formatErrorMessage(data);
          return new Response(JSON.stringify({ error: details || 'Não foi possível atualizar o perfil comercial', details: data }), { status: res.ok ? 400 : res.status, headers: corsHeaders });
        }
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'company-name' || action === 'update-profile-name') {
        const res = await fetch(`${apiUrl}/profile/name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify({ name: payload?.name ?? payload?.description ?? '' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'company-status' || action === 'update-profile-status') {
        const res = await fetch(`${apiUrl}/profile/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify({ status: payload?.status ?? payload?.description ?? '' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro ao atualizar recado' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'update-profile-image' || action === 'company-image') {
        const res = await fetch(`${apiUrl}/profile/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify({ image: payload?.image || payload?.url || payload?.value || '' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Response(JSON.stringify({ error: formatErrorMessage(data) || 'Erro ao atualizar imagem' }), { status: res.status, headers: corsHeaders });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }


      if (action.startsWith('set-')) {
         const body: any = {};
         const val = String(payload.visualizationType || '').toLowerCase();

         if (action === 'set-last-seen') body.last = val;
         if (action === 'set-photo-visualization') body.profile = val;
         if (action === 'set-privacy-description') body.status = val;
         if (action === 'set-group-add-permission') body.groupadd = val;
         if (action === 'set-privacy-online') body.online = val;
         if (action === 'set-read-receipts') body.readreceipts = payload.active ? 'all' : 'none';
          if (Object.keys(body).length === 0) {
            return new Response(JSON.stringify({ error: 'Action not supported for this provider' }), { status: 400, headers: corsHeaders });
          }

         const res = await fetch(withToken('/instance/privacy'), {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', token: apiToken },
           body: JSON.stringify(body) 
         });
         const data = await res.json();
         if (!res.ok) {
           return new Response(JSON.stringify({ error: data.message || 'Erro ao atualizar' }), { status: res.status, headers: corsHeaders });
         }
         return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'save-privacy') {
        const body: any = {};
        const lc = (v: any) => (v === undefined || v === null || v === '') ? undefined : String(v).toLowerCase();
        if (payload.last !== undefined) body.last = lc(payload.last);
        if (payload.profile !== undefined) body.profile = lc(payload.profile);
        if (payload.status !== undefined) body.status = lc(payload.status);
        if (payload.groupadd !== undefined) body.groupadd = lc(payload.groupadd);
        if (payload.online !== undefined) body.online = lc(payload.online);
        if (payload.readreceipts !== undefined) body.readreceipts = lc(payload.readreceipts);
        Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);
        if (Object.keys(body).length === 0) {
          return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const res = await fetch(withToken('/instance/privacy'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          return new Response(JSON.stringify({ error: data.message || data.error || 'Erro ao salvar privacidade' }), { status: res.status, headers: corsHeaders });
        }
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      return new Response(JSON.stringify({ error: 'Action not supported for this provider' }), { status: 400, headers: corsHeaders });
    }

    // Default Z-API path
    const zapiUrl = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}`;
    const zapiHeaders = { 'Content-Type': 'application/json', 'Client-Token': creds.clientToken };

    // This is a minimal Z-API bridge for the privacy actions called by Dispositivos.tsx
    let method = 'GET';
    let path = '';
    let body = null;

    if (action === 'get-disallowed-contacts') path = '/privacy/disallowed-contacts';
    if (action === 'set-last-seen') { method = 'POST'; path = '/privacy/last-seen'; body = { visualizationType: payload.visualizationType }; }
    if (action === 'set-photo-visualization') { method = 'POST'; path = '/privacy/photo'; body = { visualizationType: payload.visualizationType }; }
    if (action === 'set-privacy-description') { method = 'POST'; path = '/privacy/description'; body = { visualizationType: payload.visualizationType }; }
    if (action === 'set-group-add-permission') { method = 'POST'; path = '/privacy/group-add'; body = { visualizationType: payload.visualizationType }; }
    if (action === 'set-privacy-online') { method = 'POST'; path = '/privacy/online'; body = { visualizationType: payload.visualizationType }; }
    if (action === 'set-read-receipts') { method = 'POST'; path = `/privacy/read-receipts?value=${payload.active ? 'enable' : 'disable'}`; }
    if (action === 'set-messages-duration') {
       const map: any = { '0': 'disable', '86400': 'hours24', '604800': 'days7', '7776000': 'days90' };
       path = `/privacy/messages-duration?value=${map[String(payload.duration)] || 'disable'}`;
       method = 'POST';
    }

    if (!path) return new Response(JSON.stringify({ error: 'Action not supported' }), { status: 400, headers: corsHeaders });

    const res = await fetch(zapiUrl + path, { method, headers: zapiHeaders, body: body ? JSON.stringify(body) : null });
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: res.status });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});