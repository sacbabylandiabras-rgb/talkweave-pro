// Processa envios agendados / recorrentes pendentes no Canal Free.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("telegram_channel_posts")
    .select("*")
    .in("status", ["pending", "recurring"])
    .lte("next_run_at", nowIso)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0;

  for (const row of rows ?? []) {
    const { data: bot } = await admin
      .from("telegram_bots")
      .select("bot_token")
      .eq("id", row.bot_id)
      .maybeSingle();
    if (!bot?.bot_token || !row.chat_id) {
      await admin.from("telegram_channel_posts")
        .update({ status: "failed", last_error: "bot_or_chat_missing", next_run_at: null })
        .eq("id", row.id);
      failed++; continue;
    }

    const reply_markup = buildKeyboard(row.buttons || []);
    const payload: any = { chat_id: row.chat_id };
    if (row.content_type === "text") {
      payload.text = String(row.text || "");
      payload.parse_mode = "HTML";
    } else {
      payload[row.content_type] = row.media_url;
      if (row.text) payload.caption = String(row.text);
      payload.parse_mode = "HTML";
    }
    if (reply_markup) payload.reply_markup = reply_markup;

    const tg = await sendTelegram(bot.bot_token, row.content_type, payload);

    if (tg.ok) {
      sent++;
      if (row.mode === "recurring" && row.recurring_interval_minutes) {
        await admin.from("telegram_channel_posts").update({
          status: "recurring",
          last_error: null,
          sent_count: (row.sent_count || 0) + 1,
          last_sent_at: new Date().toISOString(),
          next_run_at: new Date(Date.now() + row.recurring_interval_minutes * 60_000).toISOString(),
        }).eq("id", row.id);
      } else {
        await admin.from("telegram_channel_posts").update({
          status: "sent",
          last_error: null,
          sent_count: (row.sent_count || 0) + 1,
          last_sent_at: new Date().toISOString(),
          next_run_at: null,
        }).eq("id", row.id);
      }
    } else {
      failed++;
      const description = String(tg.json?.description || "send_failed");
      if (row.mode === "recurring" && row.recurring_interval_minutes) {
        await admin.from("telegram_channel_posts").update({
          status: "recurring",
          last_error: description,
          next_run_at: new Date(Date.now() + row.recurring_interval_minutes * 60_000).toISOString(),
        }).eq("id", row.id);
      } else {
        await admin.from("telegram_channel_posts").update({
          status: "failed",
          last_error: description,
          next_run_at: null,
        }).eq("id", row.id);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, scanned: rows?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});