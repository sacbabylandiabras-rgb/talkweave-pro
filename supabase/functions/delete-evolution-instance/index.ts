import { corsHeaders } from "../_shared/cors.ts";
import { buildEvolutionUrlCandidates, parseEvolutionResponse } from "../_shared/evolution.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instance_name, evolution_api_url, evolution_api_key } = await req.json();

    const apiUrl = evolution_api_url || Deno.env.get('EVOLUTION_API_URL');
    const apiKey = evolution_api_key || Deno.env.get('EVOLUTION_API_KEY');

    if (!apiUrl || !apiKey || !instance_name) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios faltando' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const urlCandidates = buildEvolutionUrlCandidates(apiUrl);
    const authHeaders = [
      { 'apikey': apiKey, 'Content-Type': 'application/json' },
      { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    ];

    for (const baseUrl of urlCandidates) {
      for (const headers of authHeaders) {
        const url = `${baseUrl}/instance/delete/${encodeURIComponent(instance_name)}`;
        console.log(`🗑️ Trying DELETE ${url}`);
        try {
          const res = await fetch(url, { method: 'DELETE', headers });
          const parsed = await parseEvolutionResponse(res);
          console.log(`🗑️ DELETE status=${res.status} body=${parsed.rawText.substring(0, 200)}`);
          if (res.ok) {
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (res.status === 404) {
            return new Response(JSON.stringify({ success: true, message: 'Instância não encontrada no servidor' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (err) {
          console.log(`🗑️ Fetch error: ${err}`);
          continue;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Não foi possível deletar no servidor Evolution' }), {
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
