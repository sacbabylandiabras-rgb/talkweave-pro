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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('No authorization header')
    
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    console.log(`📋 Starting profile photo sync for user: ${user.id}`)

    // Pega instância padrão do usuário
    const { data: instance } = await adminClient
      .from('zapi_instances')
      .select('zapi_instance_id, zapi_token, zapi_client_token')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single()

    if (!instance) {
      return new Response(JSON.stringify({ error: 'No active Z-API instance found' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Pega contatos sem foto ou com foto antiga do usuário atual (lote de 50)
    // Considera "antiga" se updated_at for null ou mais de 24h atrás
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: contacts, error: contactsError } = await adminClient
      .from('saved_contacts')
      .select('phone, name, profile_picture_url, updated_at')
      .eq('user_id', user.id)
      .or(`profile_picture_url.is.null,profile_picture_url.eq.null,updated_at.is.null,updated_at.lt.${yesterday}`)
      .order('updated_at', { ascending: true, nullsFirst: true })
      .limit(50)

    if (contactsError) throw contactsError
    if (!contacts?.length) {
      return new Response(JSON.stringify({ message: 'All photos up to date', updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let updated = 0
    const zapiBase = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`

    for (const contact of contacts) {
      try {
        const phone = contact.phone.endsWith('-group')
          ? `${contact.phone.replace(/-group$/, '')}@g.us`
          : contact.phone

        const isGroup = phone.includes('@g.us');
        const endpoint = isGroup
          ? `${zapiBase}/group-thumbnail/${phone}`
          : `${zapiBase}/profile-picture?phone=${phone}`;

        const res = await fetch(endpoint, {
          headers: { 'client-token': instance.zapi_client_token || '' },
          signal: AbortSignal.timeout(5000)
        })

        const data = res.ok ? await res.json().catch(() => null) : null
        const url = data?.link || data?.imgUrl || data?.profilePictureUrl || null

        if (url) {
          await adminClient
            .from('saved_contacts')
            .update({ 
              profile_picture_url: url, 
              updated_at: new Date().toISOString() 
            })
            .eq('phone', contact.phone)
            .eq('user_id', user.id)
          updated++
        } else {
          // Marca como tentado mesmo sem foto para não ficar retentando imediatamente
          await adminClient
            .from('saved_contacts')
            .update({ updated_at: new Date().toISOString() })
            .eq('phone', contact.phone)
            .eq('user_id', user.id)
        }

        // Pequeno delay para evitar rate limit da Z-API
        await new Promise(r => setTimeout(r, 100))
      } catch (e) {
        console.error(`❌ Error syncing photo for ${contact.phone}:`, e.message)
      }
    }

    return new Response(JSON.stringify({ updated, total: contacts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error(`❌ Sync error:`, error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})