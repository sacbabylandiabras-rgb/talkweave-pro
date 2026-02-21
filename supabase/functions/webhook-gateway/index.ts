import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const integrationId = url.searchParams.get('id')

    if (!integrationId) {
      return new Response(JSON.stringify({ error: 'Missing integration id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find integration
    const { data: integration, error: fetchError } = await supabase
      .from('gateway_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (fetchError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!integration.active) {
      return new Response(JSON.stringify({ error: 'Integration is inactive' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Read incoming payload
    let body: any = null
    if (req.method !== 'GET') {
      try {
        body = await req.json()
      } catch {
        try {
          body = await req.text()
        } catch {
          body = null
        }
      }
    }

    // Forward to the configured webhook_url
    const fwdHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(integration.headers || {}),
    }

    if (integration.auth_type === 'bearer' && integration.auth_token) {
      fwdHeaders['Authorization'] = `Bearer ${integration.auth_token}`
    } else if (integration.auth_type === 'api_key' && integration.auth_token) {
      fwdHeaders['X-API-Key'] = integration.auth_token
    }

    const fetchOpts: RequestInit = {
      method: integration.method || 'POST',
      headers: fwdHeaders,
    }

    if (integration.method !== 'GET' && body) {
      fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const response = await fetch(integration.webhook_url, fetchOpts)
    const responseText = await response.text()

    // Update last test info
    await supabase
      .from('gateway_integrations')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: response.ok ? 'success' : 'error',
      })
      .eq('id', integrationId)

    return new Response(responseText, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': response.headers.get('Content-Type') || 'text/plain' },
    })
  } catch (error) {
    console.error('Gateway error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
