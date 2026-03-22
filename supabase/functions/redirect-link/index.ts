import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

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

    // Find the first non-full group in order
    const { data: groups } = await client
      .from("redirect_link_groups")
      .select("*")
      .eq("redirect_link_id", link.id)
      .eq("is_full", false)
      .order("sort_order", { ascending: true })
      .limit(1);

    let targetGroup = groups && groups.length > 0 ? groups[0] : null;

    if (!targetGroup) {
      const { data: anyGroup } = await client
        .from("redirect_link_groups")
        .select("*")
        .eq("redirect_link_id", link.id)
        .not("invite_link", "is", null)
        .order("sort_order", { ascending: true })
        .limit(1);

      if (anyGroup && anyGroup.length > 0) {
        targetGroup = anyGroup[0];
      }
    }

    if (!targetGroup || !targetGroup.invite_link) {
      return new Response(JSON.stringify({ error: "No available groups" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get group photo - first from DB, then try Z-API as fallback
    let groupPhoto: string | null = targetGroup.group_photo || null;
    
    if (!groupPhoto && targetGroup.instance_id) {
      try {
        const { data: instance } = await client
          .from("zapi_instances")
          .select("zapi_instance_id, zapi_token, zapi_client_token")
          .eq("zapi_instance_id", targetGroup.instance_id)
          .maybeSingle();

        console.log("Instance lookup result:", instance ? "found" : "not found", "for id:", targetGroup.instance_id);

        if (instance) {
          // Try profile-picture endpoint with -group format
          const groupId = targetGroup.group_id.includes("-group")
            ? targetGroup.group_id
            : targetGroup.group_id.replace("@g.us", "-group");
          
          const picRes = await fetch(
            `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/profile-picture/${groupId}`,
            {
              headers: {
                "Content-Type": "application/json",
                "Client-Token": instance.zapi_client_token,
              },
            }
          );

          console.log("Profile picture API status:", picRes.status);
          if (picRes.ok) {
            const picData = await picRes.json();
            console.log("Profile picture response:", JSON.stringify(picData));
            groupPhoto = picData?.link || picData?.imgUrl || picData?.profilePicture || picData?.image || null;
          }
        }
      } catch (e) {
        console.error("Photo fetch error:", e);
      }
    }

    // Track the click (fire and forget)
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
