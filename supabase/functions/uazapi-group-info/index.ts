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
      return new Response(JSON.stringify({ error: 'Missing groupId, apiUrl or apiToken', participants: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = apiUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/group/info`

    console.log(`Fetching group info: POST ${url} for group: ${groupId}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,
      },
      body: JSON.stringify({ groupjid: groupId }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('uazapi error:', response.status, JSON.stringify(data))
      return new Response(JSON.stringify({ error: data?.error || data?.message || `uazapi error ${response.status}`, participants: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sample = JSON.stringify(data).substring(0, 1500)
    console.log(`✅ Success! Response keys: ${Object.keys(data).join(',')}`)
    console.log(`Response sample: ${sample}`)

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: error.message, participants: [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
