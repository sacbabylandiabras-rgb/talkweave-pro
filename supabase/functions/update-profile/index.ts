import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

const DISCONNECTED_PROFILE_MESSAGE = 'Conexão WhatsApp desconectada. Reconecte o dispositivo antes de atualizar o perfil.';

const isDisconnectedError = (value: unknown) => {
  if (!value) return false;

  if (typeof value === 'string') {
    return /desconect|disconnect|not connected|session closed|qr code|unauthorized|invalid token|client-token|not allowed|forbidden|instância.*desconectada|reconecte o dispositivo/i.test(value);
  }

  if (value instanceof Error) {
    return isDisconnectedError(value.message);
  }

  if (typeof value === 'object') {
    const payload = value as Record<string, unknown>;
    // Primary check: if connected is explicitly false, it's disconnected.
    // We ignore 'session: false' if 'connected: true' is present.
    if (payload.connected === false) return true;
    if (payload.connected === undefined && payload.session === false) return true;

    // Check common error fields
    const fields = [
      payload.message,
      payload.error,
      payload.reason,
      payload.status,
      payload.detail,
      payload.description,
      (payload.error as any)?.message,
      (payload.error as any)?.error
    ];

    return fields.some(f => f && isDisconnectedError(f));
  }

  return false;
};

const buildDisconnectedResponse = () =>
  new Response(
    JSON.stringify({
      success: false,
      skipped: true,
      fallback: true,
      reason: 'disconnected',
      error: DISCONNECTED_PROFILE_MESSAGE,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );

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


    const providerNorm = String(provider || 'zapi').toLowerCase();

    // ─── UAZAPI ──────────────────────────────────────────────────────────────
    if (providerNorm === 'uazapi') {
      const baseUrl = (apiUrl || Deno.env.get('UAZAPI_SERVER_URL') || '').replace(/\/$/, '');
      const adminToken = apiKey || token || Deno.env.get('UAZAPI_ADMIN_TOKEN') || '';
      if (!baseUrl || !adminToken) {
        return buildDisconnectedResponse();
      }
      const endpoint = type === 'name' ? `${baseUrl}/profile/name` : `${baseUrl}/profile/image`;
      const payload = type === 'name'
        ? { name: String(value) }
        : { image: String(value) };
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: adminToken },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      console.log(`✅ UAZAPI ${type} response ${resp.status}`, data);
      if (isDisconnectedError(data)) return buildDisconnectedResponse();
      if (!resp.ok || data?.error) {
        throw new Error(data?.error || data?.message || `Erro do servidor: ${resp.status}`);
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Z-API (default) — only fetch user credentials when not provided explicitly
    let finalInstanceId = instanceId;
    let finalToken = token;
    let finalClientToken = clientToken;
    if (!finalInstanceId || !finalToken || !finalClientToken) {
      try {
        const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
        finalInstanceId = finalInstanceId || credentials.instanceId;
        finalToken = finalToken || credentials.token;
        finalClientToken = finalClientToken || credentials.clientToken;
      } catch (credErr) {
        console.warn('⚠️ Sem credenciais padrão configuradas:', credErr);
        return buildDisconnectedResponse();
      }
    }

    const baseZapi = `https://api.z-api.io/instances/${finalInstanceId}/token/${finalToken}`;
    const zapiHeaders = {
      'Content-Type': 'application/json',
      'Client-Token': finalClientToken,
    };

    // Pre-flight: verificar se a instância está conectada
    try {
      const statusResp = await fetch(`${baseZapi}/status`, { headers: zapiHeaders });
      const statusData = await statusResp.json().catch(() => ({}));
      console.log(`🔎 Status conexão (${statusResp.status}):`, statusData);
      
      // Se statusData.connected for explicitamente false, retornamos erro de desconexão.
      // Se for true ou se falhar ao obter, tentamos a operação assim mesmo (fail-soft).
      if (statusResp.ok && statusData.connected === false) {
        return buildDisconnectedResponse();
      }
    } catch (preErr) {
      console.warn('⚠️ Falha ao checar status (seguindo mesmo assim):', preErr);
    }

    if (type === 'name') {
      const url = `${baseZapi}/profile-name`;
      console.log(`📱 Updating profile name via Z-API: ${url}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: zapiHeaders,
        body: JSON.stringify({ value: String(value) }),
      });
      const data = await response.json().catch(() => ({}));
      console.log(`✅ Z-API name response ${response.status}`, data);
      if (isDisconnectedError(data)) {
        return buildDisconnectedResponse();
      }
      if (!response.ok || data?.error || data?.value === false) {
        throw new Error(data.message || data.error || (data?.value === false ? 'Z-API retornou value:false (operação não aplicada)' : `Z-API error: ${response.status}`));
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // type === 'picture' — tenta URL primeiro, se falhar baixa e envia em base64
    const url = `${baseZapi}/profile-picture`;
    const rawValue = String(value).trim();
    const isUrl = /^https?:\/\//i.test(rawValue);

    const attempts: string[] = [];
    if (isUrl) {
      attempts.push(rawValue);
      try {
        const b64 = await resolveImagePayload(rawValue);
        attempts.push(b64);
        attempts.push(`data:image/jpeg;base64,${b64}`);
      } catch (e) {
        console.warn('⚠️ Não foi possível baixar imagem para fallback base64:', e);
      }
    } else {
      const b64 = await resolveImagePayload(rawValue);
      attempts.push(b64);
      attempts.push(`data:image/jpeg;base64,${b64}`);
    }

    let lastError = 'Erro desconhecido ao atualizar foto via Z-API';
    let successData: unknown = null;
    for (const attempt of attempts) {
      console.log(`📱 Updating profile picture via Z-API (${attempt.length > 100 ? 'base64' : 'url'}): ${url}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: zapiHeaders,
        body: JSON.stringify({ value: attempt }),
      });
      const data = await response.json().catch(() => ({}));
      console.log(`✅ Z-API picture response ${response.status}`, data);
      if (isDisconnectedError(data)) {
        return buildDisconnectedResponse();
      }
      if (response.ok && !data?.error && data?.value !== false) {
        successData = data;
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      lastError = data?.message || data?.error || (data?.value === false ? 'Z-API retornou value:false (foto não aplicada — verifique se a sessão está conectada)' : `Z-API error: ${response.status}`);
    }

    throw new Error(lastError);
  } catch (error) {
    console.error('❌ Error updating profile (catch block):', error);
    
    // Any error here is treated as a connection/transient issue to avoid 400s in bulk operations
    // unless it's a very specific server error.
    const msg = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        skipped: true, 
        error: msg,
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
