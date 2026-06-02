// Refresh manual: deleta webhook temporariamente, chama getUpdates para drenar
// my_chat_member pendentes, processa promoções de admin em canais/grupos,
// e re-registra o webhook.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function deriveWebhookSecret(botId: string, token: string): Promise<string> {
  const data = new TextEncoder().encode(`telegram-flow-webhook:${botId}:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function tg(token: string, method: string, body: any = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.ok, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { bot_id } = await req.json().catch(() => ({}));
  if (!bot_id) {
    return new Response(JSON.stringify({ error: "bot_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: bot } = await admin
    .from("telegram_bots")
    .select("id, user_id, bot_token")
    .eq("id", bot_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!bot) {
    return new Response(JSON.stringify({ error: "bot not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await tg(bot.bot_token, "deleteWebhook", { drop_pending_updates: false });

  const upd = await tg(bot.bot_token, "getUpdates", {
    timeout: 0,
    limit: 100,
    allowed_updates: ["my_chat_member", "chat_join_request", "message", "callback_query"],
  });

  let detectedChannel: { chat_id: number; title: string | null } | null = null;
  let maxUpdateId = 0;

  if (upd.ok) {
    const updates: any[] = upd.json.result ?? [];
    for (const u of updates) {
      if (u.update_id > maxUpdateId) maxUpdateId = u.update_id;

      if (u.my_chat_member) {
        const cm = u.my_chat_member;
        const newStatus = cm?.new_chat_member?.status;
        const chat = cm?.chat;
        if (chat?.id && (chat.type === "channel" || chat.type === "supergroup" || chat.type === "group") &&
            (newStatus === "administrator" || newStatus === "creator")) {
          await admin.from("telegram_free_channels").upsert(
            { bot_id: bot.id, user_id: bot.user_id, chat_id: chat.id, title: chat.title ?? null },
            { onConflict: "bot_id" },
          );
          detectedChannel = { chat_id: chat.id, title: chat.title ?? null };
        }
      }

      if (u.chat_join_request) {
        const jr = u.chat_join_request;
        const { data: cfg } = await admin
          .from("telegram_free_channels")
          .select("chat_id, approval_delay_seconds")
          .eq("bot_id", bot.id)
          .maybeSingle();
        if (cfg && String(cfg.chat_id) === String(jr?.chat?.id)) {
          const delay = Math.max(1, Number(cfg.approval_delay_seconds || 60));
          const requestedAt = jr?.date
            ? new Date(Number(jr.date) * 1000).toISOString()
            : new Date().toISOString();
          await admin.from("telegram_free_join_requests").upsert({
            bot_id: bot.id,
            user_id: bot.user_id,
            chat_id: jr.chat.id,
            from_user_id: jr.from.id,
            from_username: jr?.from?.username ?? null,
            from_first_name: jr?.from?.first_name ?? null,
            requested_at: requestedAt,
            approve_at: new Date(Date.now() + delay * 1000).toISOString(),
            status: "pending",
          }, { onConflict: "bot_id,chat_id,from_user_id,requested_at" });
        }
      }
    }

    if (maxUpdateId > 0) {
      await tg(bot.bot_token, "getUpdates", { offset: maxUpdateId + 1, timeout: 0, limit: 1 });
      await admin.from("telegram_bot_state").upsert(
        { bot_id: bot.id, update_offset: maxUpdateId + 1, last_polled_at: new Date().toISOString() },
        { onConflict: "bot_id" },
      );
    }
  }

  if (!detectedChannel) {
    const { data: existing } = await admin
      .from("telegram_free_channels")
      .select("chat_id, title")
      .eq("bot_id", bot.id)
      .maybeSingle();
    if (existing?.chat_id) {
      const chatRes = await tg(bot.bot_token, "getChat", { chat_id: existing.chat_id });
      if (chatRes.ok) {
        const title = chatRes.json.result?.title ?? existing.title;
        await admin.from("telegram_free_channels")
          .update({ title })
          .eq("bot_id", bot.id);
        detectedChannel = { chat_id: existing.chat_id as number, title };
      } else {
        detectedChannel = { chat_id: existing.chat_id as number, title: existing.title as string | null };
      }
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook?bot_id=${encodeURIComponent(bot.id)}`;
  const secretToken = await deriveWebhookSecret(bot.id, bot.bot_token);
  await tg(bot.bot_token, "setWebhook", {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query", "my_chat_member", "chat_join_request"],
    drop_pending_updates: false,
  });

  return new Response(JSON.stringify({ ok: true, channel: detectedChannel }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
