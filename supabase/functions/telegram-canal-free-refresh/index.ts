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

async function persistChannel(admin: any, bot: any, channel: { chat_id: number; title: string | null }) {
  const chatMember = bot.bot_id
    ? await tg(bot.bot_token, "getChatMember", { chat_id: channel.chat_id, user_id: bot.bot_id })
    : { ok: true, json: {} };
  const status = chatMember.json?.result?.status;
  if (chatMember.ok && status && status !== "administrator" && status !== "creator") return null;

  await admin.from("telegram_free_channels").upsert(
    { bot_id: bot.id, user_id: bot.user_id, chat_id: channel.chat_id, title: channel.title },
    { onConflict: "bot_id" },
  );
  return channel;
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
    await queueFreeJoinRequest(admin, {
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
  }
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
    .select("id, user_id, bot_token, bot_id")
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

      const channel = chatFromAdminUpdate(u, bot.bot_id);
      if (channel) {
        detectedChannel = await persistChannel(admin, bot, channel) ?? detectedChannel;
      }

      await queueJoinedMembersWelcome(admin, bot, u);

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
          await queueFreeJoinRequest(admin, {
            bot_id: bot.id,
            user_id: bot.user_id,
            chat_id: jr.chat.id,
            from_user_id: jr.from.id,
            user_chat_id: jr?.user_chat_id ?? jr.from.id,
            from_username: jr?.from?.username ?? null,
            from_first_name: jr?.from?.first_name ?? null,
            requested_at: requestedAt,
            approve_at: new Date(Date.now() + delay * 1000).toISOString(),
            status: "pending",
          });
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
    const { data: recentMessages } = await admin
      .from("telegram_messages")
      .select("raw_update")
      .eq("bot_id", bot.id)
      .order("created_at", { ascending: false })
      .limit(100);
    for (const row of recentMessages ?? []) {
      const channel = chatFromAdminUpdate(row.raw_update, bot.bot_id);
      if (channel) {
        detectedChannel = await persistChannel(admin, bot, channel) ?? detectedChannel;
        if (detectedChannel) break;
      }
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
