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

    console.log(`Fetching group list from uazapi: ${baseUrl}/group/list`)

    const response = await fetch(`${baseUrl}/group/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('uazapi error:', response.status, JSON.stringify(data))
      return new Response(JSON.stringify({ error: data?.message || `uazapi error ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`uazapi group list: ${Array.isArray(data) ? data.length : 'non-array'} groups`)

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
