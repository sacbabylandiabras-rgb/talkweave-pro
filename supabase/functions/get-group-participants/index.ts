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
    console.log(`✅ Group metadata received, participants: ${data.participants?.length || 0}`);

    const participants = (data.participants || []).map((p: any) => ({
      phone: p.phone || p.id?.replace('@c.us', '') || '',
      isAdmin: p.isAdmin || false,
      isSuperAdmin: p.isSuperAdmin || false,
      name: p.name || p.short || p.notify || '',
    }));

    return new Response(JSON.stringify({
      groupName: data.subject || data.name || '',
      description: data.description || '',
      owner: data.owner || '',
      participants,
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
