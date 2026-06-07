import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

interface ZapiInstance {
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
  instance_name: string | null;
  api_provider?: string | null;
  evolution_api_url?: string | null;
  evolution_api_key?: string | null;
}

const isUsableGroupName = (value: unknown) => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (/^\d+$/.test(normalized.replace(/\s+/g, ''))) return false;
  if (/^grupo sem nome$/i.test(normalized)) return false;
  return true;
};

const hasTruthyValue = (value: any): boolean => {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return Boolean(normalized) && !['false', '0', 'null', 'undefined', 'no', 'não', 'nao'].includes(normalized);
  }
  if (typeof value === 'number') return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
};

const hasCommunityMetadata = (value: any, seen = new WeakSet<object>()): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const isCommunityKey =
      normalizedKey.includes('community') ||
      normalizedKey.includes('parentgroup') ||
      normalizedKey.includes('linkedparent') ||
      normalizedKey.includes('parentjid') ||
      normalizedKey.includes('defaultsubgroup');

    if (isCommunityKey && hasTruthyValue(entry)) return true;
    if (entry && typeof entry === 'object' && hasCommunityMetadata(entry, seen)) return true;
  }

  return false;
};

const extractParticipantsFromGroup = (group: any) => {
  const candidates = [
    group?.participants,
    group?.Participants,
    group?.participantes,
    group?.members,
    group?.Members,
    group?.groupParticipants,
    group?.communityParticipants,
    group?.group?.participants,
    group?.group?.Participants,
    group?.groupMetadata?.participants,
    group?.data?.participants,
    group?.data?.Participants,
    group?.data?.members,
    group?.info?.participants,
    group?.result?.participants,
  ];

  return candidates.find((candidate) => Array.isArray(candidate)) || [];
};

const fetchOwnerJidViaUazapi = async (apiUrl: string, apiToken: string, instanceName?: string | null): Promise<string | null> => {
  const endpoints = ['/instance/me', '/instance/status', '/instance', '/status'];
  if (instanceName) {
    endpoints.unshift(`/instance/me/${instanceName}`);
    endpoints.unshift(`/instance/status/${instanceName}`);
  }
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${apiUrl}${ep}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', token: apiToken },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) continue;
      const candidates = [
        data?.instance?.owner,
        data?.instance?.jid,
        data?.instance?.wid,
        data?.instance?.me?.id,
        data?.instance?.profile?.id,
        data?.instance?.profile?.wid,
        data?.instance?.profile?.phone,
        data?.instance?.phone,
        data?.instance?.number,
        data?.connected?.jid,
        data?.owner,
        data?.jid,
        data?.wid,
        data?.me?.id,
        data?.profile?.id,
        data?.profile?.wid,
        data?.profile?.phone,
        data?.phone,
        data?.number,
      ];
      const foundJid = candidates.find((v) => typeof v === 'string' && v.includes('@'));
      if (foundJid) return String(foundJid);
      const foundPhone = candidates.find((v) => typeof v === 'string' && v.replace(/\D/g, '').length >= 8);
      if (foundPhone) return String(foundPhone);
      // Log for debugging when nothing matches
      console.log(`🔎 UAZAPI ${ep} response keys:`, Object.keys(data || {}));
    } catch (e) {
      console.log(`⚠️ UAZAPI ${ep} fetch failed:`, String(e));
    }
  }
  return null;
};

// Verifica se a instância está realmente conectada (logada no WhatsApp).
// Para uazapi: chama /instance/status e checa "connected"/"loggedIn".
// Para z-api: chama /status e checa "connected".
const isInstanceConnected = async (instance: ZapiInstance): Promise<boolean> => {
  const provider = (instance.api_provider || 'zapi').toLowerCase();
  try {
    if (provider === 'uazapi' || provider === 'uazapi_warmup') {
       let apiUrl = (instance.evolution_api_url || '').replace(/\/+$/, '');
       if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
 
      const apiToken = instance.evolution_api_key || instance.zapi_token || '';
      if (!apiUrl || !apiToken) return false;
       const endpoints = ['/instance/status', '/status', '/instance', '/instance/connectionStatus'];
       // If instance_name is available in the instance record (from Evolution API)
       if (instance.instance_name) {
         endpoints.unshift(`/instance/status/${instance.instance_name}`);
         endpoints.unshift(`/instance/connectionStatus/${instance.instance_name}`);
       }
 
       const headers = { 
         'Content-Type': 'application/json', 
         'token': apiToken,
         'apikey': apiToken,
         'Authorization': `Bearer ${apiToken}`
       };
 
      for (const ep of endpoints) {
        try {
           const separator = ep.includes('?') ? '&' : '?';
           const urlWithParams = `${apiUrl}${ep}${separator}token=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}`;
           
           const r = await fetch(urlWithParams, {
             method: 'GET',
             headers,
           });
          if (!r.ok) continue;
          const j = await r.json().catch(() => null);
          if (!j) continue;
          const statusRaw = 
            j?.instance?.status || 
            j?.status?.checked_instance?.connection_status ||
            j?.status?.connection_status ||
            j?.status || 
            j?.connectionStatus || 
            j?.state || 
            j?.instance?.state || 
            j?.instance?.connectionStatus || 
            '';
          
          let status = typeof statusRaw === 'string' ? statusRaw.toLowerCase() : '';
          
          // Se o status estiver vazio mas tivermos connected=true, forçamos o status para open
          if (!status && (j?.connected === true || j?.instance?.connected === true || j?.status?.connected === true || j?.status?.loggedIn === true || j?.status?.checked_instance?.connection_status === 'connected')) {
            status = 'open';
          }
          
          const negativeStates = ['disconnected', 'disconnect', 'closed', 'close', 'logout', 'logged_out', 'loggedout', 'offline', 'refused', 'connecting'];
          
          const isDisconnected = 
            j?.connected === false ||
            j?.loggedIn === false ||
            j?.status?.connected === false ||
            j?.status?.loggedIn === false ||
            j?.instance?.connected === false ||
            negativeStates.some((s) => status === s || status.includes(s));

          const connected = !isDisconnected && (
            j?.connected === true ||
            j?.loggedIn === true ||
            j?.status?.connected === true ||
            j?.status?.loggedIn === true ||
            j?.instance?.connected === true ||
            j?.status?.checked_instance?.connection_status === 'connected' ||
            ['connected', 'open', 'online', 'logged_in', 'loggedin', 'connected_in', 'true'].some((s) =>
              status === s || status.includes(s)
            )
          );

          if (connected) {
            console.log(`✅ Instance ${instance.instance_name} is connected (status: ${status})`);
            return true;
          }
           // resposta válida mas não conectada
           console.log(`ℹ️ Instance ${instance.instance_name} response valid but not connected (status: ${status}). Full response: ${JSON.stringify(j).substring(0, 300)}`);
          return false;
        } catch (_) {
          continue;
        }
      }
      return false;
    }

    // Z-API
    const instanceId = instance.zapi_instance_id;
    const token = instance.zapi_token;
    const clientToken = instance.zapi_client_token;
    if (!instanceId || !token) return false;
    const r = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/status`, {
      method: 'GET',
      headers: { 'Client-Token': clientToken || '', 'Content-Type': 'application/json' },
    });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    if (!j) return false;
    return j?.connected === true;
  } catch (e) {
    console.error(`⚠️ isInstanceConnected error for ${instance.instance_name}:`, e);
    return false;
  }
};

const isDisconnectedPayload = (payload: any): boolean => {
  if (!payload) return false;
  if (Array.isArray(payload)) return false;
  if (Array.isArray(payload?.groups) || Array.isArray(payload?.data)) return false;

  const statusText = String(
    payload?.error ||
    payload?.message ||
    payload?.status ||
    payload?.state ||
    payload?.instance?.status ||
    payload?.instance?.state ||
    ''
  ).toLowerCase();

  return /whatsapp disconnected|disconnected|logged[_\s-]?out|logout|offline|closed/.test(statusText);
};

const normalizePhoneFromJid = (jid: string | null | undefined): string => {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
};

const numericCount = (...values: unknown[]): number => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, ''));
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
};

const isOwnerAdminInGroup = (detail: any, group: any, ownerPhone: string, ownerLid?: string): boolean => {
  if (!ownerPhone && !ownerLid) return false;
  const participants = extractParticipantsFromGroup({ ...group, ...detail });
  if (!Array.isArray(participants) || participants.length === 0) return false;
  for (const p of participants) {
    const id = String(p?.id || p?.phone || p?.jid || p?.JID || p?.participant || '');
    // Match por LID quando o participante vier como @lid
    const isAdminParticipant = 
      hasTruthyValue(p?.isAdmin) || 
      hasTruthyValue(p?.IsAdmin) || 
      hasTruthyValue(p?.isSuperAdmin) || 
      hasTruthyValue(p?.is_admin) ||
      p?.admin === 'admin' || p?.admin === 'superadmin' ||
      p?.role === 'admin' || p?.role === 'superadmin' ||
      p?.type === 'admin' || p?.type === 'superadmin';

    if (ownerLid && id.includes(ownerLid) && isAdminParticipant) return true;
    
    const phone = normalizePhoneFromJid(id);
     if (phone && ownerPhone && isAdminParticipant) {
       const p1 = phone.replace(/\D/g, '');
       const p2 = ownerPhone.replace(/\D/g, '');
       if (p1 === p2 || p1.endsWith(p2) || p2.endsWith(p1)) {
         return true;
       }
       // Case for Brazilian numbers with/without 9th digit
       if (p1.length >= 8 && p2.length >= 8 && p1.slice(-8) === p2.slice(-8)) {
         return true;
       }
     }
  }
  // Fallback: owner field of the group
  const ownerField = String(detail?.Owner || detail?.owner || group?.Owner || group?.owner || '');
  if (ownerField) {
    if (ownerLid && ownerField.includes(ownerLid)) return true;
    const ownerFieldPhone = normalizePhoneFromJid(ownerField);
     if (ownerPhone && ownerFieldPhone) {
       const p1 = ownerFieldPhone.replace(/\D/g, '');
       const p2 = ownerPhone.replace(/\D/g, '');
       if (p1 === p2 || p1.endsWith(p2) || p2.endsWith(p1)) {
         return true;
       }
       if (p1.length >= 8 && p2.length >= 8 && p1.slice(-8) === p2.slice(-8)) {
         return true;
       }
     }
  }
  return false;
};

const fetchGroupsViaUazapi = async (instance: ZapiInstance): Promise<any[]> => {
  let apiUrl = (instance.evolution_api_url || '').replace(/\/+$/, '');
  if (apiUrl && !apiUrl.startsWith('http')) apiUrl = `https://${apiUrl}`;
  const apiToken = instance.evolution_api_key || instance.zapi_token || '';
  if (!apiUrl || !apiToken) return [];

  const getHeaders = (token: string) => ({
    'Content-Type': 'application/json',
    'token': token,
    'apikey': token,
    'admintoken': token,
    'AdminToken': token,
    'admin-token': token,
    'Authorization': `Bearer ${token}`,
    'X-Api-Key': token
  });
  
  const headers = getHeaders(apiToken);

  // Detectar o nome real da instância via /status se possível
  let realInstanceName = instance.instance_name;
  try {
    const statusRes = await fetch(`${apiUrl}/status?token=${encodeURIComponent(apiToken)}`, { headers });
    if (statusRes.ok) {
      const statusData = await statusRes.json().catch(() => ({}));
      const detectedName = statusData?.status?.checked_instance?.name || statusData?.instance?.name;
      if (detectedName) {
        console.log(`🔎 Detected real UAZAPI instance name: ${detectedName}`);
        realInstanceName = detectedName;
      }
    }
  } catch (e) {
    console.warn(`⚠️ Failed to detect real instance name from /status:`, e instanceof Error ? e.message : String(e));
  }

  const ownerJid = await fetchOwnerJidViaUazapi(apiUrl, apiToken, realInstanceName);
  const ownerPhone = normalizePhoneFromJid(ownerJid);
  console.log(`👤 UAZAPI owner phone for ${instance.instance_name}: ${ownerPhone || '(unknown)'}`);

  let payload: any = null;
  let response: any = null;
  
  // Combinations of endpoints, methods and path parameters
  const combinations = [
    { ep: '/group/list', method: 'GET' },
    { ep: `/group/list/${realInstanceName}`, method: 'GET' },
    { ep: '/group/list', method: 'POST', body: {} },
    { ep: '/group/fetchAllGroups', method: 'GET' },
    { ep: `/group/fetchAllGroups/${realInstanceName}`, method: 'GET' },
    { ep: '/group/listAll', method: 'GET' },
    { ep: '/chat/findGroups', method: 'GET' },
    { ep: `/chat/findGroups/${realInstanceName}`, method: 'GET' },
    { ep: `/group/list?token=${apiToken}`, method: 'GET' },
    { ep: `/${apiToken}/group/list`, method: 'GET' },
    { ep: `/v1/group/list`, method: 'GET' },
    { ep: `/v1/group/list/${realInstanceName}`, method: 'GET' },
    { ep: `/instance/group/list/${realInstanceName}`, method: 'GET' },
    { ep: `/instance/fetchGroups/${realInstanceName}`, method: 'GET' },
    { ep: `/group/list/${realInstanceName}`, method: 'GET' },
    { ep: `/group/fetchGroups/${realInstanceName}`, method: 'GET' },
    { ep: `/instance/all`, method: 'GET' },
  ];
  
  for (const combo of combinations) {
    try {
      const ep = combo.ep;
      const url = `${apiUrl}${ep}${ep.includes('?') ? '&' : '?'}token=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}`;
      console.log(`🔎 Fetching groups via UAZAPI: ${combo.method} ${url}`);
      
      const currentHeaders: Record<string, string> = { ...headers };
      if (realInstanceName) {
        currentHeaders['instance'] = realInstanceName;
        currentHeaders['instance-name'] = realInstanceName;
      }

      response = await fetch(url, { 
        method: combo.method, 
        headers: currentHeaders,
        body: combo.method === 'POST' ? JSON.stringify(combo.body || {}) : undefined
      });
      
      const resText = await response.text();
      console.log(`📦 UAZAPI ${combo.method} ${ep} response for ${instance.instance_name}: ${resText.slice(0, 500)}`);
      
      if (response.ok) {
        const potentialPayload = JSON.parse(resText || '{}');
        const groups = Array.isArray(potentialPayload)
          ? potentialPayload
          : Array.isArray(potentialPayload?.groups)
            ? potentialPayload.groups
            : Array.isArray(potentialPayload?.data)
              ? potentialPayload.data
              : null;
              
        if (groups) {
          payload = potentialPayload;
          break;
        }
      }
    } catch (e) {
      console.error(`❌ UAZAPI ${combo.ep} fetch failed:`, e instanceof Error ? e.message : String(e));
    }
  }

  if (!payload) {
    console.error(`❌ UAZAPI group list failed for all endpoints for ${instance.instance_name}`);
    return [];
  }
  if (isDisconnectedPayload(payload)) {
    console.log(`🚫 UAZAPI group/list ignored for disconnected instance ${instance.instance_name}`);
    return [];
  }

  const rawGroups = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.groups)
      ? payload.groups
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  // Also try to fetch newsletters/channels (UAZAPI exposes them via /newsletter/list)
  let rawChannels: any[] = [];
  try {
    const chRes = await fetch(`${apiUrl}/newsletter/list`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', token: apiToken },
    });
    if (chRes.ok) {
      const chPayload = await chRes.json().catch(() => ({}));
      const list = Array.isArray(chPayload)
        ? chPayload
        : Array.isArray(chPayload?.newsletters)
          ? chPayload.newsletters
          : Array.isArray(chPayload?.data)
            ? chPayload.data
            : [];
      rawChannels = list.map((c: any) => ({ ...c, __isChannel: true, isChannel: true }));
    }
  } catch (chErr) {
    console.warn(`⚠️ UAZAPI newsletter/list failed for ${instance.instance_name}:`, chErr);
  }

  // Remove duplicates from raw groups by JID before processing details
  const rawGroupsMap = new Map();
  [...rawGroups, ...rawChannels].forEach(g => {
    const jid = g?.JID || g?.id || g?.jid || g?.groupId || g?.remoteJid || '';
    if (jid && !rawGroupsMap.has(jid)) {
      rawGroupsMap.set(jid, g);
    }
  });
  const combinedRaw = Array.from(rawGroupsMap.values());

  let detailedGroups: any[] = [];
  try {
    detailedGroups = await Promise.all(combinedRaw.map(async (group: any) => {
    const groupId = group?.JID || group?.id || group?.jid || group?.groupId || group?.remoteJid || group?.wa_chatid || '';
    const isChannel = group?.__isChannel === true || String(groupId).includes('@newsletter');
     if (!isChannel && !String(groupId).includes('@g.us') && !String(groupId).includes('@newsletter')) return null;

    const fallbackName =
      group?.subject ||
      group?.name ||
      group?.Name ||
      group?.Topic ||
      group?.groupName ||
      group?.title ||
      group?.wa_name ||
      group?.wa_chatName ||
      group?.wa_contactName ||
      group?.pushName ||
      '';

    let detail: any = null;
    if (!isChannel) try {
      const isCommunityEndpoint = String(groupId).includes('@newsletter') || String(groupId).includes('-community');
      const infoUrl = `${apiUrl}/group/info${apiUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}`;
      const infoResponse = await fetch(infoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': apiToken,
          'apikey': apiToken,
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ groupjid: groupId, getInviteLink: false }),
      });
      detail = await infoResponse.json().catch(() => null);
      if (!infoResponse.ok) {
        console.error(`⚠️ group/info HTTP ${infoResponse.status} for ${groupId}: ${JSON.stringify(detail)?.slice(0, 300)}`);
        if ([401, 403, 503].includes(infoResponse.status) || isDisconnectedPayload(detail)) {
          throw new Error('UAZAPI_INSTANCE_DISCONNECTED');
        }
      }
    } catch (error) {
      if ((error as Error)?.message === 'UAZAPI_INSTANCE_DISCONNECTED') throw error;
      console.error(`❌ UAZAPI group/info failed for ${groupId}:`, error);
    }

    const resolvedName =
      detail?.subject ||
      detail?.name ||
      detail?.Name ||
      detail?.Topic ||
      detail?.group?.subject ||
      detail?.group?.name ||
      detail?.groupMetadata?.subject ||
      detail?.data?.subject ||
      detail?.info?.subject ||
      detail?.info?.name ||
      group?.subject ||
      group?.name ||
      group?.Name ||
      group?.Topic ||
      group?.groupName ||
      group?.title ||
      group?.wa_name ||
      group?.wa_chatName ||
      group?.wa_contactName ||
      group?.pushName ||
      'Grupo sem nome';

    if (resolvedName === 'Grupo sem nome') {
      console.log(`🔎 UAZAPI group without name. id=${groupId} keys=${Object.keys(group || {}).join(',')} detailKeys=${detail ? Object.keys(detail).join(',') : 'none'}`);
    }

    // Identifica se é comunidade baseado em metadados da UAZAPI
    // UAZAPI /group/info retorna isCommunity: true para comunidades
    const isCommunity = 
      detail?.isCommunity === true || 
      detail?.group?.isCommunity === true ||
      detail?.groupMetadata?.isCommunity === true ||
      group?.isCommunity === true ||
      String(groupId).includes('-community');

    return {
      ...group,
      ...detail,
      id: groupId,
      phone: groupId,
      name: resolvedName,
      isAdmin: (isChannel || isOwnerAdminInGroup(detail, group, ownerPhone)) || (isCommunity || group.isGroup), 
      // Be more lenient in UAZAPI as well
      isChannel,
      isCommunity,
      memberCount:
        extractParticipantsFromGroup({ ...group, ...detail }).length ||
        detail?.ParticipantCount ||
        (Array.isArray(detail?.Participants) ? detail.Participants.length : 0) ||
        group?.ParticipantCount ||
        (Array.isArray(group?.Participants) ? group.Participants.length : 0) ||
        group?.memberCount ||
        group?.size ||
        0,
      profilePicture:
        detail?.ProfilePicture ||
        detail?.ProfilePicUrl ||
        detail?.imageUrl ||
        detail?.picture ||
        detail?.profilePicUrl ||
        group?.ProfilePicture ||
        group?.ProfilePicUrl ||
        group?.imageUrl ||
        group?.picture ||
        null,
      __sourceInstanceName: instance.instance_name || null,
      __sourceInstanceId: instance.zapi_instance_id,
    };
    }));
  } catch (error) {
    if ((error as Error)?.message === 'UAZAPI_INSTANCE_DISCONNECTED') {
      console.log(`🚫 UAZAPI instance ${instance.instance_name} disconnected during group detail fetch`);
      return [];
    }
    throw error;
  }

  return detailedGroups.filter(Boolean);
};

const fetchOwnerPhoneViaZapi = async (instance: ZapiInstance): Promise<{ phone: string; lid: string }> => {
  const baseUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`;
  // Endpoint correto da Z-API é /device — retorna { phone, lid, name, ... }.
  // /me não existe ou devolve formato inconsistente, gerando owner phone corrompido.
  const endpoints = ['/device', '/me'];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapi_client_token },
      });
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      if (!data) continue;
      const lidRaw = String(data?.lid || '').split('@')[0].replace(/\D/g, '');
      const candidates = [
        data?.phone,
        data?.phoneNumber,
        data?.wid?.user,
        data?.me?.user,
        data?.me?.id,
        data?.id,
        data?.user,
      ];
      for (const c of candidates) {
        const normalized = normalizePhoneFromJid(typeof c === 'string' ? c : '');
        // Telefones reais têm entre 10 e 15 dígitos. Evita strings agregadas.
        if (normalized && normalized.length >= 10 && normalized.length <= 15) {
          return { phone: normalized, lid: lidRaw };
        }
      }
      if (lidRaw) return { phone: '', lid: lidRaw };
    } catch (error) {
      console.error(`⚠️ Z-API ${ep} failed for ${instance.instance_name}:`, error);
    }
  }
  return { phone: '', lid: '' };
};

const normalizeZapiGroupId = (value: unknown, allowBareGroupId = false): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('@newsletter') || raw.includes('-community')) return raw;
  if (raw.includes('-group')) return raw;
  if (raw.includes('@g.us')) return raw.replace(/@g\.us$/i, '-group');
  const digits = raw.replace(/\D/g, '');
  return allowBareGroupId && digits.length >= 12 ? `${digits}-group` : raw;
};

 const getNewsletterMetadata = async (instance: ZapiInstance, newsletterId: string): Promise<{ name: string | null; memberCount: number; picture: string | null }> => {
   try {
     const baseUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`;
    const headers = { 'Content-Type': 'application/json', 'Client-Token': instance.zapi_client_token || '' };
    const cleanId = String(newsletterId).replace('@newsletter', '');
    const candidates = [
      `/newsletter/metadata/${newsletterId}`,
      `/newsletter/metadata/${cleanId}`,
      `/newsletter/${encodeURIComponent(newsletterId)}`,
      `/newsletter/${encodeURIComponent(cleanId)}`,
      `/newsletter-metadata/${encodeURIComponent(newsletterId)}`,
      `/newsletter-metadata/${encodeURIComponent(cleanId)}`,
      `/channel/${encodeURIComponent(cleanId)}`,
      `/channel-metadata/${encodeURIComponent(cleanId)}`,
    ];
    for (const path of candidates) {
      try {
        const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
        if (!res.ok) continue;
        const data = await res.json().catch(() => null);
        const name = data?.name || data?.subject || data?.newsletterName || data?.newsletterTitle || data?.title || data?.channelName || data?.metadata?.name || data?.metadata?.subject;
         const memberCount = numericCount(
           data?.subscribersCount,
           data?.subscriberCount,
           data?.subscribers,
           data?.followersCount,
           data?.membersCount,
           data?.memberCount,
           data?.metadata?.subscribersCount,
           data?.metadata?.subscriberCount,
           data?.metadata?.followersCount,
         );
         const picture = data?.picture || data?.preview || data?.image || data?.profilePicture || data?.metadata?.picture || null;
        if (name || memberCount > 0 || picture) {
          console.log(`📺 Newsletter metadata resolved via ${path}: name=${name || '(none)'} count=${memberCount}`);
          return { name: name || null, memberCount, picture };
        }
      } catch (_) {
        continue;
      }
    }
     return { name: null, memberCount: 0, picture: null };
   } catch (e) {
      console.error(`⚠️ Failed to fetch newsletter metadata for ${newsletterId}:`, e);
      return { name: null, memberCount: 0, picture: null };
   }
 };

 const fetchGroupsViaZapi = async (instance: ZapiInstance): Promise<any[]> => {
   if (!instance.zapi_instance_id || !instance.zapi_token || !instance.zapi_client_token) return [];
 
    const ownerInfo = await fetchOwnerPhoneViaZapi(instance);
    console.log(`👤 Z-API owner for ${instance.instance_name}: phone=${ownerInfo.phone}, lid=${ownerInfo.lid}`);

   const baseUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`;
   const headers = { 'Content-Type': 'application/json', 'Client-Token': instance.zapi_client_token };

    const extractList = (payload: any, key: 'chats' | 'groups') => {
      if (Array.isArray(payload)) return payload;
      const candidates = [
        payload?.[key],
        payload?.data,
        payload?.result,
        payload?.response,
        payload?.items,
        payload?.result?.[key],
        payload?.data?.[key],
      ];
      return candidates.find((candidate) => Array.isArray(candidate)) || [];
    };

    const fetchPaginated = async (endpoint: 'chats' | 'groups') => {
      console.log(`👤 Fetching all ${endpoint} via Z-API /${endpoint} for ${instance.instance_name}`);
      const items: any[] = [];
   const pageSize = 100;
      const maxPages = 80; // safety cap (8000 records)
   for (let page = 1; page <= maxPages; page++) {
        const response = await fetch(`${baseUrl}/${endpoint}?page=${page}&pageSize=${pageSize}`, { method: 'GET', headers });
     if (!response.ok) {
          console.error(`❌ Z-API /${endpoint} page ${page} failed for ${instance.instance_name}: ${response.status}`);
       break;
     }
        const payload = await response.json().catch(() => []);
        const pageData = extractList(payload, endpoint);
     if (!Array.isArray(pageData) || pageData.length === 0) break;
        items.push(...pageData.map((item: any) => ({ ...item, __zapiListSource: endpoint })));
     if (pageData.length < pageSize) break;
   }
      console.log(`📥 Z-API total ${endpoint} fetched for ${instance.instance_name}: ${items.length}`);
      return items;
    };

    const metadataCache = new Map<string, Promise<any | null>>();
    const fetchZapiGroupMetadata = (groupId: string): Promise<any | null> => {
      if (!metadataCache.has(groupId)) {
        metadataCache.set(groupId, (async () => {
          const candidates = [groupId, groupId.replace(/-group$/i, '@g.us')];
          for (const candidate of Array.from(new Set(candidates))) {
            const paths = [`/group-metadata/${candidate}`, `/metadata-group/${candidate}`, `/light-group-metadata/${candidate}`];
            try {
              for (const path of paths) {
                const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
                if (!res.ok) continue;
                const payload = await res.json().catch(() => null);
                if (payload) return payload;
              }
            } catch (_) {
              continue;
            }
          }
          return null;
        })());
      }
      return metadataCache.get(groupId)!;
    };

    const rawItems = [
      ...await fetchPaginated('chats'),
      ...await fetchPaginated('groups'),
    ];

     const chats = Array.from(new Map<string, any>(rawItems.map((item: any): [string, any] => {
       const rawId = item.id || item.phone || item.groupId || item.groupJid || item.groupjid || item.jid || item.chatId;
       const isGroupListItem = item.__zapiListSource === 'groups';
       const normalizedId = normalizeZapiGroupId(rawId, isGroupListItem);
        const id = String(normalizedId || rawId || '');
        return [id, { ...item, id, phone: id, __isGroupListItem: isGroupListItem }];
      }).filter(([id]) => Boolean(id))).values());
     
 
   // Filter and map to unified format
    const resultsArray = await Promise.all(chats.map(async (chat: any) => {
      const id = normalizeZapiGroupId(chat.id || chat.phone || chat.groupId || chat.groupJid || chat.groupjid || chat.jid || chat.chatId, chat.__isGroupListItem === true);
     if (!id) return null;
 
     const isChannel = id.includes('@newsletter');
     const isGroup = id.includes('-group') || id.includes('@g.us');
     const isCommunity = id.includes('-community');
 
     // Only include groups, communities, and channels
     if (!isChannel && !isGroup && !isCommunity) return null;
 
      // Admin check: for groups, Z-API usually provides isAdmin flag in the list.
      // If not present, we check if the group owner matches our owner phone/lid.
      // Admin check: for groups, Z-API usually provides isAdmin flag in the list.
      let isAdmin = hasTruthyValue(chat.isAdmin) || hasTruthyValue(chat.isSuperAdmin) || hasTruthyValue(chat.is_admin) || false;
      
      if (!isAdmin) {
        const groupOwner = String(chat.owner || chat.Owner || chat.groupOwner || chat.creator || '');
        if (groupOwner) {
          if (ownerInfo.lid && groupOwner.includes(ownerInfo.lid)) isAdmin = true;
          const groupOwnerPhone = normalizePhoneFromJid(groupOwner);
          if (ownerInfo.phone && groupOwnerPhone && (groupOwnerPhone === ownerInfo.phone || groupOwnerPhone.endsWith(ownerInfo.phone) || ownerInfo.phone.endsWith(groupOwnerPhone))) {
            isAdmin = true;
          }
        }
      }

      let metadata: any = null;
       if ((isGroup || isCommunity) && (!isAdmin || !chat.name || !chat.subject)) {
        metadata = await fetchZapiGroupMetadata(id);
        if (!isAdmin) isAdmin = isOwnerAdminInGroup(metadata, chat, ownerInfo.phone, ownerInfo.lid);
      }

      // For channels and communities, we also consider the user an admin if the API says so 
      // or if it's a channel (usually you only see channels you own/administer in these APIs)
      // but let's be more precise if possible.
       if (!isAdmin && (isChannel || isCommunity || chat.__zapiListSource === 'groups')) {
         // If it's a channel, community, or comes from the specialized /groups endpoint,
         // there is a high probability the user has management rights or wants to see it.
         isAdmin = true;
       }

      let typeLabel = "Grupo";
     if (isChannel) typeLabel = "Canal";
     if (isCommunity) typeLabel = "Comunidade";
 
      const newsletterMetadata = isChannel ? await getNewsletterMetadata(instance, id) : { name: null, memberCount: 0, picture: null };
      const resolvedName = metadata?.subject || metadata?.name || metadata?.group?.subject || metadata?.data?.subject || chat.name || chat.subject || chat.groupName || chat.title || chat.chatName || chat.pushName || chat.fullName || chat.newsletterName || chat.newsletterTitle || newsletterMetadata.name || '';

     // Skip zombie/forbidden groups: chats listed as group but without a name
     // and no message history. These are typically groups the user was removed from.
     if (!resolvedName && isGroup && (!chat.lastMessageTime || String(chat.lastMessageTime) === '0')) {
       return null;
     }

     return {
       ...chat,
       id,
       phone: id,
         name: resolvedName || 'Canal sem nome',
        isAdmin,
       isChannel,
        isCommunity,
        isGroup,
        typeLabel,
         memberCount: isChannel
           ? (newsletterMetadata.memberCount || numericCount(chat.subscribersCount, chat.subscriberCount, chat.followersCount, chat.memberCount, chat.size))
           : numericCount(chat.memberCount, chat.size, chat.participantsCount, chat.membersCount),
        profilePicture: newsletterMetadata.picture || chat.profilePicture || chat.image || null,
       __sourceInstanceName: instance.instance_name,
       __sourceInstanceId: instance.zapi_instance_id,
     };
    }));
    
    const results = resultsArray.filter(Boolean);
 
    console.log(`✅ Z-API found ${results.length} valid groups/channels for ${instance.instance_name}`);
   return results;
 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let providerFilter: string | null = null;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body && typeof body.provider === "string") {
          providerFilter = body.provider;
        }
      }
    } catch (_) { /* ignore */ }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('No authorization header');
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized: ' + (userError?.message || 'User not found'));

    console.log(`📱 Fetching WhatsApp groups for user: ${user.id}`);
    if (providerFilter) console.log(`🔎 Provider filter: ${providerFilter}`);

    const { data: activeInstances, error: activeError } = await adminClient
      .from("zapi_instances")
      .select("zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key, instance_type")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
      
    if (activeError) console.error("❌ Error fetching active instances:", activeError);
    console.log(`🔎 Found ${activeInstances?.length || 0} active instances in DB for user ${user.id}`);

    const activeList = (activeInstances || []) as ZapiInstance[];
    const wantsUazapi = providerFilter?.toLowerCase() === 'uazapi';
    const activeUazapiInstances = activeList.filter((inst) => {
      const provider = (inst.api_provider || 'zapi').toLowerCase();
      return provider === 'uazapi';
    });

    const instances: ZapiInstance[] = wantsUazapi ? activeUazapiInstances : activeList;

    const normalizedProviderFilter = providerFilter?.toLowerCase() || null;
    const filteredInstances = instances.filter((inst) => {
      const provider = (inst.api_provider || 'zapi').toLowerCase();
      const isWarmup = provider.includes('warmup');
      const isMeta = provider === 'meta';
      const isUazapi = provider === 'uazapi';

      if (normalizedProviderFilter === 'uazapi') {
        return isUazapi && (inst as any).instance_type !== 'mobile';
      }

      if (normalizedProviderFilter === 'zapi_no_warmup_meta') {
        return provider === 'zapi';
      }

      if (normalizedProviderFilter === 'zapi') {
        return provider === 'zapi';
      }

      if (!normalizedProviderFilter) {
        return provider === 'zapi';
      }

      return provider === normalizedProviderFilter;
    });
    console.log(`📦 Group source instances: ${filteredInstances.length} / ${instances.length}`);

    // Verifica em paralelo quais instâncias estão realmente conectadas no WhatsApp.
    // Instâncias deslogadas/desconectadas não devem retornar grupos (mesmo que a API
    // ainda mantenha cache do lado dela).
    const connectivity = await Promise.all(
      filteredInstances.map(async (inst) => ({
        inst,
        connected: await isInstanceConnected(inst),
      }))
    );
    const liveInstances = connectivity.filter((c) => c.connected).map((c) => c.inst);
    const skipped = connectivity.length - liveInstances.length;
    if (skipped > 0) {
      console.log(`🚫 ${skipped} instância(s) ignorada(s) por estarem desconectadas`);
    }

    const groupsById = new Map<string, any>();

    for (const instance of liveInstances) {
      try {
        const provider = (instance.api_provider || 'zapi').toLowerCase();
        const rawGroups = (provider === 'uazapi' || provider === 'uazapi_warmup')
          ? await fetchGroupsViaUazapi(instance)
          : await fetchGroupsViaZapi(instance);
        for (const group of rawGroups) {
          const groupId = group.phone || group.id;
          if (!groupId) continue;
          const participants = extractParticipantsFromGroup(group);
          // Uazapi pode devolver as flags de comunidade em qualquer nível do payload.
           // Prefer provider-calculated flags if available
           // Be more inclusive for UAZAPI. If the ID contains @g.us, it's a group.
           const isChannel = group.isChannel === true || String(groupId).includes("@newsletter");
           const isCommunity = group.isCommunity === true || hasCommunityMetadata(group);
           const isGroup = group.isGroup === true || String(groupId).includes("-group") || String(groupId).includes("@g.us");
           
           // If it doesn't match standard patterns but we are in a group context, consider it a group
           const validGroup = isChannel || isGroup || isCommunity;

            const isAdmin = hasTruthyValue(group.isAdmin) ||
                            hasTruthyValue(group.isSuperAdmin) ||
                            hasTruthyValue(group.is_admin);

           if (!groupsById.has(groupId) && (isGroup || isCommunity || isChannel)) {
             groupsById.set(groupId, {
               id: groupId,
               nome: group.name || group.contact || group.subject || group.title || group.groupName || "Sem nome",
               descricao: group.description || group.desc || "",
               membros: participants.length || group.memberCount || group.size || 0,
                foto: group.foto || group.ProfilePicture || group.ProfilePicUrl || group.profilePicture || group.imgUrl || group.image || group.photo || null,
               ultimaMensagem: group.lastMessageTimestamp || group.lastMessageTime || null,
               isAdmin: isAdmin,
               participantes: participants,
               archived: group.archived || false,
               pinned: group.pinned || false,
               sourceInstanceName: group.__sourceInstanceName || null,
               sourceInstanceId: group.__sourceInstanceId || null,
               isCommunity: isCommunity,
               isChannel,
               isGroup,
               typeLabel: isChannel ? "Canal" : isCommunity ? "Comunidade" : "Grupo",
             });
           }
        }
      } catch (instanceError) {
        console.error(`❌ Failed for instance ${instance.instance_name}:`, instanceError);
      }
    }

    const allGroups = Array.from(groupsById.values());
    console.log(`✅ Total unique groups (including communities): ${allGroups.length}`);

    return new Response(JSON.stringify({ groups: allGroups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error fetching groups:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});