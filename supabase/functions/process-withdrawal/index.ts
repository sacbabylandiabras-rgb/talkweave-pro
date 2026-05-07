import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: userData, error: userError } = await anonClient.auth.getUser()
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerId = userData.user.id
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', callerId).eq('role', 'admin').single()
    const isAdmin = !!roleData

    const { withdrawalId, action, adminNotes } = await req.json()

    if (!withdrawalId || !action || !['approved', 'rejected', 'auto'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: withdrawal, error: wErr } = await supabase.from('gateway_withdrawals').select('*').eq('id', withdrawalId).single()
    if (wErr || !withdrawal) return new Response(JSON.stringify({ error: 'Withdrawal not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (action === 'auto') {
      if (withdrawal.user_id !== callerId) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } else if (!isAdmin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') return new Response(JSON.stringify({ error: 'Already processed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (action === 'rejected' && isAdmin) {
      await supabase.from('gateway_withdrawals').update({ status: 'rejected', admin_notes: adminNotes?.trim() || 'Rejeitado pelo administrador', reviewed_by: callerId, reviewed_at: new Date().toISOString() }).eq('id', withdrawalId)
      return new Response(JSON.stringify({ success: true, status: 'rejected' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let activeAcquirer = 'openpix'
    try {
      const { data: profileData } = await supabase.from('profiles').select('pix_acquirer').eq('id', withdrawal.user_id).single()
      if (profileData?.pix_acquirer) activeAcquirer = profileData.pix_acquirer
      else {
        const { data: globalCfg } = await supabase.from('gateway_platform_config').select('value').eq('key', 'active_acquirer').single()
        if (globalCfg?.value) activeAcquirer = globalCfg.value
      }
    } catch {}

    await supabase.from('gateway_withdrawals').update({ status: 'processing' }).eq('id', withdrawalId)
    const WITHDRAWAL_FEE_CENTS = 1000
    const payoutAmount = withdrawal.amount - WITHDRAWAL_FEE_CENTS

    if (activeAcquirer === 'hubpague') {
      const hubpagueToken = Deno.env.get('HUBPAGUE_TOKEN')
      if (!hubpagueToken) throw new Error('HUBPAGUE_TOKEN not configured')
      const hubKeyTypeMap: Record<string, string> = { 'cpf': 'cpf', 'cnpj': 'cnpj', 'email': 'email', 'telefone': 'phone', 'phone': 'phone', 'random': 'randomkey' }
      const hubKeyType = hubKeyTypeMap[withdrawal.pix_key_type?.toLowerCase()] || 'cpf'
      const hubRes = await fetch('https://app.hubpague.io/api/transfers/out', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${hubpagueToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pix_key_type: hubKeyType, pix_key: withdrawal.pix_key, value: payoutAmount }),
      })
      const hubData = await hubRes.json()
      if (!hubRes.ok) throw new Error(`HubPague error: ${hubData?.message || hubRes.statusText}`)
      
      await supabase.from('gateway_withdrawals').update({ status: 'approved', admin_notes: `PIX via HubPague ID: ${hubData.transfer_id}`, reviewed_by: callerId, reviewed_at: new Date().toISOString() }).eq('id', withdrawalId)
      return await sendSuccessNotification(withdrawal, payoutAmount, new Response(JSON.stringify({ success: true, status: 'approved' }), { headers: corsHeaders }))
    } else {
      const openpixAppId = Deno.env.get('OPENPIX_APP_ID')
      if (!openpixAppId) throw new Error('OPENPIX_APP_ID not configured')
      const correlationID = `wdr_${withdrawal.id}_${Date.now()}`
      const paymentRes = await fetch('https://api.openpix.com.br/api/v1/payment', {
        method: 'POST',
        headers: { 'Authorization': openpixAppId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: payoutAmount, destinationAlias: withdrawal.pix_key, destinationAliasType: withdrawal.pix_key_type?.toUpperCase(), correlationID }),
      })
      if (!paymentRes.ok) throw new Error('OpenPix payment error')
      await supabase.from('gateway_withdrawals').update({ status: 'approved', admin_notes: `PIX via OpenPix. Correlation: ${correlationID}`, reviewed_by: callerId, reviewed_at: new Date().toISOString() }).eq('id', withdrawalId)
      return await sendSuccessNotification(withdrawal, payoutAmount, new Response(JSON.stringify({ success: true, status: 'approved' }), { headers: corsHeaders }))
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

async function sendSuccessNotification(withdrawal: any, payoutAmount: number, response: Response) {
  try {
    const amountFormatted = (payoutAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ user_id: withdrawal.user_id, title: '💸 Saque processado!', body: `Seu saque de ${amountFormatted} foi enviado via PIX.`, event_type: 'withdrawal_paid' }),
    })
  } catch {}
  return response
}
