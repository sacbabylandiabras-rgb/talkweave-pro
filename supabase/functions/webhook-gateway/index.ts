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
    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Read incoming payload
    let payload: any = {}
    if (req.method !== 'GET') {
      try { payload = await req.json() } catch { payload = {} }
    }

    console.log('Webhook recebido para user:', userId)
    console.log('Payload:', JSON.stringify(payload))

    // Detect event type from payload (common gateway patterns)
    const eventType = detectEventType(payload)
    const phone = extractPhone(payload)
    const customerName = extractName(payload)
    const amount = extractAmount(payload)
    const product = extractProduct(payload)

    console.log('Evento detectado:', eventType, 'Phone:', phone)

    // Log the webhook
    await supabase.from('gateway_webhook_logs').insert({
      user_id: userId,
      event_type: eventType,
      phone: phone,
      payload: payload,
      status: 'received',
    })

    if (!phone) {
      console.log('Sem telefone no payload, apenas registrando')
      return new Response(JSON.stringify({ ok: true, message: 'logged, no phone found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find matching funnel for this event
    const { data: funnels } = await supabase
      .from('gateway_funnels')
      .select('*')
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .eq('active', true)
      .order('created_at', { ascending: true })

    if (!funnels || funnels.length === 0) {
      console.log('Nenhum funil configurado para evento:', eventType)
      return new Response(JSON.stringify({ ok: true, message: 'no funnel configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user Z-API credentials
    const { data: profile } = await supabase
      .from('profiles')
      .select('zapi_instance_id, zapi_token, zapi_client_token')
      .eq('id', userId)
      .single()

    if (!profile?.zapi_instance_id || !profile?.zapi_token || !profile?.zapi_client_token) {
      console.error('Credenciais Z-API incompletas para user:', userId)
      return new Response(JSON.stringify({ ok: false, error: 'Z-API credentials missing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send messages for each funnel step
    for (const funnel of funnels) {
      if (funnel.delay_seconds > 0) {
        await new Promise(resolve => setTimeout(resolve, funnel.delay_seconds * 1000))
      }

      // Replace variables in template
      let message = funnel.message_template
      message = message.replace(/\{\{nome\}\}/gi, customerName || 'Cliente')
      message = message.replace(/\{\{valor\}\}/gi, amount || '')
      message = message.replace(/\{\{produto\}\}/gi, product || '')
      message = message.replace(/\{\{telefone\}\}/gi, phone || '')
      message = message.replace(/\{\{status\}\}/gi, eventType || '')

      console.log('Enviando mensagem para', phone, ':', message)

      const zapiRes = await fetch(
        `https://api.z-api.io/instances/${profile.zapi_instance_id}/token/${profile.zapi_token}/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': profile.zapi_client_token,
          },
          body: JSON.stringify({ phone, message }),
        }
      )

      const zapiResult = await zapiRes.text()
      console.log('Z-API response:', zapiRes.status, zapiResult)

      // Update log
      await supabase.from('gateway_webhook_logs').insert({
        user_id: userId,
        event_type: eventType,
        phone: phone,
        payload: payload,
        message_sent: message,
        status: zapiRes.ok ? 'sent' : 'error',
      })
    }

    return new Response(JSON.stringify({ ok: true, messages_sent: funnels.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Gateway error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Helper functions to extract data from common gateway payloads
function detectEventType(payload: any): string {
  // Common patterns from payment gateways
  // Priority: deeper nested status first, then top-level type
  const status = (
    payload.data?.status ||
    payload.transaction?.status ||
    payload.payment?.status ||
    payload.status ||
    payload.event ||
    payload.type ||
    ''
  ).toString().toLowerCase()

  if (status.includes('approved') || status.includes('paid') || status.includes('aprovado') || status.includes('pago')) {
    return 'payment_approved'
  }
  if (status.includes('pending') || status.includes('pendente') || status.includes('waiting') || status === 'waiting_payment') {
    return 'payment_pending'
  }
  if (status.includes('refused') || status.includes('recusado') || status.includes('failed') || status.includes('falha')) {
    return 'payment_refused'
  }
  if (status.includes('refund') || status.includes('estorno') || status.includes('chargeback')) {
    return 'payment_refunded'
  }
  if (status.includes('cancel') || status.includes('cancelado')) {
    return 'payment_cancelled'
  }

  return status || 'unknown'
}

function extractPhone(payload: any): string | null {
  return (
    payload.phone ||
    payload.customer?.phone ||
    payload.client?.phone ||
    payload.buyer?.phone ||
    payload.data?.customer?.phone ||
    payload.data?.phone ||
    payload.telefone ||
    payload.customer?.cellphone ||
    payload.customer?.mobile ||
    null
  )
}

function extractName(payload: any): string | null {
  return (
    payload.customer?.name ||
    payload.client?.name ||
    payload.buyer?.name ||
    payload.data?.customer?.name ||
    payload.nome ||
    payload.customer_name ||
    null
  )
}

function extractAmount(payload: any): string | null {
  const val = (
    payload.amount ||
    payload.value ||
    payload.valor ||
    payload.transaction?.amount ||
    payload.payment?.amount ||
    payload.data?.amount ||
    null
  )
  if (val === null) return null
  // Format as BRL
  const num = typeof val === 'number' ? val : parseFloat(val)
  if (isNaN(num)) return String(val)
  return `R$ ${(num / 100).toFixed(2).replace('.', ',')}`
}

function extractProduct(payload: any): string | null {
  return (
    payload.product?.name ||
    payload.produto ||
    payload.items?.[0]?.name ||
    payload.data?.product?.name ||
    payload.product_name ||
    null
  )
}
