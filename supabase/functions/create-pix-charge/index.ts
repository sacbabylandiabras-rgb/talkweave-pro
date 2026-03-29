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
    const { slug, amount, customerName, customerEmail, customerPhone, customerCpf } = await req.json()

    if (!slug || !amount) {
      return new Response(JSON.stringify({ error: 'Missing slug or amount' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get checkout to find owner
    const { data: checkout, error: checkoutErr } = await supabase
      .from('gateway_checkouts')
      .select('id, user_id, name, config, product_id')
      .eq('slug', slug)
      .eq('status', true)
      .single()

    if (checkoutErr || !checkout) {
      return new Response(JSON.stringify({ error: 'Checkout not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const openpixAppId = Deno.env.get('OPENPIX_APP_ID')
    if (!openpixAppId) {
      return new Response(JSON.stringify({ error: 'OpenPix not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create correlation ID
    const correlationID = `zlp_${checkout.id}_${Date.now()}`

    // Amount in centavos
    const amountCents = Math.round(amount)

    // Create charge on OpenPix
    const openpixRes = await fetch('https://api.openpix.com.br/api/v1/charge', {
      method: 'POST',
      headers: {
        'Authorization': openpixAppId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correlationID,
        value: amountCents,
        comment: checkout.name || 'Pagamento ZapLynxPay',
        customer: customerName ? {
          name: customerName,
          email: customerEmail || undefined,
          phone: customerPhone || undefined,
          taxID: customerCpf || undefined,
        } : undefined,
      }),
    })

    const openpixData = await openpixRes.json()
    console.log('OpenPix response:', JSON.stringify(openpixData))

    if (!openpixRes.ok) {
      console.error('OpenPix error:', openpixData)
      return new Response(JSON.stringify({ error: 'Failed to create PIX charge', details: openpixData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const charge = openpixData.charge || openpixData
    const qrCodeImage = charge.qrCodeImage || openpixData.qrCodeImage
    const brCode = charge.brCode || charge.pixKey || openpixData.brCode
    const expiresAt = charge.expiresDate || charge.expiresAt

    // Calculate platform fees: PIX = 6.99% + R$ 1.99 (199 centavos)
    const feePercent = 6.99
    const feeFixed = 199 // R$ 1.99 in centavos
    const feeCents = Math.round((amountCents * feePercent) / 100) + feeFixed
    const netCents = amountCents - feeCents

    // Record transaction
    await supabase.from('gateway_transactions').insert({
      user_id: checkout.user_id,
      checkout_id: checkout.id,
      product_id: checkout.product_id,
      amount: amountCents,
      fee: feeCents,
      net: netCents,
      payment_method: 'pix',
      status: 'pending',
      external_id: correlationID,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      metadata: { openpix_charge_id: charge.id || correlationID, brCode: brCode || null },
    })

    // Increment conversions
    try {
      await supabase
        .from('gateway_checkouts')
        .update({ conversions: (checkout as any).conversions ? (checkout as any).conversions + 1 : 1 })
        .eq('id', checkout.id)
    } catch {}


    return new Response(JSON.stringify({
      qrCodeImage,
      brCode,
      correlationID,
      expiresAt,
      value: amountCents,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('PIX charge error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
