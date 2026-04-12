import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Discover the outbound IP by calling an external service
    const ipRes = await fetch('https://api.ipify.org?format=json')
    const ipData = await ipRes.json()

    return new Response(JSON.stringify({
      outbound_ip: ipData.ip,
      message: "Este é o IP de saída do Supabase Edge Function. Envie este IP para a CartWave liberar no firewall.",
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
