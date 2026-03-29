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
