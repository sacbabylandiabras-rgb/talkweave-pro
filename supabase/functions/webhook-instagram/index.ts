import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = "zaplynx_ig_verify_2024";
const IG_APP_ID_DEFAULT = '1629147191696096';

const META_API_VERSION = "v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isInstagramLoginToken = (accessToken: string) => accessToken.trim().startsWith("IGA");

const getInstagramGraphBaseUrl = (accessToken: string) =>
  isInstagramLoginToken(accessToken) ? "https://graph.instagram.com" : "https://graph.facebook.com";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const COMMON_EMAIL_DOMAINS = new Set(["gmail", "hotmail", "outlook", "yahoo", "icloud", "live", "msn"]);

const normalizeEmailInput = (value: string) => {
  const email = String(value || "").trim().replace(/\s+/g, "").toLowerCase();
  if (!email.includes("@")) return email;

  const [local, domain = ""] = email.split("@");
  if (!local || !domain) return email;

  // Common Instagram DM typo: user sends "nome@gmail" instead of "nome@gmail.com".
  if (!domain.includes(".") && COMMON_EMAIL_DOMAINS.has(domain)) {
    return `${local}@${domain}.com`;
  }

  return email;
};

const DEFAULT_EMAIL_CSS_VARS: Record<string, string> = {
  "--color-background-secondary": "#f8fafc",
  "--color-background-primary": "#ffffff",
  "--color-border-tertiary": "#e2e8f0",
  "--color-text-primary": "#0A0F1E",
  "--color-text-secondary": "#475569",
  "--border-radius-lg": "18px",
  "--border-radius-md": "12px",
};

const normalizeCssValue = (value: string, vars: Record<string, string>) =>
  String(value || "")
    .replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^\)]+))?\)/g, (_match, name, fallback) => {
      return vars[name] || String(fallback || "").trim();
    })
    .replace(/(-?\d*\.?\d+)rem\b/g, (_match, amount) => `${Math.round(Number(amount) * 16 * 100) / 100}px`);

const appendCss = (map: Map<string, string>, key: string, value: string) => {
  const clean = value.trim().replace(/;+$/g, "");
  if (!clean) return;
  map.set(key, [map.get(key), clean].filter(Boolean).join(";"));
};

const sanitizeCssBlock = (declarations: string, vars: Record<string, string>) =>
  String(declarations || "")
    .split(";")
    .map((part) => {
      const idx = part.indexOf(":");
      if (idx < 0) return "";
      const prop = part.slice(0, idx).trim();
      const value = normalizeCssValue(part.slice(idx + 1).trim(), vars);
      if (!prop || !value) return "";
      return `${prop}:${value}`;
    })
    .filter(Boolean)
    .join(";");

const inlineEmailCss = (html: string) => {
  const input = String(html || "");
  const styleBlocks = Array.from(input.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)).map((m) => m[1]);
  if (!styleBlocks.length) return input;

  const vars = { ...DEFAULT_EMAIL_CSS_VARS };
  const css = styleBlocks.join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  const tagStyles = new Map<string, string>();
  const classStyles = new Map<string, string>();
  const idStyles = new Map<string, string>();

  appendCss(classStyles, "sr-only", "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0");

  let match: RegExpExecArray | null;
  while ((match = ruleRegex.exec(css))) {
    const selectors = match[1].split(",").map((s) => s.trim()).filter(Boolean);
    const block = sanitizeCssBlock(match[2], vars);
    if (!block) continue;

    for (const selector of selectors) {
      if (selector === ":root") {
        for (const declaration of match[2].split(";")) {
          const idx = declaration.indexOf(":");
          const name = declaration.slice(0, idx).trim();
          const value = declaration.slice(idx + 1).trim();
          if (idx > 0 && name.startsWith("--") && value) vars[name] = value;
        }
        continue;
      }

      const simple = selector.replace(/\s+/g, " ").trim();
      if (simple.startsWith("@") || /[>+~:\[]/.test(simple)) continue;

      const descendantTag = simple.match(/^(?:\.[\w-]+|#[\w-]+)\s+([a-z][\w-]*)$/i);
      if (descendantTag) {
        appendCss(tagStyles, descendantTag[1].toLowerCase(), block);
        continue;
      }

      const classMatch = simple.match(/^\.([\w-]+)$/);
      if (classMatch) {
        appendCss(classStyles, classMatch[1], block);
        continue;
      }

      const idMatch = simple.match(/^#([\w-]+)$/);
      if (idMatch) {
        appendCss(idStyles, idMatch[1], block);
        continue;
      }

      if (/^[a-z][\w-]*$/i.test(simple)) {
        appendCss(tagStyles, simple.toLowerCase(), block);
      }
    }
  }

  const withoutStyles = input.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  return withoutStyles.replace(/<([a-zA-Z][\w:-]*)([^<>]*?)>/g, (full, tagName, attrs = "") => {
    const tag = String(tagName).toLowerCase();
    const id = String(attrs).match(/\sid=(['"])(.*?)\1/i)?.[2] || "";
    const classAttr = String(attrs).match(/\sclass=(['"])(.*?)\1/i)?.[2] || "";
    const existingStyle = String(attrs).match(/\sstyle=(['"])([\s\S]*?)\1/i)?.[2] || "";
    const collected: string[] = [];

    if (tagStyles.has(tag)) collected.push(tagStyles.get(tag)!);
    if (id && idStyles.has(id)) collected.push(idStyles.get(id)!);
    for (const className of classAttr.split(/\s+/).filter(Boolean)) {
      if (classStyles.has(className)) collected.push(classStyles.get(className)!);
    }

    if (!collected.length) return full;
    const mergedStyle = [...collected, existingStyle].filter(Boolean).join(";").replace(/;{2,}/g, ";").replace(/"/g, "&quot;");
    const nextAttrs = /\sstyle=(['"])[\s\S]*?\1/i.test(String(attrs))
      ? String(attrs).replace(/\sstyle=(['"])[\s\S]*?\1/i, ` style="${mergedStyle}"`)
      : `${attrs} style="${mergedStyle}"`;
    return `<${tagName}${nextAttrs}>`;
  });
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

const getCollectTypeForNode = (node: any, edges: any[]) => {
  const data = node?.data || {};
  if (data.collectWhatsapp) return "whatsapp";
  if (data.collectEmail) return "email";
  if (data.collectName) return "name";

  const collectHandle = (edges || [])
    .filter((edge: any) => edge.source === node?.id)
    .map((edge: any) => String(edge.sourceHandle || ""))
    .find((handle: string) => handle.startsWith("collect-"));

  const type = collectHandle?.replace("collect-", "");
  if (type === "whatsapp" || type === "email" || type === "name") return type;
  return null;
};

const isValidCollectInput = (type: string, text: string) => {
  const value = (text || "").trim();
  if (!value) return false;
  if (type === "email") return EMAIL_REGEX.test(normalizeEmailInput(value));
  if (type === "whatsapp") return value.replace(/\D/g, "").length >= 8;
  if (type === "name") return value.length >= 2;
  return false;
};


const fetchInstagramUserProfile = async (igUserId: string, accessToken: string) => {
  try {
    // For regular Facebook Graph API (Standard App), we use name and profile_pic
    // For Instagram Login tokens (IGA...), we use username and profile_picture_url
    const isIGToken = isInstagramLoginToken(accessToken);
    
    // For Standard App messaging, we need name and profile_pic. 
    // Sometimes numeric IDs are page-scoped IDs (PSID) and don't have 'username'
    const fields = isIGToken ? "username,profile_picture_url" : "name,profile_pic";
    
    const url = `${getInstagramGraphBaseUrl(accessToken)}/${META_API_VERSION}/${igUserId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    if (res.ok) {
      const profile = await res.json();
      console.log(`[webhook-instagram] Fetched profile for ${igUserId}:`, JSON.stringify(profile));
      return { 
        ...profile, 
       username: profile.username || profile.name || `@${igUserId}`,
        profile_pic: profile.profile_pic || profile.profile_picture_url 
      };
    }
    const errorText = await res.text();
    console.error(`[webhook-instagram] Error response from Meta API for user ${igUserId}:`, errorText);
  } catch (e) {
    console.error(`[webhook-instagram] Error fetching IG user profile for ${igUserId}:`, e);
  }
  return null;
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

const normalizeWhatsAppPhone = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") || digits.length > 11) return digits;
  // Instagram leads in this app are mostly Brazilian; accept local numbers typed without DDI.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};

const isUsableZapiInstance = (instance: any) => {
  const provider = String(instance?.api_provider || "zapi").toLowerCase();
  const type = String(instance?.instance_type || "").toLowerCase();
  return provider === "zapi" && type !== "mobile" && !!instance?.zapi_instance_id && !!instance?.zapi_token && !!instance?.zapi_client_token;
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
  const cleanPhone = normalizeWhatsAppPhone(phone);
  if (cleanPhone.length < 8) return;

  const wantedInstance = nodeData.instanceId || null;
  let zapiCreds: any = null;
  if (wantedInstance) {
    const { data } = await supabase
      .from("zapi_instances")
      .select("*")
      .or("id.eq." + wantedInstance + ",zapi_instance_id.eq." + wantedInstance)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    zapiCreds = isUsableZapiInstance(data) ? data : null;
  }
  if (!zapiCreds) {
    const { data } = await supabase
      .from("zapi_instances")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(20);
    zapiCreds = (data || []).find(isUsableZapiInstance) || null;
  }
  if (!zapiCreds) {
    console.error(`[webhook-instagram] No active web WhatsApp instance found for user ${userId}`);
    return;
  }

  const baseUrl = "https://api.z-api.io/instances/" + zapiCreds.zapi_instance_id + "/token/" + zapiCreds.zapi_token;
  const sendType = nodeData.sendType || "text";
  
  if (sendType === "flow" && nodeData.flowId) {
    await triggerOfficialWhatsAppFlow(nodeData.flowId, cleanPhone, zapiCreds.zapi_instance_id, fromUsername);
    return;
  }

  const message = replaceVars(nodeData.message || "", { username: fromUsername });
  if (!message.trim()) return;

  const response = await fetch(baseUrl + "/send-text", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": zapiCreds.zapi_client_token },
    body: JSON.stringify({ phone: cleanPhone, message }),
  });
  const responseText = await response.text();
  if (!response.ok) {
    console.error(`[webhook-instagram] WhatsApp send failed for ${cleanPhone}:`, responseText);
    return;
  }
  console.log(`[webhook-instagram] WhatsApp message sent to ${cleanPhone} via ${zapiCreds.zapi_instance_id}:`, responseText.slice(0, 300));
};

const executeIgEmailNode = async (
  nodeData: any,
  userId: string,
  igUserId: string,
  fromUsername: string,
  supabase: any,
) => {
  // Fetch the captured email for this IG user
  const { data: leadEvent } = await supabase
    .from("instagram_events")
    .select("comment_text")
    .eq("user_id", userId)
    .eq("event_type", "lead_email")
    .eq("ig_user_id", igUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const recipient = normalizeEmailInput(leadEvent?.comment_text || "");
  if (!recipient || !EMAIL_REGEX.test(recipient)) {
    console.warn(`[webhook-instagram] igEmail: no valid captured email for user ${userId} / ig ${igUserId}`);
    return;
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("[webhook-instagram] igEmail: RESEND_API_KEY missing");
    return;
  }

  // Lookup user's verified email domain
  const { data: domainData } = await supabase
    .from("email_domain_verifications")
    .select("domain, status")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!domainData?.domain) {
    console.error(`[webhook-instagram] igEmail: no verified domain for user ${userId}`);
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email_sender_name")
    .eq("id", userId)
    .maybeSingle();

  const fromAlias = String(nodeData.fromAlias || "contato").replace(/[^a-z0-9._-]/gi, "") || "contato";
  const senderName = String(nodeData.senderName || "").trim()
    || (profile as any)?.email_sender_name
    || profile?.full_name
    || "ZapLynx";
  const from = `${senderName} <${fromAlias}@${domainData.domain}>`;

  let sourceSubject = String(nodeData.subject || "");
  let sourceBody = String(nodeData.message || "");

  // When a saved template is selected, always load the original template at send time.
  // This preserves the exact HTML/CSS/layout from the email builder instead of relying
  // on the node preview/editor copy, which can make the email look unformatted.
  const templateId = String(nodeData.templateId || "").trim();
  if (templateId) {
    const { data: template, error: templateError } = await supabase
      .from("user_email_templates")
      .select("subject, html")
      .eq("id", templateId)
      .eq("user_id", userId)
      .maybeSingle();

    if (templateError) {
      console.warn(`[webhook-instagram] igEmail template lookup failed:`, templateError);
    }

    if (template?.html) {
      sourceSubject = String(template.subject || sourceSubject);
      sourceBody = String(template.html || sourceBody);
    }
  }

  const subject = replaceVars(sourceSubject.trim(), { username: fromUsername });
  const rawBody = replaceVars(sourceBody.trim(), { username: fromUsername });
  if (!subject || !rawBody) {
    console.warn(`[webhook-instagram] igEmail: subject or message empty for user ${userId}`);
    return;
  }
  const html = /<[a-z][\s\S]*>/i.test(rawBody)
    ? inlineEmailCss(rawBody)
    : `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${rawBody.replace(/</g, "&lt;")}</div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "X-Resend-Region": "us-east-1",
      },
      body: JSON.stringify({ from, to: recipient, subject, html }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`[webhook-instagram] igEmail send failed for ${recipient}:`, j);
      return;
    }
    if (j?.id) {
      const mappingResult = await supabase.from("sent_emails_mapping").insert({
        email_id: j.id,
        user_id: userId,
        subject,
        html,
        recipient,
      });
      if (mappingResult.error) {
        console.warn(`[webhook-instagram] igEmail mapping insert skipped:`, mappingResult.error);
      }
      const eventResult = await supabase.from("resend_webhook_events").insert({
        user_id: userId,
        event_type: "email.sent",
        email_id: j.id,
        recipient,
        sender: from,
        subject,
        raw_payload: {
          type: "email.sent",
          source: "webhook-instagram",
          data: { email_id: j.id, to: [recipient], from, subject, html },
        },
      });
      if (eventResult.error) {
        console.warn(`[webhook-instagram] igEmail event insert skipped:`, eventResult.error);
      }
    }
    console.log(`[webhook-instagram] igEmail sent to ${recipient} (id=${j?.id})`);
  } catch (e) {
    console.error(`[webhook-instagram] igEmail exception:`, e);
  }
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

      // Debug contact username resolution
      if (contactData.username === params.igUserId) {
        console.log(`[webhook-instagram] Contact username for ${params.igUserId} could not be resolved, still using ID.`);
      } else {
        console.log(`[webhook-instagram] Contact username for ${params.igUserId} resolved to: ${contactData.username}`);
      }

      // Try to update first, if no rows updated, then insert
      // This is because we don't have a unique constraint on (user_id, ig_user_id) yet to use upsert with onConflict
      const { data: existingContact } = await supabase
        .from("instagram_contacts")
        .select("id")
        .eq("user_id", params.userId)
        .eq("ig_user_id", params.igUserId)
        .maybeSingle();

      if (existingContact) {
        const { error: updateError } = await supabase
          .from("instagram_contacts")
          .update(contactData)
          .eq("id", existingContact.id);
        if (updateError) console.error(`[webhook-instagram] Error updating contact for ${params.igUserId}:`, updateError);
        else console.log(`[webhook-instagram] Successfully updated contact for ${params.igUserId}`);
      } else {
        const { error: insertError } = await supabase
          .from("instagram_contacts")
          .insert(contactData);
        if (insertError) console.error(`[webhook-instagram] Error inserting contact for ${params.igUserId}:`, insertError);
        else console.log(`[webhook-instagram] Successfully inserted contact for ${params.igUserId}`);
      }

      // Update ALL events for this contact with the resolved username if needed
      if (resolvedUsername && resolvedUsername !== params.igUserId) {
        console.log(`[webhook-instagram] Updating all events for ${params.igUserId} to username ${resolvedUsername}`);
        const { error: eventUpdateError } = await supabase.from("instagram_events")
          .update({ username: resolvedUsername })
          .eq("user_id", params.userId)
          .eq("ig_user_id", params.igUserId);
        
        if (eventUpdateError) {
          console.error(`[webhook-instagram] Error updating events username for ${params.igUserId}:`, eventUpdateError);
        }
      }
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
        const baseUrl = getInstagramGraphBaseUrl(context.accessToken);
        const replyUrl = `${baseUrl}/${META_API_VERSION}/${context.commentId}/replies`;
        console.log(`[webhook-instagram] Sending comment reply to ${context.commentId}`);
             const res = await fetch(replyUrl, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ message: replyText, access_token: context.accessToken }),
             });
             if (!res.ok) {
               const errorData = await res.text();
               console.error(`[webhook-instagram] Flow reply failed for comment ${context.commentId}:`, errorData);
             } else {
               console.log(`[webhook-instagram] Successfully replied to comment ${context.commentId}`);
               // Log that we replied to this comment to prevent duplicates
               await logInstagramEvent(supabase, {
                 userId: context.userId,
                 eventType: "dm_sent", // Reusing this for tracking or could be 'comment_reply_sent'
                 igUserId: context.senderId,
                 username: context.senderUsername,
                 text: replyText,
                 payload: { automation_id: auto.id, comment_id: context.commentId, type: "comment_reply" }
               });
             }
      } catch (e) { console.error("Flow reply error:", e); }
    }

    if (node.type === "igDM" && context.senderId && context.accessToken) {
      try {
        const dmText = replaceVars(d.message || "", { username: context.senderUsername, text: context.inputText || "" });
        const dmButtons = (d.buttons || []).filter((b: any) => b.title && (b.url || b.type === "reply"));
        const collectType = getCollectTypeForNode(node, edges);

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
            const isIGLogin = isInstagramLoginToken(context.accessToken);
            const baseUrl = getInstagramGraphBaseUrl(context.accessToken);
            const autoDmUrl = (isIGLogin 
              ? `${baseUrl}/${META_API_VERSION}/me/messages`
              : `${baseUrl}/${META_API_VERSION}/${context.igPageId}/messages`) + `?access_token=${encodeURIComponent(context.accessToken)}`;
            
            const recipient = context.commentId ? { comment_id: context.commentId } : { id: context.senderId };
            
            console.log(`[webhook-instagram] Sending DM to ${context.senderId} (via ${context.commentId ? 'comment_id' : 'id'})`);
            
            const res = await fetch(autoDmUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                recipient, 
                message: payload
              }),
            });
            
            if (!res.ok) {
              const errorData = await res.text();
              console.error(`[webhook-instagram] Flow DM failed:`, errorData);
            } else {
              console.log(`[webhook-instagram] Successfully sent DM to ${context.senderId}`);
           
              // Log automation outgoing message
              await logInstagramEvent(supabase, {
                userId: context.userId,
                eventType: "dm_sent",
                igUserId: context.senderId,
                username: context.senderUsername,
                text: dmText,
                payload: {
                  automation_id: auto.id,
                  type: "automation",
                  comment_id: context.commentId,
                  ...(collectType ? { awaiting_collect: { automation_id: auto.id, node_id: node.id, type: collectType } } : {}),
                }
              });
            }
         }
      } catch (e) { console.error("Flow DM failed:", e); }
      // If this DM expects user input, pause the flow here — execution resumes when the reply arrives.
      if (getCollectTypeForNode(node, edges)) {
        return;
      }
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

    if (node.type === "igEmail") {
      await executeIgEmailNode(d, context.userId, context.senderId, context.senderUsername, supabase);
    }

    // Traversal
    const buttons = (node.data?.buttons || []).filter((b: any) => b.title);
    if (node.type === "igDM" && buttons.length > 0) {
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

      if (body.action === "send_manual_message") {
          const { recipientId, message, userId } = body;
          const { data: creds, error: credError } = await supabase
            .from("meta_credentials")
            .select("*")
            .eq("user_id", userId)
            .eq("app_id", IG_APP_ID_DEFAULT)
            .eq("connected", true)
            .not("access_token", "is", null)
            .order("updated_at", { ascending: false })
            .limit(1);
          const cred = Array.isArray(creds) ? creds[0] : null;
          
          if (credError) {
            console.error("[webhook-instagram] Credential lookup error:", credError);
            return new Response(JSON.stringify({ error: "Erro ao buscar credenciais" }), { status: 500, headers: corsHeaders });
          }
          if (!cred) return new Response(JSON.stringify({ error: "Credenciais do Instagram não encontradas" }), { status: 404, headers: corsHeaders });
          const cleanAccessToken = cred.access_token.replace(/^["']|["']$/g, "").trim();
          const igPageId = cred.fb_user_id;

          const url = `${getInstagramGraphBaseUrl(cleanAccessToken)}/${META_API_VERSION}/${igPageId}/messages`;
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

          try {
            await logInstagramEvent(supabase, {
              userId,
              eventType: "dm_sent",
              igUserId: recipientId,
              username: recipientId,
              text: message,
              payload: { manual: true, ...data }
            });
            console.log(`[webhook-instagram] Manual message logged for user ${userId}`);
          } catch (logErr) {
            console.error("[webhook-instagram] Failed to log manual message event:", logErr);
          }

          return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: corsHeaders });
      }

      if (body.action === "save_ig_token") {
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      }

      if (body.action === "test_follow_flow") {
          const { data: cred } = await supabase.from("meta_credentials").select("*").eq("user_id", body.user_id).maybeSingle();
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
 
                const { data: automations } = await supabase
                  .from("instagram_automations")
                  .select("*")
                  .eq("user_id", cred.user_id)
                  .eq("active", true);

                for (const auto of (automations || [])) {
                  try {
                    const p = JSON.parse(auto.dm_message || "");
                    if (!p.__flow__) continue;

                    // Keyword filter
                    const triggerNode = p.nodes?.find((n: any) => n.type === "igGatilho" || n.type === "blocoGatilho" || n.type === "gatilho");
                    const kwsRaw = triggerNode?.data?.keywords || triggerNode?.data?.keyword || "";
                    const keywords = Array.isArray(kwsRaw) 
                      ? kwsRaw 
                      : kwsRaw.split(/[\n,;]/).map((k: string) => k.trim().toLowerCase()).filter(Boolean);
                    const matchType = triggerNode?.data?.matchType || "contains";

                    if (keywords.length > 0) {
                      const commentText = (comment.text || "").toLowerCase();
                      const matches = keywords.some((k: string) => {
                        const nk = k.toLowerCase().trim();
                        if (matchType === "exact") return commentText === nk;
                        return commentText.includes(nk);
                      });
                      if (!matches) continue;
                    }

                    // Prevent duplicate replies for the same comment
                    const { data: existingReply } = await supabase
                      .from("instagram_events")
                      .select("id")
                      .eq("user_id", cred.user_id)
                      .eq("event_type", "dm_sent")
                      .eq("ig_user_id", comment.from.id)
                      .contains("payload", { automation_id: auto.id, comment_id: comment.id })
                      .maybeSingle();

                    if (existingReply) {
                      console.log(`[webhook-instagram] Already replied to comment ${comment.id} with automation ${auto.id}`);
                      continue;
                    }

                    await executeFlow({ 
                      auto, 
                      nodes: p.nodes, 
                      edges: p.edges, 
                      context: { 
                        userId: cred.user_id, 
                        igPageId, 
                        senderId: comment.from.id, 
                        senderUsername: comment.from.username, 
                        accessToken: cleanAccessToken, 
                        commentId: comment.id, 
                        inputText: comment.text, 
                        triggerType: "comment" 
                      }, 
                      supabase 
                    });
                  } catch (err) {
                    console.error("[webhook-instagram] Error processing comment automation:", err);
                  }
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
                  const isEcho = event.message?.is_echo === true || event.message?.is_self === true || senderId === igPageId;
                  
                  // Only log if it's a message event (has message, postback, etc.)
                  if (event.message || event.postback) {
                    // Dedup: Meta retries the same webhook. Skip if we've already logged this mid.
                    const mid = event.message?.mid || event.postback?.mid;
                    if (mid) {
                      const { data: existing } = await supabase
                        .from("instagram_events")
                        .select("id")
                        .eq("user_id", cred.user_id)
                        .eq("payload->message->>mid", mid)
                        .limit(1)
                        .maybeSingle();
                      if (existing) {
                        console.log(`[webhook-instagram] Skipping duplicate event mid=${mid}`);
                        continue;
                      }
                    }
                    let eventType = isStory ? "story_reply" : "dm";
                    let targetIgId = senderId;
                    let targetUsername = senderUsername;

                    // If the sender is the Page itself, it's an outgoing message (echo)
                    if (isEcho) {
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

                      // Check if there's a paused flow awaiting this user's input (collect whatsapp/email/name)
                      let resumed = false;
                      try {
                        const { data: pendingList } = await supabase
                          .from("instagram_events")
                          .select("id, payload")
                          .eq("user_id", cred.user_id)
                          .eq("event_type", "dm_sent")
                          .eq("ig_user_id", senderId)
                          .order("created_at", { ascending: false })
                          .limit(10);

                        const pending = (pendingList || []).find((r: any) => r?.payload?.awaiting_collect);
                        const ac = pending?.payload?.awaiting_collect;
                        if (ac && ac.automation_id && ac.node_id && ac.type) {
                          if (!isValidCollectInput(ac.type, dmText)) {
                            console.log(`[webhook-instagram] Waiting for valid ${ac.type} input before resuming flow`);
                            resumed = true;
                            continue;
                          }

                          const auto = (automations || []).find((a: any) => a.id === ac.automation_id);
                          if (auto) {
                            const p = JSON.parse(auto.dm_message || "");
                            if (p.__flow__) {
                              // Log lead event so igWhatsApp node can pick up the phone
                              const leadType = ac.type === "whatsapp"
                                ? "lead_whatsapp"
                                : ac.type === "email" ? "lead_email" : "lead_name";
                              await supabase.from("instagram_events").insert({
                                user_id: cred.user_id,
                                event_type: leadType,
                                ig_user_id: senderId,
                                username: senderUsername,
                                comment_text: ac.type === "email" ? normalizeEmailInput(dmText) : dmText,
                                payload: {
                                  automation_id: auto.id,
                                  collected_value: ac.type === "email" ? normalizeEmailInput(dmText) : dmText,
                                  ...(ac.type === "email" && normalizeEmailInput(dmText) !== dmText ? { original_value: dmText } : {}),
                                },
                              });
                              // Mark the awaiting_collect as consumed
                              await supabase
                                .from("instagram_events")
                                .update({ payload: { ...pending.payload, awaiting_collect: null, awaiting_collect_consumed: true } })
                                .eq("id", pending.id);

                              // Resume from children connected via the matching collect-* handle
                              const handleId = `collect-${ac.type}`;
                              const childIds = (p.edges || [])
                                .filter((e: any) => e.source === ac.node_id && e.sourceHandle === handleId)
                                .map((e: any) => e.target);
                              for (const childId of childIds) {
                                await executeFlow({
                                  auto,
                                  nodes: p.nodes,
                                  edges: p.edges,
                                  startNodeId: childId,
                                  context: {
                                    userId: cred.user_id,
                                    igPageId,
                                    senderId,
                                    senderUsername,
                                    accessToken: cleanAccessToken,
                                    inputText: dmText,
                                    triggerType: "dm",
                                  },
                                  supabase,
                                });
                              }
                              resumed = true;
                            }
                          }
                        }
                      } catch (resumeErr) {
                        console.error("[webhook-instagram] Resume flow error:", resumeErr);
                      }

                      if (resumed) continue;

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
