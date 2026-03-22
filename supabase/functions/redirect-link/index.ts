import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

interface ZAPIInstance {
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
}

function zapiBase(inst: ZAPIInstance) {
  return `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}`;
}

function zapiHeaders(inst: ZAPIInstance) {
  return { "Content-Type": "application/json", "Client-Token": inst.zapi_client_token };
}

async function autoCreateGroup(
  client: any,
  link: any,
  templateGroup: any,
  instance: ZAPIInstance,
  allGroupsCount: number
) {
  const base = zapiBase(instance);
  const headers = zapiHeaders(instance);
  const templateGroupId = templateGroup.group_id.includes("-group")
    ? templateGroup.group_id
    : templateGroup.group_id.replace("@g.us", "-group");

  // 1. Get metadata of the template group (name, description, admins)
  let groupName = templateGroup.group_name;
  let description = "";
  let admins: string[] = [];
  let photoUrl: string | null = templateGroup.group_photo || null;

  try {
    const metaRes = await fetch(`${base}/group-metadata/${templateGroupId}`, {
      method: "GET",
      headers,
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      description = meta.description || "";
      // Extract admin phone numbers (excluding the bot itself)
      if (meta.participants) {
        admins = meta.participants
          .filter((p: any) => p.isAdmin || p.isSuperAdmin)
          .map((p: any) => {
            const phone = p.phone || p.id || "";
            return phone.replace("@c.us", "").replace("@s.whatsapp.net", "");
          })
          .filter((p: string) => p.length > 0);
      }
      // Use subject as base name if available
      if (meta.subject) groupName = meta.subject;
    }
  } catch (e) {
    console.error("Error fetching template group metadata:", e);
  }

  // 2. Generate new group name with incremented number
  // Try to detect pattern like "Group Name 2" -> "Group Name 3"
  const numberMatch = groupName.match(/^(.*?)(\s+(\d+))?\s*$/);
  let baseName = groupName;
  let nextNumber = allGroupsCount + 1;
  if (numberMatch && numberMatch[3]) {
    baseName = numberMatch[1];
    nextNumber = parseInt(numberMatch[3]) + 1;
  }
  const newGroupName = `${baseName} ${nextNumber}`;

  console.log(`🔄 Auto-creating group: "${newGroupName}" (based on "${groupName}")`);

  // 3. Create the new group
  const createRes = await fetch(`${base}/create-group`, {
    method: "POST",
    headers,
    body: JSON.stringify({ groupName: newGroupName, phones: [] }),
  });

  const createData = await createRes.json();
  console.log("📦 Create group response:", JSON.stringify(createData));

  const newGroupPhone = createData.phone || createData.groupId || null;
  if (!newGroupPhone) {
    throw new Error("Failed to create group - no phone returned");
  }

  const newGroupId = newGroupPhone.includes("-group")
    ? newGroupPhone
    : newGroupPhone.replace("@g.us", "-group");

  // Wait a moment for group to be fully created
  await new Promise((r) => setTimeout(r, 2000));

  // 4. Set description (fire and forget style, don't block)
  if (description) {
    try {
      await fetch(`${base}/update-group-description`, {
        method: "POST",
        headers,
        body: JSON.stringify({ groupId: newGroupId, groupDescription: description }),
      });
      console.log("✅ Description set");
    } catch (e) {
      console.error("Failed to set description:", e);
    }
  }

  // 5. Set photo
  if (photoUrl) {
    try {
      const cleanId = newGroupId.replace("-group", "@g.us");
      await fetch(`${base}/update-group-photo`, {
        method: "POST",
        headers,
        body: JSON.stringify({ groupId: cleanId, groupPhoto: photoUrl }),
      });
      console.log("✅ Photo set");
    } catch (e) {
      console.error("Failed to set photo:", e);
    }
  }

  // 6. Promote admins
  if (admins.length > 0) {
    try {
      await fetch(`${base}/add-admin`, {
        method: "POST",
        headers,
        body: JSON.stringify({ groupId: newGroupId, phones: admins }),
      });
      console.log(`✅ Promoted ${admins.length} admins`);
    } catch (e) {
      console.error("Failed to promote admins:", e);
    }
  }

  // 7. Get invite link
  let inviteLink: string | null = null;
  try {
    const inviteRes = await fetch(`${base}/group-invitation-link/${newGroupId}`, {
      method: "GET",
      headers,
    });
    if (inviteRes.ok) {
      const inviteData = await inviteRes.json();
      inviteLink = inviteData.invitationLink || inviteData.inviteLink || inviteData.link || null;
    }
  } catch (e) {
    console.error("Failed to get invite link:", e);
  }

  if (!inviteLink) {
    throw new Error("Failed to get invite link for new group");
  }

  // 8. Save the new group to redirect_link_groups
  const newSortOrder = allGroupsCount;
  const { error: insertError } = await client.from("redirect_link_groups").insert({
    redirect_link_id: link.id,
    user_id: link.user_id,
    group_id: newGroupId,
    group_name: newGroupName,
    invite_link: inviteLink,
    instance_id: instance.zapi_instance_id,
    sort_order: newSortOrder,
    current_members: 0,
    is_full: false,
    group_photo: photoUrl,
  });

  if (insertError) {
    console.error("Failed to insert new group:", insertError);
    throw new Error("Failed to save new group");
  }

  console.log(`✅ Auto-created group "${newGroupName}" and added to link "${link.name}"`);

  return {
    group_name: newGroupName,
    group_photo: photoUrl,
    invite_link: inviteLink,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, supabaseServiceKey);

    // Find the redirect link
    const { data: link, error: linkError } = await client
      .from("redirect_links")
      .select("*")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ALL groups for this link
    const { data: allGroups } = await client
      .from("redirect_link_groups")
      .select("*")
      .eq("redirect_link_id", link.id)
      .order("sort_order", { ascending: true });

    const groupsList = allGroups || [];
    const maxMembers = link.max_members_per_group || 250;

    // Helper: get real member count via Z-API
    async function getRealMemberCount(group: any, instance: ZAPIInstance): Promise<number> {
      try {
        const gid = group.group_id.includes("-group")
          ? group.group_id
          : group.group_id.replace("@g.us", "-group");
        const metaRes = await fetch(`${zapiBase(instance)}/group-metadata/${gid}`, {
          method: "GET",
          headers: zapiHeaders(instance),
        });
        if (metaRes.ok) {
          const meta = await metaRes.json();
          return meta.participants?.length || 0;
        }
      } catch {
        // ignore
      }
      return group.current_members || 0;
    }

    // Helper: get Z-API instance for a group
    async function getInstanceForGroup(group: any): Promise<ZAPIInstance | null> {
      if (!group.instance_id) return null;
      const { data } = await client
        .from("zapi_instances")
        .select("zapi_instance_id, zapi_token, zapi_client_token")
        .eq("zapi_instance_id", group.instance_id)
        .maybeSingle();
      return data || null;
    }

    // Find a non-full group, checking real member count
    let targetGroup: any = null;

    for (const group of groupsList) {
      if (group.is_full) continue;

      // Check real member count via Z-API
      const instance = await getInstanceForGroup(group);
      if (instance) {
        const realCount = await getRealMemberCount(group, instance);
        console.log(`📊 Group "${group.group_name}": ${realCount}/${maxMembers} members`);

        // Update DB with real count
        const isFull = realCount >= maxMembers;
        client.from("redirect_link_groups").update({
          current_members: realCount,
          is_full: isFull,
        }).eq("id", group.id).then(() => {});

        if (!isFull) {
          targetGroup = group;
          break;
        }
      } else {
        // No instance, use DB value
        if (!group.is_full) {
          targetGroup = group;
          break;
        }
      }
    }

    // If all groups are full, auto-create a new one
    if (!targetGroup && groupsList.length > 0) {
      const templateGroup = groupsList[groupsList.length - 1];
      const instance = await getInstanceForGroup(templateGroup);

      if (instance) {
        try {
          const result = await autoCreateGroup(client, link, templateGroup, instance, groupsList.length);
          
          const userAgent = req.headers.get("user-agent") || null;
          const forwarded = req.headers.get("x-forwarded-for");
          const ip = forwarded ? forwarded.split(",")[0].trim() : null;

          client.from("redirect_link_clicks").insert({
            redirect_link_id: link.id,
            group_redirected_to: result.group_name,
            ip_address: ip,
            user_agent: userAgent,
          }).then(() => {});

          return new Response(JSON.stringify({
            name: link.name,
            slug: link.slug,
            group_name: result.group_name,
            group_photo: result.group_photo,
            invite_link: result.invite_link,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("❌ Auto-create failed:", e);
        }
      }

      // Fallback: use any group with invite link
      targetGroup = groupsList.find((g: any) => g.invite_link) || null;
    }

    if (!targetGroup || !targetGroup.invite_link) {
      return new Response(JSON.stringify({ error: "No available groups" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get group photo from DB
    const groupPhoto: string | null = targetGroup.group_photo || null;

    // Track the click
    const userAgent = req.headers.get("user-agent") || null;
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : null;

    client.from("redirect_link_clicks").insert({
      redirect_link_id: link.id,
      group_redirected_to: targetGroup.group_name,
      ip_address: ip,
      user_agent: userAgent,
    }).then(() => {});

    return new Response(JSON.stringify({
      name: link.name,
      slug: link.slug,
      group_name: targetGroup.group_name,
      group_photo: groupPhoto,
      invite_link: targetGroup.invite_link,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Redirect error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
