 import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
 import { corsHeaders } from "../_shared/cors.ts"
 import { getUserZAPICredentials } from "../_shared/user-credentials.ts"
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders })
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
     const adminClient = createClient(supabaseUrl, supabaseServiceKey)
     const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey)
 
     const { instanceId } = await req.json().catch(() => ({}))
     
     // Get instance credentials
     const { data: instance } = await adminClient
       .from('zapi_instances')
       .select('*')
       .eq('user_id', credentials.userId)
       .or(`id.eq.${instanceId || credentials.instanceId},zapi_instance_id.eq.${instanceId || credentials.instanceId}`)
       .maybeSingle()
 
     if (!instance) {
       throw new Error('Instance not found')
     }
 
     const provider = (instance.api_provider || 'zapi').toLowerCase()
     if (provider !== 'zapi') {
       return new Response(JSON.stringify({ success: false, message: 'Only Z-API is supported for full metadata sync' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
     }
 
     const baseUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`
     const headers = {
       'Content-Type': 'application/json',
       'Client-Token': instance.zapi_client_token || ''
     }
 
     // Fetch chats
     const chatsRes = await fetch(`${baseUrl}/chats`, { headers })
     if (!chatsRes.ok) {
       throw new Error(`Z-API returned ${chatsRes.status}`)
     }
     const chats = await chatsRes.json()
 
     if (!Array.isArray(chats)) {
       throw new Error('Invalid response from Z-API')
     }
 
      const upserts = chats.map(chat => {
        const phone = chat.id || chat.phone || chat.jid;
        if (!phone) return null;
        
        let photoUrl = chat.profilePictureUrl || chat.imgUrl || chat.image || chat.profileThumbnail || null;
        if (photoUrl === 'null' || photoUrl === 'undefined' || (typeof photoUrl === 'string' && !photoUrl.startsWith('http'))) {
          photoUrl = null;
        }

        return {
          phone,
          name: chat.name || chat.contactName || '',
          profile_picture_url: photoUrl,
          user_id: credentials.userId,
          updated_at: new Date().toISOString()
        };
      }).filter(Boolean);
 
     if (upserts.length > 0) {
       // Batch upsert to saved_contacts
       const { error: upsertError } = await adminClient
         .from('saved_contacts')
         .upsert(upserts, { onConflict: 'phone,user_id' })
       
       if (upsertError) throw upsertError
     }
 
     return new Response(JSON.stringify({ success: true, count: upserts.length }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     })
 
   } catch (error) {
     console.error('Error syncing metadata:', error)
     return new Response(JSON.stringify({ success: false, error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     })
   }
 })