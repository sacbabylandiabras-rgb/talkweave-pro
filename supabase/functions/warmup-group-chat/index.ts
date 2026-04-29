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
    const batchSize = Math.max(1, Math.min(10, Number(body?.batchSize) || 2));
    const cycleId = crypto.randomUUID();

    // 1) Pool de mensagens
    const { data: poolMsgs } = await admin
      .from("warmup_messages")
      .select("content")
      .eq("active", true);
    const messages: string[] = (poolMsgs || [])
      .map((r: any) => String(r.content || "").split("||")[0].trim())
      .filter((s: string) => s.length > 0);
    if (messages.length === 0) return json({ sent: 0, skipped: "no messages" });

    // 2) Links ativos COM group_jid resolvido
    const { data: links } = await admin
      .from("warmup_group_links")
      .select("id, group_jid, invite_url")
      .eq("active", true)
      .not("group_jid", "is", null);
    if (!links || links.length === 0) return json({ sent: 0, skipped: "no resolved groups" });

    // 3) Doadoras UAZAPI (admins do grupo, sempre dentro)
    const { data: donors } = await admin
      .from("zapi_instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key, zapi_token")
      .ilike("api_provider", "uazapi")
      .eq("is_active", true);
    const donorList = (donors || [])
      .map((d: any) => ({
        kind: "uazapi" as const,
        dbId: String(d.id),
        name: String(d.instance_name || ""),
        apiUrl: String(d.evolution_api_url || "").replace(/\/+$/, ""),
        apiToken: String(d.evolution_api_key || d.zapi_token || ""),
      }))
      .filter((d) => d.apiUrl && d.apiToken);

    // 4) Joins por link
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

    // 5) Credenciais das instâncias alvo (Z-API e UAZAPI)
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
      const groupZapiId = groupJid.replace(/@g\.us$/i, "");
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
          // Z-API: send-text com phone = group id (somente dígitos do JID)
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

      // Monta lista de remetentes possíveis: instâncias Z-API que entraram + doadoras UAZAPI
      const senders: any[] = [];
      const joinedIds = joinedByLink.get(link.id) || [];
      for (const id of joinedIds) {
        const inst = instanceById.get(id);
        if (inst) senders.push({ ...inst, kind: String(inst.api_provider || "zapi").toLowerCase() });
      }
      for (const d of donorList) senders.push(d);

      if (senders.length === 0) continue;

      // Embaralha e seleciona até batchSize remetentes únicos por ciclo
      const shuffled = senders.sort(() => Math.random() - 0.5).slice(0, batchSize);

      for (const sender of shuffled) {
        const text = pickRandom(messages);
        const res = await sendInGroup(sender, groupJid, text);
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
            message_preview: text.slice(0, 200),
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
            message_preview: text.slice(0, 200),
          });
        }
        // Pequeno delay entre envios (1.5–4s) para parecer natural
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2500));
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