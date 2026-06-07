import { createClient } from "npm:@supabase/supabase-js@2.58.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface UserZAPICredentials {
  instanceId: string
  token: string
  clientToken: string
  userId: string
  instanceName: string
}

async function getUserZAPICredentials(
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<UserZAPICredentials> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) throw new Error('No authorization header')

  const adminClient = createClient(supabaseUrl, supabaseServiceKey)
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !user) throw new Error('Unauthorized: ' + (userError?.message || 'User not found'))

  console.log(`📋 Fetching Z-API credentials for user: ${user.id}`)

  const { data: zapiInstances } = await adminClient
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, is_default, is_active')
    .eq('user_id', user.id)
    .eq('api_provider', 'zapi')
    .eq('is_active', true)
    .order('is_active', { ascending: false })
    .order('is_default', { ascending: false })

  const zapi = zapiInstances?.[0]
  if (zapi) {
    console.log(`✅ Found Z-API credentials for user ${user.id}`)
    return {
      instanceId: zapi.zapi_instance_id || '',
      token: zapi.zapi_token || '',
      clientToken: zapi.zapi_client_token || '',
      userId: user.id,
      instanceName: zapi.instance_name || 'Z-API Instance',
    }
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('zapi_instance_id, zapi_token, zapi_client_token')
    .eq('id', user.id)
    .single()

  if (profile?.zapi_instance_id && profile?.zapi_token && profile?.zapi_client_token) {
    return {
      instanceId: profile.zapi_instance_id,
      token: profile.zapi_token,
      clientToken: profile.zapi_client_token,
      userId: user.id,
      instanceName: 'Instância Perfil',
    }
  }

  throw new Error('Z-API credentials not configured. Please configure in settings.')
}

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

 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders })
   }
 
   try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing Supabase env vars', { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceKey })
        return new Response(
          JSON.stringify({ success: false, error: 'Server configuration error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)
     const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey)
 
     const body = await req.json().catch(() => ({}))
     const { phone, instanceId } = body || {}
     if (!phone) {
       console.warn('📷 get-profile-picture called without phone, returning empty result')
       return new Response(
         JSON.stringify({ success: false, data: { link: null, raw: null } }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       )
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
      return new Response(
        JSON.stringify({ success: false, data: { link: null, raw: null } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
     }
 
      type InstanceCfg = { provider: string; base: string; headers: Record<string, string>; instanceName?: string; apiUrl?: string; apiToken?: string }
     const instancesToTry: InstanceCfg[] = []
 
      if (instanceId) {
        const sanitizedInstanceId = String(instanceId).replace(/[^a-zA-Z0-9_-]/g, '')
        const selectInstanceFields = 'id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, instance_name, is_active, evolution_api_url, evolution_api_key'
        let specificInstance: any = null
        if (sanitizedInstanceId) {
          const { data: byRowId } = await adminClient
            .from('zapi_instances')
            .select(selectInstanceFields)
            .eq('id', sanitizedInstanceId)
            .eq('user_id', credentials.userId)
            .eq('api_provider', 'zapi')
            .maybeSingle()

          specificInstance = byRowId
          if (!specificInstance) {
            const { data: byProviderId } = await adminClient
              .from('zapi_instances')
              .select(selectInstanceFields)
              .eq('zapi_instance_id', sanitizedInstanceId)
              .eq('user_id', credentials.userId)
              .eq('api_provider', 'zapi')
              .maybeSingle()
            specificInstance = byProviderId
          }
        }
 
        if (specificInstance) {
          const provider = (specificInstance.api_provider || 'zapi').toLowerCase()
          const isUazapi = provider === 'uazapi' || provider === 'uazapi_warmup';
          
          if (isUazapi) {
            instancesToTry.push({
              provider,
              base: '',
              headers: { 'Content-Type': 'application/json', 'token': specificInstance.evolution_api_key || specificInstance.zapi_token || '' },
              apiUrl: (specificInstance.evolution_api_url || '').replace(/\/+$/, ''),
              apiToken: specificInstance.evolution_api_key || specificInstance.zapi_token || '',
            })
          } else {
            instancesToTry.push({
              provider,
              base: `https://api.z-api.io/instances/${specificInstance.zapi_instance_id}/token/${specificInstance.zapi_token}`,
              headers: { 'Content-Type': 'application/json', 'Client-Token': specificInstance.zapi_client_token || '' },
            })
          }

       }
     } else {
        const { data: allInstances } = await adminClient
         .from('zapi_instances')
           .select('zapi_instance_id, zapi_token, zapi_client_token, api_provider, instance_name, is_default, is_active, evolution_api_url, evolution_api_key')
         .eq('user_id', credentials.userId)
          .eq('api_provider', 'zapi')
          .eq('is_active', true)
          .order('is_active', { ascending: false })
         .order('is_default', { ascending: false })
 
       for (const inst of allInstances || []) {
         const provider = (inst.api_provider || 'zapi').toLowerCase()
           const isUazapi = provider === 'uazapi' || provider === 'uazapi_warmup';
           if (isUazapi && (inst.evolution_api_url || inst.zapi_instance_id)) {
            instancesToTry.push({
              provider,
              base: '',
              headers: { 'Content-Type': 'application/json', 'token': inst.evolution_api_key || inst.zapi_token || '' },
              apiUrl: (inst.evolution_api_url || '').replace(/\/+$/, ''),
              apiToken: inst.evolution_api_key || inst.zapi_token || '',
            })
           } else if (inst.zapi_instance_id && inst.zapi_token) {
            instancesToTry.push({
              provider,
              base: `https://api.z-api.io/instances/${inst.zapi_instance_id}/token/${inst.zapi_token}`,
              headers: { 'Content-Type': 'application/json', 'Client-Token': inst.zapi_client_token || '' },
            })
          }

       }
     }
 
     if (instancesToTry.length === 0) {
       instancesToTry.push({
         provider: 'zapi',
         base: `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}`,
         headers: { 'Content-Type': 'application/json', 'Client-Token': credentials.clientToken },
       })
     }
 
     const CHUNK_SIZE = 3
     for (let i = 0; i < instancesToTry.length; i += CHUNK_SIZE) {
       const chunk = instancesToTry.slice(i, i + CHUNK_SIZE)
        const results = await Promise.all(chunk.map(async (cfg) => {
           const { provider, base, headers, apiUrl, apiToken } = cfg
          try {
              if (isGroup) {
               const groupId = provider.includes('zapi') ? `${numericId}-group` : numericId;
               
               if (provider.includes('uazapi')) {
                  const jid = groupId.includes('@') ? groupId : `${groupId}@g.us`;
                  // UAZAPI: profile picture for groups
                  const resPic = await fetch(`${apiUrl}/chat/fetch/profile/picture`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'token': apiToken }, 
                    body: JSON.stringify({ jid }),
                    signal: AbortSignal.timeout(4000) 
                  });
                  const dataPic = await resPic.json().catch(() => null);
                  const linkPic = extractUrl(dataPic);
                  if (resPic.ok && linkPic) return { success: true, data: { link: linkPic, raw: dataPic } };

                  // UAZAPI: group metadata for name
                  const resMeta = await fetch(`${apiUrl}/group/find/by/id`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'token': apiToken }, 
                    body: JSON.stringify({ jid }),
                    signal: AbortSignal.timeout(4000) 
                  });
                  const dataMeta = await resMeta.json().catch(() => null);
                  const nameMeta = extractGroupName(dataMeta);
                  if (resMeta.ok && nameMeta) return { success: true, data: { link: null, name: nameMeta, raw: dataMeta } };
               } else {
                // Z-API group phone format is `<id>-group` (per docs)
                console.log(`📷 [GROUP] Fetching photo/metadata for ${groupId} on ${provider}`)

                // 1) /profile-picture?phone=<id>-group → returns { link }
                const resPic = await fetch(`${base}/profile-picture?phone=${encodeURIComponent(groupId)}`, { method: 'GET', headers, signal: AbortSignal.timeout(4000) })
                const dataPic = await resPic.json().catch(() => null)
                console.log(`📷 [GROUP] profile-picture ${resPic.status}: ${JSON.stringify(dataPic).substring(0, 120)}`)
                const linkPic = extractUrl(dataPic)
                if (resPic.ok && linkPic) return { success: true, data: { link: linkPic, raw: dataPic } }

                // 2) /group-metadata/<id>-group → has subject, communityId, etc. (no image)
                const resMeta = await fetch(`${base}/group-metadata/${encodeURIComponent(groupId)}`, { method: 'GET', headers, signal: AbortSignal.timeout(4000) })
                const dataMeta = await resMeta.json().catch(() => null)
                console.log(`📷 [GROUP] group-metadata ${resMeta.status}: ${JSON.stringify(dataMeta).substring(0, 120)}`)
                const linkMeta = extractUrl(dataMeta)
                const nameMeta = extractGroupName(dataMeta)
                if (resMeta.ok && (linkMeta || nameMeta)) return { success: true, data: { link: linkMeta || linkPic, name: nameMeta, raw: dataMeta } }

                // 3) Fallback: /chats/<id>-group (sometimes returns imagePreview)
                const resChat = await fetch(`${base}/chats/${encodeURIComponent(groupId)}`, { method: 'GET', headers, signal: AbortSignal.timeout(4000) })
                const dataChat = await resChat.json().catch(() => null)
                const linkChat = extractUrl(dataChat)
                const nameChat = extractGroupName(dataChat)
                if (resChat.ok && (linkChat || nameChat)) return { success: true, data: { link: linkChat, name: nameChat, raw: dataChat } }
               }
            } else {
               if (provider.includes('uazapi')) {
                  const jid = numericId.includes('@') ? numericId : `${numericId}@s.whatsapp.net`;
                  const resPic = await fetch(`${apiUrl}/chat/fetch/profile/picture`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'token': apiToken }, 
                    body: JSON.stringify({ jid }),
                    signal: AbortSignal.timeout(4000) 
                  });
                  const dataPic = await resPic.json().catch(() => null);
                  const linkPic = extractUrl(dataPic);
                  if (resPic.ok && linkPic) return { success: true, data: { link: linkPic, raw: dataPic } };
               } else {
                // Per Z-API docs, phone must be DDI+DDD+number (no @c.us suffix)
                console.log(`📷 Checking profile-picture for ${numericId} on ${provider}`);
                const res = await fetch(`${base}/profile-picture?phone=${encodeURIComponent(numericId)}`, { method: 'GET', headers, signal: AbortSignal.timeout(4000) })
                const data = await res.json().catch(() => null)
                console.log(`📷 Result for ${numericId}: ${res.status}`, JSON.stringify(data).substring(0, 120));
                const link = extractUrl(data)
                if (res.ok && link) return { success: true, data: { link, raw: data } }
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
               }
            }

          } catch (e) {
            console.log(`📷 Error on instance ${provider}: ${e instanceof Error ? e.message : String(e)}`)
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
