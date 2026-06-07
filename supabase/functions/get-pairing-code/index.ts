import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { instanceId, phoneNumber } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, supabaseKey)
    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('No authorization header')
    const { data: { user }, error: userError } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    if (userError || !user) throw new Error('Unauthorized')

    const { data: inst } = await admin
      .from('zapi_instances')
      .select('*')
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!inst) throw new Error('Instance not found')

    const provider = (inst.api_provider || 'zapi').toLowerCase()
    if (provider === 'uazapi' || provider === 'uazapi_warmup' || provider === 'evolution') {
      const apiUrl = (inst.evolution_api_url || '').replace(/\/+$/, '')
      const apiToken = inst.evolution_api_key || inst.zapi_token || ''
      if (!apiUrl || !apiToken) throw new Error('Credenciais da conexão atual não configuradas')
      
      const res = await fetch(`${apiUrl}/instance/connect/phone`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'token': apiToken,
          'apikey': apiToken,
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ number: phoneNumber })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || data?.error || 'Falha ao gerar código de conexão')
      return new Response(JSON.stringify({ success: true, data: { pairingCode: data?.code || data?.pairingCode } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      // Z-API implementation
      // Z-API uses different endpoint for pairing code
      return new Response(JSON.stringify({ error: 'Pairing code not implemented for Z-API' }), {
        status: 400,
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
