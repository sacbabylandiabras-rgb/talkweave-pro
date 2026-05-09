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
    payload?.group?.image || payload?.group?.picture ||
    payload?.preview || payload?.pictureUrl
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

 // In-memory cache to prevent storming external APIs
 const cache = new Map<string, { data: any, timestamp: number }>()
 const CACHE_TTL = 30000 // 30 seconds
 
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
 
     const cacheKey = `${credentials.userId}:${phone}:${instanceId || 'any'}`
     const cached = cache.get(cacheKey)
     if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
       return new Response(JSON.stringify(cached.data), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
     }
 
     const rawPhone = String(phone).trim()
     const isGroup = rawPhone.includes('@g.us') || rawPhone.includes('-group')
     const groupIdRaw = isGroup
       ? rawPhone.replace(/@g\.us$/i, '').replace(/-group$/i, '')
       : rawPhone.replace(/\D/g, '')
     const numericId = isGroup ? groupIdRaw : rawPhone.replace(/\D/g, '')
 
     if (!numericId) {
       return new Response(JSON.stringify({ error: 'Invalid phone' }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       })
     }
 
     type InstanceCfg = { provider: string; base: string; headers: Record<string, string>; uazapiUrl: string }
     const instancesToTry: InstanceCfg[] = []
 
     if (instanceId) {
       const { data: specificInstance } = await adminClient
         .from('zapi_instances')
         .select('id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key')
         .or(`id.eq.${instanceId},zapi_instance_id.eq.${instanceId}`)
         .eq('user_id', credentials.userId)
         .eq('is_active', true)
         .maybeSingle()
 
       if (specificInstance) {
         const provider = (specificInstance.api_provider || 'zapi').toLowerCase()
         if (provider === 'uazapi') {
           instancesToTry.push({
             provider,
             base: '',
             uazapiUrl: (specificInstance.evolution_api_url || '').replace(/\/+$/, ''),
             headers: { 'Content-Type': 'application/json', token: specificInstance.evolution_api_key || '' },
           })
         } else {
           instancesToTry.push({
             provider,
             base: `https://api.z-api.io/instances/${specificInstance.zapi_instance_id}/token/${specificInstance.zapi_token}`,
             uazapiUrl: '',
             headers: { 'Content-Type': 'application/json', 'Client-Token': specificInstance.zapi_client_token || '' },
           })
         }
       }
     } else {
       const { data: allInstances } = await adminClient
         .from('zapi_instances')
         .select('zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key, is_default')
         .eq('user_id', credentials.userId)
         .eq('is_active', true)
         .order('is_default', { ascending: false })
 
       for (const inst of allInstances || []) {
         const provider = (inst.api_provider || 'zapi').toLowerCase()
         if (provider === 'uazapi') {
           const url = (inst.evolution_api_url || '').replace(/\/+$/, '')
           if (url) {
             instancesToTry.push({
               provider,
               base: '',
               uazapiUrl: url,
               headers: { 'Content-Type': 'application/json', token: inst.evolution_api_key || '' },
             })
           }
         } else if (inst.zapi_instance_id && inst.zapi_token) {
           instancesToTry.push({
             provider,
             base: `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}`,
             uazapiUrl: '',
             headers: { 'Content-Type': 'application/json', 'Client-Token': inst.zapi_client_token || '' },
           })
         }
       }
     }
 
     if (instancesToTry.length === 0) {
       instancesToTry.push({
         provider: 'zapi',
         base: `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}`,
         uazapiUrl: '',
         headers: { 'Content-Type': 'application/json', 'Client-Token': credentials.clientToken },
       })
     }
 
     const CHUNK_SIZE = 3
     for (let i = 0; i < instancesToTry.length; i += CHUNK_SIZE) {
       const chunk = instancesToTry.slice(i, i + CHUNK_SIZE)
       const results = await Promise.all(chunk.map(async (cfg) => {
         const { provider, base, uazapiUrl, headers } = cfg
         try {
           if (provider === 'uazapi') {
             const detailsRes = await fetch(`${uazapiUrl}/chat/details`, {
               method: 'POST',
               headers,
               body: JSON.stringify({ number: isGroup ? `${numericId}@g.us` : numericId, preview: true }),
               signal: AbortSignal.timeout(4000)
             })
             const detailsData = await detailsRes.json().catch(() => null)
             const link = extractUrl(detailsData)
             const name = extractGroupName(detailsData)
             if (detailsRes.ok && (link || name)) return { success: true, data: { link, name, raw: detailsData } }
 
             if (!isGroup) {
               const contactsRes = await fetch(`${uazapiUrl}/contacts?contactScope=all`, { method: 'GET', headers, signal: AbortSignal.timeout(4000) })
               const contactsData = await contactsRes.json().catch(() => null)
               const match = (Array.isArray(contactsData) ? contactsData : []).find((c: any) => String(c?.jid || '').replace(/@.*/, '').replace(/\D/g, '') === numericId)
               const linkC = extractUrl(match)
               if (contactsRes.ok && linkC) return { success: true, data: { link: linkC, raw: match } }
             }
           } else {
             const formats = isGroup ? [`${numericId}@g.us`, `${numericId}-group`, numericId] : [numericId, `${numericId}@c.us`]
              for (const f of formats) {
                console.log(`📷 Checking profile-picture for ${f} on ${provider}`);
                const res = await fetch(`${base}/profile-picture?phone=${encodeURIComponent(f)}`, { method: 'GET', headers, signal: AbortSignal.timeout(4000) })
                const data = await res.json().catch(() => null)
                console.log(`📷 Result for ${f}: ${res.status}`, JSON.stringify(data).substring(0, 100));
                const link = extractUrl(data)
                if (res.ok && link) return { success: true, data: { link, raw: data } }
              }
               // Try get-contact profile picture endpoint
               if (!isGroup) {
                 const contactRes = await fetch(`${base}/contacts/${encodeURIComponent(numericId)}`, { method: 'GET', headers, signal: AbortSignal.timeout(4000) })
                 const contactData = await contactRes.json().catch(() => null)
                 const contactLink = extractUrl(contactData)
                 if (contactRes.ok && contactLink) return { success: true, data: { link: contactLink, raw: contactData } }
               }

               // Try chats-metadata which is often more reliable than profile-picture for some contacts
               const metaRes = await fetch(`${base}/chats-metadata/${encodeURIComponent(isGroup ? `${numericId}@g.us` : `${numericId}@c.us`)}`, { method: 'GET', headers, signal: AbortSignal.timeout(4000) })
               const metaData = await metaRes.json().catch(() => null)
               const metaLink = extractUrl(metaData)
               const metaName = extractGroupName(metaData)
               if (metaRes.ok && (metaLink || metaName)) return { success: true, data: { link: metaLink, name: metaName, raw: metaData } }

              if (isGroup) {
                const gr = await fetch(`${base}/groups?page=1&pageSize=100`, { method: 'GET', headers, signal: AbortSignal.timeout(4000) })
                const gd = await gr.json().catch(() => null)
                const match = (Array.isArray(gd) ? gd : []).find((g: any) => String(g.phone || g.id || '').includes(numericId))
                const linkG = extractUrl(match)
                const nameG = extractGroupName(match)
                if (linkG || nameG) return { success: true, data: { link: linkG, name: nameG, raw: match } }
              }
           }
         } catch (e) {
           console.log(`📷 Error on instance ${provider}: ${e.message}`)
         }
         return null
       }))
 
       const winner = results.find(r => r !== null)
       if (winner) {
         cache.set(cacheKey, { data: winner, timestamp: Date.now() })
         return new Response(JSON.stringify(winner), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
       }
     }

    return new Response(
      JSON.stringify({ success: false, data: { link: null, raw: null } }),
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
