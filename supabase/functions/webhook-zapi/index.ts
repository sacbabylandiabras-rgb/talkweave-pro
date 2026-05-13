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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const webhook = await req.json();
    console.log("Webhook Z-API:", JSON.stringify(webhook).slice(0, 500));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const phone = webhook?.phone || webhook?.chatPhone || "";
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
    
    // Extract message text and fromMe
    const messageRaw = webhook?.text?.message || 
                      webhook?.message?.text || 
                      webhook?.text || 
                      webhook?.buttonReply?.text || 
                      webhook?.buttonReply?.buttonId ||
                      webhook?.buttonsResponseMessage?.selectedButtonId ||
                      webhook?.buttonsResponseMessage?.buttonText ||
                      webhook?.listResponseMessage?.actionLabel ||
                      "";
    
    // Z-API can send fromMe as boolean or string
    const fromMe = webhook?.fromMe === true || webhook?.fromMe === "true";

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
          await executeFlow(supabase, userId, phone, manualFlow, initialNode.id, {}, instanceData);
          return new Response("manual_flow_triggered", { status: 200, headers: corsHeaders });
        }
      }
    }

    if (!phone || !instanceId || !isMessage || fromMe) {
       // REGISTRA MENSAGEM NO LOG ANTES DE SAIR, MESMO SE FOR SELF-MESSAGE
       if (isMessage) {
         await supabase.from("message_logs").insert({
           user_id: userId,
           phone: phone,
           message_received: messageRaw,
           instance_id: instanceId,
           timestamp: new Date().toISOString()
         });
       }

       if (isMessage && fromMe) {
         console.log(`Webhook ignored (Self-message): phone=${phone}, fromMe=${fromMe}, type=${type}`);
       }
       return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const normalizedMessage = normalizeForMatch(messageRaw);

    // 1. CHECK FOR PENDING FLOWS (Captures or Buttons)
    // We use a specific table for flow state to be more reliable than logs
    const { data: flowState } = await supabase
      .from("flow_captured_data")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", phone)
      .not("last_node_id", "is", null)
      .maybeSingle();

    if (flowState && messageRaw) {
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
        const lastNode = nodes.find((n: any) => n.id === lastNodeId);

        if (lastNode) {
          const isCapture = lastNode.data.collectName || lastNode.data.collectEmail || lastNode.data.collectWhatsapp;
          const field = lastNode.data.collectName ? "nome" : (lastNode.data.collectEmail ? "email" : (lastNode.data.collectWhatsapp ? "whatsapp" : null));

          if (isCapture && field) {
            const captured = flowState.captured_data || {};
            captured[field] = messageRaw;

            await supabase.from("flow_captured_data").update({
              captured_data: captured,
              [field]: messageRaw,
              last_node_id: null,
              updated_at: new Date().toISOString()
            }).eq("id", flowState.id);

            const edge = edges.find((e: any) => e.source === lastNodeId && e.sourceHandle === `collect-${field}`);
            if (edge) {
              await executeFlow(supabase, userId, phone, flow, edge.target, captured, instanceData);
            }
            return new Response("capture_resumed", { status: 200, headers: corsHeaders });
          } else {
            const buttonMatch = findButtonMatch(nodes, edges, lastNodeId, normalizedMessage);
            if (buttonMatch) {
              await supabase.from("flow_captured_data").update({
                last_node_id: null,
                updated_at: new Date().toISOString()
              }).eq("id", flowState.id);
              
              await executeFlow(supabase, userId, phone, flow, buttonMatch.targetId, flowState.captured_data || {}, instanceData);
              return new Response("button_flow_resumed", { status: 200, headers: corsHeaders });
            }
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

    for (const flow of (flows || [])) {
      const keywords = (flow.keyword || "").split(",").map((k: string) => k.trim());
      if (keywords.some((k: string) => isKeywordMatch(messageRaw, k))) {
        const initialNode = flow.nodes?.find((n: any) => n.type === "blocoInicial");
        if (initialNode) {
          await executeFlow(supabase, userId, phone, flow, initialNode.id, {}, instanceData);
          return new Response("flow_triggered", { status: 200, headers: corsHeaders });
        }
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return new Response("error", { status: 200, headers: corsHeaders });
  }
});

function findButtonMatch(nodes: FlowNode[], edges: FlowEdge[], sourceNodeId: string, message: string) {
  const node = nodes.find(n => n.id === sourceNodeId);
  if (!node || !node.data.buttons) return null;

    for (let i = 0; i < node.data.buttons.length; i++) {
      const btn = node.data.buttons[i];
      const normalizedBtnText = normalizeForMatch(btn.text);
      if (normalizedBtnText === message || message.includes(normalizedBtnText)) {
        const edge = edges.find(e => e.source === sourceNodeId && e.sourceHandle === `button-${i}`);
        if (edge) return { targetId: edge.target };
      }
    }
  return null;
}

async function executeFlow(supabase: any, userId: string, phone: string, flow: any, nodeId: string, captured: any, instance: any) {
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  let currentNodeId = nodeId;
  const visited = new Set();

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const node = nodes.find((n: any) => n.id === currentNodeId);
    if (!node) break;

    if (node.type === "blocoConteudo" || node.type === "blocoInicial") {
      const isCapture = node.data.collectName || node.data.collectEmail || node.data.collectWhatsapp;
      const hasButtons = node.data.buttons?.length > 0;
      
      let content = "";
      if (isCapture) {
        content = node.data.collectName ? node.data.namePrompt : (node.data.collectEmail ? node.data.emailPrompt : node.data.whatsappPrompt);
      } else {
        content = node.data.content || "";
      }

      const resolvedContent = replaceVars(content, captured, phone);
      
      // Send message via Z-API (with buttons if applicable)
      await sendZapiText(instance, phone, resolvedContent, node.data.buttons, node.id);

      if (isCapture || hasButtons) {
        await supabase.from("flow_captured_data").upsert({
          user_id: userId,
          flow_id: flow.id,
          phone,
          last_node_id: node.id,
          captured_data: captured,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,flow_id,phone" });
        return;
      }
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

async function sendZapiText(instance: any, phone: string, message: string, buttons?: any[], nodeId?: string) {
  const zapiId = instance.zapi_instance_id;
  const zapiToken = instance.zapi_token;
  const clientToken = instance.zapi_client_token;

  console.log(`📤 Enviando mensagem via Z-API: Instância=${zapiId}, Phone=${phone}`);

  let url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-text`;
  let body: any = { phone, message };

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
