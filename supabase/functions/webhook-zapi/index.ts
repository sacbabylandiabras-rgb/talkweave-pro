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
    
    // Extract message text from various Z-API fields
    const messageRaw = webhook?.text?.message || 
                     webhook?.message?.text || 
                     webhook?.text || 
                     webhook?.buttonReply?.text ||
                     webhook?.buttonsResponseMessage?.selectedButtonId ||
                     "";

    if (!phone || !instanceId) {
       return new Response("missing_data", { status: 200, headers: corsHeaders });
    }

    const { data: instanceData } = await supabase
      .from("zapi_instances")
      .select("user_id, zapi_token, zapi_client_token")
      .eq("zapi_instance_id", instanceId)
      .maybeSingle();

    if (!instanceData) return new Response("instance_not_found", { status: 200, headers: corsHeaders });

    const userId = instanceData.user_id;
    const normalizedMessage = normalizeForMatch(messageRaw);

    // 1. CHECK FOR PENDING FLOWS (Buttons or Captures)
    const { data: pendingFlowLog } = await supabase
      .from("message_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", phone)
      .or(`keyword_matched.eq.${FLOW_CAPTURE_PREFIX}${userId},keyword_matched.like.${FLOW_BUTTON_PREFIX}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingFlowLog && messageRaw) {
      const isCapture = pendingFlowLog.keyword_matched.startsWith(FLOW_CAPTURE_PREFIX);
      const pendingState = JSON.parse(pendingFlowLog.response_sent || "{}");
      const flowId = pendingState.flowId;

      const { data: flow } = await supabase
        .from("flow_automations")
        .select("*")
        .eq("id", flowId)
        .maybeSingle();

      if (flow) {
        const nodes = flow.nodes || [];
        const edges = flow.edges || [];

        if (isCapture) {
          // Process capture
          const captured = pendingState.captured || {};
          captured[pendingState.field] = messageRaw;
          
          await supabase.from("message_logs").delete().eq("id", pendingFlowLog.id);
          await supabase.from("flow_captured_data").upsert({
            user_id: userId,
            flow_id: flowId,
            phone,
            [pendingState.field]: messageRaw,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id,flow_id,phone" });

          // Find next node from capture handle
          const edge = edges.find((e: any) => e.source === pendingState.nodeId && e.sourceHandle === `collect-${pendingState.field}`);
          if (edge) {
            await executeFlow(supabase, userId, phone, flow, edge.target, captured, instanceData);
          }
          return new Response("capture_resumed", { status: 200, headers: corsHeaders });
        } else {
          // Process button click
          const buttonMatch = findButtonMatch(nodes, edges, pendingState.nodeId, normalizedMessage);
          if (buttonMatch) {
            await supabase.from("message_logs").delete().eq("id", pendingFlowLog.id);
            await executeFlow(supabase, userId, phone, flow, buttonMatch.targetId, pendingState.captured || {}, instanceData);
            return new Response("button_flow_resumed", { status: 200, headers: corsHeaders });
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
    if (normalizeForMatch(btn.text) === message) {
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

    if (node.type === "blocoConteudo") {
      const content = replaceVars(node.data.content || "", captured, phone);
      
      // Send message via Z-API
      await sendZapiText(instance, phone, content, node.data.buttons);

      const isCapture = node.data.collectName || node.data.collectEmail || node.data.collectWhatsapp;
      const hasButtons = node.data.buttons?.length > 0;

      if (isCapture || hasButtons) {
        // Pause and wait for user response
        const field = node.data.collectName ? "nome" : node.data.collectEmail ? "email" : "whatsapp";
        const keyword = isCapture ? `${FLOW_CAPTURE_PREFIX}${userId}` : `${FLOW_BUTTON_PREFIX}${userId}:${node.id}`;
        
        await supabase.from("message_logs").insert({
          user_id: userId,
          phone,
          message_received: null,
          response_sent: JSON.stringify({ flowId: flow.id, nodeId: node.id, field, captured }),
          keyword_matched: keyword,
          instance_id: instance.zapi_instance_id
        });
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

async function sendZapiText(instance: any, phone: string, message: string, buttons?: any[]) {
  const url = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/send-text`;
  const body: any = { phone, message };
  
  if (buttons && buttons.length > 0) {
    // Basic button support for Z-API if needed, otherwise just text
  }

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": instance.zapi_client_token || "" },
    body: JSON.stringify(body)
  });
}
