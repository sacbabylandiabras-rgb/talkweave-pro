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
    const userId = url.searchParams.get('user_id')
    const integrationId = url.searchParams.get('id')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Read body
    let body: any = null
    if (req.method !== 'GET') {
      try { body = await req.json() } catch { body = null }
    }

    // If user_id provided, forward to ALL active integrations for that user
    if (userId) {
      const { data: gateways, error } = await supabase
        .from('gateway_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)

      if (error || !gateways || gateways.length === 0) {
        return new Response(JSON.stringify({ ok: true, forwarded: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const results = await Promise.allSettled(gateways.map(async (gw) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(gw.headers as Record<string, string> || {}),
        }
        if (gw.auth_type === 'bearer' && gw.auth_token) headers['Authorization'] = `Bearer ${gw.auth_token}`
        if (gw.auth_type === 'api_key' && gw.auth_token) headers['X-API-Key'] = gw.auth_token

        const opts: RequestInit = { method: gw.method || 'POST', headers }
        if (gw.method !== 'GET' && body) opts.body = JSON.stringify(body)

        const res = await fetch(gw.webhook_url, opts)
        return { name: gw.name, status: res.status }
      }))

      return new Response(JSON.stringify({ ok: true, forwarded: results.length, results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If single integration id provided
    if (integrationId) {
      const { data: gw, error } = await supabase
        .from('gateway_integrations')
        .select('*')
        .eq('id', integrationId)
        .single()

      if (error || !gw) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(gw.headers as Record<string, string> || {}),
      }
      if (gw.auth_type === 'bearer' && gw.auth_token) headers['Authorization'] = `Bearer ${gw.auth_token}`
      if (gw.auth_type === 'api_key' && gw.auth_token) headers['X-API-Key'] = gw.auth_token

      const opts: RequestInit = { method: gw.method || 'POST', headers }
      if (gw.method !== 'GET' && body) opts.body = JSON.stringify(body)

      const res = await fetch(gw.webhook_url, opts)
      const text = await res.text()
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }

    return new Response(JSON.stringify({ error: 'Missing user_id or id param' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Gateway error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
