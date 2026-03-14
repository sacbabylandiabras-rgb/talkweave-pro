import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

const toIsoTimestamp = (raw: any) => {
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
};

const extractMessageText = (message: any): string => {
  const candidates = [
    message?.text?.message,
    message?.text?.body,
    message?.message?.text,
    message?.message,
    message?.body,
    message?.content,
    message?.caption,
    message?.image?.caption,
    message?.video?.caption,
    message?.extendedTextMessage?.text,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const maxChats = Math.min(Math.max(Number(body?.maxChats) || 25, 1), 60);
    const amountPerChat = Math.min(Math.max(Number(body?.amountPerChat) || 12, 1), 40);

    // Allow caller to specify a specific instance to sync
    let instanceId = credentials.instanceId;
    let token = credentials.token;
    let clientToken = credentials.clientToken;

    if (body?.instanceId) {
      // Look up the specific instance credentials
      const { data: specificInstance } = await adminClient
        .from("zapi_instances")
        .select("zapi_instance_id, zapi_token, zapi_client_token")
        .eq("zapi_instance_id", body.instanceId)
        .eq("user_id", credentials.userId)
        .eq("is_active", true)
        .maybeSingle();

      if (specificInstance) {
        instanceId = specificInstance.zapi_instance_id;
        token = specificInstance.zapi_token;
        clientToken = specificInstance.zapi_client_token;
        console.log(`📌 Using specific instance: ${instanceId}`);
      }
    }

    console.log(`📱 Syncing history for user: ${credentials.userId}, instance: ${instanceId}`);

    const chatsUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/chats?page=1&pageSize=${maxChats}`;

    const chatsResponse = await fetch(chatsUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
    });

    if (!chatsResponse.ok) {
      const errorText = await chatsResponse.text();
      console.error(`❌ Z-API chats error: ${chatsResponse.status} - ${errorText}`);
      throw new Error(`Z-API chats error: ${chatsResponse.status}`);
    }

    const chatsPayload = await chatsResponse.json();
    const chats = Array.isArray(chatsPayload) ? chatsPayload : [];

    let importedMessages = 0;
    let importedChats = 0;
    let skippedChats = 0;

    for (const chat of chats) {
      const phone = String(chat?.phone || "").trim();
      if (!phone) {
        skippedChats++;
        continue;
      }

      const { data: existingRows, error: existingError } = await adminClient
        .from("message_logs")
        .select("timestamp, message_received, response_sent")
        .eq("user_id", credentials.userId)
        .eq("phone", phone)
        .order("timestamp", { ascending: false })
        .limit(1000);

      if (existingError) {
        console.error("❌ Error checking existing messages:", existingError);
        skippedChats++;
        continue;
      }

      const existingSet = new Set(
        (existingRows || []).map((row: any) => `${new Date(row.timestamp).toISOString()}|${row.message_received || row.response_sent || ""}`),
      );

      const messagesUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/chat-messages/${encodeURIComponent(phone)}?amount=${amountPerChat}`;
      const messagesResponse = await fetch(messagesUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
      });

      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text();
        console.error(`❌ Z-API chat-messages error for ${phone}: ${messagesResponse.status} - ${errorText}`);
        skippedChats++;
        continue;
      }

      const messagesPayload = await messagesResponse.json();
      const messages = Array.isArray(messagesPayload) ? messagesPayload : [];

      const rows = messages
        .map((msg: any) => {
          const content = extractMessageText(msg);
          if (!content) return null;

          const fromMe = Boolean(msg?.fromMe ?? msg?.key?.fromMe ?? false);
          const timestamp = toIsoTimestamp(msg?.momment ?? msg?.messageTimestamp ?? msg?.timestamp ?? msg?.createdAt ?? chat?.lastMessageTime);

          return {
            phone,
            user_id: credentials.userId,
            timestamp,
            message_received: fromMe ? null : content,
            response_sent: fromMe ? content : null,
            keyword_matched: "__history_import__",
            instance_id: instanceId,
          };
        })
        .filter((row: any) => row !== null)
        .filter((row: any) => {
          const content = row.message_received || row.response_sent || "";
          const key = `${new Date(row.timestamp).toISOString()}|${content}`;
          return !existingSet.has(key);
        });

      if (rows.length === 0) {
        skippedChats++;
        continue;
      }

      rows.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const { error: insertError } = await adminClient.from("message_logs").insert(rows);
      if (insertError) {
        console.error(`❌ Error inserting history for ${phone}:`, insertError);
        skippedChats++;
        continue;
      }

      importedChats++;
      importedMessages += rows.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        importedChats,
        importedMessages,
        skippedChats,
        totalChatsRead: chats.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Error syncing history:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
