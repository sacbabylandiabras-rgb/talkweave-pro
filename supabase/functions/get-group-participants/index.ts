import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

interface Participant {
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  name: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { groupId, fallbackParticipants = [], sourceInstanceId = null } = await req.json();
    if (!groupId) throw new Error('groupId is required');

    let instanceId = credentials.instanceId;
    let token = credentials.token;
    let clientToken = credentials.clientToken;

    if (sourceInstanceId) {
      const { data: sourceInstance } = await adminClient
        .from('zapi_instances')
        .select('zapi_instance_id, zapi_token, zapi_client_token')
        .eq('user_id', credentials.userId)
        .eq('zapi_instance_id', sourceInstanceId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (sourceInstance) {
        instanceId = sourceInstance.zapi_instance_id;
        token = sourceInstance.zapi_token;
        clientToken = sourceInstance.zapi_client_token;
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'Client-Token': clientToken,
    };

    const fetchGroupMetadata = async (targetId: string) => {
      const response = await fetch(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/group-metadata/${targetId}`,
        { method: 'GET', headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Z-API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    };

    const fetchCommunityMetadata = async (communityId: string) => {
      const normalizedCommunityId = communityId.replace('-group', '');
      const response = await fetch(
        `https://api.z-api.io/instances/${instanceId}/token/${token}/communities-metadata/${normalizedCommunityId}`,
        { method: 'GET', headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`⚠️ Community metadata unavailable for ${normalizedCommunityId}: ${response.status} - ${errorText}`);
        return null;
      }

      return await response.json();
    };

    console.log(`📱 Fetching participants for group/community: ${groupId} | instance: ${instanceId}`);

    const primaryData = await fetchGroupMetadata(groupId);
    let apiParticipants = Array.isArray(primaryData.participants) ? primaryData.participants : [];

    if (apiParticipants.length === 0) {
      const candidateCommunityId = primaryData.communityId || groupId;
      const communityData = await fetchCommunityMetadata(candidateCommunityId);
      const subGroups = Array.isArray(communityData?.subGroups) ? communityData.subGroups : [];

      if (subGroups.length > 0) {
        console.log(`🏘️ Community detected for ${candidateCommunityId}. Linked groups: ${subGroups.length}`);
        const aggregatedParticipants: any[] = [];

        for (const subGroup of subGroups) {
          const subGroupId = subGroup.phone || subGroup.id;
          if (!subGroupId) continue;

          try {
            const subGroupData = await fetchGroupMetadata(subGroupId);
            const subGroupParticipants = Array.isArray(subGroupData.participants) ? subGroupData.participants : [];
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
    const fallbackHasOnlyAdmins = fallbackList.length > 0 && fallbackList.every((p) => Boolean(p?.isAdmin) || Boolean(p?.isSuperAdmin));
    const shouldUseFallback = apiParticipants.length === 0 && fallbackList.length > 0 && !fallbackHasOnlyAdmins;
    const rawParticipants = shouldUseFallback ? fallbackList : apiParticipants;

    console.log(`✅ Group metadata received, API participants: ${apiParticipants.length}, fallback participants: ${fallbackList.length}, fallback only admins: ${fallbackHasOnlyAdmins}`);

    const resolvedParticipants: Participant[] = [];
    const unresolvedLidParticipants: Participant[] = [];
    const lidParticipants: string[] = [];

    for (const p of rawParticipants) {
      const rawId = p.phone || p.id || p.participant || '';
      const normalizedId = String(rawId).trim();
      const cleanPhone = normalizedId.replace('@c.us', '').replace(/\D/g, '');

      if (normalizedId.includes('@lid')) {
        lidParticipants.push(normalizedId);
        unresolvedLidParticipants.push({
          phone: normalizedId,
          isAdmin: Boolean(p.isAdmin),
          isSuperAdmin: Boolean(p.isSuperAdmin),
          name: p.name || p.short || p.notify || '',
        });
        continue;
      }

      if (cleanPhone.length >= 8) {
        resolvedParticipants.push({
          phone: cleanPhone,
          isAdmin: Boolean(p.isAdmin),
          isSuperAdmin: Boolean(p.isSuperAdmin),
          name: p.name || p.short || p.notify || '',
        });
      }
    }

    console.log(`📊 Direct phones: ${resolvedParticipants.length}, LID identifiers: ${lidParticipants.length}`);

    if (lidParticipants.length > 0) {
      try {
        const { data: lidMappings } = await adminClient
          .from('message_logs')
          .select('phone, message_received')
          .eq('user_id', credentials.userId)
          .eq('keyword_matched', '__lid_map__')
          .in('message_received', lidParticipants);

        const mappingByLid = new Map(
          (lidMappings || [])
            .map((mapping) => [mapping.message_received, String(mapping.phone || '').replace(/\D/g, '')])
            .filter(([, phone]) => Boolean(phone))
        );

        for (const participant of unresolvedLidParticipants) {
          const resolvedPhone = mappingByLid.get(participant.phone);
          resolvedParticipants.push({
            ...participant,
            phone: resolvedPhone || participant.phone,
          });
        }

        const resolvedLids = new Set((lidMappings || []).map((m) => m.message_received));
        const unresolvedCount = lidParticipants.filter((lid) => !resolvedLids.has(lid)).length;
        if (unresolvedCount > 0) {
          console.log(`⚠️ ${unresolvedCount} LID identifiers could not be resolved`);
        }
      } catch (dbError) {
        console.error('❌ Error resolving LID mappings:', dbError);
        resolvedParticipants.push(...unresolvedLidParticipants);
      }
    }

    const seenPhones = new Set<string>();
    const uniqueParticipants = resolvedParticipants.filter((p) => {
      if (!p.phone || seenPhones.has(p.phone)) return false;
      seenPhones.add(p.phone);
      return true;
    });

    console.log(`✅ Final unique participants: ${uniqueParticipants.length}`);

    return new Response(JSON.stringify({
      groupName: primaryData.subject || primaryData.name || '',
      description: primaryData.description || '',
      owner: primaryData.owner || '',
      participants: uniqueParticipants,
      totalLids: lidParticipants.length,
      resolvedLids: uniqueParticipants.filter((p) => !String(p.phone).includes('@lid')).length,
      unresolvedLids: uniqueParticipants.filter((p) => String(p.phone).includes('@lid')).length,
      usedFallbackParticipants: shouldUseFallback,
      partialAdminsOnlyFallback: apiParticipants.length === 0 && fallbackHasOnlyAdmins,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error fetching group participants:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});