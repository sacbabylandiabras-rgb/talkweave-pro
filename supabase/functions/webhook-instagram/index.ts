import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = "zaplynx_ig_verify_2024";
const IG_APP_ID_DEFAULT = '1629147191696096';

const META_API_VERSION = "v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const replaceVars = (txt: string, vars: Record<string, string>) => {
  let result = txt || "";
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp("\\\\{\\\\{" + key + "\\\\}\\\\}", "g");
    result = result.replace(regex, value || "");
  }
  if (vars.username) result = result.replace(/\{\{nome_usuario\}\}/g, vars.username);
  if (vars.text) result = result.replace(/\{\{comentario\}\}/g, vars.text);
  return result;
};

const buildWrapUrl = (autoName: string, userId: string, fromUsername: string) => {
  return (originalUrl: string, btnTitle: string) => {
    const trackBase = "https://go.zaplynxpro.online/r";
    const params = new URLSearchParams({
      url: originalUrl,
      flow: autoName,
      btn: btnTitle,
      uid: userId,
      ph: fromUsername,
      src: "ig",
    });
    return trackBase + "?" + params.toString();
  };
};

const triggerOfficialWhatsAppFlow = async (
  flowId: string,
  phone: string,
  instanceId: string,
  fromUsername: string,
) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const selfUrl = supabaseUrl + "/functions/v1/webhook-zapi";
  const response = await fetch(selfUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      instanceId,
      senderName: fromUsername,
      flowId,
      __manual_flow_trigger__: true,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error("WhatsApp flow trigger failed: " + text);
  }
};

const executeIgWhatsAppNode = async (
  nodeData: any,
  collectedPhone: string | null,
  userId: string,
  igUserId: string,
  fromUsername: string,
  supabase: any,
) => {
  let phone = collectedPhone;
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
  if (!phone) return;
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 8) return;

  const wantedInstance = nodeData.instanceId || null;
  let zapiCreds: any = null;
  if (wantedInstance) {
    const { data } = await supabase.from("zapi_instances").select("*").or("id.eq." + wantedInstance + ",zapi_instance_id.eq." + wantedInstance).eq("user_id", userId).eq("is_active", true).maybeSingle();
    zapiCreds = data;
  }
  if (!zapiCreds) {
    const { data } = await supabase.from("zapi_instances").select("*").eq("user_id", userId).eq("is_default", true).maybeSingle();
    zapiCreds = data;
  }
  if (!zapiCreds) return;

  const baseUrl = "https://api.z-api.io/instances/" + zapiCreds.zapi_instance_id + "/token/" + zapiCreds.zapi_token;
  const sendType = nodeData.sendType || "text";
  
  if (sendType === "flow" && nodeData.flowId) {
    await triggerOfficialWhatsAppFlow(nodeData.flowId, cleanPhone, zapiCreds.zapi_instance_id, fromUsername);
    return;
  }

  const message = replaceVars(nodeData.message || "", { username: fromUsername });
  await fetch(baseUrl + "/send-text", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": zapiCreds.zapi_client_token },
    body: JSON.stringify({ phone: cleanPhone, message }),
  });
};

const fetchInstagramUserProfile = async (igUserId: string, accessToken: string) => {
  try {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${igUserId}?fields=profile_pic,username,name&access_token=${accessToken}`;
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
    const errorText = await res.text();
    console.error(`[webhook-instagram] Error response from Meta API for user ${igUserId}:`, errorText);
  } catch (e) {
    console.error(`[webhook-instagram] Error fetching IG user profile for ${igUserId}:`, e);
  }
  return null;
};

 const logInstagramEvent = async (supabase: any, params: {
   userId: string;
   eventType: string;
   igUserId: string;
   username: string;
   text: string;
   payload?: any;
   accessToken?: string;
 }) => {
   try {
     await supabase.from("instagram_events").insert({
       user_id: params.userId,
       event_type: params.eventType,
       ig_user_id: params.igUserId,
       username: params.username,
       comment_text: params.text,
       payload: params.payload || {},
     });
     
      let profilePicUrl = params.payload?.sender?.profile_pic || 
                         params.payload?.message?.reply_to?.story?.url || 
                         null;

      let resolvedUsername = params.username;

      // Always fetch profile from Meta API if we have access token, to ensure we have the most up-to-date data
      // (Meta often doesn't send profile_pic in the webhook payload)
      if (params.accessToken && params.igUserId) {
        console.log(`[webhook-instagram] Fetching full profile from Meta API for user ${params.igUserId}`);
        const profile = await fetchInstagramUserProfile(params.igUserId, params.accessToken);
        if (profile) {
          if (profile.profile_pic) profilePicUrl = profile.profile_pic;
          if (profile.username) resolvedUsername = profile.username;
        }
      }

      // Update event with resolved username if needed
      if (resolvedUsername && resolvedUsername !== params.username) {
        await supabase.from("instagram_events")
          .update({ username: resolvedUsername })
          .match({ user_id: params.userId, ig_user_id: params.igUserId, username: params.username });
      }

      // Update or insert contact
      const contactData: any = {
        user_id: params.userId,
        ig_user_id: params.igUserId,
        username: resolvedUsername || params.igUserId,
        source: params.eventType,
        updated_at: new Date().toISOString()
      };

      if (profilePicUrl) {
        contactData.profile_pic_url = profilePicUrl;
      }

      await supabase.from("instagram_contacts").upsert(contactData, { onConflict: 'user_id,ig_user_id' });
   } catch (e) {
     console.error("Error logging instagram event:", e);
   }
 };
 
const executeFlow = async (params: {
  auto: any;
  nodes: any[];
  edges: any[];
  startNodeId?: string;
  context: {
    userId: string;
    igPageId: string;
    senderId: string;
    senderUsername: string;
    accessToken: string;
    commentId?: string;
    inputText?: string;
    triggerType: "comment" | "dm" | "story_reply" | "follow";
  };
  supabase: any;
}) => {
  const { auto, nodes, edges, startNodeId, context, supabase } = params;
  const visited = new Set<string>();
  const wrapUrl = buildWrapUrl(auto.name, context.userId, context.senderUsername);

  const getOutgoing = (nodeId: string, handleFilter?: string) =>
    edges
      .filter((e: any) => {
        if (e.source !== nodeId) return false;
        if (handleFilter !== undefined) return e.sourceHandle === handleFilter;
        return true;
      })
      .map((e: any) => nodes.find((n: any) => n.id === e.target))
      .filter(Boolean);

  const runNode = async (node: any) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const d = node.data || {};

    if (node.type === "igResposta" && d.message && context.commentId && context.accessToken) {
      try {
        const replyText = replaceVars(d.message, { username: context.senderUsername, text: context.inputText || "" });
        await fetch("https://graph.facebook.com/" + META_API_VERSION + "/" + context.commentId + "/replies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: replyText, access_token: context.accessToken }),
        });
      } catch (e) { console.error("Flow reply failed:", e); }
    }

    if (node.type === "igDM" && context.senderId && context.accessToken) {
      try {
        const dmText = replaceVars(d.message || "", { username: context.senderUsername, text: context.inputText || "" });
        const dmButtons = (d.buttons || []).filter((b: any) => b.title && (b.url || b.type === "reply"));

        const buildButtonPayload = (text: string, buttons: any[]) => {
          const templateBtns = buttons.slice(0, 3).map((b: any) => {
            if (b.type === "reply") return { type: "postback", title: b.title.slice(0, 20), payload: b.title };
            return { type: "web_url", title: b.title.slice(0, 20), url: wrapUrl(b.url, b.title) };
          });
          if (templateBtns.length > 0) {
            return { attachment: { type: "template", payload: { template_type: "button", text: text || "Escolha uma opção:", buttons: templateBtns } } };
          }
          return text ? { text } : null;
        };

        const payload = dmButtons.length > 0 ? buildButtonPayload(dmText, dmButtons) : (dmText ? { text: dmText } : null);

         if (payload) {
            const autoDmUrl = `https://graph.facebook.com/${META_API_VERSION}/${context.igPageId}/messages?access_token=${context.accessToken}`;
            await fetch(autoDmUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ recipient: { id: context.senderId }, message: payload }),
            });
           
           // Log automation outgoing message
           await logInstagramEvent(supabase, {
             userId: context.userId,
             eventType: "dm_sent",
             igUserId: context.senderId,
             username: context.senderUsername,
             text: dmText,
             payload: { automation_id: auto.id, type: "automation" }
           });
         }
      } catch (e) { console.error("Flow DM failed:", e); }
    }

    if (node.type === "igDelay") {
      const val = parseInt(d.delayValue) || 0;
      const unit = d.delayUnit || "seconds";
      const ms = val * (unit === "hours" ? 3600000 : unit === "minutes" ? 60000 : 1000);
      if (ms > 0 && ms <= 30000) await new Promise(r => setTimeout(r, ms));
    }

    if (node.type === "igWhatsApp") {
      await executeIgWhatsAppNode(d, null, context.userId, context.senderId, context.senderUsername, supabase);
    }

    // Traversal
    const buttons = (node.data?.buttons || []).filter((b: any) => b.title);
    if (node.type === "igDM" && (buttons.length > 0 || node.data?.collectWhatsapp || node.data?.collectEmail)) {
        const bottomChildren = getOutgoing(node.id, "source-bottom");
        for (const child of bottomChildren) await runNode(child);
        return;
    }

    const children = edges.filter((e: any) => e.source === node.id && !(e.sourceHandle || "").startsWith("btn-") && !(e.sourceHandle || "").startsWith("collect-"))
      .map((e: any) => nodes.find((n: any) => n.id === e.target)).filter(Boolean);
    for (const child of children) await runNode(child);
  };

  if (startNodeId) {
    const startNode = nodes.find(n => n.id === startNodeId);
    if (startNode) await runNode(startNode);
  } else {
    const triggers = nodes.filter(n => n.type === "igGatilho" && (n.data?.triggerType === context.triggerType || (!n.data?.triggerType && context.triggerType === "comment")));
    for (const t of triggers) {
      const children = getOutgoing(t.id);
      for (const c of children) await runNode(c);
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      console.log(`[webhook-instagram] POST Action: ${body.action || "webhook event"}`);

          const currentAppId = body.appId || IG_APP_ID_DEFAULT;
      if (body.action === "send_manual_message") {
          const { recipientId, message, userId } = body;
          const { data: cred } = await supabase.from("meta_credentials").select("*").eq("user_id", userId).eq("app_id", currentAppId).eq("connected", true).maybeSingle();
          
          if (!cred) return new Response(JSON.stringify({ error: "Credenciais não encontradas" }), { status: 404, headers: corsHeaders });
          const cleanAccessToken = cred.access_token.replace(/^["']|["']$/g, "").trim();
          const igPageId = cred.fb_user_id;

          const url = `https://graph.facebook.com/${META_API_VERSION}/${igPageId}/messages`;
          console.log(`[webhook-instagram] Sending to ${recipientId} via ${igPageId}`);
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message }, access_token: cleanAccessToken }),
          });

          const data = await res.json();
          console.log(`[webhook-instagram] Meta API status: ${res.status}`);
          if (!res.ok) {
            console.error(`[webhook-instagram] Meta API error: ${JSON.stringify(data)}`);
            throw new Error(data?.error?.message || "Erro na Meta API");
          }

          await logInstagramEvent(supabase, {
            userId,
            eventType: "dm_sent",
            igUserId: recipientId,
            username: recipientId,
            text: message,
            payload: { manual: true, ...data }
          });

          return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: corsHeaders });
      }

      if (body.action === "save_ig_token") {
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      if (body.action === "test_follow_flow") {
          const { data: cred } = await supabase.from("meta_credentials").select("*").eq("user_id", body.user_id).eq("app_id", currentAppId).maybeSingle();
          if (!cred) return new Response("No cred", { status: 404 });
          const { data: automations } = await supabase.from("instagram_automations").select("*").eq("user_id", body.user_id).eq("active", true);
          for (const auto of (automations || [])) {
              try {
                  const p = JSON.parse(auto.dm_message || "");
                  if (p.__flow__) await executeFlow({ auto, nodes: p.nodes, edges: p.edges, context: { userId: body.user_id, igPageId: cred.fb_user_id, senderId: body.ig_user_id, senderUsername: body.username || "Test", accessToken: cred.access_token, triggerType: "follow" }, supabase });
              } catch {}
          }
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      if (body.object === "instagram" && body.entry) {
        for (const entry of body.entry) {
          const igPageId = String(entry.id);
          const { data: cred } = await supabase.from("meta_credentials").select("*").eq("fb_user_id", igPageId).eq("connected", true).maybeSingle();
          if (!cred) continue;
          const cleanAccessToken = cred.access_token.replace(/^["']|["']$/g, "").trim();

          if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
               if (change.field === "messages") {
                  const messageData = change.value;
                  if (messageData && messageData.message) {
                     const senderId = messageData.from?.id || messageData.sender?.id;
                     const senderUsername = messageData.from?.username || messageData.sender?.username || senderId;
                     const text = messageData.message?.text || "";
                     
                      if (senderId && senderId !== igPageId) {
                        console.log(`[webhook-instagram] Processing message from changes field for user ${senderUsername}`);
                        await logInstagramEvent(supabase, {
                          userId: cred.user_id,
                          eventType: "dm",
                          igUserId: senderId,
                          username: senderUsername,
                          text: text,
                          payload: change.value,
                          accessToken: cleanAccessToken
                        });
                      }
                  }
               }
               if (change.field === "comments") {
                 const comment = change.value;
                 await logInstagramEvent(supabase, {
                   userId: cred.user_id,
                   eventType: "comment",
                   igUserId: comment.from.id,
                   username: comment.from.username,
                   text: comment.text,
                   payload: comment,
                   accessToken: cleanAccessToken
                 });
 
                const { data: automations } = await supabase.from("instagram_automations").select("*").eq("user_id", cred.user_id).eq("active", true);
                for (const auto of (automations || [])) {
                    try {
                        const p = JSON.parse(auto.dm_message || "");
                        if (p.__flow__) await executeFlow({ auto, nodes: p.nodes, edges: p.edges, context: { userId: cred.user_id, igPageId, senderId: comment.from.id, senderUsername: comment.from.username, accessToken: cleanAccessToken, commentId: comment.id, inputText: comment.text, triggerType: "comment" }, supabase });
                    } catch {}
                }
              }
               if (change.field === "follow" || change.field === "follows") {
                   const fromId = change.value.from?.id || change.value.id;
                   const fromUsername = change.value.from?.username || change.value.username;
                   await logInstagramEvent(supabase, {
                     userId: cred.user_id,
                     eventType: "follow",
                     igUserId: fromId,
                     username: fromUsername,
                     text: "Seguiu o perfil",
                     payload: change.value,
                     accessToken: cleanAccessToken
                   });
 
                  const { data: automations } = await supabase.from("instagram_automations").select("*").eq("user_id", cred.user_id).eq("active", true);
                  for (const auto of (automations || [])) {
                      try {
                          const p = JSON.parse(auto.dm_message || "");
                          if (p.__flow__) await executeFlow({ auto, nodes: p.nodes, edges: p.edges, context: { userId: cred.user_id, igPageId, senderId: fromId, senderUsername: fromUsername, accessToken: cleanAccessToken, triggerType: "follow" }, supabase });
                      } catch {}
                  }
              }
            }
          }

            // Handle DMs and Story Replies (messaging array)
            if (entry.messaging && Array.isArray(entry.messaging)) {
              for (const event of entry.messaging) {
                try {
                  const senderId = event.sender?.id;
                  if (!senderId) continue;

                  const senderUsername = event.sender?.username || senderId;
                  const dmText = event.message?.text || "";
                  const isStory = !!(event.message?.reply_to?.story || event.message?.story);
                  
                  // Only log if it's a message event (has message, postback, etc.)
                  if (event.message || event.postback) {
                    let eventType = isStory ? "story_reply" : "dm";
                    let targetIgId = senderId;
                    let targetUsername = senderUsername;

                    // If the sender is the Page itself, it's an outgoing message (echo)
                    if (senderId === igPageId) {
                      eventType = "dm_sent";
                      targetIgId = event.recipient?.id || event.recipient?.[0]?.id;
                      
                      if (!targetIgId) {
                        console.log("[webhook-instagram] Skipping outgoing event without recipient ID");
                        continue;
                      }

                      // For echoes, we don't always have the recipient's username in the payload
                      // We'll try to get it from the database or just use the ID
                      const { data: contact } = await supabase
                        .from("instagram_contacts")
                        .select("username")
                        .eq("user_id", cred.user_id)
                        .eq("ig_user_id", targetIgId)
                        .maybeSingle();
                      targetUsername = contact?.username;
                      
                      // If username is not in DB, it might be the first interaction or an echo
                      // Fetch it from Meta to avoid showing numerical ID
                      if (!targetUsername || targetUsername === targetIgId) {
                        console.log(`[webhook-instagram] Fetching username for echo recipient ${targetIgId}`);
                        const profile = await fetchInstagramUserProfile(targetIgId, cleanAccessToken);
                        if (profile?.username) {
                          targetUsername = profile.username;
                        } else {
                          targetUsername = targetIgId;
                        }
                      }
                    }

                    if (!targetIgId) {
                      console.log("[webhook-instagram] Skipping event without target ID");
                      continue;
                    }

                    console.log(`[webhook-instagram] Processing ${eventType} from ${senderUsername} (${senderId})`);

                    await logInstagramEvent(supabase, {
                      userId: cred.user_id,
                      eventType,
                      igUserId: targetIgId,
                      username: targetUsername,
                      text: dmText,
                      payload: event,
                      accessToken: cleanAccessToken
                    });

                    // Run automations only for incoming messages (not echoes)
                    if (eventType !== "dm_sent") {
                      const { data: automations } = await supabase.from("instagram_automations").select("*").eq("user_id", cred.user_id).eq("active", true);
                      for (const auto of (automations || [])) {
                          try {
                              const p = JSON.parse(auto.dm_message || "");
                              if (p.__flow__) {
                                  await executeFlow({ 
                                    auto, 
                                    nodes: p.nodes, 
                                    edges: p.edges, 
                                    context: { 
                                      userId: cred.user_id, 
                                      igPageId, 
                                      senderId, 
                                      senderUsername, 
                                      accessToken: cleanAccessToken, 
                                      inputText: dmText || event.postback?.payload || "", 
                                      triggerType: isStory ? "story_reply" : "dm" 
                                    }, 
                                    supabase 
                                  });
                              }
                          } catch (err) {
                              console.error("[webhook-instagram] Error in automation execution:", err);
                          }
                      }
                    }
                  } else {
                    console.log("[webhook-instagram] Skipping non-message event:", Object.keys(event).join(", "));
                  }
                } catch (err) {
                  console.error("[webhook-instagram] Error processing messaging event:", err);
                }
              }
            }
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    } catch (err) {
      console.error("[webhook-instagram] Global error:", err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
  return new Response("Not allowed", { status: 405 });
});
