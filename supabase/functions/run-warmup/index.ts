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
    const sendsPerDonor = Math.max(
      1,
      Math.min(dailyLimit, Math.min(20, Number(body?.batchSize) || dailyLimit)),
    );

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

    // 1) Buscar todas instâncias UAZAPI ativas (doadoras) — independem do user
    const { data: donors, error: donorsErr } = await admin
      .from("zapi_instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key, zapi_token, is_active")
      .ilike("api_provider", "uazapi")
      .eq("is_active", true);
    if (donorsErr) return json({ success: false, error: donorsErr.message }, 500);
    if (!donors || donors.length === 0) {
      return json({ success: false, error: "Nenhuma instância UAZAPI doadora cadastrada em /admin/aquecimento" }, 400);
    }

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
          }
        } catch (e) {
          console.log(`erro ao resolver ${inst.instance_name}:`, (e as any)?.message);
        }
      }
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

    // Para cada doadora UAZAPI, dispara um lote pequeno, alternando alvos e textos.
    // Lotes pequenos evitam timeout da Edge Function; a tela ativa agenda os próximos ciclos.
    const work = async () => {
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
            const res = await fetch(`${apiUrl}/send/text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", token: apiToken },
              body: JSON.stringify({ number: target, text: question }),
            });
            if (res.ok) {
              totalSent++;
              sentByTarget[target] = (sentByTarget[target] || 0) + 1;
              console.log(`→ ${donor.instance_name} → ${target} (${i + 1}/${sendsPerDonor}): "${question.slice(0,40)}"`);

              const targetInstForOpen = findTargetInstance(target);
              if (targetInstForOpen && donorPhone && answer) {
                const opener = await sendZapiText(targetInstForOpen, donorPhone, answer);
                if (opener.ok) {
                  totalReplies++;
                  console.log(`  ↩ ${targetInstForOpen.name} → ${donorPhone}: "${answer.slice(0,40)}"`);
                } else if (isNewChatCapping(opener.body)) {
                  console.log(`  ⚠ ${targetInstForOpen.name}: Z-API bloqueou nova conversa (${opener.status}); enviando primeiro da doadora para liberar resposta`);
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
                    try {
                      const rr = await sendZapiText(tInstSafe, donorPhoneSafe, answerSafe);
                      if (rr.ok) {
                        totalReplies++;
                        console.log(`  ↩ ${tInstSafe.name} → ${donorPhoneSafe}: "${answerSafe.slice(0,40)}"`);
                      } else {
                        console.log(`  ✗ réplica bloqueada pela Z-API: HTTP ${rr.status} ${rr.body.slice(0,200)}`);
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
            }
          } catch (e: any) {
            totalFailed++;
            errors.push(`${donor.instance_name} → ${target}: ${e?.message || "erro"}`);
          }

          // Delay aleatório entre mensagens somente quando há mais de uma no mesmo lote.
          if (i < sendsPerDonor - 1) {
            const delayMs = (minDelay + Math.random() * (maxDelay - minDelay)) * 1000;
            await new Promise((r) => setTimeout(r, delayMs));
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
      donors: donors.length,
      targets: cleanedTargets.length,
      messagesPool: messages.length,
      plannedSends: donors.length * sendsPerDonor,
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