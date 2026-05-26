import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

console.log("🚀 get-group-participants loaded (Uazapi Only)");

interface Participant {
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  name: string;
}

const normalizeGroupId = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  console.log(`🔍 normalizeGroupId input: ${raw}`);
  if (raw.includes("@g.us")) return raw.replace("@g.us", "-group");
  return raw;
};

const normalizeCommunityId = (value: string | null | undefined) => {
  return String(value || "")
    .trim()
    .replace(/@g\.us$/i, "")
    .replace(/@newsletter$/i, "")
    .replace(/-group$/i, "");
};

const normalizeLidValue = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("@lid")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (raw.includes("@c.us") || raw.includes("@s.whatsapp.net")) return digits;
  return digits.length >= 15 ? `${digits}@lid` : digits;
};

const normalizeRealPhoneValue = (value: any) => {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const raw = String(value || "").trim();
  if (!raw || raw.includes("@lid") || raw.includes("@g.us")) return "";
  const withoutDomain = raw
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/@broadcast$/i, "")
    .split(":")[0];
  const digits = withoutDomain.replace(/\D/g, "");
  return digits.length >= 8 ? digits : "";
};

const uniqueStrings = (values: Array<string | null | undefined>) => {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
};

const toEntityLikeString = (value: any): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (value && typeof value === "object") {
    if (typeof value._serialized === "string") return value._serialized.trim();
    if (typeof value.serialized === "string") return value.serialized.trim();
    if (typeof value.id === "string") return value.id.trim();
    if (typeof value.jid === "string") return value.jid.trim();
    if (typeof value.JID === "string") return value.JID.trim();
    if (typeof value.groupJid === "string") return value.groupJid.trim();
    if (typeof value.GroupJid === "string") return value.GroupJid.trim();
    if (typeof value.groupId === "string") return value.groupId.trim();
    if (typeof value.remoteJid === "string") return value.remoteJid.trim();
    if (typeof value.chatJid === "string") return value.chatJid.trim();
    if (typeof value.phone === "string") return value.phone.trim();
    if (typeof value.participant === "string") return value.participant.trim();

    const nestedCandidates = [
      value.id,
      value.jid,
      value.JID,
      value.groupJid,
      value.GroupJid,
      value.groupId,
      value.remoteJid,
      value.chatJid,
      value.phone,
      value.participant,
      value.userJid,
      value.group,
      value.subGroup,
      value.chatId,
      value.key?.remoteJid,
      value.key?.participant,
      value.metadata?.jid,
      value.metadata?.id,
      value.contact?.id,
    ];

    for (const candidate of nestedCandidates) {
      if (!candidate || candidate === value) continue;
      const nestedValue = toEntityLikeString(candidate);
      if (nestedValue) return nestedValue;
    }

    if (typeof value.user === "string" && typeof value.server === "string") {
      return `${value.user}@${value.server}`.trim();
    }
  }

  return "";
};

const isLikelyGroupId = (value: any) => {
  const raw = toEntityLikeString(value);
  return Boolean(raw) && (raw.includes("@g.us") || raw.endsWith("-group") || /^\d{15,}$/.test(raw));
};

const isLikelyParticipantId = (value: any) => {
  const raw = toEntityLikeString(value);
  if (!raw || isLikelyGroupId(raw)) return false;

  const digits = raw.replace(/\D/g, "");
  return raw.includes("@c.us") || raw.includes("@lid") || digits.length >= 8;
};

const looksLikeParticipantObject = (value: any) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.isGroupAnnouncement || value.isCommunity || value.subGroups || value.communityGroups) return false;

  const idCandidates = [
    value.phone,
    value.id,
    value.participant,
    value.jid,
    value.contact?.id,
    value.user,
    value._serialized,
    value.serialized,
  ];

  return idCandidates.some((candidate) => isLikelyParticipantId(candidate));
};

const normalizeParticipantEntries = (values: any[]) => {
  return values
    .map((value) => {
      if (looksLikeParticipantObject(value)) return value;
      if (isLikelyParticipantId(value)) {
        return { phone: toEntityLikeString(value) };
      }
      return null;
    })
    .filter(Boolean);
};

const extractDeepParticipantArray = (value: any, seen = new WeakSet<object>()): any[] => {
  if (!value || typeof value !== "object") return [];

  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    const normalized = normalizeParticipantEntries(value);
    if (normalized.length > 0) return normalized;

    for (const item of value) {
      const nested = extractDeepParticipantArray(item, seen);
      if (nested.length > 0) return nested;
    }

    return [];
  }

  for (const item of Object.values(value)) {
    const nested = extractDeepParticipantArray(item, seen);
    if (nested.length > 0) return nested;
  }

  return [];
};

const extractParticipantArray = (payload: any) => {
  const candidates = [
    payload?.participants,
    payload?.participantes,
    payload?.members,
    payload?.groupParticipants,
    payload?.communityParticipants,
    payload?.users,
    payload?.contacts,
    payload?.data?.participants,
    payload?.data?.participantes,
    payload?.data?.members,
    payload?.data?.groupParticipants,
    payload?.data?.communityParticipants,
    payload?.data?.users,
    payload?.result?.participants,
    payload?.result?.participantes,
    payload?.result?.members,
    payload?.participants?.list,
    payload?.data?.participants?.list,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    
    const actualArray = Array.isArray(candidate) 
      ? candidate 
      : (Array.isArray(candidate?.list) ? candidate.list : (Array.isArray(candidate?.members) ? candidate.members : null));
    
    if (!actualArray) continue;
    
    const normalized = normalizeParticipantEntries(actualArray);
    if (normalized.length > 0) return normalized;
  }

  return extractDeepParticipantArray(payload);
};

interface UazapiInstance {
  apiUrl: string;
  apiToken: string;
  userId: string;
}

const resolveUazapiInstance = async (
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string,
  sourceInstanceId: string | null,
): Promise<UazapiInstance | null> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const userClient = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  if (sourceInstanceId) {
    const profileMatch = String(sourceInstanceId).match(/^profile-uazapi-(\d+)$/i);
    if (profileMatch) {
      const idx = Math.max(1, parseInt(profileMatch[1], 10)) - 1;
      const { data: profile } = await adminClient
        .from("profiles")
        .select("uazapi_url, uazapi_token")
        .eq("id", user.id)
        .maybeSingle();
      const urls = String((profile as any)?.uazapi_url || '').split('|').map((v: string) => v.trim()).filter(Boolean);
      const tokens = String((profile as any)?.uazapi_token || '').split('|').map((v: string) => v.trim()).filter(Boolean);
      if (urls[idx] && tokens[idx]) {
        return {
          apiUrl: urls[idx].replace(/\/+$/, ""),
          apiToken: tokens[idx],
          userId: user.id,
        };
      }
    }

    const { data: exact } = await adminClient
      .from("zapi_instances")
      .select("evolution_api_url, evolution_api_key, api_provider")
      .eq("user_id", user.id)
      .eq("api_provider", "uazapi")
      .eq("is_active", true)
      .eq("zapi_instance_id", sourceInstanceId)
      .limit(1)
      .maybeSingle();

    if (exact?.evolution_api_url && exact?.evolution_api_key) {
      return {
        apiUrl: String(exact.evolution_api_url).replace(/\/+$/, ""),
        apiToken: String(exact.evolution_api_key),
        userId: user.id,
      };
    }
  }

  const { data } = await adminClient
    .from("zapi_instances")
    .select("evolution_api_url, evolution_api_key")
    .eq("user_id", user.id)
    .eq("api_provider", "uazapi")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.evolution_api_url || !data?.evolution_api_key) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("uazapi_url, uazapi_token")
      .eq("id", user.id)
      .maybeSingle();
    const firstUrl = String((profile as any)?.uazapi_url || '').split('|')[0]?.trim();
    const firstToken = String((profile as any)?.uazapi_token || '').split('|')[0]?.trim();
    if (firstUrl && firstToken) {
      return {
        apiUrl: firstUrl.replace(/\/+$/, ""),
        apiToken: firstToken,
        userId: user.id,
      };
    }
    return null;
  }

  return {
    apiUrl: String(data.evolution_api_url).replace(/\/+$/, ""),
    apiToken: String(data.evolution_api_key),
    userId: user.id,
  };
};

const fetchUazapiGroupInfo = async (apiUrl: string, apiToken: string, groupId: string, isCommunity = false) => {
  const candidates = uniqueStrings([
    groupId,
    groupId.includes("@g.us") ? groupId : `${groupId.replace(/-group$/i, "")}@g.us`,
  ]);

  let lastError: any = null;
  for (const candidate of candidates) {
    try {
       const endpoint = isCommunity ? `${apiUrl}/community/info` : `${apiUrl}/group/info`;
       const body = isCommunity 
         ? { communityjid: candidate }
         : { groupjid: candidate, getInviteLink: false, force: true };
 
       const response = await fetch(endpoint, {
         method: "POST",
         headers: { "Content-Type": "application/json", token: apiToken },
         body: JSON.stringify(body),
      });
      const text = await response.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (!response.ok) {
        lastError = new Error(`UAZAPI ${response.status}: ${text.slice(0, 300)}`);
        continue;
      }

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Unable to fetch UAZAPI group info for ${groupId}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { groupId, fallbackParticipants = [], sourceInstanceId = null, isCommunity = false } = await req.json();
    if (!groupId) throw new Error("groupId is required");

    const uazapi = await resolveUazapiInstance(req, supabaseUrl, supabaseServiceKey, sourceInstanceId);
    
    if (!uazapi) {
      console.error("❌ No UAZAPI instance found. Z-API fallback removed.");
      throw new Error("Instância Uazapi não configurada. A extração de membros agora requer uma instância Uazapi ativa.");
    }

    console.log(`📱 UAZAPI participants for ${groupId}`);
    
    // If explicitly a community or looks like one, try community info then fallback to group info
    let groupInfo: any = null;
    const looksLikeCommunity = isCommunity || !String(groupId).includes('@g.us');
    
    if (looksLikeCommunity) {
      try {
        groupInfo = await fetchUazapiGroupInfo(uazapi.apiUrl, uazapi.apiToken, groupId, true);
      } catch (e) {
        console.log("⚠️ UAZAPI community/info failed, trying group/info fallback");
        groupInfo = await fetchUazapiGroupInfo(uazapi.apiUrl, uazapi.apiToken, groupId, false);
      }
    } else {
      groupInfo = await fetchUazapiGroupInfo(uazapi.apiUrl, uazapi.apiToken, groupId, false);
    }
    const apiParticipants = extractParticipantArray(groupInfo);

    const fallbackList = Array.isArray(fallbackParticipants) ? fallbackParticipants : [];
    const fallbackRealPhoneCount = fallbackList.filter((p) => {
      return Boolean(normalizeRealPhoneValue(p?.PhoneNumber || p?.phoneNumber || p?.phone_number || p?.number || p?.Number || p?.phone || p?.Phone || p?.user || p?.User || p?.JID || p?.jid || p?.id || p?.participant));
    }).length;
    const rawParticipants = !isCommunity && fallbackRealPhoneCount > 0 ? fallbackList : (apiParticipants.length > 0 ? apiParticipants : fallbackList);

    const resolvedParticipants: Participant[] = [];
    const unresolvedLidParticipants: Participant[] = [];
    const lidParticipants: string[] = [];

    for (const p of rawParticipants) {
      const lidCandidate = String(p.lid || p.LID || p.lidJid || p.alt || p.altJid || "").trim();
      const phoneCandidates = [
        p.PhoneNumber, p.phoneNumber, p.phone_number, p.number, p.Number, p.phone, p.Phone, 
        p.contactNumber, p.contact?.phone, p.contact?.number, p.realPhone, p.realJid, 
        p.PN, p.pn, p.participantPn, p.ParticipantPN, p.JID, p.jid, p.id, p.participant, 
        p.user, p.User,
      ];

      const cleanPhone = phoneCandidates.map(normalizeRealPhoneValue).find(Boolean) || "";
      const hasRealPhone = cleanPhone.length >= 8;

      const normalizedId = String(
        p.LID || p.lid || p.lidJid || p.JID || p.jid || p.id || p.participant || p.phone || "",
      ).trim();

      if (!isCommunity && hasRealPhone) {
        resolvedParticipants.push({
          phone: cleanPhone,
          isAdmin: Boolean(p.isAdmin || p.admin),
          isSuperAdmin: Boolean(p.isSuperAdmin || p.superAdmin),
          name: p.name || p.short || p.notify || p.pushName || "",
        });
        continue;
      }

      const isLid = normalizedId.includes("@lid") || Boolean(lidCandidate);

      if (isLid) {
        const lidId = normalizeLidValue(lidCandidate || normalizedId);
        if (!lidId) continue;
        lidParticipants.push(lidId);
        unresolvedLidParticipants.push({
          phone: lidId,
          isAdmin: Boolean(p.isAdmin || p.admin),
          isSuperAdmin: Boolean(p.isSuperAdmin || p.superAdmin),
          name: p.name || p.short || p.notify || p.pushName || "",
        });
        continue;
      }

      if (hasRealPhone) {
        resolvedParticipants.push({
          phone: cleanPhone,
          isAdmin: Boolean(p.isAdmin || p.admin),
          isSuperAdmin: Boolean(p.isSuperAdmin || p.superAdmin),
          name: p.name || p.short || p.notify || p.pushName || "",
        });
      } else if (isCommunity) {
        const lidId = normalizeLidValue(normalizedId);
        if (lidId) {
          lidParticipants.push(lidId);
          unresolvedLidParticipants.push({
            phone: lidId,
            isAdmin: Boolean(p.isAdmin || p.admin),
            isSuperAdmin: Boolean(p.isSuperAdmin || p.superAdmin),
            name: p.name || p.short || p.notify || p.pushName || "",
          });
        }
      }
    }

    if (lidParticipants.length > 0) {
      try {
        const lidToPhone = new Map<string, string>();
        if (!isCommunity) try {
          const findRes = await fetch(`${uazapi.apiUrl}/chat/find`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: uazapi.apiToken },
            body: JSON.stringify({ numbers: lidParticipants }),
          });
          const findText = await findRes.text();
          let findData: any = {};
          try { findData = JSON.parse(findText); } catch { findData = {}; }
          const list = Array.isArray(findData) ? findData : (Array.isArray(findData?.chats) ? findData.chats : (Array.isArray(findData?.data) ? findData.data : []));
          for (const item of list) {
            const lidKey = String(item?.lid || item?.LID || item?.query || item?.input || item?.jid_lid || "").trim();
            const realPhone = String(item?.phoneNumber || item?.number || item?.phone || item?.wa_chatid || item?.id || "").replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "");
            if (lidKey && realPhone && realPhone.length >= 8) {
              lidToPhone.set(lidKey, realPhone);
            }
          }
          console.log(`🔁 UAZAPI /chat/find resolved ${lidToPhone.size}/${lidParticipants.length} LIDs`);
        } catch (findErr) {
          console.error("⚠️ UAZAPI /chat/find failed:", findErr);
        }

        const { data: lidMappings } = isCommunity ? { data: [] } : await adminClient
          .from("message_logs")
          .select("phone, message_received")
          .eq("user_id", uazapi.userId)
          .eq("keyword_matched", "__lid_map__")
          .in("message_received", lidParticipants);

        const mappingByLid = new Map<string, string>(
          (lidMappings || [])
            .map((m): [string, string] | null => {
              const lid = String(m.message_received || "").trim();
              const phone = String(m.phone || "").replace(/\D/g, "");
              return lid && phone ? [lid, phone] : null;
            })
            .filter((entry): entry is [string, string] => Boolean(entry)),
        );

        for (const participant of unresolvedLidParticipants) {
          const resolvedPhone = lidToPhone.get(participant.phone) || mappingByLid.get(participant.phone);
          if (resolvedPhone) {
            resolvedParticipants.push({ ...participant, phone: resolvedPhone });
          } else {
            resolvedParticipants.push(participant);
          }
        }
      } catch (dbError) {
        console.error("❌ LID mapping error:", dbError);
        resolvedParticipants.push(...unresolvedLidParticipants);
      }
    }

    const seen = new Set<string>();
    const uniqueParticipants = resolvedParticipants.filter((p) => {
      if (!p.phone || seen.has(p.phone)) return false;
      seen.add(p.phone);
      return true;
    });

    const groupName =
      groupInfo?.subject || groupInfo?.name || groupInfo?.Name || groupInfo?.Topic ||
      groupInfo?.group?.subject || groupInfo?.groupMetadata?.subject || "";

    console.log(`✅ UAZAPI participants resolved: ${uniqueParticipants.length}`);

    return new Response(
      JSON.stringify({
        groupName,
        description: groupInfo?.description || groupInfo?.desc || "",
        owner: groupInfo?.owner || "",
        participants: uniqueParticipants,
        totalLids: lidParticipants.length,
        resolvedLids: uniqueParticipants.filter((p) => !String(p.phone).includes("@lid")).length,
        unresolvedLids: uniqueParticipants.filter((p) => String(p.phone).includes("@lid")).length,
        usedFallbackParticipants: apiParticipants.length === 0 && fallbackList.length > 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("❌ get-group-participants error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
