import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Para cada instância Z-API alvo do aquecimento, verifica se o progresso
 * acumulado do dia cruzou o threshold de algum link de grupo cadastrado.
 * Se sim, faz a UAZAPI (admin do grupo) ADICIONAR diretamente o número
 * Z-API aquecido no grupo — sem precisar do clique no convite.
 *
 * Body: {
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

    // phone (do número aquecido) ←→ instanceDbId
    const phoneByInstance = new Map<string, string>();
    for (const [phone, instId] of Object.entries(targetInstanceMap)) {
      if (instId && phone) phoneByInstance.set(instId, phone);
    }
    const instanceDbIds = Array.from(phoneByInstance.keys());
    if (instanceDbIds.length === 0) return json({ added: 0, skipped: "no instances" });

    // Links ativos
    const { data: links } = await admin
      .from("warmup_group_links")
      .select("id, invite_url, threshold, active, group_jid")
      .eq("active", true);
    if (!links || links.length === 0) return json({ added: 0, skipped: "no links" });

    // Doadoras UAZAPI ativas (qualquer admin do grupo serve)
    const { data: donors } = await admin
      .from("zapi_instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key, zapi_token, api_provider, is_active")
      .ilike("api_provider", "uazapi")
      .eq("is_active", true);
    if (!donors || donors.length === 0) return json({ added: 0, skipped: "no uazapi donors" });

    const donorCreds = donors.map((d: any) => ({
      name: String(d.instance_name || ""),
      apiUrl: String(d.evolution_api_url || "").replace(/\/+$/, ""),
      apiToken: String(d.evolution_api_key || d.zapi_token || ""),
    })).filter((d: any) => d.apiUrl && d.apiToken);

    // Histórico de adições já feitas (instance×link único)
    const { data: existingJoins } = await admin
      .from("warmup_group_joins")
      .select("instance_id, link_id")
      .in("instance_id", instanceDbIds);
    const joinedSet = new Set<string>();
    for (const j of existingJoins || []) {
      joinedSet.add(`${j.instance_id}:${j.link_id}`);
    }

    const extractInviteCode = (url: string) => {
      const m = String(url || "").match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
      return m ? m[1] : String(url || "").split("?")[0].trim();
    };

    const normalizeGroupJid = (value: unknown): string | null => {
      const raw = String(value || "").trim();
      if (!raw) return null;
      if (raw.includes("@g.us")) return raw;
      if (raw.includes("-group")) return raw.replace(/-group$/i, "@g.us");
      const digits = raw.replace(/\D/g, "");
      return digits.length >= 12 ? `${digits}@g.us` : null;
    };

    const pickGroupJid = (payload: any): string | null => {
      const direct = normalizeGroupJid(
        payload?.id || payload?.JID || payload?.jid || payload?.groupId || payload?.groupJid || payload?.group_jid ||
        payload?.remoteJid || payload?.phone || payload?.data?.id || payload?.data?.JID || payload?.data?.jid ||
        payload?.data?.groupId || payload?.data?.groupJid || payload?.group?.id || payload?.group?.jid ||
        payload?.groupMetadata?.id || payload?.groupMetadata?.jid || payload?.info?.id || payload?.result?.id,
      );
      if (direct) return direct;
      if (payload && typeof payload === "object") {
        for (const value of Object.values(payload)) {
          if (value && typeof value === "object") {
            const nested = pickGroupJid(value);
            if (nested) return nested;
          }
        }
      }
      return null;
    };

    // Resolve o JID do grupo via doadora admin (cacheia na coluna group_jid).
    // UAZAPI nem sempre expõe inviteinfo; então também cruza o convite com /group/list + /group/info.
    const resolveGroupJid = async (link: any): Promise<string | null> => {
      if (link.group_jid) return String(link.group_jid);
      const code = extractInviteCode(link.invite_url);
      for (const d of donorCreds) {
        const candidates = [
          { url: `${d.apiUrl}/group-invitation-metadata/${code}`, method: "GET", body: null },
          { url: `${d.apiUrl}/group/invitationMetadata/${code}`, method: "GET", body: null },
          { url: `${d.apiUrl}/group/inviteinfo`, method: "POST", body: { invitecode: code } },
          { url: `${d.apiUrl}/group/inviteinfo`, method: "POST", body: { inviteCode: code } },
          { url: `${d.apiUrl}/group/inviteInfo`, method: "POST", body: { invitecode: code } },
          { url: `${d.apiUrl}/group/inviteInfo`, method: "POST", body: { inviteCode: code } },
          { url: `${d.apiUrl}/group/getInviteInfo`, method: "POST", body: { code } },
          { url: `${d.apiUrl}/group/list`, method: "GET", body: null },
        ];
        for (const c of candidates) {
          try {
            const r = await fetch(c.url, {
              method: c.method,
              headers: { "Content-Type": "application/json", token: d.apiToken },
              body: c.body ? JSON.stringify(c.body) : undefined,
            });
            if (!r.ok) continue;
            const j: any = await r.json().catch(() => ({}));
            const groups = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.groups) ? j.groups : [];
            const matchedGroup = groups.find((g: any) => JSON.stringify(g || {}).includes(code));
            const finalJid = pickGroupJid(matchedGroup || j);
            if (finalJid) {
              await admin.from("warmup_group_links").update({ group_jid: finalJid }).eq("id", link.id);
              return finalJid;
            }
          } catch (_) { /* tenta próximo */ }
        }
      }
      return null;
    };

    // Adiciona um participante via UAZAPI tentando múltiplas doadoras (a primeira que for admin funciona)
    const addParticipant = async (groupJid: string, phone: string): Promise<{ ok: boolean; detail: any }> => {
      const errors: any[] = [];
      const phoneDigits = String(phone || "").replace(/\D/g, "");
      const groupZapiId = groupJid.replace(/@g\.us$/i, "-group");
      for (const d of donorCreds) {
        const attempts = [
          {
            url: `${d.apiUrl}/add-participant`,
            body: { groupId: groupZapiId, phones: [phoneDigits] },
          },
          {
            url: `${d.apiUrl}/group/updateparticipants`,
            body: { groupjid: groupJid, action: "add", participants: [phoneDigits] },
          },
          {
            url: `${d.apiUrl}/group/updateParticipants`,
            body: { groupjid: groupJid, action: "add", participants: [phoneDigits] },
          },
          {
            url: `${d.apiUrl}/group/addParticipant`,
            body: { groupjid: groupJid, participants: [phoneDigits] },
          },
          {
            url: `${d.apiUrl}/group/addParticipant`,
            body: { groupJid, phones: [phoneDigits] },
          },
        ];
        for (const a of attempts) {
          try {
            const r = await fetch(a.url, {
              method: "POST",
              headers: { "Content-Type": "application/json", token: d.apiToken },
              body: JSON.stringify(a.body),
            });
            const text = await r.text();
            let j: any;
            try { j = JSON.parse(text); } catch { j = { raw: text }; }
            if (r.ok) {
              return { ok: true, detail: { donor: d.name, response: j } };
            }
            errors.push({ donor: d.name, status: r.status, body: text.slice(0, 200) });
          } catch (e: any) {
            errors.push({ donor: d.name, error: e?.message });
          }
        }
      }
      return { ok: false, detail: { errors } };
    };

    let added = 0;
    let failed = 0;
    const log: any[] = [];

    // Resolve credenciais Z-API do user (para registrar user_id)
    const { data: instances } = await admin
      .from("zapi_instances")
      .select("id, user_id")
      .in("id", instanceDbIds);
    const userByInstance = new Map<string, string>();
    for (const inst of instances || []) {
      userByInstance.set(inst.id, inst.user_id);
    }

    for (const [instanceId, count] of Object.entries(currentProgress)) {
      const phone = phoneByInstance.get(instanceId);
      if (!phone) continue;
      const total = Number(count) || 0;

      for (const link of links) {
        const key = `${instanceId}:${link.id}`;
        if (joinedSet.has(key)) continue;
        const threshold = Math.max(1, Number(link.threshold) || 100);
        if (total < threshold) continue;

        const groupJid = await resolveGroupJid(link);
        if (!groupJid) {
          log.push({ link: link.id, error: "could not resolve group jid" });
          continue;
        }

        const result = await addParticipant(groupJid, phone);
        if (result.ok) {
          added++;
          joinedSet.add(key);
          await admin.from("warmup_group_joins").insert({
            instance_id: instanceId,
            link_id: link.id,
            user_id: userByInstance.get(instanceId) || null,
            joined_at_count: total,
            status: "success",
            response: result.detail,
          });
          log.push({ phone, link: link.id, ok: true });
          // Apenas UM grupo por instância por chamada para diluir no tempo
          break;
        } else {
          failed++;
          log.push({ phone, link: link.id, ...result.detail });
        }
      }
    }

    console.log("warmup-join-groups (uazapi add):", { added, failed, log });
    return json({ added, failed, log });
  } catch (e: any) {
    console.error("warmup-join-groups error:", e?.message);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});