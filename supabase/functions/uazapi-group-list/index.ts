import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { apiUrl, apiToken } = await req.json()

    if (!apiUrl || !apiToken) {
      return new Response(JSON.stringify({ error: 'Missing apiUrl or apiToken' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = apiUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/group/list?token=${encodeURIComponent(apiToken)}`

    console.log(`Fetching group list from uazapi: ${baseUrl}/group/list`)

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('uazapi error:', response.status, JSON.stringify(data))
      return new Response(JSON.stringify({ error: data?.message || `uazapi error ${response.status}`, groups: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawGroups = Array.isArray(data) ? data : Array.isArray(data?.groups) ? data.groups : []
    const validGroups = rawGroups.filter((group: unknown) => {
      if (typeof group === 'string') return group.includes('@g.us')
      if (group && typeof group === 'object') {
        const g = group as Record<string, unknown>
        const candidate = g.JID ?? g.id ?? g.jid ?? g.groupId ?? g.remoteJid
        return typeof candidate === 'string' && candidate.includes('@g.us')
      }
      return false
    })

    console.log(`uazapi group list response sample: ${JSON.stringify(data).substring(0, 500)}`)
    console.log(`uazapi valid whatsapp groups: ${validGroups.length}`)

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
