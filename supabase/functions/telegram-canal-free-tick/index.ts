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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: ready, error } = await admin
    .from("telegram_free_join_requests")
    .select("id, bot_id, chat_id, from_user_id, from_first_name")
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

    const approveRes = await tg(bot.bot_token, "approveChatJoinRequest", {
      chat_id: row.chat_id,
      user_id: row.from_user_id,
    });

    let lastError: string | null = null;
    if (!approveRes.ok) {
      lastError = String(approveRes.json?.description || "approve_failed");
    }

    const responseType = (cfg as any)?.response_type || "text";
    const firstName = row.from_first_name || "";
    const interpolate = (s: string) =>
      String(s || "")
        .replaceAll("{nome}", firstName)
        .replaceAll("{name}", firstName);

    if (approveRes.ok) {
      if (responseType === "flow" && (cfg as any)?.flow_id) {
        const { error: flowErr } = await admin.functions.invoke("telegram-flow-engine", {
          body: {
            mode: "start",
            bot_id: row.bot_id,
            chat_id: row.from_user_id,
            flow_id: (cfg as any).flow_id,
            user: { id: row.from_user_id, first_name: firstName },
          },
        });
        if (flowErr) {
          lastError = (lastError ? lastError + " | " : "") + `flow: ${flowErr.message || "invoke_failed"}`;
        }
      } else if (responseType === "template" && (cfg as any)?.template_id) {
        const { data: tpl } = await admin
          .from("message_templates")
          .select("content")
          .eq("id", (cfg as any).template_id)
          .maybeSingle();
        const text = interpolate(tpl?.content || "");
        if (text) {
          const sendRes = await tg(bot.bot_token, "sendMessage", {
            chat_id: row.from_user_id,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          });
          if (!sendRes.ok) {
            lastError = (lastError ? lastError + " | " : "") + `welcome: ${sendRes.json?.description || "send_failed"}`;
          }
        }
      } else {
        const text = interpolate(cfg?.welcome_message || "").trim();
        if (text) {
          const sendRes = await tg(bot.bot_token, "sendMessage", {
            chat_id: row.from_user_id,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          });
          if (!sendRes.ok) {
            lastError = (lastError ? lastError + " | " : "") + `welcome: ${sendRes.json?.description || "send_failed"}`;
          }
        }
      }
    }

    await admin.from("telegram_free_join_requests")
      .update({
        status: approveRes.ok ? "approved" : "failed",
        processed_at: new Date().toISOString(),
        last_error: lastError,
      })
      .eq("id", row.id);

    if (approveRes.ok) approved++; else failed++;
  }

  return new Response(JSON.stringify({ ok: true, approved, failed, scanned: ready?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});