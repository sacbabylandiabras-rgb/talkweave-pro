import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FlowNode {
  id: string;
  type: string;
  data: {
    content?: string;
    contentType?: string;
    mediaUrl?: string;
    buttons?: Array<{ text: string; type: string; value: string }>;
    collectName?: boolean;
    collectWhatsapp?: boolean;
    collectEmail?: boolean;
    [key: string]: any;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

const FLOW_CAPTURE_PREFIX = "__flow_capture__:";
const FLOW_BUTTON_PREFIX = "__flow_button__:";

function normalizeForMatch(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isKeywordMatch(message: string, keyword: string): boolean {
  if (!keyword || !message) return false;
  const normalizedKeyword = normalizeForMatch(keyword);
  const normalizedMessage = normalizeForMatch(message);
  
  // Strict check for slash commands
  if (keyword.startsWith("/")) {
    return normalizedMessage === normalizedKeyword;
  }
  
  return normalizedMessage.includes(normalizedKeyword);
}

async function hashValue(value: string): Promise<string> {
  if (!value) return "";
  const msgUint8 = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getCaptureHandle(field: string) {
  if (field === "nome") return "collect-name";
  if (field === "email") return "collect-email";
  if (field === "whatsapp") return "collect-whatsapp";
  return `collect-${field}`;
}

async function transcribeAudioUrl(audioUrl: string): Promise<string> {
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey || !audioUrl) return "";
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) return "";
    const audioBuf = await audioRes.arrayBuffer();
    const blob = new Blob([audioBuf], { type: audioRes.headers.get("content-type") || "audio/ogg" });
    const form = new FormData();
    form.append("file", blob, "audio.ogg");
    form.append("model", "whisper-1");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!r.ok) return "";
    const data = await r.json();
    return String(data?.text || "").trim();
  } catch (e) {
    return "";
  }
}

function firstTextValue(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text && text.toLowerCase() !== "null" && text.toLowerCase() !== "undefined") return text;
  }
  return "";
}

function sanitizeSenderPhone(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.toLowerCase().includes("@lid")) return raw.toLowerCase();
  const digits = raw.replace(/\D/g, "");
  return digits || raw;
}

function getInboundSenderMetadata(webhook: any, isGroup: boolean, participantPhone: string, chatId: string) {
  const event = webhook?.event || webhook?.data?.event || {};
  const message = webhook?.message || webhook?.msg || webhook?.data?.message || {};
  const senderPhone = sanitizeSenderPhone(
    isGroup
      ? firstTextValue(
          participantPhone,
          event?.Sender,
          event?.SenderPN,
          webhook?.participant,
          webhook?.participantPhone,
          webhook?.senderPhone,
          webhook?.sender?.phone,
          message?.sender?.phone,
          message?.senderPhone,
          message?.participant,
          message?.key?.participant,
          webhook?.author,
          webhook?.remoteParticipant,
        )
      : firstTextValue(webhook?.senderPhone, webhook?.sender?.phone, message?.sender?.phone, message?.senderPhone, chatId),
  );

  const senderName = firstTextValue(
    webhook?.senderName,
    event?.Notify,
    message?.senderName,
    message?.pushName,
    message?.notifyName,
    webhook?.participantName,
    webhook?.pushName,
    webhook?.notifyName,
    webhook?.authorName,
    webhook?.sender?.name,
    webhook?.sender?.pushName,
    webhook?.contact?.name,
    message?.sender?.name,
    message?.sender?.pushName,
  );

  const senderPhoto = isGroup
    ? firstTextValue(
        webhook?.senderPhoto,
        webhook?.participantPhoto,
        webhook?.authorPhoto,
        webhook?.sender?.photo,
        webhook?.sender?.profilePicture,
        webhook?.sender?.profilePictureUrl,
        webhook?.sender?.imagePreview,
        webhook?.sender?.image,
        message?.sender?.profilePictureUrl,
        message?.sender?.imagePreview,
        message?.sender?.image,
      )
    : firstTextValue(
        webhook?.photo,
        webhook?.senderPhoto,
        webhook?.profilePicture,
        webhook?.profilePictureUrl,
        webhook?.sender?.photo,
        webhook?.sender?.profilePicture,
        webhook?.sender?.profilePictureUrl,
        webhook?.sender?.imagePreview,
        webhook?.sender?.image,
        webhook?.contact?.profilePictureUrl,
        webhook?.contact?.photo,
        message?.sender?.profilePictureUrl,
        message?.sender?.imagePreview,
        message?.sender?.image,
      );

  return { senderName, senderPhone, senderPhoto };
}

function getIncomingAudioUrl(webhook: any): string {
  return String(
    webhook?.audio?.audioUrl ||
      webhook?.audio?.url ||
      webhook?.audio?.mediaUrl ||
      webhook?.audio?.fileUrl ||
      webhook?.audio?.downloadUrl ||
      webhook?.audioUrl ||
      webhook?.mediaUrl ||
      "",
  );
}

async function resolveAgentInboundText(messageRaw: string, audioUrl: string): Promise<string> {
  if (!audioUrl) return messageRaw || "";
  const transcript = await transcribeAudioUrl(audioUrl);
  if (transcript) return transcript;
  const fallbackText = String(messageRaw || "")
    .replace(/\[media:audio:[^\]]+\]/gi, "")
    .trim();
  return fallbackText || "[áudio recebido]";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const webhook = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (webhook?.test_event) {
      console.log("[webhook-zapi] Received test event", webhook);
      const testPhone = webhook.phone || "5511999999999";
      const testCode = String(webhook.test_event_code || "").replace(/^(test_event_code:?\s*)+/i, "").trim();
      const authHeader = req.headers.get("Authorization")?.split(" ")[1] || "";
      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
      const userId = user?.id;

      if (!userId) {
        console.error("[webhook-zapi] Auth error:", authError);
        return new Response(JSON.stringify({ error: "Unauthorized", details: authError }), { status: 401, headers: corsHeaders });
      }

      console.log("[webhook-zapi] Testing pixels for user:", userId);
      const { data: pixels } = await supabase.from("gateway_pixels").select("*").eq("user_id", userId).in("platform", ["facebook", "meta"]).eq("active", true);
      
      const results = [];
      
      if (pixels && pixels.length > 0) {
        console.log(`[webhook-zapi] Found ${pixels.length} active pixels`);
        for (const pixel of pixels) {
          if (!pixel.pixel_id || !pixel.api_token) {
            console.log(`[webhook-zapi] Pixel ${pixel.id} missing configuration`);
            continue;
          }
          
          const fbUrl = `https://graph.facebook.com/v17.0/${pixel.pixel_id}/events?access_token=${pixel.api_token}`;
          const hashedPhone = await hashValue(testPhone.replace(/\D/g, ""));
          
          const eventData = { 
            data: [{ 
              event_name: "Purchase", 
              event_time: Math.floor(Date.now() / 1000), 
              action_source: "website", 
              event_source_url: "https://zaplynx.com",
              user_data: { 
                ph: [hashedPhone],
                external_id: [await hashValue(userId)]
              }, 
              custom_data: { 
                currency: "BRL", 
                value: 0.01, 
                content_name: "Comprovante de Pagamento"
              } 
            }],
            test_event_code: testCode
          };
          
          console.log(`[webhook-zapi] Sending event to FB Pixel ${pixel.pixel_id} with code ${testCode}`);
          const fbRes = await fetch(fbUrl, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(eventData) 
          });
          const fbResult = await fbRes.json();
          console.log(`[webhook-zapi] FB Response for ${pixel.pixel_id}:`, fbResult);
          results.push({ pixel_id: pixel.pixel_id, result: fbResult });
        }
      } else {
        console.log("[webhook-zapi] No active pixels found");
      }
      return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: corsHeaders });
    }

    const isGroup = webhook?.isGroup === true || webhook?.isGroup === "true";
    const participantPhone = webhook?.participantPhone || webhook?.participant || webhook?.senderPhone || webhook?.sender?.phone || "";
    let chatId = webhook?.phone || webhook?.chatPhone || "";

    if (isGroup || chatId.includes("@g.us")) {
      const rawId = chatId.replace(/@g\.us$/i, "").replace(/-group$/i, "");
      if (rawId) chatId = `${rawId}-group`;
    }

    const phone = isGroup && participantPhone ? participantPhone : chatId;
    const instanceId = webhook?.instanceId || "";
    const type = webhook?.type || webhook?.notification || (webhook?.buttonsResponseMessage || webhook?.buttonReply ? "ButtonsResponseMessage" : "");
    const messageId = webhook?.messageId || (webhook?.ids && webhook.ids[0]) || "";

    if (["PresenceChatCallback", "PresenceCallback", "ChatPresenceCallback"].includes(type) || ["AVAILABLE", "UNAVAILABLE", "COMPOSING", "RECORDING"].includes(webhook?.status)) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (["ConnectedCallback", "DisconnectedCallback", "ReconnectedCallback"].includes(type) || ["CONNECTED", "DISCONNECTED", "RECONNECTED"].includes(webhook?.instanceStatus)) {
      const isConnected = ["ConnectedCallback", "ReconnectedCallback"].includes(type) || ["CONNECTED", "RECONNECTED"].includes(webhook?.instanceStatus);
      if (instanceId) {
        await supabase.from("zapi_instances").update({ is_active: isConnected, updated_at: new Date().toISOString() }).or(`zapi_instance_id.eq.${instanceId},id.eq.${instanceId}`);
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const { senderName, senderPhone, senderPhoto } = getInboundSenderMetadata(webhook, isGroup, participantPhone, chatId);
    let messageRaw = webhook?.buttonsResponseMessage?.message || webhook?.buttonsResponseMessage?.buttonText || webhook?.buttonsResponseMessage?.buttonId || webhook?.buttonResponseMessage?.message || webhook?.buttonResponseMessage?.buttonText || webhook?.buttonResponseMessage?.selectedButtonId || webhook?.buttonReply?.text || webhook?.buttonReply?.buttonId || webhook?.listResponseMessage?.singleSelectReply?.selectedRowId || webhook?.listResponseMessage?.title || webhook?.listResponseMessage?.actionLabel || webhook?.listResponseMessage?.description || webhook?.text?.message || webhook?.message?.text || webhook?.text || webhook?.interactiveResponseMessage?.body || "";

    const incomingAudioUrl = getIncomingAudioUrl(webhook);
    const mediaUrl = webhook?.image?.url || webhook?.video?.url || incomingAudioUrl || webhook?.sticker?.url || webhook?.document?.url;
    if (mediaUrl) {
      let mediaType = "";
      if (webhook.image) mediaType = "image";
      else if (webhook.video) mediaType = "video";
      else if (webhook.audio || incomingAudioUrl) mediaType = "audio";
      else if (webhook.sticker) mediaType = "sticker";
      else if (webhook.document) mediaType = "document";
      if (mediaType) {
        const mediaTag = `[media:${mediaType}:${mediaUrl}]`;
        messageRaw = messageRaw ? `${mediaTag}\n${messageRaw}` : mediaTag;
      }
    }

    const fromMe = webhook?.fromMe === true || webhook?.fromMe === "true" || webhook?.fromApi === true || webhook?.fromApi === "true";
    const { data: instanceData } = await supabase.from("zapi_instances").select("id, user_id, zapi_instance_id, zapi_token, zapi_client_token").or(`zapi_instance_id.eq.${instanceId},id.eq.${instanceId}`).maybeSingle();
    const userId = instanceData?.user_id;

    if (userId && !fromMe && (webhook?.text || webhook?.message?.text || messageRaw.trim().length > 0)) {
      const contactPhone = isGroup ? senderPhone : sanitizeSenderPhone(phone || senderPhone);
      if (contactPhone) {
        const contactPayload: Record<string, any> = { user_id: userId, phone: contactPhone, updated_at: new Date().toISOString() };
        if (senderName) contactPayload.name = senderName;
        if (senderPhoto) contactPayload.profile_picture_url = senderPhoto;
        await supabase.from("saved_contacts").upsert(contactPayload, { onConflict: "user_id,phone" });
      }
    }

    const agentInboundText = await resolveAgentInboundText(messageRaw, incomingAudioUrl);
    const isButtonResponse = type === "ButtonsResponseMessage" || type === "ButtonReply" || type === "ListResponseMessage" || !!webhook?.buttonsResponseMessage || !!webhook?.buttonResponseMessage || !!webhook?.buttonReply || !!webhook?.listResponseMessage;

    console.log("[webhook-zapi] processing inbound:", { userId, phone, fromMe, isButtonResponse, msg: messageRaw.slice(0, 50) });

    if (!fromMe || isButtonResponse) {
      console.log("[webhook-zapi] inbound payload:", JSON.stringify(webhook).slice(0, 500));
      console.log("[webhook-zapi] inbound detail:", { userId, phone, chatId, isGroup, msg: messageRaw.slice(0, 80) });
      
      const { data: activeFlowStates, error: activeErr } = await supabase.from("flow_captured_data").select("*").eq("user_id", userId).eq("phone", phone).not("last_node_id", "is", null);
      console.log("[webhook-zapi] activeFlows check:", { count: activeFlowStates?.length || 0, error: activeErr?.message, userId, phone });
      
      if (activeFlowStates && activeFlowStates.length > 0) {
        for (const flowState of activeFlowStates) {
          console.log("[webhook-zapi] resuming flow", flowState.flow_id, "at node", flowState.last_node_id);
          const { data: flow } = await supabase.from("flow_automations").select("*").eq("id", flowState.flow_id).single();
          if (flow) {
            await executeFlow(supabase, userId, phone, flow, flowState.last_node_id, flowState.captured_data || {}, instanceData, chatId, isGroup, { ...webhook, __agent_input_text: agentInboundText, __is_resuming: true });
            return new Response("ok", { status: 200, headers: corsHeaders });
          }
        }
      }

      console.log("[webhook-zapi] no active flow, checking global keywords for", { flowsCount: 0 });
      const { data: flows } = await supabase.from("flow_automations").select("*").eq("user_id", userId).eq("active", true);
      console.log("[webhook-zapi] active flows found:", flows?.length || 0);
      
      for (const flow of flows || []) {
        if (flow.category === "telegram") {
           console.log(`[webhook-zapi] skipping telegram flow "${flow.name}"`);
           continue;
        }

        const triggerNode = flow.nodes.find((n: any) => n.type === "step" && n.data?.kind === "gatilho") || 
                           flow.nodes.find((n: any) => n.type === "blocoInicial");
        
        let isMatch = false;
        const startNodeId = triggerNode?.id;

        const mainKeywords = (flow.keyword || "").split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean);
        const normalizedMsg = normalizeForMatch(messageRaw);
        
        console.log(`[webhook-zapi] Checking flow "${flow.name}" triggers. Msg: "${normalizedMsg}", Keywords: ${JSON.stringify(mainKeywords)}`);

        // Prioritize exact match
        if (mainKeywords.some((k: string) => normalizedMsg === k)) {
          isMatch = true;
          console.log(`[webhook-zapi] Exact keyword match for flow "${flow.name}"`);
        } 
        // Then partial match for keywords with at least 3 characters
        else if (mainKeywords.some((k: string) => k.length >= 3 && normalizedMsg.includes(k))) {
          isMatch = true;
          console.log(`[webhook-zapi] Partial keyword match for flow "${flow.name}"`);
        } 
        // Then check if the node itself has a keyword (fallback)
        else if (triggerNode?.data?.keyword) {
          const nodeKeyword = normalizeForMatch(triggerNode.data.keyword);
          if (normalizedMsg === nodeKeyword || (nodeKeyword.length >= 3 && normalizedMsg.includes(nodeKeyword))) {
            isMatch = true;
            console.log(`[webhook-zapi] Trigger node keyword match for flow "${flow.name}"`);
          }
        }
        // Then command match
        else if (triggerNode?.type === "step" && triggerNode.data?.triggerType === "command") {
          const command = normalizeForMatch(triggerNode.data.keyword || "");
          if (command && normalizedMsg === command) {
            isMatch = true;
            console.log(`[webhook-zapi] Command match for flow "${flow.name}"`);
          }
        }

        if (isMatch && startNodeId) {
          console.log(`[webhook-zapi] trigger match found for flow "${flow.name}" (id: ${flow.id})`);
          await executeFlow(supabase, userId, phone, flow, startNodeId, {}, instanceData, chatId, isGroup, { ...webhook, __agent_input_text: agentInboundText });
          return new Response("ok", { status: 200, headers: corsHeaders });
        }

      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[webhook-zapi] error:", err);
    return new Response("error", { status: 200, headers: corsHeaders });
  }
});

async function executeFlow(supabase: any, userId: string, phone: string, flow: any, nodeId: string, captured: any, instance: any, chatId?: string, isGroup?: boolean, webhook?: any) {
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  let currentNodeId = nodeId;
  const visited = new Set();

  while (currentNodeId && !visited.has(String(currentNodeId))) {
    visited.add(String(currentNodeId));
    const node = nodes.find((n: any) => String(n.id) === String(currentNodeId));
    if (!node) break;

    if (node.type === "blocoConteudo" || node.type === "blocoInicial") {
      const content = node.data.content || "";
      const resolvedContent = content.replace(/\{\{nome\}\}/gi, captured.nome || "").replace(/\{\{whatsapp\}\}/gi, phone).replace(/\{\{email\}\}/gi, captured.email || "");
      const destination = isGroup ? chatId : phone;
      await sendZapiText(instance, destination, resolvedContent, node.data.buttons, node.id, node.data.contentType || "text", node.data.mediaUrl || "", supabase, userId, flow.name);
      
      if (node.data.buttons?.length > 0) {
        console.log("[webhook-zapi] node has buttons, waiting for response", node.id);
        await supabase.from("flow_captured_data").upsert({ user_id: userId, flow_id: flow.id, flow_name: flow.name, phone, captured_data: captured, last_node_id: node.id, source: isGroup ? "whatsapp_group" : "whatsapp", updated_at: new Date().toISOString() }, { onConflict: "user_id,flow_id,phone" });
        return;
      }
    } else if (node.type === "blocoCondicao") {
      let matchedIndex = -1;
      const inboundText = String(webhook?.__agent_input_text || "");
      const normalizedInbound = normalizeForMatch(inboundText);
      console.log("[webhook-zapi] processing condition node", node.id, "inbound:", inboundText);
      
      if (node.data?.isProofBlock) {
        const isTestEvent = inboundText.includes("test_event_code:");
        if (inboundText.includes("[media:") || isTestEvent) {
          console.log(`[webhook-zapi] Proof received (or test event) - Instance: ${instance?.zapi_instance_id || "N/A"} - Client: ${phone}`);
          matchedIndex = 0;
          try {
            const { data: pixels } = await supabase.from("gateway_pixels").select("*").eq("user_id", userId).in("platform", ["facebook", "meta"]).eq("active", true);
            if (pixels) {
              console.log(`[webhook-zapi] Found ${pixels.length} active pixels for user ${userId}`);
              for (const pixel of pixels) {
                if (!pixel.pixel_id || !pixel.api_token) {
                  console.log(`[webhook-zapi] Pixel ${pixel.id} missing ID or token`);
                  continue;
                }
                const fbUrl = `https://graph.facebook.com/v17.0/${pixel.pixel_id}/events?access_token=${pixel.api_token}`;
                const hashedPhone = await hashValue(phone.replace(/\D/g, ""));
                const testCode = isTestEvent ? inboundText.replace(/^(test_event_code:?\s*)+/i, "").trim() : null;
                const eventData = { 
                  data: [{ 
                    event_name: "Purchase", 
                    event_time: Math.floor(Date.now() / 1000), 
                    action_source: "website", 
                    event_source_url: "https://zaplynx.com",
                    user_data: { 
                      ph: [hashedPhone],
                      external_id: [await hashValue(userId)]
                    }, 
                    custom_data: { 
                      currency: "BRL", 
                      value: 0.01, 
                      content_name: "Comprovante de Pagamento"
                    } 
                  }],
                  test_event_code: testCode
                };
                
                console.log(`[webhook-zapi] Sending Purchase event to Pixel ${pixel.pixel_id}`);
                const fbRes = await fetch(fbUrl, { 
                  method: "POST", 
                  headers: { "Content-Type": "application/json" }, 
                  body: JSON.stringify(eventData) 
                });
                const fbResult = await fbRes.json();
                console.log(`[webhook-zapi] Pixel response:`, fbResult);
              }
            } else {
              console.log(`[webhook-zapi] No active pixels found for user ${userId}`);
            }
          } catch (pixelErr) { 
            console.error(`[webhook-zapi] Error sending pixel event:`, pixelErr); 
          }
          await supabase.from("flow_captured_data").delete().match({ user_id: userId, flow_id: flow.id, phone });
        } else if (!webhook?.__is_resuming) {
          await supabase.from("flow_captured_data").upsert({ user_id: userId, flow_id: flow.id, flow_name: flow.name, phone, captured_data: captured, last_node_id: currentNodeId, source: isGroup ? "whatsapp_group" : "whatsapp", updated_at: new Date().toISOString() }, { onConflict: "user_id,flow_id,phone" });
          return;
        } else {
          return;
        }
      } else {
        const branches = node.data?.branches || [];
        console.log("[webhook-zapi] branches:", branches.length);
        if (branches.length > 0) {
          for (let i = 0; i < branches.length; i++) {
            const branch = branches[i];
            const branchValue = branch.value || branch.label || "";
            if (isKeywordMatch(normalizedInbound, branchValue)) {
              console.log("[webhook-zapi] branch match found at index", i, "value:", branchValue);
              matchedIndex = i;
              break;
            }
          }
        }
        
        if (matchedIndex === -1 && node.data?.condition) {
          if (isKeywordMatch(normalizedInbound, node.data.condition)) {
            console.log("[webhook-zapi] legacy condition match found at index 0");
            matchedIndex = 0;
          }
        }
        
        if (!webhook?.__is_resuming && matchedIndex === -1) {
          console.log("[webhook-zapi] no match and not resuming, waiting for user input at node", currentNodeId);
          await supabase.from("flow_captured_data").upsert({ user_id: userId, flow_id: flow.id, flow_name: flow.name, phone, captured_data: captured, last_node_id: currentNodeId, source: isGroup ? "whatsapp_group" : "whatsapp", updated_at: new Date().toISOString() }, { onConflict: "user_id,flow_id,phone" });
          return;
        }

        console.log("[webhook-zapi] match found or forcing branch, deleting flow state and continuing. matchedIndex:", matchedIndex);
        await supabase.from("flow_captured_data").delete().match({ user_id: userId, flow_id: flow.id, phone });
      }
      
      const handleId = matchedIndex === 0 ? "a" : matchedIndex === 1 ? "b" : matchedIndex > 1 ? `branch-${matchedIndex}` : "source-bottom";
      const nextEdge = edges.find((e: any) => String(e.source) === String(currentNodeId) && String(e.sourceHandle) === handleId);
      
      console.log("[webhook-zapi] next handleId:", handleId, "found edge:", !!nextEdge);
      
      if (!nextEdge && matchedIndex === -1) {
        const elseEdge = edges.find((e: any) => String(e.source) === String(currentNodeId) && (String(e.sourceHandle) === "source-bottom" || String(e.sourceHandle) === "else"));
        if (elseEdge) {
          console.log("[webhook-zapi] no match found, following ELSE/default edge");
          currentNodeId = elseEdge.target;
          continue;
        }
      }

      currentNodeId = nextEdge?.target;
      if (currentNodeId) {
        console.log("[webhook-zapi] moving to next node", currentNodeId);
        continue;
      } else {
        console.log("[webhook-zapi] no next node found for this handle");
        break;
      }
    }

    const nextEdge = edges.find((e: any) => String(e.source) === String(currentNodeId) && (!e.sourceHandle || e.sourceHandle === "default" || e.sourceHandle === "output"));
    currentNodeId = nextEdge?.target;
    if (currentNodeId) console.log("[webhook-zapi] auto-advancing to next node", currentNodeId);

  }
}

async function sendZapiText(instance: any, phone: string, message: string, buttons?: any[], nodeId?: string, contentType = "text", mediaUrl = "", supabase?: any, userId?: string, flowName?: string) {
  const zapiId = instance.zapi_instance_id;
  const zapiToken = instance.zapi_token;
  const clientToken = instance.zapi_client_token;
  let url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-text`;
  let body: any = { phone, message };
  if (buttons?.length > 0) {
    url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-button-actions`;
    body = { phone, message, buttonActions: buttons.map((btn, idx) => ({ id: btn.id || `node:${nodeId}:button:${idx}`, type: "REPLY", label: btn.text })) };
  }
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Client-Token": clientToken || "" }, body: JSON.stringify(body) });
}
