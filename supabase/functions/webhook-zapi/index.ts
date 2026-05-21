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
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isKeywordMatch(message: string, keyword: string): boolean {
  const normalizedKeyword = normalizeForMatch(keyword);
  if (!normalizedKeyword || !message) return false;
  const normalizedMessage = normalizeForMatch(message);
  return normalizedMessage.includes(normalizedKeyword);
}

function getCaptureHandle(field: string) {
  if (field === "nome") return "collect-name";
  if (field === "email") return "collect-email";
  if (field === "whatsapp") return "collect-whatsapp";
  return `collect-${field}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const webhook = await req.json();
    console.log("Webhook Z-API:", JSON.stringify(webhook).slice(0, 500));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const isGroup = webhook?.isGroup === true || webhook?.isGroup === "true";
    const participantPhone = webhook?.participantPhone || webhook?.participant || webhook?.senderPhone || webhook?.sender?.phone || "";
    let chatId = webhook?.phone || webhook?.chatPhone || "";

    if (isGroup || chatId.includes('@g.us')) {
      const rawId = chatId.replace(/@g\.us$/i, '').replace(/-group$/i, '');
      if (rawId) {
        chatId = `${rawId}-group`;
      }
    }

    const phone = (isGroup && participantPhone) 
      ? participantPhone 
      : chatId;
    const instanceId = webhook?.instanceId || "";
    
    const type = webhook?.type || webhook?.notification || (webhook?.buttonsResponseMessage || webhook?.buttonReply ? "ButtonsResponseMessage" : "");
    const messageId = webhook?.messageId || (webhook?.ids && webhook.ids[0]) || "";

    if (
      type === "PresenceChatCallback" ||
      type === "PresenceCallback" ||
      type === "ChatPresenceCallback" ||
      webhook?.status === "AVAILABLE" ||
      webhook?.status === "UNAVAILABLE" ||
      webhook?.status === "COMPOSING" ||
      webhook?.status === "RECORDING"
    ) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const isMessage = !type || 
                     type === "OnMessage" || 
                     type === "MessageCallback" || 
                     type === "OnText" || 
                     type === "ReceivedCallback" ||
                     type === "ButtonsResponseMessage" || 
                     type === "ButtonReply" ||
                     type === "ListResponseMessage" ||
                     type === "ImageCallback" ||
                     type === "VideoCallback" ||
                     type === "AudioCallback" ||
                     type === "StickerCallback" ||
                     type === "DocumentCallback";
    
    const isButtonResponse = type === "ButtonsResponseMessage" || 
                            type === "ButtonReply" || 
                            type === "ListResponseMessage" || 
                            !!webhook?.buttonsResponseMessage ||
                            !!webhook?.buttonResponseMessage ||
                            !!webhook?.buttonReply ||
                            !!webhook?.listResponseMessage;

    const senderName = webhook?.senderName || webhook?.sender?.name || "";
    const senderPhoto = webhook?.photo || webhook?.sender?.photo || "";
    const senderPhone = participantPhone;

    let messageRaw = webhook?.buttonsResponseMessage?.message ||
                      webhook?.buttonsResponseMessage?.buttonText ||
                      webhook?.buttonsResponseMessage?.buttonId ||
                      webhook?.buttonResponseMessage?.message ||
                      webhook?.buttonResponseMessage?.buttonText ||
                      webhook?.buttonResponseMessage?.selectedButtonId ||
                      webhook?.buttonReply?.text ||
                      webhook?.buttonReply?.buttonId ||
                      webhook?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                      webhook?.listResponseMessage?.title ||
                      webhook?.listResponseMessage?.actionLabel ||
                      webhook?.listResponseMessage?.description ||
                      webhook?.text?.message || 
                      webhook?.message?.text || 
                      webhook?.text || 
                      webhook?.interactiveResponseMessage?.body ||
                      "";

    // Media Handling for Z-API
    const mediaUrl = webhook?.image?.url || webhook?.video?.url || webhook?.audio?.url || webhook?.sticker?.url || webhook?.document?.url;
    if (mediaUrl) {
      let mediaType = "";
      if (webhook.image) mediaType = "image";
      else if (webhook.video) mediaType = "video";
      else if (webhook.audio) mediaType = "audio";
      else if (webhook.sticker) mediaType = "sticker";
      else if (webhook.document) mediaType = "document";

      if (mediaType) {
        const mediaTag = `[media:${mediaType}:${mediaUrl}]`;
        messageRaw = messageRaw ? `${mediaTag}\n${messageRaw}` : mediaTag;
      }
    }
    
    const fromMe = webhook?.fromMe === true || webhook?.fromMe === "true" || webhook?.fromApi === true || webhook?.fromApi === "true";

    const { data: instanceData } = await supabase
      .from("zapi_instances")
      .select("user_id, zapi_instance_id, zapi_token, zapi_client_token")
      .or(`zapi_instance_id.eq.${instanceId},id.eq.${instanceId}`)
      .maybeSingle();

    const userId = instanceData?.user_id;

    const isStatusCallback = type === "DeliveryCallback" || 
                           type === "MessageStatusCallback" || 
                           type === "MessageStatus" ||
                           (!!webhook?.status && !webhook?.text && !webhook?.buttonsResponseMessage && !webhook?.buttonReply && !webhook?.listResponseMessage);

    if (isStatusCallback) {
      const messageIds = webhook?.ids || (webhook?.messageId ? [webhook.messageId] : []);
      let status = webhook?.status || "";
      const error = webhook?.error;
      
      if (!status && type === "DeliveryCallback") {
        status = "DELIVERED";
      }

      console.log(`Processing StatusCallback for messages ${messageIds.join(',')}: status=${status} (type=${type})`);
      
      const upperStatus = status.toUpperCase();
      const isDeliveredStatus = ["DELIVERED", "RECEIVED", "READ", "READ_BY_ME", "PLAYED"].includes(upperStatus);
      const isSentStatus = ["SENT", "SENT_BY_ME"].includes(upperStatus);
      const isShadowBanError = error && (
        error.toLowerCase().includes("shadow ban") || 
        error.toLowerCase().includes("restricted") || 
        error.toLowerCase().includes("temporary limit")
      );

      if (messageIds.length > 0 && (isDeliveredStatus || isSentStatus)) {
        for (const msgId of messageIds) {
          const newStatusLabel = isDeliveredStatus ? 'delivered' : 'sent';
          
          const { data: currentRecord, error: fetchError } = await supabase
            .from("campaign_sends")
            .select("status, id")
            .eq("message_id", msgId)
            .maybeSingle();

          if (fetchError) {
            console.error(`❌ Error fetching campaign_send ${msgId}:`, fetchError.message);
            continue;
          }

          if (currentRecord) {
            if (currentRecord.status === 'delivered') {
              console.log(`✅ Message ${msgId} is already delivered. Skipping update to ${newStatusLabel}.`);
              continue;
            }

            const updateData: any = {
              status: newStatusLabel
            };
            
            if (isDeliveredStatus) {
              updateData.delivered_at = new Date().toISOString();
            } else {
              updateData.sent_at = new Date().toISOString();
            }

            const { data: updated, error: updateError } = await supabase
              .from("campaign_sends")
              .update(updateData)
              .eq("id", currentRecord.id)
              .select('id')
              .maybeSingle();
            
            if (updateError) {
              console.error(`❌ Error updating campaign_send ${currentRecord.id}:`, updateError.message);
            } else if (updated) {
              console.log(`✨ Updated campaign_send ${updated.id} to ${newStatusLabel} via message_id ${msgId}`);
            }
          } else {
            console.log(`🔍 No campaign_send found with message_id ${msgId}`);
          }
        }
      } else if (messageIds.length > 0 && (upperStatus === "ERROR" || error)) {
        for (const msgId of messageIds) {
          const finalErrorMessage = isShadowBanError 
            ? "Shadow Ban detectado: Seu número WhatsApp está com restrições de envio."
            : (error || status);
            
          await supabase
            .from("campaign_sends")
            .update({
              status: 'failed',
              error_message: finalErrorMessage
            })
            .eq("message_id", msgId);
        }
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (!phone || !instanceId || !isMessage || (fromMe && !isButtonResponse && !webhook?.__manual_flow_trigger__)) {
        if (isMessage && fromMe && !isButtonResponse && userId) {
          await supabase.from("message_logs").insert({
            user_id: userId,
            phone: chatId,
            instance_id: instanceId,
            timestamp: new Date().toISOString(),
            message_received: null,
            response_sent: messageRaw,
            keyword_matched: "__manual_send__",
          });
        }
        return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const normalizedMessage = normalizeForMatch(messageRaw);

    const { data: participantFlowState } = await supabase
      .from("flow_captured_data")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", phone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let flowState = participantFlowState?.last_node_id
      ? participantFlowState
      : (isButtonResponse && participantFlowState?.flow_id ? participantFlowState : null);
    let flowStateIsSharedGroup = false;

    if (!flowState && isGroup && chatId && chatId !== phone) {
      const { data: sharedGroupFlowState } = await supabase
        .from("flow_captured_data")
        .select("*")
        .eq("user_id", userId)
        .eq("phone", chatId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sharedGroupFlowState?.last_node_id || (isButtonResponse && sharedGroupFlowState?.flow_id)) {
        const { data: existingParticipantState } = await supabase
          .from("flow_captured_data")
          .select("id")
          .eq("user_id", userId)
          .eq("flow_id", sharedGroupFlowState.flow_id)
          .eq("phone", phone)
          .maybeSingle();

        flowState = existingParticipantState ? null : sharedGroupFlowState;
        flowStateIsSharedGroup = !!flowState;
      }
    }

    let flowStateHandled = false;

    if (flowState && messageRaw && (!fromMe || isButtonResponse)) {
      const flowId = flowState.flow_id;
      const lastNodeId = flowState.last_node_id;

      const { data: flow } = await supabase
        .from("flow_automations")
        .select("*")
        .eq("id", flowId)
        .maybeSingle();

      if (flow) {
        const nodes = flow.nodes || [];
        const edges = flow.edges || [];
        const lastNode = lastNodeId ? nodes.find((n: any) => n.id === lastNodeId) : null;

        if (lastNode) {
          const isCapture = lastNode.data.collectName || lastNode.data.collectEmail || lastNode.data.collectWhatsapp || lastNode.data.collectCPF;
          const field = lastNode.data.collectName ? "nome" : (lastNode.data.collectEmail ? "email" : (lastNode.data.collectWhatsapp ? "whatsapp" : (lastNode.data.collectCPF ? "cpf" : null)));

          if (isCapture && field) {
            flowStateHandled = true;
            const captured = { ...(flowState.captured_data || {}) };
            captured[field] = messageRaw;

            await supabase.from("flow_captured_data").upsert({
              user_id: userId,
              flow_id: flowId,
              flow_name: flow.name,
              phone,
              captured_data: captured,
              [field]: messageRaw,
              last_node_id: null,
              source: isGroup ? "whatsapp_group" : "whatsapp",
              updated_at: new Date().toISOString()
            }, { onConflict: "user_id,flow_id,phone" });

            const captureHandle = getCaptureHandle(field);
            const edge = edges.find((e: any) => e.source === lastNodeId && e.sourceHandle === captureHandle);
            if (edge) {
              await executeFlow(supabase, userId, phone, flow, edge.target, captured, instanceData, chatId, isGroup, webhook);
            }
            return new Response("capture_resumed", { status: 200, headers: corsHeaders });
          } else {
            const buttonMatch = findButtonMatch(nodes, edges, lastNodeId, normalizedMessage, webhook);
            console.log("Button match result:", JSON.stringify(buttonMatch));
            if (buttonMatch) {
              flowStateHandled = true;
              await supabase.from("message_logs").insert({
                user_id: userId,
                phone: chatId,
                instance_id: instanceId,
                timestamp: new Date().toISOString(),
                message_received: messageRaw,
                keyword_matched: `[Botão: ${buttonMatch.text}]`,
                response_sent: `[Fluxo: ${flow.name}]`,
              });

              await executeFlow(supabase, userId, phone, flow, buttonMatch.targetId, flowState.captured_data || {}, instanceData, chatId, isGroup, webhook);

              if (!flowStateIsSharedGroup) {
                await supabase.from("flow_captured_data").update({
                  last_node_id: null,
                  updated_at: new Date().toISOString()
                }).eq("id", flowState.id).eq("last_node_id", lastNodeId);
              }

              return new Response("button_flow_resumed", { status: 200, headers: corsHeaders });
            }
          }
        } else if (isButtonResponse) {
          const buttonMatch = findAnyButtonMatch(nodes, edges, normalizedMessage, webhook);
          if (buttonMatch) {
            flowStateHandled = true;
            await supabase.from("message_logs").insert({
              user_id: userId,
              phone: chatId,
              instance_id: instanceId,
              timestamp: new Date().toISOString(),
              message_received: messageRaw,
              keyword_matched: `[Botão: ${buttonMatch.text}]`,
              response_sent: `[Fluxo: ${flow.name}]`,
            });

            await executeFlow(supabase, userId, phone, flow, buttonMatch.targetId, flowState.captured_data || {}, instanceData, chatId, isGroup, webhook);
            if (!flowStateIsSharedGroup) {
              await supabase.from("flow_captured_data").update({
                last_node_id: null,
                updated_at: new Date().toISOString()
              }).eq("id", flowState.id);
            }
            return new Response("button_flow_recovered", { status: 200, headers: corsHeaders });
          }
        }
      }
    }
    
    if (!flowStateHandled && (!fromMe || isButtonResponse)) {
      const { data: flows } = await supabase
        .from("flow_automations")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true);
      
      let triggerFound = false;
      const normalizedMessage = normalizeForMatch(messageRaw);

      for (const flow of (flows || [])) {
        if (triggerFound) break;
        
        // Skip flow if it's explicitly disabled for groups and the message is from a group
        if (isGroup && (flow as any).disable_in_groups === true) {
          continue;
        }

        const nodes = flow.nodes || [];
        const triggerNodes = nodes.filter((n: any) => n.type === "blocoGatilho");
        
        let shouldTrigger = false;
        let startNodeId = null;
        let matchedKeyword = "";
        
        const mainKeywords = (flow.keyword || "").split(",").map((k: string) => k.trim()).filter(Boolean);
        const matchedMain = mainKeywords.find((k: string) => isKeywordMatch(normalizedMessage, k));
        if (matchedMain) {
          shouldTrigger = true;
          matchedKeyword = matchedMain;
          const initialNode = nodes.find((n: any) => n.type === "blocoInicial");
          startNodeId = initialNode?.id;
        }
        
        if (!shouldTrigger && triggerNodes.length > 0) {
          for (const tNode of triggerNodes) {
            const nodeKeyword = tNode.data?.keyword;
            if (nodeKeyword && isKeywordMatch(normalizedMessage, nodeKeyword)) {
              shouldTrigger = true;
              matchedKeyword = nodeKeyword;
              const edge = (flow.edges || []).find((e: any) => e.source === tNode.id);
              startNodeId = edge?.target;
              break;
            }
          }
        }

        if (shouldTrigger && startNodeId) {
          // If the message is from a group, additional checks are needed
          if (isGroup) {
            // 1. If it's a mention-based trigger, ensure the bot was mentioned
            const botNumber = instanceData?.zapi_instance_id; // Simple heuristic
            const wasMentioned = messageRaw.includes(`@${botNumber}`) || 
                                 (webhook?.isMentioned === true || webhook?.isMentioned === "true");
            
            // 2. If it's a regular keyword, we might want to be more restrictive
            // For now, let's allow it but ensure we don't trigger on every word
            if (!wasMentioned && normalizedMessage.split(' ').length > 5) {
               // If it's a long message and no mention, it's likely a conversation, not a command
               continue;
            }
          }

          triggerFound = true;
          
          // CRITICAL: Prevent double trigger by checking for messageId or recent trigger
          const triggerKey = `__flow_trigger__:${flow.id}:${messageId || normalizedMessage}`;
          
          const { data: recentTrigger } = await supabase
            .from("message_logs")
            .select("id")
            .eq("user_id", userId)
            .eq("phone", chatId)
            .eq("keyword_matched", triggerKey)
            .gte("timestamp", new Date(Date.now() - 5000).toISOString())
            .maybeSingle();

          if (recentTrigger) {
            console.log(`[FlowTrigger] Duplicated trigger detected for flow ${flow.name} (Key: ${triggerKey}). Skipping.`);
            return new Response("flow_triggered_duplicate", { status: 200, headers: corsHeaders });
          }

          await supabase.from("message_logs").insert({
            user_id: userId,
            phone: chatId,
            instance_id: instanceId,
            timestamp: new Date().toISOString(),
            message_received: messageRaw,
            response_sent: `[Fluxo: ${flow.name}]`,
            keyword_matched: triggerKey,
          });

          await executeFlow(supabase, userId, phone, flow, startNodeId, {}, instanceData, chatId, isGroup, webhook);
          return new Response("flow_triggered", { status: 200, headers: corsHeaders });
        }
      }
      
      await supabase.from("message_logs").insert({
        user_id: userId,
        phone: chatId,
        instance_id: instanceId,
        timestamp: new Date().toISOString(),
        message_received: messageRaw,
      });
    }
    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return new Response("error", { status: 200, headers: corsHeaders });
  }
});

function findButtonMatch(nodes: FlowNode[], edges: FlowEdge[], sourceNodeId: string, message: string, webhook: any) {
  const node = nodes.find(n => String(n.id) === String(sourceNodeId));
  if (!node || !node.data.buttons) return null;

    for (let i = 0; i < node.data.buttons.length; i++) {
      const btn = node.data.buttons[i];
      const normalizedBtnText = normalizeForMatch(btn.text);
      const buttonIdFromWebhook = String(webhook?.buttonReply?.buttonId || 
                                webhook?.buttonsResponseMessage?.buttonId ||
                                webhook?.buttonsResponseMessage?.selectedButtonId ||
                                webhook?.buttonResponseMessage?.buttonId ||
                                webhook?.buttonResponseMessage?.selectedButtonId ||
                                webhook?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                                "");
      const expectedIds = [btn.id, btn.value, `${sourceNodeId}-btn-${i}`, String(i + 1), `node:${sourceNodeId}:button:${i}`].filter(Boolean).map(String);
      console.log(`Checking button ${i} (${btn.text}): expectedIds=${expectedIds.join(',')}, receivedId=${buttonIdFromWebhook}, msg=${message}`);
      const isIdMatch = expectedIds.map(String).includes(String(buttonIdFromWebhook));
      const isTextMatch = (normalizedBtnText && message) && (normalizedBtnText === message || message.includes(normalizedBtnText));
      
      if (isIdMatch || isTextMatch) {
        const edge = edges.find(e => String(e.source) === String(sourceNodeId) && (String(e.sourceHandle) === `button-${i}` || String(e.sourceHandle) === String(btn.id) || String(e.sourceHandle) === `node:${sourceNodeId}:button:${i}`));
        if (edge) return { targetId: edge.target, text: btn.text };
      }
    }
  return null;
}

function findAnyButtonMatch(nodes: FlowNode[], edges: FlowEdge[], message: string, webhook: any) {
  const buttonIdFromWebhook = String(webhook?.buttonReply?.buttonId || 
                            webhook?.buttonsResponseMessage?.buttonId ||
                            webhook?.buttonsResponseMessage?.selectedButtonId ||
                            webhook?.buttonResponseMessage?.buttonId ||
                            webhook?.buttonResponseMessage?.selectedButtonId ||
                            webhook?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                            "");

  console.log(`[findAnyButtonMatch] Searching match for id="${buttonIdFromWebhook}" message="${message}"`);

  for (const edge of edges) {
    const sourceNode = nodes.find(n => String(n.id) === String(edge.source));
    if (!sourceNode) continue;
    
    const buttons = sourceNode?.data?.buttons || [];
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const expectedIds = [
        btn.id, 
        btn.value, 
        `${sourceNode.id}-btn-${i}`, 
        String(i + 1), 
        `node:${sourceNode.id}:button:${i}`
      ].filter(Boolean).map(String);
      
      const isHandleMatch = String(edge.sourceHandle) === `button-${i}` || String(edge.sourceHandle) === String(btn.id) || String(edge.sourceHandle) === `node:${sourceNode.id}:button:${i}`;
      const isIdMatch = expectedIds.map(String).includes(String(buttonIdFromWebhook));
      const normalizedBtnText = normalizeForMatch(btn.text);
      const isTextMatch = normalizedBtnText === message || (message && message.includes(normalizedBtnText));
      
      if (isHandleMatch && (isIdMatch || isTextMatch)) {
        console.log(`[findAnyButtonMatch] ✅ Match found! Node=${sourceNode.id} Button=${btn.text} Target=${edge.target}`);
        return { targetId: edge.target, text: btn.text };
      }
    }
  }
  console.log(`[findAnyButtonMatch] ❌ No match found in ${edges.length} edges`);
  return null;
}

async function callAI(systemPrompt: string, userMessage: string, model: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("LOVABLE_API_KEY not found");
    return "Desculpe, estou com problemas técnicos agora (API Key ausente).";
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage || "Olá" }
        ],
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("Erro na IA:", data.error);
      return "Desculpe, tive um erro ao processar sua resposta com IA.";
    }
    return data.choices?.[0]?.message?.content || "Não consegui gerar uma resposta.";
  } catch (error) {
    console.error("Error calling AI Gateway:", error);
    return "Erro ao processar sua solicitação com IA.";
  }
}

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
      const delaySeconds = Number(node.data.delaySeconds || 0);
      if (delaySeconds > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(delaySeconds, 25) * 1000));
      }

      const isCapture = node.data.collectName || node.data.collectEmail || node.data.collectWhatsapp || node.data.collectCPF;
      const hasButtons = node.data.buttons?.length > 0;
      
      let content = "";
      if (isCapture) {
        if (node.data.collectName) content = node.data.namePrompt;
        else if (node.data.collectEmail) content = node.data.emailPrompt;
        else if (node.data.collectWhatsapp) content = node.data.whatsappPrompt;
        else if (node.data.collectCPF) content = node.data.cpfPrompt;
      } else {
        content = node.data.content || "";
      }

      const resolvedContent = replaceVars(content, captured, phone);
      const contentType = node.data.contentType || "text";
      const mediaUrl = node.data.mediaUrl || "";
      
      let destination = (isGroup && (webhook?.phone || webhook?.chatPhone)) ? (webhook?.phone || webhook?.chatPhone) : (chatId || phone);
      if (isGroup || destination.includes('@g.us')) {
        const numericId = destination.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '');
        destination = numericId ? `${numericId}-group` : destination;
      }

      if (!resolvedContent.trim() && !mediaUrl && !hasButtons && !isCapture && node.type === "blocoInicial") {
        const nextEdge = edges.find((e: any) => String(e.source) === String(currentNodeId));
        currentNodeId = nextEdge?.target;
        continue;
      }

      await sendZapiText(instance, destination, resolvedContent, node.data.buttons, node.id, contentType, mediaUrl);

      if (isCapture || hasButtons) {
        await supabase.from("flow_captured_data").upsert({
          user_id: userId,
          flow_id: flow.id,
          flow_name: flow.name,
          phone,
          captured_data: captured,
          last_node_id: node.id,
          source: isGroup ? "whatsapp_group" : "whatsapp",
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,flow_id,phone" });
        return;
      }
    } else if (node.type === "agenteIA") {
      const delaySeconds = Number(node.data.delaySeconds || 0);
      if (delaySeconds > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(delaySeconds, 25) * 1000));
      }

      const prompt = node.data.prompt || "Você é um assistente virtual prestativo.";
      const model = "anthropic/claude-3-5-sonnet";
      
      const userMessage = webhook?.buttonsResponseMessage?.message ||
                        webhook?.buttonResponseMessage?.message ||
                        webhook?.buttonReply?.text ||
                        webhook?.text?.message || 
                        webhook?.message?.text || 
                        webhook?.text || 
                        "";

      const resolvedPrompt = replaceVars(prompt, captured, phone);
      const aiResponse = await callAI(resolvedPrompt, userMessage, model);
      
      let aiDestination = (isGroup && (webhook?.phone || webhook?.chatPhone)) ? (webhook?.phone || webhook?.chatPhone) : (chatId || phone);
      if (isGroup || aiDestination.includes('@g.us')) {
        const numericId = aiDestination.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '');
        aiDestination = numericId ? `${numericId}-group` : aiDestination;
      }
      await sendZapiText(instance, aiDestination, aiResponse, [], node.id);
    } else if (node.type === "blocoAgendamento" || node.type === "blocoAcao") {
      const actionType = node.data.actionType;
      
      if (actionType === "delay" || node.type === "blocoAcao" && actionType === "delay") {
        const seconds = Number(node.data.delaySeconds ?? node.data.actionConfig ?? 0) || 0;
        if (seconds > 0) {
          await new Promise(resolve => setTimeout(resolve, Math.min(seconds, 25) * 1000));
        }
      } else if (node.type === "blocoAgendamento" || (node.type === "blocoAcao" && actionType === "schedule")) {
        const scheduledAt = node.data.scheduledAt || node.data.actionConfig;
        if (scheduledAt) {
          const targetDate = new Date(scheduledAt);
          const diffMs = targetDate.getTime() - Date.now();
          if (diffMs > 0) {
            const waitTime = Math.min(diffMs, 25000);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    }
    const nextEdge = edges.find((e: any) => 
      String(e.source) === String(currentNodeId) && 
      (!e.sourceHandle || e.sourceHandle === "default" || e.sourceHandle === "output" || e.sourceHandle.includes("source"))
    );
    
    currentNodeId = nextEdge?.target;
  }
}

function replaceVars(text: string, captured: any, phone: string) {
  return text
    .replace(/\{\{nome\}\}/gi, captured.nome || "")
    .replace(/\{\{whatsapp\}\}/gi, captured.whatsapp || phone)
    .replace(/\{\{email\}\}/gi, captured.email || "");
}

async function sendZapiText(instance: any, phone: string, message: string, buttons?: any[], nodeId?: string, contentType = "text", mediaUrl = "") {
  const zapiId = instance.zapi_instance_id;
  const zapiToken = instance.zapi_token;
  const clientToken = instance.zapi_client_token;

  let url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-text`;
  let body: any = { phone, message };

  const normalizedType = String(contentType || "text").toLowerCase();
  if (mediaUrl && !buttons?.length) {
    if (normalizedType === "image") {
      url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-image`;
      body = { phone, image: mediaUrl, caption: message || "" };
    } else if (normalizedType === "video") {
      url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-video`;
      body = { phone, video: mediaUrl, caption: message || "" };
    } else if (normalizedType === "audio") {
      url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-audio`;
      body = { phone, audio: mediaUrl, waveform: true };
    } else if (normalizedType === "document") {
      const cleanUrl = String(mediaUrl).split("?")[0].split("#")[0];
      const ext = cleanUrl.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-document/${ext}`;
      body = { phone, document: mediaUrl, fileName: message || `arquivo.${ext}` };
    }
  }

  if (buttons && buttons.length > 0) {
    url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-button-actions`;
    body = {
      phone,
      message,
      buttonActions: buttons.map((btn, idx) => ({
        id: btn.id || `node:${nodeId}:button:${idx}`,
        type: btn.type === "url" ? "URL" : (btn.type === "call" ? "CALL" : "REPLY"),
        label: btn.text,
        url: btn.type === "url" ? btn.value : undefined,
        phone: btn.type === "call" ? btn.value : undefined
      }))
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Client-Token": clientToken || "" 
      },
      body: JSON.stringify(body)
    });

    return await response.json().catch(() => ({}));
  } catch (error) {
    console.error(`❌ Falha crítica ao enviar via Z-API:`, error);
    throw error;
  }
}
