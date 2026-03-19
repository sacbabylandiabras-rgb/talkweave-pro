import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

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
    if (!groupId) {
      throw new Error('groupId is required');
    }

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

    console.log(`📱 Fetching participants for group: ${groupId} | instance: ${instanceId}`);

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/group-metadata/${groupId}`;
    const response = await fetch(zapiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Z-API error: ${response.status} - ${errorText}`);
      throw new Error(`Z-API error: ${response.status}`);
    }

    const data = await response.json();
    const apiParticipants = Array.isArray(data.participants) ? data.participants : [];
    const fallbackList = Array.isArray(fallbackParticipants) ? fallbackParticipants : [];
    const fallbackHasOnlyAdmins = fallbackList.length > 0 && fallbackList.every((p) => Boolean(p?.isAdmin) || Boolean(p?.isSuperAdmin));
    const shouldUseFallback = apiParticipants.length === 0 && fallbackList.length > 0 && !fallbackHasOnlyAdmins;
    const rawParticipants = shouldUseFallback ? fallbackList : apiParticipants;
    console.log(`✅ Group metadata received, API participants: ${apiParticipants.length}, fallback participants: ${fallbackList.length}, fallback only admins: ${fallbackHasOnlyAdmins}`);

    const resolvedParticipants: Array<{
      phone: string;
      isAdmin: boolean;
      isSuperAdmin: boolean;
      name: string;
    }> = [];
    const unresolvedLidParticipants: Array<{
      phone: string;
      isAdmin: boolean;
      isSuperAdmin: boolean;
      name: string;
    }> = [];
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

        if (lidMappings && lidMappings.length > 0) {
          console.log(`🔗 Resolved ${lidMappings.length} LID mappings from database`);
          const mappingByLid = new Map(
            lidMappings
              .map((mapping) => [mapping.message_received, String(mapping.phone || '').replace(/\D/g, '')])
              .filter(([, phone]) => Boolean(phone))
          );

          for (const participant of unresolvedLidParticipants) {
            const resolvedPhone = mappingByLid.get(participant.phone);
            if (resolvedPhone) {
              resolvedParticipants.push({
                ...participant,
                phone: resolvedPhone,
              });
            } else {
              resolvedParticipants.push(participant);
            }
          }
        } else {
          resolvedParticipants.push(...unresolvedLidParticipants);
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
      groupName: data.subject || data.name || '',
      description: data.description || '',
      owner: data.owner || '',
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