import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Envia mensagens DENTRO dos grupos de aquecimento.
 *
 * Para cada link ativo (warmup_group_links com group_jid resolvido):
 *  - Seleciona instâncias que JÁ entraram no grupo (warmup_group_joins.status='success')
 *    + as doadoras UAZAPI (admins) que vivem no grupo.
 *  - Cada participante envia uma mensagem aleatória do pool warmup_messages no grupo.
 *  - Pequeno lote por ciclo (batchSize) para não floodar.
 *
 * Body opcional: { batchSize?: number }
 *
 * Não requer auth (rodado em background pelo client). Mas valida JWT para evitar abuso.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const token = auth.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    // batchSize define quantas instâncias enviam por grupo neste ciclo.
    // Default subiu para 6 para garantir participação das Z-APIs do usuário, não só da doadora.
    const batchSize = Math.max(1, Math.min(50, Number(body?.batchSize) || 6));
    const sendAll = body?.sendAll === true;
    const runId = typeof body?.runId === "string" ? body.runId : "";
    const cycleId = crypto.randomUUID();

    const isRunAllowed = async () => {
      if (!runId) return false;
      const { data, error } = await admin
        .from("warmup_instance_health")
        .select("detail")
        .eq("instance_ref", user.id)
        .eq("block_type", "warmup_control")
        .maybeSingle();
      if (error) {
        console.log("warmup group control check failed:", error.message);
        return false;
      }
      if (!data) return false;
      const detail = JSON.parse(String(data.detail || "{}"));
      return detail.active === true && detail.runId === runId;
    };

    if (!(await isRunAllowed())) {
      return json({ sent: 0, failed: 0, stopped: true, skipped: "paused" });
    }

    // 1) Pool de mensagens
    const { data: poolMsgs } = await admin
      .from("warmup_messages")
      .select("content")
      .eq("active", true);
    const conversations = (poolMsgs || [])
      .map((r: any) => {
        const raw = String(r.content || "").trim();
        const sepIdx = raw.indexOf("||");
        return {
          question: (sepIdx >= 0 ? raw.slice(0, sepIdx) : raw).trim(),
          answer: (sepIdx >= 0 ? raw.slice(sepIdx + 2) : "").trim(),
        };
      })
      .filter((m: any) => m.question.length > 0);
    const autoReplies = [
      "verdade", "sim, sim", "boa! 🙂", "show", "top", "concordo", "uhum",
      "pois é", "também acho", "tranquilo", "perfeito", "massa", "entendi",
    ];
    if (conversations.length === 0) return json({ sent: 0, skipped: "no messages" });

    // 2) Links ativos COM group_jid resolvido
    const { data: links } = await admin
      .from("warmup_group_links")
      .select("id, group_jid, invite_url")
      .eq("active", true)
      .not("group_jid", "is", null);
    if (!links || links.length === 0) return json({ sent: 0, skipped: "no resolved groups" });

    // 3) Joins por link
    const linkIds = links.map((l: any) => l.id);
    const { data: joins } = await admin
      .from("warmup_group_joins")
      .select("instance_id, link_id")
      .in("link_id", linkIds)
      .eq("status", "success");

    const joinedByLink = new Map<string, string[]>();
    for (const j of joins || []) {
      const arr = joinedByLink.get(j.link_id) || [];
      arr.push(j.instance_id);
      joinedByLink.set(j.link_id, arr);
    }

    // 4) Credenciais das instâncias alvo (somente Z-API conversa no grupo)
    const allInstanceIds = Array.from(new Set((joins || []).map((j: any) => j.instance_id)));
    const instanceById = new Map<string, any>();
    if (allInstanceIds.length > 0) {
      const { data: insts } = await admin
        .from("zapi_instances")
        .select("id, instance_name, api_provider, zapi_instance_id, zapi_token, zapi_client_token, evolution_api_url, evolution_api_key")
        .in("id", allInstanceIds);
      for (const inst of insts || []) instanceById.set(inst.id, inst);
    }

    const pickRandom = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    const sendInGroup = async (sender: any, groupJid: string, text: string) => {
      const provider = String(sender.api_provider || sender.kind || "").toLowerCase();
      const groupZapiId = groupJid.endsWith("-group")
        ? groupJid
        : `${groupJid.replace(/@g\.us$/i, "")}-group`;
      try {
        if (provider === "uazapi") {
          const apiUrl = String(sender.evolution_api_url || sender.apiUrl || "").replace(/\/+$/, "");
          const apiToken = String(sender.evolution_api_key || sender.zapi_token || sender.apiToken || "");
          if (!apiUrl || !apiToken) return { ok: false, status: 0, body: "missing uazapi creds" };
          const r = await fetch(`${apiUrl}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: apiToken },
            body: JSON.stringify({ number: groupJid, text }),
          });
          const t = await r.text().catch(() => "");
          return { ok: r.ok, status: r.status, body: t.slice(0, 200) };
        } else {
          // Z-API: mensagens em grupo exigem o identificador normalizado com sufixo -group.
          const url = `https://api.z-api.io/instances/${sender.zapi_instance_id}/token/${sender.zapi_token}/send-text`;
          const r = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": String(sender.zapi_client_token || ""),
            },
            body: JSON.stringify({ phone: groupZapiId, message: text }),
          });
          const t = await r.text().catch(() => "");
          return { ok: r.ok, status: r.status, body: t.slice(0, 200) };
        }
      } catch (e: any) {
        return { ok: false, status: 0, body: e?.message || "fetch error" };
      }
    };

    let sent = 0;
    let failed = 0;
    const log: any[] = [];
    const dbLogs: any[] = [];

    for (const link of links) {
      const groupJid = String(link.group_jid || "");
      if (!groupJid) continue;

      // Apenas instâncias Z-API do usuário que entraram no grupo conversam.
      // As doadoras UAZAPI ficam de fora (apenas garantem o grupo existir).
      const senders: any[] = [];
      const joinedIds = joinedByLink.get(link.id) || [];
      for (const id of joinedIds) {
        const inst = instanceById.get(id);
        if (!inst) continue;
        const provider = String(inst.api_provider || "zapi").toLowerCase();
        if (provider !== "zapi") continue;
        senders.push({ ...inst, kind: "zapi" });
      }

      if (senders.length === 0) continue;

      // Embaralha
      const shuffledAll = senders.sort(() => Math.random() - 0.5);
      const participantTarget = sendAll ? shuffledAll.length : Math.min(batchSize, shuffledAll.length);
      const shuffled = shuffledAll.slice(0, participantTarget);

      // Mantém uma fila de "reservas" para repor quando alguém falhar.
      const used = new Set(shuffled.map((s) => s.id || s.dbId));
      const reserves = shuffledAll.filter((s) => !used.has(s.id || s.dbId));

      const queue = [...shuffled];
      const maxConversations = Math.floor(participantTarget / 2);
      let conversationsDone = 0;
      while (queue.length > 1 && conversationsDone < maxConversations) {
        if (!(await isRunAllowed())) break;
        conversationsDone++;
        const sender = queue.shift();
        const responder = queue.shift();
        if (!sender || !responder) break;
        const convo = pickRandom(conversations);
        const firstText = convo.question;
        const secondText = convo.answer || pickRandom(autoReplies);
        let res;
        try {
          if (!(await isRunAllowed())) break;
          res = await sendInGroup(sender, groupJid, firstText);
        } catch (e: any) {
          res = { ok: false, status: 0, body: e?.message || "send threw" };
        }
        const senderName = sender.instance_name || sender.name || "";
        const senderProvider = String(sender.api_provider || sender.kind || "").toLowerCase() || "uazapi";
        const senderId = sender.id || sender.dbId || null;
        if (res.ok) {
          sent++;
          log.push({ link: link.id, sender: senderName, ok: true });
          dbLogs.push({
            cycle_id: cycleId,
            link_id: link.id,
            group_jid: groupJid,
            sender_instance_id: senderId,
            sender_name: senderName,
            sender_provider: senderProvider,
            status: "success",
            http_status: res.status,
            message_preview: firstText.slice(0, 200),
          });
        } else {
          failed++;
          log.push({
            link: link.id,
            sender: senderName,
            status: res.status,
            body: res.body,
          });
          dbLogs.push({
            cycle_id: cycleId,
            link_id: link.id,
            group_jid: groupJid,
            sender_instance_id: senderId,
            sender_name: senderName,
            sender_provider: senderProvider,
            status: "error",
            http_status: res.status,
            error_message: String(res.body || "").slice(0, 500),
            message_preview: firstText.slice(0, 200),
          });
          // Repõe com uma reserva (até esgotar) se NÃO for sendAll
          if (!sendAll && reserves.length > 0) {
            const replacement = reserves.shift();
            if (replacement) queue.push(replacement);
          }
        }
        if (res.ok) {
          await new Promise((r) => setTimeout(r, 1200 + Math.random() * 2500));
          if (!(await isRunAllowed())) break;
          if (!(await isRunAllowed())) break;
          const replyRes = await sendInGroup(responder, groupJid, secondText);
          const replyName = responder.instance_name || responder.name || "";
          const replyProvider = String(responder.api_provider || responder.kind || "").toLowerCase() || "uazapi";
          const replyId = responder.id || responder.dbId || null;
          if (replyRes.ok) {
            sent++;
            log.push({ link: link.id, sender: replyName, ok: true, replyTo: senderName });
            dbLogs.push({
              cycle_id: cycleId,
              link_id: link.id,
              group_jid: groupJid,
              sender_instance_id: replyId,
              sender_name: replyName,
              sender_provider: replyProvider,
              status: "success",
              http_status: replyRes.status,
              message_preview: secondText.slice(0, 200),
            });
          } else {
            failed++;
            dbLogs.push({
              cycle_id: cycleId,
              link_id: link.id,
              group_jid: groupJid,
              sender_instance_id: replyId,
              sender_name: replyName,
              sender_provider: replyProvider,
              status: "error",
              http_status: replyRes.status,
              error_message: String(replyRes.body || "").slice(0, 500),
              message_preview: secondText.slice(0, 200),
            });
          }
        }
        // Pausa entre pares para parecer conversa, não disparo.
        if (conversationsDone < maxConversations) {
          await new Promise((r) => setTimeout(r, 1800 + Math.random() * 3000));
          if (!(await isRunAllowed())) break;
        }
      }
    }

    // Persiste logs (em lote)
    if (dbLogs.length > 0) {
      try {
        await admin.from("warmup_group_chat_logs").insert(dbLogs);
      } catch (e: any) {
        console.log("warmup-group-chat: falha ao salvar logs:", e?.message);
      }
    }

    console.log("warmup-group-chat:", { sent, failed, groups: links.length });
    return json({ sent, failed, groups: links.length, cycleId, log: log.slice(0, 30) });
  } catch (e: any) {
    console.error("warmup-group-chat error:", e?.message);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});