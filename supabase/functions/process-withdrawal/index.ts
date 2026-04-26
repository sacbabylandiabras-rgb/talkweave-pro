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
      if (userAcq) activeAcquirer = userAcq
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

    } else if (activeAcquirer === 'cartwave') {
      // === CartWave PIX Cash-out by PIX key (self-approve) ===
      // Docs: https://cartwave-prod.readme.io/reference/pix-cashout-auto-approve-using-pix-key
      const CARTWAVE_PROXY_BASE = 'http://187.77.249.247:3480'
      const CARTWAVE_AUTH_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/auth-token/`
      const CARTWAVE_CASHOUT_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/create-cashout-self-approve/`

      const clientId = Deno.env.get('CARTWAVE_CLIENT_ID')
      const clientSecret = Deno.env.get('CARTWAVE_CLIENT_SECRET')
      const hmacKey = Deno.env.get('CARTWAVE_HMAC_KEY')

      if (!clientId || !clientSecret || !hmacKey) {
        await supabase.from('gateway_withdrawals').update({
          status: 'pending',
          admin_notes: 'CartWave não configurado (CLIENT_ID/SECRET/HMAC_KEY ausentes)',
        }).eq('id', withdrawalId)
        return new Response(JSON.stringify({ error: 'CartWave não configurado.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // 1) Authenticate
      let authRes: Response
      let authData: any = {}
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 30000)
        authRes = await fetch(CARTWAVE_AUTH_URL, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'ZapLynxPay/1.0',
          },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
          signal: ctrl.signal,
        })
        clearTimeout(t)
        authData = await authRes.json().catch(() => ({}))
      } catch (e: any) {
        console.error('CartWave auth network error:', e?.message || e)
        await supabase.from('gateway_withdrawals').update({
          status: 'pending',
          admin_notes: `CartWave indisponível (timeout/conexão): ${e?.message || 'erro de rede'}. Aprovação manual necessária.`,
        }).eq('id', withdrawalId)
        return new Response(JSON.stringify({ error: 'CartWave indisponível no momento. Saque ficou pendente para aprovação manual.' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const accessToken = authData?.access || authData?.access_token || authData?.token
        || authData?.data?.access || authData?.data?.access_token || authData?.data?.token

      if (!authRes.ok || !accessToken) {
        console.error('CartWave auth failed:', authRes.status, JSON.stringify(authData))
        await supabase.from('gateway_withdrawals').update({
          status: 'pending',
          admin_notes: `Erro autenticação CartWave: ${authData?.message || authData?.detail || 'auth failed'}`,
        }).eq('id', withdrawalId)
        return new Response(JSON.stringify({ error: 'Falha na autenticação CartWave' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let sourceBranch = '0001'
      let sourceAccount = '7003299'
      try {
        const { data: branchCfg } = await supabase
          .from('gateway_platform_config')
          .select('value')
          .eq('key', 'cartwave_branch')
          .single()
        if (branchCfg?.value?.trim()) sourceBranch = branchCfg.value.trim()
      } catch {}

      try {
        const { data: accountCfg } = await supabase
          .from('gateway_platform_config')
          .select('value')
          .eq('key', 'cartwave_account')
          .single()
        if (accountCfg?.value?.trim()) sourceAccount = accountCfg.value.trim()
      } catch {}

      // CartWave amount is decimal BRL (ex: 10.50)
      const amountDecimal = Number((payoutAmount / 100).toFixed(2))

      // PIX key sent as-is (CartWave aceita CPF/CNPJ/email/telefone/aleatória)
      const pixKey = (withdrawal.pix_key || '').trim()

      const transferTag = `withdrawal_${withdrawal.id}`

      // Build body — order matters for HMAC reproducibility, mas usamos JSON compacto
      const bodyObj: Record<string, any> = {
        source_account_branch_identifier: sourceBranch,
        source_account_number: sourceAccount,
        amount: amountDecimal,
        key: pixKey,
        tag: transferTag,
      }
      // JSON compactado (sem espaços) — requisito do HMAC CartWave
      const compactBody = JSON.stringify(bodyObj)

      // HMAC SHA-512 hex sobre o body compactado
      const enc = new TextEncoder()
      const cryptoKey = await crypto.subtle.importKey(
        'raw', enc.encode(hmacKey), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
      )
      const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(compactBody))
      const hmacHex = Array.from(new Uint8Array(sigBuf))
        .map(b => b.toString(16).padStart(2, '0')).join('')

      console.log(`CartWave cashout-self-approve: R$${amountDecimal} to ${pixKey} from ${sourceBranch}/${sourceAccount}`)

      let cashOutRes: Response
      try {
        const ctrl2 = new AbortController()
        const t2 = setTimeout(() => ctrl2.abort(), 45000)
        cashOutRes = await fetch(CARTWAVE_CASHOUT_URL, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'hmac': hmacHex,
            'User-Agent': 'ZapLynxPay/1.0',
          },
          body: compactBody,
          signal: ctrl2.signal,
        })
        clearTimeout(t2)
      } catch (e: any) {
        console.error('CartWave cashout network error:', e?.message || e)
        await supabase.from('gateway_withdrawals').update({
          status: 'pending',
          admin_notes: `CartWave cashout indisponível (timeout/conexão): ${e?.message || 'erro de rede'}. Aprovação manual necessária.`,
        }).eq('id', withdrawalId)
        return new Response(JSON.stringify({ error: 'CartWave indisponível no momento. Saque ficou pendente para aprovação manual.' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const cashOutData = await cashOutRes.json().catch(() => ({}))
      console.log('CartWave cashout response:', cashOutRes.status, JSON.stringify(cashOutData))

      const worked = cashOutData?.worked === true || cashOutData?.status === 'SUCCESS' || cashOutData?.status === 'PROCESSING'

      if (!cashOutRes.ok || !worked) {
        console.error('CartWave cashout error:', cashOutData)
        const errMsg = cashOutData?.new_erro_descriptor || cashOutData?.erro_descriptor
          || cashOutData?.message || cashOutData?.detail || cashOutData?.error
          || JSON.stringify(cashOutData).slice(0, 300)
        await supabase.from('gateway_withdrawals').update({
          status: 'pending',
          admin_notes: `Erro CartWave: ${errMsg}`,
        }).eq('id', withdrawalId)

        return new Response(JSON.stringify({
          error: 'Falha ao processar transferência PIX via CartWave',
          details: errMsg,
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const cwTransferId = cashOutData?.transaction_id || cashOutData?.id || cashOutData?.code_transaction || cashOutData?.operationUuid

      await supabase.from('gateway_withdrawals').update({
        status: 'approved',
        admin_notes: adminNotes?.trim() || `PIX enviado via CartWave. ID: ${cwTransferId}`,
        reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
      }).eq('id', withdrawalId)

      return new Response(JSON.stringify({
        success: true,
        status: 'approved',
        correlationID: cwTransferId,
        message: 'Transferência PIX processada com sucesso via CartWave',
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
