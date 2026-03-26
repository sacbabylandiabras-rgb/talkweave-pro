import { corsHeaders } from "../_shared/cors.ts";
import { buildEvolutionUrlCandidates, parseEvolutionResponse } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instance_name, phone_number, evolution_api_url, evolution_api_key } = await req.json();

    // Use secrets as default, allow override from body
    const apiUrl = evolution_api_url || Deno.env.get('EVOLUTION_API_URL');
    const apiKey = evolution_api_key || Deno.env.get('EVOLUTION_API_KEY');

    if (!apiUrl || !apiKey) {
      return new Response(JSON.stringify({ error: 'URL e API Key da Evolution não configuradas' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!instance_name) {
      return new Response(JSON.stringify({ error: 'Nome da instância é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const urlCandidates = buildEvolutionUrlCandidates(apiUrl);

    const authHeaders = [
      { 'apikey': apiKey, 'Content-Type': 'application/json' },
      { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      { 'Client-Token': apiKey, 'Content-Type': 'application/json' },
    ];

    const body: any = {
      instanceName: instance_name,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    };

    // Custom API body format
    const customBody: any = {
      instance_name: instance_name,
    };

    if (phone_number) {
      body.number = phone_number.replace(/\D/g, '');
    }

    let lastError = 'Nenhuma tentativa bem sucedida';
    let lastStatus = 500;

    for (const baseUrl of urlCandidates) {
      for (const headers of authHeaders) {
        const url = `${baseUrl}/instance/create`;
        console.log(`🔧 Trying create instance at ${url}`);

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });

          const parsed = await parseEvolutionResponse(res);
          console.log(`🔧 Create response status=${res.status} body=${parsed.rawText.substring(0, 300)}`);

          if (res.ok) {
            const instanceData = parsed.data;
            const createdName = instanceData?.instance?.instanceName || instanceData?.instanceName || instance_name;
            const createdId = instanceData?.instance?.instanceId || instanceData?.instanceId || instanceData?.instance?.id || createdName;
            const qrCode = instanceData?.qrcode?.base64 || instanceData?.base64 || instanceData?.qr || null;

            return new Response(JSON.stringify({
              success: true,
              instanceName: createdName,
              instanceId: createdId,
              qrCode,
              apiUrl,
              apiKey,
              raw: instanceData,
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          if (res.status === 401 || res.status === 403) {
            lastError = 'Autenticação falhou - verifique a API Key';
            lastStatus = res.status;
            continue;
          }

          lastError = parsed.data?.message || parsed.data?.error || `HTTP ${res.status}`;
          lastStatus = res.status;
        } catch (err) {
          console.log(`🔧 Fetch error: ${err}`);
          lastError = String(err);
          continue;
        }
      }
    }

    return new Response(JSON.stringify({ error: lastError }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
