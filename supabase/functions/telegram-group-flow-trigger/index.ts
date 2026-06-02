// Inicia uma execução de fluxo dentro do grupo de prévia.
// Pode ser chamado pelo frontend (manual) ou por outras edge functions (keyword/scheduled).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc);

    const body = await req.json().catch(() => ({}));
    const {
      flow_id,
      bot_id,
      chat_id: chatIdInput,
      from_user_id = null,
      from_username = null,
      trigger_source = "manual",
    } = body || {};

    if (!flow_id) return json({ error: "flow_id obrigatório" }, 400);

    // Quando vem do frontend, valida o usuário. Quando vem de outra função (service role), pula auth.
    const auth = req.headers.get("Authorization") || "";
    const isService = auth.includes(svc);
    let requesterUserId: string | null = null;
    if (!isService) {
      if (!auth) return json({ error: "unauthorized" }, 401);
      const userClient = createClient(url, svc, { global: { headers: { Authorization: auth } } });
      const token = auth.replace(/^Bearer\s+/i, "");
      const { data: { user }, error: uErr } = await userClient.auth.getUser(token);
      if (uErr || !user) return json({ error: "unauthorized" }, 401);
      requesterUserId = user.id;
    }

    const { data: flow } = await admin
      .from("telegram_group_flows")
      .select("*")
      .eq("id", flow_id)
      .maybeSingle();
    if (!flow) return json({ error: "flow_not_found" }, 404);
    if (requesterUserId && flow.user_id !== requesterUserId) return json({ error: "forbidden" }, 403);
    if (!flow.is_active) return json({ error: "flow_inactive" }, 400);

    if (trigger_source === "manual" && flow.trigger_type === "scheduled" && flow.next_run_at) {
      const scheduledAt = new Date(flow.next_run_at).getTime();
      if (Number.isFinite(scheduledAt) && scheduledAt > Date.now()) {
        return json({
          error: "flow_scheduled_pending",
          scheduled_at: flow.next_run_at,
          message: "Este fluxo está agendado e só será disparado no horário definido.",
        }, 409);
      }
    }

    const effectiveBotId = bot_id || flow.bot_id;
    if (effectiveBotId !== flow.bot_id) return json({ error: "bot_mismatch" }, 400);

    // Resolve chat_id (Canal Free do bot) se não passado
    let chatId = chatIdInput ? Number(chatIdInput) : null;
    if (!chatId) {
      // Preferimos o chat_id salvo no próprio fluxo (grupos/canais customizados)
      if (flow.chat_id != null) {
        chatId = Number(flow.chat_id);
      }
    }
    if (!chatId) {
      const { data: ch } = await admin
        .from("telegram_free_channels")
        .select("chat_id")
        .eq("bot_id", flow.bot_id)
        .maybeSingle();
      if (!ch?.chat_id) return json({ error: "canal_não_configurado" }, 400);
      chatId = ch.chat_id;
    }

    const startNodeId = flow.start_node_id || (Array.isArray(flow.nodes) && flow.nodes[0]?.id) || null;
    if (!startNodeId) return json({ error: "flow_sem_nó_inicial" }, 400);

    const { data: run, error: rErr } = await admin
      .from("telegram_group_flow_runs")
      .insert({
        flow_id: flow.id,
        user_id: flow.user_id,
        bot_id: flow.bot_id,
        chat_id: chatId,
        triggered_by_user_id: from_user_id,
        triggered_by_username: from_username,
        trigger_source,
        current_node_id: startNodeId,
        status: "running",
        next_run_at: new Date().toISOString(),
        context: { variables: {} },
      })
      .select("id")
      .single();
    if (rErr) return json({ error: rErr.message }, 500);

    await admin
      .from("telegram_group_flows")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", flow.id);

    // Dispara o tick imediatamente para não esperar 1 min
    const tickUrl = `${url}/functions/v1/telegram-group-flow-tick`;
    fetch(tickUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${svc}` },
      body: JSON.stringify({ run_id: run!.id }),
    }).catch(() => {});

    return json({ ok: true, run_id: run!.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});