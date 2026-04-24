import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts"

const sanitizeUrl = (value: unknown): string | null => {
  const str = String(value || '').trim()
  if (!str) return null
  const lower = str.toLowerCase()
  if (['null', 'undefined', 'false'].includes(lower)) return null
  if (!/^https?:\/\//i.test(str) && !str.startsWith('data:')) return null
  return str
}

const extractUrl = (payload: any): string | null => {
  if (!payload) return null
  if (Array.isArray(payload)) {
    const first = payload[0]
    return extractUrl(first)
  }
  return sanitizeUrl(
    payload?.link || payload?.imgUrl || payload?.profilePictureUrl || payload?.profileThumbnail ||
    payload?.imagePreview || payload?.profilePicUrl || payload?.profilePicture || payload?.picture ||
    payload?.imageUrl || payload?.image || payload?.photo || payload?.groupPhoto ||
    payload?.data?.link || payload?.data?.imgUrl || payload?.data?.profilePictureUrl || payload?.data?.profileThumbnail ||
    payload?.data?.imagePreview || payload?.data?.profilePicUrl || payload?.data?.image ||
    payload?.chat?.imagePreview || payload?.chat?.image || payload?.chat?.imgUrl ||
    payload?.group?.image || payload?.group?.picture
  )
}

const isUsableGroupName = (value: unknown): value is string => {
  const normalized = String(value || '').trim()
  if (!normalized) return false
  if (/@g\.us$/i.test(normalized) || /-group$/i.test(normalized)) return false
  if (/^[+\d()\-\s]+$/.test(normalized) && /\d/.test(normalized)) return false
  if (/^(grupo|grupo sem nome|conversa com grupo)$/i.test(normalized)) return false
  if (/^conversa com\s+\+?\d[\d\s()-]*$/i.test(normalized)) return false
  return true
}

const extractGroupName = (payload: any): string | null => {
  if (!payload) return null
  const candidate = Array.isArray(payload) ? payload[0] : payload
  const names = [
    candidate?.name,
    candidate?.subject,
    candidate?.title,
    candidate?.groupName,
    candidate?.contact,
    candidate?.wa_name,
    candidate?.wa_chatName,
    candidate?.data?.name,
    candidate?.data?.subject,
    candidate?.group?.name,
    candidate?.group?.subject,
    candidate?.groupMetadata?.subject,
    candidate?.chat?.name,
    candidate?.chat?.subject,
  ]

  for (const name of names) {
    if (isUsableGroupName(name)) return String(name).trim()
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = (await import("npm:@supabase/supabase-js@2.58.0")).createClient(supabaseUrl, supabaseServiceKey)
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey)

    const { phone, instanceId } = await req.json()
    if (!phone) {
      return new Response(JSON.stringify({ error: 'Phone is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const rawPhone = String(phone).trim()
    const isGroup = rawPhone.includes('@g.us') || rawPhone.includes('-group')
    
    // Extract numeric part for groups
    const numericId = rawPhone.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '')
    
    if (!numericId) {
      return new Response(JSON.stringify({ error: 'Invalid phone' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let provider = 'zapi'
    let base = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}`
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Client-Token': credentials.clientToken
    }
    let uazapiUrl = ''

    if (instanceId) {
      const { data: specificInstance } = await adminClient
        .from('zapi_instances')
        .select('id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key')
        .or(`id.eq.${instanceId},zapi_instance_id.eq.${instanceId}`)
        .eq('user_id', credentials.userId)
        .eq('is_active', true)
        .maybeSingle()

      if (specificInstance) {
        provider = specificInstance.api_provider || 'zapi'
        if (provider === 'uazapi') {
          uazapiUrl = (specificInstance.evolution_api_url || '').replace(/\/+$/, '')
          headers = {
            'Content-Type': 'application/json',
            token: specificInstance.evolution_api_key || ''
          }
        } else {
          base = `https://api.z-api.io/instances/${specificInstance.zapi_instance_id}/token/${specificInstance.zapi_token}`
          headers = {
            'Content-Type': 'application/json',
            'Client-Token': specificInstance.zapi_client_token
          }
        }
      }
    }

    if (provider === 'uazapi') {
      try {
        const detailsRes = await fetch(`${uazapiUrl}/chat/details`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ number: isGroup ? `${numericId}@g.us` : numericId, preview: true })
        })
        const detailsData = await detailsRes.json().catch(() => null)
        const link = detailsData?.imagePreview || detailsData?.image || detailsData?.profilePicUrl || null
        const name = extractGroupName(detailsData)
        if (detailsRes.ok && (link || name)) {
          return new Response(
            JSON.stringify({ success: true, data: { link, name, raw: detailsData } }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } catch (e) {
        console.log(`📷 UAZAPI chat/details error: ${e}`)
      }

      if (!isGroup) {
        try {
          const contactsRes = await fetch(`${uazapiUrl}/contacts?contactScope=all`, { method: 'GET', headers })
          const contactsData = await contactsRes.json().catch(() => null)
          const contacts = Array.isArray(contactsData) ? contactsData : []
          const match = contacts.find((c: any) => String(c?.jid || '').replace(/@.*/, '').replace(/\D/g, '') === numericId)
          const link = match?.imagePreview || match?.image || match?.profilePicUrl || null
          if (contactsRes.ok && link) {
            return new Response(
              JSON.stringify({ success: true, data: { link, raw: match } }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } catch (e) {
          console.log(`📷 UAZAPI contacts error: ${e}`)
        }
      }

      return new Response(
        JSON.stringify({ success: false, data: { link: null, raw: null } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For groups, try multiple formats and also try group-metadata for photo
    if (isGroup) {
      const groupIdGroup = `${numericId}-group`
      const groupIdGus = `${numericId}@g.us`
      
      console.log(`📷 Group photo lookup: numericId=${numericId}`)

      // Strategy 1: Try profile-picture with @g.us format
      const candidatePhones = [groupIdGus, groupIdGroup, numericId]
      for (const phoneFormat of candidatePhones) {
        const url = `${base}/profile-picture?phone=${encodeURIComponent(phoneFormat)}`
        console.log(`📷 Trying: ${url}`)
        try {
          const res = await fetch(url, { method: 'GET', headers })
          const data = await res.json().catch(() => null)
          const link = extractUrl(data)
          console.log(`📷 Result status=${res.status} link=${link} data=${JSON.stringify(data)?.substring(0, 200)}`)
          if (res.ok && link) {
            return new Response(
              JSON.stringify({ success: true, data: { link, raw: data } }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } catch (e) {
          console.log(`📷 Fetch error: ${e}`)
        }
      }

      // Strategy 2: Fetch from /groups list to get imgUrl
      console.log(`📷 Trying /groups list for imgUrl`)
      try {
        const groupsRes = await fetch(`${base}/groups?page=1&pageSize=100`, { method: 'GET', headers })
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json()
          const groups = Array.isArray(groupsData) ? groupsData : []
          const match = groups.find((g: any) => {
            const gId = g.phone || g.id || ''
            return gId.includes(numericId)
          })
          console.log(`📷 Groups list match: id=${match?.phone} imgUrl=${match?.imgUrl} photo=${match?.photo}`)
          const photoUrl = match?.imgUrl || match?.profilePicture || match?.image || match?.photo || null
          const name = extractGroupName(match)
          if (photoUrl || name) {
            return new Response(
              JSON.stringify({ success: true, data: { link: photoUrl, name, raw: match } }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      } catch (e) {
        console.log(`📷 Groups list error: ${e}`)
      }

      // Strategy 3: group-metadata sometimes has imgUrl
      console.log(`📷 Trying /group-metadata/${groupIdGroup}`)
      try {
        const metaRes = await fetch(`${base}/group-metadata/${groupIdGroup}`, { method: 'GET', headers })
        if (metaRes.ok) {
          const metaData = await metaRes.json()
          console.log(`📷 group-metadata keys: ${Object.keys(metaData || {}).join(',')}`)
          const photoUrl = metaData?.imgUrl || metaData?.profilePicture || metaData?.image || metaData?.photo || metaData?.groupPhoto || null
          const name = extractGroupName(metaData)
          if (photoUrl || name) {
            return new Response(
              JSON.stringify({ success: true, data: { link: photoUrl, name, raw: metaData } }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      } catch (e) {
        console.log(`📷 Metadata error: ${e}`)
      }

      console.log(`📷 All strategies failed for group ${numericId}`)
      return new Response(
        JSON.stringify({ success: false, data: { link: null, raw: null } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For contacts (non-group)
    const url = `${base}/profile-picture?phone=${encodeURIComponent(numericId)}`
    const zapiResponse = await fetch(url, { method: 'GET', headers })
    const zapiData = await zapiResponse.json().catch(() => null)
    const link = extractUrl(zapiData)

    if (zapiResponse.ok && link) {
      return new Response(
        JSON.stringify({ success: true, data: { link, raw: zapiData } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, data: { link: null, raw: zapiData } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`📷 Error:`, error)
    return new Response(
      JSON.stringify({ success: false, data: { link: null, raw: null }, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
