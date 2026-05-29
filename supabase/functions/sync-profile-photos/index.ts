import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const extractUrl = (payload: unknown): string | null => {
  if (!payload) return null
  if (Array.isArray(payload)) return extractUrl(payload[0])
  if (typeof payload !== 'object') return null
  const p = payload as Record<string, any>
  const candidates = [
    p.link, p.imgUrl, p.profilePictureUrl, p.ProfilePicture, p.ProfilePicUrl,
    p.imageUrl, p.picture, p.profilePicUrl, p.image, p.photo,
    p.data?.link, p.data?.imgUrl, p.data?.profilePictureUrl, p.data?.ProfilePicture, p.data?.picture,
    p.chat?.imagePreview, p.chat?.image, p.group?.image, p.group?.picture,
  ]
  for (const value of candidates) {
    if (typeof value !== 'string') continue
    const url = value.trim()
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url
  }
  return null
}

const normalizeGroupPhone = (raw: string): string =>
  raw.endsWith('-group') ? `${raw.replace(/-group$/, '')}@g.us` : raw

const requireEnv = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const fetchWithRetry = async (
  input: string,
  init: RequestInit,
  attempts = 2,
): Promise<Response | null> => {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(input, { ...init, signal: AbortSignal.timeout(5000) })
      if (res.ok || (res.status >= 400 && res.status < 500)) return res
    } catch (e) {
      if (i === attempts - 1) console.error(`fetch failed (${input}):`, (e as Error).message)
    }
    await new Promise(r => setTimeout(r, 250))
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('No authorization header')
    
    const { page = 0 } = await req.json().catch(() => ({}));

    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')
    
    const limit = 100;
    console.log(`📋 Starting profile photo sync for user: ${user.id} (Page: ${page}, Limit: ${limit})`)

    // Pega instância padrão Z-API do usuário
    const { data: instance } = await adminClient
      .from('zapi_instances')
      .select('zapi_instance_id, zapi_token, zapi_client_token, api_provider, instance_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('api_provider', 'zapi')
      .order('is_default', { ascending: false })
      .limit(1)
      .single()

    if (!instance) {
      return new Response(JSON.stringify({ error: 'No active Z-API instance found' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Busca contatos sem foto de perfil (grupos e individuais) com paginação real via range
    const offset = page * limit
    const { data: contacts, error: contactsError } = await adminClient
      .from('saved_contacts')
      .select('phone, name, profile_picture_url, is_community')
      .eq('user_id', user.id)
      .is('profile_picture_url', null)
      .range(offset, offset + limit - 1)

    if (contactsError) throw contactsError
    if (contacts === null || contacts.length === 0) {
      return new Response(JSON.stringify({ message: 'All photos up to date', updated: 0, hasMore: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let updated = 0
    let updatedMeta = 0
    const zapiBase = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`

    const syncContact = async (contact: { phone: string }) => {
      try {
        const phone = normalizeGroupPhone(contact.phone)
        const isGroup = phone.includes('@g.us')
        let isCommunity = false
        let communityId: string | null = null

        if (isGroup) {
          const metaRes = await fetchWithRetry(`${zapiBase}/group-metadata/${phone}`, {
            headers: { 'client-token': instance.zapi_client_token || '' },
          })
          const meta = metaRes?.ok ? await metaRes.json().catch(() => null) : null
          if (meta) {
            isCommunity = meta.isGroupAnnouncement === true || !!meta.communityId
            communityId = meta.communityId || null
            updatedMeta++
          }
        }

        let url: string | null = null
        {
          const endpoint = isGroup
            ? `${zapiBase}/group-thumbnail/${phone}`
            : `${zapiBase}/profile-picture?phone=${phone}`
          const res = await fetchWithRetry(endpoint, {
            headers: { 'client-token': instance.zapi_client_token || '' },
          })
          url = res?.ok ? extractUrl(await res.json().catch(() => null)) : null
        }

        const updatePayload: Record<string, unknown> = {
          is_community: isCommunity,
          community_id: communityId,
          updated_at: new Date().toISOString(),
        }
        if (url) updatePayload.profile_picture_url = url

        await adminClient
          .from('saved_contacts')
          .update(updatePayload)
          .eq('phone', contact.phone)
          .eq('user_id', user.id)

        if (url) updated++
      } catch (e) {
        console.error(`Error syncing photo for ${contact.phone}:`, (e as Error).message)
      }
    }

    // Processa em lotes paralelos para reduzir tempo total
    for (const batch of chunk(contacts, 5)) {
      await Promise.all(batch.map(syncContact))
      await new Promise(r => setTimeout(r, 200))
    }

    const hasMore = contacts.length === limit;

    return new Response(JSON.stringify({ 
      updatedPhotos: updated, 
      updatedMeta, 
      total: contacts.length,
      page,
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