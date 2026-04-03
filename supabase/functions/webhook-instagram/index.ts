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

                  // === FLOW ENGINE: traverse nodes/edges or use legacy fields ===
                  let flowNodes: any[] = [];
                  let flowEdges: any[] = [];
                  let isFlowMode = false;

                  try {
                    const parsed = JSON.parse(auto.dm_message || "");
                    if (parsed.__flow__ && parsed.nodes?.length > 0) {
                      flowNodes = parsed.nodes;
                      flowEdges = parsed.edges || [];
                      isFlowMode = true;
                    }
                  } catch { /* not flow JSON */ }

                  if (isFlowMode) {
                    // Traverse the flow graph starting from trigger nodes
                    const visited = new Set<string>();
                    const replaceVars = (txt: string) =>
                      txt.replace(/\{\{nome_usuario\}\}/g, fromUsername)
                         .replace(/\{\{comentario\}\}/g, commentText);

                    // Get outgoing edges, optionally filtering by source handle
                    const getOutgoing = (nodeId: string, handleFilter?: string) =>
                      flowEdges
                        .filter((e: any) => {
                          if (e.source !== nodeId) return false;
                          if (handleFilter !== undefined) {
                            return e.sourceHandle === handleFilter;
                          }
                          return true;
                        })
                        .map((e: any) => flowNodes.find((n: any) => n.id === e.target))
                        .filter(Boolean);

                    const executeNode = async (node: any) => {
                      if (visited.has(node.id)) return;
                      visited.add(node.id);

                      const d = node.data || {};

                      if (node.type === "igResposta" && d.message && commentId && accessToken) {
                        try {
                          const replyText = replaceVars(d.message);
                          const res = await fetch(
                            `https://graph.instagram.com/v21.0/${commentId}/replies`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ message: replyText, access_token: accessToken }),
                            }
                          );
                          const rd = await res.json();
                          if (res.ok && !rd.error) console.log(`✅ Reply sent to comment ${commentId}`);
                          else console.error("❌ Reply error:", JSON.stringify(rd));
                        } catch (e) { console.error("❌ Reply failed:", e); }
                      }

                      if (node.type === "igDM" && fromId && accessToken) {
                        try {
                          const dmText = replaceVars(d.message || "");
                          const dmButtons = (d.buttons || []).filter((b: any) => b.title && (b.url || b.type === "reply"));
                          let messagePayload: any;

                          if (dmButtons.length > 0) {
                            const apiButtons = dmButtons.slice(0, 3).map((b: any) => {
                              if (b.type === "reply") return { type: "postback", title: (b.title || "").slice(0, 20), payload: b.title || "reply" };
                              return { type: "web_url", title: (b.title || "").slice(0, 20), url: b.url };
                            });
                            messagePayload = {
                              attachment: {
                                type: "template",
                                payload: { template_type: "button", text: dmText || "Selecione uma opção:", buttons: apiButtons },
                              },
                            };
                          } else {
                            if (!dmText) { /* skip empty DM */ }
                            messagePayload = { text: dmText };
                          }

                          if (messagePayload) {
                            const dmRes = await fetch(
                              `https://graph.instagram.com/v21.0/${igPageId}/messages`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                                body: JSON.stringify({ recipient: { id: fromId }, message: messagePayload }),
                              }
                            );
                            const dmData = await dmRes.json();

                            if (dmRes.ok && !dmData.error) {
                              console.log(`✅ DM sent to @${fromUsername}${dmButtons.length > 0 ? ` (${dmButtons.length} btn)` : ""}`);
                              await supabase.from("instagram_events").insert({
                                user_id: userId, event_type: "dm_sent", ig_user_id: fromId,
                                username: fromUsername, media_id: mediaId, comment_text: dmText,
                                payload: dmData, processed: true,
                              });
                            } else {
                              console.error("❌ DM error:", JSON.stringify(dmData));
                              // Fallback: Private Reply text
                              const btnLines = dmButtons.map((b: any) => b.type === "reply" ? `▶ ${b.title}` : `🔗 ${b.title}: ${b.url}`);
                              const fallbackText = (dmText + (btnLines.length > 0 ? "\n\n" + btnLines.join("\n") : "")).trim();
                              if (fallbackText && commentId) {
                                const fbRes = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                                  body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: fallbackText } }),
                                });
                                const fbData = await fbRes.json();
                                if (fbRes.ok && !fbData.error) console.log(`✅ Fallback sent to @${fromUsername}`);
                                else console.error("❌ Fallback failed:", JSON.stringify(fbData));
                              }
                            }
                          }
                        } catch (e) { console.error("❌ DM failed:", e); }
                      }

                      if (node.type === "igDelay") {
                        const val = parseInt(d.delayValue) || 0;
                        const unit = d.delayUnit || "seconds";
                        const ms = val * (unit === "hours" ? 3600000 : unit === "minutes" ? 60000 : 1000);
                        if (ms > 0 && ms <= 30000) {
                          console.log(`⏱ Waiting ${val} ${unit}...`);
                          await new Promise(r => setTimeout(r, ms));
                        } else if (ms > 30000) {
                          console.log(`⏱ Delay ${val} ${unit} too long for sync execution, skipping`);
                        }
                      }

                      // Traverse children — if DM has buttons, STOP (don't follow button paths)
                      // Button paths (btn-0, btn-1...) are only followed when user clicks a button
                      const dmButtons = (node.data?.buttons || []).filter((b: any) => b.title);
                      if (node.type === "igDM" && dmButtons.length > 0) {
                        // Only follow the default bottom handle, not button-specific handles
                        const defaultChildren = getOutgoing(node.id, "source-bottom");
                        for (const child of defaultChildren) {
                          await executeNode(child);
                        }
                        console.log(`⏹ DM node "${node.data?.label}" has ${dmButtons.length} buttons — waiting for user response to branch`);
                      } else {
                        const children = getOutgoing(node.id);
                        for (const child of children) {
                          await executeNode(child);
                        }
                      }
                    };

                    // Start from trigger nodes
                    const triggerNodes = flowNodes.filter((n: any) => n.type === "igGatilho");
                    for (const trigger of triggerNodes) {
                      const children = getOutgoing(trigger.id);
                      for (const child of children) {
                        await executeNode(child);
                      }
                    }
                  } else {
                    // === LEGACY MODE: use flat fields ===
                    if (auto.reply_comment && commentId && accessToken) {
                      try {
                        const replyText = auto.reply_comment
                          .replace(/\{\{nome_usuario\}\}/g, fromUsername)
                          .replace(/\{\{comentario\}\}/g, commentText);
                        const replyRes = await fetch(`https://graph.instagram.com/v21.0/${commentId}/replies`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ message: replyText, access_token: accessToken }),
                        });
                        const replyData = await replyRes.json();
                        if (replyRes.ok && !replyData.error) console.log(`✅ Reply sent to comment ${commentId}`);
                        else console.error("❌ Reply error:", JSON.stringify(replyData));
                      } catch (e) { console.error("❌ Reply failed:", e); }
                    }

                    if (auto.dm_message && fromId && accessToken) {
                      try {
                        let dmText = auto.dm_message;
                        let dmButtons: any[] = [];
                        try {
                          const p = JSON.parse(auto.dm_message);
                          if (p.text !== undefined) { dmText = p.text || ""; dmButtons = (p.buttons || []).filter((b: any) => b.title && (b.url || b.type === "reply")); }
                        } catch {}
                        dmText = dmText.replace(/\{\{nome_usuario\}\}/g, fromUsername).replace(/\{\{comentario\}\}/g, commentText);
                        let messagePayload: any;
                        if (dmButtons.length > 0) {
                          const apiButtons = dmButtons.slice(0, 3).map((b: any) => b.type === "reply" ? { type: "postback", title: (b.title || "").slice(0, 20), payload: b.title || "reply" } : { type: "web_url", title: (b.title || "").slice(0, 20), url: b.url });
                          messagePayload = { attachment: { type: "template", payload: { template_type: "button", text: dmText || "Selecione uma opção:", buttons: apiButtons } } };
                        } else {
                          messagePayload = { text: dmText };
                        }
                        const dmRes = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                          body: JSON.stringify({ recipient: { id: fromId }, message: messagePayload }),
                        });
                        const dmData = await dmRes.json();
                        if (dmRes.ok && !dmData.error) console.log(`✅ DM sent to @${fromUsername}`);
                        else console.error("❌ DM error:", JSON.stringify(dmData));
                      } catch (e) { console.error("❌ DM failed:", e); }
                    }
                  }

                  // Mark event as processed
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

          // Handle messaging events (DMs received / postback button clicks)
          if (entry.messaging) {
            for (const event of entry.messaging) {
              const senderId = event.sender?.id;

              // Handle postback (button click from interactive DM)
              if (event.postback && senderId && accessToken) {
                const payload = event.postback.payload || "";
                const title = event.postback.title || payload;
                console.log(`🔘 Postback from ${senderId}: "${title}" (payload: ${payload})`);

                // Find active automations with flows
                const { data: automations } = await supabase
                  .from("instagram_automations")
                  .select("*")
                  .eq("user_id", userId)
                  .eq("active", true);

                for (const auto of (automations || [])) {
                  try {
                    const parsed = JSON.parse(auto.dm_message || "");
                    if (!parsed.__flow__ || !parsed.nodes?.length) continue;

                    const fNodes = parsed.nodes;
                    const fEdges = parsed.edges || [];

                    // Find DM nodes that have a button matching the clicked payload/title
                    for (const node of fNodes) {
                      if (node.type !== "igDM") continue;
                      const buttons = (node.data?.buttons || []);
                      const btnIndex = buttons.findIndex((b: any) =>
                        b.title === title || b.title === payload
                      );
                      if (btnIndex === -1) continue;

                      console.log(`✅ Found matching button "${title}" at index ${btnIndex} in node ${node.id}`);

                      // Follow the edge from this button's handle
                      const handleId = `btn-${btnIndex}`;
                      const branchEdges = fEdges.filter((e: any) => e.source === node.id && e.sourceHandle === handleId);

                      const replaceVars = (txt: string) =>
                        txt.replace(/\{\{nome_usuario\}\}/g, event.sender?.username || "")
                           .replace(/\{\{comentario\}\}/g, title);

                      const visited = new Set<string>();
                      const executeNode = async (n: any) => {
                        if (visited.has(n.id)) return;
                        visited.add(n.id);
                        const d = n.data || {};

                        if (n.type === "igDM" && accessToken) {
                          const dmText = replaceVars(d.message || "");
                          const dmButtons = (d.buttons || []).filter((b: any) => b.title && (b.url || b.type === "reply"));
                          let messagePayload: any;
                          if (dmButtons.length > 0) {
                            const apiButtons = dmButtons.slice(0, 3).map((b: any) =>
                              b.type === "reply"
                                ? { type: "postback", title: (b.title || "").slice(0, 20), payload: b.title || "reply" }
                                : { type: "web_url", title: (b.title || "").slice(0, 20), url: b.url }
                            );
                            messagePayload = { attachment: { type: "template", payload: { template_type: "button", text: dmText || "Selecione:", buttons: apiButtons } } };
                          } else if (dmText) {
                            messagePayload = { text: dmText };
                          }
                          if (messagePayload) {
                            const res = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                              body: JSON.stringify({ recipient: { id: senderId }, message: messagePayload }),
                            });
                            const rd = await res.json();
                            if (res.ok && !rd.error) console.log(`✅ Branch DM sent to ${senderId}`);
                            else console.error("❌ Branch DM error:", JSON.stringify(rd));
                          }
                        }

                        if (n.type === "igDelay") {
                          const ms = (parseInt(d.delayValue) || 0) * (d.delayUnit === "hours" ? 3600000 : d.delayUnit === "minutes" ? 60000 : 1000);
                          if (ms > 0 && ms <= 30000) await new Promise(r => setTimeout(r, ms));
                        }

                        // Continue traversal (stop at button nodes)
                        const btnCount = (n.data?.buttons || []).filter((b: any) => b.title).length;
                        if (n.type === "igDM" && btnCount > 0) {
                          const defaultEdges = fEdges.filter((e: any) => e.source === n.id && e.sourceHandle === "source-bottom");
                          for (const e of defaultEdges) {
                            const next = fNodes.find((fn: any) => fn.id === e.target);
                            if (next) await executeNode(next);
                          }
                        } else {
                          const nextEdges = fEdges.filter((e: any) => e.source === n.id);
                          for (const e of nextEdges) {
                            const next = fNodes.find((fn: any) => fn.id === e.target);
                            if (next) await executeNode(next);
                          }
                        }
                      };

                      for (const edge of branchEdges) {
                        const target = fNodes.find((fn: any) => fn.id === edge.target);
                        if (target) await executeNode(target);
                      }
                      break; // Only process first matching automation
                    }
                  } catch { /* not flow JSON */ }
                }
              }

              if (event.message) {
                console.log(`📨 DM from ${senderId}: ${event.message.text || "(media)"}`);
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
