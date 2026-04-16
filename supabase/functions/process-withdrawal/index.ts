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
    // Validate auth
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

    // Check if admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .single()

    const isAdmin = !!roleData

    const { withdrawalId, action, adminNotes } = await req.json()

    // Allow 'auto' action for self-service instant withdrawal
    if (!withdrawalId || !action || !['approved', 'rejected', 'auto'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid request: withdrawalId and action (approved/rejected) required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get withdrawal
    const { data: withdrawal, error: wErr } = await supabase
      .from('gateway_withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()

    if (wErr || !withdrawal) {
      return new Response(JSON.stringify({ error: 'Withdrawal not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For 'auto' action: verify the caller owns this withdrawal
    if (action === 'auto') {
      if (withdrawal.user_id !== callerId) {
        return new Response(JSON.stringify({ error: 'Forbidden: you can only auto-process your own withdrawals' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (!isAdmin) {
      // Only admins can approve/reject
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
      return new Response(JSON.stringify({ error: 'Withdrawal already processed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If rejected, just update status
    if (action === 'rejected' && isAdmin) {
      if (!adminNotes?.trim()) {
        return new Response(JSON.stringify({ error: 'Rejection reason is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await supabase
        .from('gateway_withdrawals')
        .update({
          status: 'rejected',
          admin_notes: adminNotes.trim(),
          reviewed_by: callerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', withdrawalId)

      return new Response(JSON.stringify({ success: true, status: 'rejected' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // APPROVED: determine acquirer for payout
    // Priority: 1) user's profile.pix_acquirer, 2) global platform config, 3) openpix default
    let activeAcquirer = 'openpix'
    try {
      const { data: globalCfg } = await supabase
        .from('gateway_platform_config')
        .select('value')
        .eq('key', 'active_acquirer')
        .single()
      if (globalCfg?.value) activeAcquirer = globalCfg.value
    } catch {}

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('pix_acquirer')
        .eq('id', withdrawal.user_id)
        .single()
      const userAcq = (profileData?.pix_acquirer || '').toLowerCase().trim()
      if (userAcq && userAcq !== 'cartwave') {
        // CartWave does not support PIX cash-out, fall back to global config
        activeAcquirer = userAcq
      }
    } catch {}

    console.log(`Active acquirer for payout (user ${withdrawal.user_id}): ${activeAcquirer}`)

    // Mark as processing
    await supabase
      .from('gateway_withdrawals')
      .update({ status: 'processing' })
      .eq('id', withdrawalId)

    const WITHDRAWAL_FEE_CENTS = 1000 // R$ 10,00
    const payoutAmount = withdrawal.amount - WITHDRAWAL_FEE_CENTS

    if (activeAcquirer === 'hubpague') {
      // === HubPague Transfer ===
      const hubpagueToken = Deno.env.get('HUBPAGUE_TOKEN')
      if (!hubpagueToken) {
        await supabase.from('gateway_withdrawals').update({ status: 'pending', admin_notes: 'HUBPAGUE_TOKEN não configurado' }).eq('id', withdrawalId)
        return new Response(JSON.stringify({ error: 'HubPague não configurado. Não é possível processar saque automático.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Map pix_key_type to HubPague format: cpf, cnpj, email, phone, randomkey
      const hubKeyTypeMap: Record<string, string> = {
        'cpf': 'cpf',
        'cnpj': 'cnpj',
        'email': 'email',
        'telefone': 'phone',
        'phone': 'phone',
        'aleatoria': 'randomkey',
        'random': 'randomkey',
        'evp': 'randomkey',
      }
      const hubKeyType = hubKeyTypeMap[withdrawal.pix_key_type?.toLowerCase()] || 'cpf'

      // Format PIX key for HubPague (requires formatted CPF/CNPJ/phone)
      let formattedPixKey = withdrawal.pix_key?.trim() || ''
      const rawDigits = formattedPixKey.replace(/\D/g, '')
      if (hubKeyType === 'cpf' && rawDigits.length === 11 && !formattedPixKey.includes('.')) {
        formattedPixKey = rawDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      } else if (hubKeyType === 'cnpj' && rawDigits.length === 14 && !formattedPixKey.includes('.')) {
        formattedPixKey = rawDigits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      } else if (hubKeyType === 'phone' && !formattedPixKey.startsWith('+')) {
        formattedPixKey = '+' + rawDigits
      }

      console.log(`HubPague transfer: ${payoutAmount} cents to ${formattedPixKey} (${hubKeyType})`)

      const hubRes = await fetch('https://app.hubpague.io/api/transfers/out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hubpagueToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pix_key_type: hubKeyType,
          pix_key: formattedPixKey,
          value: payoutAmount,
        }),
      })

      const hubData = await hubRes.json()
      console.log('HubPague transfer response:', JSON.stringify(hubData))

      if (!hubRes.ok) {
        console.error('HubPague transfer error:', hubData)
        await supabase.from('gateway_withdrawals').update({
          status: 'pending',
          admin_notes: `Erro HubPague: ${hubData?.message || hubData?.error || JSON.stringify(hubData)}`,
        }).eq('id', withdrawalId)

        return new Response(JSON.stringify({
          error: 'Falha ao processar transferência PIX via HubPague',
          details: hubData?.message || hubData?.error || 'Unknown HubPague error',
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const transferId = hubData.transfer_id || `hub_${withdrawalId}`

      await supabase.from('gateway_withdrawals').update({
        status: 'approved',
        admin_notes: adminNotes?.trim() || `PIX enviado via HubPague. Transfer ID: ${transferId}`,
          reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
      }).eq('id', withdrawalId)

      return new Response(JSON.stringify({
        success: true,
        status: 'approved',
        correlationID: transferId,
        message: 'Transferência PIX processada com sucesso via HubPague',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } else {
      // === OpenPix (Woovi) Transfer ===
      const openpixAppId = Deno.env.get('OPENPIX_APP_ID')
      if (!openpixAppId) {
        await supabase.from('gateway_withdrawals').update({ status: 'pending' }).eq('id', withdrawalId)
        return new Response(JSON.stringify({ error: 'OpenPix não configurado. Não é possível processar saque automático.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const pixKeyTypeMap: Record<string, string> = {
        'cpf': 'CPF',
        'cnpj': 'CNPJ',
        'email': 'EMAIL',
        'telefone': 'PHONE',
        'phone': 'PHONE',
        'aleatoria': 'RANDOM',
        'random': 'RANDOM',
        'evp': 'RANDOM',
      }
      const keyType = pixKeyTypeMap[withdrawal.pix_key_type?.toLowerCase()] || 'CPF'
      const correlationID = `wdr_${withdrawal.id}_${Date.now()}`

      console.log(`OpenPix transfer: ${payoutAmount} cents to ${withdrawal.pix_key} (${keyType})`)

      const paymentRes = await fetch('https://api.openpix.com.br/api/v1/payment', {
        method: 'POST',
        headers: {
          'Authorization': openpixAppId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: payoutAmount,
          destinationAlias: withdrawal.pix_key,
          destinationAliasType: keyType,
          correlationID,
          comment: `Saque ZapLynxPay #${withdrawal.id.slice(0, 8)}`,
        }),
      })

      const paymentData = await paymentRes.json()
      console.log('OpenPix payment response:', JSON.stringify(paymentData))

      if (!paymentRes.ok) {
        console.error('OpenPix payment error:', paymentData)
        await supabase.from('gateway_withdrawals').update({
          status: 'pending',
          admin_notes: `Erro OpenPix: ${paymentData?.message || paymentData?.error || JSON.stringify(paymentData)}`,
        }).eq('id', withdrawalId)

        return new Response(JSON.stringify({
          error: 'Falha ao processar transferência PIX',
          details: paymentData?.message || paymentData?.error || 'Unknown OpenPix error',
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await supabase.from('gateway_withdrawals').update({
        status: 'approved',
        admin_notes: adminNotes?.trim() || `PIX enviado via OpenPix. Correlation: ${correlationID}`,
        reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
      }).eq('id', withdrawalId)

      return new Response(JSON.stringify({
        success: true,
        status: 'approved',
        correlationID,
        message: 'Transferência PIX processada com sucesso via OpenPix',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

  } catch (error) {
    console.error('Process withdrawal error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
