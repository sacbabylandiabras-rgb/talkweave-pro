import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

interface Participant {
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  name: string;
}

interface GroupCredentials {
  instanceId: string;
  token: string;
  clientToken: string;
  userId: string;
}

const normalizeGroupId = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("@g.us")) return raw.replace("@g.us", "-group");
  return raw;
};

const normalizeCommunityId = (value: string | null | undefined) => {
  return String(value || "")
    .trim()
    .replace(/@g\.us$/i, "")
    .replace(/-group$/i, "");
};

const normalizeLidValue = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("@lid")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `${digits}@lid` : raw;
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
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const normalized = normalizeParticipantEntries(candidate);
    if (normalized.length > 0) return normalized;
  }

  return extractDeepParticipantArray(payload);
};

const buildCommunityCandidates = (groupId: string, primaryData: any) => {
  return uniqueStrings([
    normalizeCommunityId(primaryData?.communityId),
    normalizeCommunityId(primaryData?.parentCommunityId),
    normalizeCommunityId(primaryData?.linkedCommunityId),
    normalizeCommunityId(primaryData?.id),
    normalizeCommunityId(primaryData?.phone),
    normalizeCommunityId(groupId),
  ]);
};

const extractCommunitySubGroupIds = (payload: any) => {
  const candidates = [
    payload?.subGroups,
    payload?.SubGroups,
    payload?.groups,
    payload?.communityGroups,
    payload?.linkedGroups,
    payload?.children,
    payload?.data?.subGroups,
    payload?.data?.SubGroups,
    payload?.data?.groups,
    payload?.result?.subGroups,
    payload?.result?.groups,
  ];

  const communityIdsToIgnore = new Set(
    uniqueStrings([
      normalizeCommunityId(payload?.id),
      normalizeCommunityId(payload?.phone),
      normalizeCommunityId(payload?.communityId),
      normalizeCommunityId(payload?.parentCommunityId),
    ]),
  );

  const extractGroupIdsRecursively = (value: any, seen = new WeakSet<object>()): string[] => {
    if (value == null) return [];

    if (typeof value === "string" || typeof value === "number") {
      const directValue = String(value).trim();
      return isLikelyGroupId(directValue) ? [directValue] : [];
    }

    if (typeof value !== "object") return [];
    if (seen.has(value)) return [];
    seen.add(value);

    if (Array.isArray(value)) {
      return uniqueStrings(value.flatMap((entry) => extractGroupIdsRecursively(entry, seen)));
    }

    const directIds = uniqueStrings([
      toEntityLikeString(value),
      toEntityLikeString(value?.id),
      toEntityLikeString(value?.jid),
      toEntityLikeString(value?.JID),
      toEntityLikeString(value?.groupJid),
      toEntityLikeString(value?.GroupJid),
      toEntityLikeString(value?.groupId),
      toEntityLikeString(value?.remoteJid),
      toEntityLikeString(value?.chatJid),
      toEntityLikeString(value?.group),
      toEntityLikeString(value?.subGroup),
      toEntityLikeString(value?.chatId),
      toEntityLikeString(value?.key?.remoteJid),
      toEntityLikeString(value?.metadata?.id),
      toEntityLikeString(value?.metadata?.jid),
    ]).filter((entry) => isLikelyGroupId(entry));

    const nestedIds = uniqueStrings(
      Object.values(value).flatMap((entry) => extractGroupIdsRecursively(entry, seen)),
    );

    return uniqueStrings([...directIds, ...nestedIds]);
  };

  for (const candidate of candidates) {
    if (!candidate) continue;

    const ids = extractGroupIdsRecursively(candidate).filter((entry) => {
      const normalizedEntry = normalizeCommunityId(entry);
      return normalizedEntry && !communityIdsToIgnore.has(normalizedEntry);
    });

    if (ids.length > 0) return ids;
  }

  return [];
};

const fetchJson = async (url: string, headers: Record<string, string>) => {
  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z-API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
};

const numericCount = (...values: unknown[]): number => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = typeof value === "number" ? value : Number(String(value).replace(/\D/g, ""));
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
};

const fetchNewsletterCount = async (instanceId: string, token: string, clientToken: string, groupId: string) => {
  const headers = { "Content-Type": "application/json", "Client-Token": clientToken };
  const cleanId = String(groupId).replace("@newsletter", "");
  const newsletterId = `${cleanId}@newsletter`;
  const paths = [
    `/newsletter/metadata/${newsletterId}`,
    `/newsletter/metadata/${cleanId}`,
    `/newsletter/metadata?newsletterId=${encodeURIComponent(newsletterId)}`,
  ];

  for (const path of paths) {
    try {
      const data = await fetchJson(`https://api.z-api.io/instances/${instanceId}/token/${token}${path}`, headers);
      const count = numericCount(
        data?.subscribersCount,
        data?.subscriberCount,
        data?.subscribers,
        data?.followersCount,
        data?.membersCount,
        data?.memberCount,
        data?.metadata?.subscribersCount,
        data?.metadata?.subscriberCount,
        data?.metadata?.followersCount,
      );
      const name = data?.name || data?.subject || data?.title || data?.metadata?.name || "";
      const picture = data?.picture || data?.preview || data?.image || data?.profilePicture || data?.metadata?.picture || null;
      console.log(`📺 Newsletter count for ${groupId}: ${count} via ${path}`);
      return { count, name, picture };
    } catch (error) {
      console.log(`⚠️ Newsletter count unavailable via ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { count: 0, name: "", picture: null };
};

const resolveCredentials = async (
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string,
  sourceInstanceId: string | null,
): Promise<GroupCredentials> => {
  const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  if (!sourceInstanceId) {
    return credentials;
  }

  const { data: sourceInstance } = await adminClient
    .from("zapi_instances")
    .select("zapi_instance_id, zapi_token, zapi_client_token")
    .eq("user_id", credentials.userId)
    .eq("zapi_instance_id", sourceInstanceId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!sourceInstance) {
    return credentials;
  }

  return {
    ...credentials,
    instanceId: sourceInstance.zapi_instance_id,
    token: sourceInstance.zapi_token,
    clientToken: sourceInstance.zapi_client_token,
  };
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

  // 1) Try the exact source instance first (so each group hits its own uazapi)
  if (sourceInstanceId) {
    // 1a) Virtual instances coming from profile-level uazapi credentials (profile-uazapi-1 / profile-uazapi-2)
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

  // 2) Fallback: any active uazapi instance for this user (default first)
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
    // 3) Final fallback: profile-level uazapi credentials (first one)
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

    // Try UAZAPI first when the source instance (or any active instance) uses uazapi
    const uazapi = await resolveUazapiInstance(req, supabaseUrl, supabaseServiceKey, sourceInstanceId);
    const isChannel = String(groupId).toLowerCase().includes("@newsletter");
    if (isChannel) {
      const credentials = await resolveCredentials(req, supabaseUrl, supabaseServiceKey, sourceInstanceId);
      const metadata = await fetchNewsletterCount(credentials.instanceId, credentials.token, credentials.clientToken, groupId);
      return new Response(
        JSON.stringify({
          participants: [],
          isChannel: true,
          memberCount: metadata.count,
          subscriberCount: metadata.count,
          groupName: metadata.name,
          profilePicture: metadata.picture,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (uazapi) {
      console.log(`📱 UAZAPI participants for ${groupId}`);
      try {
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
          // Prefer real phone identifiers over @lid. UAZAPI often returns the
          // real number under fields like phoneNumber/number/user even when
          // the primary id is a @lid alias.
          const lidCandidate = String(
            p.lid || p.LID || p.lidJid || p.alt || p.altJid || ""
          ).trim();
          const phoneCandidates = [
            p.PhoneNumber,
            p.phoneNumber,
            p.phone_number,
            p.number,
            p.Number,
            p.phone,
            p.Phone,
            p.contactNumber,
            p.contact?.phone,
            p.contact?.number,
            p.realPhone,
            p.realJid,
            p.PN,
            p.pn,
            p.participantPn,
            p.ParticipantPN,
            p.JID,
            p.jid,
            p.id,
            p.participant,
            p.user,
            p.User,
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

          const isLid = normalizedId.includes("@lid") || Boolean(lidCandidate) || isCommunity;

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
          }
        }

        if (lidParticipants.length > 0) {
          try {
            // 1) Try to actively resolve LIDs via uazapi /chat/find (returns real numbers)
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
              const list = Array.isArray(findData)
                ? findData
                : Array.isArray(findData?.chats)
                  ? findData.chats
                  : Array.isArray(findData?.data)
                    ? findData.data
                    : [];
              for (const item of list) {
                const lidKey = String(
                  item?.lid || item?.LID || item?.query || item?.input || item?.jid_lid || ""
                ).trim();
                const realPhone = String(
                  item?.phoneNumber || item?.number || item?.phone || item?.wa_chatid || item?.id || ""
                ).replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "");
                if (lidKey && realPhone && realPhone.length >= 8) {
                  lidToPhone.set(lidKey, realPhone);
                }
              }
              console.log(`🔁 UAZAPI /chat/find resolved ${lidToPhone.size}/${lidParticipants.length} LIDs`);
            } catch (findErr) {
              console.error("⚠️ UAZAPI /chat/find failed:", findErr);
            }

            // 2) Fallback to local mapping table
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
                // Keep unresolved LIDs so the member count reflects reality.
                // They cannot receive direct messages, but they are real members.
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

        console.log(`✅ UAZAPI participants resolved: ${uniqueParticipants.length} (community mode: ${isCommunity}, LIDs: ${lidParticipants.length})`);

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
            partialAdminsOnlyFallback: false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (uazError) {
        console.error("❌ UAZAPI participants failed, falling back to Z-API path:", uazError);
      }
    }

    const credentials = await resolveCredentials(req, supabaseUrl, supabaseServiceKey, sourceInstanceId);
    const instanceId = credentials.instanceId;
    const token = credentials.token;
    const clientToken = credentials.clientToken;

    const headers = {
      "Content-Type": "application/json",
      "Client-Token": clientToken,
    };

    const fetchGroupMetadata = async (targetId: string) => {
      const normalizedTargetId = normalizeGroupId(targetId);
      const strippedTargetId = normalizeCommunityId(targetId);
      const targetCandidates = uniqueStrings([
        normalizedTargetId,
        normalizedTargetId.replace(/-group$/i, "@g.us"),
        strippedTargetId,
        /^\d{15,}$/.test(strippedTargetId) ? `${strippedTargetId}-group` : "",
        /^\d{15,}$/.test(strippedTargetId) ? `${strippedTargetId}@g.us` : "",
      ]);

      let lastError: Error | null = null;

      for (const candidateId of targetCandidates) {
        try {
          return await fetchJson(
            `https://api.z-api.io/instances/${instanceId}/token/${token}/group-metadata/${candidateId}`,
            headers,
          );
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      throw lastError || new Error(`Unable to fetch group metadata for ${targetId}`);
    };

    const fetchCommunityMetadata = async (communityId: string) => {
      const candidates = uniqueStrings([
        normalizeCommunityId(communityId),
        normalizeGroupId(communityId),
      ]);

      for (const candidateId of candidates) {
        try {
          const data = await fetchJson(
            `https://api.z-api.io/instances/${instanceId}/token/${token}/communities-metadata/${candidateId}`,
            headers,
          );
          console.log(`🏘️ Community metadata loaded for ${candidateId}`);
          return data;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`⚠️ Community metadata unavailable for ${candidateId}: ${message}`);
        }
      }

      return null;
    };

    console.log(`📱 Fetching participants for group/community: ${groupId} | instance: ${instanceId}`);

    let primaryData: any = null;
    try {
      primaryData = await fetchGroupMetadata(groupId);
    } catch (metaError) {
      const msg = metaError instanceof Error ? metaError.message : String(metaError);
      console.log(`⚠️ group-metadata failed for ${groupId}, will try community path: ${msg}`);
      // If group-metadata fails, we still need an object for basic fields
      primaryData = { subject: "", name: "", description: "", owner: "" };
    }
    let apiParticipants = extractParticipantArray(primaryData);

    if (apiParticipants.length === 0) {
      const communityCandidates = buildCommunityCandidates(groupId, primaryData);

      for (const candidateCommunityId of communityCandidates) {
        const communityData = await fetchCommunityMetadata(candidateCommunityId);
        if (!communityData) continue;

        console.log(
          `🔍 Community payload keys for ${candidateCommunityId}: ${Object.keys(communityData || {}).join(", ")}`,
        );

        // First try direct participants from community metadata
        const directCommunityParticipants = extractParticipantArray(communityData);
        console.log(
          `🏘️ Direct community participants found for ${candidateCommunityId}: ${directCommunityParticipants.length}`,
        );

        if (directCommunityParticipants.length > 0) {
          apiParticipants = directCommunityParticipants;
          break;
        }

        // Z-API communities-metadata returns subGroups but not members directly.
        // Iterate through each subGroup and fetch participants from each one.
        const subGroupIds = extractCommunitySubGroupIds(communityData);

        if (subGroupIds.length === 0 && communityData?.subGroups) {
          console.log(
            `⚠️ subGroups found but no ids extracted for ${candidateCommunityId}. Sample: ${JSON.stringify(communityData.subGroups).slice(0, 1200)}`,
          );
        }

        if (subGroupIds.length > 0) {
          console.log(`📂 Community has ${subGroupIds.length} subGroups, fetching participants from each...`);
          console.log(`🧩 Resolved subGroup ids: ${subGroupIds.slice(0, 10).join(", ")}`);
          const allSubGroupParticipants: any[] = [];

          for (const subGroupId of subGroupIds) {
            if (!subGroupId || !isLikelyGroupId(subGroupId)) continue;

            try {
              const subGroupData = await fetchGroupMetadata(subGroupId);
              const subParticipants = extractParticipantArray(subGroupData);
              console.log(`  📋 SubGroup ${subGroupId}: ${subParticipants.length} participants`);
              allSubGroupParticipants.push(...subParticipants);
            } catch (subError) {
              const msg = subError instanceof Error ? subError.message : String(subError);
              console.log(`  ⚠️ Failed to fetch subGroup ${subGroupId}: ${msg}`);
            }
          }

          if (allSubGroupParticipants.length > 0) {
            apiParticipants = allSubGroupParticipants;
            console.log(`✅ Aggregated ${allSubGroupParticipants.length} participants from ${subGroupIds.length} subGroups`);
            break;
          }
        }

        console.log(`🔄 Z-API returned no community members from subGroups either.`);
      }
    }


    const fallbackList = Array.isArray(fallbackParticipants) ? fallbackParticipants : [];
    const fallbackHasOnlyAdmins =
      fallbackList.length > 0 && fallbackList.every((p) => Boolean(p?.isAdmin) || Boolean(p?.isSuperAdmin));
    const shouldUseFallback = apiParticipants.length === 0 && fallbackList.length > 0 && !fallbackHasOnlyAdmins;
    const rawParticipants = shouldUseFallback ? fallbackList : apiParticipants;

    console.log(
      `✅ Group metadata received, API participants: ${apiParticipants.length}, fallback participants: ${fallbackList.length}, fallback only admins: ${fallbackHasOnlyAdmins}`,
    );

    const resolvedParticipants: Participant[] = [];
    const unresolvedLidParticipants: Participant[] = [];
    const lidParticipants: string[] = [];

    for (const p of rawParticipants) {
      const rawId = p.phone || p.id || p.participant || "";
      const normalizedId = String(rawId).trim();
      const cleanPhone = normalizedId.replace("@c.us", "").replace(/\D/g, "");

      if (normalizedId.includes("@lid")) {
        const lidId = normalizeLidValue(normalizedId);
        lidParticipants.push(lidId);
        unresolvedLidParticipants.push({
          phone: lidId,
          isAdmin: Boolean(p.isAdmin),
          isSuperAdmin: Boolean(p.isSuperAdmin),
          name: p.name || p.short || p.notify || "",
        });
        continue;
      }

      if (isCommunity && cleanPhone.length >= 8) {
        const lidId = normalizeLidValue(cleanPhone);
        lidParticipants.push(lidId);
        unresolvedLidParticipants.push({
          phone: lidId,
          isAdmin: Boolean(p.isAdmin),
          isSuperAdmin: Boolean(p.isSuperAdmin),
          name: p.name || p.short || p.notify || "",
        });
        continue;
      }

      if (cleanPhone.length >= 8) {
        resolvedParticipants.push({
          phone: cleanPhone,
          isAdmin: Boolean(p.isAdmin),
          isSuperAdmin: Boolean(p.isSuperAdmin),
          name: p.name || p.short || p.notify || "",
        });
      }
    }

    console.log(`📊 Direct phones: ${resolvedParticipants.length}, LID identifiers: ${lidParticipants.length}`);

    if (lidParticipants.length > 0) {
      try {
        const { data: lidMappings } = isCommunity ? { data: [] } : await adminClient
          .from("message_logs")
          .select("phone, message_received")
          .eq("user_id", credentials.userId)
          .eq("keyword_matched", "__lid_map__")
          .in("message_received", lidParticipants);

        const mappingEntries = (lidMappings || [])
          .map((mapping): [string, string] | null => {
            const lid = String(mapping.message_received || "").trim();
            const phone = String(mapping.phone || "").replace(/\D/g, "");
            if (!lid || !phone) return null;
            return [lid, phone];
          })
          .filter((entry): entry is [string, string] => Boolean(entry));

        const mappingByLid = new Map<string, string>(mappingEntries);

        for (const participant of unresolvedLidParticipants) {
          const resolvedPhone = mappingByLid.get(participant.phone);
          resolvedParticipants.push({
            ...participant,
            phone: resolvedPhone ?? participant.phone,
          });
        }

        const resolvedLids = new Set((lidMappings || []).map((mapping) => mapping.message_received));
        const unresolvedCount = lidParticipants.filter((lid) => !resolvedLids.has(lid)).length;
        if (unresolvedCount > 0) {
          console.log(`⚠️ ${unresolvedCount} LID identifiers could not be resolved`);
        }
      } catch (dbError) {
        console.error("❌ Error resolving LID mappings:", dbError);
        resolvedParticipants.push(...unresolvedLidParticipants);
      }
    }

    const seenPhones = new Set<string>();
    const uniqueParticipants = resolvedParticipants.filter((participant) => {
      if (!participant.phone || seenPhones.has(participant.phone)) return false;
      seenPhones.add(participant.phone);
      return true;
    });

    console.log(`✅ Final unique participants: ${uniqueParticipants.length}`);

    return new Response(
      JSON.stringify({
        groupName: primaryData.subject || primaryData.name || "",
        description: primaryData.description || "",
        owner: primaryData.owner || "",
        participants: uniqueParticipants,
        totalLids: lidParticipants.length,
        resolvedLids: uniqueParticipants.filter((participant) => !String(participant.phone).includes("@lid")).length,
        unresolvedLids: uniqueParticipants.filter((participant) => String(participant.phone).includes("@lid")).length,
        usedFallbackParticipants: shouldUseFallback,
        partialAdminsOnlyFallback: apiParticipants.length === 0 && fallbackHasOnlyAdmins,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Error fetching group participants:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});