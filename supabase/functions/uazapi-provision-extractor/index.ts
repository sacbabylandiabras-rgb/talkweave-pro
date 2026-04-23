import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Auto-provisions an isolated UAZAPI instance for the current user, used
 * exclusively by the Community Extractor page (/extrair-comunidade).
 *
 * The credentials are persisted on `profiles.uazapi_url` / `profiles.uazapi_token`
 * and never exposed to the regular WhatsApp instance management flow.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiUrl = Deno.env.get('UAZAPI_SERVER_URL')
    const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN')

    if (!apiUrl || !adminToken) {
      return new Response(
        JSON.stringify({ error: 'Servidor não configurado. Contate o suporte.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = String(apiUrl).replace(/\/+$/, '')
    const adminClient = createClient(supabaseUrl, supabaseService)

    // If user already has credentials, validate them first; otherwise return existing.
    const { data: profile } = await adminClient
      .from('profiles')
      .select('uazapi_url, uazapi_token')
      .eq('id', user.id)
      .maybeSingle()

    const existingUrl = (profile as any)?.uazapi_url
    const existingToken = (profile as any)?.uazapi_token

    if (existingUrl && existingToken) {
      // Quick validation: try /instance/status
      try {
        const statusRes = await fetch(`${String(existingUrl).replace(/\/+$/, '')}/instance/status`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', token: existingToken },
        })
        if (statusRes.ok) {
          return new Response(
            JSON.stringify({ success: true, apiUrl: existingUrl, apiToken: existingToken, reused: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        console.log(`⚠️ Existing extractor token invalid (status ${statusRes.status}), reprovisioning...`)
      } catch (e) {
        console.warn('Erro ao validar token existente, reprovisionando:', e)
      }
    }

    // Provision a new instance via /instance/init
    const instanceName = `extractor_${user.id.substring(0, 8)}_${Date.now()}`
    const initUrl = `${baseUrl}/instance/init`

    console.log(`📡 Provisionando extrator UAZAPI → ${initUrl} (name=${instanceName})`)

    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        admintoken: adminToken,
      },
      body: JSON.stringify({
        name: instanceName,
        systemName: 'zaplynx-extractor',
      }),
    })

    const rawText = await initRes.text()
    let data: any = {}
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      data = { message: rawText }
    }

    if (!initRes.ok) {
      console.error('UAZAPI init error:', initRes.status, rawText)
      return new Response(
        JSON.stringify({
          error: data?.error || data?.message || `Erro ${initRes.status} ao provisionar extrator`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const inst = data?.instance ?? data
    const newToken: string = inst?.token || data?.token || inst?.instance?.token || ''

    if (!newToken) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível obter o token do extrator', raw: data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Persist on profiles
    const { error: updErr } = await adminClient
      .from('profiles')
      .update({
        uazapi_url: baseUrl,
        uazapi_token: newToken,
      } as any)
      .eq('id', user.id)

    if (updErr) {
      console.error('Erro ao salvar credenciais do extrator:', updErr)
      return new Response(
        JSON.stringify({ error: 'Extrator criado, mas falhou ao salvar: ' + updErr.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Extrator UAZAPI provisionado para usuário ${user.id}`)

    return new Response(
      JSON.stringify({ success: true, apiUrl: baseUrl, apiToken: newToken, reused: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})