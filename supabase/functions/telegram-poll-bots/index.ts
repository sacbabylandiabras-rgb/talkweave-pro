// Polling de getUpdates para todos os bots ativos. Disparado por pg_cron a cada minuto.
// Usa long polling curto (10s) por bot para caber dentro do orçamento de tempo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RUNTIME_MS = 50_000;
const PER_BOT_TIMEOUT = 5; // segundos no long-poll

async function deriveWebhookSecret(botId: string, token: string): Promise<string> {
  const data = new TextEncoder().encode(`telegram-flow-webhook:${botId}:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function ensureWebhook(bot: { id: string; bot_token: string }) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook?bot_id=${encodeURIComponent(bot.id)}`;
  const secretToken = await deriveWebhookSecret(bot.id, bot.bot_token);
  const res = await fetch(`https://api.telegram.org/bot${bot.bot_token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query", "my_chat_member", "chat_join_request"],
      drop_pending_updates: false,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    console.warn(`webhook setup failed for bot ${bot.id}:`, json?.description || res.statusText);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: bots, error } = await admin
    .from("telegram_bots")
    .select("id, user_id, bot_token, telegram_bot_state(update_offset)")
    .eq("active", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let totalProcessed = 0;
  const stats: Record<string, number> = {};

  for (const bot of bots ?? []) {
    if (Date.now() - start > MAX_RUNTIME_MS) break;

    const offsetRow = (bot as any).telegram_bot_state;
    const currentOffset = Array.isArray(offsetRow)
      ? offsetRow[0]?.update_offset ?? 0
      : offsetRow?.update_offset ?? 0;

    try {
      if (await ensureWebhook(bot)) {
        await admin
          .from("telegram_bot_state")
          .upsert(
            { bot_id: bot.id, last_polled_at: new Date().toISOString() },
            { onConflict: "bot_id" },
          );
        continue;
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getUpdates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset: currentOffset,
          timeout: PER_BOT_TIMEOUT,
          allowed_updates: ["message", "callback_query", "my_chat_member", "chat_join_request"],
        }),
      });
      const tgJson = await tgRes.json();
      if (!tgRes.ok || !tgJson.ok) {
        const description = String(tgJson.description || "");
        if (description.includes("Conflict") && description.includes("webhook")) {
          await admin
            .from("telegram_bot_state")
            .upsert(
              { bot_id: bot.id, last_polled_at: new Date().toISOString() },
              { onConflict: "bot_id" },
            );
          continue;
        }
        console.warn(`bot ${bot.id} falhou:`, description || tgRes.statusText);
        continue;
      }

      const updates: any[] = tgJson.result ?? [];
      if (updates.length === 0) {
        await admin
          .from("telegram_bot_state")
          .upsert(
            { bot_id: bot.id, last_polled_at: new Date().toISOString() },
            { onConflict: "bot_id" },
          );
        continue;
      }

      const rows = updates
        .filter((u) => u.message || u.callback_query)
        .map((u) => {
          const msg = u.message ?? u.callback_query?.message;
          const from = u.message?.from ?? u.callback_query?.from;
          return {
            bot_id: bot.id,
            user_id: bot.user_id,
            update_id: u.update_id,
            chat_id: msg?.chat?.id ?? 0,
            from_user_id: from?.id ?? null,
            from_username: from?.username ?? null,
            from_first_name: from?.first_name ?? null,
            text: u.message?.text ?? u.callback_query?.data ?? null,
            raw_update: u,
          };
        });

      if (rows.length > 0) {
        const { error: insErr } = await admin
          .from("telegram_messages")
          .upsert(rows, { onConflict: "bot_id,update_id" });
        if (insErr) {
          console.error("insert msgs:", insErr.message);
          continue;
        }
        totalProcessed += rows.length;
        stats[bot.id] = (stats[bot.id] ?? 0) + rows.length;
      }

      // Dispatch each update to the flow engine (fire-and-forget)
      const engineUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-flow-engine`;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      for (const u of updates) {
        fetch(engineUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ bot_id: bot.id, update: u }),
        }).catch((e) => console.warn("engine dispatch failed", (e as Error).message));
      }

      const newOffset = Math.max(...updates.map((u) => u.update_id)) + 1;
      await admin
        .from("telegram_bot_state")
        .upsert(
          {
            bot_id: bot.id,
            update_offset: newOffset,
            last_polled_at: new Date().toISOString(),
          },
          { onConflict: "bot_id" },
        );
    } catch (e) {
      console.error(`bot ${bot.id} erro:`, (e as Error).message);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: totalProcessed, bots: bots?.length ?? 0, stats }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});