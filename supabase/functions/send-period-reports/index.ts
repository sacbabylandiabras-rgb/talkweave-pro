import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Slots em horário de Brasília (UTC-3): 00h, 08h, 12h, 16h30, 18h
// NOTA: 16h30 será tratado como 16:30, precisamos de um tratamento especial
// Para simplificar, usaremos [0, 8, 12, 16.5, 18] ou separamos logicamente
// Vamos manter [0, 8, 12, 18] e adicionar um cron separado para 16:30
const SLOTS = [0, 8, 12, 16.5, 18];

// Janelas: relatório das X horas cobre o período desde o slot anterior
function previousSlot(hourBRT: number, minutesBRT: number = 0): number {
  const currentSlot = hourBRT + minutesBRT / 60;
  // Encontra o slot anterior mais próximo
  const sortedSlots = [...SLOTS].sort((a, b) => a - b);
  for (let i = sortedSlots.length - 1; i >= 0; i--) {
    if (sortedSlots[i] < currentSlot) {
      return sortedSlots[i];
    }
  }
  return sortedSlots[sortedSlots.length - 1]; // volta ao último do dia anterior
}

function brtNow(): { y: number; m: number; d: number; h: number; min: number } {
  const utc = new Date();
  const brt = new Date(utc.getTime() - 3 * 60 * 60 * 1000);
  return {
    y: brt.getUTCFullYear(),
    m: brt.getUTCMonth() + 1,
    d: brt.getUTCDate(),
    h: brt.getUTCHours(),
    min: brt.getUTCMinutes(),
  };
}

function brtSlotToUtcDate(y: number, m: number, d: number, slotBRT: number): Date {
  // BRT = UTC-3, então hora UTC = hora BRT + 3
  const hBRT = Math.floor(slotBRT);
  const minBRT = Math.round((slotBRT % 1) * 60);
  return new Date(Date.UTC(y, m - 1, d, hBRT + 3, minBRT, 0));
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
    let currentSlot = force !== null ? parseFloat(force) : now.h + now.min / 60;

    // Encontra o slot ativo (com tolerância de 5min antes/depois)
    const tolerance = 5 / 60; // 5 minutos em horas
    const matchingSlot = SLOTS.find(s => Math.abs(s - currentSlot) < tolerance);
    if (!matchingSlot) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `Hora BRT ${now.h}:${String(now.min).padStart(2, "0")} não corresponde a nenhum slot`, slots: SLOTS }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    currentSlot = matchingSlot;

    // Janela: do slot anterior até agora (em UTC)
    const prevSlot = previousSlot(now.h, now.min);
    let endUtc = brtSlotToUtcDate(now.y, now.m, now.d, currentSlot);
    let startUtc: Date;
    if (prevSlot > currentSlot) {
      // Slot anterior é do dia anterior em BRT
      startUtc = brtSlotToUtcDate(now.y, now.m, now.d, prevSlot);
      startUtc = new Date(startUtc.getTime() - 24 * 60 * 60 * 1000);
    } else {
      startUtc = brtSlotToUtcDate(now.y, now.m, now.d, prevSlot);
    }

    const slotHour = Math.floor(currentSlot);
    const slotMin = Math.round((currentSlot % 1) * 60);
    const slotKey = `${now.y}-${String(now.m).padStart(2, "0")}-${String(now.d).padStart(2, "0")}-${String(slotHour).padStart(2, "0")}${String(slotMin).padStart(2, "0")}`;

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

      // Contar mensagens enviadas (campaign_sends)
      const { count: msgCount } = await supabase
        .from("campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("sent_at", startUtc.toISOString())
        .lt("sent_at", endUtc.toISOString());

      // Contar vendas de HOJE (não apenas do período do slot)
      const { data: sales } = await supabase
        .from("gateway_transactions")
        .select("amount, status, created_at")
        .eq("user_id", userId)
        .in("status", ["paid", "approved", "completed"])
        .gte("created_at", new Date(now.y, now.m - 1, now.d).toISOString())
        .lt("created_at", new Date(now.y, now.m - 1, now.d + 1).toISOString());

      const salesCount = sales?.length || 0;
      const salesAmount = (sales || []).reduce((s: number, x: any) => s + (x.amount || 0), 0);

      const messagesSent = msgCount || 0;

      // Formato do relatório
      const horaLabel = `${String(slotHour).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`;
      const title = `Relatório Atualizado ✅`;
      const body = `Vendas: ${formatBRL(salesAmount)} (${salesCount} vendas)\nEnviadas: ${messagesSent.toLocaleString("pt-BR")}`;

      // Log do que será enviado
      if (salesCount > 0) {
        console.log(`[send-period-reports] User ${userId}: ${messagesSent} msgs, ${salesCount} vendas, R$ ${formatBRL(salesAmount)}`);
      } else {
        console.log(`[send-period-reports] User ${userId}: ${messagesSent} msgs, 0 vendas`);
      }

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
              event_type: "report",
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
        slot: slotHour,
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
