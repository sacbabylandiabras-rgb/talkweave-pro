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

const normalizeStatusPayload = (payload: any) => {
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
    payload?.instance?.pairingCode,
    payload?.instance?.paircode,
    payload?.instance?.code,
    payload?.data?.pairingCode,
    payload?.data?.paircode,
    payload?.data?.code,
    payload?.data?.instance?.pairingCode,
    payload?.data?.instance?.paircode,
    payload?.data?.instance?.code,
    payload?.response?.pairingCode,
    payload?.response?.paircode,
    payload?.response?.code,
    payload?.response?.instance?.pairingCode,
    payload?.response?.instance?.paircode,
    payload?.response?.instance?.code,
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
    const { apiUrl, apiToken } = await req.json()

    if (!apiUrl || !apiToken) {
      return new Response(JSON.stringify({ error: 'Missing apiUrl or apiToken' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = apiUrl.replace(/\/+$/, '')
    const url = `${baseUrl}/instance/status`

    console.log(`Checking instance status: GET ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'token': apiToken,
      },
    })

    const data = await parseResponseBody(response)
    const normalizedData = normalizeStatusPayload(data)

    if (!response.ok) {
      console.error('uazapi status error:', response.status, JSON.stringify(data))
      return new Response(JSON.stringify({ error: data?.error || data?.message || `Error ${response.status}`, connectionStatus: 'disconnected', ...normalizedData }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sample = JSON.stringify(normalizedData).substring(0, 1000)
    console.log(`✅ Status response: ${sample}`)

    return new Response(JSON.stringify(normalizedData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: error.message, connectionStatus: 'disconnected' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
