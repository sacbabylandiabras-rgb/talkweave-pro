import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) throw new Error('Unauthorized')

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: authData, error: authError } = await userClient.auth.getUser(token)
    if (authError || !authData.user) throw new Error('Unauthorized')

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: role } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!role) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const userId = String(body.userId || '')
    const patch = body.patch || {}
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid user')

    const allowed = ['is_active', 'subscription_status', 'subscription_expires_at', 'max_instances', 'plan_id', 'custom_plan_value', 'max_team_members']
    const update: Record<string, unknown> = {}
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) update[key] = patch[key]
    }
    if (Object.keys(update).length === 0) throw new Error('No valid fields')

    const { error } = await admin.from('profiles').update(update).eq('id', userId)
    if (error) throw error

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
