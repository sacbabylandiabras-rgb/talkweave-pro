import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeHmacSignature(signature: string | null): string | null {
  if (!signature) return null
  const normalized = signature
    .trim()
    .replace(/^sha512=/i, '')
    .replace(/^hmac[:=]\s*/i, '')
    .replace(/[^a-fA-F0-9]/g, '')
    .toLowerCase()

  return normalized || null
}

function normalizeJsonForHmac(body: string): string {
  try {
    const parsed = JSON.parse(body)
    return JSON.stringify(parsed).replace(/:\s/g, ':').replace(/,\s/g, ',')
  } catch {
    return body.trim()
  }
}

async function verifyHmac(body: string, signature: string | null): Promise<boolean> {
  const hmacKey = Deno.env.get('CARTWAVE_HMAC_KEY')
  if (!hmacKey) {
    console.log('CARTWAVE_HMAC_KEY not set, skipping HMAC validation')
    return true
  }

  const normalizedSignature = normalizeHmacSignature(signature)
  if (!normalizedSignature) return false

  try {
    const normalizedBody = normalizeJsonForHmac(body)
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(hmacKey),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalizedBody))
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

    if (computed === normalizedSignature) {
      return true
    }

    const rawSig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const rawComputed = Array.from(new Uint8Array(rawSig)).map(b => b.toString(16).padStart(2, '0')).join('')

    if (rawComputed === normalizedSignature) {
      console.log('CartWave HMAC matched using raw body fallback')
      return true
    }

    console.error('CartWave HMAC mismatch', JSON.stringify({
      receivedLength: normalizedSignature.length,
      normalizedBodyLength: normalizedBody.length,
      rawBodyLength: body.length,
      normalizedPreview: normalizedBody.slice(0, 200),
      rawPreview: body.slice(0, 200),
    }))

    return false
  } catch (err) {
    console.error('HMAC verification error:', err)
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const rawBody = await req.text()
    const hmacSignature = req.headers.get('x-hmac-signature')
      || req.headers.get('X-Hmac-Signature')
      || req.headers.get('hmac')
      || req.headers.get('Hmac')
      || req.headers.get('x-signature')
      || req.headers.get('X-Signature')

    const hmacValid = await verifyHmac(rawBody, hmacSignature)
    if (!hmacValid) {
      console.error('Invalid HMAC signature')
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let payload: any = {}
    try { payload = JSON.parse(rawBody) } catch { payload = {} }

    console.log('CartWave webhook received:', JSON.stringify(payload))

    // CartWave sends { type: "QR_CODE_COPY_AND_PASTE_PAID", data: { ... } }
    const eventType = payload.type || ''
    const eventData = payload.data || payload

    // Extract identifiers from the nested data structure
    const cartwaveId = eventData.qr_code_id || eventData.id || eventData.transaction_id || eventData.pix_id || payload.id || ''
    const txId = eventData.tx_id || payload.tx_id || ''
    const cartwaveStatus = (eventData.status || payload.status || '').toLowerCase()

    console.log('CartWave webhook - type:', eventType, 'qr_code_id:', cartwaveId, 'tx_id:', txId, 'status:', cartwaveStatus)

    // Map CartWave status/type to our status
    let newStatus = 'pending'
    if (eventType === 'QR_CODE_COPY_AND_PASTE_PAID' || cartwaveStatus === 'paid' || cartwaveStatus === 'completed' || cartwaveStatus === 'confirmed') {
      newStatus = 'approved'
    } else if (eventType === 'QR_CODE_COPY_AND_PASTE_REFUNDED' || cartwaveStatus === 'failed' || cartwaveStatus === 'cancelled' || cartwaveStatus === 'expired') {
      newStatus = cartwaveStatus === 'refunded' || cartwaveStatus === 'returned' || eventType.includes('REFUND') ? 'refunded' : 'failed'
    } else if (cartwaveStatus === 'refunded' || cartwaveStatus === 'returned') {
      newStatus = 'refunded'
    }

    console.log('Mapped status:', newStatus)

    // Find transaction by multiple strategies
    const txColumns = 'id, user_id, checkout_id, external_id, amount, fee, net, customer_name, customer_email, customer_phone, product_id, metadata, created_at, status'
    let tx: any = null

    // Strategy 1: Match by tx_id in metadata
    if (txId) {
      const { data } = await supabase
        .from('gateway_transactions')
        .select(txColumns)
        .contains('metadata', { tx_id: txId })
        .maybeSingle()
      tx = data
    }

    // Strategy 2: Match by cartwave_id (qr_code_id) in metadata
    if (!tx && cartwaveId) {
      const { data } = await supabase
        .from('gateway_transactions')
        .select(txColumns)
        .contains('metadata', { cartwave_id: cartwaveId })
        .maybeSingle()
      tx = data
    }

    // Strategy 3: Match by cartwave_id as number in metadata
    if (!tx && cartwaveId) {
      const { data } = await supabase
        .from('gateway_transactions')
        .select(txColumns)
        .contains('metadata', { cartwave_id: Number(cartwaveId) })
        .maybeSingle()
      tx = data
    }

    // Strategy 4: Match by external_id
    if (!tx && cartwaveId) {
      const { data } = await supabase
        .from('gateway_transactions')
        .select(txColumns)
        .eq('external_id', String(cartwaveId))
        .maybeSingle()
      tx = data
    }

    // Strategy 5: Match by payload.external_id
    if (!tx && payload.external_id) {
      const { data } = await supabase
        .from('gateway_transactions')
        .select(txColumns)
        .eq('external_id', payload.external_id)
        .maybeSingle()
      tx = data
    }

    if (!tx) {
      console.log('No matching transaction found for CartWave tx_id:', txId, 'qr_code_id:', cartwaveId)
      return new Response(JSON.stringify({ ok: true, message: 'transaction not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Dispatch outbound webhooks
    await dispatchOutboundWebhooks(supabase, tx, payload, cartwaveStatus, newStatus)

    const isDuplicate = tx.status === newStatus
    if (isDuplicate) {
      console.log('Transaction already has status', newStatus, '- skipping internal side effects')
      return new Response(JSON.stringify({ ok: true, message: 'status unchanged', status: newStatus, transactionId: tx.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase
      .from('gateway_transactions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', tx.id)

    console.log('Transaction updated:', tx.id, 'from', tx.status, 'to', newStatus)

    // Side effects for approved transactions
    if (newStatus === 'approved' && tx.user_id) {
      // Forward to webhook-gateway for WhatsApp
      try {
        const gatewayUrl = `${supabaseUrl}/functions/v1/webhook-gateway?user_id=${tx.user_id}`
        await fetch(gatewayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            ...payload,
            status: 'approved',
            phone: payload.customer?.phone || null,
            customer: payload.customer || null,
            amount: tx.amount,
          }),
        })
        console.log('Forwarded to webhook-gateway')
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
            value: (tx.amount || 0) / 100,
            currency: 'BRL',
            event_id: tx.id,
            customer: { email: tx.customer_email, phone: tx.customer_phone, name: tx.customer_name },
          }),
        })
      } catch (capiErr) {
        console.error('CAPI error:', capiErr)
      }

      // Push notification (Approved)
      try {
        const amountCents = tx.amount || 0
        const amount = (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            user_id: tx.user_id,
            title: '💰 Nova venda aprovada!',
            body: `Pagamento de ${amount} recebido${tx.customer_name ? ` de ${tx.customer_name}` : ''}`,
            data: { transaction_id: tx.id, type: 'transaction_approved', amount: String(amountCents) },
            event_type: 'pix_paid',
            checkout_id: tx.checkout_id || null,
          }),
        })
      } catch (pushErr) {
        console.error('Push error:', pushErr)
      }

      // Approved email
      const customerEmail = payload.customer?.email || tx.customer_email
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
          await fetch(`${supabaseUrl}/functions/v1/send-gateway-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({
              type: 'approved',
              to: customerEmail,
              userId: tx.user_id,
              data: {
                customerName: payload.customer?.name || tx.customer_name || 'Cliente',
                amount: tx.amount || 0,
                productName,
                transactionId: tx.id,
              },
            }),
          })
        } catch (emailErr) {
          console.error('Email error:', emailErr)
        }
      }
    }

    // UTMify integration
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

          await fetch('https://api.utmify.com.br/api-credentials/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-token': utmifyConfig.auth_token },
            body: JSON.stringify({
              orderId: tx.external_id || tx.id,
              platform: 'ZapLynxPay',
              paymentMethod: 'pix',
              status: utmifyStatus,
              createdAt,
              approvedDate: utmifyStatus === 'paid' ? now : null,
              refundedAt: utmifyStatus === 'refunded' ? now : null,
              customer: {
                name: payload.customer?.name || tx.customer_name || '',
                email: payload.customer?.email || tx.customer_email || '',
                phone: payload.customer?.phone || tx.customer_phone || null,
                document: payload.customer?.document || null,
              },
              products: [{
                id: tx.product_id || tx.id,
                name: 'Produto',
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
            }),
          })
        }
      } catch (utmErr) {
        console.error('UTMify error:', utmErr)
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
    console.error('CartWave webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function dispatchOutboundWebhooks(supabase: any, tx: any, payload: any, rawStatus: string, newStatus: string) {
  if (!tx.user_id) return
  try {
    const { data: webhooks } = await supabase
      .from('gateway_integrations')
      .select('*')
      .eq('user_id', tx.user_id)
      .eq('active', true)

    if (!webhooks || webhooks.length === 0) return

    const eventMap: Record<string, string> = {
      paid: 'approved', completed: 'approved', confirmed: 'approved',
      processing: 'pending', pending: 'pending',
      failed: 'refused', cancelled: 'cancelled', expired: 'cancelled',
      refunded: 'refunded', returned: 'refunded',
    }
    const eventKey = eventMap[rawStatus] || newStatus

    for (const wh of webhooks) {
      if (wh.name === 'UTMify' || wh.name === 'Shopify') continue
      const whHeaders = wh.headers as any || {}
      const events = whHeaders.events || {}
      const hasEventConfig = Object.keys(events).length > 0
      if (hasEventConfig && !events[eventKey]) continue

      const outPayload = {
        event: `transaction.${eventKey}`,
        transaction: {
          id: tx.id, external_id: tx.external_id, status: newStatus,
          amount: tx.amount, fee: tx.fee, net: tx.net, payment_method: 'pix',
          customer: {
            name: payload.customer?.name || tx.customer_name || null,
            email: payload.customer?.email || tx.customer_email || null,
            phone: payload.customer?.phone || tx.customer_phone || null,
          },
          product_id: tx.product_id, checkout_id: tx.checkout_id,
          created_at: tx.created_at, updated_at: new Date().toISOString(),
        },
      }

      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (wh.auth_type === 'bearer' && wh.auth_token) reqHeaders['Authorization'] = `Bearer ${wh.auth_token}`
      else if (wh.auth_type === 'basic' && wh.auth_token) reqHeaders['Authorization'] = `Basic ${wh.auth_token}`
      else if (wh.auth_type === 'api_key' && wh.auth_token) reqHeaders['x-api-key'] = wh.auth_token

      try {
        const whRes = await fetch(wh.webhook_url, { method: wh.method || 'POST', headers: reqHeaders, body: JSON.stringify(outPayload) })
        console.log(`✅ Outbound webhook ${wh.name}: ${whRes.status}`)
      } catch (whErr) {
        console.error(`❌ Outbound webhook ${wh.name} error:`, whErr)
      }
    }
  } catch (dispatchErr) {
    console.error('Outbound webhook dispatch error:', dispatchErr)
  }
}
