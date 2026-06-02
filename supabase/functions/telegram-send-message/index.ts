import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseServiceKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uerr } = await userClient.auth.getUser(token);
    if (uerr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { bot_id, chat_id, text } = body || {};
    if (!bot_id || !chat_id || !text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "bot_id, chat_id e text são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: bot, error: berr } = await admin
      .from("telegram_bots")
      .select("bot_token, user_id")
      .eq("id", bot_id)
      .single();
    if (berr || !bot || bot.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "bot não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text }),
    });
    const tgJson = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || !tgJson.ok) {
      return new Response(JSON.stringify({ error: tgJson.description || "Falha ao enviar" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Persist outgoing message so it appears in the in-app chat view.
    try {
      const r = tgJson.result ?? {};
      const syntheticUpdateId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
      await admin.from("telegram_messages").insert({
        bot_id: bot_id,
        user_id: user.id,
        update_id: syntheticUpdateId,
        chat_id: r.chat?.id ?? chat_id,
        from_user_id: r.from?.id ?? null,
        from_username: r.from?.username ?? null,
        from_first_name: r.from?.first_name ?? "Bot",
        message_type: "message",
        text: r.text ?? text,
        raw_update: { message: { ...r, from: { ...(r.from || {}), is_bot: true } } },
      });
    } catch (e) {
      console.warn("persist outgoing failed:", (e as Error).message);
    }

    return new Response(JSON.stringify({ ok: true, message_id: tgJson.result?.message_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});