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

const fetchGroupsViaZapi = async (instance: ZapiInstance): Promise<any[]> => {
  const allGroups: any[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const zapiUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/groups?page=${page}&pageSize=${pageSize}`;
    const response = await fetch(zapiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": instance.zapi_client_token,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Z-API error for ${instance.instance_name}: ${response.status} - ${errorText}`);
      console.error(`❌ URL used: ${zapiUrl}`);
      break;
    }

    const data = await response.json();
    const groups = Array.isArray(data) ? data : [];
    console.log(`📄 Z-API ${instance.instance_name} | Page ${page}: ${groups.length} groups`);

    for (const group of groups) {
      allGroups.push({
        ...group,
        __sourceInstanceName: instance.instance_name || null,
        __sourceInstanceId: instance.zapi_instance_id,
      });
    }

    hasMore = groups.length === pageSize;
    page++;
    if (page > 20) break;
  }

  return allGroups;
};

const isUsableGroupName = (value: unknown) => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (/^\d+$/.test(normalized.replace(/\s+/g, ''))) return false;
  if (/^grupo sem nome$/i.test(normalized)) return false;
  return true;
};

const fetchGroupsViaUazapi = async (instance: ZapiInstance): Promise<any[]> => {
  const apiUrl = (instance.evolution_api_url || '').replace(/\/+$/, '');
  const apiToken = instance.evolution_api_key || '';
  if (!apiUrl || !apiToken) return [];

  const response = await fetch(`${apiUrl}/group/list?token=${encodeURIComponent(apiToken)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
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

    let detail: any = null;
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
    if (!isUsableGroupName(fallbackName)) {
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
        detail?.participants?.length ||
        detail?.group?.participants?.length ||
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

    console.log(`📱 Fetching WhatsApp groups for user: ${credentials.userId}`);

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

    console.log(`📦 Active instances: ${instances.length}`);

    const groupsById = new Map<string, any>();

    for (const instance of instances) {
      try {
        const rawGroups = instance.api_provider === 'uazapi'
          ? await fetchGroupsViaUazapi(instance)
          : await fetchGroupsViaZapi(instance);
        for (const group of rawGroups) {
          const groupId = group.phone || group.id;
          if (!groupId) continue;
          const isCommunity = !!(group.isCommunity || group.isCommunityAnnounce || group.isGroupAnnouncement);
          if (!groupsById.has(groupId)) {
            groupsById.set(groupId, {
              id: groupId,
              nome: group.name || group.contact || group.subject || group.title || group.groupName || "Grupo sem nome",
              descricao: group.description || group.desc || "",
              membros: group.participants?.length || group.memberCount || group.size || 0,
              foto: group.imgUrl || group.profilePicture || group.image || group.photo || null,
              ultimaMensagem: group.lastMessageTimestamp || group.lastMessageTime || null,
              isAdmin: group.isAdmin || false,
              participantes: group.participants || [],
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