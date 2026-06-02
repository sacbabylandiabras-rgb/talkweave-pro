// Envia conteúdo (texto/foto/vídeo/documento) dentro do Canal Free
// e/ou agenda envios futuros (uma vez ou recorrente).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ButtonRow = Array<{ text: string; url: string }>;

function buildKeyboard(buttons: any[]): { inline_keyboard: ButtonRow[] } | undefined {
  const rows: ButtonRow[] = [];
  for (const b of Array.isArray(buttons) ? buttons : []) {
    const text = String(b?.text || "").trim();
    const url = String(b?.url || "").trim();
    if (!text || !url) continue;
    try { new URL(url); } catch { continue; }
    rows.push([{ text, url }]);
  }
  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

async function sendTelegram(botToken: string, contentType: string, payload: any) {
  const method = contentType === "photo" ? "sendPhoto"
    : contentType === "video" ? "sendVideo"
    : contentType === "document" ? "sendDocument"
    : "sendMessage";
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.ok, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";
    if (!auth) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(url, svc, { global: { headers: { Authorization: auth } } });
    const token = auth.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      bot_id,
      content_type = "text",
      text = "",
      media_url = null,
      buttons = [],
      template_id = null,
      mode = "now",
      scheduled_at = null,
      recurring_interval_minutes = null,
    } = body || {};

    if (!bot_id) return json({ error: "bot_id obrigatório" }, 400);
    if (!["text", "photo", "video", "document"].includes(content_type)) {
      return json({ error: "content_type inválido" }, 400);
    }
    if (!["now", "scheduled", "recurring"].includes(mode)) {
      return json({ error: "mode inválido" }, 400);
    }
    if (content_type !== "text" && !media_url) {
      return json({ error: "media_url obrigatório para mídia" }, 400);
    }
    if (content_type === "text" && !String(text || "").trim()) {
      return json({ error: "texto obrigatório" }, 400);
    }

    const admin = createClient(url, svc);

    const { data: bot } = await admin
      .from("telegram_bots")
      .select("id, user_id, bot_token, bot_id")
      .eq("id", bot_id)
      .maybeSingle();
    if (!bot || bot.user_id !== user.id) return json({ error: "bot não encontrado" }, 404);

    const { data: ch } = await admin
      .from("telegram_free_channels")
      .select("chat_id, title")
      .eq("bot_id", bot_id)
      .maybeSingle();
    if (!ch?.chat_id) return json({ error: "canal_não_configurado" }, 400);

    // Salva sempre o registro
    const baseRow: any = {
      user_id: user.id,
      bot_id,
      chat_id: ch.chat_id,
      content_type,
      text: text || null,
      media_url,
      buttons: Array.isArray(buttons) ? buttons : [],
      template_id: template_id || null,
      mode,
      scheduled_at: mode === "scheduled" ? scheduled_at : null,
      recurring_interval_minutes: mode === "recurring" ? Number(recurring_interval_minutes) || null : null,
      next_run_at: mode === "now"
        ? new Date().toISOString()
        : mode === "scheduled"
        ? scheduled_at
        : new Date(Date.now() + (Number(recurring_interval_minutes) || 60) * 60_000).toISOString(),
      status: mode === "recurring" ? "recurring" : "pending",
    };

    if (mode !== "now") {
      // Só persiste e deixa o cron processar.
      if (mode === "scheduled" && !scheduled_at) return json({ error: "scheduled_at obrigatório" }, 400);
      if (mode === "recurring" && (!recurring_interval_minutes || Number(recurring_interval_minutes) < 1)) {
        return json({ error: "intervalo inválido" }, 400);
      }
      const { data: inserted, error: iErr } = await admin
        .from("telegram_channel_posts")
        .insert(baseRow)
        .select("id")
        .single();
      if (iErr) return json({ error: iErr.message }, 500);
      return json({ ok: true, scheduled: true, id: inserted?.id });
    }

    // mode === 'now' → envia agora
    const reply_markup = buildKeyboard(buttons);
    const payload: any = { chat_id: ch.chat_id };
    if (content_type === "text") {
      payload.text = String(text);
      payload.parse_mode = "HTML";
      payload.disable_web_page_preview = false;
    } else {
      payload[content_type] = media_url;
      if (text) payload.caption = String(text);
      payload.parse_mode = "HTML";
    }
    if (reply_markup) payload.reply_markup = reply_markup;

    const tg = await sendTelegram(bot.bot_token, content_type, payload);
    const status = tg.ok ? "sent" : "failed";
    const lastError = tg.ok ? null : (tg.json?.description || "send_failed");

    const { data: inserted } = await admin
      .from("telegram_channel_posts")
      .insert({
        ...baseRow,
        status,
        last_error: lastError,
        sent_count: tg.ok ? 1 : 0,
        last_sent_at: tg.ok ? new Date().toISOString() : null,
        next_run_at: null,
      })
      .select("id")
      .single();

    if (!tg.ok) {
      return json({ error: lastError, id: inserted?.id }, 502);
    }
    return json({ ok: true, id: inserted?.id, message_id: tg.json?.result?.message_id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});