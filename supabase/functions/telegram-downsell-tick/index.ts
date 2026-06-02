import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Downsell {
  id: string;
  user_id: string;
  bot_id: string | null;
  titulo: string;
  plano: string;
  valor_promocional: number;
  minutos: number;
  mensagem: string;
  trigger_type: "pending_sale" | "no_purchase";
  button_label: string | null;
  button_url: string | null;
  status: boolean;
}

function renderMessage(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl ?? "";
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v)).replaceAll(`{{${k}}}`, String(v));
  }
  return out;
}

async function sendTelegram(
  botToken: string,
  chat_id: number | string,
  text: string,
  button?: { label: string; url: string } | null,
) {
  const body: any = { chat_id, text, parse_mode: "HTML", disable_web_page_preview: false };
  if (button?.label && button?.url) {
    body.reply_markup = { inline_keyboard: [[{ text: button.label, url: button.url }]] };
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.ok, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Optional: manual single-downsell test send
  let body: any = {};
  if (req.method === "POST") {
    body = await req.json().catch(() => ({}));
  }

  // ---- Manual test mode ----
  if (body?.mode === "test" && body?.downsell_id && body?.chat_id) {
    const { data: d } = await admin.from("telegram_downsells").select("*").eq("id", body.downsell_id).single();
    if (!d) return new Response(JSON.stringify({ error: "downsell not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: bot } = await admin.from("telegram_bots").select("bot_token").eq("id", d.bot_id).single();
    if (!bot?.bot_token) return new Response(JSON.stringify({ error: "bot não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const text = renderMessage(d.mensagem, {
      titulo: d.titulo, plano: d.plano,
      valor: Number(d.valor_promocional).toFixed(2).replace(".", ","),
      minutos: d.minutos,
    });
    const r = await sendTelegram(
      bot.bot_token,
      body.chat_id,
      text,
      d.button_label && d.button_url ? { label: d.button_label, url: d.button_url } : null,
    );
    return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: r.ok ? 200 : 502 });
  }

  // ---- Cron tick: process all active downsells ----
  const { data: downsells, error } = await admin
    .from("telegram_downsells")
    .select("*")
    .eq("status", true);

  if (error) {
    console.error("load downsells failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let totalSent = 0;
  let totalErrors = 0;

  for (const d of (downsells ?? []) as Downsell[]) {
    if (!d.bot_id) continue;

    const { data: bot } = await admin.from("telegram_bots").select("bot_token").eq("id", d.bot_id).single();
    if (!bot?.bot_token) continue;

    const cutoff = new Date(Date.now() - d.minutos * 60_000).toISOString();
    const targets: { chat_id: number; pending_sale_id: string | null; vars: Record<string, any> }[] = [];

    if (d.trigger_type === "pending_sale") {
      // pending sales older than X min, still pending
      const { data: pendings } = await admin
        .from("telegram_pending_sales")
        .select("id, chat_id, plano, amount")
        .eq("bot_id", d.bot_id)
        .eq("status", "pending")
        .lte("created_at", cutoff)
        .limit(200);
      for (const p of pendings ?? []) {
        targets.push({
          chat_id: Number(p.chat_id),
          pending_sale_id: p.id,
          vars: { plano: p.plano ?? d.plano, valor_original: p.amount ?? 0 },
        });
      }
    } else {
      // no_purchase: first inbound contact older than X min, no paid record exists
      const { data: msgs } = await admin
        .from("telegram_messages")
        .select("chat_id, created_at")
        .eq("bot_id", d.bot_id)
        .gt("update_id", 0) // inbound only
        .lte("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(500);
      const seen = new Set<number>();
      for (const m of msgs ?? []) {
        const cid = Number(m.chat_id);
        if (seen.has(cid)) continue;
        seen.add(cid);
        // skip if there's a paid pending sale already
        const { count: paidCount } = await admin
          .from("telegram_pending_sales")
          .select("id", { count: "exact", head: true })
          .eq("bot_id", d.bot_id)
          .eq("chat_id", cid)
          .eq("status", "paid");
        if ((paidCount ?? 0) > 0) continue;
        targets.push({ chat_id: cid, pending_sale_id: null, vars: {} });
      }
    }

    for (const t of targets) {
      // dedup insert; rely on unique index
      const ins = await admin.from("telegram_downsell_sent").insert({
        downsell_id: d.id,
        bot_id: d.bot_id,
        chat_id: t.chat_id,
        pending_sale_id: t.pending_sale_id,
      }).select("id").single();
      if (ins.error) {
        // already sent
        continue;
      }
      const text = renderMessage(d.mensagem, {
        titulo: d.titulo,
        plano: d.plano,
        valor: Number(d.valor_promocional).toFixed(2).replace(".", ","),
        minutos: d.minutos,
        ...t.vars,
      });
      const r = await sendTelegram(
        bot.bot_token,
        t.chat_id,
        text,
        d.button_label && d.button_url ? { label: d.button_label, url: d.button_url } : null,
      );
      if (r.ok) {
        totalSent++;
        const { data: cur } = await admin.from("telegram_downsells").select("envios").eq("id", d.id).single();
        await admin.from("telegram_downsells").update({ envios: (cur?.envios ?? 0) + 1 }).eq("id", d.id);
      } else {
        totalErrors++;
        console.error("send failed", t.chat_id, r.json);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: totalSent, errors: totalErrors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
