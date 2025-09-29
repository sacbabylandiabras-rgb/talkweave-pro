import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  console.log('Restart instance function called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID')
    const token = Deno.env.get('ZAPI_TOKEN')
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')

    console.log('Credentials check:', {
      hasInstanceId: !!instanceId,
      hasToken: !!token,
      hasClientToken: !!clientToken
    });

    if (!instanceId || !token || !clientToken) {
      console.error('Missing credentials');
      return new Response(
        JSON.stringify({ error: 'Z-API credentials not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/restart`
    console.log('Calling Z-API restart...');

    const zapiResponse = await fetch(zapiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      }
    })

    const zapiData = await zapiResponse.json()
    console.log('Z-API response:', { status: zapiResponse.status, data: zapiData });

    if (!zapiResponse.ok) {
      console.error('Z-API returned error:', zapiData);
      return new Response(
        JSON.stringify({ error: 'Failed to restart instance', details: zapiData }),
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
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
