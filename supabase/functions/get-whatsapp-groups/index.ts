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

const fetchGroupsViaUazapi = async (instance: ZapiInstance): Promise<any[]> => {
  const apiUrl = (instance.evolution_api_url || '').replace(/\/+$/, '');
  const apiToken = instance.evolution_api_key || '';
  if (!apiUrl || !apiToken) return [];

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

  const rawGroups = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.groups)
      ? payload.groups
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  const detailedGroups = await Promise.all(rawGroups.map(async (group: any) => {
    const groupId = group?.JID || group?.id || group?.jid || group?.groupId || group?.remoteJid || group?.wa_chatid || '';
    if (!String(groupId).includes('@g.us')) return null;

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
    try {
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
      }
    } catch (error) {
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

  return detailedGroups.filter(Boolean);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
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
      activeInstances && activeInstances.length > 0
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
      const { data: profile } = await adminClient
        .from("profiles")
        .select("uazapi_url, uazapi_token")
        .eq("id", credentials.userId)
        .maybeSingle();
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

    // Apanhador de Grupos: usa SOMENTE Uazapi. Z-API é ignorada.
    const filteredInstances = instances.filter((inst) => inst.api_provider === "uazapi");
    console.log(`📦 Uazapi instances: ${filteredInstances.length} / ${instances.length} (Z-API ignorada)`);

    const groupsById = new Map<string, any>();

    for (const instance of filteredInstances) {
      try {
        const rawGroups = await fetchGroupsViaUazapi(instance);
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
          if (!groupsById.has(groupId)) {
            groupsById.set(groupId, {
              id: groupId,
              nome: group.name || group.contact || group.subject || group.title || group.groupName || "Grupo sem nome",
              descricao: group.description || group.desc || "",
              membros: participants.length || group.memberCount || group.size || 0,
              foto: group.imgUrl || group.profilePicture || group.image || group.photo || null,
              ultimaMensagem: group.lastMessageTimestamp || group.lastMessageTime || null,
              isAdmin: group.isAdmin || false,
              participantes: participants,
              archived: group.archived || false,
              pinned: group.pinned || false,
              sourceInstanceName: group.__sourceInstanceName || null,
              sourceInstanceId: group.__sourceInstanceId || null,
              isCommunity,
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});