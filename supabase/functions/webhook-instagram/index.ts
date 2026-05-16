import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = "zaplynx_ig_verify_2024";
const IG_APP_ID = "1629147191696096";
const META_API_VERSION = "v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: extract variables from text
const replaceVars = (txt: string, vars: Record<string, string>) => {
  let result = txt || "";
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp("\\\\{\\\\{" + key + "\\\\\\\\}\\\\}", "g");
    result = result.replace(regex, value || "");
  }
  if (vars.username) result = result.replace(/\{\{nome_usuario\}\}/g, vars.username);
  if (vars.text) result = result.replace(/\{\{comentario\}\}/g, vars.text);
  return result;
};

// Shared URL tracker wrapper for click metrics
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
    return \`${trackBase}?\${params.toString()}\`;
  };
};

// Helper: trigger the official WhatsApp flow engine through webhook-zapi
const triggerOfficialWhatsAppFlow = async (
  flowId: string,
  phone: string,
  instanceId: string,
  fromUsername: string,
) => {
  const selfUrl = \`\${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-zapi\`;
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
    throw new Error(\`webhook-zapi returned \${response.status}: \${text}\`);
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
    const { data } = await supabase.from("zapi_instances").select("*").or(\`id.eq.\${wantedInstance},zapi_instance_id.eq.\${wantedInstance}\`).eq("user_id", userId).eq("is_active", true).maybeSingle();
    zapiCreds = data;
  }
  if (!zapiCreds) {
    const { data } = await supabase.from("zapi_instances").select("*").eq("user_id", userId).eq("is_default", true).maybeSingle();
    zapiCreds = data;
  }
  if (!zapiCreds) return;

  const baseUrl = \`https://api.z-api.io/instances/\${zapiCreds.zapi_instance_id}/token/\${zapiCreds.zapi_token}\`;
  const sendType = nodeData.sendType || "text";
  
  if (sendType === "flow" && nodeData.flowId) {
    await triggerOfficialWhatsAppFlow(nodeData.flowId, cleanPhone, zapiCreds.zapi_instance_id, fromUsername);
    return;
  }

  const message = replaceVars(nodeData.message || "", { username: fromUsername });
  await fetch(\`\${baseUrl}/send-text\`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": zapiCreds.zapi_client_token },
    body: JSON.stringify({ phone: cleanPhone, message }),
  });
};

// Helper: Main Flow Execution Engine
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
        await fetch(\`https://graph.instagram.com/\${META_API_VERSION}/\${context.commentId}/replies\`, {
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
          await fetch(\`https://graph.instagram.com/\${META_API_VERSION}/\${context.igPageId}/messages\`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": \`Bearer \${context.accessToken}\` },
            body: JSON.stringify({ recipient: { id: context.senderId }, message: payload }),
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

      if (body.action === "save_ig_token") {
          // logic for save token
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      if (body.action === "test_follow_flow") {
          const { data: cred } = await supabase.from("meta_credentials").select("*").eq("user_id", body.user_id).eq("app_id", IG_APP_ID).maybeSingle();
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
          const { data: cred } = await supabase.from("meta_credentials").select("*").eq("fb_user_id", igPageId).eq("app_id", IG_APP_ID).eq("connected", true).maybeSingle();
          if (!cred) continue;
          const cleanAccessToken = cred.access_token.replace(/^["']|["']$/g, "").trim();

          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.field === "comments") {
                const comment = change.value;
                const { data: automations } = await supabase.from("instagram_automations").select("*").eq("user_id", cred.user_id).eq("active", true);
                for (const auto of (automations || [])) {
                    // Match and execute flow for comment
                    try {
                        const p = JSON.parse(auto.dm_message || "");
                        if (p.__flow__) await executeFlow({ auto, nodes: p.nodes, edges: p.edges, context: { userId: cred.user_id, igPageId, senderId: comment.from.id, senderUsername: comment.from.username, accessToken: cleanAccessToken, commentId: comment.id, inputText: comment.text, triggerType: "comment" }, supabase });
                    } catch {}
                }
              }
              if (change.field === "mentions") {
                 // handle mentions
              }
              if (change.field === "follow" || change.field === "follows") {
                  const fromId = change.value.from?.id || change.value.id;
                  const fromUsername = change.value.from?.username || change.value.username;
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

          if (entry.messaging) {
            for (const event of entry.messaging) {
               // handle messages and postbacks
               const senderId = event.sender.id;
               const dmText = event.message?.text || "";
               const isStory = !!event.message?.reply_to?.story || !!event.message?.story;
               const { data: automations } = await supabase.from("instagram_automations").select("*").eq("user_id", cred.user_id).eq("active", true);
               for (const auto of (automations || [])) {
                   try {
                       const p = JSON.parse(auto.dm_message || "");
                       if (p.__flow__) await executeFlow({ auto, nodes: p.nodes, edges: p.edges, context: { userId: cred.user_id, igPageId, senderId, senderUsername: event.sender.username || senderId, accessToken: cleanAccessToken, inputText: dmText, triggerType: isStory ? "story_reply" : "dm" }, supabase });
                   } catch {}
               }
            }
          }
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }
  return new Response("Not allowed", { status: 405 });
});
