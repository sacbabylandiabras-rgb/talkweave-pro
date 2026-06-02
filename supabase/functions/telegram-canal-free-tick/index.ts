// Aprova solicitações de entrada pendentes no Canal Free após o delay configurado
// e envia a mensagem de boas-vindas no privado do usuário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function tg(botToken: string, method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.ok, json };
}

async function sendWelcomeText(botToken: string, body: any) {
  const first = await tg(botToken, "sendMessage", body);
  const description = String(first.json?.description || "").toLowerCase();
  if (!first.ok && body?.parse_mode && description.includes("can't parse")) {
    const { parse_mode: _parseMode, ...plainBody } = body;
    return await tg(botToken, "sendMessage", plainBody);
  }
  return first;
}

async function backfillJoinedMembers(admin: any) {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await admin
    .from("telegram_messages")
    .select("bot_id,user_id,chat_id,from_user_id,from_username,from_first_name,created_at,raw_update")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);

  for (const row of rows ?? []) {
    const msg = row?.raw_update?.message ?? row?.raw_update?.edited_message;
    const members = Array.isArray(msg?.new_chat_members) ? msg.new_chat_members : [];
    if (!msg?.chat?.id || members.length === 0) continue;

    const { data: cfg } = await admin
      .from("telegram_free_channels")
      .select("chat_id,user_id")
      .eq("bot_id", row.bot_id)
      .maybeSingle();
    if (!cfg || String(cfg.chat_id) !== String(msg.chat.id)) continue;

    for (const member of members) {
      if (!member?.id || member?.is_bot) continue;
      const { data: existing } = await admin
        .from("telegram_free_join_requests")
        .select("id")
        .eq("bot_id", row.bot_id)
        .eq("chat_id", row.chat_id)
        .eq("from_user_id", member.id)
        .gte("requested_at", since)
        .limit(1)
        .maybeSingle();
      if (existing?.id) continue;

      await admin.from("telegram_free_join_requests").insert({
        bot_id: row.bot_id,
        user_id: cfg.user_id || row.user_id,
        chat_id: row.chat_id,
        from_user_id: member.id,
        from_username: member?.username ?? row.from_username ?? null,
        from_first_name: member?.first_name ?? row.from_first_name ?? null,
        requested_at: row.created_at || new Date().toISOString(),
        approve_at: new Date().toISOString(),
        status: "pending",
      });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  await backfillJoinedMembers(admin).catch((e) =>
    console.warn("joined members backfill failed", (e as Error).message)
  );

  const { data: ready, error } = await admin
    .from("telegram_free_join_requests")
    .select("*")
    .eq("status", "pending")
    .lte("approve_at", new Date().toISOString())
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let approved = 0;
  let failed = 0;

  for (const row of ready ?? []) {
    const { data: bot } = await admin
      .from("telegram_bots")
      .select("bot_token")
      .eq("id", row.bot_id)
      .maybeSingle();
    if (!bot?.bot_token) {
      await admin.from("telegram_free_join_requests")
        .update({ status: "failed", processed_at: new Date().toISOString(), last_error: "bot_not_found" })
        .eq("id", row.id);
      failed++;
      continue;
    }

    const { data: cfg } = await admin
      .from("telegram_free_channels")
      .select("welcome_message, response_type, template_id, flow_id")
      .eq("bot_id", row.bot_id)
      .maybeSingle();

    let lastError: string | null = null;
    const privateChatId = (row as any).user_chat_id || row.from_user_id;

    const responseType = (cfg as any)?.response_type || "text";
    const firstName = row.from_first_name || "";
    const interpolate = (s: string) =>
      String(s || "")
        .replaceAll("{nome}", firstName)
        .replaceAll("{name}", firstName);

    const sendWelcome = async () => {
      if (responseType === "flow" && (cfg as any)?.flow_id) {
        const { error: flowErr } = await admin.functions.invoke("telegram-flow-engine", {
          body: {
            mode: "start",
            bot_id: row.bot_id,
            chat_id: privateChatId,
            flow_id: (cfg as any).flow_id,
            user: { id: row.from_user_id, first_name: firstName },
          },
        });
        if (flowErr) {
          return `flow: ${flowErr.message || "invoke_failed"}`;
        }
      } else if (responseType === "template" && (cfg as any)?.template_id) {
        const { data: tpl } = await admin
          .from("telegram_message_templates")
          .select("content, buttons")
          .eq("id", (cfg as any).template_id)
          .maybeSingle();
        const text = interpolate(tpl?.content || "");
        const buttons = Array.isArray((tpl as any)?.buttons) ? (tpl as any).buttons : [];
        const reply_markup = buttons.length > 0
          ? { inline_keyboard: buttons
              .filter((b: any) => b?.text && (b?.url || b?.type === "reply"))
              .map((b: any) => {
                if (b?.type === "reply") {
                  const payload = String(b.payload || b.text || "btn").slice(0, 60);
                  return [{ text: String(b.text), callback_data: `tplreply:${payload}` }];
                }
                return [{ text: String(b.text), url: String(b.url) }];
              }) }
          : undefined;
        if (text) {
          const sendRes = await sendWelcomeText(bot.bot_token, {
            chat_id: privateChatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: false,
            ...(reply_markup ? { reply_markup } : {}),
          });
          if (!sendRes.ok) {
            return `welcome: ${sendRes.json?.description || "send_failed"}`;
          }
        }
      } else {
        const text = interpolate(cfg?.welcome_message || "").trim();
        if (text) {
          const sendRes = await sendWelcomeText(bot.bot_token, {
            chat_id: privateChatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          });
          if (!sendRes.ok) {
            return `welcome: ${sendRes.json?.description || "send_failed"}`;
          }
        }
      }
      return null;
    };

    let welcomeAlreadyAttempted = false;
    if ((row as any).user_chat_id) {
      const welcomeErr = await sendWelcome();
      welcomeAlreadyAttempted = true;
      if (welcomeErr) lastError = welcomeErr;
    }

    const approveRes = await tg(bot.bot_token, "approveChatJoinRequest", {
      chat_id: row.chat_id,
      user_id: row.from_user_id,
    });

    if (!approveRes.ok) {
      lastError = (lastError ? lastError + " | " : "") + String(approveRes.json?.description || "approve_failed");
    }

    const approveDescription = String(approveRes.json?.description || "").toLowerCase();
    const alreadyParticipant = approveDescription.includes("already") || approveDescription.includes("participant");
    const canSendWelcome = approveRes.ok || alreadyParticipant;

    if (canSendWelcome && !welcomeAlreadyAttempted) {
      const welcomeErr = await sendWelcome();
      if (welcomeErr) lastError = (lastError ? lastError + " | " : "") + welcomeErr;
    }

    await admin.from("telegram_free_join_requests")
      .update({
        status: canSendWelcome ? "approved" : "failed",
        processed_at: new Date().toISOString(),
        last_error: lastError,
      })
      .eq("id", row.id);

    if (canSendWelcome) approved++; else failed++;
  }

  return new Response(JSON.stringify({ ok: true, approved, failed, scanned: ready?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});