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
    console.log("WEBHOOK COMPLETO:", JSON.stringify(webhook));
    console.log("Webhook Z-API:", JSON.stringify(webhook).slice(0, 500));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const isGroup = webhook?.isGroup === true || webhook?.isGroup === "true";
    const participantPhone = webhook?.participantPhone || webhook?.participant || webhook?.senderPhone || webhook?.sender?.phone || "";
    let chatId = webhook?.phone || webhook?.chatPhone || "";

    // Normalize chatId for groups to match frontend expectations (suffix -group)
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

    // Ignore presence webhooks
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
                     type === "ListResponseMessage";
    
    const isButtonResponse = type === "ButtonsResponseMessage" || 
                            type === "ButtonReply" || 
                            type === "ListResponseMessage" || 
                            !!webhook?.buttonsResponseMessage ||
                            !!webhook?.buttonResponseMessage ||
                            !!webhook?.buttonReply ||
                            !!webhook?.listResponseMessage;

    // Extract sender info for group prefixing
    const senderName = webhook?.senderName || webhook?.sender?.name || "";
    const senderPhoto = webhook?.photo || webhook?.sender?.photo || "";
    const senderPhone = participantPhone;

    // Extract message text and fromMe
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
    
    // Z-API can send fromMe as boolean or string
    // IMPORTANT: Button clicks often arrive with fromMe: true, so we must check isButtonResponse
    const fromMe = webhook?.fromMe === true || webhook?.fromMe === "true" || webhook?.fromApi === true || webhook?.fromApi === "true";

    const { data: instanceData } = await supabase
      .from("zapi_instances")
      .select("user_id, zapi_instance_id, zapi_token, zapi_client_token")
      .eq("zapi_instance_id", instanceId)
      .maybeSingle();

    if (!instanceData) return new Response("instance_not_found", { status: 200, headers: corsHeaders });
    const userId = instanceData.user_id;

    const isManualTrigger = webhook?.__manual_flow_trigger__ === true;
    if (isManualTrigger && webhook.flowId) {
      console.log(`Manual flow trigger for phone ${phone}, flow ${webhook.flowId}`);
      const { data: manualFlow } = await supabase
        .from("flow_automations")
        .select("*")
        .eq("id", webhook.flowId)
        .maybeSingle();

      if (manualFlow) {
        const initialNode = manualFlow.nodes?.find((n: any) => n.type === "blocoInicial");
        if (initialNode) {
          await executeFlow(supabase, userId, phone, manualFlow, initialNode.id, {}, instanceData, chatId, isGroup, webhook);
          return new Response("manual_flow_triggered", { status: 200, headers: corsHeaders });
        }
      }
    }

    // If it's a group message from someone else, prefix it with sender info for the UI
    if (isGroup && !fromMe && messageRaw) {
      const senderPrefix = `[sender:${senderName}|${senderPhone}|${senderPhoto}] `;
      if (!messageRaw.startsWith('[sender:')) {
        messageRaw = senderPrefix + messageRaw;
      }
    }

    const cleanMessageForMatch = isGroup && messageRaw.startsWith('[sender:')
      ? messageRaw.replace(/^\[sender:[^\]]*\]\s*/, '')
      : messageRaw;

    // ✅ CORREÇÃO 3: isStatusCallback sem o !!webhook?.status genérico que capturava presença
    const isStatusCallback = type === "DeliveryCallback" || 
                           type === "MessageStatusCallback" || 
                           type === "MessageStatus" ||
                           (!!webhook?.status && !webhook?.text && !webhook?.buttonsResponseMessage && !webhook?.buttonReply && !webhook?.listResponseMessage);

    // Deduplication check (tolerant - won't break if column missing)
    if (messageId) {
      try {
        const { data: existingMessage, error: dedupErr } = await supabase
          .from("message_logs")
          .select("id")
          .eq("message_id", messageId)
          .maybeSingle();
        if (!dedupErr && existingMessage) {
          console.log(`Duplicate message ignored: ${messageId}`);
          return new Response("duplicate", { status: 200, headers: corsHeaders });
        }
      } catch (e) {
        console.warn("Dedup check skipped:", e);
      }
    }

    // 1. Handle delivery/status callbacks first (entregue)
    if (isStatusCallback) {
      const messageIds = webhook?.ids || (webhook?.messageId ? [webhook.messageId] : []);
      const status = webhook?.status || "";
      const error = webhook?.error;
      
      console.log(`Processing StatusCallback for messages ${messageIds.join(',')}: status=${status}`);
      
      // Mark as delivered/sent based on status.
      // SENT: Message reached Z-API/WhatsApp servers.
      // RECEIVED/DELIVERED: Message delivered to the recipient's phone.
      // READ: Recipient read the message.
       const upperStatus = status.toUpperCase();
       const isDeliveredStatus = ["DELIVERED", "RECEIVED", "READ", "READ_BY_ME", "PLAYED"].includes(upperStatus);
       const isSentStatus = ["SENT"].includes(upperStatus);
       const isShadowBanError = error && (
         error.toLowerCase().includes("shadow ban") || 
         error.toLowerCase().includes("restricted") || 
         error.toLowerCase().includes("temporary limit")
       );

      if (messageIds.length > 0 && (isDeliveredStatus || isSentStatus)) {
        for (const msgId of messageIds) {
          const updateData: any = {
            status: isDeliveredStatus ? 'delivered' : 'sent',
            updated_at: new Date().toISOString()
          };
          
          if (isDeliveredStatus) {
            updateData.delivered_at = new Date().toISOString();
          } else {
            updateData.sent_at = new Date().toISOString();
          }

          const { data: campaignSend } = await supabase
            .from("campaign_sends")
            .update(updateData)
            .eq("message_id", msgId)
            .select('id')
            .maybeSingle();
          
          if (campaignSend) {
            console.log(`Updated campaign_send ${campaignSend.id} to ${updateData.status} via message_id ${msgId}`);
          }
        }
       } else if (messageIds.length > 0 && (upperStatus === "ERROR" || error)) {
         for (const msgId of messageIds) {
           const finalErrorMessage = isShadowBanError 
             ? "Shadow Ban detectado: Seu número WhatsApp está com restrições de envio. Evite enviar a mesma mensagem para muitos contatos e tente novamente mais tarde."
             : (error || status);
             
           await supabase
             .from("campaign_sends")
             .update({
               status: 'failed',
               error_message: finalErrorMessage
             })
             .eq("message_id", msgId);
             
           if (isShadowBanError) {
             console.warn(`Shadow ban warning for message ${msgId}: ${finalErrorMessage}`);
           }
         }
       }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const logEntryBase = {
      user_id: userId,
      phone: chatId,
      instance_id: instanceId,
      timestamp: new Date().toISOString()
    };

    // 2. Filter out non-message webhooks or self-messages that shouldn't trigger flows
    if (!phone || !instanceId || !isMessage || (fromMe && !isButtonResponse && !isManualTrigger)) {
        if (isMessage && fromMe && !isButtonResponse) {
          console.log(`Registering self-message for ${chatId}`);
          await supabase.from("message_logs").insert({
            ...logEntryBase,
            message_received: null,
            response_sent: messageRaw,
            keyword_matched: "__manual_send__",
          });
        }
        if (isMessage && fromMe) console.log(`Webhook ignored (Self-message): phone=${phone}`);
        return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const normalizedMessage = normalizeForMatch(messageRaw);

    // 1. CHECK FOR PENDING FLOWS (Captures or Buttons)
    // We use a specific table for flow state to be more reliable than logs
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

    // Se encontrarmos um estado de fluxo, tentamos processar antes de verificar gatilhos globais
    let flowStateHandled = false;

    if (flowState && messageRaw && (!fromMe || isButtonResponse)) {
      console.log(`Resuming flow ${flowState.flow_id} for phone ${phone} at node ${flowState.last_node_id}`);
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

            const { error: upsertError } = await supabase.from("flow_captured_data").upsert({
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

            if (upsertError) console.error("Error upserting flow_captured_data:", upsertError);

            const captureHandle = getCaptureHandle(field);
            const edge = edges.find((e: any) => e.source === lastNodeId && e.sourceHandle === captureHandle);
            if (edge) {
              await executeFlow(supabase, userId, phone, flow, edge.target, captured, instanceData, chatId, isGroup, webhook);
            }
            return new Response("capture_resumed", { status: 200, headers: corsHeaders });
          } else {
            const buttonMatch = findButtonMatch(nodes, edges, lastNodeId, normalizedMessage, webhook);
            if (buttonMatch) {
              flowStateHandled = true;
              await supabase.from("message_logs").insert({
                ...logEntryBase,
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
              ...logEntryBase,
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

      // Se tinha estado de fluxo mas não foi processado (não bateu botão nem captura),
      // não limpe automaticamente respostas de botão: alguns provedores reenviam callbacks
      // antigos/duplicados depois que o fluxo já avançou para o próximo bloco. Limpar aqui
      // apaga o last_node_id novo e deixa o fluxo travado esperando um botão que não existe mais.
      if (!flowStateHandled) {
        if (isButtonResponse) {
          console.log(`Button callback did not match current node ${lastNodeId}; preserving flow state for ${phone}`);
          return new Response("button_no_match_preserved", { status: 200, headers: corsHeaders });
        }

        console.log(`No match for flowState text; keeping state until keyword check for ${phone}`);
      }
    }
    console.log(`Processing message from ${phone} (chatId: ${chatId}): "${messageRaw}"`);
    console.log(`cleanMessageForMatch: "${cleanMessageForMatch}"`);
    
    if (!flowStateHandled && (!fromMe || isButtonResponse)) {
      // 2. CHECK FOR NEW FLOW TRIGGERS (Keywords)
      const { data: flows } = await supabase
        .from("flow_automations")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true);

      console.log(`Found ${flows?.length || 0} active flows for user ${userId}`);
      
      let triggerFound = false;
      for (const flow of (flows || [])) {
        if (triggerFound) break;
        const nodes = flow.nodes || [];
        const triggerNodes = nodes.filter((n: any) => n.type === "blocoGatilho");
        
        let shouldTrigger = false;
        let startNodeId = null;
        
        // Check main flow keywords
        const mainKeywords = (flow.keyword || "").split(",").map((k: string) => k.trim()).filter(Boolean);
        if (mainKeywords.some((k: string) => isKeywordMatch(cleanMessageForMatch, k))) {
          shouldTrigger = true;
          const initialNode = nodes.find((n: any) => n.type === "blocoInicial");
          startNodeId = initialNode?.id;
        }
        
        // Check blocoGatilho keywords
        if (!shouldTrigger && triggerNodes.length > 0) {
          for (const tNode of triggerNodes) {
            const nodeKeyword = tNode.data?.keyword;
            if (nodeKeyword && isKeywordMatch(cleanMessageForMatch, nodeKeyword)) {
              shouldTrigger = true;
              // When triggered by a specific trigger node, we start from the NEXT node connected to it
              const edge = (flow.edges || []).find((e: any) => e.source === tNode.id);
              startNodeId = edge?.target;
              break;
            }
          }
        }

        if (shouldTrigger && startNodeId) {
          triggerFound = true;
          console.log(`Triggering flow ${flow.id} (${flow.name}) for phone ${phone} starting at node ${startNodeId}`);
          
      try {
        // Log the trigger and the response
        await supabase.from("message_logs").insert({
          ...logEntryBase,
          message_received: messageRaw,
          response_sent: `[Fluxo: ${flow.name}]`,
          keyword_matched: `__flow_trigger__:${flow.name}`,
        });
      } catch (logErr) {
        console.error("Error logging flow trigger:", logErr);
      }

      await executeFlow(supabase, userId, phone, flow, startNodeId, {}, instanceData, chatId, isGroup, webhook);
          return new Response("flow_triggered", { status: 200, headers: corsHeaders });
        }
      }
      
      try {
        // If no trigger found, log the message anyway
        await supabase.from("message_logs").insert({
          ...logEntryBase,
          message_received: messageRaw,
        });
      } catch (logErr) {
        console.error("Error logging message receipt:", logErr);
      }
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
      // Suporte para matching por ID (enviado via send-button-actions) ou por texto
      const buttonIdFromWebhook = String(webhook?.buttonReply?.buttonId || 
                                webhook?.buttonsResponseMessage?.buttonId ||
                                webhook?.buttonsResponseMessage?.selectedButtonId ||
                                webhook?.buttonResponseMessage?.buttonId ||
                                webhook?.buttonResponseMessage?.selectedButtonId ||
                                webhook?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                                "");
      const expectedIds = [btn.id, btn.value, `${sourceNodeId}-btn-${i}`, String(i + 1)].filter(Boolean).map(String);
    const isIdMatch = expectedIds.map(String).includes(String(buttonIdFromWebhook));
      const isTextMatch = (normalizedBtnText && message) && (normalizedBtnText === message || message.includes(normalizedBtnText));
      
      if (isIdMatch || isTextMatch) {
        const edge = edges.find(e => String(e.source) === String(sourceNodeId) && (String(e.sourceHandle) === `button-${i}` || String(e.sourceHandle) === String(btn.id)));
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

  for (const edge of edges) {
    const sourceNode = nodes.find(n => String(n.id) === String(edge.source));
    const buttons = sourceNode?.data?.buttons || [];
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const expectedIds = [btn.id, btn.value, `${sourceNode.id}-btn-${i}`, String(i + 1)].filter(Boolean).map(String);
      const isHandleMatch = String(edge.sourceHandle) === `button-${i}` || String(edge.sourceHandle) === String(btn.id);
      const isIdMatch = expectedIds.map(String).includes(String(buttonIdFromWebhook));
      const normalizedBtnText = normalizeForMatch(btn.text);
      const isTextMatch = normalizedBtnText === message || message.includes(normalizedBtnText);
      if (isHandleMatch && (isIdMatch || isTextMatch)) return { targetId: edge.target, text: btn.text };
    }
  }
  return null;
}

async function callAI(systemPrompt: string, userMessage: string, model: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("LOVABLE_API_KEY not found");
    return "Desculpe, estou com problemas técnicos agora (API Key ausente).";
  }

  try {
    console.log(`🤖 Chamando IA Gateway: Modelo=${model}`);
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

  console.log(`🚀 Iniciando executeFlow: node=${nodeId}, phone=${phone}, nodesCount=${nodes.length}`);

  while (currentNodeId && !visited.has(String(currentNodeId))) {
    visited.add(String(currentNodeId));
    const node = nodes.find((n: any) => String(n.id) === String(currentNodeId));
    console.log(`📍 Processando nó: id=${currentNodeId}, type=${node?.type}`);
    
    if (!node) {
      console.log(`❌ Nó ${currentNodeId} não encontrado no fluxo ${flow.id}`);
      break;
    }

    if (node.type === "blocoConteudo" || node.type === "blocoInicial") {
      // Aplicar delay do bloco de conteúdo se existir
      const delaySeconds = Number(node.data.delaySeconds || 0);
      if (delaySeconds > 0) {
        console.log(`⏳ Aguardando delay de ${delaySeconds}s para o bloco ${node.id}`);
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
      
      // Send message via Z-API (with buttons if applicable)
   // Normaliza destino Z-API para grupos
   let destination = (isGroup && (webhook?.phone || webhook?.chatPhone)) ? (webhook?.phone || webhook?.chatPhone) : (chatId || phone);
   if (isGroup || destination.includes('@g.us')) {
     const numericId = destination.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '');
     destination = numericId ? `${numericId}-group` : destination;
   }

      if (!resolvedContent.trim() && !mediaUrl && !hasButtons && !isCapture && node.type === "blocoInicial") {
        const nextEdge = edges.find((e: any) => String(e.source) === String(currentNodeId));
        console.log(`➡️ Bloco inicial sem conteúdo, pulando para o próximo nó: ${nextEdge?.target}`);
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
          last_node_id: node.id,
          captured_data: captured,
          source: isGroup ? "whatsapp_group" : "whatsapp",
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,flow_id,phone" });
        return;
      }
    } else if (node.type === "agenteIA") {
      // Agente IA também pode ter delay
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
      // Suporte para blocos de agendamento e delay de ação
      const actionType = node.data.actionType;
      
      if (actionType === "delay" || node.type === "blocoAcao" && actionType === "delay") {
        const seconds = Number(node.data.delaySeconds ?? node.data.actionConfig ?? 0) || 0;
        if (seconds > 0) {
          console.log(`⏳ Aguardando delay de ação de ${seconds}s`);
          await new Promise(resolve => setTimeout(resolve, Math.min(seconds, 25) * 1000));
        }
      } else if (node.type === "blocoAgendamento" || (node.type === "blocoAcao" && actionType === "schedule")) {
        const scheduledAt = node.data.scheduledAt || node.data.actionConfig;
        if (scheduledAt) {
          const targetDate = new Date(scheduledAt);
          const diffMs = targetDate.getTime() - Date.now();
          if (diffMs > 0) {
            // No Edge Function, limitamos o wait para não dar timeout (max 25s)
            const waitTime = Math.min(diffMs, 25000);
            console.log(`⏳ Aguardando agendamento até ${targetDate.toISOString()} (limitado a 25s)`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    }
    // Find next node (default edge) - be more flexible with handle names
    const nextEdge = edges.find((e: any) => 
      String(e.source) === String(currentNodeId) && 
      (!e.sourceHandle || e.sourceHandle === "default" || e.sourceHandle === "output" || e.sourceHandle.includes("source"))
    );
    
    if (nextEdge) {
      console.log(`➡️ Seguindo para o próximo nó: ${nextEdge.target}`);
    } else {
      console.log(`⏹️ Fim do fluxo ou sem saída padrão para o nó ${currentNodeId}`);
    }
    currentNodeId = nextEdge?.target;
  }
  console.log(`✅ executeFlow finalizado para o nó ${nodeId}`);
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

  console.log(`📤 Enviando mensagem via Z-API: Instância=${zapiId}, Phone=${phone}`);

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
    // Se houver botões, enviamos via send-button-actions para que fiquem clicáveis
    url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-button-actions`;
    body = {
      phone,
      message,
      buttonActions: buttons.map((btn, idx) => ({
        id: btn.id || `${nodeId}-btn-${idx}`,
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

    const responseData = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      console.error(`❌ Erro Z-API (${response.status}):`, JSON.stringify(responseData));
      throw new Error(`Z-API error: ${response.status}`);
    }

    console.log(`✅ Mensagem enviada com sucesso pela instância ${zapiId}`);
    return responseData;
  } catch (error) {
    console.error(`❌ Falha crítica ao enviar via Z-API:`, error);
    throw error;
  }
}
