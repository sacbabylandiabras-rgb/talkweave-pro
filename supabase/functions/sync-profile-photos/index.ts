import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const isUazapiProvider = (provider: string) => provider === 'uazapi' || provider === 'uazapi_warmup'

const normalizeApiUrl = (value: unknown): string => {
  const raw = String(value || '').trim().replace(/\/+$/, '')
  if (!raw) return ''
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

const extractUrl = (payload: any): string | null => {
  if (!payload) return null
  if (Array.isArray(payload)) return extractUrl(payload[0])
  const value = payload?.link || payload?.imgUrl || payload?.profilePictureUrl || payload?.ProfilePicture ||
    payload?.ProfilePicUrl || payload?.imageUrl || payload?.picture || payload?.profilePicUrl || payload?.image ||
    payload?.photo || payload?.data?.link || payload?.data?.imgUrl || payload?.data?.profilePictureUrl ||
    payload?.data?.ProfilePicture || payload?.data?.picture || payload?.chat?.imagePreview || payload?.chat?.image ||
    payload?.group?.image || payload?.group?.picture
  const url = String(value || '').trim()
  return /^https?:\/\//i.test(url) || url.startsWith('data:') ? url : null
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
    
    const { page = 0 } = await req.json().catch(() => ({}));

    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')
    
    const limit = 100;
    console.log(`📋 Starting profile photo sync for user: ${user.id} (Page: ${page}, Limit: ${limit})`)

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

    // Busca APENAS grupos sem metadata (is_community null)
    // Prio 1: Começa com 120363, ou contém @g.us ou contém -group
    const { data: contacts, error: contactsError } = await adminClient
      .from('saved_contacts')
      .select('phone, name, profile_picture_url, is_community')
      .eq('user_id', user.id)
      .is('is_community', null)
      .or('phone.like.120363%,phone.like.%@g.us,phone.like.%-group')
      .limit(limit)

    if (contactsError) throw contactsError
    if (!contacts?.length) {
      return new Response(JSON.stringify({ message: 'All photos up to date', updated: 0, hasMore: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let updated = 0;
    let updatedMeta = 0;
    const zapiBase = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`

    for (const contact of contacts) {
      try {
        const phone = contact.phone.endsWith('-group')
          ? `${contact.phone.replace(/-group$/, '')}@g.us`
          : contact.phone

        const isGroup = phone.includes('@g.us');
        let isCommunity = false;
        let communityId = null;

        if (isGroup) {
          try {
            const metaRes = await fetch(`${zapiBase}/group-metadata/${phone}`, {
              headers: { 'client-token': instance.zapi_client_token || '' },
              signal: AbortSignal.timeout(5000)
            });
            const meta = metaRes.ok ? await metaRes.json().catch(() => null) : null;
            if (meta) {
              isCommunity = meta.isGroupAnnouncement === true || !!meta.communityId;
              communityId = meta.communityId || null;
              updatedMeta++;
              console.log(`👥 Metadata for ${phone}: isCommunity=${isCommunity}, communityId=${communityId}`);
            }
          } catch (metaErr) {
            console.error(`⚠️ Error fetching metadata for ${phone}:`, metaErr.message);
          }
        }

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
              is_community: isCommunity,
              community_id: communityId,
              updated_at: new Date().toISOString() 
            })
            .eq('phone', contact.phone)
            .eq('user_id', user.id)
          updated++
        } else {
          // Marca como tentado mesmo sem foto para não ficar retentando imediatamente
          await adminClient
            .from('saved_contacts')
            .update({ 
              is_community: isCommunity,
              community_id: communityId,
              updated_at: new Date().toISOString() 
            })
            .eq('phone', contact.phone)
            .eq('user_id', user.id)
        }

        // Pequeno delay para evitar rate limit da Z-API
        await new Promise(r => setTimeout(r, 100))
      } catch (e) {
        console.error(`❌ Error syncing photo for ${contact.phone}:`, e.message)
      }
    }

    const hasMore = contacts.length === limit;

    return new Response(JSON.stringify({ 
      updatedPhotos: updated, 
      updatedMeta, 
      total: contacts.length,
      hasMore
    }), {
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