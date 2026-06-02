// Recebe updates do Telegram em tempo real e dispara o motor do fluxo sem esperar o cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function deriveWebhookSecret(botId: string, token: string): Promise<string> {
  const data = new TextEncoder().encode(`telegram-flow-webhook:${botId}:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function rowFromUpdate(bot: any, update: any) {
  const msg = update.message ?? update.edited_message ?? update.callback_query?.message;
  const from = update.message?.from ?? update.edited_message?.from ?? update.callback_query?.from;
  return {
    bot_id: bot.id,
    user_id: bot.user_id,
    update_id: update.update_id,
    chat_id: msg?.chat?.id ?? 0,
    from_user_id: from?.id ?? null,
    from_username: from?.username ?? null,
    from_first_name: from?.first_name ?? null,
    text: update.message?.text ?? update.edited_message?.text ?? update.callback_query?.data ?? null,
    raw_update: update,
  };
}

function chatFromAdminUpdate(update: any, botTelegramId?: number | null) {
  const cm = update?.my_chat_member;
  if (cm) {
    const newStatus = cm?.new_chat_member?.status;
    const chat = cm?.chat;
    if (chat?.id && ["channel", "supergroup", "group"].includes(chat.type) &&
        (newStatus === "administrator" || newStatus === "creator")) {
      return { chat_id: chat.id, title: chat.title ?? null };
    }
  }

  const msg = update?.message ?? update?.edited_message;
  const members = msg?.new_chat_members;
  const chat = msg?.chat;
  if (chat?.id && Array.isArray(members) && ["channel", "supergroup", "group"].includes(chat.type)) {
    const botWasAdded = members.some((m: any) =>
      m?.is_bot && (!botTelegramId || Number(m.id) === Number(botTelegramId)),
    );
    if (botWasAdded) return { chat_id: chat.id, title: chat.title ?? null };
  }

  return null;
}

async function queueFreeJoinRequest(admin: any, row: Record<string, any>) {
  const withoutUserChatId = () => {
    const { user_chat_id: _userChatId, ...fallback } = row;
    return fallback;
  };
  const retryWithoutUserChatId = (error: any) =>
    String(error?.message || "").includes("user_chat_id") || error?.code === "PGRST204" || error?.code === "42703";

  const { data: existing } = await admin
    .from("telegram_free_join_requests")
    .select("id")
    .eq("bot_id", row.bot_id)
    .eq("chat_id", row.chat_id)
    .eq("from_user_id", row.from_user_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing?.id) {
    const result = await admin
      .from("telegram_free_join_requests")
      .update(row)
      .eq("id", existing.id);
    if (result.error && retryWithoutUserChatId(result.error)) {
      return await admin
        .from("telegram_free_join_requests")
        .update(withoutUserChatId())
        .eq("id", existing.id);
    }
    return result;
  }

  const result = await admin.from("telegram_free_join_requests").insert(row);
  if (result.error && retryWithoutUserChatId(result.error)) {
    return await admin.from("telegram_free_join_requests").insert(withoutUserChatId());
  }
  return result;
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

async function persistFreeChannel(admin: any, bot: any, channel: { chat_id: number; title: string | null }) {
  const chatMember = bot.bot_id
    ? await tg(bot.bot_token, "getChatMember", { chat_id: channel.chat_id, user_id: bot.bot_id })
    : { ok: true, json: {} };
  const status = chatMember.json?.result?.status;
  if (chatMember.ok && status && status !== "administrator" && status !== "creator") return;

  await admin.from("telegram_free_channels").upsert(
    { bot_id: bot.id, user_id: bot.user_id, chat_id: channel.chat_id, title: channel.title },
    { onConflict: "bot_id" },
  );
}

async function queueJoinedMembersWelcome(admin: any, bot: any, update: any) {
  const msg = update?.message ?? update?.edited_message;
  const chat = msg?.chat;
  const members = Array.isArray(msg?.new_chat_members) ? msg.new_chat_members : [];
  if (!chat?.id || members.length === 0) return;

  const { data: cfg } = await admin
    .from("telegram_free_channels")
    .select("chat_id")
    .eq("bot_id", bot.id)
    .maybeSingle();
  if (!cfg || String(cfg.chat_id) !== String(chat.id)) return;

  for (const member of members) {
    if (!member?.id || member?.is_bot) continue;
    const now = new Date().toISOString();
    const { error: queueErr } = await queueFreeJoinRequest(admin, {
      bot_id: bot.id,
      user_id: bot.user_id,
      chat_id: chat.id,
      from_user_id: member.id,
      user_chat_id: member.id,
      from_username: member?.username ?? null,
      from_first_name: member?.first_name ?? null,
      requested_at: now,
      approve_at: now,
      status: "pending",
    });
    if (queueErr) console.error("joined member welcome queue failed:", queueErr.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const botId = new URL(req.url).searchParams.get("bot_id") || "";
  if (!botId) return new Response("Unauthorized", { status: 401 });

  const { data: bot } = await admin
    .from("telegram_bots")
    .select("id,user_id,bot_token,bot_id,active")
    .eq("id", botId)
    .maybeSingle();
  if (!bot || !bot.active) return new Response(JSON.stringify({ ok: true, skipped: "bot_inactive" }));

  const expectedSecret = await deriveWebhookSecret(bot.id, bot.bot_token);
  const actualSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!safeEqual(actualSecret, expectedSecret)) return new Response("Unauthorized", { status: 401 });

  const update = await req.json().catch(() => null);
  if (!update?.update_id) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processUpdate = async () => {
    // Canal Free: bot promovido/adicionado como admin de um canal/grupo
    const freeChannel = chatFromAdminUpdate(update, bot.bot_id);
    if (freeChannel) {
      await persistFreeChannel(admin, bot, freeChannel);
      return;
    }

    // Canal Free: solicitação de entrada (precisa link com aprovação)
    if (update.chat_join_request) {
      const jr = update.chat_join_request;
      const chatId = jr?.chat?.id;
      const fromUserId = jr?.from?.id;
      if (!chatId || !fromUserId) return;

      const { data: cfg } = await admin
        .from("telegram_free_channels")
        .select("chat_id, approval_delay_seconds")
        .eq("bot_id", bot.id)
        .maybeSingle();
      if (!cfg || String(cfg.chat_id) !== String(chatId)) return;

      const delay = Math.max(1, Number(cfg.approval_delay_seconds || 60));
      const approveAt = new Date(Date.now() + delay * 1000).toISOString();
      const requestedAt = jr?.date
        ? new Date(Number(jr.date) * 1000).toISOString()
        : new Date().toISOString();

      const { error: queueErr } = await queueFreeJoinRequest(admin, {
        bot_id: bot.id,
        user_id: bot.user_id,
        chat_id: chatId,
        from_user_id: fromUserId,
        user_chat_id: jr?.user_chat_id ?? fromUserId,
        from_username: jr?.from?.username ?? null,
        from_first_name: jr?.from?.first_name ?? null,
        requested_at: requestedAt,
        approve_at: approveAt,
        status: "pending",
      });
      if (queueErr) console.error("free join request queue failed:", queueErr.message);
      return;
    }

    if (!update.message && !update.edited_message && !update.callback_query) return;

    await queueJoinedMembersWelcome(admin, bot, update);

    const { error: insertErr } = await admin.from("telegram_messages").insert(rowFromUpdate(bot, update));
    if (insertErr) {
      if (insertErr.code === "23505") return;
      console.error("telegram webhook insert:", insertErr.message);
      return;
    }

    const engineUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-flow-engine`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const engineRes = await fetch(engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ bot_id: bot.id, update }),
    });
    if (!engineRes.ok) {
      console.warn("telegram engine webhook dispatch failed", engineRes.status, await engineRes.text());
    }
  };

  EdgeRuntime.waitUntil(processUpdate());

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});