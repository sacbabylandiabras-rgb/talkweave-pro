import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing supabase config' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: userData } = await adminClient.auth.getUser(token)
    const userId = userData?.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { instanceId } = await req.json().catch(() => ({}))

    // Find user's UAZAPI instances (filtered if instanceId provided)
    let query = adminClient
      .from('zapi_instances')
      .select('id, zapi_instance_id, evolution_api_url, evolution_api_key, api_provider')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('api_provider', 'uazapi')

    if (instanceId) query = query.eq('id', instanceId)

    const { data: instances, error: qErr } = await query
    if (qErr) throw qErr
    if (!instances || instances.length === 0) {
      return new Response(JSON.stringify({ error: 'No UAZAPI instances found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
    const results: any[] = []

    for (const inst of instances) {
      const apiUrl = String(inst.evolution_api_url || '').replace(/\/+$/, '')
      const apiToken = String(inst.evolution_api_key || '')
      if (!apiUrl || !apiToken) {
        results.push({ instanceId: inst.id, ok: false, error: 'Missing apiUrl or apiToken' })
        continue
      }

      const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/webhook-zapi?provider=uazapi&instanceId=${encodeURIComponent(inst.zapi_instance_id || inst.id)}`
      const body = {
        url: webhookUrl,
        enabled: true,
        events: ['messages', 'messages_update', 'connection', 'groups', 'presence'],
        excludeMessages: [],
        addUrlEvents: false,
      }

      try {
        const res = await fetch(`${apiUrl}/instance/updateWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify(body),
        })
        const text = await res.text()
        console.log(`🔗 Webhook set for ${inst.id}: ${res.status} ${text.substring(0, 200)}`)
        results.push({ instanceId: inst.id, ok: res.ok, status: res.status, response: text.substring(0, 500), webhookUrl })
      } catch (err) {
        console.error(`❌ Webhook set failed for ${inst.id}:`, err)
        results.push({ instanceId: inst.id, ok: false, error: String(err?.message || err) })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('uazapi-set-webhook error:', err)
    return new Response(JSON.stringify({ error: String((err as any)?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})