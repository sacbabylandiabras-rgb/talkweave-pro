import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CARTWAVE_AUTH_URL = 'https://api.cartwavehub.com.br/v2/finance/auth-token/'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const clientId = Deno.env.get('CARTWAVE_CLIENT_ID') || ''
  const clientSecret = Deno.env.get('CARTWAVE_CLIENT_SECRET') || ''

  const body = JSON.stringify({ client_id: clientId, client_secret: clientSecret })
  const headers: Record<string, string> = {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'ZapLynxPay/1.0',
  }

  // Log curl
  const curlHeaders = Object.entries(headers).map(([k, v]) => `-H '${k}: ${v}'`).join(' ')
  const curlCmd = `curl -X POST '${CARTWAVE_AUTH_URL}' ${curlHeaders} -d '${body}'`
  console.log(`[CURL] ${curlCmd}`)

  const response = await fetch(CARTWAVE_AUTH_URL, {
    method: 'POST',
    headers,
    body,
  })

  const respHeaders = Object.fromEntries(response.headers.entries())
  const requestId = respHeaders['x-amzn-requestid']
    || respHeaders['x-amz-cf-id']
    || respHeaders['x-request-id']
    || respHeaders['x-amzn-trace-id']
    || 'N/A'

  const rawText = await response.text()

  console.log(`[RESULT] status=${response.status} request-id=${requestId}`)
  console.log(`[HEADERS] ${JSON.stringify(respHeaders)}`)
  console.log(`[BODY] ${rawText.slice(0, 1000)}`)

  return new Response(JSON.stringify({
    curl: curlCmd,
    status: response.status,
    request_id: requestId,
    response_headers: respHeaders,
    response_body: rawText.slice(0, 2000),
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
