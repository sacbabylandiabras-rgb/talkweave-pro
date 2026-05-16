 async function processPagarMe(supabase: any, checkout: any, amountCents: number, feeCents: number, netCents: number, customerName?: string, customerEmail?: string, customerPhone?: string, customerCpf?: string) {
   const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
   const pagarmeKey = Deno.env.get('PAGARME_API_KEY')
   if (!pagarmeKey) {
     return new Response(JSON.stringify({ error: 'Pagar.me not configured (API Key missing)' }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     })
   }
 
   const externalId = `zlp_${checkout.id}_${Date.now()}`
   const cleanCpf = (customerCpf && customerCpf.replace(/\D/g, '').length >= 11) ? customerCpf.replace(/\D/g, '') : '00000000000'
   const cleanPhone = (customerPhone && customerPhone.replace(/\D/g, '').length >= 10) ? customerPhone.replace(/\D/g, '') : '11999999999'
   const areaCode = cleanPhone.substring(0, 2)
   const phoneNumber = cleanPhone.substring(2)
 
   const productName = (checkout.config as any)?.productName || checkout.name || 'Produto'
 
   const pagarmeBody = {
     code: externalId,
     customer: {
       name: customerName || 'Cliente',
       email: customerEmail || 'cliente@email.com',
       type: cleanCpf.length > 11 ? 'corporation' : 'individual',
       document: cleanCpf,
       phones: {
         mobile_phone: {
           country_code: '55',
           area_code: areaCode,
           number: phoneNumber,
         }
       }
     },
     items: [
       {
         amount: amountCents,
         description: productName,
         quantity: 1,
         code: checkout.product_id || 'prod_1'
       }
     ],
     payments: [
       {
         payment_method: 'pix',
         pix: {
           expires_in: 3600 // 1 hour
         }
       }
     ]
   }
 
   console.log('Pagar.me request:', JSON.stringify(pagarmeBody))
 
   const authHeader = `Basic ${btoa(pagarmeKey + ':')}`
 
   const pagarmeRes = await fetch('https://api.pagar.me/core/v5/orders', {
     method: 'POST',
     headers: {
       'Authorization': authHeader,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify(pagarmeBody),
   })
 
   const pagarmeData = await pagarmeRes.json()
   console.log('Pagar.me response:', JSON.stringify(pagarmeData))
 
   if (!pagarmeRes.ok) {
     console.error('Pagar.me error:', pagarmeData)
     return new Response(JSON.stringify({ error: 'Failed to create PIX charge via Pagar.me', details: pagarmeData }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     })
   }
 
   const pixInfo = pagarmeData.charges?.[0]?.last_transaction || {}
   const brCode = pixInfo.qr_code || ''
   const qrCodeImage = pixInfo.qr_code_url || ''
 
   const { data: txRecord } = await supabase.from('gateway_transactions').insert({
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
     metadata: { provider: 'pagarme', pagarme_order_id: pagarmeData.id, brCode, document: customerCpf || null },
   }).select('id').single()
 
   // Push Notification
   try {
     const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
     await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
       body: JSON.stringify({
         user_id: checkout.user_id,
         title: '⚡ PIX Gerado!',
         body: `${customerName || 'Um cliente'} gerou um PIX de ${amountFormatted}`,
         data: { transaction_id: txRecord?.id, type: 'pix_generated', url: 'https://zaplynx.com/aplicativo' },
         url: 'https://zaplynx.com/aplicativo',
         event_type: 'pix_or_boleto_issued',
         checkout_id: checkout.id,
       }),
     })
   } catch (err) {
     console.error('Push notification error:', err)
   }
 
   // Conversion tracking
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
    provider: 'pagarme',
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function processPagarMeCard(supabase: any, checkout: any, amountCents: number, feeCents: number, netCents: number, customerName?: string, customerEmail?: string, customerPhone?: string, customerCpf?: string, cardInfo?: any) {
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const pagarmeKey = Deno.env.get('PAGARME_API_KEY')
  
  if (!pagarmeKey) {
    return new Response(JSON.stringify({ error: 'Pagar.me not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!cardInfo) {
    return new Response(JSON.stringify({ error: 'Missing card information' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const externalId = `zlp_card_${checkout.id}_${Date.now()}`
  const cleanCpf = (customerCpf && customerCpf.replace(/\D/g, '').length >= 11) ? customerCpf.replace(/\D/g, '') : '00000000000'
  const cleanPhone = (customerPhone && customerPhone.replace(/\D/g, '').length >= 10) ? customerPhone.replace(/\D/g, '') : '11999999999'
  const areaCode = cleanPhone.substring(0, 2)
  const phoneNumber = cleanPhone.substring(2)
  const productName = (checkout.config as any)?.productName || checkout.name || 'Produto'

  const pagarmeBody = {
    code: externalId,
    customer: {
      name: customerName || 'Cliente',
      email: customerEmail || 'cliente@email.com',
      type: cleanCpf.length > 11 ? 'corporation' : 'individual',
      document: cleanCpf,
      phones: {
        mobile_phone: {
          country_code: '55',
          area_code: areaCode,
          number: phoneNumber,
        }
      }
    },
    items: [
      {
        amount: amountCents,
        description: productName,
        quantity: 1,
        code: checkout.product_id || 'prod_1'
      }
    ],
    payments: [
      {
        payment_method: 'credit_card',
        credit_card: {
          installments: cardInfo.installments || 1,
          statement_descriptor: 'ZAPLYNXPAY',
          card: {
            number: cardInfo.number.replace(/\s/g, ''),
            holder_name: cardInfo.holder_name,
            exp_month: cardInfo.exp_month,
            exp_year: cardInfo.exp_year,
            cvv: cardInfo.cvv
          }
        }
      }
    ]
  }

  const authHeader = `Basic ${btoa(pagarmeKey.trim() + ':')}`
  const pagarmeRes = await fetch('https://api.pagar.me/core/v5/orders', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pagarmeBody),
  })

  const pagarmeData = await pagarmeRes.json()
  
  if (!pagarmeRes.ok) {
    console.error('Pagar.me Card error:', pagarmeData)
    return new Response(JSON.stringify({ error: 'Pagamento recusado ou erro no Pagar.me', details: pagarmeData }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const charge = pagarmeData.charges?.[0] || {}
  const status = charge.status === 'paid' ? 'approved' : 'pending'

  const { data: txRecord } = await supabase.from('gateway_transactions').insert({
    user_id: checkout.user_id,
    checkout_id: checkout.id,
    product_id: checkout.product_id,
    amount: amountCents,
    fee: feeCents,
    net: netCents,
    payment_method: 'credit_card',
    status: status,
    external_id: externalId,
    customer_name: customerName || null,
    customer_email: customerEmail || null,
    customer_phone: customerPhone || null,
    metadata: { provider: 'pagarme', pagarme_order_id: pagarmeData.id, card_brand: charge.last_transaction?.card?.brand || null },
  }).select('id').single()

  // Push Notification
  try {
    const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        user_id: checkout.user_id,
        title: status === 'approved' ? '✅ Cartão Aprovado!' : '⏳ Cartão Pendente',
        body: `${customerName || 'Cliente'} pagou ${amountFormatted} no cartão.`,
        data: { transaction_id: txRecord?.id, type: 'card_payment', url: 'https://zaplynx.com/aplicativo' },
        url: 'https://zaplynx.com/aplicativo',
        event_type: 'pix_or_boleto_issued', // Reusing same logic for alerts
        checkout_id: checkout.id,
      }),
    })
  } catch (err) {
    console.error('Push notification error:', err)
  }

  return new Response(JSON.stringify({
    status: status,
    correlationID: externalId,
    provider: 'pagarme'
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CARTWAVE_PROXY_BASE = 'http://187.77.249.247:3480'
const CARTWAVE_AUTH_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/auth-token/`
const CARTWAVE_PIX_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/create-pix-copy-and-paste/`

async function readResponsePayload(response: Response) {
  const rawText = await response.text()
  const contentType = response.headers.get('content-type') || ''

  if (contentType.toLowerCase().includes('application/json')) {
    try {
      return { data: JSON.parse(rawText), rawText, contentType }
    } catch {
      return { data: null, rawText, contentType }
    }
  }

  return { data: null, rawText, contentType }
}

function extractCartWaveAccessToken(payload: any): string | null {
  return payload?.access
    || payload?.access_token
    || payload?.token
    || payload?.data?.access
    || payload?.data?.access_token
    || payload?.data?.token
    || null
}

async function authenticateCartWave(clientId: string, clientSecret: string) {
  const jsonBody = JSON.stringify({ client_id: clientId, client_secret: clientSecret })
  const formBody = new URLSearchParams({ client_id: clientId, client_secret: clientSecret }).toString()

  const attempts: Array<{ label: string; headers: Record<string, string>; body: string }> = [
    {
      label: 'json-body',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'ZapLynxPay/1.0',
      },
      body: jsonBody,
    },
    {
      label: 'json-body-with-underscore-headers',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'ZapLynxPay/1.0',
        'client_id': clientId,
        'client_secret': clientSecret,
      },
      body: jsonBody,
    },
    {
      label: 'json-body-with-dash-headers',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'ZapLynxPay/1.0',
        'client-id': clientId,
        'client-secret': clientSecret,
      },
      body: jsonBody,
    },
    {
      label: 'form-urlencoded',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ZapLynxPay/1.0',
      },
      body: formBody,
    },
  ]

  let lastAttempt: {
    label: string
    status: number
    contentType: string
    rawText: string
    data: any
  } | null = null

  for (const attempt of attempts) {
    // Build equivalent curl for debugging
    const curlHeaders = Object.entries(attempt.headers).map(([k, v]) => `-H '${k}: ${v}'`).join(' ')
    const curlCmd = `curl -X POST '${CARTWAVE_AUTH_URL}' ${curlHeaders} -d '${attempt.body}'`
    console.log(`[CURL][${attempt.label}] ${curlCmd}`)

    const response = await fetch(CARTWAVE_AUTH_URL, {
      method: 'POST',
      headers: attempt.headers,
      body: attempt.body,
    })

    const requestId = response.headers.get('x-amzn-requestid')
      || response.headers.get('x-amz-cf-id')
      || response.headers.get('x-request-id')
      || 'N/A'
    const allHeaders = Object.fromEntries(response.headers.entries())

    const { data, rawText, contentType } = await readResponsePayload(response)
    const accessToken = extractCartWaveAccessToken(data)

    console.log(`[${attempt.label}] status=${response.status} content-type=${contentType} request-id=${requestId}`)
    console.log(`[${attempt.label}] response-headers:`, JSON.stringify(allHeaders))
    console.log(`[${attempt.label}] body: ${rawText.slice(0, 800)}`)

    lastAttempt = {
      label: attempt.label,
      status: response.status,
      contentType,
      rawText,
      data,
    }

    if (response.ok && accessToken) {
      return {
        ok: true,
        accessToken,
        attempt: attempt.label,
        status: response.status,
      }
    }

    if (response.status !== 400 && response.status !== 401 && response.status !== 403) {
      break
    }
  }

  return {
    ok: false,
    attempt: lastAttempt?.label || 'unknown',
    status: lastAttempt?.status || 500,
    contentType: lastAttempt?.contentType || '',
    rawText: lastAttempt?.rawText || '',
    data: lastAttempt?.data || null,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { slug, amount, customerName, customerEmail, customerPhone, customerCpf, paymentMethod, cardInfo } = await req.json()

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

    let amountCents = Math.round(amount)

    if (checkout.product_id) {
      const { data: product } = await supabase
        .from('gateway_products')
        .select('price')
        .eq('id', checkout.product_id)
        .maybeSingle()

      if (product && typeof product.price === 'number') {
        amountCents = product.price
      }
    }

    // Calculate platform fees: PIX = 6.99% + R$ 1.99, Card = 9.99% + R$ 1.99
    const feePercent = paymentMethod === 'credit_card' ? 9.99 : 6.99
    const feeFixed = 199
    const feeCents = Math.round((amountCents * feePercent) / 100) + feeFixed
    const netCents = amountCents - feeCents

     // Specialized logic for Credit Card via Pagar.me
     if (paymentMethod === 'credit_card') {
       return await processPagarMeCard(supabase, checkout, amountCents, feeCents, netCents, customerName, customerEmail, customerPhone, customerCpf, cardInfo)
     }
 
     // Route to the correct acquirer for PIX
     if (activeAcquirer === 'cartwave') {
       return await processCartWave(supabase, checkout, amountCents, feeCents, netCents, customerName, customerEmail, customerPhone, customerCpf)
     } else if (activeAcquirer === 'hubpague') {
       return await processHubPague(supabase, checkout, amountCents, feeCents, netCents, customerName, customerEmail, customerPhone, customerCpf)
     } else if (activeAcquirer === 'pagarme') {
       return await processPagarMe(supabase, checkout, amountCents, feeCents, netCents, customerName, customerEmail, customerPhone, customerCpf)
     } else {
       return await processOpenPix(supabase, checkout, amountCents, feeCents, netCents, customerName, customerEmail, customerPhone, customerCpf)
     }

  } catch (error) {
    console.error('PIX charge error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function processOpenPix(supabase: any, checkout: any, amountCents: number, feeCents: number, netCents: number, customerName?: string, customerEmail?: string, customerPhone?: string, customerCpf?: string) {
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

   const { data: txRecord } = await supabase.from('gateway_transactions').insert({
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
   }).select('id').single()

   // Send push notification for generated PIX
   try {
     const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
     await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
       body: JSON.stringify({
         user_id: checkout.user_id,
         title: '⚡ PIX Gerado!',
         body: `${customerName || 'Um cliente'} gerou um PIX de ${amountFormatted}`,
          data: { transaction_id: txRecord?.id, type: 'pix_generated', url: 'https://zaplynx.com/aplicativo' },
          url: 'https://zaplynx.com/aplicativo',
         event_type: 'pix_or_boleto_issued',
         checkout_id: checkout.id,
       }),
     })
   } catch (err) {
     console.error('Push notification error:', err)
   }

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

   const { data: txRecord } = await supabase.from('gateway_transactions').insert({
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
   }).select('id').single()

   // Send push notification for generated PIX
   try {
     const amountFormatted = (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
     await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
       body: JSON.stringify({
         user_id: checkout.user_id,
         title: '⚡ PIX Gerado!',
         body: `${customerName || 'Um cliente'} gerou um PIX de ${amountFormatted}`,
          data: { transaction_id: txRecord?.id, type: 'pix_generated', url: 'https://zaplynx.com/aplicativo' },
          url: 'https://zaplynx.com/aplicativo',
         event_type: 'pix_or_boleto_issued',
         checkout_id: checkout.id,
       }),
     })
   } catch (err) {
     console.error('Push notification error:', err)
   }

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

  try {
    // Step 1: Get access token
    console.log('CartWave: authenticating via proxy...')
    const authResult = await authenticateCartWave(clientId, clientSecret)
    const authRawText = authResult.rawText || ''

    if (!authResult.ok || !authResult.accessToken) {
      const blockedByCloudFront = authResult.status === 403 && authRawText.includes('CloudFront')
      return new Response(JSON.stringify({
        error: 'CartWave auth failed',
        message: blockedByCloudFront
          ? 'CartWave bloqueou a autenticação antes de validar as credenciais.'
          : 'Não foi possível autenticar na CartWave com os formatos compatíveis testados.',
        attempt: authResult.attempt,
        status: authResult.status,
        details: authResult.data,
        raw: authRawText.slice(0, 500),
        contentType: authResult.contentType,
        blockedByCloudFront,
        networkMode: 'ipv4-forced',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accessToken = authResult.accessToken

    // Get branch/account from platform config
    let branch = '0001'
    let account = '7003299'
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
    const cartwaveRes = await fetch(CARTWAVE_PIX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'User-Agent': 'ZapLynxPay/1.0',
        'Authorization': `Bearer ${accessToken}`,
        'hmac': hmacHex,
      },
      body: bodyString,
    })

    const { data: cartwaveData, rawText: cartwaveRawText, contentType: cartwaveContentType } = await readResponsePayload(cartwaveRes)
    console.log('CartWave response status:', cartwaveRes.status, 'content-type:', cartwaveContentType)
    console.log('CartWave response raw:', cartwaveRawText.slice(0, 500))

    if (!cartwaveRes.ok || !cartwaveData || cartwaveData.worked === false) {
      return new Response(JSON.stringify({
        error: 'Failed to create PIX charge via CartWave',
        status: cartwaveRes.status,
        details: cartwaveData,
        raw: cartwaveRawText.slice(0, 500),
        contentType: cartwaveContentType,
        networkMode: 'ipv4-forced',
      }), {
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

    // Send PIX generated email & Push notification
    const checkoutConfig = (checkout.config as any) || {}
    const emailPixEnabled = checkoutConfig.emailPixGenerated !== false
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

    // Real-time Push Notification for the seller
    try {
      const amount = (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      console.log('[CartWave] Sending push notification for user:', checkout.user_id, 'amount:', amount)
      const pushRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          user_id: checkout.user_id,
          title: '⚡ PIX Gerado!',
          body: `${customerName || 'Cliente'} gerou um PIX de ${amount}.`,
          data: { type: 'pix_generated', amount: String(amountCents), customer: customerName || '', url: 'https://zaplynx.com/aplicativo' },
          url: 'https://zaplynx.com/aplicativo',
          event_type: 'pix_or_boleto_issued',
          checkout_id: checkout.id,
        }),
      })
      const pushTxt = await pushRes.text()
      console.log('[CartWave] Push response status:', pushRes.status, 'body:', pushTxt.slice(0, 300))
    } catch (pushErr) {
      console.error('Push notification error:', pushErr)
    }

    return new Response(JSON.stringify({
      qrCodeImage,
      brCode,
      correlationID: externalId,
      value: amountCents,
      provider: 'cartwave',
      networkMode: 'ipv4-forced',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } finally {
  }
}
