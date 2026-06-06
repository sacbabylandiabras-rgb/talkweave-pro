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
const receivedWebhookSyncAt = new Map<string, number>();

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
  if (!normalizedKeyword || !normalizedMessage) return false;
  
  // Strict check for slash commands
  if (normalizedKeyword.startsWith("/")) {
    return normalizedMessage === normalizedKeyword;
  }
  
  return normalizedMessage.includes(normalizedKeyword);
}

function splitKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(splitKeywords);
  return String(value || "")
    .split(/[\n,;]/)
    .map((keyword) => normalizeForMatch(keyword))
    .filter(Boolean);
}

function onlyDigits(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function isZapiWhatsAppFlow(flow: any): boolean {
  const category = String(flow?.category || "contacts").toLowerCase();
  return !["meta", "instagram", "telegram"].includes(category);
}

function flowMatchesChatType(flow: any, isGroup: boolean): boolean {
  const category = String(flow?.category || "contacts").toLowerCase();
  if (isGroup) return category === "groups";
  return category !== "groups";
}

function getConnectedPhone(webhook: any): string {
  return onlyDigits(webhook?.connectedPhone || webhook?.connected_phone || webhook?.ownerPhone || webhook?.me?.phone || webhook?.phoneConnected);
}

function isOwnConnectedChat(webhook: any, phone: string, chatId: string, senderPhone: string): boolean {
  const connectedPhone = getConnectedPhone(webhook);
  if (!connectedPhone) return false;
  const candidates = [phone, chatId, senderPhone, webhook?.phone, webhook?.chatPhone].map(onlyDigits).filter(Boolean);
  return candidates.some((candidate) => candidate === connectedPhone);
}

function isStatusOnlyCallback(type: string, webhook: any, messageRaw: string, mediaUrl: string): boolean {
  const statusOnlyTypes = new Set(["DeliveryCallback", "MessageStatusCallback", "StatusCallback", "MessageStatus"]);
  if (statusOnlyTypes.has(type)) return true;
  const hasInboundContent = Boolean(normalizeForMatch(messageRaw) || mediaUrl);
  return !hasInboundContent && (Array.isArray(webhook?.ids) || Boolean(webhook?.messageId && webhook?.zaapId));
}

function resolveFlowStartNodeId(flow: any, triggerNode: any): string | undefined {
  if (!triggerNode?.id) return undefined;
  const isTriggerNode =
    triggerNode?.type === "blocoGatilho" ||
    triggerNode?.type === "gatilho" ||
    triggerNode?.type === "trigger" ||
    (triggerNode?.type === "step" && triggerNode?.data?.kind === "gatilho");

  if (isTriggerNode) {
    const edges = Array.isArray(flow?.edges) ? flow.edges : [];
    const nextEdge = edges.find((edge: any) => String(edge.source) === String(triggerNode.id));
    return nextEdge?.target || triggerNode.id;
  }
  return triggerNode.id;
}

function findDefaultNextEdge(edges: any[], currentNodeId: string) {
  const sourceEdges = edges.filter((e: any) => String(e.source) === String(currentNodeId));
  return sourceEdges.find((e: any) => !e.sourceHandle || ["default", "output", "source-right", "right", "source-bottom", "bottom"].includes(String(e.sourceHandle))) || sourceEdges[0];
}

async function ensureReceivedWebhook(instance: any, supabase: any) {
  const zapiId = instance?.zapi_instance_id;
  const zapiToken = instance?.zapi_token;
  const clientToken = instance?.zapi_client_token;
  if (!zapiId || !zapiToken || !clientToken) return;

  const persistedSyncAt = instance?.updated_at ? new Date(instance.updated_at).getTime() : 0;
  const lastSync = Math.max(receivedWebhookSyncAt.get(zapiId) || 0, Number.isFinite(persistedSyncAt) ? persistedSyncAt : 0);
  if (Date.now() - lastSync < 10 * 60 * 1000) return;
  receivedWebhookSyncAt.set(zapiId, Date.now());

  const webhookUrl = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/webhook-zapi`;
  const url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/update-webhook-received`;
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    body: JSON.stringify({ value: webhookUrl }),
  });
  console.log("[webhook-zapi] received webhook sync", { ok: response.ok, status: response.status, instanceId: zapiId });
  if (response.ok && instance?.id) {
    await supabase.from("zapi_instances").update({ updated_at: new Date().toISOString() }).eq("id", instance.id);
  }
}

async function disableNotifySentByMe(instance: any) {
  const zapiId = instance?.zapi_instance_id;
  const zapiToken = instance?.zapi_token;
  const clientToken = instance?.zapi_client_token;
  if (!zapiId || !zapiToken || !clientToken) return;

  const url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/update-notify-sent-by-me`;
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    body: JSON.stringify({ notifySentByMe: false }),
  });
  console.log("[webhook-zapi] notify-sent-by-me disabled", { ok: response.ok, status: response.status, instanceId: zapiId });
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
    const rawBody = await req.text();
    const webhook = JSON.parse(rawBody || "{}");
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
        console.log(`[webhook-zapi] instance status update: ${instanceId} -> ${isConnected ? "connected" : "disconnected"}`);
        await supabase.from("zapi_instances").update({ is_active: isConnected, updated_at: new Date().toISOString() }).or(`zapi_instance_id.eq.${instanceId},id.eq.${instanceId}`);
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const { senderName, senderPhone, senderPhoto } = getInboundSenderMetadata(webhook, isGroup, participantPhone, chatId);
    let messageRaw = webhook?.buttonsResponseMessage?.message || webhook?.buttonsResponseMessage?.buttonText || webhook?.buttonsResponseMessage?.buttonId || webhook?.buttonResponseMessage?.message || webhook?.buttonResponseMessage?.buttonText || webhook?.buttonResponseMessage?.selectedButtonId || webhook?.buttonReply?.text || webhook?.buttonReply?.buttonId || webhook?.listResponseMessage?.singleSelectReply?.selectedRowId || webhook?.listResponseMessage?.title || webhook?.listResponseMessage?.actionLabel || webhook?.listResponseMessage?.description || webhook?.text?.message || webhook?.message?.text || webhook?.text || webhook?.interactiveResponseMessage?.body || "";

    const incomingAudioUrl = getIncomingAudioUrl(webhook);
    const mediaUrl =
      webhook?.image?.url || webhook?.image?.imageUrl || webhook?.image?.mediaUrl || webhook?.image?.downloadUrl ||
      webhook?.video?.url || webhook?.video?.videoUrl || webhook?.video?.mediaUrl || webhook?.video?.downloadUrl ||
      incomingAudioUrl ||
      webhook?.sticker?.url || webhook?.sticker?.stickerUrl || webhook?.sticker?.mediaUrl ||
      webhook?.document?.url || webhook?.document?.documentUrl || webhook?.document?.mediaUrl || webhook?.document?.downloadUrl ||
      webhook?.imageMessage?.url || webhook?.documentMessage?.url || "";
    if (mediaUrl) {
      let mediaType = "";
      if (webhook.image || webhook.imageMessage) mediaType = "image";
      else if (webhook.video || webhook.videoMessage) mediaType = "video";
      else if (webhook.audio || incomingAudioUrl) mediaType = "audio";
      else if (webhook.sticker) mediaType = "sticker";
      else if (webhook.document || webhook.documentMessage) mediaType = "document";
      if (mediaType) {
        const mediaTag = `[media:${mediaType}:${mediaUrl}]`;
        messageRaw = messageRaw ? `${mediaTag}\n${messageRaw}` : mediaTag;
        console.log("[webhook-zapi] media detected", { mediaType, mediaUrl: mediaUrl.slice(0, 80) });
      }
    }

    const fromMe = webhook?.fromMe === true || webhook?.fromMe === "true" || webhook?.fromApi === true || webhook?.fromApi === "true";
    const { data: instanceData } = await supabase.from("zapi_instances").select("id, user_id, zapi_instance_id, zapi_token, zapi_client_token, updated_at").or(`zapi_instance_id.eq.${instanceId},id.eq.${instanceId}`).maybeSingle();
    const userId = instanceData?.user_id;

    if (isStatusOnlyCallback(type, webhook, messageRaw, mediaUrl)) {
      if (instanceData) await ensureReceivedWebhook(instanceData, supabase).catch((error) => console.warn("[webhook-zapi] received webhook sync failed", error));
      console.log("[webhook-zapi] ignored status-only callback", { type, status: webhook?.status, phone, messageId });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (!userId) {
      console.log("[webhook-zapi] ignored callback without linked instance", { instanceId, type, phone });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (isOwnConnectedChat(webhook, phone, chatId, senderPhone)) {
      await disableNotifySentByMe(instanceData).catch((error) => console.warn("[webhook-zapi] disable notify-sent-by-me failed", error));
      console.log("[webhook-zapi] ignored own connected number chat", { phone, chatId, senderPhone, connectedPhone: getConnectedPhone(webhook), messageId });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

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
      // Log inbound message
      const logPayload = {
        user_id: userId,
        phone: phone,
        message_received: agentInboundText || messageRaw,
        instance_id: instanceId,
        message_id: messageId,
        sender_name: senderName,
        sender_phone: senderPhone,
        sender_photo: senderPhoto,
        timestamp: new Date().toISOString()
      };
      try {
        await supabase.from("message_logs").insert(logPayload);
      } catch (err: any) {
        console.warn("[webhook-zapi] failed to log inbound message", err);
      }
      
      console.log("[webhook-zapi] inbound payload:", JSON.stringify(webhook).slice(0, 500));
      console.log("[webhook-zapi] inbound detail:", { userId, phone, chatId, isGroup, msg: messageRaw.slice(0, 80) });

      
      const { data: activeFlowStates, error: activeErr } = await supabase.from("flow_captured_data").select("*").eq("user_id", userId).eq("phone", phone).not("last_node_id", "is", null);
      console.log("[webhook-zapi] activeFlows check:", { count: activeFlowStates?.length || 0, error: activeErr?.message, userId, phone });
      
      if (activeFlowStates && activeFlowStates.length > 0) {
        for (const flowState of activeFlowStates) {
          console.log("[webhook-zapi] resuming flow", flowState.flow_id, "at node", flowState.last_node_id);
          const { data: flow } = await supabase.from("flow_automations").select("*").eq("id", flowState.flow_id).single();
          if (flow && flow.active === true && isZapiWhatsAppFlow(flow)) {
            await executeFlow(supabase, userId, phone, flow, flowState.last_node_id, flowState.captured_data || {}, instanceData, chatId, isGroup, { ...webhook, __agent_input_text: agentInboundText, __is_resuming: true });
            return new Response("ok", { status: 200, headers: corsHeaders });
          } else {
            await supabase.from("flow_captured_data").delete().match({ user_id: userId, flow_id: flowState.flow_id, phone });
            console.log("[webhook-zapi] removed stale/non-whatsapp flow state", { flowId: flowState.flow_id, phone });
          }
        }
      }

      console.log("[webhook-zapi] no active flow, checking global keywords for", { flowsCount: 0 });
      const { data: flows } = await supabase.from("flow_automations").select("*").eq("user_id", userId).eq("active", true);
      console.log("[webhook-zapi] active flows found:", flows?.length || 0);
      
      for (const flow of flows || []) {
        if (!isZapiWhatsAppFlow(flow)) {
           console.log(`[webhook-zapi] skipping non-whatsapp flow "${flow.name}"`, { category: flow.category });
           continue;
        }

        const triggerNode = flow.nodes.find((n: any) => n.type === "blocoGatilho" || n.type === "gatilho" || n.type === "trigger" || (n.type === "step" && n.data?.kind === "gatilho")) || 
                           flow.nodes.find((n: any) => n.type === "blocoInicial");
        
        let isMatch = false;
        const startNodeId = resolveFlowStartNodeId(flow, triggerNode);

        const mainKeywords = splitKeywords(flow.keyword || flow.trigger_keywords);
        const normalizedMsg = normalizeForMatch(agentInboundText || messageRaw);
        if (!normalizedMsg) {
          console.log(`[webhook-zapi] skipping flow "${flow.name}" because inbound message is empty`);
          continue;
        }
        
        // Also check if any node has keywords (the user might have configured keywords inside a "Gatilho" block)
        const nodeKeywords = flow.nodes
          .filter((n: any) => n.data?.keyword || n.data?.keywords || n.data?.trigger_keywords || n.data?.triggerKeywords)
          .flatMap((n: any) => {
            const k = n.data?.keyword || n.data?.keywords || n.data?.trigger_keywords || n.data?.triggerKeywords;
            return splitKeywords(k);
          });

        const allKeywords = Array.from(new Set([...mainKeywords, ...nodeKeywords]));
        
        console.log(`[webhook-zapi] Checking flow "${flow.name}" triggers. Msg: "${normalizedMsg}", All Keywords: ${JSON.stringify(allKeywords)}`);

        // Prioritize exact match
        if (allKeywords.some((k: string) => normalizedMsg === k)) {
          isMatch = true;
          console.log(`[webhook-zapi] Exact keyword match for flow "${flow.name}"`);
        } 
        // Command match
        else if (triggerNode?.type === "step" && triggerNode.data?.triggerType === "command") {
          const command = normalizeForMatch(triggerNode.data.keyword || "");
          if (command && normalizedMsg === command) {
            isMatch = true;
            console.log(`[webhook-zapi] Command match for flow "${flow.name}"`);
          }
        }
        // Then partial match for keywords with at least 2 characters (expanded from 3)
        // This allows "oi" or "oih" to match "oi"
        else if (allKeywords.some((k: string) => {
          if (k.length < 2) return false;
          // Check if message contains keyword OR keyword contains message (for very short inputs)
          return normalizedMsg.includes(k) || (normalizedMsg.length >= 2 && k.includes(normalizedMsg));
        })) {
          isMatch = true;
          console.log(`[webhook-zapi] Partial/Included keyword match for flow "${flow.name}"`);
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

function getCapturedValue(captured: any, variable: unknown, inboundText: string, phone: string): string {
  const rawKey = String(variable || "").replace(/[{}]/g, "").trim();
  const normalizedKey = rawKey.replace(/^lead\./i, "").replace(/^contato\./i, "");
  const lastKey = normalizedKey.split(".").pop() || normalizedKey;
  if (["mensagem", "message", "texto", "text"].includes(normalizeForMatch(normalizedKey))) return inboundText;
  if (["whatsapp", "telefone", "phone"].includes(normalizeForMatch(normalizedKey))) return String(captured?.[lastKey] || captured?.whatsapp || phone || "");
  return String(captured?.[normalizedKey] ?? captured?.[lastKey] ?? "");
}

function evaluateConditionValue(value: string, operator: string, compareValue: string): boolean {
  const current = normalizeForMatch(value);
  const target = normalizeForMatch(compareValue);
  switch (operator || "equals") {
    case "not_equals": return current !== target;
    case "contains": return current.includes(target);
    case "not_contains": return !current.includes(target);
    case "starts_with": return current.startsWith(target);
    case "ends_with": return current.endsWith(target);
    case "is_empty": return !current;
    case "is_not_empty": return !!current;
    case "is_numeric": return /^-?\d+(?:[.,]\d+)?$/.test(current);
    case "greater": return Number(current.replace(",", ".")) > Number(target.replace(",", "."));
    case "greater_equals": return Number(current.replace(",", ".")) >= Number(target.replace(",", "."));
    case "less": return Number(current.replace(",", ".")) < Number(target.replace(",", "."));
    case "less_equals": return Number(current.replace(",", ".")) <= Number(target.replace(",", "."));
    default: return current === target;
  }
}

function conditionHandleCandidates(matchedIndex: number): string[] {
  if (matchedIndex === 0) return ["a", "0", "branch-0", "if-0", "true", "sim", "yes"];
  if (matchedIndex === 1) return ["b", "1", "branch-1", "if-1", "false", "nao", "não", "no"];
  if (matchedIndex > 1) return [`branch-${matchedIndex}`, `if-${matchedIndex}`, String(matchedIndex)];
  return ["source-bottom", "else", "fallback", "right", "b", "branch-1", "if-1", "false"];
}

function findConditionEdge(edges: any[], nodeId: string, matchedIndex: number) {
  const handles = conditionHandleCandidates(matchedIndex).map((handle) => normalizeForMatch(handle));
  return edges.find((edge: any) => {
    if (String(edge.source) !== String(nodeId)) return false;
    return handles.includes(normalizeForMatch(String(edge.sourceHandle || "")));
  });
}

async function saveFlowState(supabase: any, userId: string, phone: string, flow: any, captured: any, nodeId: string | null, isGroup?: boolean) {
  await supabase.from("flow_captured_data").upsert({
    user_id: userId,
    flow_id: flow.id,
    flow_name: flow.name,
    phone,
    captured_data: captured,
    last_node_id: nodeId,
    source: isGroup ? "whatsapp_group" : "whatsapp",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,flow_id,phone" });
}

async function executeFlow(supabase: any, userId: string, phone: string, flow: any, nodeId: string, captured: any, instance: any, chatId?: string, isGroup?: boolean, webhook?: any) {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow.edges) ? flow.edges : [];
  const resumedNodeId = webhook?.__is_resuming ? String(nodeId) : "";
  const inboundText = String(webhook?.__agent_input_text || "");
  const normalizedInbound = normalizeForMatch(inboundText);
  let currentNodeId = nodeId;
  const visited = new Set<string>();

  while (currentNodeId && !visited.has(String(currentNodeId))) {
    visited.add(String(currentNodeId));
    const node = nodes.find((n: any) => String(n.id) === String(currentNodeId));
    if (!node) break;

    if (node.type === "blocoGatilho" || node.type === "gatilho" || node.type === "trigger" || (node.type === "step" && node.data?.kind === "gatilho")) {
      currentNodeId = findDefaultNextEdge(edges, currentNodeId)?.target;
      if (currentNodeId) console.log("[webhook-zapi] skipping trigger node and moving to", currentNodeId);
      continue;
    }

    if (node.type === "blocoConteudo" || node.type === "blocoInicial") {
      const content = node.data?.content || "";
      const resolvedContent = content
        .replace(/\{\{nome\}\}/gi, captured?.nome || "")
        .replace(/\{\{whatsapp\}\}/gi, phone)
        .replace(/\{\{email\}\}/gi, captured?.email || "");
      const destination = isGroup ? chatId : phone;
      const sentInstanceId = instance?.zapi_instance_id || webhook?.instanceId || "";
      await sendZapiText(instance, destination, resolvedContent, node.data?.buttons, node.id, node.data?.contentType || "text", node.data?.mediaUrl || "", supabase, userId, flow.name, sentInstanceId);

      if (node.data?.buttons?.length > 0) {
        console.log("[webhook-zapi] node has buttons, waiting for response", node.id);
        await saveFlowState(supabase, userId, phone, flow, captured, node.id, isGroup);
        return;
      }
    } else if (node.type === "blocoCondicao") {
      const isResumingThisNode = resumedNodeId === String(currentNodeId);
      let matchedIndex = -1;
      console.log("[webhook-zapi] processing condition node", node.id, { inbound: inboundText, isResumingThisNode });

      if (node.data?.isProofBlock) {
        const isTestEvent = inboundText.includes("test_event_code:");
        if (inboundText.includes("[media:") || isTestEvent) {
          matchedIndex = 0;
          const proofUrl = inboundText.match(/\[media:(?:image|video|audio|document|sticker|gif):(.+?)\]/)?.[1];
          captured = { ...captured, proof_url: proofUrl || captured?.proof_url };
          await saveFlowState(supabase, userId, phone, flow, captured, null, isGroup);
        } else {
          if (!isResumingThisNode) await saveFlowState(supabase, userId, phone, flow, captured, currentNodeId, isGroup);
          return;
        }
      } else {
        // 1. Check conditions (variable-based)
        const conditions = Array.isArray(node.data?.conditions) ? node.data.conditions : [];
        for (let index = 0; index < conditions.length; index++) {
          const condition = conditions[index];
          const value = getCapturedValue(captured, condition.variable, inboundText, phone);
          if (evaluateConditionValue(value, condition.operator || "equals", String(condition.compareValue ?? ""))) {
            matchedIndex = index;
            console.log("[webhook-zapi] variable condition match", { nodeId: node.id, index, variable: condition.variable });
            break;
          }
        }

        // 2. Legacy variable match
        if (matchedIndex === -1 && conditions.length === 0 && node.data?.variable) {
          const value = getCapturedValue(captured, node.data.variable, inboundText, phone);
          const compareValue = String(node.data.compareValue ?? node.data.condition ?? "");
          if (evaluateConditionValue(value, node.data.operator || "equals", compareValue)) {
            matchedIndex = 0;
            console.log("[webhook-zapi] legacy variable condition match", { nodeId: node.id, variable: node.data.variable });
          } else if (findConditionEdge(edges, currentNodeId, 1)) {
            matchedIndex = 1;
            console.log("[webhook-zapi] legacy variable condition false branch", { nodeId: node.id, variable: node.data.variable });
          }
        }

        // 3. Check branches (direct response matching)
        const branches = Array.isArray(node.data?.branches) ? node.data.branches : [];
        if (matchedIndex === -1 && branches.length > 0) {
          for (let index = 0; index < branches.length; index++) {
            const branch = branches[index];
            const branchValue = String(branch?.value || branch?.label || "");
            const branchOperator = String(branch?.operator || "contains");
            
            // Allow matching "sim" or "não" directly as strings
            const branchMatches = branchValue && (
              branchOperator === "contains"
                ? isKeywordMatch(inboundText, branchValue)
                : evaluateConditionValue(inboundText, branchOperator, branchValue)
            );
            
            if (branchMatches) {
              matchedIndex = index;
              console.log("[webhook-zapi] branch match found", { nodeId: node.id, index, branchValue });
              break;
            }
          }
        }

        // 4. Legacy simple condition match
        if (matchedIndex === -1 && node.data?.condition && isKeywordMatch(inboundText, node.data.condition)) {
          matchedIndex = 0;
          console.log("[webhook-zapi] legacy condition match found", { nodeId: node.id });
        }

        // 5. Final fallback/else
        if (matchedIndex === -1) {
          const elseEdge = findConditionEdge(edges, currentNodeId, -1);
          if (isResumingThisNode) {
             // If we are resuming (user replied) and still no match, follow Else/Fallback
             if (elseEdge) {
               matchedIndex = -1; // -1 triggers findConditionEdge to look for fallback/else handles
               console.log("[webhook-zapi] no match, following else/default path", { nodeId: node.id, target: elseEdge.target });
             } else {
               console.log("[webhook-zapi] no match and no else path, stopping flow", { nodeId: node.id });
               await supabase.from("flow_captured_data").delete().match({ user_id: userId, flow_id: flow.id, phone });
               return;
             }
          } else {
            // First time hitting this node, wait for user input
            console.log("[webhook-zapi] waiting for user input on condition node", { nodeId: node.id });
            await saveFlowState(supabase, userId, phone, flow, captured, currentNodeId, isGroup);
            return;
          }
        }
      }

      // Cleanup state if we found a path
      if (isResumingThisNode || matchedIndex >= 0 || matchedIndex === -1) {
        await supabase.from("flow_captured_data").delete().match({ user_id: userId, flow_id: flow.id, phone });
      }

      const nextEdge = findConditionEdge(edges, currentNodeId, matchedIndex);
      if (nextEdge) {
        console.log("[webhook-zapi] condition route", { nodeId: node.id, matchedIndex, sourceHandle: nextEdge?.sourceHandle, target: nextEdge?.target });
        currentNodeId = nextEdge.target;
        continue;
      } else {
        console.log("[webhook-zapi] no edge found for matchedIndex", matchedIndex);
        break;
      }
    }

    const nextEdge = findDefaultNextEdge(edges, currentNodeId);
    currentNodeId = nextEdge?.target;
    if (currentNodeId) console.log("[webhook-zapi] auto-advancing to next node", currentNodeId);
  }
}

async function sendZapiText(instance: any, phone: string, message: string, buttons?: any[], nodeId?: string, contentType = "text", mediaUrl = "", supabase?: any, userId?: string, flowName?: string, instanceId?: string) {
  const zapiId = instance?.zapi_instance_id;
  const zapiToken = instance?.zapi_token;
  const clientToken = instance?.zapi_client_token;
  if (!zapiId || !zapiToken || !clientToken || !phone) return;

  let url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-text`;
  let body: any = { phone, message };
  if (buttons?.length > 0) {
    url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-button-actions`;
    body = { phone, message, buttonActions: buttons.map((btn, idx) => ({ id: btn.id || `node:${nodeId}:button:${idx}`, type: "REPLY", label: btn.text })) };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": clientToken || "" },
    body: JSON.stringify(body),
  });
  console.log("[webhook-zapi] send message result", { ok: response.ok, status: response.status, phone, contentType, hasMedia: !!mediaUrl });

  if (response.ok && supabase && userId) {
    try {
      const { error } = await supabase.from("message_logs").insert({
        user_id: userId,
        phone,
        response_sent: message,
        instance_id: instanceId || zapiId,
        keyword_matched: "__flow_content__",
        timestamp: new Date().toISOString(),
      });
      if (error) console.warn("[webhook-zapi] failed to log outbound message", error);
    } catch (err) {
      console.warn("[webhook-zapi] failed to log outbound message", err);
    }
  }
}

