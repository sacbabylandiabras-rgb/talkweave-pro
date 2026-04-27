// Atualiza nome, descrições e comandos de um bot do usuário via Telegram Bot API.
// Requer: bot_id (uuid), e qualquer combinação de: name, short_description, description, commands[]
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function tg(token: string, method: string, payload: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(`${method} falhou: ${json.description || res.statusText}`);
  }
  return json.result;
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
    const botUuid: string = body?.bot_id;
    if (!botUuid) {
      return new Response(JSON.stringify({ error: "bot_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: bot, error: botErr } = await admin
      .from("telegram_bots")
      .select("*")
      .eq("id", botUuid)
      .eq("user_id", user.id)
      .single();

    if (botErr || !bot) {
      return new Response(JSON.stringify({ error: "Bot não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = bot.bot_token;
    const updates: Record<string, unknown> = {};
    const applied: string[] = [];

    if (typeof body.name === "string" && body.name.trim()) {
      const name = body.name.trim().slice(0, 64);
      await tg(token, "setMyName", { name });
      updates.first_name = name;
      applied.push("name");
    }

    if (typeof body.short_description === "string") {
      const sd = body.short_description.slice(0, 120);
      await tg(token, "setMyShortDescription", { short_description: sd });
      updates.short_description = sd;
      applied.push("short_description");
    }

    if (typeof body.description === "string") {
      const d = body.description.slice(0, 512);
      await tg(token, "setMyDescription", { description: d });
      updates.description = d;
      applied.push("description");
    }

    if (Array.isArray(body.commands)) {
      const cleaned = body.commands
        .filter((c: any) => c && typeof c.command === "string" && c.command.trim())
        .slice(0, 100)
        .map((c: any, i: number) => ({
          command: String(c.command).replace(/^\//, "").toLowerCase().slice(0, 32),
          description: String(c.description || "").slice(0, 256),
          sort_order: i,
        }));

      await tg(token, "setMyCommands", {
        commands: cleaned.map(({ command, description }) => ({ command, description })),
      });

      // Persiste comandos
      await admin.from("telegram_bot_commands").delete().eq("bot_id", botUuid);
      if (cleaned.length > 0) {
        await admin.from("telegram_bot_commands").insert(
          cleaned.map((c) => ({
            bot_id: botUuid,
            user_id: user.id,
            command: c.command,
            description: c.description,
            sort_order: c.sort_order,
          })),
        );
      }
      applied.push("commands");
    }

    if (Object.keys(updates).length > 0) {
      await admin.from("telegram_bots").update(updates).eq("id", botUuid);
    }

    return new Response(JSON.stringify({ ok: true, applied }), {
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