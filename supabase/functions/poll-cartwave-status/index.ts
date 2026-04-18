import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CARTWAVE_PROXY_BASE = 'http://187.77.249.247:3480'
const CARTWAVE_AUTH_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/auth-token/`
const CARTWAVE_STATUS_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/status-pix-copy-and-paste/`

async function getCartwaveToken(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const res = await fetch(CARTWAVE_AUTH_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'ZapLynxPay/1.0',
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.access || data?.access_token || data?.token || data?.data?.access || null
  } catch (err) {
    console.error('CartWave auth error:', err)
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const clientId = Deno.env.get('CARTWAVE_CLIENT_ID')
    const clientSecret = Deno.env.get('CARTWAVE_CLIENT_SECRET')
    const hmacSecret = Deno.env.get('CARTWAVE_HMAC_KEY')

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'CartWave not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find pending CartWave transactions from the last 7 days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: pendingTxs, error: txErr } = await supabase
      .from('gateway_transactions')
      .select('id, user_id, checkout_id, external_id, amount, fee, net, customer_name, customer_email, customer_phone, product_id, metadata, created_at, status')
      .eq('status', 'pending')
      .eq('payment_method', 'pix')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(50)

    if (txErr) {
      console.error('Error fetching pending transactions:', txErr)
      return new Response(JSON.stringify({ error: 'DB error', details: txErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Filter only CartWave transactions (need cartwave_id from create-pix response)
    const cartwaveTxs = (pendingTxs || []).filter(
      (tx: any) => tx.metadata?.provider === 'cartwave' && (tx.metadata?.cartwave_id || tx.metadata?.tx_id)
    )

    if (cartwaveTxs.length === 0) {
      console.log('No pending CartWave transactions to poll')
      return new Response(JSON.stringify({ ok: true, checked: 0, updated: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${cartwaveTxs.length} pending CartWave transactions to check`)

    // Get access token
    const accessToken = await getCartwaveToken(clientId, clientSecret)
    if (!accessToken) {
      console.error('Failed to authenticate with CartWave')
      return new Response(JSON.stringify({ error: 'CartWave auth failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let updated = 0
    const results: any[] = []

    for (const tx of cartwaveTxs) {
      const cwId = (tx.metadata as any)?.cartwave_id || (tx.metadata as any)?.tx_id
      if (!cwId) continue

      try {
        const statusUrl = `${CARTWAVE_STATUS_URL}?id=${encodeURIComponent(String(cwId))}`
        const statusRes = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'ZapLynxPay/1.0',
          },
        })

        const rawText = await statusRes.text()
        console.log(`CartWave GET ${statusUrl}: ${statusRes.status} - ${rawText.slice(0, 200)}`)

        let statusData: any = null
        try { statusData = rawText ? JSON.parse(rawText) : null } catch {}

        const cwStatus = (statusData?.status || statusData?.data?.status || statusData?.pix_status || statusData?.payment_status || '').toLowerCase()

        let newStatus: string | null = null
        if (['paid', 'completed', 'confirmed', 'concluida', 'aprovada', 'approved'].includes(cwStatus)) {
          newStatus = 'approved'
        } else if (['failed', 'cancelled', 'canceled', 'expired', 'expirada', 'cancelada'].includes(cwStatus)) {
          newStatus = 'failed'
        } else if (['refunded', 'returned', 'devolvida'].includes(cwStatus)) {
          newStatus = 'refunded'
        }


        if (newStatus && newStatus !== tx.status) {
          await supabase
            .from('gateway_transactions')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', tx.id)

          console.log(`✅ Updated tx ${tx.id} from ${tx.status} to ${newStatus}`)
          updated++

          // Side effects for approved
          if (newStatus === 'approved' && tx.user_id) {
            // Forward to webhook-gateway for WhatsApp notifications
            try {
              await fetch(`${supabaseUrl}/functions/v1/webhook-gateway?user_id=${tx.user_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({
                  status: 'approved',
                  phone: tx.customer_phone || null,
                  customer: { name: tx.customer_name, email: tx.customer_email, phone: tx.customer_phone },
                  amount: tx.amount,
                }),
              })
            } catch (fwdErr) {
              console.error('Forward error:', fwdErr)
            }

            // CAPI Purchase event
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-meta-capi`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({
                  user_id: tx.user_id,
                  event: 'Purchase',
                  value: (tx.amount || 0) / 100,
                  currency: 'BRL',
                  event_id: tx.id,
                  customer: { email: tx.customer_email, phone: tx.customer_phone, name: tx.customer_name },
                }),
              })
            } catch (capiErr) {
              console.error('CAPI error:', capiErr)
            }

            try {
              const amount = (tx.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({
                  user_id: tx.user_id,
                  title: '💰 Nova venda aprovada!',
                  body: `Pagamento de ${amount} recebido${tx.customer_name ? ` de ${tx.customer_name}` : ''}`,
                  data: { transaction_id: tx.id, type: 'transaction_approved' },
                }),
              })
            } catch (pushErr) {
              console.error('Push error:', pushErr)
            }

            // Approved email
            if (tx.customer_email) {
              try {
                let productName = 'Produto'
                if (tx.checkout_id) {
                  const { data: co } = await supabase.from('gateway_checkouts').select('name, config').eq('id', tx.checkout_id).single()
                  if (co) productName = (co.config as any)?.productName || co.name || 'Produto'
                }
                await fetch(`${supabaseUrl}/functions/v1/send-gateway-email`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                  body: JSON.stringify({
                    type: 'approved',
                    to: tx.customer_email,
                    data: {
                      customerName: tx.customer_name || 'Cliente',
                      amount: tx.amount || 0,
                      productName,
                      transactionId: tx.id,
                    },
                  }),
                })
              } catch (emailErr) {
                console.error('Email error:', emailErr)
              }
            }
          }

          results.push({ txId: tx.id, cwTxId: cwId, oldStatus: tx.status, newStatus, cwStatus })
        } else {
          results.push({ txId: tx.id, cwTxId: cwId, cwStatus: cwStatus || 'unknown', noChange: true })
        }
      } catch (pollErr) {
        console.error(`Error polling tx ${tx.id}:`, pollErr)
        results.push({ txId: tx.id, error: String(pollErr) })
      }
    }

    console.log(`Poll complete: checked=${cartwaveTxs.length}, updated=${updated}`)

    return new Response(JSON.stringify({ ok: true, checked: cartwaveTxs.length, updated, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Poll CartWave error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
