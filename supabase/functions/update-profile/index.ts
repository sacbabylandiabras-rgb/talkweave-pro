import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json();
    const { type, value, instanceId, token, clientToken, provider, apiUrl, apiKey } = body;

    if (!type || !value) {
      throw new Error('type and value are required');
    }
    if (type !== 'name' && type !== 'picture') {
      throw new Error('type must be "name" or "picture"');
    }

    // UAZAPI provider
    if (provider === 'uazapi') {
      const baseUrl = (apiUrl || '').replace(/\/+$/, '');
      const instanceToken = apiKey || token;
      if (!baseUrl || !instanceToken) {
        throw new Error('UAZAPI: apiUrl e apiKey são obrigatórios');
      }

      const endpoint = type === 'name' ? '/instance/updateName' : '/instance/updateProfilePicture';
      const payload = type === 'name' ? { name: value } : { image: value };
      const url = `${baseUrl}${endpoint}`;
      console.log(`📱 Updating profile ${type} via UAZAPI: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': instanceToken,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      console.log(`✅ UAZAPI response ${response.status}`, data);
      if (!response.ok) {
        const errorMsg = data.message || data.error || `UAZAPI error: ${response.status}`;
        throw new Error(errorMsg);
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Z-API (default)
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    const finalInstanceId = instanceId || credentials.instanceId;
    const finalToken = token || credentials.token;
    const finalClientToken = clientToken || credentials.clientToken;

    const endpoint = type === 'name' ? 'profile-name' : 'profile-picture';
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
    console.log(`✅ Z-API response ${response.status}`, data);
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
