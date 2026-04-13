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
    const encodedToken = encodeURIComponent(apiToken)
    const encodedJid = encodeURIComponent(groupId)

    // Try multiple endpoint patterns and methods used by uazapi
    const endpoints = [
      // GET with JID as query param
      { url: `${baseUrl}/group/info?token=${encodedToken}&JID=${encodedJid}`, method: 'GET', body: null },
      { url: `${baseUrl}/group/info?token=${encodedToken}&jid=${encodedJid}`, method: 'GET', body: null },
      { url: `${baseUrl}/group/info?token=${encodedToken}&groupId=${encodedJid}`, method: 'GET', body: null },
      { url: `${baseUrl}/group/participants?token=${encodedToken}&JID=${encodedJid}`, method: 'GET', body: null },
      { url: `${baseUrl}/group/participants?token=${encodedToken}&jid=${encodedJid}`, method: 'GET', body: null },
      // v1 endpoints
      { url: `${baseUrl}/v1/groups/info?token=${encodedToken}&groupId=${encodedJid}`, method: 'GET', body: null },
      { url: `${baseUrl}/v1/groups/participants?token=${encodedToken}&groupId=${encodedJid}`, method: 'GET', body: null },
      // POST fallbacks
      { url: `${baseUrl}/group/info?token=${encodedToken}`, method: 'POST', body: JSON.stringify({ JID: groupId }) },
      { url: `${baseUrl}/group/info?token=${encodedToken}`, method: 'POST', body: JSON.stringify({ jid: groupId }) },
      { url: `${baseUrl}/group/info?token=${encodedToken}`, method: 'POST', body: JSON.stringify({ groupId }) },
    ]

    let lastError = ''
    let lastStatus = 0

    for (const ep of endpoints) {
      try {
        console.log(`Trying: ${ep.method} ${ep.url}`)
        const fetchOpts: RequestInit = {
          method: ep.method,
          headers: { 'Content-Type': 'application/json' },
        }
        if (ep.body) fetchOpts.body = ep.body

        const response = await fetch(ep.url, fetchOpts)
        const data = await response.json()

        if (response.ok) {
          console.log(`✅ Success from ${ep.url}: keys=${Object.keys(data).join(',')}`)
          
          // Log full response structure for debugging
          const sample = JSON.stringify(data).substring(0, 1000)
          console.log(`Response sample: ${sample}`)
          
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        lastStatus = response.status
        lastError = JSON.stringify(data)
        console.log(`❌ Failed ${ep.method} ${ep.url}: ${response.status} ${lastError}`)
      } catch (e) {
        lastError = e.message
        console.log(`❌ Error ${ep.url}: ${e.message}`)
      }
    }

    console.error(`All endpoints failed. Last: ${lastStatus} ${lastError}`)
    return new Response(JSON.stringify({ error: `API error (${lastStatus}): ${lastError}`, participants: [] }), {
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
