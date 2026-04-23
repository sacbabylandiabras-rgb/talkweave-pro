import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const { instanceName, systemName, action, instanceToken } = await req.json()

    const apiUrl = Deno.env.get('UAZAPI_SERVER_URL')
    const adminToken = Deno.env.get('UAZAPI_ADMIN_TOKEN')

    if (!apiUrl || !adminToken) {
      return new Response(
        JSON.stringify({ error: 'Servidor não configurado. Contate o suporte.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = String(apiUrl).replace(/\/+$/, '')

    // Delete action: remove instance from UAZAPI server
    if (action === 'delete') {
      if (!instanceToken) {
        return new Response(
          JSON.stringify({ error: 'instanceToken é obrigatório para deletar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      try {
        const delRes = await fetch(`${baseUrl}/instance/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', token: instanceToken, admintoken: adminToken },
        })
        const delText = await delRes.text()
        console.log(`🗑️ UAZAPI delete → ${delRes.status} ${delText}`)
      } catch (e) {
        console.warn('Erro ao deletar na UAZAPI:', e)
      }
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!instanceName) {
      return new Response(
        JSON.stringify({ error: 'O nome da instância é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const initUrl = `${baseUrl}/instance/init`

    console.log(`📡 UAZAPI init → ${initUrl} (name=${instanceName})`)

    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        admintoken: adminToken,
      },
      body: JSON.stringify({
        name: instanceName,
        systemName: systemName || 'zaplynx',
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
          error: data?.error || data?.message || `Erro ${initRes.status} ao criar instância`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // UAZAPI returns the instance object with token
    const inst = data?.instance ?? data
    const newInstanceToken: string =
      inst?.token || data?.token || inst?.instance?.token || ''
    const instanceId: string =
      inst?.id || inst?.instance_id || data?.id || instanceName

    if (!newInstanceToken) {
      return new Response(
        JSON.stringify({
          error: 'Não foi possível obter o token da instância criada',
          raw: data,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Persist into zapi_instances using service role (bypass RLS for safety)
    const adminClient = createClient(supabaseUrl, supabaseService)

    // Enforce active subscription + per-user instance limit
    const { data: profile } = await adminClient
      .from('profiles')
      .select('max_instances, subscription_status, subscription_expires_at, is_active')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }) => !!data)

    if (!isAdmin) {
      const status = (profile as any)?.subscription_status
      const expiresAt = (profile as any)?.subscription_expires_at
      const isActiveFlag = (profile as any)?.is_active !== false
      const notExpired = !expiresAt || new Date(expiresAt).getTime() > Date.now()
      const hasActiveSub = isActiveFlag && status === 'active' && notExpired

      if (!hasActiveSub) {
        return new Response(
          JSON.stringify({
            error: 'Sua assinatura não está ativa. Regularize o pagamento para criar uma instância.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const maxInstances = Number((profile as any)?.max_instances ?? 1)

    const { count: currentCount } = await adminClient
      .from('zapi_instances')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((currentCount ?? 0) >= maxInstances) {
      return new Response(
        JSON.stringify({
          error: `Limite atingido. Seu plano permite apenas ${maxInstances} instância(s). Contate o suporte para aumentar.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check duplicates
    const { data: existing } = await adminClient
      .from('zapi_instances')
      .select('id')
      .eq('user_id', user.id)
      .eq('zapi_instance_id', instanceId)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Esta instância já está cadastrada na sua conta.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isFirst = !currentCount || currentCount === 0

    const { data: inserted, error: insertErr } = await adminClient
      .from('zapi_instances')
      .insert({
        user_id: user.id,
        instance_name: instanceName,
        zapi_instance_id: instanceId,
        zapi_token: newInstanceToken,
        zapi_client_token: newInstanceToken,
        api_provider: 'uazapi',
        evolution_api_url: baseUrl,
        evolution_api_key: newInstanceToken,
        is_default: isFirst,
        is_active: true,
      })
      .select()
      .single()

    if (insertErr) {
      console.error('Erro ao salvar instância:', insertErr)
      return new Response(
        JSON.stringify({ error: 'Instância criada na UAZAPI, mas falhou ao salvar: ' + insertErr.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, instance: inserted, raw: data }),
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