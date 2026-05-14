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
    const phone = (isGroup && participantPhone) 
      ? participantPhone 
      : (webhook?.phone || webhook?.chatPhone || "");
    const chatId = webhook?.phone || webhook?.chatPhone || "";
    const instanceId = webhook?.instanceId || "";
    
    // Ignore status callbacks and other non-message types
    const type = webhook?.type || "";
    const isMessage = !type || 
                     type === "OnMessage" || 
                     type === "MessageCallback" || 
                     type === "OnText" || 
                     type === "ReceivedCallback" ||
                     type === "ButtonsResponseMessage" || 
                     type === "ButtonReply" ||
                     type === "ListResponseMessage";
    
    // Determine if it's a button response to handle fromMe correctly
    const isButtonResponse = type === "ButtonsResponseMessage" || 
                            type === "ButtonReply" || 
                            type === "ListResponseMessage" ||
                            !!webhook?.buttonsResponseMessage ||
                            !!webhook?.buttonResponseMessage ||
                            !!webhook?.buttonReply ||
                            !!webhook?.listResponseMessage;

    // Extract message text and fromMe
    const messageRaw = webhook?.buttonsResponseMessage?.message ||
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

    if (!phone || !instanceId || !isMessage || (fromMe && !isButtonResponse && !isManualTrigger)) {
       // REGISTRA MENSAGEM NO LOG ANTES DE SAIR, MESMO SE FOR SELF-MESSAGE
       if (isMessage && fromMe && !isButtonResponse) {
         await supabase.from("message_logs").insert({
           user_id: userId,
           phone: phone,
           message_received: messageRaw,
           instance_id: instanceId,
           timestamp: new Date().toISOString()
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

    let flowState = participantFlowState?.last_node_id ? participantFlowState : null;
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

      if (sharedGroupFlowState?.last_node_id) {
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
            if (buttonMatch) {
              flowStateHandled = true;
              // REGISTRA CLIQUE DE BOTAO NAS METRICAS
              await supabase.from("message_logs").insert({
                user_id: userId,
                phone: phone,
                message_received: messageRaw,
                instance_id: instanceId,
                keyword_matched: `[Botão: ${buttonMatch.text}]`,
                response_sent: `[Fluxo: ${flow.name}]`,
                timestamp: new Date().toISOString()
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
            // REGISTRA CLIQUE DE BOTAO NAS METRICAS (RECUPERADO)
            await supabase.from("message_logs").insert({
              user_id: userId,
              phone: phone,
              message_received: messageRaw,
              instance_id: instanceId,
              keyword_matched: `[Botão: ${buttonMatch.text}]`,
              response_sent: `[Fluxo: ${flow.name}]`,
              timestamp: new Date().toISOString()
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
    // 2. CHECK FOR NEW FLOW TRIGGERS (Keywords)
    const { data: flows } = await supabase
      .from("flow_automations")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true);

    // REGISTRA MENSAGEM NO LOG
    await supabase.from("message_logs").insert({
      user_id: userId,
      phone: phone,
      message_received: messageRaw,
      instance_id: instanceId,
      timestamp: new Date().toISOString()
    });

    if (!flowStateHandled) {
      for (const flow of (flows || [])) {
        const keywords = (flow.keyword || "").split(",").map((k: string) => k.trim());
        if (keywords.some((k: string) => isKeywordMatch(messageRaw, k))) {
          const initialNode = flow.nodes?.find((n: any) => n.type === "blocoInicial");
          if (initialNode) {
            await executeFlow(supabase, userId, phone, flow, initialNode.id, {}, instanceData, chatId, isGroup, webhook);
            return new Response("flow_triggered", { status: 200, headers: corsHeaders });
          }
        }
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return new Response("error", { status: 200, headers: corsHeaders });
  }
});

function findButtonMatch(nodes: FlowNode[], edges: FlowEdge[], sourceNodeId: string, message: string, webhook: any) {
  const node = nodes.find(n => n.id === sourceNodeId);
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
      const isIdMatch = expectedIds.includes(buttonIdFromWebhook);
      const isTextMatch = normalizedBtnText === message || message.includes(normalizedBtnText);
      
      if (isIdMatch || isTextMatch) {
        const edge = edges.find(e => e.source === sourceNodeId && (e.sourceHandle === `button-${i}` || e.sourceHandle === btn.id));
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
    const sourceNode = nodes.find(n => n.id === edge.source);
    const buttons = sourceNode?.data?.buttons || [];
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const expectedIds = [btn.id, btn.value, `${sourceNode.id}-btn-${i}`, String(i + 1)].filter(Boolean).map(String);
      const isHandleMatch = edge.sourceHandle === `button-${i}` || edge.sourceHandle === btn.id;
      const isIdMatch = expectedIds.includes(buttonIdFromWebhook);
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

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const node = nodes.find((n: any) => n.id === currentNodeId);
    if (!node) break;

    if (node.type === "blocoConteudo" || node.type === "blocoInicial") {
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
      // If we're in a group, we MUST use the group's ID (chatId/phone) as the destination, 
      // not the individual participant's phone number.
      const destination = (isGroup && (webhook?.phone || webhook?.chatPhone)) ? (webhook?.phone || webhook?.chatPhone) : (chatId || phone);

      if (!resolvedContent.trim() && !mediaUrl && !hasButtons && !isCapture) {
        const nextEdge = edges.find((e: any) => e.source === currentNodeId && (!e.sourceHandle || e.sourceHandle === "default"));
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
      
      const destination = (isGroup && (webhook?.phone || webhook?.chatPhone)) ? (webhook?.phone || webhook?.chatPhone) : (chatId || phone);
      await sendZapiText(instance, destination, aiResponse, [], node.id);
    }
    // Find next node (default edge)
    const nextEdge = edges.find((e: any) => e.source === currentNodeId && (!e.sourceHandle || e.sourceHandle === "default"));
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
