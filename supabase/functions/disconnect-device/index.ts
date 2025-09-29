import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID')
    const token = Deno.env.get('ZAPI_TOKEN')
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')

    if (!instanceId || !token || !clientToken) {
      return new Response(
        JSON.stringify({ error: 'Z-API credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/disconnect`

    const zapiResponse = await fetch(zapiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      }
    })

    const zapiData = await zapiResponse.json()

    if (!zapiResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to disconnect device', details: zapiData }),
        { 
          status: zapiResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: zapiData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
