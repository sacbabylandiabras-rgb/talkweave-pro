// Avança execuções de fluxos em andamento dentro do grupo de prévia.
// Executa nós sequencialmente: message, delay, condition, random, end.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_STEPS_PER_RUN = 25;
const MAX_RUNS_PER_TICK = 50;
const MAX_SCHEDULED_FLOWS_PER_TICK = 50;

type Node = {
  id: string;
  type: "message" | "delay" | "condition" | "random" | "end";
  data: any;
};
type Edge = { id?: string; source: string; target: string; sourceHandle?: string | null };

function buildKeyboard(buttons: any[]) {
  const rows: any[][] = [];
  for (const b of Array.isArray(buttons) ? buttons : []) {
    const text = String(b?.text || "").trim();
    const url = String(b?.url || "").trim();
    if (!text || !url) continue;
    try { new URL(url); } catch { continue; }
    rows.push([{ text, url }]);
  }
  return rows.length ? { inline_keyboard: rows } : undefined;
}

async function sendTelegram(botToken: string, contentType: string, payload: any) {
  const method = contentType === "photo" ? "sendPhoto"
    : contentType === "video" ? "sendVideo"
    : contentType === "document" ? "sendDocument"
    : "sendMessage";
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.ok, json };
}

function findNextNode(nodes: Node[], edges: Edge[], currentId: string, handle?: string | null): Node | null {
  const candidates = edges.filter((e) =>
    e.source === currentId && (handle == null || (e.sourceHandle ?? null) === handle)
  );
  if (candidates.length === 0) return null;
  const target = candidates[0].target;
  return nodes.find((n) => n.id === target) || null;
}

function applyVars(text: string, ctx: any): string {
  if (!text) return text;
  const vars = ctx?.variables || {};
  return text.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ctx?.[k] ?? `{${k}}`));
}

function evalCondition(node: Node, ctx: any): boolean {
  const cfg = node.data?.config || {};
  const now = new Date();
  if (cfg.kind === "time_range") {
    const [sh, sm] = String(cfg.start || "00:00").split(":").map(Number);
    const [eh, em] = String(cfg.end || "23:59").split(":").map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
  }
  if (cfg.kind === "weekday") {
    const allowed: number[] = Array.isArray(cfg.days) ? cfg.days.map(Number) : [];
    return allowed.includes(now.getDay());
  }
  return true;
}

async function processRun(admin: any, run: any) {
  const { data: flow } = await admin
    .from("telegram_group_flows")
    .select("nodes, edges, bot_id, trigger_type, trigger_config")
    .eq("id", run.flow_id)
    .maybeSingle();
  if (!flow) {
    await admin.from("telegram_group_flow_runs").update({
      status: "failed", last_error: "flow_deleted", next_run_at: null,
    }).eq("id", run.id);
    return;
  }

  if (run.trigger_source === "manual" && flow.trigger_type === "scheduled") {
    const scheduledAt = new Date(flow.trigger_config?.scheduled_at || "").getTime();
    const runCreatedAt = new Date(run.created_at || "").getTime();
    if (Number.isFinite(scheduledAt) && Number.isFinite(runCreatedAt) && runCreatedAt < scheduledAt) {
      await admin.from("telegram_group_flow_runs").update({
        status: "failed",
        last_error: "manual_run_before_schedule_cancelled",
        next_run_at: null,
      }).eq("id", run.id);
      return;
    }
  }

  const { data: bot } = await admin
    .from("telegram_bots")
    .select("bot_token")
    .eq("id", flow.bot_id)
    .maybeSingle();
  if (!bot?.bot_token) {
    await admin.from("telegram_group_flow_runs").update({
      status: "failed", last_error: "bot_missing", next_run_at: null,
    }).eq("id", run.id);
    return;
  }

  const nodes: Node[] = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges: Edge[] = Array.isArray(flow.edges) ? flow.edges : [];
  let currentId: string | null = run.current_node_id;
  let ctx = run.context || { variables: {} };
  let stepCount = run.step_count || 0;

  for (let i = 0; i < MAX_STEPS_PER_RUN; i++) {
    if (!currentId) break;
    const node = nodes.find((n) => n.id === currentId);
    if (!node) {
      await admin.from("telegram_group_flow_runs").update({
        status: "failed", last_error: `node_not_found:${currentId}`, next_run_at: null,
      }).eq("id", run.id);
      return;
    }

    stepCount++;

    if (node.type === "end") {
      await admin.from("telegram_group_flow_runs").update({
        status: "completed", current_node_id: null, next_run_at: null,
        step_count: stepCount, context: ctx,
      }).eq("id", run.id);
      return;
    }

    if (node.type === "message") {
      const d = node.data || {};
      const contentType = ["text", "photo", "video", "document"].includes(d.content_type)
        ? d.content_type : "text";
      const text = applyVars(String(d.text || ""), ctx);
      const reply_markup = buildKeyboard(d.buttons || []);
      const payload: any = { chat_id: run.chat_id };
      if (contentType === "text") {
        if (!text.trim()) {
          // skip empty
        } else {
          payload.text = text;
          payload.parse_mode = "HTML";
        }
      } else {
        if (!d.media_url) {
          await admin.from("telegram_group_flow_runs").update({
            status: "failed", last_error: `node_${node.id}:media_missing`, next_run_at: null,
          }).eq("id", run.id);
          return;
        }
        payload[contentType] = d.media_url;
        if (text) payload.caption = text;
        payload.parse_mode = "HTML";
      }
      if (reply_markup) payload.reply_markup = reply_markup;

      if (payload.text || payload[contentType]) {
        const tg = await sendTelegram(bot.bot_token, contentType, payload);
        if (!tg.ok) {
          await admin.from("telegram_group_flow_runs").update({
            status: "failed",
            last_error: String(tg.json?.description || "send_failed"),
            next_run_at: null,
            step_count: stepCount,
            current_node_id: currentId,
            context: ctx,
          }).eq("id", run.id);
          return;
        }
      }
      const next = findNextNode(nodes, edges, currentId);
      currentId = next?.id || null;
      continue;
    }

    if (node.type === "delay") {
      const d = node.data || {};
      let resumeAtIso: string;
      if (d.mode === "until" && d.until) {
        const untilMs = new Date(d.until).getTime();
        if (!Number.isFinite(untilMs)) {
          resumeAtIso = new Date(Date.now() + 60 * 1000).toISOString();
        } else if (untilMs <= Date.now()) {
          // Já passou — segue imediatamente
          const next = findNextNode(nodes, edges, currentId);
          currentId = next?.id || null;
          continue;
        } else {
          resumeAtIso = new Date(untilMs).toISOString();
        }
      } else {
        const seconds = Math.max(1, Number(d.seconds) || (Number(d.minutes) || 0) * 60 || 60);
        resumeAtIso = new Date(Date.now() + seconds * 1000).toISOString();
      }
      const next = findNextNode(nodes, edges, currentId);
      const nextId = next?.id || null;
      await admin.from("telegram_group_flow_runs").update({
        current_node_id: nextId,
        next_run_at: resumeAtIso,
        step_count: stepCount,
        context: ctx,
      }).eq("id", run.id);
      if (!nextId) {
        await admin.from("telegram_group_flow_runs").update({
          status: "completed", next_run_at: null,
        }).eq("id", run.id);
      }
      return; // pausa até next_run_at
    }

    if (node.type === "condition") {
      const ok = evalCondition(node, ctx);
      const next = findNextNode(nodes, edges, currentId, ok ? "true" : "false");
      currentId = next?.id || null;
      continue;
    }

    if (node.type === "random") {
      const outs = edges.filter((e) => e.source === currentId);
      if (outs.length === 0) { currentId = null; continue; }
      const pick = outs[Math.floor(Math.random() * outs.length)];
      currentId = pick.target;
      continue;
    }

    // tipo desconhecido — segue para próximo
    const next = findNextNode(nodes, edges, currentId);
    currentId = next?.id || null;
  }

  if (!currentId) {
    await admin.from("telegram_group_flow_runs").update({
      status: "completed", current_node_id: null, next_run_at: null,
      step_count: stepCount, context: ctx,
    }).eq("id", run.id);
  } else {
    // hit MAX_STEPS — agenda continuação
    await admin.from("telegram_group_flow_runs").update({
      current_node_id: currentId,
      next_run_at: new Date(Date.now() + 5_000).toISOString(),
      step_count: stepCount, context: ctx,
    }).eq("id", run.id);
  }
}

function getScheduledAtMs(flow: any): number | null {
  const raw = flow?.next_run_at || flow?.trigger_config?.scheduled_at;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

async function resolveFlowChatId(admin: any, flow: any): Promise<number | null> {
  if (flow?.chat_id != null) {
    const directChatId = Number(flow.chat_id);
    if (Number.isFinite(directChatId)) return directChatId;
  }

  const { data: ch } = await admin
    .from("telegram_free_channels")
    .select("chat_id")
    .eq("bot_id", flow.bot_id)
    .maybeSingle();

  if (!ch?.chat_id) return null;
  const channelChatId = Number(ch.chat_id);
  return Number.isFinite(channelChatId) ? channelChatId : null;
}

async function startFlowRunFromTick(admin: any, flow: any) {
  const scheduledAtMs = getScheduledAtMs(flow);
  const scheduledAtIso = scheduledAtMs ? new Date(scheduledAtMs).toISOString() : new Date().toISOString();
  const startNodeId = flow.start_node_id || (Array.isArray(flow.nodes) && flow.nodes[0]?.id) || null;
  if (!startNodeId) return { ok: false, error: "flow_sem_nó_inicial" };

  const chatId = await resolveFlowChatId(admin, flow);
  if (!chatId) return { ok: false, error: "canal_não_configurado" };

  // Evita duplicar se dois ticks pegarem o mesmo agendamento ao mesmo tempo.
  const { data: existing } = await admin
    .from("telegram_group_flow_runs")
    .select("id")
    .eq("flow_id", flow.id)
    .eq("trigger_source", flow.trigger_type)
    .gte("created_at", new Date(new Date(scheduledAtIso).getTime() - 60_000).toISOString())
    .limit(1)
    .maybeSingle();
  if (existing?.id) return { ok: true, duplicate: true };

  const { data: run, error } = await admin
    .from("telegram_group_flow_runs")
    .insert({
      flow_id: flow.id,
      user_id: flow.user_id,
      bot_id: flow.bot_id,
      chat_id: chatId,
      trigger_source: flow.trigger_type,
      current_node_id: startNodeId,
      status: "running",
      next_run_at: new Date().toISOString(),
      context: { variables: {} },
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await admin
    .from("telegram_group_flows")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", flow.id);

  return { ok: true, run_id: run?.id };
}

async function processScheduledFlows(admin: any) {
  const nowMs = Date.now();
  const { data: flows } = await admin
    .from("telegram_group_flows")
    .select("*")
    .eq("is_active", true)
    .in("trigger_type", ["scheduled", "recurring"])
    .limit(MAX_SCHEDULED_FLOWS_PER_TICK);

  for (const f of flows ?? []) {
    const dueMs = getScheduledAtMs(f);
    if (!dueMs || dueMs > nowMs) continue;
    if (f.trigger_type === "scheduled") {
      const lastRunMs = f.last_run_at ? new Date(f.last_run_at).getTime() : 0;
      if (Number.isFinite(lastRunMs) && lastRunMs >= dueMs) continue;
    }

    const started = await startFlowRunFromTick(admin, f);
    if (!started.ok) {
      console.warn("scheduled flow start failed", f.id, started.error);
      continue;
    }

    // calcula próximo run
    let nextRun: string | null = null;
    if (f.trigger_type === "recurring") {
      const minutes = Number(f.trigger_config?.interval_minutes) || 60;
      nextRun = new Date(Date.now() + minutes * 60_000).toISOString();
    }
    await admin.from("telegram_group_flows").update({ next_run_at: nextRun }).eq("id", f.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json().catch(() => ({}));
  const targetRunId = body?.run_id || null;

  // 1. Processa agendamentos (apenas no tick "global", não em chamadas pontuais)
  if (!targetRunId) {
    await processScheduledFlows(admin).catch((e) =>
      console.warn("scheduled flows tick failed", (e as Error).message)
    );
  }

  // 2. Avança runs pendentes
  const nowIso = new Date().toISOString();
  let query = admin
    .from("telegram_group_flow_runs")
    .select("*")
    .eq("status", "running")
    .lte("next_run_at", nowIso)
    .limit(MAX_RUNS_PER_TICK);

  if (targetRunId) {
    query = admin
      .from("telegram_group_flow_runs")
      .select("*")
      .eq("id", targetRunId)
      .eq("status", "running")
      .limit(1);
  }

  const { data: runs, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0, errors = 0;
  for (const run of runs ?? []) {
    try {
      await processRun(admin, run);
      processed++;
    } catch (e) {
      errors++;
      console.error("processRun error", (e as Error).message);
      await admin.from("telegram_group_flow_runs").update({
        status: "failed", last_error: (e as Error).message, next_run_at: null,
      }).eq("id", run.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed, errors, scanned: runs?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});