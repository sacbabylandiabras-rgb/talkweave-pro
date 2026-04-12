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

    // Check per-user acquirer override first, then fall back to platform default
    let activeAcquirer = 'openpix'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('pix_acquirer')
        .eq('id', checkout.user_id)
        .single()
      if (profile?.pix_acquirer) {
        activeAcquirer = profile.pix_acquirer
      } else {
        const { data: configRow } = await supabase
          .from('gateway_platform_config')
          .select('value')
          .eq('key', 'active_acquirer')
          .single()
        if (configRow?.value) activeAcquirer = configRow.value
      }
    } catch {
      // default to openpix
    }

    console.log('Active acquirer:', activeAcquirer)

    const amountCents = Math.round(amount)

    // Calculate platform fees: PIX = 6.99% + R$ 1.99 (199 centavos)
    const feePercent = 6.99
    const feeFixed = 199
    const feeCents = Math.round((amountCents * feePercent) / 100) + feeFixed
    const netCents = amountCents - feeCents

    // Route to the correct acquirer
    if (activeAcquirer === 'cartwave') {
      return await processCartWave(supabase, checkout, amountCents, feeCents, netCents, customerName, customerEmail, customerPhone, customerCpf)
    } else if (activeAcquirer === 'hubpague') {
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
    metadata: { provider: 'openpix', openpix_charge_id: charge.id || correlationID, brCode: brCode || null, document: customerCpf || null },
  })

  try {
    await supabase
      .from('gateway_checkouts')
      .update({ conversions: (checkout as any).conversions ? (checkout as any).conversions + 1 : 1 })
      .eq('id', checkout.id)
  } catch {}

  // Send PIX generated email (if enabled in checkout config)
  const emailPixEnabled = (checkout.config as any)?.emailPixGenerated !== false
  if (customerEmail && emailPixEnabled) {
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
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
    metadata: { provider: 'hubpague', hubpague_id: hubData.id || externalId, brCode: brCode || null, document: customerCpf || null },
  })

  try {
    await supabase
      .from('gateway_checkouts')
      .update({ conversions: (checkout as any).conversions ? (checkout as any).conversions + 1 : 1 })
      .eq('id', checkout.id)
  } catch {}

  // Send PIX generated email (if enabled in checkout config)
  const emailPixEnabled = (checkout.config as any)?.emailPixGenerated !== false
  if (customerEmail && emailPixEnabled) {
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
    correlationID: externalId,
    value: amountCents,
    provider: 'hubpague',
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function processCartWave(supabase: any, checkout: any, amountCents: number, feeCents: number, netCents: number, customerName?: string, customerEmail?: string, customerPhone?: string, customerCpf?: string) {
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const clientId = Deno.env.get('CARTWAVE_CLIENT_ID')
  const clientSecret = Deno.env.get('CARTWAVE_CLIENT_SECRET')
  const hmacSecret = Deno.env.get('CARTWAVE_HMAC_KEY')
  if (!clientId || !clientSecret || !hmacSecret) {
    return new Response(JSON.stringify({ error: 'CartWave not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Step 1: Get access token
  console.log('CartWave: authenticating...')
  const authRes = await fetch('https://api.cartwavehub.com.br/v2/finance/auth-token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })
  const authData = await authRes.json()
  console.log('CartWave auth response:', JSON.stringify(authData))

  const accessToken = authData.access || authData.access_token || authData.token
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'CartWave auth failed', details: authData }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get branch/account from platform config
  let branch = '0001'
  let account = '900002'
  try {
    const { data: branchCfg } = await supabase.from('gateway_platform_config').select('value').eq('key', 'cartwave_branch').single()
    if (branchCfg?.value) branch = branchCfg.value
    const { data: accountCfg } = await supabase.from('gateway_platform_config').select('value').eq('key', 'cartwave_account').single()
    if (accountCfg?.value) account = accountCfg.value
  } catch {}

  const externalId = `zlp_${checkout.id}_${Date.now()}`
  const amountReais = parseFloat((amountCents / 100).toFixed(2))
  const cleanCpf = (customerCpf && customerCpf.replace(/\D/g, '').length >= 11) ? customerCpf.replace(/\D/g, '') : '00000000000'
  const isCnpj = cleanCpf.length === 14

  const cartwaveBody = {
    amount: amountReais,
    debtor_name: (customerName || 'Cliente').substring(0, 25),
    debtor_document: cleanCpf,
    type_document: isCnpj ? 'CNPJ' : 'CPF',
    type_fine: 'NONE',
    fine: 0,
    source_account_branch_identifier: branch,
    source_account_number: account,
    base_64_image: true,
  }

  // Step 2: Calculate HMAC SHA-512 of the body using the secret key
  const bodyString = JSON.stringify(cartwaveBody)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(hmacSecret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyString))
  const hmacHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')

  console.log('CartWave request:', bodyString)

  // Step 3: Create PIX charge
  const cartwaveRes = await fetch('https://api.cartwavehub.com.br/v2/finance/create-pix-copy-and-paste/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'hmac': hmacHex,
    },
    body: bodyString,
  })

  const cartwaveData = await cartwaveRes.json()
  console.log('CartWave response:', JSON.stringify(cartwaveData))

  if (!cartwaveRes.ok || cartwaveData.worked === false) {
    return new Response(JSON.stringify({ error: 'Failed to create PIX charge via CartWave', details: cartwaveData }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const brCode = cartwaveData.pix_copy_and_paste || ''
  const qrCodeImage = cartwaveData.base_64_image_url || ''
  const cartwaveId = cartwaveData.qr_code_id || cartwaveData.tx_id || externalId

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
    metadata: { provider: 'cartwave', cartwave_id: cartwaveId, tx_id: cartwaveData.tx_id || null, brCode: brCode || null, document: customerCpf || null },
  })

  try {
    await supabase
      .from('gateway_checkouts')
      .update({ conversions: (checkout as any).conversions ? (checkout as any).conversions + 1 : 1 })
      .eq('id', checkout.id)
  } catch {}

  // Send PIX generated email
  const emailPixEnabled = (checkout.config as any)?.emailPixGenerated !== false
  if (customerEmail && emailPixEnabled) {
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
    } catch (emailErr) {
      console.error('Email send error:', emailErr)
    }
  }

  return new Response(JSON.stringify({
    qrCodeImage,
    brCode,
    correlationID: externalId,
    value: amountCents,
    provider: 'cartwave',
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
