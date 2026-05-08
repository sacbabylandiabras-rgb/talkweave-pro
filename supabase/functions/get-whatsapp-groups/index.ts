import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

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

const fetchOwnerJidViaUazapi = async (apiUrl: string, apiToken: string): Promise<string | null> => {
  const endpoints = ['/instance/me', '/instance/status', '/instance', '/status'];
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
    if (provider === 'uazapi') {
      const apiUrl = (instance.evolution_api_url || '').replace(/\/+$/, '');
      const apiToken = instance.evolution_api_key || instance.zapi_token || '';
      if (!apiUrl || !apiToken) return false;
      const endpoints = ['/instance/status', '/status', '/instance'];
      for (const ep of endpoints) {
        try {
          const r = await fetch(`${apiUrl}${ep}`, {
            method: 'GET',
            headers: { token: apiToken, 'Content-Type': 'application/json' },
          });
          if (!r.ok) continue;
          const j = await r.json().catch(() => null);
          if (!j) continue;
          const status = String(
            j?.instance?.status || j?.status || j?.connectionStatus || j?.state || ''
          ).toLowerCase();
          const negativeStates = ['disconnected', 'disconnect', 'closed', 'close', 'logout', 'logged_out', 'loggedout', 'offline'];
          if (
            j?.connected === false ||
            j?.loggedIn === false ||
            j?.instance?.connected === false ||
            negativeStates.some((s) => status === s || status.includes(s))
          ) {
            return false;
          }
          const connected =
            j?.connected === true ||
            j?.loggedIn === true ||
            j?.instance?.connected === true ||
            ['connected', 'open', 'online', 'logged_in', 'loggedin', 'connected_in'].some((s) =>
              status === s
            );
          if (connected) return true;
          // resposta válida mas não conectada
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
  const text = JSON.stringify(payload || {}).toLowerCase();
  return /whatsapp disconnected|disconnected|logged[_\s-]?out|logout|offline|closed/.test(text);
};

const normalizePhoneFromJid = (jid: string | null | undefined): string => {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
};

const isOwnerAdminInGroup = (detail: any, group: any, ownerPhone: string, ownerLid?: string): boolean => {
  if (!ownerPhone && !ownerLid) return false;
  const participants = extractParticipantsFromGroup({ ...group, ...detail });
  if (!Array.isArray(participants) || participants.length === 0) return false;
  for (const p of participants) {
    const id = String(p?.id || p?.phone || p?.jid || p?.JID || p?.participant || '');
    // Match por LID quando o participante vier como @lid
    if (ownerLid && id.includes(ownerLid)) {
      const adminFlagLid =
        p?.isAdmin === true || p?.IsAdmin === true ||
        p?.isSuperAdmin === true || p?.IsSuperAdmin === true ||
        p?.admin === 'admin' || p?.admin === 'superadmin' ||
        p?.role === 'admin' || p?.role === 'superadmin';
      if (adminFlagLid) return true;
    }
    const phone = normalizePhoneFromJid(id);
    if (!phone || !ownerPhone) continue;
    if (phone === ownerPhone || phone.endsWith(ownerPhone) || ownerPhone.endsWith(phone)) {
      const adminFlag =
        p?.isAdmin === true ||
        p?.IsAdmin === true ||
        p?.isSuperAdmin === true ||
        p?.IsSuperAdmin === true ||
        p?.admin === 'admin' ||
        p?.admin === 'superadmin' ||
        p?.role === 'admin' ||
        p?.role === 'superadmin';
      if (adminFlag) return true;
    }
  }
  // Fallback: owner field of the group
  const ownerField = String(detail?.Owner || detail?.owner || group?.Owner || group?.owner || '');
  if (ownerField) {
    if (ownerLid && ownerField.includes(ownerLid)) return true;
    const ownerFieldPhone = normalizePhoneFromJid(ownerField);
    if (ownerPhone && ownerFieldPhone && (ownerFieldPhone === ownerPhone || ownerFieldPhone.endsWith(ownerPhone) || ownerPhone.endsWith(ownerFieldPhone))) {
      return true;
    }
  }
  return false;
};

const fetchGroupsViaUazapi = async (instance: ZapiInstance): Promise<any[]> => {
  const apiUrl = (instance.evolution_api_url || '').replace(/\/+$/, '');
  const apiToken = instance.evolution_api_key || '';
  if (!apiUrl || !apiToken) return [];

  const ownerJid = await fetchOwnerJidViaUazapi(apiUrl, apiToken);
  const ownerPhone = normalizePhoneFromJid(ownerJid);
  console.log(`👤 UAZAPI owner phone for ${instance.instance_name}: ${ownerPhone || '(unknown)'}`);

  const response = await fetch(`${apiUrl}/group/list`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'token': apiToken,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`❌ UAZAPI group/list error for ${instance.instance_name}: ${response.status} - ${JSON.stringify(payload)}`);
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

  const combinedRaw = [...rawGroups, ...rawChannels];

  let detailedGroups: any[] = [];
  try {
    detailedGroups = await Promise.all(combinedRaw.map(async (group: any) => {
    const groupId = group?.JID || group?.id || group?.jid || group?.groupId || group?.remoteJid || group?.wa_chatid || '';
    const isChannel = group?.__isChannel === true || String(groupId).includes('@newsletter');
    if (!isChannel && !String(groupId).includes('@g.us')) return null;

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
      const infoResponse = await fetch(`${apiUrl}/group/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token: apiToken,
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

    return {
      ...group,
      ...detail,
      id: groupId,
      phone: groupId,
      name: resolvedName,
      isAdmin: isChannel ? true : isOwnerAdminInGroup(detail, group, ownerPhone),
      isChannel,
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
        detail?.imageUrl ||
        detail?.picture ||
        detail?.profilePicUrl ||
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

const normalizeZapiGroupId = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.includes('@newsletter') || raw.includes('-community')) return raw;
  if (raw.includes('-group')) return raw;
  if (raw.includes('@g.us')) return raw.replace(/@g\.us$/i, '-group');
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 12 ? `${digits}-group` : raw;
};

 const getNewsletterName = async (instance: ZapiInstance, newsletterId: string): Promise<string | null> => {
   try {
     const baseUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`;
     const res = await fetch(`${baseUrl}/newsletter/${newsletterId}`, {
       method: 'GET',
       headers: { 'Content-Type': 'application/json', 'Client-Token': instance.zapi_client_token || '' },
     });
     const data = await res.json().catch(() => null);
     return data?.name || data?.subject || data?.newsletterName || data?.newsletterTitle || null;
   } catch (e) {
     console.error(`⚠️ Failed to fetch newsletter name for ${newsletterId}:`, e);
     return null;
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

    const rawItems = [
      ...await fetchPaginated('chats'),
      ...await fetchPaginated('groups'),
    ];

    const chats = Array.from(new Map(rawItems.map((item: any) => {
      const rawId = item.id || item.phone || item.groupId || item.groupJid || item.groupjid || item.jid || item.chatId;
      const normalizedId = normalizeZapiGroupId(rawId);
      return [normalizedId || rawId, { ...item, id: normalizedId || rawId, phone: normalizedId || rawId }];
    }).filter(([id]) => Boolean(id))).values());
    console.log(`📥 Z-API total unique group/chat records for ${instance.instance_name}: ${chats.length}`);
 
   // Filter and map to unified format
    const resultsArray = await Promise.all(chats.map(async (chat: any) => {
      const id = normalizeZapiGroupId(chat.id || chat.phone || chat.groupId || chat.groupJid || chat.groupjid || chat.jid || chat.chatId);
     if (!id) return null;
 
     const isChannel = id.includes('@newsletter');
     const isGroup = id.includes('-group') || id.includes('@g.us');
     const isCommunity = id.includes('-community');
 
     // Only include groups, communities, and channels
     if (!isChannel && !isGroup && !isCommunity) return null;
 
      // Admin check: for groups, Z-API usually provides isAdmin flag in the list.
      // If not present, we check if the group owner matches our owner phone/lid.
      let isAdmin = chat.isAdmin === true || chat.isSuperAdmin === true || false;
      
      if (!isAdmin) {
        const groupOwner = String(chat.owner || chat.Owner || chat.groupOwner || '');
        if (groupOwner) {
          if (ownerInfo.lid && groupOwner.includes(ownerInfo.lid)) isAdmin = true;
          const groupOwnerPhone = normalizePhoneFromJid(groupOwner);
          if (ownerInfo.phone && groupOwnerPhone && (groupOwnerPhone === ownerInfo.phone || groupOwnerPhone.endsWith(ownerInfo.phone) || ownerInfo.phone.endsWith(groupOwnerPhone))) {
            isAdmin = true;
          }
        }
      }

      // For channels and communities, we also consider the user an admin if the API says so 
      // or if it's a channel (usually you only see channels you own/administer in these APIs)
      // but let's be more precise if possible.
      if (!isAdmin && (isChannel || isCommunity)) {
        // Fallback for Z-API: if we see it in the list and it's a community/channel, 
        // it's likely we have some management rights, but let's default to true 
        // for now as it was before, unless we find a reason not to.
        isAdmin = true;
      }

      let typeLabel = "Grupo";
     if (isChannel) typeLabel = "Canal";
     if (isCommunity) typeLabel = "Comunidade";
 
     const resolvedName = chat.name || chat.subject || chat.groupName || chat.title || chat.chatName || chat.pushName || chat.fullName || chat.newsletterName || chat.newsletterTitle || '';

     // Skip zombie/forbidden groups: chats listed as group but without a name
     // and no message history. These are typically groups the user was removed from.
     if (!resolvedName && isGroup && (!chat.lastMessageTime || String(chat.lastMessageTime) === '0')) {
       return null;
     }

     return {
       ...chat,
       id,
       phone: id,
        name: (isChannel && !resolvedName) ? (await getNewsletterName(instance, id) || 'Canal sem nome') : (resolvedName || 'Sem nome'),
        isAdmin,
       isChannel,
        isCommunity,
        isGroup,
        typeLabel,
        memberCount: chat.memberCount || chat.size || chat.participantsCount || chat.membersCount || 0,
       profilePicture: chat.profilePicture || chat.image || null,
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
    let profileOnly = false;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body && typeof body.provider === "string") {
          providerFilter = body.provider;
        }
        profileOnly = body?.source === 'profile' || body?.profileOnly === true;
      }
    } catch (_) { /* ignore */ }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('No authorization header');
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized: ' + (userError?.message || 'User not found'));
    const credentials = profileOnly
      ? { userId: user.id, instanceId: '', token: '', clientToken: '', instanceName: '' }
      : await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);

    console.log(`📱 Fetching WhatsApp groups for user: ${credentials.userId}`);
    if (providerFilter) console.log(`🔎 Provider filter: ${providerFilter}`);

    const { data: activeInstances } = await adminClient
      .from("zapi_instances")
      .select("zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key")
      .eq("user_id", credentials.userId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    const instances: ZapiInstance[] =
      profileOnly
        ? []
        : activeInstances && activeInstances.length > 0
        ? (activeInstances as ZapiInstance[])
        : [
            {
              zapi_instance_id: credentials.instanceId,
              zapi_token: credentials.token,
              zapi_client_token: credentials.clientToken,
              instance_name: credentials.instanceName || null,
            },
          ];

    // Also include uazapi credentials configured at the profile level (up to 2 instances, separated by '|')
    try {
      const shouldLoadProfileUazapi = !providerFilter || providerFilter.toLowerCase() === 'uazapi';
      const { data: profile } = shouldLoadProfileUazapi ? await adminClient
        .from("profiles")
        .select("uazapi_url, uazapi_token")
        .eq("id", credentials.userId)
        .maybeSingle() : { data: null };
      const urls = String((profile as any)?.uazapi_url || '').split('|').map((v) => v.trim()).filter(Boolean);
      const tokens = String((profile as any)?.uazapi_token || '').split('|').map((v) => v.trim()).filter(Boolean);
      const pairCount = Math.min(urls.length, tokens.length);
      for (let i = 0; i < pairCount; i++) {
        const url = urls[i];
        const token = tokens[i];
        // Avoid duplicating if same uazapi already exists in zapi_instances
        const exists = instances.some(
          (inst) => inst.api_provider === 'uazapi'
            && (inst.evolution_api_url || '').replace(/\/+$/, '') === url.replace(/\/+$/, '')
            && (inst.evolution_api_key || '') === token
        );
        if (exists) continue;
        instances.push({
          zapi_instance_id: `profile-uazapi-${i + 1}`,
          zapi_token: token,
          zapi_client_token: token,
          instance_name: `uazapi #${i + 1} (perfil)`,
          api_provider: 'uazapi',
          evolution_api_url: url,
          evolution_api_key: token,
        });
      }
    } catch (profileError) {
      console.error("⚠️ Failed to load profile uazapi credentials:", profileError);
    }

    const normalizedProviderFilter = providerFilter?.toLowerCase() || null;
    const filteredInstances = instances.filter((inst) => {
      const provider = (inst.api_provider || 'zapi').toLowerCase();
      return !normalizedProviderFilter || provider === normalizedProviderFilter;
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
        const rawGroups = provider === 'uazapi'
          ? await fetchGroupsViaUazapi(instance)
          : await fetchGroupsViaZapi(instance);
        for (const group of rawGroups) {
          const groupId = group.phone || group.id;
          if (!groupId) continue;
          const participants = extractParticipantsFromGroup(group);
          // Uazapi pode devolver as flags de comunidade em qualquer nível do payload.
          const explicitCommunity = hasCommunityMetadata(group);
          let lidOnlyCommunity = false;
          if (!explicitCommunity && Array.isArray(participants) && participants.length >= 3) {
            const lidCount = participants.filter((p: any) => {
              const id = String(p?.id || p?.phone || p?.jid || p || "");
              return id.includes("@lid");
            }).length;
            // Se 80%+ dos participantes vêm como @lid, tratamos como comunidade
            lidOnlyCommunity = lidCount / participants.length >= 0.8;
          }
          const isCommunity = explicitCommunity || lidOnlyCommunity;
          const isChannel = group.isChannel === true || String(groupId).includes("@newsletter");
          if (!groupsById.has(groupId)) {
            groupsById.set(groupId, {
              id: groupId,
              nome: group.name || group.contact || group.subject || group.title || group.groupName || "Grupo sem nome",
              descricao: group.description || group.desc || "",
              membros: participants.length || group.memberCount || group.size || 0,
              foto: group.imgUrl || group.profilePicture || group.image || group.photo || null,
              ultimaMensagem: group.lastMessageTimestamp || group.lastMessageTime || null,
               isAdmin: group.isAdmin || group.isSuperAdmin || false,
              participantes: participants,
              archived: group.archived || false,
              pinned: group.pinned || false,
              sourceInstanceName: group.__sourceInstanceName || null,
              sourceInstanceId: group.__sourceInstanceId || null,
              isCommunity: isCommunity && !isChannel,
              isChannel,
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