import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { getUserZAPICredentials } from "../_shared/user-credentials.ts"

const extractUrl = (payload: any): string | null => {
  if (!payload) return null
  if (Array.isArray(payload)) {
    const first = payload[0]
    return first?.link || first?.imgUrl || first?.profilePictureUrl || null
  }
  return payload?.link || payload?.imgUrl || payload?.profilePictureUrl || payload?.data?.link || payload?.data?.imgUrl || payload?.data?.profilePictureUrl || null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey)

    const { phone } = await req.json()
    if (!phone) {
      return new Response(JSON.stringify({ error: 'Phone is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const normalizedPhone = String(phone).replace(/\D/g, '')
    if (!normalizedPhone) {
      return new Response(JSON.stringify({ error: 'Invalid phone' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const base = `https://api.z-api.io/instances/${credentials.instanceId}/token/${credentials.token}`
    const candidateUrls = [
      `${base}/profile-picture?phone=${encodeURIComponent(normalizedPhone)}`,
      `${base}/profile-picture/${encodeURIComponent(normalizedPhone)}`,
      `${base}/contacts/${encodeURIComponent(normalizedPhone)}`,
    ]

    let lastStatus = 404
    let lastData: any = null

    for (const zapiUrl of candidateUrls) {
      const zapiResponse = await fetch(zapiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': credentials.clientToken
        }
      })

      const zapiData = await zapiResponse.json().catch(() => null)
      const link = extractUrl(zapiData)
      lastStatus = zapiResponse.status
      lastData = zapiData

      if (zapiResponse.ok && link) {
        return new Response(
          JSON.stringify({ success: true, data: { link, raw: zapiData } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: false, data: { link: null, raw: lastData } }),
      { status: lastStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
