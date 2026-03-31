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

    console.log('HubPague webhook received:', JSON.stringify(payload))

    const notificationType = payload.notification_type || payload.type || payload.event || ''

    // Handle transaction webhooks - accept multiple format variations
    const isTransaction = notificationType === 'transaction' || 
      notificationType === 'payment' ||
      notificationType === 'charge' ||
      payload.status !== undefined ||
      payload.id !== undefined

    if (isTransaction) {
      const hubpagueId = payload.id || payload.payment_id || payload.charge_id || payload.transaction_id || ''
      const hubStatus = (payload.status || payload.payment_status || '').toLowerCase()

      console.log('Transaction webhook - ID:', hubpagueId, 'Status:', hubStatus)

      // Map HubPague status to our status
      let newStatus = 'pending'
      if (hubStatus === 'paid') {
        newStatus = 'approved'
      } else if (hubStatus === 'failed' || hubStatus === 'cancelled' || hubStatus === 'blocked') {
        newStatus = 'failed'
      } else if (hubStatus === 'returned' || hubStatus === 'med') {
        newStatus = 'refunded'
      } else if (hubStatus === 'processing' || hubStatus === 'pending') {
        newStatus = 'pending'
      }

      console.log('Mapped status:', newStatus)

      // Try to find transaction by hubpague_id in metadata or by external_id
      // First try metadata match
      const { data: txByMeta } = await supabase
        .from('gateway_transactions')
        .select('id, user_id, checkout_id, external_id')
        .contains('metadata', { hubpague_id: hubpagueId })
        .single()

      let tx = txByMeta

      // If not found by metadata, try external_id pattern
      if (!tx) {
        const { data: txByExt } = await supabase
          .from('gateway_transactions')
          .select('id, user_id, checkout_id, external_id')
          .contains('metadata', { provider: 'hubpague' })
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        tx = txByExt
      }

      if (tx) {
        await supabase
          .from('gateway_transactions')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', tx.id)

        console.log('Transaction updated:', tx.id, 'to', newStatus)

        // Forward to webhook-gateway for WhatsApp notifications if approved
        if (newStatus === 'approved' && tx.user_id) {
          try {
            const gatewayUrl = `${supabaseUrl}/functions/v1/webhook-gateway?user_id=${tx.user_id}`
            const forwardPayload = {
              ...payload,
              status: 'approved',
              phone: payload.customer?.phone || null,
              customer: payload.customer || null,
              amount: payload.total,
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

        return new Response(JSON.stringify({ ok: true, status: newStatus, transactionId: tx.id }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else {
        console.log('No matching transaction found for HubPague ID:', hubpagueId)
      }
    }

    // Handle transfer webhooks
    if (notificationType === 'transfer_out') {
      console.log('Transfer webhook received:', payload.transfer_id, payload.status)
      // Could update withdrawal status here if needed
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('HubPague webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
