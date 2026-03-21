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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, supabaseAnonKey);

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
    const { data: groups, error: groupsError } = await client
      .from("redirect_link_groups")
      .select("*")
      .eq("redirect_link_id", link.id)
      .eq("is_full", false)
      .order("sort_order", { ascending: true })
      .limit(1);

    if (groupsError || !groups || groups.length === 0) {
      // Fallback: try any group with an invite link
      const { data: anyGroup } = await client
        .from("redirect_link_groups")
        .select("*")
        .eq("redirect_link_id", link.id)
        .not("invite_link", "is", null)
        .order("sort_order", { ascending: true })
        .limit(1);

      if (anyGroup && anyGroup.length > 0 && anyGroup[0].invite_link) {
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: anyGroup[0].invite_link,
          },
        });
      }

      return new Response(JSON.stringify({ error: "No available groups" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetGroup = groups[0];
    if (targetGroup.invite_link) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: targetGroup.invite_link,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Group has no invite link" }), {
      status: 404,
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
