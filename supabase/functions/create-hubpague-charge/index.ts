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

    const hubpagueToken = Deno.env.get('HUBPAGUE_TOKEN')
    if (!hubpagueToken) {
      return new Response(JSON.stringify({ error: 'HubPague not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const amountCents = Math.round(amount)
    const productName = (checkout.config as any)?.productName || checkout.name || 'Produto'

    // Build HubPague payload
    const hubpagueBody: any = {
      amount: amountCents,
      method: 'pix',
      external_id: `zlp_${checkout.id}_${Date.now()}`,
      customer: {
        name: customerName || 'Cliente',
        email: customerEmail || 'cliente@email.com',
        phone: customerPhone || '(00) 00000-0000',
        document: {
          type: 'CPF',
          value: customerCpf || '000.000.000-00',
        },
      },
      products: [
        {
          name: productName,
          price: amountCents,
          quantity: '1',
          type: 'digital',
        },
      ],
    }

    console.log('HubPague request:', JSON.stringify(hubpagueBody))

    const hubRes = await fetch('https://app.hubpague.io/api/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hubpagueToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hubpagueBody),
    })

    const hubData = await hubRes.json()
    console.log('HubPague response:', JSON.stringify(hubData))

    if (!hubRes.ok) {
      console.error('HubPague error:', hubData)
      return new Response(JSON.stringify({ error: 'Failed to create PIX charge via HubPague', details: hubData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const externalId = hubpagueBody.external_id
    const brCode = hubData.pix?.copypaste || ''
    const qrCodeImage = hubData.pix?.qrcode || ''

    // Calculate platform fees: PIX = 6.99% + R$ 1.99
    const feePercent = 6.99
    const feeFixed = 199
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
      external_id: externalId,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      metadata: {
        provider: 'hubpague',
        hubpague_id: hubData.id || externalId,
        brCode: brCode || null,
      },
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
      correlationID: externalId,
      value: amountCents,
      provider: 'hubpague',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('HubPague charge error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
