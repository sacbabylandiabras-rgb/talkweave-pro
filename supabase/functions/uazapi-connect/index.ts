import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

const parseResponseBody = async (response: Response) => {
  const rawText = await response.text()

  if (!rawText) return {}

  try {
    return JSON.parse(rawText)
  } catch {
    return { message: rawText }
  }
}

const normalizeConnectionPayload = (payload: any) => {
  const instance = payload?.instance ?? {}
  const statusInfo = payload?.status ?? {}

  const connected =
    payload?.connected === true ||
    payload?.loggedIn === true ||
    statusInfo?.connected === true ||
    statusInfo?.loggedIn === true ||
    instance?.status === 'connected'

  const loggedIn =
    payload?.loggedIn === true ||
    statusInfo?.loggedIn === true ||
    connected

  const qrCode = pickFirstString(
    payload?.qrCode,
    payload?.qrcode,
    payload?.qr,
    payload?.value,
    payload?.data?.qrCode,
    payload?.data?.qrcode,
    payload?.data?.qr,
    payload?.response?.qrCode,
    payload?.response?.qrcode,
    payload?.response?.qr,
    instance?.qrCode,
    instance?.qrcode,
  )

  const pairingCode = pickFirstString(
    payload?.pairingCode,
    payload?.paircode,
    payload?.code,
    payload?.data?.pairingCode,
    payload?.data?.paircode,
    payload?.data?.code,
    payload?.response?.pairingCode,
    payload?.response?.paircode,
    payload?.response?.code,
    instance?.pairingCode,
    instance?.paircode,
  )

  const rawState = pickFirstString(
    payload?.connectionStatus,
    payload?.state,
    typeof payload?.status === 'string' ? payload.status : null,
    instance?.status,
    statusInfo?.state,
  )

  const connectionStatus = connected
    ? 'connected'
    : (qrCode || pairingCode || rawState === 'connecting')
      ? 'connecting'
      : rawState === 'disconnected'
        ? 'disconnected'
        : 'disconnected'

  return {
    ...payload,
    connected,
    loggedIn,
    connectionStatus,
    qrCode,
    pairingCode,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { apiUrl, apiToken, phone, instanceId } = await req.json()

    if (!apiUrl || !apiToken) {
      return new Response(JSON.stringify({ error: 'Missing apiUrl or apiToken' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = apiUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/instance/connect`

    console.log(`Connecting instance: POST ${url}${phone ? ' (pairing mode)' : ' (QR mode)'}`)

    const normalizedPhone = typeof phone === 'string' ? phone.replace(/\D/g, '') : ''

    if (phone && (normalizedPhone.length < 10 || normalizedPhone.length > 15)) {
      return new Response(JSON.stringify({ error: 'Telefone inválido. Use DDI + DDD + número.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (normalizedPhone) {
      for (const endpoint of [`${baseUrl}/instance/disconnect`, `${baseUrl}/instance/logout`]) {
        try {
          const resetResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', token: apiToken },
          })
          console.log(`Reset before pairing: ${endpoint} → ${resetResponse.status}`)
          if (resetResponse.ok) break
        } catch (resetError) {
          console.warn('Reset before pairing failed:', resetError)
        }
      }
    }

    const body: Record<string, string> = {}
    if (normalizedPhone) body.phone = normalizedPhone

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,
      },
      body: JSON.stringify(body),
    })

    const data = await parseResponseBody(response)
    const normalizedData = normalizeConnectionPayload(data)

    if (!response.ok) {
      console.error('uazapi connect error:', response.status, JSON.stringify(data))
      return new Response(JSON.stringify({ error: data?.error || data?.message || `Error ${response.status}`, ...normalizedData }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`✅ Connect response keys: ${Object.keys(normalizedData).join(',')}`)

    // Auto-configure webhook on UAZAPI so we receive incoming messages.
    // Without this, only delivery acks (messages_update) arrive and flow
    // captures never resume after the user replies.
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      if (supabaseUrl) {
        const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]
        const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/webhook-zapi?provider=uazapi${instanceId ? `&instanceId=${encodeURIComponent(instanceId)}` : ''}`
        const webhookEndpoint = `${baseUrl}/instance/updateWebhook`
        const webhookBody = {
          url: webhookUrl,
          enabled: true,
          events: ['messages', 'messages_update', 'connection', 'groups', 'presence'],
          excludeMessages: [],
          addUrlEvents: false,
        }
        console.log(`🔗 Configuring UAZAPI webhook → ${webhookUrl}`)
        const whRes = await fetch(webhookEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: apiToken },
          body: JSON.stringify(webhookBody),
        })
        const whText = await whRes.text()
        console.log(`🔗 UAZAPI webhook config response: ${whRes.status} ${whText.substring(0, 200)}`)
      }
    } catch (whErr) {
      console.error('⚠️ Failed to configure UAZAPI webhook:', whErr)
    }

    return new Response(JSON.stringify(normalizedData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
