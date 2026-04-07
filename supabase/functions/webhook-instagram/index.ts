import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = "zaplynx_ig_verify_2024";
const IG_APP_ID = "1277301917708506";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Shared URL tracker wrapper for click metrics
const buildWrapUrl = (autoName: string, userId: string, fromUsername: string) => {
  const SUPABASE_URL_BASE = Deno.env.get("SUPABASE_URL")!;
  return (originalUrl: string, btnTitle: string) => {
    const trackBase = `${SUPABASE_URL_BASE}/functions/v1/track-flow-click`;
    const params = new URLSearchParams({
      url: originalUrl,
      flow: autoName,
      btn: btnTitle,
      uid: userId,
      ph: fromUsername,
      src: "ig",
    });
    return `${trackBase}?${params.toString()}`;
  };
};

// Helper: execute WhatsApp flow nodes directly (mirrors webhook-zapi logic)
const sendFlowNodeContent = async (
  node: any,
  phone: string,
  zapiCreds: any,
  supabase: any,
  userId: string,
  flowName: string,
) => {
  if (node.type !== "blocoConteudo") return false;

  const contentType = node.data?.contentType || "text";
  const content = node.data?.content || "";
  const mediaUrl = node.data?.mediaUrl || "";
  const buttons: any[] = node.data?.buttons || [];
  const baseUrl = `https://api.z-api.io/instances/${zapiCreds.zapi_instance_id}/token/${zapiCreds.zapi_token}`;
  const headers = { "Content-Type": "application/json", "Client-Token": zapiCreds.zapi_client_token };

  const sendableButtons = buttons.filter((b: any) => b.type !== "flow");
  const flowButtons = buttons.filter((b: any) => b.type === "flow");
  const allButtons = [...sendableButtons, ...flowButtons.map((b: any) => ({ ...b, type: "reply" }))];
  const hasButtons = allButtons.length > 0;

  try {
    if (hasButtons) {
      // Send media first if present with buttons
      if ((contentType === "image" || contentType === "video") && mediaUrl) {
        const mediaBody: any = { phone };
        let mediaEndpoint = "";
        if (contentType === "video" && node.data?.isPtv) {
          mediaEndpoint = "/send-ptv";
          mediaBody.ptv = mediaUrl;
        } else if (contentType === "video") {
          mediaEndpoint = "/send-video";
          mediaBody.video = mediaUrl;
        } else {
          mediaEndpoint = "/send-image";
          mediaBody.image = mediaUrl;
        }
        await fetch(`${baseUrl}${mediaEndpoint}`, { method: "POST", headers, body: JSON.stringify(mediaBody) });
        await new Promise(r => setTimeout(r, 1500));
      }

      const replyButtons = allButtons.filter((b: any) => b.type === "reply" || b.type === "flow").slice(0, 3).map((b: any) => ({ label: (b.text || "").trim() || "Botão" }));
      const urlCallParts: string[] = [];
      for (const btn of allButtons) {
        if (btn.type === "url" && btn.value) urlCallParts.push(`🔗 ${(btn.text || "").trim()}: ${btn.value}`);
        else if (btn.type === "call" && btn.value) urlCallParts.push(`📞 ${(btn.text || "").trim()}: ${btn.value}`);
      }
      const fullMessage = (content || "") + (urlCallParts.length > 0 ? "\n\n" + urlCallParts.join("\n") : "");

      if (replyButtons.length > 0) {
        await fetch(`${baseUrl}/send-button-list`, { method: "POST", headers, body: JSON.stringify({ phone, message: fullMessage, buttonList: { buttons: replyButtons } }) });
      } else {
        await fetch(`${baseUrl}/send-text`, { method: "POST", headers, body: JSON.stringify({ phone, message: fullMessage }) });
      }
    } else {
      let endpoint = "";
      const body: any = { phone };
      switch (contentType) {
        case "text": endpoint = "/send-text"; body.message = content; break;
        case "image": endpoint = "/send-image"; body.image = mediaUrl; body.caption = content; break;
        case "video":
          if (node.data?.isPtv) { endpoint = "/send-ptv"; body.ptv = mediaUrl; }
          else { endpoint = "/send-video"; body.video = mediaUrl; body.caption = content; }
          break;
        case "audio": endpoint = "/send-audio"; body.audio = mediaUrl; break;
        case "document": endpoint = "/send-document-url"; body.document = mediaUrl; body.fileName = "documento"; body.caption = content; break;
        default: endpoint = "/send-text"; body.message = content;
      }
      if (endpoint) {
        await fetch(`${baseUrl}${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) });
      }
    }
    await new Promise(r => setTimeout(r, 1500));
    console.log(`✅ igWhatsApp flow: Sent node ${node.id} (${contentType})`);

    // Log
    await supabase.from("message_logs").insert({
      user_id: userId, phone,
      response_sent: content || `[media:${contentType}]`,
      keyword_matched: `__ig_flow_send__:${flowName}`,
      timestamp: new Date().toISOString(),
      instance_id: zapiCreds.zapi_instance_id,
    });
  } catch (e) {
    console.error(`❌ igWhatsApp flow: Error sending node ${node.id}:`, e);
  }

  // Check if node has button-based branching edges
  const hasButtonEdges = buttons.some((_: any, idx: number) => {
    return false; // For IG-triggered flows, we don't handle button branching (no WA reply loop)
  });
  return hasButtonEdges;
};

const executeWhatsAppFlow = async (
  nodeId: string,
  nodes: any[],
  edges: any[],
  phone: string,
  zapiCreds: any,
  visited: Set<string>,
  supabase: any,
  userId: string,
  flowName: string,
) => {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const currentNode = nodes.find((n: any) => n.id === nodeId);
  if (!currentNode) return;

  if (currentNode.type === "blocoConteudo") {
    await sendFlowNodeContent(currentNode, phone, zapiCreds, supabase, userId, flowName);
  }

  // Follow default outgoing edges (not button-specific)
  const isDefaultHandle = (h: string | null | undefined) => {
    if (!h) return true;
    if (h === "default") return true;
    if (h.startsWith("source-") || h.startsWith("target-")) return true;
    if (["right", "bottom", "left", "top", "a", "b"].includes(h)) return true;
    return false;
  };

  const outgoing = edges
    .filter((e: any) => e.source === nodeId && !e.sourceHandle?.startsWith("button-") && isDefaultHandle(e.sourceHandle))
    .sort((a: any, b: any) => {
      const aNode = nodes.find((n: any) => n.id === a.target);
      const bNode = nodes.find((n: any) => n.id === b.target);
      return (aNode?.position?.y ?? 0) - (bNode?.position?.y ?? 0);
    });

  for (const edge of outgoing) {
    await executeWhatsAppFlow(edge.target, nodes, edges, phone, zapiCreds, visited, supabase, userId, flowName);
  }
};

// Helper: execute igWhatsApp node — sends WhatsApp message via Z-API
const executeIgWhatsAppNode = async (
  nodeData: any,
  collectedPhone: string | null,
  userId: string,
  igUserId: string,
  fromUsername: string,
  supabase: any,
) => {
  let phone = collectedPhone;

  // If no phone passed, look up from collected leads
  if (!phone) {
    const { data: leadEvent } = await supabase
      .from("instagram_events")
      .select("comment_text")
      .eq("user_id", userId)
      .eq("event_type", "lead_whatsapp")
      .eq("ig_user_id", igUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    phone = leadEvent?.comment_text || null;
  }

  if (!phone) {
    console.log("⚠️ igWhatsApp: No WhatsApp number available, skipping");
    return;
  }

  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 8) {
    console.log(`⚠️ igWhatsApp: Invalid phone "${phone}", skipping`);
    return;
  }

  // Resolve Z-API credentials
  const wantedInstance = nodeData.instanceId || null;
  let zapiCreds: any = null;

  if (wantedInstance) {
    const { data } = await supabase
      .from("zapi_instances")
      .select("zapi_instance_id, zapi_token, zapi_client_token")
      .or(`id.eq.${wantedInstance},zapi_instance_id.eq.${wantedInstance}`)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    zapiCreds = data;
  }
  if (!zapiCreds) {
    const { data } = await supabase
      .from("zapi_instances")
      .select("zapi_instance_id, zapi_token, zapi_client_token")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    zapiCreds = data;
  }
  if (!zapiCreds) {
    const { data } = await supabase
      .from("zapi_instances")
      .select("zapi_instance_id, zapi_token, zapi_client_token")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    zapiCreds = data;
  }
  if (!zapiCreds) {
    console.log("⚠️ igWhatsApp: No Z-API credentials found");
    return;
  }

  const baseUrl = `https://api.z-api.io/instances/${zapiCreds.zapi_instance_id}/token/${zapiCreds.zapi_token}`;
  const sendType = nodeData.sendType || "text";
  let message = "";
  let mediaUrl = "";
  let mediaType = "";

  if (sendType === "text") {
    message = (nodeData.message || "").replace(/\{\{nome_usuario\}\}/g, fromUsername);
  } else if (sendType === "template" && nodeData.templateId) {
    const { data: tpl } = await supabase
      .from("message_templates")
      .select("*")
      .eq("id", nodeData.templateId)
      .maybeSingle();
    if (tpl) {
      message = (tpl.content || "").replace(/\{\{nome_usuario\}\}/g, fromUsername);
      if (tpl.media_url) {
        mediaUrl = tpl.media_url;
        const t = tpl.type || "";
        mediaType = t === "imagem" ? "image" : t === "video" ? "video" : t === "audio" ? "audio" : t === "documento" ? "document" : "";
      }
    }
  } else if (sendType === "flow" && nodeData.flowId) {
    // Execute the flow nodes directly instead of sending keyword as text
    const { data: flow } = await supabase
      .from("flow_automations")
      .select("id, name, keyword, nodes, edges")
      .eq("id", nodeData.flowId)
      .maybeSingle();
    if (flow?.nodes) {
      console.log(`🔄 igWhatsApp: Executing WA flow "${flow.name}" directly`);
      const flowNodes: any[] = flow.nodes || [];
      const flowEdges: any[] = flow.edges || [];
      const initialNode = flowNodes.find((n: any) => n.type === "blocoInicial");
      if (initialNode) {
        const visited = new Set<string>();
        await executeWhatsAppFlow(initialNode.id, flowNodes, flowEdges, cleanPhone, zapiCreds, visited, supabase, userId, flow.name);
        // Log already handled inside executeWhatsAppFlow
        return;
      } else {
        console.log("⚠️ igWhatsApp: Flow has no initial node");
        return;
      }
    } else {
      console.log("⚠️ igWhatsApp: Flow not found");
      return;
    }
  }

  if (!message && !mediaUrl) {
    console.log("⚠️ igWhatsApp: No content to send, skipping");
    return;
  }

  try {
    let endpoint = "send-text";
    let body: any = { phone: cleanPhone, message };

    if (mediaUrl && mediaType === "image") {
      endpoint = "send-image";
      body = { phone: cleanPhone, image: mediaUrl, caption: message || "" };
    } else if (mediaUrl && mediaType === "video") {
      endpoint = "send-video";
      body = { phone: cleanPhone, video: mediaUrl, caption: message || "" };
    } else if (mediaUrl && mediaType === "audio") {
      endpoint = "send-audio";
      body = { phone: cleanPhone, audio: mediaUrl };
    } else if (mediaUrl) {
      endpoint = "send-document/pdf";
      body = { phone: cleanPhone, document: mediaUrl, fileName: "arquivo" };
    }

    const res = await fetch(`${baseUrl}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": zapiCreds.zapi_client_token },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ igWhatsApp: Sent to ${cleanPhone} via ${endpoint}`);
    } else {
      console.error(`❌ igWhatsApp: Failed:`, JSON.stringify(data));
    }

    await supabase.from("message_logs").insert({
      user_id: userId,
      phone: cleanPhone,
      response_sent: message || `[media:${mediaType}]`,
      keyword_matched: "__ig_whatsapp_send__",
      timestamp: new Date().toISOString(),
      instance_id: zapiCreds.zapi_instance_id,
    });
  } catch (e) {
    console.error(`❌ igWhatsApp: Error:`, e);
  }
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

                          // Wrap URL buttons with click tracker
                          const SUPABASE_URL_BASE = Deno.env.get("SUPABASE_URL")!;
                          const wrapUrl = (originalUrl: string, btnTitle: string) => {
                            const trackBase = `${SUPABASE_URL_BASE}/functions/v1/track-flow-click`;
                            const params = new URLSearchParams({
                              url: originalUrl,
                              flow: auto.name,
                              btn: btnTitle,
                              uid: userId,
                              ph: fromUsername,
                              src: "ig",
                            });
                            return `${trackBase}?${params.toString()}`;
                          };

                          // Build Button Template payload (postback + web_url, max 3)
                          const buildButtonPayload = (text: string, buttons: any[]) => {
                            const templateBtns = buttons.slice(0, 3).map((b: any) => {
                              if (b.type === "reply") {
                                return { type: "postback", title: (b.title || "").slice(0, 20), payload: b.title || "reply" };
                              }
                              const trackedUrl = wrapUrl(b.url, b.title || "Link");
                              return { type: "web_url", title: (b.title || "").slice(0, 20), url: trackedUrl };
                            });
                            if (templateBtns.length > 0) {
                              return { attachment: { type: "template", payload: { template_type: "button", text: text || "Selecione uma opção:", buttons: templateBtns } } };
                            }
                            return text ? { text } : null;
                          };

                          const messagePayload = dmButtons.length > 0
                            ? buildButtonPayload(dmText, dmButtons)
                            : (dmText ? { text: dmText } : null);

                          if (messagePayload) {
                            // Strategy: try direct DM first, if "outside window" → open via Private Reply then send buttons
                            const sendDM = async (recipientId: string, payload: any) => {
                              const res = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                                body: JSON.stringify({ recipient: { id: recipientId }, message: payload }),
                              });
                              return { res, data: await res.json() };
                            };

                            let { res: dmRes, data: dmData } = await sendDM(fromId, messagePayload);

                            if (!dmRes.ok || dmData.error) {
                              const errCode = dmData.error?.error_subcode || dmData.error?.code;
                              const isWindowError = errCode === 2534022 || (dmData.error?.message || "").includes("outside of allowed window");
                              console.error(`❌ DM error (code=${errCode}):`, JSON.stringify(dmData));

                              if (isWindowError && commentId) {
                                // Step 1: Try Private Reply WITH button template
                                const prPayload = dmButtons.length > 0
                                  ? buildButtonPayload(dmText || "Olá! Confira as opções abaixo:", dmButtons)
                                  : { text: dmText };
                                const prRes = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                                  body: JSON.stringify({ recipient: { comment_id: commentId }, message: prPayload }),
                                });
                                const prData = await prRes.json();

                                if (prRes.ok && !prData.error) {
                                  const igsid = prData.recipient_id;
                                  console.log(`✅ Private Reply sent (with template) → IGSID: ${igsid}`);
                                  dmData = prData;
                                } else {
                                  console.warn("⚠️ Private Reply with template failed, trying text-only:", JSON.stringify(prData));
                                  // Step 2: Fallback → text-only Private Reply, then send buttons via IGSID
                                  const textPrRes = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                                    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: dmText || "Olá!" } }),
                                  });
                                  const textPrData = await textPrRes.json();

                                  if (textPrRes.ok && !textPrData.error) {
                                    const igsid = textPrData.recipient_id;
                                    console.log(`✅ Text Private Reply sent → IGSID: ${igsid}`);
                                    if (dmButtons.length > 0 && igsid) {
                                      await new Promise(r => setTimeout(r, 1000));
                                      const btnPayload = buildButtonPayload("", dmButtons);
                                      if (btnPayload) {
                                        const { res: btnRes, data: btnData } = await sendDM(igsid, btnPayload);
                                        if (btnRes.ok && !btnData.error) {
                                          console.log(`✅ Buttons sent to @${fromUsername} via IGSID ${igsid}`);
                                          dmData = btnData;
                                        } else {
                                          console.error("❌ Button send error:", JSON.stringify(btnData));
                                        }
                                      }
                                    }
                                  } else {
                                    console.error("❌ Text Private Reply also failed:", JSON.stringify(textPrData));
                                  }
                                }
                              }
                            } else {
                              console.log(`✅ DM sent to @${fromUsername}${dmButtons.length > 0 ? ` (${dmButtons.length} btn)` : ""}`);
                            }

                            await supabase.from("instagram_events").insert({
                              user_id: userId, event_type: "dm_sent", ig_user_id: fromId,
                              username: fromUsername, media_id: mediaId, comment_text: dmText,
                              payload: dmData, processed: true,
                            });

                            // Log flow send for metrics tracking
                            await supabase.from("message_logs").insert({
                              user_id: userId,
                              phone: fromUsername,
                              message_received: `[IG DM] ${dmText.slice(0, 100)}`,
                              keyword_matched: `__ig_flow_send__:${auto.name}`,
                              response_sent: `[IG-Fluxo: ${auto.name}]`,
                              timestamp: new Date().toISOString(),
                            });
                            console.log(`📊 IG flow send logged for "${auto.name}" → @${fromUsername}`);
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

                      if (node.type === "igWhatsApp") {
                        await executeIgWhatsAppNode(d, null, userId, fromId, fromUsername, supabase);
                      }

                      // Traverse children — if DM has buttons or collection, STOP (don't follow those paths)
                      // Button paths (btn-0, btn-1...) are only followed when user clicks a button
                      // Collection paths (collect-whatsapp, collect-email) are only followed when user responds
                      const allButtons = (node.data?.buttons || []);
                      const hasButtons = node.type === "igDM" && allButtons.length > 0;
                      const hasCollection = node.type === "igDM" && (node.data?.collectWhatsapp || node.data?.collectEmail);
                      if (hasButtons || hasCollection) {
                        // Only follow the default bottom handle, not button/collection-specific handles
                        const defaultChildren = getOutgoing(node.id, "source-bottom");
                        for (const child of defaultChildren) {
                          await executeNode(child);
                        }
                        if (hasButtons) console.log(`⏹ DM node "${node.data?.label}" has ${allButtons.length} buttons — waiting for user response to branch`);
                        if (hasCollection) console.log(`⏹ DM node "${node.data?.label}" collecting data — waiting for user response`);
                      } else {
                        // For non-button/non-collection nodes, exclude special handles
                        const children = flowEdges
                          .filter((e: any) => {
                            if (e.source !== node.id) return false;
                            const h = e.sourceHandle || "";
                            return !h.startsWith("btn-") && !h.startsWith("collect-");
                          })
                          .map((e: any) => flowNodes.find((n: any) => n.id === e.target))
                          .filter(Boolean);
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

                        const buildBtnPayload = (text: string, buttons: any[]) => {
                          const templateBtns = buttons.slice(0, 3).map((b: any) => {
                            if (b.type === "reply") return { type: "postback", title: (b.title || "").slice(0, 20), payload: b.title || "reply" };
                            return { type: "web_url", title: (b.title || "").slice(0, 20), url: b.url };
                          });
                          if (templateBtns.length > 0) return { attachment: { type: "template", payload: { template_type: "button", text: text || "Selecione:", buttons: templateBtns } } };
                          return text ? { text } : null;
                        };

                        const messagePayload = dmButtons.length > 0 ? buildBtnPayload(dmText, dmButtons) : (dmText ? { text: dmText } : null);

                        if (messagePayload) {
                          const dmRes = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                            body: JSON.stringify({ recipient: { id: fromId }, message: messagePayload }),
                          });
                          const dmData = await dmRes.json();
                          if (dmRes.ok && !dmData.error) {
                            console.log(`✅ DM sent to @${fromUsername}`);
                          } else {
                            const isWindowErr = (dmData.error?.error_subcode === 2534022) || (dmData.error?.message || "").includes("outside of allowed window");
                            console.error("❌ DM error:", JSON.stringify(dmData));
                            if (isWindowErr && commentId) {
                              // Try Private Reply WITH button template first
                              const prPayload = dmButtons.length > 0
                                ? buildBtnPayload(dmText || "Olá! Confira as opções abaixo:", dmButtons)
                                : { text: dmText };
                              const prRes = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                                body: JSON.stringify({ recipient: { comment_id: commentId }, message: prPayload }),
                              });
                              const prData = await prRes.json();
                              if (prRes.ok && !prData.error) {
                                const igsid = prData.recipient_id;
                                console.log(`✅ Private Reply sent (with template) → IGSID: ${igsid}`);
                              } else {
                                console.warn("⚠️ Template PR failed, trying text-only:", JSON.stringify(prData));
                                const textPrRes = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                                  body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: dmText || "Olá!" } }),
                                });
                                const textPrData = await textPrRes.json();
                                if (textPrRes.ok && !textPrData.error) {
                                  const igsid = textPrData.recipient_id;
                                  console.log(`✅ Text PR sent → IGSID: ${igsid}`);
                                  if (dmButtons.length > 0 && igsid) {
                                    await new Promise(r => setTimeout(r, 1000));
                                    const btnPayload = buildBtnPayload("", dmButtons);
                                    if (btnPayload) {
                                      const btnRes = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                                        body: JSON.stringify({ recipient: { id: igsid }, message: btnPayload }),
                                      });
                                      const btnData = await btnRes.json();
                                      if (btnRes.ok && !btnData.error) console.log(`✅ Buttons sent via IGSID ${igsid}`);
                                      else console.error("❌ Button send error:", JSON.stringify(btnData));
                                    }
                                  }
                                } else console.error("❌ Text PR also failed:", JSON.stringify(textPrData));
                              }
                            }
                          }
                        }
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

                      const wrapUrl = buildWrapUrl(auto.name, userId, event.sender?.username || senderId);
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
                            const templateBtns = dmButtons.slice(0, 3).map((b: any) => {
                              if (b.type === "reply") return { type: "postback", title: (b.title || "").slice(0, 20), payload: b.title || "reply" };
                              const trackedUrl = wrapUrl(b.url, b.title || "Link");
                              return { type: "web_url", title: (b.title || "").slice(0, 20), url: trackedUrl };
                            });
                            messagePayload = { attachment: { type: "template", payload: { template_type: "button", text: dmText || "Selecione:", buttons: templateBtns } } };
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

                        if (n.type === "igWhatsApp") {
                          await executeIgWhatsAppNode(d, null, userId, senderId, event.sender?.username || "", supabase);
                        }

                        // Continue traversal (stop at button/collection nodes)
                        const btnCount = (n.data?.buttons || []).filter((b: any) => b.title).length;
                        const hasCol = n.type === "igDM" && (n.data?.collectWhatsapp || n.data?.collectEmail);
                        if (n.type === "igDM" && (btnCount > 0 || hasCol)) {
                          const defaultEdges = fEdges.filter((e: any) => e.source === n.id && e.sourceHandle === "source-bottom");
                          for (const e of defaultEdges) {
                            const next = fNodes.find((fn: any) => fn.id === e.target);
                            if (next) await executeNode(next);
                          }
                        } else {
                          const nextEdges = fEdges.filter((e: any) => {
                            if (e.source !== n.id) return false;
                            const h = e.sourceHandle || "";
                            return !h.startsWith("btn-") && !h.startsWith("collect-");
                          });
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

              // Handle Quick Reply taps (Instagram sends these as message events with quick_reply)
              if (event.message?.quick_reply && senderId && accessToken) {
                const payload = event.message.quick_reply.payload || "";
                const title = event.message.text || payload;
                console.log(`🔘 Quick Reply from ${senderId}: "${title}" (payload: ${payload})`);

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

                    for (const node of fNodes) {
                      if (node.type !== "igDM") continue;
                      const buttons = (node.data?.buttons || []);
                      const btnIndex = buttons.findIndex((b: any) =>
                        b.title === title || b.title === payload
                      );
                      if (btnIndex === -1) continue;

                      console.log(`✅ Quick Reply matched button "${title}" at index ${btnIndex} in node ${node.id}`);

                      const handleId = `btn-${btnIndex}`;
                      const branchEdges = fEdges.filter((e: any) => e.source === node.id && e.sourceHandle === handleId);

                      const replaceVars = (txt: string) =>
                        txt.replace(/\{\{nome_usuario\}\}/g, event.sender?.username || "")
                           .replace(/\{\{comentario\}\}/g, title);

                      const wrapUrl = buildWrapUrl(auto.name, userId, event.sender?.username || senderId);
                      const visited = new Set<string>();
                      const executeNode = async (n: any) => {
                        if (visited.has(n.id)) return;
                        visited.add(n.id);
                        const d = n.data || {};

                        if (n.type === "igDM" && accessToken) {
                          const dmText = replaceVars(d.message || "");
                          const dmBtns = (d.buttons || []).filter((b: any) => b.title && (b.url || b.type === "reply"));
                          let mp: any;
                          if (dmBtns.length > 0) {
                            const templateBtns = dmBtns.slice(0, 3).map((b: any) => {
                              if (b.type === "reply") return { type: "postback", title: (b.title || "").slice(0, 20), payload: b.title || "reply" };
                              const trackedUrl = wrapUrl(b.url, b.title || "Link");
                              return { type: "web_url", title: (b.title || "").slice(0, 20), url: trackedUrl };
                            });
                            mp = { attachment: { type: "template", payload: { template_type: "button", text: dmText || "Selecione:", buttons: templateBtns } } };
                          } else if (dmText) {
                            mp = { text: dmText };
                          }
                          if (mp) {
                            const res = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                              body: JSON.stringify({ recipient: { id: senderId }, message: mp }),
                            });
                            const rd = await res.json();
                            if (res.ok && !rd.error) console.log(`✅ QR Branch DM sent to ${senderId}`);
                            else console.error("❌ QR Branch DM error:", JSON.stringify(rd));
                          }
                        }

                        if (n.type === "igDelay") {
                          const ms = (parseInt(d.delayValue) || 0) * (d.delayUnit === "hours" ? 3600000 : d.delayUnit === "minutes" ? 60000 : 1000);
                          if (ms > 0 && ms <= 30000) await new Promise(r => setTimeout(r, ms));
                        }

                        if (n.type === "igWhatsApp") {
                          await executeIgWhatsAppNode(d, null, userId, senderId, event.sender?.username || "", supabase);
                        }

                        const btnCount2 = (n.data?.buttons || []).filter((b: any) => b.title).length;
                        const hasCol2 = n.type === "igDM" && (n.data?.collectWhatsapp || n.data?.collectEmail);
                        if (n.type === "igDM" && (btnCount2 > 0 || hasCol2)) {
                          const defEdges = fEdges.filter((e: any) => e.source === n.id && e.sourceHandle === "source-bottom");
                          for (const e of defEdges) { const next = fNodes.find((fn: any) => fn.id === e.target); if (next) await executeNode(next); }
                        } else {
                          const nextEdges = fEdges.filter((e: any) => e.source === n.id && !(e.sourceHandle || "").startsWith("btn-") && !(e.sourceHandle || "").startsWith("collect-"));
                          for (const e of nextEdges) { const next = fNodes.find((fn: any) => fn.id === e.target); if (next) await executeNode(next); }
                        }
                      };

                      for (const edge of branchEdges) {
                        const target = fNodes.find((fn: any) => fn.id === edge.target);
                        if (target) await executeNode(target);
                      }
                      break;
                    }
                  } catch { /* not flow JSON */ }
                }
              } else if (event.message && !event.message.quick_reply && !event.message.is_echo) {
                const dmText = event.message.text || "";
                console.log(`📨 DM from ${senderId}: ${dmText || "(media)"}`);

                // Check if this is a WhatsApp/Email collection response
                if (dmText && senderId && accessToken) {
                  const isPhone = /\d{8,15}/.test(dmText.replace(/\D/g, ""));
                  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dmText.trim());

                  if (isPhone || isEmail) {
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

                        // Find DM nodes that collect WhatsApp or Email
                        for (const node of fNodes) {
                          if (node.type !== "igDM") continue;
                          const collectsWa = node.data?.collectWhatsapp && isPhone;
                          const collectsEm = node.data?.collectEmail && isEmail;
                          if (!collectsWa && !collectsEm) continue;

                          const handleId = collectsWa ? "collect-whatsapp" : "collect-email";
                          console.log(`📱 Collection match: ${handleId} in node ${node.id} with value "${dmText}"`);

                          // Send follow-up message if configured
                          const followUp = collectsWa ? node.data?.whatsappFollowUp : node.data?.emailFollowUp;
                          if (followUp) {
                            await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                              body: JSON.stringify({ recipient: { id: senderId }, message: { text: followUp } }),
                            });
                            console.log(`✅ Follow-up sent for ${handleId}`);
                          }

                          // Save collected lead to instagram_events
                          await supabase.from("instagram_events").insert({
                            user_id: userId,
                            event_type: collectsWa ? "lead_whatsapp" : "lead_email",
                            ig_user_id: senderId,
                            username: event.sender?.username || "",
                            comment_text: dmText.trim(),
                            payload: {
                              automation_id: auto.id,
                              automation_name: auto.name,
                              collected_value: dmText.trim(),
                              collected_type: collectsWa ? "whatsapp" : "email",
                            },
                            processed: true,
                          });
                          console.log(`💾 Lead saved: ${collectsWa ? "whatsapp" : "email"} = ${dmText.trim()}`);
                          
                          // Follow the collection handle edges
                          const branchEdges = fEdges.filter((e: any) => e.source === node.id && e.sourceHandle === handleId);

                          const replaceVars = (txt: string) =>
                            txt.replace(/\{\{nome_usuario\}\}/g, event.sender?.username || "")
                               .replace(/\{\{comentario\}\}/g, dmText);

                          const wrapUrl = buildWrapUrl(auto.name, userId, event.sender?.username || senderId);
                          const visited = new Set<string>();
                          const executeNode = async (n: any) => {
                            if (visited.has(n.id)) return;
                            visited.add(n.id);
                            const d = n.data || {};

                            if (n.type === "igDM" && accessToken) {
                              const msg = replaceVars(d.message || "");
                              const btns = (d.buttons || []).filter((b: any) => b.title && (b.url || b.type === "reply"));
                              let mp: any;
                              if (btns.length > 0) {
                                const templateBtns = btns.slice(0, 3).map((b: any) => {
                                  if (b.type === "reply") return { type: "postback", title: (b.title || "").slice(0, 20), payload: b.title || "reply" };
                                  const trackedUrl = wrapUrl(b.url, b.title || "Link");
                                  return { type: "web_url", title: (b.title || "").slice(0, 20), url: trackedUrl };
                                });
                                mp = { attachment: { type: "template", payload: { template_type: "button", text: msg || "Selecione:", buttons: templateBtns } } };
                              } else if (msg) {
                                mp = { text: msg };
                              }
                              if (mp) {
                                const res = await fetch(`https://graph.instagram.com/v21.0/${igPageId}/messages`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
                                  body: JSON.stringify({ recipient: { id: senderId }, message: mp }),
                                });
                                const rd = await res.json();
                                if (res.ok && !rd.error) console.log(`✅ Collection branch DM sent to ${senderId}`);
                                else console.error("❌ Collection branch DM error:", JSON.stringify(rd));
                              }
                            }

                            if (n.type === "igDelay") {
                              const ms = (parseInt(d.delayValue) || 0) * (d.delayUnit === "hours" ? 3600000 : d.delayUnit === "minutes" ? 60000 : 1000);
                              if (ms > 0 && ms <= 30000) await new Promise(r => setTimeout(r, ms));
                            }

                            if (n.type === "igWhatsApp") {
                              const collectedPhone = isPhone ? dmText.trim() : null;
                              await executeIgWhatsAppNode(d, collectedPhone, userId, senderId, event.sender?.username || "", supabase);
                            }

                            const btnC = (n.data?.buttons || []).filter((b: any) => b.title).length;
                            const hasC = n.type === "igDM" && (n.data?.collectWhatsapp || n.data?.collectEmail);
                            if (n.type === "igDM" && (btnC > 0 || hasC)) {
                              const defE = fEdges.filter((e: any) => e.source === n.id && e.sourceHandle === "source-bottom");
                              for (const e of defE) { const next = fNodes.find((fn: any) => fn.id === e.target); if (next) await executeNode(next); }
                            } else {
                              const nxtE = fEdges.filter((e: any) => e.source === n.id && !(e.sourceHandle || "").startsWith("btn-") && !(e.sourceHandle || "").startsWith("collect-"));
                              for (const e of nxtE) { const next = fNodes.find((fn: any) => fn.id === e.target); if (next) await executeNode(next); }
                            }
                          };

                          for (const edge of branchEdges) {
                            const target = fNodes.find((fn: any) => fn.id === edge.target);
                            if (target) await executeNode(target);
                          }
                          break;
                        }
                      } catch { /* not flow */ }
                    }
                  }
                }
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
