import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0"

serve(async (req) => {
  const url = new URL(req.url)
  const destUrl = url.searchParams.get('url')
  const flowName = url.searchParams.get('flow')
  const btnText = url.searchParams.get('btn')
  const userId = url.searchParams.get('uid')
  const phone = url.searchParams.get('ph') || 'unknown'
  const source = url.searchParams.get('src') || 'wa'

  if (!destUrl) {
    return new Response('Missing url parameter', { status: 400 })
  }

  // Log the click asynchronously - don't block the redirect
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (flowName && btnText && userId) {
      const flowLabel = source === 'ig' ? `[IG-Fluxo: ${flowName}]` : `[Fluxo: ${flowName}]`;
      await supabase.from('message_logs').insert({
        user_id: userId,
        phone,
        message_received: `[URL Click] ${btnText}`,
        keyword_matched: `[Botão: ${btnText}]`,
        response_sent: flowLabel,
        timestamp: new Date().toISOString(),
      })
      console.log(`✅ URL click tracked: flow="${flowName}", btn="${btnText}", phone=${phone}, src=${source}`)
    }
  } catch (e) {
    console.error('Error logging click:', e)
  }

  // 302 redirect to destination
  return new Response(null, {
    status: 302,
    headers: { Location: destUrl },
  })
})
