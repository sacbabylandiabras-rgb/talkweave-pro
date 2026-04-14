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
    const { apiUrl, apiToken, phone } = await req.json()

    if (!apiUrl || !apiToken) {
      return new Response(JSON.stringify({ error: 'Missing apiUrl or apiToken' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = apiUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/instance/connect`

    console.log(`Connecting instance: POST ${url}${phone ? ' (pairing mode)' : ' (QR mode)'}`)

    const body: Record<string, string> = {}
    if (phone) body.phone = phone

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('uazapi connect error:', response.status, JSON.stringify(data))
      return new Response(JSON.stringify({ error: data?.error || data?.message || `Error ${response.status}`, ...data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`✅ Connect response keys: ${Object.keys(data).join(',')}`)

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
