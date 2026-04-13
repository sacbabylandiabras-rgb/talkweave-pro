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
    const { groupId, apiUrl, apiToken } = await req.json()

    if (!groupId || !apiUrl || !apiToken) {
      return new Response(JSON.stringify({ error: 'Missing groupId, apiUrl or apiToken' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Normalize base URL (remove trailing slash)
    const baseUrl = apiUrl.replace(/\/+$/, '')

    console.log(`Fetching group info from uazapi: ${baseUrl}/group/info for group: ${groupId}`)

    const response = await fetch(`${baseUrl}/group/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,
      },
      body: JSON.stringify({ groupId }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('uazapi error:', response.status, JSON.stringify(data))
      return new Response(JSON.stringify({ error: data?.message || `uazapi error ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`uazapi response: participants count = ${data?.participants?.length || 0}`)

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
