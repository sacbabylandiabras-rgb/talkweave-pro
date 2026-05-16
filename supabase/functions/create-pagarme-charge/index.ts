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
     const { slug, amount, customerName, customerEmail, customerPhone, customerCpf, paymentMethod, cardInfo } = await req.json()
 
     if (!slug || !amount || !paymentMethod) {
       return new Response(JSON.stringify({ error: 'Missing required fields' }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       })
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!
     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
     const supabase = createClient(supabaseUrl, supabaseKey)
 
     // Get checkout
     const { data: checkout, error: checkoutErr } = await supabase
       .from('gateway_checkouts')
       .select('id, user_id, name, config, product_id')
       .eq('slug', slug)
       .single()
 
     if (checkoutErr || !checkout) {
       return new Response(JSON.stringify({ error: 'Checkout not found' }), {
         status: 404,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       })
     }
 
     const pagarmeKey = Deno.env.get('PAGARME_API_KEY')
     if (!pagarmeKey) {
       return new Response(JSON.stringify({ error: 'Pagar.me not configured' }), {
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
     const authHeader = `Basic ${btoa(pagarmeKey + ':')}`
 
     const pagarmeBody: any = {
       code: externalId,
       customer: {
         name: customerName || 'Cliente',
         email: customerEmail || 'cliente@email.com',
         type: cleanCpf.length > 11 ? 'corporation' : 'individual',
         document: cleanCpf,
         phones: {
           mobile_phone: { country_code: '55', area_code: areaCode, number: phoneNumber }
         }
       },
       items: [{ amount: Math.round(amount), description: productName, quantity: 1, code: checkout.product_id || 'prod_1' }],
       payments: []
     }
 
     if (paymentMethod === 'pix') {
       pagarmeBody.payments.push({
         payment_method: 'pix',
         pix: { expires_in: 3600 }
       })
     } else if (paymentMethod === 'credit_card' && cardInfo) {
       pagarmeBody.payments.push({
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
       })
      } else {
        return new Response(JSON.stringify({ error: 'Invalid payment method or missing card info' }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
 
     const pagarmeRes = await fetch('https://api.pagar.me/core/v5/orders', {
       method: 'POST',
       headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
       body: JSON.stringify(pagarmeBody),
     })
 
     const pagarmeData = await pagarmeRes.json()
     if (!pagarmeRes.ok) {
       return new Response(JSON.stringify({ error: 'Pagar.me request failed', details: pagarmeData }), { status: 500 })
     }
 
     const charge = pagarmeData.charges?.[0] || {}
     const lastTx = charge.last_transaction || {}
     
     // Fee calculation (example)
     const amountCents = Math.round(amount)
     const feePercent = paymentMethod === 'pix' ? 6.99 : 9.99
     const feeFixed = 199
     const feeCents = Math.round((amountCents * feePercent) / 100) + feeFixed
     const netCents = amountCents - feeCents
 
     const { data: txRecord } = await supabase.from('gateway_transactions').insert({
       user_id: checkout.user_id,
       checkout_id: checkout.id,
       product_id: checkout.product_id,
       amount: amountCents,
       fee: feeCents,
       net: netCents,
       payment_method: paymentMethod,
       status: charge.status === 'paid' ? 'approved' : 'pending',
       external_id: externalId,
       customer_name: customerName || null,
       customer_email: customerEmail || null,
       customer_phone: customerPhone || null,
       metadata: { provider: 'pagarme', pagarme_order_id: pagarmeData.id, pagarme_charge_id: charge.id }
     }).select('id').single()
 
     return new Response(JSON.stringify({
       status: charge.status === 'paid' ? 'approved' : 'pending',
       qrCodeImage: lastTx.qr_code_url,
       brCode: lastTx.qr_code,
       correlationID: externalId,
       provider: 'pagarme'
     }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
 
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
 })