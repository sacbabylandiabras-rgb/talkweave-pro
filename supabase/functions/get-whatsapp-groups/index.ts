import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";
import {
  buildEvolutionUrlCandidates,
  buildEvolutionInstanceCandidates,
  buildGroupsStrategies,
  executeStrategies,
} from "../_shared/evolution.ts";

interface ZapiInstance {
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
  instance_name: string | null;
  api_provider: string;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
}

const fetchGroupsViaEvolution = async (instance: ZapiInstance): Promise<any[]> => {
  const evoUrl = instance.evolution_api_url?.replace(/\/$/, '');
  const evoKey = instance.evolution_api_key;
  if (!evoUrl || !evoKey) return [];

  const urlCandidates = buildEvolutionUrlCandidates(evoUrl);
  const instanceCandidates = buildEvolutionInstanceCandidates(
    instance.zapi_instance_id,
    instance.instance_name || undefined,
  );

  const result = await executeStrategies(
    urlCandidates,
    (cfg) => buildGroupsStrategies(cfg),
    evoKey,
    instanceCandidates,
    '👥',
  );

  if (result.status < 200 || result.status >= 300) {
    console.error(`❌ Evolution groups error: ${result.status} ${result.rawText?.substring(0, 200)}`);
    return [];
  }

  const data = result.data;
  const groups = Array.isArray(data) ? data : [];

  return groups.map((g: any) => ({
    id: g.id || g.jid || g.groupJid || `group-${Math.random()}`,
    nome: g.subject || g.name || 'Grupo sem nome',
    descricao: g.description || g.desc || '',
    membros: g.participants?.length || g.size || 0,
    foto: g.profilePictureUrl || g.imgUrl || g.picture || null,
    ultimaMensagem: null,
    isAdmin: g.participants?.some?.((p: any) =>
      (p.admin === 'admin' || p.admin === 'superadmin') && p.id?.includes?.(instance.zapi_instance_id)
    ) || false,
    participantes: g.participants || [],
    archived: false,
    pinned: false,
    isCommunity: g.isCommunity || false,
    isCommunityAnnounce: g.isCommunityAnnounce || g.linkedParent ? true : false,
    sourceInstanceName: instance.instance_name || null,
    sourceInstanceId: instance.zapi_instance_id,
  }));
};

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
      console.error(`❌ Z-API error for ${instance.instance_name}: ${response.status}`);
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
              api_provider: credentials.apiProvider || 'zapi',
              evolution_api_url: credentials.evolutionApiUrl || null,
              evolution_api_key: credentials.evolutionApiKey || null,
            },
          ];

    console.log(`📦 Active instances: ${instances.length}`);

    const groupsById = new Map<string, any>();

    for (const instance of instances) {
      try {
        let rawGroups: any[];

        if (instance.api_provider === 'evolution') {
          rawGroups = await fetchGroupsViaEvolution(instance);
          // Already mapped
          for (const g of rawGroups) {
            if (!g.isCommunity && !g.isCommunityAnnounce) {
              if (!groupsById.has(g.id)) groupsById.set(g.id, g);
            }
          }
          continue;
        }

        // Z-API path
        rawGroups = await fetchGroupsViaZapi(instance);
        for (const group of rawGroups) {
          const groupId = group.phone || group.id;
          if (!groupId) continue;
          if (group.isCommunity || group.isCommunityAnnounce || group.isGroupAnnouncement) continue;
          if (!groupsById.has(groupId)) {
            groupsById.set(groupId, {
              id: groupId,
              nome: group.name || group.contact || group.subject || group.title || "Grupo sem nome",
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
            });
          }
        }
      } catch (instanceError) {
        console.error(`❌ Failed for instance ${instance.instance_name}:`, instanceError);
      }
    }

    const allGroups = Array.from(groupsById.values());
    console.log(`✅ Total unique groups (excluding communities): ${allGroups.length}`);

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
