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

    // Try to fetch group photo via Z-API
    let groupPhoto: string | null = null;
    if (targetGroup.instance_id) {
      try {
        const { data: instance } = await client
          .from("zapi_instances")
          .select("zapi_instance_id, zapi_token, zapi_client_token")
          .eq("zapi_instance_id", targetGroup.instance_id)
          .maybeSingle();

        if (instance) {
          const photoRes = await fetch(
            `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/profile-picture/${targetGroup.group_id}`,
            {
              headers: {
                "Content-Type": "application/json",
                "Client-Token": instance.zapi_client_token,
              },
            }
          );
          if (photoRes.ok) {
            const photoData = await photoRes.json();
            groupPhoto = photoData?.link || photoData?.profilePictureUrl || photoData?.imgUrl || null;
          }
        }
      } catch {
        // ignore photo fetch errors
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
