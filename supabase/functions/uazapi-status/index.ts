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

  const ownerJidRaw = pickFirstString(
    payload?.owner,
    payload?.wid,
    payload?.ownerJid,
    payload?.me?.id,
    payload?.me?.user,
    payload?.profile?.wid,
    payload?.profile?.id,
    payload?.profile?.phone,
    payload?.user?.id,
    payload?.user?.wid,
    payload?.phone,
    payload?.phoneConnected,
    payload?.number,
    instance?.owner,
    instance?.wid,
    instance?.ownerJid,
    instance?.phone,
    instance?.phoneConnected,
    instance?.number,
    instance?.profileName,
    instance?.me?.id,
    instance?.me?.user,
    statusInfo?.owner,
    statusInfo?.wid,
    statusInfo?.phone,
    payload?.data?.owner,
    payload?.data?.wid,
    payload?.data?.phone,
  )

  const phoneConnected = ownerJidRaw
    ? String(ownerJidRaw).split('@')[0].split(':')[0].replace(/\D/g, '') || null
    : null

  const profileName = pickFirstString(
    payload?.profileName,
    payload?.pushname,
    payload?.name,
    instance?.profileName,
    instance?.pushname,
    instance?.name,
    payload?.profile?.name,
    payload?.profile?.pushname,
  )

  return {
    ...payload,
    connected,
    loggedIn,
    connectionStatus,
    qrCode,
    pairingCode,
    phoneConnected,
    profileName,
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
