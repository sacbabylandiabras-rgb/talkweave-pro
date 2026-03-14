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

    console.log(`📱 Fetching WhatsApp groups for user: ${credentials.userId}`);

    // Fetch all groups with pagination
    let allGroups: any[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const zapiUrl = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/groups?page=${page}&pageSize=${pageSize}`;
      
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
      const groups = Array.isArray(data) ? data : [];
      
      console.log(`📄 Page ${page}: ${groups.length} groups`);
      allGroups = [...allGroups, ...groups];
      
      hasMore = groups.length === pageSize;
      page++;
      
      // Safety limit
      if (page > 20) break;
    }

    console.log(`✅ Total groups found: ${allGroups.length}`);

    // Map to a clean format
    const mappedGroups = allGroups.map((group: any, index: number) => ({
      id: group.phone || group.id || `group-${index}`,
      nome: group.name || group.contact || group.subject || group.title || 'Grupo sem nome',
      descricao: group.description || group.desc || '',
      membros: group.participants?.length || group.memberCount || group.size || 0,
      foto: group.imgUrl || group.profilePicture || group.image || group.photo || null,
      ultimaMensagem: group.lastMessageTimestamp || group.lastMessageTime || null,
      isAdmin: group.isAdmin || false,
      participantes: group.participants || [],
      archived: group.archived || false,
      pinned: group.pinned || false,
    }));

    return new Response(JSON.stringify({ groups: mappedGroups }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error fetching groups:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
