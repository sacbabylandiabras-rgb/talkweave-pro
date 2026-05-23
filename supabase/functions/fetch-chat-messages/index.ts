import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

const normalizeTimestamp = (value: unknown): string => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return new Date().toISOString();
  const ms = raw < 4102444800 ? raw * 1000 : raw;
  const parsed = new Date(ms);
  return parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100
    ? parsed.toISOString()
    : new Date().toISOString();
};

const cleanPhone = (raw: string): { phone: string; isGroup: boolean; chatid: string } => {
  const trimmed = String(raw || "").trim();
  const isGroup = trimmed.includes("-group") || trimmed.includes("@g.us");
  if (isGroup) {
    const cleanId = trimmed.replace("@g.us", "").replace("-group", "").replace(/\D/g, "");
    return { phone: `${cleanId}-group`, isGroup: true, chatid: `${cleanId}@g.us` };
  }
  const cleanId = trimmed.replace("@c.us", "").replace("@s.whatsapp.net", "").replace(/\D/g, "");
  return { phone: cleanId, isGroup: false, chatid: `${cleanId}@s.whatsapp.net` };
};

const extractExternalId = (msg: any): string => String(
  msg?.id || msg?.messageId || msg?.messageid || msg?.zaapId || msg?.key?.id || ""
).trim();

const extractMessageContent = (msg: any): { text: string; mediaType: string | null; mediaUrl: string | null } => {
  const text = String(
    msg?.content?.conversation
      || msg?.content?.extendedTextMessage?.text
      || msg?.content
      || msg?.text
      || msg?.body
      || msg?.message
      || msg?.caption
      || ""
  ).trim();

   const mediaUrl: string | null = msg?.mediaUrl || msg?.url || msg?.fileUrl || msg?.image
     || msg?.video || msg?.audio || msg?.document || msg?.sticker || msg?.stickerUrl || null;

  let mediaType: string | null = null;
  const lowerType = String(msg?.messageType || msg?.type || "").toLowerCase();
   if (lowerType.includes("image")) mediaType = "image";
   else if (lowerType.includes("video")) mediaType = "video";
   else if (lowerType.includes("audio") || lowerType.includes("ptt")) mediaType = "audio";
   else if (lowerType.includes("document")) mediaType = "document";
   else if (lowerType.includes("sticker")) mediaType = "sticker";

  return { text, mediaType, mediaUrl };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("No authorization header");

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const phoneRaw = String(body?.phone || "").trim();
    const instanceRef = String(body?.instanceId || "").trim();
    const limit = Math.min(Math.max(Number(body?.limit) || 30, 1), 100);

    if (!phoneRaw) throw new Error("phone is required");

    // Skip non-Z-API instances (e.g. Meta Cloud "meta:xxx") — history is fetched elsewhere.
    if (instanceRef && (instanceRef.startsWith("meta:") || instanceRef.startsWith("meta-ig-"))) {
      return new Response(JSON.stringify({ imported: 0, skipped: "meta" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone, isGroup, chatid } = cleanPhone(phoneRaw);

    // Resolve instance for this user
    let instanceQuery = adminClient
      .from("zapi_instances")
      .select("id, zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, evolution_api_url, evolution_api_key")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (instanceRef) {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const orFilter = UUID_RE.test(instanceRef)
        ? `id.eq.${instanceRef},zapi_instance_id.eq.${instanceRef}`
        : `zapi_instance_id.eq.${instanceRef}`;
      instanceQuery = instanceQuery.or(orFilter);
    } else {
      instanceQuery = instanceQuery.order("is_default", { ascending: false }).order("created_at", { ascending: true });
    }

    const { data: instance } = await instanceQuery.limit(1).maybeSingle();
    if (!instance) {
      console.log(`[fetch-chat-messages] No active instance for user ${user.id} ref=${instanceRef || 'default'}`);
      return new Response(JSON.stringify({ imported: 0, skipped: "no_instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiProvider = (instance.api_provider || "zapi").toLowerCase();
    let messages: any[] = [];

    if (apiProvider === "uazapi") {
      const apiUrl = String(instance.evolution_api_url || "").replace(/\/+$/, "");
      const apiToken = String(instance.evolution_api_key || "");
      if (!apiUrl || !apiToken) throw new Error("UAZAPI URL/Token não configurados");

      // Try multiple chatid formats (UAZAPI varies by group/contact)
      const cleanId = phone.replace("-group", "").replace(/\D/g, "");
      const candidates = isGroup
        ? [`${cleanId}@g.us`, cleanId]
        : [`${cleanId}@s.whatsapp.net`, `${cleanId}@c.us`, cleanId];

      for (const candidate of candidates) {
        const resp = await fetch(`${apiUrl}/chat/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: apiToken },
          body: JSON.stringify({ chatid: candidate, limit }),
        });
        const rawText = await resp.text();
        let payload: any = {};
        try { payload = JSON.parse(rawText); } catch { payload = {}; }
        if (!resp.ok) {
          console.warn(`UAZAPI /chat/messages failed for ${candidate}: ${resp.status} - ${rawText}`);
          continue;
        }
        const arr = Array.isArray(payload?.messages) ? payload.messages
          : Array.isArray(payload?.data) ? payload.data
          : Array.isArray(payload) ? payload
          : [];
        if (arr.length > 0) {
          messages = arr;
          console.log(`✅ UAZAPI returned ${arr.length} messages for ${candidate}`);
          break;
        }
      }
    } else {
      // Z-API: chat-messages endpoint
      const zapiInstanceId = instance.zapi_instance_id;
      const zapiToken = instance.zapi_token;
      const clientToken = instance.zapi_client_token;
      const cleanId = phone.replace("-group", "").replace(/\D/g, "");
      const url = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/chat-messages/${cleanId}?amount=${limit}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      });
      if (resp.ok) {
        const payload = await resp.json().catch(() => null);
        messages = Array.isArray(payload) ? payload : (Array.isArray(payload?.messages) ? payload.messages : []);
      } else {
        console.warn(`Z-API chat-messages failed: ${resp.status}`);
      }
    }

    // Persist messages as message_logs (using a unique sentinel keyword to mark imported per-message rows)
    if (messages.length === 0) {
      return new Response(JSON.stringify({ success: true, imported: 0, total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull existing imported message ids for this phone to avoid duplicates
    const externalIds = messages
      .map((m: any) => extractExternalId(m))
      .filter(Boolean);

    const { data: existing } = await adminClient
      .from("message_logs")
      .select("keyword_matched")
      .eq("user_id", user.id)
      .eq("phone", phone)
      .like("keyword_matched", "__msg_import__:%");

    const existingIds = new Set<string>(
      (existing || []).map((r: any) => String(r.keyword_matched).replace("__msg_import__:", ""))
    );

    const rows: any[] = [];
    for (const m of messages) {
      const externalId = extractExternalId(m);
      if (!externalId || existingIds.has(externalId)) continue;

      const fromMe = m?.fromMe === true || m?.fromme === true || m?.key?.fromMe === true;
      const ts = normalizeTimestamp(m?.messageTimestamp || m?.timestamp || m?.t || m?.sent_at);
      const { text, mediaType, mediaUrl } = extractMessageContent(m);
      
      // Try to extract sender name for group messages
      const senderName = m?.pushName || m?.pushname || m?.verifiedBizName || m?.senderName || m?.participantName || null;
      const senderPhone = m?.participant || m?.key?.participant || null;

      let content = text;
      if (mediaType && mediaUrl) {
        content = `[media:${mediaType}:${mediaUrl}]${text ? "\n" + text : ""}`;
      }
      if (!content) content = "[mensagem]";

      const keyword = `__msg_import__:${externalId}`;
      const safeSenderName = String(senderName || "").replace(/[|\]]/g, " ").trim();
      const safeSenderPhone = String(senderPhone || "").replace(/[|\]]/g, " ").trim();
      const senderPrefix = !fromMe && (safeSenderName || safeSenderPhone)
        ? `[sender:${safeSenderName}|${safeSenderPhone}|] `
        : "";
      const contentWithId = `${senderPrefix}[msgid:${externalId}] ${content}`;

      rows.push({
        phone,
        user_id: user.id,
        timestamp: ts,
        message_received: fromMe ? null : contentWithId,
        response_sent: fromMe ? contentWithId : null,
        keyword_matched: keyword,
        instance_id: instance.zapi_instance_id,
      });
    }

    let imported = 0;
    if (rows.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error: insErr } = await adminClient.from("message_logs").insert(batch);
        if (insErr) {
          console.error("Insert error:", insErr);
        } else {
          imported += batch.length;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, imported, total: messages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ fetch-chat-messages error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});