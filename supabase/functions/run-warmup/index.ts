import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Aquecimento de números:
 * - Doadoras = todas instâncias UAZAPI ativas (cadastradas em /admin/aquecimento)
 * - Alvos = números informados pelo usuário em /aquecimento + telefones das instâncias Z-API selecionadas (resolvidos via UAZAPI status)
 *
 * Mensagens podem ser pares conversacionais codificados como "PERGUNTA||RESPOSTA".
 * Quando o motor detecta o separador "||", a doadora envia a PERGUNTA ao alvo e,
 * em seguida, a instância alvo (Z-API selecionada pelo usuário) envia a RESPOSTA
 * de volta à doadora — simulando uma conversa recíproca real.
 *
 * Body: {
 *   targetPhones: string[],
 *   messages: string[],
 *   minDelay: number,  // segundos
 *   maxDelay: number,  // segundos
 *   dailyLimit: number // por instância doadora
 * }
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json({ success: false, error: "Missing Authorization" }, 401);

    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const targetPhones: string[] = Array.isArray(body?.targetPhones) ? body.targetPhones : [];
    const instanceIds: string[] = Array.isArray(body?.instanceIds) ? body.instanceIds : [];
    let messages: string[] = Array.isArray(body?.messages) ? body.messages.filter((m: any) => typeof m === "string" && m.trim()) : [];
    const minDelay = Math.max(2, Number(body?.minDelay) || 10);
    const maxDelay = Math.max(minDelay, Number(body?.maxDelay) || 30);
    const dailyLimit = Math.max(1, Math.min(800, Number(body?.dailyLimit) || 50));
    const isTickMode = body?.mode === "tick" || body?.batchSize !== undefined;
    const targetOffset = Math.max(0, Number(body?.targetOffset) || 0);
    const runId = typeof body?.runId === "string" ? body.runId : "";
    const sendsPerDonor = Math.max(
      1,
      Math.min(dailyLimit, Math.min(20, Number(body?.batchSize) || dailyLimit)),
    );

    const isRunAllowed = async () => {
      const { data, error } = await admin
        .from("warmup_instance_health")
        .select("detail")
        .eq("instance_ref", user.id)
        .eq("block_type", "warmup_control")
        .maybeSingle();
      if (error) {
        console.log("warmup control check failed:", error.message);
        return false;
      }
      if (!data) {
        console.log("warmup control missing: defaulting to paused");
        return false;
      }
      const detail = JSON.parse(String(data.detail || "{}"));
      return detail.active === true && !!runId && detail.runId === runId;
    };

    if (!(await isRunAllowed())) {
      return json({ success: true, stopped: true, message: "Aquecimento pausado" });
    }

    // Se o cliente não enviou mensagens, usa o pool global de admin (warmup_messages ativas)
    if (!messages.length) {
      const { data: poolMsgs } = await admin
        .from("warmup_messages")
        .select("content")
        .eq("active", true);
      messages = (poolMsgs || []).map((r: any) => String(r.content || "")).filter((s: string) => s.trim().length > 0);
    }
    if (!messages.length) {
      return json({ success: false, error: "Nenhuma mensagem disponível (configure em /admin/aquecimento)" }, 400);
    }

    // 1) Buscar instâncias UAZAPI ativas (doadoras) — usadas só como fallback.
    // O aquecimento PV principal agora é P2P entre as Z-APIs selecionadas pelo usuário,
    // porque as doadoras podem estar desconectadas e travavam o envio normal.
    const { data: donors, error: donorsErr } = await admin
      .from("zapi_instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key, zapi_token, is_active")
      .eq("api_provider", "uazapi_warmup")
      .eq("is_active", true);
    if (donorsErr) return json({ success: false, error: donorsErr.message }, 500);

    const normalizePhoneCandidate = (value: unknown, allowPlain = true): string => {
      const raw = String(value || "").trim();
      if (!raw || raw === "true" || raw === "false") return "";
      const jidMatch = raw.match(/(\d{10,15})(?=[:@])/);
      if (!allowPlain && !jidMatch) return "";
      const digits = (jidMatch?.[1] || raw.replace(/\D/g, ""));
      if (digits.length < 10 || digits.length > 15) return "";
      if (/^0+$/.test(digits)) return "";
      return digits;
    };

    // Resolver telefones das instâncias Z-API selecionadas pelo usuário
    // Guardamos também as credenciais para que a instância alvo possa RESPONDER de volta
    type TargetInstance = { phone: string; instanceId: string; token: string; clientToken: string; name: string; dbId: string };
    const targetInstances: TargetInstance[] = [];
    const resolvedFromInstances: string[] = [];
    const disconnectedInstances: { dbId: string; name: string; instanceId: string }[] = [];
    if (instanceIds.length > 0) {
      const { data: userInstances, error: userInstancesErr } = await admin
        .from("zapi_instances")
        .select("id, instance_name, zapi_instance_id, zapi_token, zapi_client_token, api_provider")
        .in("id", instanceIds)
        .eq("user_id", user.id);
      if (userInstancesErr) {
        return json({ success: false, error: userInstancesErr.message }, 500);
      }

      for (const inst of userInstances || []) {
        try {
          const provider = String(inst.api_provider || "zapi").toLowerCase();
          if (provider !== "zapi") continue;
          let phone = "";
          const base = `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}`;
          const headers = { "Client-Token": String(inst.zapi_client_token || "") };
          // Tenta vários endpoints da Z-API que retornam o telefone conectado
          const endpoints = ["/device", "/me", "/profile", "/status", "/phone-code"];
          for (const ep of endpoints) {
            if (phone) break;
            try {
              const r = await fetch(`${base}${ep}`, { headers });
              if (!r.ok) continue;
              const j: any = await r.json().catch(() => ({}));
              const directCandidates = [
                j?.phone, j?.phoneNumber, j?.connectedPhone, j?.connected_phone,
                j?.wid?.user, j?.user, j?.user?.phone, j?.me?.user, j?.me?.phone,
                j?.device?.phone, j?.device?.number,
              ];
              const jidCandidates = [j?.id, j?.wid, j?.user?.id, j?.me?.id];
              for (const cand of directCandidates) {
                const digits = normalizePhoneCandidate(cand, true);
                if (digits) { phone = digits; break; }
              }
              for (const cand of jidCandidates) {
                if (phone) break;
                const digits = normalizePhoneCandidate(cand, false);
                if (digits) { phone = digits; break; }
              }
            } catch (_) { /* try next */ }
          }
          // Fallback: se o instance_name for um telefone (DDI+DDD+número), usa-o
          if (!phone) {
            const nameDigits = String(inst.instance_name || "").replace(/\D/g, "");
            if (nameDigits.length >= 10) {
              phone = normalizePhoneCandidate(nameDigits, true);
              console.log(`↪ ${inst.instance_name}: telefone resolvido via instance_name: ${phone}`);
            }
          }
          if (phone) {
            resolvedFromInstances.push(phone);
            targetInstances.push({
              phone,
              instanceId: String(inst.zapi_instance_id),
              token: String(inst.zapi_token),
              clientToken: String(inst.zapi_client_token || ""),
              name: String(inst.instance_name || ""),
              dbId: String(inst.id),
            });
            console.log(`✓ ${inst.instance_name}: ${phone}`);
          } else {
            console.log(`✗ ${inst.instance_name} (${inst.zapi_instance_id}): telefone NÃO resolvido — alvo será ignorado neste ciclo`);
            disconnectedInstances.push({
              dbId: String(inst.id),
              name: String(inst.instance_name || ""),
              instanceId: String(inst.zapi_instance_id),
            });
          }
        } catch (e) {
          console.log(`erro ao resolver ${inst.instance_name}:`, (e as any)?.message);
          disconnectedInstances.push({
            dbId: String(inst.id),
            name: String(inst.instance_name || ""),
            instanceId: String(inst.zapi_instance_id),
          });
        }
      }
    }

    // Pausa automática: registra as instâncias desconectadas em warmup_instance_health
    // e marca is_active=false para que o usuário precise reconectar antes de voltar.
    if (disconnectedInstances.length > 0) {
      try {
        const nowIso = new Date().toISOString();
        await admin.from("warmup_instance_health").upsert(
          disconnectedInstances.map((d) => ({
            instance_ref: d.dbId,
            phone: null,
            block_type: "disconnected",
            blocked_until: null,
            last_detected_at: nowIso,
            detail: "Conexão WhatsApp desconectada — aquecimento pausado automaticamente. Reconecte a instância para retomar.",
          })),
          { onConflict: "instance_ref,block_type" },
        );
        // Limpa registros antigos de "disconnected" para as instâncias que voltaram
        if (targetInstances.length > 0) {
          await admin
            .from("warmup_instance_health")
            .delete()
            .eq("block_type", "disconnected")
            .in("instance_ref", targetInstances.map((t) => t.dbId));
        }
      } catch (e: any) {
        console.log("⚠ falha ao registrar desconexão:", e?.message);
      }
    } else if (targetInstances.length > 0) {
      // Todas conectadas: limpa qualquer registro residual de "disconnected"
      try {
        await admin
          .from("warmup_instance_health")
          .delete()
          .eq("block_type", "disconnected")
          .in("instance_ref", targetInstances.map((t) => t.dbId));
      } catch (_) { /* ignore */ }
    }

    // Normalizar números alvo (mescla manuais + telefones das instâncias)
    const cleanedTargets = Array.from(
      new Set(
        [...targetPhones, ...resolvedFromInstances]
          .map((p) => String(p || "").replace(/\D/g, ""))
          .filter((p) => p.length >= 8),
      ),
    );

    if (cleanedTargets.length === 0) {
      if (disconnectedInstances.length > 0 && targetPhones.length === 0) {
        const names = disconnectedInstances.map((d) => d.name).filter(Boolean).join(", ");
        return json({
          success: false,
          paused: true,
          disconnected: disconnectedInstances.map((d) => ({ id: d.dbId, name: d.name })),
          error: `Aquecimento pausado: a(s) conexão(ões) WhatsApp ${names || "selecionada(s)"} está(ão) desconectada(s). Reconecte para retomar.`,
        }, 200);
      }
      return json({ success: false, error: "Selecione ao menos uma instância (ou informe contatos extras)" }, 400);
    }

    const pickRandom = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    // Pool de respostas automáticas curtas e naturais — usadas quando a mensagem
    // do template não tem o separador "||" (ou seja, não há resposta pré-definida).
    // O alvo (instância em aquecimento) responderá rapidamente à doadora simulando
    // uma conversa humana.
    const autoReplies = [
      "oi, tudo bem?", "opa, e aí?", "tudo certo por aí?", "boa! 🙂",
      "kkk verdade", "show", "entendi", "perfeito", "valeu!",
      "concordo", "também acho", "interessante", "que legal",
      "verdade", "rsrs", "boa", "👍", "massa", "top!",
      "tranquilo", "demais", "aham", "claro", "com certeza",
      "boa pergunta", "pois é", "sim, sim", "eita", "uhum",
      "ah que bom", "que bom saber", "👏", "🙏",
    ];

    // Helper: dado um telefone, retorna a TargetInstance correspondente (se existir)
    const findTargetInstance = (phone: string): TargetInstance | undefined =>
      targetInstances.find((t) => t.phone === phone);

    const isNewChatCapping = (text: string) =>
      /new_chat_message_capping|message_capping|new chat|capping/i.test(text || "");

    // Extrai cycle_end (ISO) do payload de erro de capping, quando presente.
    const extractCycleEnd = (text: string): string | null => {
      try {
        const m = text.match(/"cycle_end"\s*:\s*"([^"]+)"/i);
        if (m && m[1]) return new Date(m[1]).toISOString();
      } catch (_) { /* ignore */ }
      return null;
    };

    // Registra (upsert) o bloqueio na tabela warmup_instance_health para a UI mostrar.
    const recordCapping = async (
      instanceRef: string,
      phone: string,
      rawBody: string,
    ) => {
      try {
        const blockedUntil = extractCycleEnd(rawBody);
        await admin
          .from("warmup_instance_health")
          .upsert(
            {
              instance_ref: instanceRef,
              phone: phone || null,
              block_type: "new_chat_capping",
              blocked_until: blockedUntil,
              last_detected_at: new Date().toISOString(),
              detail: (rawBody || "").slice(0, 240),
            },
            { onConflict: "instance_ref,block_type" },
          );
      } catch (e: any) {
        console.log(`  ⚠ capping registro falhou: ${e?.message}`);
      }
    };

    // Limpa bloqueio quando um envio dá certo (instância voltou a aceitar).
    const clearCapping = async (instanceRef: string) => {
      try {
        await admin
          .from("warmup_instance_health")
          .delete()
          .eq("instance_ref", instanceRef)
          .eq("block_type", "new_chat_capping");
      } catch (_) { /* ignore */ }
    };

    const sendZapiText = async (inst: TargetInstance, phone: string, message: string) => {
      const zapiUrl = `https://api.z-api.io/instances/${inst.instanceId}/token/${inst.token}/send-text`;
      const response = await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": inst.clientToken,
        },
        body: JSON.stringify({ phone, message }),
      });
      const body = await response.text().catch(() => "");
      return { ok: response.ok, status: response.status, body };
    };

    // ===== Salvar contato na agenda do WhatsApp em AMBOS os lados =====
    // Cache em memória para não re-chamar a API a cada envio (1x por par doadora↔alvo).
    const savedPairs = new Set<string>();

    // Z-API salva o contato (telefone) na agenda do número conectado
    const zapiSaveContact = async (inst: TargetInstance, phone: string, label: string) => {
      try {
        const url = `https://api.z-api.io/instances/${inst.instanceId}/token/${inst.token}/contacts/add`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": inst.clientToken },
          body: JSON.stringify([{ firstName: (label || "Contato").slice(0, 40), phone }]),
        });
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          console.log(`  ⚠ contato (Z-API) não salvo ${inst.name}↔${phone}: HTTP ${r.status} ${t.slice(0, 120)}`);
        }
      } catch (e: any) {
        console.log(`  ⚠ contato (Z-API) erro: ${e?.message}`);
      }
    };

    // UAZAPI salva o contato (telefone) na agenda do número conectado
    const uazapiSaveContact = async (apiUrl: string, apiToken: string, phone: string, label: string) => {
      try {
        const r = await fetch(`${apiUrl}/contact/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: apiToken },
          body: JSON.stringify({ phone, name: (label || "Contato").slice(0, 40) }),
        });
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          console.log(`  ⚠ contato (doadora) não salvo ${phone}: HTTP ${r.status} ${t.slice(0, 120)}`);
        }
      } catch (e: any) {
        console.log(`  ⚠ contato (doadora) erro: ${e?.message}`);
      }
    };

    // Salva contato dos dois lados (idempotente via cache)
    const ensureMutualContact = async (
      apiUrl: string,
      apiToken: string,
      donorName: string,
      donorPhone: string,
      tInst: TargetInstance,
    ) => {
      const key = `${apiUrl}|${tInst.dbId}`;
      if (savedPairs.has(key)) return;
      savedPairs.add(key);
      await Promise.all([
        zapiSaveContact(tInst, donorPhone, donorName || "Aquec"),
        uazapiSaveContact(apiUrl, apiToken, tInst.phone, tInst.name || "Aquec"),
      ]);
    };

    const forceTargetReply = async (inst: TargetInstance, donorPhone: string, message: string) => {
      const first = await sendZapiText(inst, donorPhone, message);
      if (first.ok || !isNewChatCapping(first.body)) return first;

      // Segunda tentativa imediata: alguns números liberam após o provedor criar/atualizar o chat.
      await new Promise((r) => setTimeout(r, 900));
      const second = await sendZapiText(inst, donorPhone, message);
      return second.ok ? second : first;
    };

    /**
     * Aguarda (polling) a resposta REAL do número alvo na caixa de mensagens da
     * doadora UAZAPI. Retorna true se detectar uma mensagem recebida do `target`
     * após `sinceTs` (epoch ms) dentro do `timeoutMs`. Caso contrário retorna false.
     */
    const waitForReply = async (
      apiUrl: string,
      apiToken: string,
      target: string,
      sinceTs: number,
      timeoutMs = 90_000,
      pollIntervalMs = 4_000,
    ): Promise<boolean> => {
      const deadline = Date.now() + timeoutMs;
      const targetDigits = target.replace(/\D/g, "");
      while (Date.now() < deadline) {
        try {
          // UAZAPI: busca mensagens recentes do chat com o alvo
          const r = await fetch(`${apiUrl}/message/find`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: apiToken },
            body: JSON.stringify({ chatid: `${targetDigits}@s.whatsapp.net`, limit: 5 }),
          });
          if (r.ok) {
            const j: any = await r.json().catch(() => ({}));
            const arr: any[] = Array.isArray(j) ? j : (j?.messages || j?.data || []);
            for (const m of arr) {
              const fromMe = m?.fromMe ?? m?.fromme ?? m?.key?.fromMe;
              const ts = Number(m?.messageTimestamp || m?.timestamp || m?.t || 0);
              const tsMs = ts > 1e12 ? ts : ts * 1000;
              const sender = String(m?.sender || m?.from || m?.chatid || "").replace(/\D/g, "");
              if (!fromMe && tsMs >= sinceTs - 2000 && (sender.includes(targetDigits) || !sender)) {
                return true;
              }
            }
          }
        } catch (_) { /* tenta de novo */ }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
      return false;
    };

    let totalSent = 0;
    let totalFailed = 0;
    let totalReplies = 0;
    const errors: string[] = [];
    // Contagem de envios por telefone alvo (para barras de progresso por instância)
    const sentByTarget: Record<string, number> = {};
    // Mapeamento phone → instanceId (UUID da zapi_instances) p/ a UI casar contadores
    const targetInstanceMap: Record<string, string> = {};
    for (const ti of targetInstances) {
      if (ti.dbId) targetInstanceMap[ti.phone] = ti.dbId;
    }

    // Primeiro tenta PV P2P: as próprias instâncias selecionadas conversam entre si.
    // PRIORIDADE: doadoras UAZAPI (admin) enviam para a(s) instância(s) selecionada(s).
    // Só cai para P2P entre as Z-APIs do usuário se NÃO houver doadoras ativas.
    const work = async () => {
      const hasDonors = !!(donors && donors.length > 0);

      if (!hasDonors && targetInstances.length >= 2) {
        const pairs: Array<[TargetInstance, TargetInstance]> = [];
        const ordered = [...targetInstances].sort((a, b) => a.dbId.localeCompare(b.dbId));
        for (let i = 0; i < ordered.length; i++) {
          const sender = ordered[(targetOffset + i) % ordered.length];
          const receiver = ordered[(targetOffset + i + 1) % ordered.length];
          if (sender.dbId !== receiver.dbId) pairs.push([sender, receiver]);
        }
        const selectedPairs = pairs.slice(0, Math.min(sendsPerDonor, pairs.length));

        await Promise.all(selectedPairs.map(async ([sender, receiver], idx) => {
          if (!(await isRunAllowed())) return;
          const raw = pickRandom(messages);
          const sepIdx = raw.indexOf("||");
          const question = (sepIdx >= 0 ? raw.slice(0, sepIdx) : raw).trim();
          const answer = (sepIdx >= 0 ? raw.slice(sepIdx + 2) : "").trim() || pickRandom(autoReplies);

          try {
            await zapiSaveContact(sender, receiver.phone, receiver.name || "Aquec");
            await zapiSaveContact(receiver, sender.phone, sender.name || "Aquec");

            const res = await sendZapiText(sender, receiver.phone, question);
            if (res.ok) {
              totalSent++;
              sentByTarget[receiver.phone] = (sentByTarget[receiver.phone] || 0) + 1;
              console.log(`→ PV ${sender.name} → ${receiver.phone} (${idx + 1}/${selectedPairs.length}): "${question.slice(0,40)}"`);
              if (sender.dbId) clearCapping(sender.dbId);

              await new Promise((r) => setTimeout(r, 900 + Math.random() * 2200));
              if (!(await isRunAllowed())) return;
              const reply = await forceTargetReply(receiver, sender.phone, answer);
              if (reply.ok) {
                totalReplies++;
                sentByTarget[sender.phone] = (sentByTarget[sender.phone] || 0) + 1;
                console.log(`  ↩ PV ${receiver.name} → ${sender.phone}: "${answer.slice(0,40)}"`);
                if (receiver.dbId) clearCapping(receiver.dbId);
              } else {
                totalFailed++;
                errors.push(`${receiver.name} → ${sender.phone}: HTTP ${reply.status} ${reply.body.slice(0, 120)}`);
                if (isNewChatCapping(reply.body) && receiver.dbId) recordCapping(receiver.dbId, receiver.phone, reply.body);
              }
            } else {
              totalFailed++;
              errors.push(`${sender.name} → ${receiver.phone}: HTTP ${res.status} ${res.body.slice(0, 120)}`);
              if (isNewChatCapping(res.body) && sender.dbId) recordCapping(sender.dbId, sender.phone, res.body);
            }
          } catch (e: any) {
            totalFailed++;
            errors.push(`${sender.name} → ${receiver.phone}: ${e?.message || "erro"}`);
          }
        }));

        console.log(`✅ Aquecimento PV P2P concluído: ${totalSent} enviadas, ${totalReplies} respostas, ${totalFailed} falhas`);
        if (errors.length) console.log("Erros:", errors.slice(0, 20));
        return;
      }

      if (!hasDonors) {
        totalFailed++;
        errors.push("Nenhuma doadora ativa cadastrada em /admin/aquecimento e menos de 2 instâncias selecionadas para P2P");
        console.log("✅ Aquecimento concluído: 0 enviadas, 0 respostas, 1 falha");
        return;
      }

      // Réplicas pendentes — disparadas em background para não bloquear o ciclo
      const pendingReplies: Promise<void>[] = [];

      // Processa todas as doadoras EM PARALELO para evitar timeout da Edge Function
      await Promise.all(donors.map(async (donor, donorIndex) => {
        const apiUrl = String(donor.evolution_api_url || "").replace(/\/+$/, "");
        const apiToken = String(donor.evolution_api_key || donor.zapi_token || "");
        if (!apiUrl || !apiToken) {
          errors.push(`${donor.instance_name}: credenciais ausentes`);
          return;
        }

        // Tenta resolver o telefone da própria doadora UAZAPI para que a resposta da
        // instância alvo seja direcionada de volta a ela.
        let donorPhone = "";
        // Tenta múltiplos endpoints da UAZAPI para descobrir o número conectado
        const donorEndpoints = ["/status", "/instance/me", "/instance/info", "/instance/status"];
        for (const ep of donorEndpoints) {
          if (donorPhone) break;
          try {
            const r = await fetch(`${apiUrl}${ep}`, { headers: { token: apiToken } });
            if (!r.ok) continue;
            const j: any = await r.json().catch(() => ({}));
            const candidates = [
              j?.instance?.owner, j?.instance?.wid, j?.instance?.phone,
              j?.owner, j?.phone, j?.id, j?.wid,
              j?.me?.user, j?.me?.id, j?.user?.id, j?.user?.phone,
              j?.connected_phone, j?.connectedPhone, j?.number,
            ];
            for (const c of candidates) {
              const digits = String(c || "").replace(/\D/g, "");
              if (digits.length >= 8) { donorPhone = digits; break; }
            }
            if (donorPhone) console.log(`📞 doadora ${donor.instance_name} resolvida em ${ep}: ${donorPhone}`);
          } catch (_) { /* try next */ }
        }
        if (!donorPhone) {
          console.log(`⚠️ doadora ${donor.instance_name}: telefone NÃO resolvido — sem réplicas recíprocas`);
        }

        for (let i = 0; i < sendsPerDonor; i++) {
          if (!(await isRunAllowed())) return;
          // Round-robin: garante distribuição equilibrada entre todos os alvos
          // Em modo tick com batchSize 1, o cliente envia targetOffset crescente para
          // não ficar sempre no primeiro número da lista.
          const target = cleanedTargets[(targetOffset + donorIndex + i) % cleanedTargets.length];
          const raw = pickRandom(messages);
          // Detecta par conversacional: "PERGUNTA||RESPOSTA"
          const sepIdx = raw.indexOf("||");
          const question = sepIdx >= 0 ? raw.slice(0, sepIdx).trim() : raw;
          const answer = sepIdx >= 0 ? raw.slice(sepIdx + 2).trim() : "";

          try {
            // Salva contato em ambos os lados ANTES do primeiro envio do par doadora↔alvo
            const targetInstForContact = findTargetInstance(target);
            if (targetInstForContact && donorPhone) {
              await ensureMutualContact(apiUrl, apiToken, donor.instance_name || "", donorPhone, targetInstForContact);
            }

              if (!(await isRunAllowed())) return;
              const res = await fetch(`${apiUrl}/send/text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", token: apiToken },
              body: JSON.stringify({ number: target, text: question }),
            });
            if (res.ok) {
              totalSent++;
              sentByTarget[target] = (sentByTarget[target] || 0) + 1;
              console.log(`→ ${donor.instance_name} → ${target} (${i + 1}/${sendsPerDonor}): "${question.slice(0,40)}"`);
              // doadora voltou a enviar: limpa bloqueio de capping registrado anteriormente
              clearCapping(String(donor.id));

              const targetInstForOpen = findTargetInstance(target);
              if (targetInstForOpen && donorPhone && answer) {
                const opener = await forceTargetReply(targetInstForOpen, donorPhone, answer);
                if (opener.ok) {
                  totalReplies++;
                  console.log(`  ↩ ${targetInstForOpen.name} → ${donorPhone}: "${answer.slice(0,40)}"`);
                  if (targetInstForOpen.dbId) clearCapping(targetInstForOpen.dbId);
                } else if (isNewChatCapping(opener.body)) {
                  console.log(`  ⚠ ${targetInstForOpen.name}: Z-API bloqueou nova conversa (${opener.status}); enviando primeiro da doadora para liberar resposta`);
                  if (targetInstForOpen.dbId) {
                    recordCapping(targetInstForOpen.dbId, targetInstForOpen.phone, opener.body);
                  }
                } else {
                  console.log(`  ✗ envio forçado falhou: HTTP ${opener.status} ${opener.body.slice(0,200)}`);
                }
              }

              // RÉPLICA RECÍPROCA (em BACKGROUND para não bloquear o ciclo principal)
              // Se não houver "answer" no template, usa uma resposta automática rápida do pool.
              const replyText = answer || pickRandom(autoReplies);
              if (replyText && !answer) {
                const tInst = findTargetInstance(target);
                if (!donorPhone) {
                  console.log(`  ⚠ sem réplica: telefone da doadora ${donor.instance_name} não resolvido`);
                } else if (!tInst) {
                  console.log(`  ⚠ sem réplica: alvo ${target} não é instância Z-API selecionada (apenas número avulso)`);
                } else {
                  const tInstSafe = tInst;
                  const donorPhoneSafe = donorPhone;
                  const answerSafe = replyText;
                  const replyTask = (async () => {
                    // Resposta FORÇADA e rápida: 0.5-1.5s para reduzir atraso do aquecimento.
                    const replyDelay = (0.5 + Math.random()) * 1000;
                    await new Promise((r) => setTimeout(r, replyDelay));
                    if (!(await isRunAllowed())) return;
                    try {
                      const rr = await forceTargetReply(tInstSafe, donorPhoneSafe, answerSafe);
                      if (rr.ok) {
                        totalReplies++;
                        console.log(`  ↩ ${tInstSafe.name} → ${donorPhoneSafe}: "${answerSafe.slice(0,40)}"`);
                        if (tInstSafe.dbId) clearCapping(tInstSafe.dbId);
                      } else {
                        console.log(`  ✗ réplica bloqueada pela Z-API: HTTP ${rr.status} ${rr.body.slice(0,200)}`);
                        if (isNewChatCapping(rr.body) && tInstSafe.dbId) {
                          recordCapping(tInstSafe.dbId, tInstSafe.phone, rr.body);
                        }
                      }
                    } catch (e: any) {
                      console.log(`  ✗ réplica erro: ${e?.message}`);
                    }
                  })();
                  pendingReplies.push(replyTask);
                }
              }
            } else {
              totalFailed++;
              const t = await res.text().catch(() => "");
              errors.push(`${donor.instance_name} → ${target}: HTTP ${res.status} ${t.slice(0, 120)}`);
              if (isNewChatCapping(t)) {
                recordCapping(String(donor.id), donorPhone, t);
              }
            }
          } catch (e: any) {
            totalFailed++;
            errors.push(`${donor.instance_name} → ${target}: ${e?.message || "erro"}`);
          }

          // Delay aleatório entre mensagens somente quando há mais de uma no mesmo lote.
          if (i < sendsPerDonor - 1) {
            const delayMs = (minDelay + Math.random() * (maxDelay - minDelay)) * 1000;
            await new Promise((r) => setTimeout(r, delayMs));
            if (!(await isRunAllowed())) return;
          }
        }
      }));

      // Aguarda réplicas em background com timeout de 30s para não travar o ciclo
      if (pendingReplies.length > 0) {
        await Promise.race([
          Promise.allSettled(pendingReplies),
          new Promise((r) => setTimeout(r, 10_000)),
        ]);
      }
      console.log(`✅ Aquecimento concluído: ${totalSent} enviadas, ${totalReplies} respostas, ${totalFailed} falhas`);
      if (errors.length) console.log("Erros:", errors.slice(0, 20));
    };

    if (isTickMode) {
      await work();
    // @ts-ignore - EdgeRuntime fornecido pelo Supabase
    } else if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work());
    } else {
      // Fallback: dispara sem aguardar
      work().catch((e) => console.error("warmup error", e));
    }

    return json({
      success: true,
      message: isTickMode ? "Ciclo de aquecimento executado" : "Aquecimento iniciado em segundo plano",
      donors: donors?.length || 0,
      targets: cleanedTargets.length,
      messagesPool: messages.length,
      plannedSends: (donors && donors.length > 0)
        ? (donors.length * sendsPerDonor)
        : (targetInstances.length >= 2 ? sendsPerDonor : 0),
      sent: totalSent,
      replies: totalReplies,
      failed: totalFailed,
      sentByTarget,
      targetInstanceMap,
    });
  } catch (e: any) {
    console.error("run-warmup error", e);
    return json({ success: false, error: e?.message || "Internal error" }, 500);
  }
});