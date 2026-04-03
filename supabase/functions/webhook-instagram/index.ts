import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = "zaplynx_ig_verify_2024";
const IG_APP_ID = "829722106116857";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Webhook verification (Meta sends GET request)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Manual token save action
      if (body.action === "save_ig_token" && body.token && body.user_id) {
        console.log("💾 Saving Instagram token for user:", body.user_id);
        let username = "Instagram conectado";
        let igUserId = "";
        try {
          const profileRes = await fetch(
            `https://graph.instagram.com/v21.0/me?fields=user_id,username,name&access_token=${encodeURIComponent(body.token)}`
          );
          const profileData = await profileRes.json();
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
          .eq("app_id", IG_APP_ID)
          .maybeSingle();

        const credData = {
          user_id: body.user_id,
          access_token: body.token,
          app_id: IG_APP_ID,
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
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, username }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("📩 Instagram webhook:", JSON.stringify(body).slice(0, 500));

      if (body.object === "instagram" && body.entry) {
        for (const entry of body.entry) {
          const igPageId = String(entry.id);

          // Find the user who owns this Instagram page
          const { data: cred } = await supabase
            .from("meta_credentials")
            .select("user_id, access_token")
            .eq("fb_user_id", igPageId)
            .eq("app_id", IG_APP_ID)
            .eq("connected", true)
            .maybeSingle();

          if (!cred) {
            console.warn("⚠️ No user found for IG page:", igPageId);
            continue;
          }

          const userId = cred.user_id;
          const accessToken = cred.access_token;

          // Handle comment events
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.field === "comments") {
                const comment = change.value;
                const commentText = comment.text || "";
                const commentId = comment.id;
                const mediaId = comment.media?.id || "";
                const fromUsername = comment.from?.username || "";
                const fromId = comment.from?.id || "";

                console.log(`💬 Comment from @${fromUsername}: "${commentText}"`);

                // Log the event
                await supabase.from("instagram_events").insert({
                  user_id: userId,
                  event_type: "comment",
                  ig_user_id: fromId,
                  username: fromUsername,
                  media_id: mediaId,
                  comment_text: commentText,
                  payload: comment,
                  processed: false,
                });

                // Save/update contact
                const { data: existingContact } = await supabase
                  .from("instagram_contacts")
                  .select("id")
                  .eq("user_id", userId)
                  .eq("ig_user_id", fromId)
                  .maybeSingle();

                if (!existingContact) {
                  await supabase.from("instagram_contacts").insert({
                    user_id: userId,
                    ig_user_id: fromId,
                    username: fromUsername,
                    source: "comment",
                  });
                  console.log(`👤 New contact saved: @${fromUsername}`);
                }

                // Find matching automations
                const { data: automations } = await supabase
                  .from("instagram_automations")
                  .select("*")
                  .eq("user_id", userId)
                  .eq("active", true);

                if (!automations || automations.length === 0) {
                  console.log("ℹ️ No active automations for this user");
                  continue;
                }

                for (const auto of automations) {
                  const keywords = (auto.keyword || "")
                    .split(",")
                    .map((k: string) => k.trim().toLowerCase())
                    .filter(Boolean);

                  const commentLower = commentText.toLowerCase();
                  const matched = keywords.length === 0 || keywords.some((kw: string) => commentLower.includes(kw));

                  if (!matched) {
                    console.log(`⏭️ No keyword match for automation "${auto.name}"`);
                    continue;
                  }

                  console.log(`✅ Matched automation "${auto.name}" for comment "${commentText}"`);

                  // 1) Reply to comment publicly
                  if (auto.reply_comment && commentId && accessToken) {
                    try {
                      const replyText = auto.reply_comment
                        .replace(/\{\{nome_usuario\}\}/g, fromUsername)
                        .replace(/\{\{comentario\}\}/g, commentText);

                      const replyRes = await fetch(
                        `https://graph.instagram.com/v21.0/${commentId}/replies`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            message: replyText,
                            access_token: accessToken,
                          }),
                        }
                      );
                      const replyData = await replyRes.json();

                      if (replyRes.ok && !replyData.error) {
                        console.log(`✅ Reply sent to comment ${commentId}`);
                      } else {
                        console.error("❌ Reply error:", JSON.stringify(replyData));
                      }
                    } catch (e) {
                      console.error("❌ Reply failed:", e);
                    }
                  }

                  // 2) Send Private Reply DM (uses comment_id — no 24h window needed)
                  if (auto.dm_message && commentId && accessToken) {
                    try {
                      const dmText = auto.dm_message
                        .replace(/\{\{nome_usuario\}\}/g, fromUsername)
                        .replace(/\{\{comentario\}\}/g, commentText);

                      // Use Private Replies endpoint: recipient.comment_id
                      const dmRes = await fetch(
                        `https://graph.instagram.com/v21.0/${igPageId}/messages`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${accessToken}`,
                          },
                          body: JSON.stringify({
                            recipient: { comment_id: commentId },
                            message: { text: dmText },
                          }),
                        }
                      );
                      const dmData = await dmRes.json();

                      if (dmRes.ok && !dmData.error) {
                        console.log(`✅ Private Reply DM sent to @${fromUsername}`);

                        // Log DM event
                        await supabase.from("instagram_events").insert({
                          user_id: userId,
                          event_type: "dm_sent",
                          ig_user_id: fromId,
                          username: fromUsername,
                          media_id: mediaId,
                          comment_text: dmText,
                          payload: dmData,
                          processed: true,
                        });
                      } else {
                        console.error("❌ Private Reply DM error:", JSON.stringify(dmData));
                      }
                    } catch (e) {
                      console.error("❌ Private Reply DM failed:", e);
                    }
                  }

                  // Mark event as processed
                  // (update the last inserted event)
                  await supabase
                    .from("instagram_events")
                    .update({ processed: true })
                    .eq("user_id", userId)
                    .eq("ig_user_id", fromId)
                    .eq("event_type", "comment")
                    .eq("comment_text", commentText)
                    .eq("processed", false);
                }
              }

              if (change.field === "mentions") {
                console.log("📢 Mention:", JSON.stringify(change.value));
              }
            }
          }

          // Handle messaging events (DMs received)
          if (entry.messaging) {
            for (const event of entry.messaging) {
              if (event.message) {
                console.log(`📨 DM from ${event.sender?.id}: ${event.message.text || "(media)"}`);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("❌ Error:", err);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
