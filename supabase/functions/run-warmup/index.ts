import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Aquecimento de números:
 * - Doadoras = todas instâncias UAZAPI ativas (cadastradas em /admin/aquecimento)
 * - Alvos = números informados pelo usuário em /aquecimento + telefones das instâncias Z-API selecionadas (resolvidos via UAZAPI status)
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
    const messages: string[] = Array.isArray(body?.messages) ? body.messages.filter((m: any) => typeof m === "string" && m.trim()) : [];
    const minDelay = Math.max(2, Number(body?.minDelay) || 10);
    const maxDelay = Math.max(minDelay, Number(body?.maxDelay) || 30);
    const dailyLimit = Math.max(1, Math.min(800, Number(body?.dailyLimit) || 50));

    if (!messages.length) return json({ success: false, error: "Nenhuma mensagem configurada" }, 400);

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

    // Normalizar números alvo
    const cleanedTargets = Array.from(
      new Set(
        targetPhones
          .map((p) => String(p || "").replace(/\D/g, ""))
          .filter((p) => p.length >= 8),
      ),
    );

    if (cleanedTargets.length === 0) {
      return json({ success: false, error: "Nenhum número alvo informado em /aquecimento" }, 400);
    }

    const pickRandom = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    let totalSent = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    // Para cada doadora UAZAPI, dispara até `dailyLimit` mensagens, alternando alvos e textos
    // EdgeRuntime tem limite de tempo, então enviamos em background com EdgeRuntime.waitUntil
    const work = async () => {
      for (const donor of donors) {
        const apiUrl = String(donor.evolution_api_url || "").replace(/\/+$/, "");
        const apiToken = String(donor.evolution_api_key || donor.zapi_token || "");
        if (!apiUrl || !apiToken) {
          errors.push(`${donor.instance_name}: credenciais ausentes`);
          continue;
        }

        for (let i = 0; i < dailyLimit; i++) {
          const target = pickRandom(cleanedTargets);
          const text = pickRandom(messages);
          try {
            const res = await fetch(`${apiUrl}/send/text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", token: apiToken },
              body: JSON.stringify({ number: target, text }),
            });
            if (res.ok) {
              totalSent++;
            } else {
              totalFailed++;
              const t = await res.text().catch(() => "");
              errors.push(`${donor.instance_name} → ${target}: HTTP ${res.status} ${t.slice(0, 120)}`);
            }
          } catch (e: any) {
            totalFailed++;
            errors.push(`${donor.instance_name} → ${target}: ${e?.message || "erro"}`);
          }

          // Delay aleatório entre min e max
          const delayMs = (minDelay + Math.random() * (maxDelay - minDelay)) * 1000;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      console.log(`✅ Aquecimento concluído: ${totalSent} enviadas, ${totalFailed} falhas`);
      if (errors.length) console.log("Erros:", errors.slice(0, 20));
    };

    // @ts-ignore - EdgeRuntime fornecido pelo Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work());
    } else {
      // Fallback: dispara sem aguardar
      work().catch((e) => console.error("warmup error", e));
    }

    return json({
      success: true,
      message: "Aquecimento iniciado em segundo plano",
      donors: donors.length,
      targets: cleanedTargets.length,
      messagesPool: messages.length,
      plannedSends: donors.length * dailyLimit,
    });
  } catch (e: any) {
    console.error("run-warmup error", e);
    return json({ success: false, error: e?.message || "Internal error" }, 500);
  }
});