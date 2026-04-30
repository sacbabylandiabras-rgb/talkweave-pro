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
    const link = extractLink(payload)
    const transactionId = extractTransactionId(payload)
    const orderLink = transactionId
      ? `https://pay.zaplynxpro.online/pedido/${transactionId}`
      : ''

    console.log('Evento detectado:', eventType, 'Phone:', phone, 'Link:', link)

    // Log the webhook
    await supabase.from('gateway_webhook_logs').insert({
      user_id: userId,
      event_type: eventType,
      phone: phone,
      payload: payload,
      status: 'received',
    })

    // Also persist as an external gateway event (so dashboard cards reflect it)
    try {
      const amountCents = extractAmountCents(payload)
      const externalStatus = mapEventToStatus(eventType)
      const externalId = transactionId || extractAnyId(payload)
      const customerEmail = extractEmail(payload)

      if (externalId) {
        const { data: existing } = await supabase
          .from('external_gateway_events')
          .select('id')
          .eq('user_id', userId)
          .eq('external_id', externalId)
          .maybeSingle()
        if (existing) {
          await supabase.from('external_gateway_events').update({
            status: externalStatus,
            amount: amountCents,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: phone,
            raw_payload: payload,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id)
        } else {
          await supabase.from('external_gateway_events').insert({
            user_id: userId,
            external_id: externalId,
            status: externalStatus,
            amount: amountCents,
            source: 'webhook',
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: phone,
            raw_payload: payload,
          })
        }
      } else {
        await supabase.from('external_gateway_events').insert({
          user_id: userId,
          status: externalStatus,
          amount: amountCents,
          source: 'webhook',
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: phone,
          raw_payload: payload,
        })
      }
    } catch (e) {
      console.error('external_gateway_events persist error:', e)
    }

    if (!phone) {
      console.log('Sem telefone no payload, apenas registrando')
      return new Response(JSON.stringify({ ok: true, message: 'logged, no phone found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Deduplication: check if we already processed this phone+event in the last 60 seconds
    const deduplicationWindow = new Date(Date.now() - 60 * 1000).toISOString()
    const { data: recentLogs } = await supabase
      .from('gateway_webhook_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone)
      .eq('event_type', eventType)
      .in('status', ['sent', 'received'])
      .gte('created_at', deduplicationWindow)
      .limit(2)

    if (recentLogs && recentLogs.length > 1) {
      console.log('Webhook duplicado detectado, ignorando:', phone, eventType)
      return new Response(JSON.stringify({ ok: true, message: 'duplicate webhook ignored' }), {
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

    // Get ALL active Z-API instances for rotation
    const { data: allInstances } = await supabase
      .from('zapi_instances')
      .select('id, zapi_instance_id, zapi_token, zapi_client_token, instance_name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (!allInstances || allInstances.length === 0) {
      console.error('Nenhuma instância Z-API ativa para user:', userId)
      return new Response(JSON.stringify({ ok: false, error: 'Z-API credentials missing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get total sent count for rotation index
    const { count: totalSent } = await supabase
      .from('gateway_webhook_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')

    // Helper: pick instance for a funnel (selected instances or fallback to all)
    const getInstanceForFunnel = (funnel: any) => {
      const funnelInstanceIds = funnel.instance_ids
      let pool = allInstances
      if (funnelInstanceIds && Array.isArray(funnelInstanceIds) && funnelInstanceIds.length > 0) {
        const filtered = allInstances.filter((i: any) => funnelInstanceIds.includes(i.id))
        if (filtered.length > 0) pool = filtered
      }
      const rotationIndex = (totalSent || 0) % pool.length
      return pool[rotationIndex]
    }

    // Helper: check if a Z-API instance is actually connected to WhatsApp
    const checkInstanceConnected = async (creds: any): Promise<{ connected: boolean; reason?: string }> => {
      try {
        const statusRes = await fetch(
          `https://api.z-api.io/instances/${creds.zapi_instance_id}/token/${creds.zapi_token}/status`,
          { headers: { 'Client-Token': creds.zapi_client_token } }
        )
        const statusBody = await statusRes.json().catch(() => ({}))
        const connected = statusBody?.connected === true || String(statusBody?.status || '').toLowerCase() === 'connected'
        if (!connected) {
          return { connected: false, reason: statusBody?.error || statusBody?.message || `status=${statusBody?.status || 'unknown'}` }
        }
        return { connected: true }
      } catch (e: any) {
        return { connected: false, reason: `status check failed: ${e?.message}` }
      }
    }

    // Send messages for each funnel step
    for (let i = 0; i < funnels.length; i++) {
      const funnel = funnels[i]
      let zapiCreds = getInstanceForFunnel(funnel)
      console.log(`Funil ${i + 1}: usando instância ${zapiCreds.instance_name}`)
      if (funnel.delay_seconds > 0) {
        await new Promise(resolve => setTimeout(resolve, funnel.delay_seconds * 1000))
      }

      // Validate connectivity; if disconnected, try other instances in the pool
      let connectivity = await checkInstanceConnected(zapiCreds)
      if (!connectivity.connected) {
        console.warn(`⚠️ Instância ${zapiCreds.instance_name} desconectada (${connectivity.reason}). Procurando alternativa...`)
        const funnelInstanceIds = funnel.instance_ids
        let pool = allInstances
        if (funnelInstanceIds && Array.isArray(funnelInstanceIds) && funnelInstanceIds.length > 0) {
          const filtered = allInstances.filter((inst: any) => funnelInstanceIds.includes(inst.id))
          if (filtered.length > 0) pool = filtered
        }
        let foundAlternative = false
        for (const alt of pool) {
          if (alt.id === zapiCreds.id) continue
          const altCheck = await checkInstanceConnected(alt)
          if (altCheck.connected) {
            zapiCreds = alt
            connectivity = altCheck
            foundAlternative = true
            console.log(`✅ Usando instância alternativa: ${alt.instance_name}`)
            break
          }
        }
        if (!foundAlternative) {
          console.error(`❌ Nenhuma instância conectada disponível para envio`)
          await supabase.from('gateway_webhook_logs').insert({
            user_id: userId,
            event_type: eventType,
            phone: phone,
            payload: payload,
            message_sent: null,
            status: 'error',
          })
          continue
        }
      }

      // Replace variables in template
      let message = funnel.message_template
      message = message.replace(/\{\{nome\}\}/gi, customerName || 'Cliente')
      message = message.replace(/\{\{valor\}\}/gi, amount || '')
      message = message.replace(/\{\{produto\}\}/gi, product || '')
      message = message.replace(/\{\{telefone\}\}/gi, phone || '')
      message = message.replace(/\{\{status\}\}/gi, eventType || '')
      // Determine the final link: use extracted link from payload, or fallback to funnel's fixed button_url
      const finalLink = link || (funnel.button_url ? funnel.button_url.replace(/\{\{link\}\}/gi, link || '').replace(/\{\{link_pedido\}\}/gi, orderLink) : null)
      message = message.replace(/\{\{link\}\}/gi, finalLink || '')
      message = message.replace(/\{\{link_pedido\}\}/gi, orderLink)

      const buttonLabel = funnel.button_label
      const hasButton = buttonLabel && finalLink

      console.log('Enviando mensagem para', phone, ':', message, hasButton ? `com botão: ${buttonLabel}` : 'sem botão')

      let zapiRes: Response

      if (hasButton) {
        // Include button link in the message text (send-button-actions deprecated)
        const messageWithLink = `${message}\n\n🔗 ${buttonLabel}: ${finalLink}`
        zapiRes = await fetch(
          `https://api.z-api.io/instances/${zapiCreds.zapi_instance_id}/token/${zapiCreds.zapi_token}/send-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': zapiCreds.zapi_client_token,
            },
            body: JSON.stringify({ phone, message: messageWithLink }),
          }
        )
      } else {
        // Send plain text
        zapiRes = await fetch(
          `https://api.z-api.io/instances/${zapiCreds.zapi_instance_id}/token/${zapiCreds.zapi_token}/send-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': zapiCreds.zapi_client_token,
            },
            body: JSON.stringify({ phone, message }),
          }
        )
      }

      const zapiResultText = await zapiRes.text()
      let zapiResultJson: any = {}
      try { zapiResultJson = JSON.parse(zapiResultText) } catch { /* noop */ }
      console.log('Z-API response:', zapiRes.status, zapiResultText)

      // Z-API pode retornar HTTP 200 mesmo quando a entrega falha. Validar o corpo também.
      const hasMessageId = !!(zapiResultJson?.messageId || zapiResultJson?.id || zapiResultJson?.zaapId)
      const hasError = !!(zapiResultJson?.error)
      const trulySent = zapiRes.ok && hasMessageId && !hasError

      await supabase.from('gateway_webhook_logs').insert({
        user_id: userId,
        event_type: eventType,
        phone: phone,
        payload: payload,
        message_sent: trulySent ? message : `${message}\n\n[ERROR] ${zapiResultText}`,
        status: trulySent ? 'sent' : 'error',
      })
    }

    return new Response(JSON.stringify({ ok: true, messages_sent: funnels.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Gateway error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Helper functions to extract data from common gateway payloads
function detectEventType(payload: any): string {
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
  const raw = (
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
  if (!raw) return null
  return formatBrazilianPhone(String(raw))
}

function formatBrazilianPhone(phone: string): string {
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '')
  
  // Se já tem 12-13 dígitos (com código do país), retorna como está
  if (digits.length >= 12) return digits
  
  // Se tem 10-11 dígitos (DDD + número), adiciona 55
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits
  
  return digits
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

function extractLink(payload: any): string | null {
  // Direct link fields
  const directLink = (
    payload.payment_url ||
    payload.checkout_url ||
    payload.link ||
    payload.url ||
    payload.data?.payment_url ||
    payload.data?.checkout_url ||
    payload.data?.link ||
    payload.data?.url ||
    payload.transaction?.payment_url ||
    payload.transaction?.checkout_url ||
    payload.payment?.url ||
    payload.payment?.link ||
    null
  )
  if (directLink) return directLink

  // GhostsPay: build checkout URL from metadata.linkId
  let metadata = payload.data?.metadata || payload.metadata || null
  if (metadata && typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata) } catch { metadata = null }
  }
  const linkId = metadata?.linkId || null
  if (linkId) {
    return `https://checkout.paguseguro.fun/payment/checkout/${linkId}`
  }

  // Extract checkout URL from utm field (e.g. "checkouturl=https%3A%2F%2F...")
  const utm = payload.utm || payload.data?.utm || null
  if (utm && typeof utm === 'string') {
    const match = utm.match(/checkouturl=([^&]+)/i)
    if (match) {
      try {
        return decodeURIComponent(match[1])
      } catch {
        return match[1]
      }
    }
  }

  return null
}

function extractTransactionId(payload: any): string | null {
  const id = (
    payload?.transaction?.id ||
    payload?.data?.transaction?.id ||
    payload?.transaction_id ||
    payload?.data?.transaction_id ||
    payload?.order_id ||
    payload?.data?.order_id ||
    payload?.id ||
    null
  )
  if (!id) return null
  const s = String(id)
  // Only accept UUID-ish (gateway_transactions.id is uuid)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null
}

function extractAnyId(payload: any): string | null {
  const id =
    payload?.transaction?.id ||
    payload?.data?.transaction?.id ||
    payload?.transaction_id ||
    payload?.data?.transaction_id ||
    payload?.order_id ||
    payload?.data?.order_id ||
    payload?.purchase?.transaction ||
    payload?.id ||
    payload?.code ||
    null
  return id ? String(id) : null
}

function extractEmail(payload: any): string | null {
  return (
    payload?.customer?.email ||
    payload?.buyer?.email ||
    payload?.client?.email ||
    payload?.email ||
    payload?.customer_email ||
    payload?.data?.customer?.email ||
    null
  )
}

function extractAmountCents(payload: any): number {
  const raw =
    payload?.amount ??
    payload?.value ??
    payload?.valor ??
    payload?.transaction?.amount ??
    payload?.payment?.amount ??
    payload?.data?.amount ??
    payload?.purchase?.price?.value ??
    payload?.total ??
    null
  if (raw == null) return 0
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^\d.,-]/g, '').replace(',', '.'))
  if (isNaN(num)) return 0
  // Heuristic: small numbers or with decimal separator → reais (convert to cents)
  if (num < 1000 || String(raw).includes('.') || String(raw).includes(',')) {
    return Math.round(num * 100)
  }
  return Math.round(num)
}

function mapEventToStatus(eventType: string): string {
  switch (eventType) {
    case 'payment_approved': return 'approved'
    case 'payment_refunded': return 'refunded'
    case 'payment_refused':
    case 'payment_cancelled': return 'refused'
    default: return 'pending'
  }
}
