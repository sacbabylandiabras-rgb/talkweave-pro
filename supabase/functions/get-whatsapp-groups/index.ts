import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

interface ZapiInstance {
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
  instance_name: string | null;
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
      .select("zapi_instance_id, zapi_token, zapi_client_token, instance_name")
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

    console.log(`📦 Active instances: ${instances.length}`);

    const groupsById = new Map<string, any>();

    for (const instance of instances) {
      try {
        const rawGroups = await fetchGroupsViaZapi(instance);
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