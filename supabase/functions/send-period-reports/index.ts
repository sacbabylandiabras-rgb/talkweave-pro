import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Slots em horário de Brasília (UTC-3): 08, 12, 18, 00
const SLOTS = [0, 8, 12, 18];

// Janelas: relatório das X horas cobre o período desde o slot anterior
function previousSlot(hourBRT: number): number {
  const idx = SLOTS.indexOf(hourBRT);
  if (idx <= 0) return SLOTS[SLOTS.length - 1]; // 0 -> 18 (do dia anterior)
  return SLOTS[idx - 1];
}

function brtNow(): { y: number; m: number; d: number; h: number } {
  const utc = new Date();
  const brt = new Date(utc.getTime() - 3 * 60 * 60 * 1000);
  return {
    y: brt.getUTCFullYear(),
    m: brt.getUTCMonth() + 1,
    d: brt.getUTCDate(),
    h: brt.getUTCHours(),
  };
}

function brtSlotToUtcDate(y: number, m: number, d: number, hBRT: number): Date {
  // BRT = UTC-3, então hora UTC = hora BRT + 3
  return new Date(Date.UTC(y, m - 1, d, hBRT + 3, 0, 0));
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force"); // ex: "08" para teste manual
    const dryRun = url.searchParams.get("dry") === "1";

    const now = brtNow();
    const currentHour = force !== null ? parseInt(force) : now.h;

    if (!SLOTS.includes(currentHour)) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `Hora BRT ${currentHour} não é slot`, slots: SLOTS }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Janela: do slot anterior até agora (em UTC)
    const prevHour = previousSlot(currentHour);
    let endUtc = brtSlotToUtcDate(now.y, now.m, now.d, currentHour);
    let startUtc: Date;
    if (currentHour === 0) {
      // 00h cobre 18h até 00h do mesmo dia em BRT (mas em UTC, 18BRT = 21UTC anterior)
      startUtc = brtSlotToUtcDate(now.y, now.m, now.d, prevHour);
      // Como prevHour=18 e currentHour=0, prevHour foi do dia anterior em BRT.
      // Ajuste: se prev > current, prev é do dia anterior
      if (prevHour > currentHour) {
        startUtc = new Date(startUtc.getTime() - 24 * 60 * 60 * 1000);
      }
    } else {
      startUtc = brtSlotToUtcDate(now.y, now.m, now.d, prevHour);
    }

    const slotKey = `${now.y}-${String(now.m).padStart(2, "0")}-${String(now.d).padStart(2, "0")}-${String(currentHour).padStart(2, "0")}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar todos os user_ids que têm push token registrado
    const { data: tokenUsers } = await supabase
      .from("device_push_tokens")
      .select("user_id");

    const userIds = Array.from(new Set((tokenUsers || []).map((t: any) => t.user_id)));

    const results: any[] = [];

    for (const userId of userIds) {
      // Já enviado neste slot?
      const { data: existing } = await supabase
        .from("report_push_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("slot_key", slotKey)
        .maybeSingle();

      if (existing && !force) {
        results.push({ userId, skipped: "already_sent" });
        continue;
      }

      // Contar mensagens enviadas (campaign_sends com status 'sent' ou 'delivered')
      const { count: msgCount } = await supabase
        .from("campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("sent_at", startUtc.toISOString())
        .lt("sent_at", endUtc.toISOString());

      // Contar vendas pagas no período
      const { data: sales } = await supabase
        .from("gateway_transactions")
        .select("amount, status, created_at")
        .eq("user_id", userId)
        .in("status", ["paid", "approved", "completed"])
        .gte("created_at", startUtc.toISOString())
        .lt("created_at", endUtc.toISOString());

      const salesCount = sales?.length || 0;
      const salesAmount = (sales || []).reduce((s: number, x: any) => s + (x.amount || 0), 0);

      const messagesSent = msgCount || 0;

      // Se nada aconteceu, ainda assim mandamos um resumo curto
      const horaLabel = `${String(currentHour).padStart(2, "0")}:00`;
      const title = `💰 Resumo das ${horaLabel}`;
      const parts: string[] = [];
      parts.push(`${messagesSent.toLocaleString("pt-BR")} mensagens enviadas`);
      if (salesCount > 0) {
        parts.push(`${salesCount} venda${salesCount > 1 ? "s" : ""} • ${formatBRL(salesAmount)}`);
      }
      const body = parts.join(" • ");

      if (!dryRun) {
        // Chamar send-push-notification
        const pushRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              user_id: userId,
              title,
              body,
              data: { type: "period_report", slot: String(currentHour) },
            }),
          }
        );
        const pushData = await pushRes.json().catch(() => ({}));

        // Registrar log para idempotência
        await supabase.from("report_push_logs").upsert({
          user_id: userId,
          slot_key: slotKey,
          messages_sent: messagesSent,
          sales_count: salesCount,
          sales_amount: salesAmount,
        }, { onConflict: "user_id,slot_key" });

        results.push({ userId, messagesSent, salesCount, salesAmount, pushSent: pushData.sent ?? 0 });
      } else {
        results.push({ userId, messagesSent, salesCount, salesAmount, dryRun: true });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        slot: currentHour,
        slotKey,
        window: { start: startUtc.toISOString(), end: endUtc.toISOString() },
        usersProcessed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-period-reports error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
