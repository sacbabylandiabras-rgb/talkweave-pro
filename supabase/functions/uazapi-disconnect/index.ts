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
    const endpoints = [`${baseUrl}/instance/disconnect`, `${baseUrl}/instance/logout`]

    let response: Response | null = null
    let data: any = {}
    let lastStatus = 500

    for (const url of endpoints) {
      console.log(`Disconnecting instance: POST ${url}`)

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': apiToken,
        },
      })

      const rawText = await response.text()
      try { data = JSON.parse(rawText) } catch { data = { message: rawText } }
      lastStatus = response.status

      if (response.ok) {
        console.log('✅ Instance disconnected successfully')
        return new Response(JSON.stringify({ success: true, ...data }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (response.status !== 404 && response.status !== 405) {
        break
      }
    }

    if (!response?.ok) {
      console.error('uazapi disconnect error:', lastStatus, JSON.stringify(data))
      return new Response(JSON.stringify({ error: data?.error || data?.message || `Error ${response.status}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('Disconnect error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
