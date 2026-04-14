import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { apiUrl, apiToken } = await req.json()

    if (!apiUrl || !apiToken) {
      return new Response(JSON.stringify({ error: 'Missing apiUrl or apiToken' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = apiUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/instance/status`

    console.log(`Checking instance status: GET ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('uazapi status error:', response.status, JSON.stringify(data))
      return new Response(JSON.stringify({ error: data?.error || data?.message || `Error ${response.status}`, status: 'disconnected' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sample = JSON.stringify(data).substring(0, 1000)
    console.log(`✅ Status response: ${sample}`)

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: error.message, status: 'disconnected' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
