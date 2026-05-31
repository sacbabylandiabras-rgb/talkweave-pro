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
    .select("id,user_id,bot_token,active")
    .eq("id", botId)
    .maybeSingle();
  if (!bot || !bot.active) return new Response(JSON.stringify({ ok: true, skipped: "bot_inactive" }));

  const expectedSecret = await deriveWebhookSecret(bot.id, bot.bot_token);
  const actualSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!safeEqual(actualSecret, expectedSecret)) return new Response("Unauthorized", { status: 401 });

  const update = await req.json().catch(() => null);
  if (!update?.update_id || (!update.message && !update.edited_message && !update.callback_query)) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processUpdate = async () => {
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