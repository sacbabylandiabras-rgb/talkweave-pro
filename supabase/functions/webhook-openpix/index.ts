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

    // OpenPix sends: { event, charge: { correlationID, status, value, ... } }
    // or { pixQrCode: {...}, charge: {...}, pix: {...} }
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

    // Update transaction by external_id (correlationID)
    const { data: tx, error: txErr } = await supabase
      .from('gateway_transactions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('external_id', correlationID)
      .select('id, user_id, checkout_id, status')
      .single()

    if (txErr) {
      console.error('Error updating transaction:', txErr)
    } else {
      console.log('Transaction updated:', tx?.id, 'to', newStatus)
    }

    // Also forward to webhook-gateway if payment approved (to trigger WhatsApp messages)
    if (newStatus === 'approved' && tx?.user_id) {
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
          }),
        })
        console.log('Push notification sent for transaction:', tx.id)
      } catch (pushErr) {
        console.error('Push notification error:', pushErr)
      }
    }

    // Forward to UTMify if configured
    if (tx?.user_id) {
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
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus, transactionId: tx?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('OpenPix webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
