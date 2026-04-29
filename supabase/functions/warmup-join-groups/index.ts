import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Para cada instância Z-API alvo do aquecimento, verifica se o progresso
 * acumulado do dia cruzou um múltiplo do threshold de algum link de grupo
 * ativo. Se sim, faz a instância entrar no grupo via link de convite.
 *
 * Body: {
 *   sentByTarget: { phone: count },
 *   targetInstanceMap: { phone: instanceDbId },
 *   currentProgress: { instanceDbId: totalCountToday }
 * }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    const targetInstanceMap: Record<string, string> = body?.targetInstanceMap || {};
    const currentProgress: Record<string, number> = body?.currentProgress || {};

    const instanceDbIds = Array.from(new Set(Object.values(targetInstanceMap))).filter(Boolean);
    if (instanceDbIds.length === 0) return json({ joined: 0, skipped: "no instances" });

    // Carrega links ativos
    const { data: links } = await admin
      .from("warmup_group_links")
      .select("id, invite_url, threshold, active")
      .eq("active", true);
    if (!links || links.length === 0) return json({ joined: 0, skipped: "no links" });

    // Carrega credenciais Z-API das instâncias
    const { data: instances } = await admin
      .from("zapi_instances")
      .select("id, user_id, instance_name, zapi_instance_id, zapi_token, zapi_client_token, api_provider")
      .in("id", instanceDbIds);
    const instMap = new Map<string, any>();
    for (const inst of instances || []) {
      if (String(inst.api_provider || "zapi").toLowerCase() === "zapi") {
        instMap.set(inst.id, inst);
      }
    }

    // Carrega histórico já existente
    const { data: existingJoins } = await admin
      .from("warmup_group_joins")
      .select("instance_id, link_id, joined_at_count")
      .in("instance_id", instanceDbIds);
    const joinedSet = new Set<string>();
    for (const j of existingJoins || []) {
      joinedSet.add(`${j.instance_id}:${j.link_id}`);
    }

    const extractInviteCode = (url: string) => {
      const m = String(url || "").match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
      return m ? m[1] : String(url || "").trim();
    };

    let joined = 0;
    let failed = 0;
    const log: any[] = [];

    for (const [instanceId, count] of Object.entries(currentProgress)) {
      const inst = instMap.get(instanceId);
      if (!inst) continue;
      const total = Number(count) || 0;

      for (const link of links) {
        const key = `${instanceId}:${link.id}`;
        if (joinedSet.has(key)) continue;
        const threshold = Math.max(1, Number(link.threshold) || 100);
        // Política: a cada threshold mensagens, entra em UM novo grupo.
        // Como a unique constraint impede repetir o mesmo grupo, basta exigir
        // que o total acumulado seja >= threshold para liberar a próxima entrada
        // não usada por essa instância.
        if (total < threshold) continue;

        const inviteCode = extractInviteCode(link.invite_url);
        const url = `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}/groups-via-invite-code`;
        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": String(inst.zapi_client_token || ""),
            },
            body: JSON.stringify({ url: inviteCode }),
          });
          const text = await resp.text();
          let respJson: any;
          try { respJson = JSON.parse(text); } catch { respJson = { raw: text }; }

          if (resp.ok) {
            joined++;
            joinedSet.add(key);
            await admin.from("warmup_group_joins").insert({
              instance_id: instanceId,
              link_id: link.id,
              user_id: inst.user_id,
              joined_at_count: total,
              status: "success",
              response: respJson,
            });
            log.push({ instance: inst.instance_name, link: link.id, ok: true });
            // Apenas UMA entrada por instância por chamada para diluir no tempo
            break;
          } else {
            failed++;
            log.push({ instance: inst.instance_name, link: link.id, status: resp.status, body: text.slice(0, 200) });
          }
        } catch (e: any) {
          failed++;
          log.push({ instance: inst.instance_name, link: link.id, error: e?.message });
        }
      }
    }

    console.log("warmup-join-groups:", { joined, failed, log });
    return json({ joined, failed, log });
  } catch (e: any) {
    console.error("warmup-join-groups error:", e?.message);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});