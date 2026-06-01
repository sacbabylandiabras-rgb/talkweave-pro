import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeChannelDestination(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https:\/\/t\.me\//i.test(raw) || /^https:\/\/telegram\.me\//i.test(raw)) return raw;
  if (/^t\.me\//i.test(raw)) return `https://${raw}`;
  const handle = raw.replace(/^@/, "");
  if (/^[a-zA-Z0-9_]{5,32}$/.test(handle)) return `https://t.me/${handle}`;
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug || "").toLowerCase().trim();
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return json({ error: "Link inválido" }, 400);

  const shk = String(body?.shk || "").trim();
  const userAgent = String(body?.userAgent || req.headers.get("user-agent") || "").toLowerCase();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Configuração indisponível" }, 500);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: link, error: linkError } = await admin
    .from("telegram_redirect_links")
    .select("id,user_id,slug,destination_type,destination_bot_id,destination_channel,flow_ids,click_count,active,cloaker,cloaker_v2")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (linkError) {
    console.error("telegram redirect lookup:", linkError.message);
    return json({ error: "Erro ao buscar link" }, 500);
  }
  if (!link) return json({ error: "Link não encontrado ou inativo" }, 404);

  // Cloaker: requires `shk` param and blocks known bots/scrapers
  if (link.cloaker || link.cloaker_v2) {
    if (!shk) {
      return json({ blocked: true, reason: "missing_param" }, 200);
    }
    if (link.cloaker_v2) {
      const botRegex = /(bot|crawler|spider|facebookexternalhit|whatsapp|telegrambot|slackbot|discordbot|twitterbot|linkedinbot|bingpreview|googlebot|adsbot|preview|monitor|curl|wget|python-requests|axios|node-fetch|headless)/i;
      if (!userAgent || botRegex.test(userAgent)) {
        return json({ blocked: true, reason: "bot_detected" }, 200);
      }
    }
  }

  let destination = "";
  if (link.destination_type === "channel") {
    destination = normalizeChannelDestination(link.destination_channel || "");
  } else {
    const { data: bot, error: botError } = await admin
      .from("telegram_bots")
      .select("id,user_id,username,active")
      .eq("id", link.destination_bot_id)
      .eq("user_id", link.user_id)
      .eq("active", true)
      .maybeSingle();

    if (botError) {
      console.error("telegram bot lookup:", botError.message);
      return json({ error: "Erro ao buscar bot" }, 500);
    }
    const username = String(bot?.username || "").replace(/^@/, "").trim();
    if (username) {
      const startPayload = `r_${String(link.slug).replace(/-/g, "_").slice(0, 60)}`;
      destination = `https://t.me/${encodeURIComponent(username)}?start=${encodeURIComponent(startPayload)}`;
    }
  }

  if (!destination) return json({ error: "Destino não configurado" }, 404);

  await admin
    .from("telegram_redirect_links")
    .update({ click_count: Number(link.click_count || 0) + 1 })
    .eq("id", link.id);

  return json({ destination });
});