import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let payload: any = {}
    try { payload = await req.json() } catch { payload = {} }

    console.log('OpenPix webhook received:', JSON.stringify(payload))

    const event = payload.event || ''
    const charge = payload.charge || payload.pix?.charge || {}
    const correlationID = charge.correlationID || charge.identifier || ''
    const chargeStatus = (charge.status || '').toLowerCase()

    console.log('Event:', event, 'CorrelationID:', correlationID, 'Status:', chargeStatus)

    if (!correlationID) {
      console.log('No correlationID found, just logging')
      return new Response(JSON.stringify({ ok: true, message: 'no correlationID' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Map OpenPix status to our status
    let newStatus = 'pending'
    if (event === 'OPENPIX:CHARGE_COMPLETED' || chargeStatus === 'completed' || chargeStatus === 'paid') {
      newStatus = 'approved'
    } else if (event === 'OPENPIX:CHARGE_EXPIRED' || chargeStatus === 'expired') {
      newStatus = 'expired'
    } else if (chargeStatus === 'active' || chargeStatus === 'pending') {
      newStatus = 'pending'
    }

    console.log('Mapped status:', newStatus)

    // ── DEDUPLICATION: check current status BEFORE updating ──
    const { data: existingTx } = await supabase
      .from('gateway_transactions')
      .select('id, user_id, checkout_id, status, customer_email, customer_name, customer_phone, amount, fee, net, product_id, external_id, metadata, created_at')
      .eq('external_id', correlationID)
      .single()

    if (!existingTx) {
      console.log('No transaction found for correlationID:', correlationID)
      return new Response(JSON.stringify({ ok: true, message: 'transaction not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tx = existingTx

    // ── ALWAYS dispatch user-configured outbound webhooks (even if status unchanged) ──
    const isDuplicate = tx.status === newStatus
    await dispatchOutboundWebhooks(supabase, tx, payload, charge, newStatus)

    if (isDuplicate) {
      console.log('Transaction already has status', newStatus, '- skipping internal side effects (WhatsApp/email/push)')
      return new Response(JSON.stringify({ ok: true, message: 'status unchanged, outbound webhooks dispatched', status: newStatus, transactionId: existingTx.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update transaction status
    const { error: txErr } = await supabase
      .from('gateway_transactions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', existingTx.id)

    if (txErr) {
      console.error('Error updating transaction:', txErr)
    } else {
      console.log('Transaction updated:', existingTx.id, 'from', existingTx.status, 'to', newStatus)
    }

    // Forward to webhook-gateway if payment approved (to trigger WhatsApp messages)
    if (newStatus === 'approved' && tx.user_id) {
      try {
        const gatewayUrl = `${supabaseUrl}/functions/v1/webhook-gateway?user_id=${tx.user_id}`
        const forwardPayload = {
          ...payload,
          status: 'approved',
          phone: charge.customer?.phone || payload.pix?.payer?.phone || null,
          customer: charge.customer || payload.pix?.payer || null,
          amount: charge.value,
        }
        await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(forwardPayload),
        })
        console.log('Forwarded to webhook-gateway for WhatsApp notifications')
      } catch (fwdErr) {
        console.error('Forward error:', fwdErr)
      }

      // CAPI Purchase event
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-meta-capi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            user_id: tx.user_id,
            event: 'Purchase',
            value: (charge.value || tx.amount || 0) / 100,
            currency: 'BRL',
            event_id: tx.id,
            customer: {
              email: charge.customer?.email || tx.customer_email,
              phone: charge.customer?.phone || tx.customer_phone,
              name: charge.customer?.name || tx.customer_name,
            },
          }),
        })
      } catch (capiErr) {
        console.error('CAPI error:', capiErr)
      }

      // Send push notification
      try {
        const amount = (charge.value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const pushUrl = `${supabaseUrl}/functions/v1/send-push-notification`
        await fetch(pushUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            user_id: tx.user_id,
            title: '💰 Nova venda aprovada!',
            body: `Pagamento de ${amount} recebido${charge.customer?.name ? ` de ${charge.customer.name}` : ''}`,
            data: { transaction_id: tx.id, type: 'transaction_approved' },
            event_type: ((tx.payment_method || 'pix').toLowerCase().includes('pix')) ? 'pix_paid'
              : ((tx.payment_method || '').toLowerCase().includes('boleto')) ? 'boleto_paid'
              : ((tx.payment_method || '').toLowerCase().includes('apple')) ? 'apple_pay'
              : 'credit_card',
            checkout_id: tx.checkout_id || null,
          }),
        })
        console.log('Push notification sent for transaction:', tx.id)
      } catch (pushErr) {
        console.error('Push notification error:', pushErr)
      }

      // Send approved email to customer (if enabled in checkout config)
      const customerEmail = charge.customer?.email || tx.customer_email
      let emailApprovedEnabled = true
      let productName = 'Produto'
      if (tx.checkout_id) {
        const { data: co } = await supabase.from('gateway_checkouts').select('name, config').eq('id', tx.checkout_id).single()
        if (co) {
          productName = (co.config as any)?.productName || co.name || 'Produto'
          emailApprovedEnabled = (co.config as any)?.emailApproved !== false
        }
      }
      if (customerEmail && emailApprovedEnabled) {
        try {
          const emailUrl = `${supabaseUrl}/functions/v1/send-gateway-email`
          await fetch(emailUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({
              type: 'approved',
              to: customerEmail,
              userId: tx.user_id,
              data: {
                customerName: charge.customer?.name || tx.customer_name || 'Cliente',
                amount: charge.value || tx.amount || 0,
                productName,
                transactionId: tx.id,
              },
            }),
          })
          console.log('Approved email sent to:', customerEmail)
        } catch (emailErr) {
          console.error('Approved email error:', emailErr)
        }
      }
    }

        // (outbound webhooks already dispatched above, before dedup check)

    // Forward to UTMify if configured
    if (tx.user_id) {
      try {
        const { data: utmifyConfig } = await supabase
          .from('gateway_integrations')
          .select('*')
          .eq('user_id', tx.user_id)
          .eq('name', 'UTMify')
          .eq('active', true)
          .maybeSingle()

        if (utmifyConfig?.auth_token) {
          const utmifyStatus = newStatus === 'approved' ? 'paid' : newStatus === 'refunded' ? 'refunded' : 'waiting_payment'
          const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
          const createdAt = tx.created_at ? new Date(tx.created_at).toISOString().replace('T', ' ').substring(0, 19) : now

          const utmifyPayload = {
            orderId: tx.external_id || tx.id,
            platform: 'ZapLynxPay',
            paymentMethod: 'pix',
            status: utmifyStatus,
            createdAt,
            approvedDate: utmifyStatus === 'paid' ? now : null,
            refundedAt: utmifyStatus === 'refunded' ? now : null,
            customer: {
              name: charge.customer?.name || tx.customer_name || '',
              email: charge.customer?.email || tx.customer_email || '',
              phone: charge.customer?.phone || tx.customer_phone || null,
              document: charge.customer?.taxID?.taxID || null,
            },
            products: [{
              id: tx.product_id || tx.id,
              name: tx.customer_name || 'Produto',
              planId: null,
              planName: null,
              quantity: 1,
              priceInCents: tx.amount || 0,
            }],
            trackingParameters: {
              src: (tx.metadata as any)?.src || null,
              sck: (tx.metadata as any)?.sck || null,
              utm_source: (tx.metadata as any)?.utm_source || null,
              utm_campaign: (tx.metadata as any)?.utm_campaign || null,
              utm_medium: (tx.metadata as any)?.utm_medium || null,
              utm_content: (tx.metadata as any)?.utm_content || null,
              utm_term: (tx.metadata as any)?.utm_term || null,
            },
            commission: {
              totalPriceInCents: tx.amount || 0,
              gatewayFeeInCents: tx.fee || 0,
              userCommissionInCents: tx.net || 0,
              currency: 'BRL',
            },
          }

          const utmRes = await fetch('https://api.utmify.com.br/api-credentials/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-token': utmifyConfig.auth_token,
            },
            body: JSON.stringify(utmifyPayload),
          })
          console.log('UTMify response:', utmRes.status, await utmRes.text())
        }
      } catch (utmErr) {
        console.error('UTMify forward error:', utmErr)
      }

      if (newStatus === 'approved') {
        try {
          const shopifyRes = await fetch(`${supabaseUrl}/functions/v1/shopify-create-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ transactionId: tx.id }),
          })
          console.log('Shopify create order response:', shopifyRes.status, await shopifyRes.text())
        } catch (shopifyErr) {
          console.error('Shopify create order error:', shopifyErr)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus, transactionId: tx.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('OpenPix webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ── Helper: dispatch outbound webhooks to user-configured endpoints ──
async function dispatchOutboundWebhooks(supabase: any, tx: any, payload: any, charge: any, newStatus: string) {
  if (!tx.user_id) return

  try {
    const { data: webhooks } = await supabase
      .from('gateway_integrations')
      .select('*')
      .eq('user_id', tx.user_id)
      .eq('active', true)

    if (!webhooks || webhooks.length === 0) {
      console.log('No active outbound webhooks for user:', tx.user_id)
      return
    }

    const eventKeyMap: Record<string, string> = {
      approved: 'approved',
      pending: 'pending',
      expired: 'expired',
      failed: 'refused',
    }
    const eventKey = eventKeyMap[newStatus] || newStatus

    for (const wh of webhooks) {
      if (wh.name === 'UTMify' || wh.name === 'Shopify') continue

      const whHeaders = wh.headers as any || {}
      const events = whHeaders.events || {}
      const hasEventConfig = Object.keys(events).length > 0

      if (hasEventConfig && !events[eventKey]) {
        console.log(`Webhook ${wh.name}: evento '${eventKey}' não habilitado, pulando`)
        continue
      }

      const outPayload = {
        event: `transaction.${eventKey}`,
        transaction: {
          id: tx.id,
          external_id: tx.external_id,
          status: newStatus,
          amount: tx.amount,
          fee: tx.fee,
          net: tx.net,
          payment_method: 'pix',
          customer: {
            name: charge?.customer?.name || tx.customer_name || null,
            email: charge?.customer?.email || tx.customer_email || null,
            phone: charge?.customer?.phone || tx.customer_phone || null,
          },
          product_id: tx.product_id,
          checkout_id: tx.checkout_id,
          created_at: tx.created_at,
          updated_at: new Date().toISOString(),
        },
      }

      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (wh.auth_type === 'bearer' && wh.auth_token) {
        reqHeaders['Authorization'] = `Bearer ${wh.auth_token}`
      } else if (wh.auth_type === 'basic' && wh.auth_token) {
        reqHeaders['Authorization'] = `Basic ${wh.auth_token}`
      } else if (wh.auth_type === 'api_key' && wh.auth_token) {
        reqHeaders['x-api-key'] = wh.auth_token
      }

      try {
        const whRes = await fetch(wh.webhook_url, {
          method: wh.method || 'POST',
          headers: reqHeaders,
          body: JSON.stringify(outPayload),
        })
        console.log(`✅ Outbound webhook ${wh.name} (${wh.webhook_url}): ${whRes.status}`)
      } catch (whErr) {
        console.error(`❌ Outbound webhook ${wh.name} error:`, whErr)
      }
    }
  } catch (dispatchErr) {
    console.error('Outbound webhook dispatch error:', dispatchErr)
  }
}