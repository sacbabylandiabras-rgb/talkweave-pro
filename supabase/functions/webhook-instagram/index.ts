import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = "zaplynx_ig_verify_2024";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Webhook verification (Meta sends GET request)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("📋 Webhook verification request:", { mode, token, challenge });

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verified successfully");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    console.error("❌ Webhook verification failed - token mismatch");
    return new Response("Forbidden", { status: 403 });
  }

  // Handle incoming webhook events (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();

      // Manual token save action
      if (body.action === "save_ig_token" && body.token && body.user_id) {
        console.log("💾 Saving Instagram token manually for user:", body.user_id);
        const igAppId = "829722106116857";

        // Get profile info with the token
        let username = "Instagram conectado";
        let igUserId = "";
        try {
          const profileRes = await fetch(
            `https://graph.instagram.com/v21.0/me?fields=user_id,username,name&access_token=${encodeURIComponent(body.token)}`
          );
          const profileData = await profileRes.json();
          console.log("Profile data:", JSON.stringify(profileData).slice(0, 300));
          if (profileRes.ok && !profileData.error) {
            username = profileData.username || profileData.name || username;
            igUserId = String(profileData.user_id || profileData.id || "");
          }
        } catch (e) {
          console.warn("Failed to fetch profile:", e);
        }

        const { data: existing } = await supabase
          .from("meta_credentials")
          .select("id")
          .eq("user_id", body.user_id)
          .eq("app_id", igAppId)
          .maybeSingle();

        const credData = {
          user_id: body.user_id,
          access_token: body.token,
          app_id: igAppId,
          fb_user_id: igUserId,
          fb_user_name: username,
          connected: true,
          updated_at: new Date().toISOString(),
        };

        const { error: dbError } = existing
          ? await supabase.from("meta_credentials").update(credData).eq("id", existing.id)
          : await supabase.from("meta_credentials").insert(credData);

        if (dbError) {
          console.error("DB error:", dbError);
          return new Response(JSON.stringify({ error: "Erro ao salvar token" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, username }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("📩 Instagram webhook event received:", JSON.stringify(body).slice(0, 500));

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Instagram sends events in this format:
      // { object: "instagram", entry: [{ id, time, messaging/changes }] }
      if (body.object === "instagram" && body.entry) {
        for (const entry of body.entry) {
          // Handle messaging events (DMs)
          if (entry.messaging) {
            for (const event of entry.messaging) {
              console.log("💬 Instagram messaging event:", JSON.stringify(event));
              
              if (event.message) {
                console.log(`📨 DM from ${event.sender?.id}: ${event.message.text || "(media)"}`);
              }
            }
          }

          // Handle comment/mention events
          if (entry.changes) {
            for (const change of entry.changes) {
              console.log(`🔔 Instagram change: field=${change.field}`, JSON.stringify(change.value));
              
              if (change.field === "comments") {
                const comment = change.value;
                console.log(`💬 Comment from ${comment.from?.username}: ${comment.text}`);
                
                // TODO: Process comment automation rules here
              }

              if (change.field === "mentions") {
                console.log(`📢 Mention detected:`, JSON.stringify(change.value));
              }
            }
          }
        }
      }

      // Always return 200 to acknowledge receipt
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("❌ Error processing Instagram webhook:", err);
      // Still return 200 to prevent Meta from retrying
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
