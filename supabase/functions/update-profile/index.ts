import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

const cleanBase64 = (base64String: string): string => {
  if (!base64String) return "";
  let cleaned = base64String.trim();

  if (cleaned.includes(",") && cleaned.startsWith("data:")) {
    cleaned = cleaned.split(",")[1];
  }

  cleaned = cleaned.replace(/\s/g, "");

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error("Invalid base64 string after cleaning");
  }

  return cleaned;
};

const resolveImagePayload = async (value: string) => {
  if (value.startsWith("data:")) {
    return cleanBase64(value);
  }

  if (/^https?:\/\//i.test(value)) {
    const imageResponse = await fetch(value);
    if (!imageResponse.ok) {
      throw new Error(`Não foi possível baixar a imagem: ${imageResponse.status}`);
    }

    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return btoa(binary);
  }

  return cleanBase64(value);
};

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

      const imagePayload = type === 'picture' ? await resolveImagePayload(String(value)) : null;

      const attempts = type === 'name'
        ? [{ endpoint: '/profile/name', method: 'POST', payload: { name: value } }]
        : [
            { endpoint: '/profile/image', method: 'POST', payload: { image: imagePayload } },
            { endpoint: '/profile/image', method: 'POST', payload: { Image: imagePayload } },
            { endpoint: '/profile/image', method: 'POST', payload: { value: imagePayload } },
            { endpoint: '/profile/picture', method: 'PUT', payload: { image: imagePayload } },
            { endpoint: '/profile/picture', method: 'POST', payload: { image: imagePayload } },
            { endpoint: '/profile/picture', method: 'PUT', payload: { value: imagePayload } },
            { endpoint: '/profile/picture', method: 'POST', payload: { value: imagePayload } },
            { endpoint: '/profile-picture', method: 'PUT', payload: { value: imagePayload } },
            { endpoint: '/profile-picture', method: 'POST', payload: { value: imagePayload } },
            { endpoint: '/instance/updateProfilePicture', method: 'PUT', payload: { image: imagePayload } },
          ];

      let lastError = 'Unknown UAZAPI error';
      let successData: unknown = null;
      let success = false;

      for (const attempt of attempts) {
        const url = `${baseUrl}${attempt.endpoint}`;
        console.log(`📱 Updating profile ${type} via UAZAPI: ${attempt.method} ${url}`, attempt.payload);

        const response = await fetch(url, {
          method: attempt.method,
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify(attempt.payload),
        });

        const data = await response.json().catch(() => ({}));
        console.log(`✅ UAZAPI response ${response.status}`, data);

        if (response.ok) {
          successData = data;
          success = true;
          break;
        }

        lastError = data.message || data.error || `UAZAPI error: ${response.status}`;

        if (response.status !== 404 && response.status !== 405) {
          break;
        }
      }

      if (!success) {
        throw new Error(lastError);
      }

      return new Response(JSON.stringify({ success: true, data: successData }), {
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
