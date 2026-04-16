import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CARTWAVE_PROXY_BASE = 'http://187.77.249.247:3480'
const CARTWAVE_AUTH_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/auth-token/`
const CARTWAVE_STATUS_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/status-pix-copy-and-paste/`

function extractCartWaveAccessToken(payload: any): string | null {
  return payload?.access
    || payload?.access_token
    || payload?.token
    || payload?.data?.access
    || payload?.data?.access_token
    || payload?.data?.token
    || null
}

function mapCartWaveStatus(status: string | null | undefined): string | null {
  const normalized = (status || '').trim().toLowerCase()

  if (!normalized) return null
  if (['paid', 'completed', 'confirmed', 'approved', 'aprovada'].includes(normalized)) return 'approved'
  if (['refunded', 'returned', 'devolvida'].includes(normalized)) return 'refunded'
  if (['canceled', 'cancelled', 'expired', 'expirada', 'cancelada', 'failed'].includes(normalized)) return 'failed'
  if (['new', 'pending', 'processing', 'waiting_payment'].includes(normalized)) return 'pending'

  return null
}

async function getCartWaveStatus(cartwaveId: string | number) {
  const clientId = Deno.env.get('CARTWAVE_CLIENT_ID')
  const clientSecret = Deno.env.get('CARTWAVE_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    return { ok: false as const, status: null, rawStatus: null, message: 'CartWave credentials missing' }
  }

  const authRes = await fetch(CARTWAVE_AUTH_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'ZapLynxPay/1.0',
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })

  const authText = await authRes.text()
  let authData: any = null
  try {
    authData = authText ? JSON.parse(authText) : null
  } catch {
    authData = null
  }

  const accessToken = extractCartWaveAccessToken(authData)
  if (!authRes.ok || !accessToken) {
    console.error('CartWave auth failed in check-payment-status', authRes.status, authText.slice(0, 300))
    return { ok: false as const, status: null, rawStatus: null, message: 'CartWave auth failed' }
  }

  const statusUrl = `${CARTWAVE_STATUS_URL}?id=${encodeURIComponent(String(cartwaveId))}`
  const statusRes = await fetch(statusUrl, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'ZapLynxPay/1.0',
    },
  })

  const statusText = await statusRes.text()
  let statusData: any = null
  try {
    statusData = statusText ? JSON.parse(statusText) : null
  } catch {
    statusData = null
  }

  if (!statusRes.ok || !statusData) {
    console.error('CartWave status lookup failed', statusRes.status, statusText.slice(0, 300))
    return { ok: false as const, status: null, rawStatus: null, message: 'CartWave status lookup failed' }
  }

  const rawStatus = statusData?.status || statusData?.data?.status || null
  const mappedStatus = mapCartWaveStatus(rawStatus)

  return {
    ok: true as const,
    status: mappedStatus,
    rawStatus,
    data: statusData,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const externalId = url.searchParams.get('external_id')

    if (!externalId) {
      return new Response(JSON.stringify({ error: 'Missing external_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase
      .from('gateway_transactions')
      .select('id, status, metadata')
      .eq('external_id', externalId)
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ status: 'not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let currentStatus = data.status
    const metadata = (data.metadata as Record<string, any> | null) || null

    if (currentStatus === 'pending' && metadata?.provider === 'cartwave' && metadata?.cartwave_id) {
      const cartWaveResult = await getCartWaveStatus(metadata.cartwave_id)

      if (cartWaveResult.ok && cartWaveResult.status && cartWaveResult.status !== currentStatus) {
        const { error: updateError } = await supabase
          .from('gateway_transactions')
          .update({
            status: cartWaveResult.status,
            updated_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              cartwave_last_status: cartWaveResult.rawStatus,
              cartwave_last_checked_at: new Date().toISOString(),
            },
          })
          .eq('id', data.id)
          .eq('status', 'pending')

        if (!updateError) {
          currentStatus = cartWaveResult.status
        } else {
          console.error('Failed to update CartWave transaction status', updateError)
        }
      }
    }

    return new Response(JSON.stringify({ status: currentStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
