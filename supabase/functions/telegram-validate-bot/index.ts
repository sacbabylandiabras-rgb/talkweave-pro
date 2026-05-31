// Valida um token de bot do Telegram via getMe e retorna informações do bot.
// Cada usuário cola seu próprio token (gerado pelo BotFather).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isValidToken(t: string): boolean {
  return typeof t === "string" && /^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(t.trim());
}

async function deriveWebhookSecret(botId: string, token: string): Promise<string> {
  const data = new TextEncoder().encode(`telegram-flow-webhook:${botId}:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function setFlowWebhook(botId: string, token: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook?bot_id=${encodeURIComponent(botId)}`;
  const secretToken = await deriveWebhookSecret(botId, token);
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) console.warn("setWebhook failed:", json?.description || res.statusText);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const rawToken: string = (body?.token ?? "").trim();
    const save: boolean = body?.save !== false; // default true

    if (!isValidToken(rawToken)) {
      return new Response(
        JSON.stringify({ error: "Token inválido. Formato esperado: 1234567:AAA..." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Chama getMe direto na API oficial
    const tgRes = await fetch(`https://api.telegram.org/bot${rawToken}/getMe`);
    const tgJson = await tgRes.json();
    if (!tgRes.ok || !tgJson.ok) {
      return new Response(
        JSON.stringify({ error: tgJson.description || "Token rejeitado pelo Telegram" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const me = tgJson.result;

    if (!save) {
      return new Response(JSON.stringify({ ok: true, me }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Salva/atualiza no banco usando service role
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: upserted, error: upErr } = await admin
      .from("telegram_bots")
      .upsert(
        {
          user_id: user.id,
          bot_token: rawToken,
          bot_id: me.id,
          username: me.username,
          first_name: me.first_name,
          active: true,
          last_validated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,bot_token" },
      )
      .select()
      .single();

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garante state row
    await admin
      .from("telegram_bot_state")
      .upsert({ bot_id: upserted.id, update_offset: 0 }, { onConflict: "bot_id" });

    await setFlowWebhook(upserted.id, rawToken);

    return new Response(JSON.stringify({ ok: true, bot: upserted, me }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});