import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let ig_user_id = url.searchParams.get("ig_user_id");
    let user_id = url.searchParams.get("user_id");

    if (!ig_user_id || !user_id) {
      try {
        const body = await req.json();
        ig_user_id = ig_user_id || body?.ig_user_id;
        user_id = user_id || body?.user_id;
      } catch (_) {}
    }

    if (!ig_user_id || !user_id) {
      return new Response(JSON.stringify({ error: "Missing ig_user_id or user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cred } = await admin
      .from("meta_credentials")
      .select("access_token")
      .eq("user_id", user_id)
      .eq("connected", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const token = cred?.access_token;
    if (!token) {
      return new Response(JSON.stringify({ error: "No Meta credentials" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile via Graph API (works for IGSIDs in messaging context)
    const graphUrl = `https://graph.facebook.com/v21.0/${ig_user_id}?fields=name,username,profile_pic&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(graphUrl);
    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      console.warn("[ig-profile-pic] Graph error:", data);
      return new Response(JSON.stringify({ error: "Graph fetch failed", details: data }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pic = data.profile_pic || null;
    const username = data.username || data.name || null;

    if (pic || username) {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (pic) update.profile_pic_url = pic;
      if (username) update.username = username;

      const { data: existing } = await admin
        .from("instagram_contacts")
        .select("id")
        .eq("user_id", user_id)
        .eq("ig_user_id", ig_user_id)
        .maybeSingle();

      if (existing) {
        await admin
          .from("instagram_contacts")
          .update(update)
          .eq("id", existing.id);
      } else {
        await admin.from("instagram_contacts").insert({
          user_id,
          ig_user_id,
          username: username || ig_user_id,
          profile_pic_url: pic,
          source: "graph_api",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, profile_pic_url: pic, username }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ig-profile-pic] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});