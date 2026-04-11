import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
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

const uniqueStrings = (values: Array<string | null | undefined>) => {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
};

const extractParticipantArray = (payload: any) => {
  const candidates = [
    payload?.participants,
    payload?.members,
    payload?.groupParticipants,
    payload?.data?.participants,
    payload?.data?.members,
  ];

  return candidates.find(Array.isArray) || [];
};

const normalizeCollection = (value: any) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const nestedArray = Object.values(value).find(Array.isArray);
    if (Array.isArray(nestedArray)) return nestedArray;
  }
  return [];
};

const toGroupLikeString = (value: any): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (value && typeof value === "object") {
    if (typeof value._serialized === "string") return value._serialized.trim();
    if (typeof value.serialized === "string") return value.serialized.trim();
    if (typeof value.id === "string") return value.id.trim();
    if (typeof value.jid === "string") return value.jid.trim();
    if (typeof value.phone === "string") return value.phone.trim();
    if (typeof value.user === "string" && typeof value.server === "string") {
      return `${value.user}@${value.server}`.trim();
    }
  }

  return "";
};

const isLikelyGroupId = (value: any) => {
  const raw = toGroupLikeString(value);
  return Boolean(raw) && (raw.includes("@g.us") || raw.endsWith("-group") || /^\d{15,}$/.test(raw));
};

const toNormalizedGroupCandidate = (value: any) => {
  const raw = toGroupLikeString(value);
  return isLikelyGroupId(raw) ? normalizeGroupId(raw) : "";
};

const extractDeepGroupIds = (value: any, seen = new WeakSet<object>()): string[] => {
  const directCandidate = toNormalizedGroupCandidate(value);
  const directResults = directCandidate ? [directCandidate] : [];

  if (!value || typeof value !== "object") {
    return directResults;
  }

  if (seen.has(value)) {
    return directResults;
  }

  seen.add(value);

  const nestedResults = Object.values(value).flatMap((item) => extractDeepGroupIds(item, seen));
  return uniqueStrings([...directResults, ...nestedResults]);
};

const extractSubGroups = (payload: any) => {
  const candidates = [
    payload,
    payload?.subGroups,
    payload?.subgroups,
    payload?.groups,
    payload?.linkedGroups,
    payload?.communityGroups,
    payload?.children,
    payload?.data,
    payload?.data?.subGroups,
    payload?.data?.subgroups,
    payload?.data?.groups,
    payload?.result,
    payload?.result?.subGroups,
    payload?.result?.groups,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCollection(candidate);
    if (normalized.length > 0) return normalized;
  }

  return [];
};

const extractSubGroupIds = (payload: any) => {
  const subGroups = extractSubGroups(payload);

  console.log(`🔍 extractSubGroupIds: found ${subGroups.length} subGroup entries`);
  if (subGroups.length > 0) {
    console.log(`🔍 First subGroup keys: ${Object.keys(subGroups[0] || {}).join(", ")}`);
    console.log(`🔍 First subGroup sample: ${JSON.stringify(subGroups[0]).substring(0, 500)}`);
  }

  return uniqueStrings(
    subGroups.flatMap((subGroup: any) => {
      const explicitIds = [
        toNormalizedGroupCandidate(subGroup),
        toNormalizedGroupCandidate(subGroup?.phone),
        toNormalizedGroupCandidate(subGroup?.id),
        toNormalizedGroupCandidate(subGroup?.groupId),
        toNormalizedGroupCandidate(subGroup?.groupJid),
        toNormalizedGroupCandidate(subGroup?.jid),
        toNormalizedGroupCandidate(subGroup?.chatId),
        toNormalizedGroupCandidate(subGroup?.group?.phone),
        toNormalizedGroupCandidate(subGroup?.group?.id),
        toNormalizedGroupCandidate(subGroup?.subGroupJid),
        toNormalizedGroupCandidate(subGroup?.linkedGroup),
        toNormalizedGroupCandidate(subGroup?.group),
      ];

      const deepIds = extractDeepGroupIds(subGroup);
      return [...explicitIds, ...deepIds];
    }),
  );
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { groupId, fallbackParticipants = [], sourceInstanceId = null } = await req.json();
    if (!groupId) throw new Error("groupId is required");

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
      const targetCandidates = uniqueStrings([
        normalizedTargetId,
        normalizedTargetId.replace(/-group$/i, "@g.us"),
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

    const primaryData = await fetchGroupMetadata(groupId);
    let apiParticipants = extractParticipantArray(primaryData);
    let detectedSubGroupIds = extractSubGroupIds(primaryData);

    if (apiParticipants.length === 0) {
      const communityCandidates = buildCommunityCandidates(groupId, primaryData);
      let communityData: any = null;

      for (const candidateCommunityId of communityCandidates) {
        communityData = await fetchCommunityMetadata(candidateCommunityId);
        if (communityData) {
          // Debug: log the raw subGroups structure
          const rawSubGroups = communityData?.subGroups || communityData?.subgroups || communityData?.groups;
          if (rawSubGroups) {
            const sample = Array.isArray(rawSubGroups) ? rawSubGroups.slice(0, 2) : rawSubGroups;
            console.log(`🔍 Raw subGroups sample for ${candidateCommunityId}: ${JSON.stringify(sample)}`);
          } else {
            console.log(`🔍 No subGroups/subgroups/groups key found. Keys: ${Object.keys(communityData || {}).join(", ")}`);
          }
          
          const extractedIds = extractSubGroupIds(communityData);
          console.log(
            `🧩 Community payload keys for ${candidateCommunityId}: ${Object.keys(communityData || {}).join(", ")}`,
          );
          console.log(`🧩 Extracted subgroup ids for ${candidateCommunityId}: ${extractedIds.join(", ") || "none"}`);
          if (extractedIds.length > 0) {
            detectedSubGroupIds = extractedIds;
            console.log(`🏘️ Community ${candidateCommunityId} returned ${extractedIds.length} linked groups`);
            break;
          }
        }
      }

      const fallbackSubGroupIds = uniqueStrings([
        ...detectedSubGroupIds,
        normalizeGroupId(primaryData?.announcementGroup?.phone),
        normalizeGroupId(primaryData?.announcementGroup?.id),
        normalizeGroupId(primaryData?.linkedGroupId),
        normalizeGroupId(primaryData?.parentGroupId),
      ]).filter((subGroupId) => subGroupId && subGroupId !== normalizeGroupId(groupId));

      console.log(`🧩 Final subgroup ids for ${groupId}: ${fallbackSubGroupIds.join(", ") || "none"}`);

      if (fallbackSubGroupIds.length > 0) {
        const aggregatedParticipants: any[] = [];

        for (const subGroupId of fallbackSubGroupIds) {
          try {
            const subGroupData = await fetchGroupMetadata(subGroupId);
            const subGroupParticipants = extractParticipantArray(subGroupData);
            console.log(`👥 Subgroup ${subGroupId}: ${subGroupParticipants.length} participants`);
            aggregatedParticipants.push(...subGroupParticipants);
          } catch (subGroupError) {
            console.error(`❌ Failed to fetch subgroup ${subGroupId}:`, subGroupError);
          }
        }

        if (aggregatedParticipants.length > 0) {
          apiParticipants = aggregatedParticipants;
        }
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
        lidParticipants.push(normalizedId);
        unresolvedLidParticipants.push({
          phone: normalizedId,
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
        const { data: lidMappings } = await adminClient
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