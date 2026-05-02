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
    let requestedInstanceIds = Array.isArray(body?.instanceIds)
      ? body.instanceIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
      : [];
    if (requestedInstanceIds.length === 0) {
      const { data: control } = await admin
        .from("warmup_instance_health")
        .select("detail")
        .eq("instance_ref", user.id)
        .eq("block_type", "warmup_control")
        .maybeSingle();
      try {
        const detail = JSON.parse(String(control?.detail || "{}"));
        requestedInstanceIds = Array.isArray(detail?.instanceIds)
          ? detail.instanceIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
          : [];
      } catch (_) { /* mantém vazio */ }
    }

    // phone (do número aquecido) ←→ instanceDbId
    const phoneByInstance = new Map<string, string>();
    for (const [phone, instId] of Object.entries(targetInstanceMap)) {
      if (instId && phone) phoneByInstance.set(instId, phone);
    }
    const instanceDbIds = Array.from(new Set([...phoneByInstance.keys(), ...requestedInstanceIds]));
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

    // Histórico de adições já feitas (instance×link único).
    // Não usamos isso para bloquear novas tentativas: o membro pode ter saído,
    // o grupo pode ter sido recriado ou a resposta antiga pode ter sido falso positivo.
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

    const responseLooksAlreadyMember = (detail: any) => {
      const text = JSON.stringify(detail || {}).toLowerCase();
      return text.includes("already") || text.includes("participant") || text.includes("membro") || text.includes("member");
    };

    const upsertJoin = async (realInstanceId: string, linkId: string, total: number, detail: any) => {
      const row = {
        instance_id: realInstanceId,
        link_id: linkId,
        user_id: userByInstance.get(realInstanceId) || null,
        joined_at_count: total,
        status: "success",
        response: detail,
      };
      const { error } = await admin
        .from("warmup_group_joins")
        .upsert(row, { onConflict: "instance_id,link_id" });
      if (error) console.log("warmup_group_joins upsert error:", error.message);
    };

    let added = 0;
    let failed = 0;
    const log: any[] = [];
    const skipped: any[] = [];

    // Resolve credenciais das instâncias alvo (para registrar user_id e fallback por convite)
    const { data: instances } = await admin
      .from("zapi_instances")
      .select("id, user_id, instance_name, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key")
      .in("id", instanceDbIds);
    const normalizePhoneCandidate = (value: unknown, allowPlain = true): string => {
      const raw = String(value || "").trim();
      if (!raw || raw === "true" || raw === "false") return "";
      const jidMatch = raw.match(/(\d{10,15})(?=[:@])/);
      if (!allowPlain && !jidMatch) return "";
      const digits = (jidMatch?.[1] || raw.replace(/\D/g, ""));
      if (digits.length < 10 || digits.length > 15 || /^0+$/.test(digits)) return "";
      return digits;
    };

    const userByInstance = new Map<string, string>();
    const instanceById = new Map<string, any>();
    for (const inst of instances || []) {
      userByInstance.set(inst.id, inst.user_id);
      instanceById.set(inst.id, inst);
    }

    const resolveTargetPhone = async (instanceId: string): Promise<string> => {
      const cached = phoneByInstance.get(instanceId);
      if (cached) return cached;
      const inst = instanceById.get(instanceId);
      if (!inst) return "";
      const provider = String(inst.api_provider || "zapi").toLowerCase();
      const namePhone = normalizePhoneCandidate(inst.instance_name, true);
      if (namePhone) {
        phoneByInstance.set(instanceId, namePhone);
        return namePhone;
      }
      if (provider !== "zapi") return "";
      const base = `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}`;
      const headers = { "Client-Token": String(inst.zapi_client_token || "") };
      const endpoints = ["/device", "/me", "/profile", "/status", "/phone-code"];
      for (const ep of endpoints) {
        try {
          const r = await fetch(`${base}${ep}`, { headers });
          if (!r.ok) continue;
          const j: any = await r.json().catch(() => ({}));
          const candidates = [
            j?.phone, j?.phoneNumber, j?.connectedPhone, j?.connected_phone,
            j?.wid?.user, j?.user, j?.user?.phone, j?.me?.user, j?.me?.phone,
            j?.device?.phone, j?.device?.number, j?.id, j?.wid, j?.user?.id, j?.me?.id,
          ];
          for (const cand of candidates) {
            const phone = normalizePhoneCandidate(cand, true) || normalizePhoneCandidate(cand, false);
            if (phone) {
              phoneByInstance.set(instanceId, phone);
              return phone;
            }
          }
        } catch (_) { /* tenta próximo */ }
      }
      return "";
    };

    const acceptInviteWithTarget = async (instanceId: string, inviteUrl: string): Promise<{ ok: boolean; detail: any }> => {
      const inst = instanceById.get(instanceId);
      const code = extractInviteCode(inviteUrl);
      if (!inst || !code) return { ok: false, detail: { error: "missing target instance credentials" } };
      const provider = String(inst.api_provider || "zapi").toLowerCase();
      const attempts = provider === "uazapi"
        ? [
            { url: `${String(inst.evolution_api_url || "").replace(/\/+$/, "")}/group/acceptinvite`, method: "POST", headers: { token: String(inst.evolution_api_key || inst.zapi_token || "") }, body: { code } },
            { url: `${String(inst.evolution_api_url || "").replace(/\/+$/, "")}/group/acceptInvite`, method: "POST", headers: { token: String(inst.evolution_api_key || inst.zapi_token || "") }, body: { invitecode: code } },
          ]
        : [
            { url: `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}/accept-group-invite/${code}`, method: "GET", headers: { "Client-Token": String(inst.zapi_client_token || "") }, body: null },
          ];
      const errors: any[] = [];
      for (const a of attempts) {
        if (!a.url || a.url.includes("undefined") || a.url.includes("//group")) continue;
        try {
          const r = await fetch(a.url, {
            method: a.method,
            headers: { "Content-Type": "application/json", ...a.headers },
            body: a.body ? JSON.stringify(a.body) : undefined,
          });
          const text = await r.text();
          let j: any;
          try { j = JSON.parse(text); } catch { j = { raw: text }; }
          const responseText = JSON.stringify(j).toLowerCase();
          if (r.ok || responseText.includes("already") || responseText.includes("participant")) {
            return { ok: true, detail: { mode: "accept-invite", response: j } };
          }
          errors.push({ status: r.status, body: text.slice(0, 300) });
        } catch (e: any) {
          errors.push({ error: e?.message });
        }
      }
      return { ok: false, detail: { mode: "accept-invite", errors } };
    };

    const getProgressByInstance = () => {
      const progress = new Map<string, number>();
      for (const [key, count] of Object.entries(currentProgress || {})) {
        const realInstanceId = key.includes("::") ? key.split("::")[0] : key;
        progress.set(realInstanceId, Math.max(progress.get(realInstanceId) || 0, Number(count) || 0));
      }
      for (const [phone, count] of Object.entries(body?.sentByTarget || {})) {
        const realInstanceId = targetInstanceMap?.[phone];
        if (!realInstanceId) continue;
        const next = (progress.get(realInstanceId) || 0) + (Number(count) || 0);
        progress.set(realInstanceId, next);
      }
      return progress;
    };

    const progressByInstance = getProgressByInstance();
    for (const realInstanceId of instanceDbIds) {
      const phone = await resolveTargetPhone(realInstanceId);
      const total = Math.max(Number(progressByInstance.get(realInstanceId)) || 0, requestedInstanceIds.includes(realInstanceId) ? Number.MAX_SAFE_INTEGER : 0);

      for (const link of links) {
        const key = `${realInstanceId}:${link.id}`;
        const threshold = Math.max(1, Number(link.threshold) || 100);
        if (total < threshold) {
          skipped.push({ instanceId: realInstanceId, link: link.id, reason: "below_threshold", total, threshold });
          continue;
        }

        const groupJid = await resolveGroupJid(link);
        const adminAddResult = groupJid && phone ? await addParticipant(groupJid, phone) : null;
        const result = adminAddResult?.ok
          ? adminAddResult
          : await acceptInviteWithTarget(realInstanceId, link.invite_url);
        if (result.ok) {
          const retriedExisting = joinedSet.has(key);
          added++;
          joinedSet.add(key);
          await upsertJoin(realInstanceId, link.id, total, result.detail);
          log.push({
            phone: phone || realInstanceId,
            link: link.id,
            ok: true,
            retriedExisting,
            mode: adminAddResult?.ok ? "admin-add" : "accept-invite",
            adminAddFailed: Boolean(adminAddResult && !adminAddResult.ok),
          });
          // Apenas UM grupo por instância por chamada para diluir no tempo
          break;
        } else {
          if (joinedSet.has(key) && responseLooksAlreadyMember(result.detail)) {
            await upsertJoin(realInstanceId, link.id, total, result.detail);
            skipped.push({ instanceId: realInstanceId, link: link.id, reason: "confirmed_already_member" });
            break;
          }
          failed++;
          log.push({ phone: phone || realInstanceId, link: link.id, groupJidResolved: Boolean(groupJid), ...result.detail });
        }
      }
    }

    console.log("warmup-join-groups (uazapi add):", { added, failed, instances: instanceDbIds.length, requested: requestedInstanceIds.length, log, skipped: skipped.slice(0, 30) });
    return json({ added, failed, log, skipped: skipped.slice(0, 30) });
  } catch (e: any) {
    console.error("warmup-join-groups error:", e?.message);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});