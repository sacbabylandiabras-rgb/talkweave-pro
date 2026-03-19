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

    const { groupId } = await req.json();
    if (!groupId) {
      throw new Error('groupId is required');
    }

    console.log(`📱 Fetching participants for group: ${groupId}`);

    const zapiUrl = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/group-metadata/${groupId}`;
    const response = await fetch(zapiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': credentials.clientToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Z-API error: ${response.status} - ${errorText}`);
      throw new Error(`Z-API error: ${response.status}`);
    }

    const data = await response.json();
    const rawParticipants = data.participants || [];
    console.log(`✅ Group metadata received, raw participants: ${rawParticipants.length}`);

    // Separate participants with phone numbers vs @lid identifiers
    const resolvedParticipants: any[] = [];
    const lidParticipants: string[] = [];

    for (const p of rawParticipants) {
      const id = p.phone || p.id || '';
      const cleanId = id.replace('@c.us', '').replace('@lid', '');

      if (id.includes('@lid') || (!id.includes('@c.us') && cleanId.length < 8)) {
        // This is a @lid identifier, needs resolution
        lidParticipants.push(cleanId);
      } else {
        // Normal phone number
        resolvedParticipants.push({
          phone: cleanId,
          isAdmin: p.isAdmin || false,
          isSuperAdmin: p.isSuperAdmin || false,
          name: p.name || p.short || p.notify || '',
        });
      }
    }

    console.log(`📊 Direct phones: ${resolvedParticipants.length}, LID identifiers: ${lidParticipants.length}`);

    // Resolve @lid identifiers from message_logs mapping
    if (lidParticipants.length > 0) {
      try {
        const { data: lidMappings } = await adminClient
          .from('message_logs')
          .select('phone, message_received')
          .eq('user_id', credentials.userId)
          .eq('keyword_matched', '__lid_map__')
          .in('response_sent', lidParticipants);

        if (lidMappings && lidMappings.length > 0) {
          console.log(`🔗 Resolved ${lidMappings.length} LID mappings from database`);
          for (const mapping of lidMappings) {
            resolvedParticipants.push({
              phone: mapping.phone,
              isAdmin: false,
              isSuperAdmin: false,
              name: '',
            });
          }
        }

        // For unresolved LIDs, try to include them with a marker
        const resolvedLids = new Set(lidMappings?.map(m => m.response_sent) || []);
        const unresolvedCount = lidParticipants.filter(lid => !resolvedLids.has(lid)).length;
        if (unresolvedCount > 0) {
          console.log(`⚠️ ${unresolvedCount} LID identifiers could not be resolved`);
        }
      } catch (dbError) {
        console.error('❌ Error resolving LID mappings:', dbError);
      }
    }

    // Deduplicate by phone
    const seenPhones = new Set<string>();
    const uniqueParticipants = resolvedParticipants.filter(p => {
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
      resolvedLids: lidParticipants.length > 0 ? uniqueParticipants.length - resolvedParticipants.filter(p => !lidParticipants.includes(p.phone)).length : 0,
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