import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { instanceId } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, supabaseKey)

    const { data: inst } = await admin
      .from('zapi_instances')
      .select('*')
      .eq('id', instanceId)
      .maybeSingle()

    if (!inst) throw new Error('Instance not found')

    const provider = (inst.api_provider || 'zapi').toLowerCase()
    if (provider === 'uazapi' || provider === 'uazapi_warmup') {
      const apiUrl = (inst.evolution_api_url || '').replace(/\/+$/, '')
      const apiToken = inst.evolution_api_key || inst.zapi_token || ''
      
      const res = await fetch(`${apiUrl}/instance/connect`, {
        method: 'GET',
        headers: { 'token': apiToken }
      })
      const data = await res.json()
      
      // Evolution /instance/connect might return different formats
      const qrValue = data?.base64 || data?.qrcode || data?.code;
      
      return new Response(JSON.stringify({ 
        success: true, 
        data: { 
          value: qrValue,
          connected: data?.instance?.status === 'open' || data?.status === 'open'
        } 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      const baseUrl = `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}`
      const headers = { 'Client-Token': inst.zapi_client_token || '' }
      const res = await fetch(`${baseUrl}/qr-code`, { headers })
      const data = await res.json()
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
