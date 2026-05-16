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
     const payload = await req.json()
     console.log('Pagar.me Webhook received:', JSON.stringify(payload))
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!
     const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
     const supabase = createClient(supabaseUrl, supabaseKey)
 
      const event = payload.event || payload.type
      const order = payload.data?.order || payload.data || payload.order
      const externalId = order?.code || order?.metadata?.code || payload.data?.code
      const pagarmeId = order?.id
 
     if (!externalId) {
       return new Response(JSON.stringify({ error: 'Missing external_id (code)' }), { status: 400 })
     }
 
     // Find transaction
     const { data: transaction, error: txError } = await supabase
       .from('gateway_transactions')
       .select('*')
       .eq('external_id', externalId)
       .maybeSingle()
 
     if (txError || !transaction) {
       console.warn('Transaction not found for external_id:', externalId)
       return new Response(JSON.stringify({ ok: true, message: 'Transaction not found' }), { status: 200 })
     }
 
     let newStatus = 'pending'
     if (event === 'order.paid') {
       newStatus = 'approved'
     } else if (event === 'order.payment_failed' || event === 'order.canceled') {
       newStatus = 'refused'
     }
 
     if (newStatus !== transaction.status) {
       await supabase
         .from('gateway_transactions')
         .update({ 
           status: newStatus,
           metadata: { ...transaction.metadata, pagarme_event: event, pagarme_id: pagarmeId }
         })
         .eq('id', transaction.id)
 
       console.log(`Transaction ${transaction.id} updated to ${newStatus}`)
 
       // Trigger the gateway webhook for the user to fire funnels
       const gatewayWebhookUrl = `${supabaseUrl}/functions/v1/webhook-gateway?user_id=${transaction.user_id}`
       
       // Map to standard gateway payload
       const gatewayPayload = {
         status: newStatus === 'approved' ? 'approved' : newStatus,
         amount: transaction.amount,
         customer: {
           name: transaction.customer_name,
           email: transaction.customer_email,
           phone: transaction.customer_phone,
         },
         transaction: {
           id: transaction.external_id,
           status: newStatus,
         }
       }
 
       await fetch(gatewayWebhookUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(gatewayPayload)
       })
     }
 
     return new Response(JSON.stringify({ ok: true }), {
       status: 200,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     })
   } catch (error) {
     console.error('Pagar.me Webhook error:', error)
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     })
   }
 })