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

    // Check active acquirer from platform config
    let activeAcquirer = 'openpix'
    try {
      const { data: configRow } = await supabase
        .from('gateway_platform_config')
        .select('value')
        .eq('key', 'active_acquirer')
        .single()
      if (configRow?.value) activeAcquirer = configRow.value
    } catch {
      // Table may not exist yet, default to openpix
    }

    console.log('Active acquirer:', activeAcquirer)

    const amountCents = Math.round(amount)

    // Calculate platform fees: PIX = 6.99% + R$ 1.99 (199 centavos)
    const feePercent = 6.99
    const feeFixed = 199
    const feeCents = Math.round((amountCents * feePercent) / 100) + feeFixed
    const netCents = amountCents - feeCents

    // Route to the correct acquirer
    if (activeAcquirer === 'hubpague') {
      return await processHubPague(supabase, checkout, amountCents, feeCents, netCents, customerName, customerEmail, customerPhone, customerCpf)
    } else {
      return await processOpenPix(supabase, checkout, amountCents, feeCents, netCents, customerName, customerEmail, customerPhone, customerCpf)
    }

  } catch (error) {
    console.error('PIX charge error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function processOpenPix(supabase: any, checkout: any, amountCents: number, feeCents: number, netCents: number, customerName?: string, customerEmail?: string, customerPhone?: string, customerCpf?: string) {
  const openpixAppId = Deno.env.get('OPENPIX_APP_ID')
  if (!openpixAppId) {
    return new Response(JSON.stringify({ error: 'OpenPix not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const correlationID = `zlp_${checkout.id}_${Date.now()}`

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
    metadata: { provider: 'openpix', openpix_charge_id: charge.id || correlationID, brCode: brCode || null },
  })

  try {
    await supabase
      .from('gateway_checkouts')
      .update({ conversions: (checkout as any).conversions ? (checkout as any).conversions + 1 : 1 })
      .eq('id', checkout.id)
  } catch {}

  // Send PIX generated email
  if (customerEmail) {
    try {
      const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-gateway-email`
      await fetch(emailUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          type: 'pix_generated',
          to: customerEmail,
          data: {
            customerName: customerName || 'Cliente',
            amount: amountCents,
            productName: (checkout.config as any)?.productName || checkout.name || 'Produto',
            brCode: brCode || undefined,
          },
        }),
      })
      console.log('PIX generated email sent to:', customerEmail)
    } catch (emailErr) {
      console.error('Email send error:', emailErr)
    }
  }

  return new Response(JSON.stringify({
    qrCodeImage,
    brCode,
    correlationID,
    expiresAt,
    value: amountCents,
    provider: 'openpix',
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function processHubPague(supabase: any, checkout: any, amountCents: number, feeCents: number, netCents: number, customerName?: string, customerEmail?: string, customerPhone?: string, customerCpf?: string) {
  const hubpagueToken = Deno.env.get('HUBPAGUE_TOKEN')
  if (!hubpagueToken) {
    return new Response(JSON.stringify({ error: 'HubPague not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const externalId = `zlp_${checkout.id}_${Date.now()}`
  const rawName = (checkout.config as any)?.productName || checkout.name || 'Produto'
  const productName = rawName.length >= 3 ? rawName : 'Produto Digital'

  const hubRes = await fetch('https://app.hubpague.io/api/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hubpagueToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountCents,
      method: 'pix',
      external_id: externalId,
      customer: {
        name: customerName || 'Cliente',
        email: customerEmail || 'cliente@email.com',
        phone: customerPhone || '00000000000',
        document: {
          type: 'CPF',
          value: (customerCpf && customerCpf.replace(/\D/g, '').length >= 11) ? customerCpf.replace(/\D/g, '') : '00000000000',
        },
      },
      products: [{
        name: productName,
        price: amountCents,
        quantity: '1',
        type: 'digital',
      }],
    }),
  })

  const hubData = await hubRes.json()
  console.log('HubPague response:', JSON.stringify(hubData))

  if (!hubRes.ok) {
    return new Response(JSON.stringify({ error: 'Failed to create PIX charge via HubPague', details: hubData }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const brCode = hubData.pix?.copypaste || ''
  const qrCodeImage = hubData.pix?.qrcode || ''

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
    metadata: { provider: 'hubpague', hubpague_id: hubData.id || externalId, brCode: brCode || null },
  })

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
}
