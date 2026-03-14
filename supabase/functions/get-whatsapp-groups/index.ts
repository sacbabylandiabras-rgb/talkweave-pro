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

    // Fetch groups from Z-API
    const zapiUrl = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}/chats`;
    
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

    const chats = await response.json();

    // Filter only groups (groups have @g.us in the phone/id)
    const groups = Array.isArray(chats)
      ? chats.filter((chat: any) => {
          const chatId = chat.phone || chat.id || '';
          return chatId.includes('@g.us') || chat.isGroup === true;
        })
      : [];

    console.log(`✅ Found ${groups.length} groups`);

    // Map to a clean format
    const mappedGroups = groups.map((group: any, index: number) => ({
      id: group.phone || group.id || `group-${index}`,
      nome: group.name || group.contact || group.title || 'Grupo sem nome',
      descricao: group.description || group.subject || '',
      membros: group.participants?.length || group.memberCount || group.size || 0,
      foto: group.imgUrl || group.profilePicture || group.image || null,
      ultimaMensagem: group.lastMessageTime || group.lastMessage?.timestamp || null,
      isAdmin: group.isAdmin || false,
      participantes: group.participants || [],
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
