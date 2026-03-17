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

    const { type, value, instanceId, token, clientToken } = await req.json();

    if (!type || !value) {
      throw new Error('type and value are required');
    }

    // Use provided instance credentials or fall back to user defaults
    const finalInstanceId = instanceId || credentials.instanceId;
    const finalToken = token || credentials.token;
    const finalClientToken = clientToken || credentials.clientToken;

    let endpoint = '';
    if (type === 'name') {
      endpoint = 'profile-name';
    } else if (type === 'picture') {
      endpoint = 'profile-picture';
    } else {
      throw new Error('type must be "name" or "picture"');
    }

    const zapiUrl = `https://api.z-api.io/instances/${finalInstanceId}/token/${finalToken}/${endpoint}`;
    console.log(`📱 Updating profile ${type} via Z-API: ${zapiUrl}`);

    const response = await fetch(zapiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': finalClientToken,
      },
      body: JSON.stringify({ value }),
    });

    const data = await response.json();
    console.log(`✅ Z-API response status: ${response.status}`, data);

    if (!response.ok) {
      const errorMsg = data.message || data.error || `Z-API error: ${response.status}`;
      throw new Error(errorMsg);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
