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

    // Try multiple endpoint patterns used by uazapi
    const endpoints = [
      { url: `${baseUrl}/v1/groups/info?token=${encodeURIComponent(apiToken)}`, method: 'POST', body: JSON.stringify({ groupId }) },
      { url: `${baseUrl}/group/info?token=${encodeURIComponent(apiToken)}`, method: 'POST', body: JSON.stringify({ jid: groupId }) },
      { url: `${baseUrl}/group/info?token=${encodeURIComponent(apiToken)}`, method: 'POST', body: JSON.stringify({ JID: groupId }) },
      { url: `${baseUrl}/group/info?token=${encodeURIComponent(apiToken)}`, method: 'POST', body: JSON.stringify({ groupId }) },
      { url: `${baseUrl}/group/participants?token=${encodeURIComponent(apiToken)}`, method: 'POST', body: JSON.stringify({ groupId }) },
      { url: `${baseUrl}/group/participants?token=${encodeURIComponent(apiToken)}`, method: 'POST', body: JSON.stringify({ JID: groupId }) },
    ]

    let lastError = ''

    for (const ep of endpoints) {
      try {
        console.log(`Trying: ${ep.method} ${ep.url} body=${ep.body}`)
        const response = await fetch(ep.url, {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
          body: ep.body,
        })

        const data = await response.json()

        if (response.ok) {
          console.log(`Success from ${ep.url}: keys=${Object.keys(data).join(',')}`)
          console.log(`Participants count: ${data?.participants?.length || data?.Participants?.length || 0}`)
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        lastError = JSON.stringify(data)
        console.log(`Failed ${ep.url}: ${response.status} ${lastError}`)
      } catch (e) {
        lastError = e.message
        console.log(`Error ${ep.url}: ${e.message}`)
      }
    }

    console.error('All endpoints failed. Last error:', lastError)
    return new Response(JSON.stringify({ error: `All endpoints failed: ${lastError}`, participants: [] }), {
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
