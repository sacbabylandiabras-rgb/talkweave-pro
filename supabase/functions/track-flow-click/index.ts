import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.58.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const normalizeDestination = (value: string) => value
    .replace(/^https?:\/\/pay\.zaplynxpro\.online\/invite\//i, 'https://go.zaplynxpro.online/invite/')
    .replace(/^https?:\/\/pay\.zaplynxpro\.online\/r\?/i, 'https://go.zaplynxpro.online/r?')
  const rawDestUrl = url.searchParams.get('url')
  const destUrl = rawDestUrl ? normalizeDestination(rawDestUrl) : null
  const logOnly = url.searchParams.get('mode') === 'log'
  const flowName = url.searchParams.get('flow')
  const btnText = url.searchParams.get('btn')
  const userId = url.searchParams.get('uid')
  const phone = url.searchParams.get('ph') || 'unknown'
  const source = url.searchParams.get('src') || 'wa'
  const campaignId = url.searchParams.get('cid')
  const sendId = url.searchParams.get('cs')

  if (!destUrl) {
    return new Response('Missing url parameter', { status: 400, headers: corsHeaders })
  }

  // Capture geo/UA data from request (works directly OR forwarded by Worker via query params)
  const ip = url.searchParams.get('ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') || null
  const country = url.searchParams.get('country') || req.headers.get('cf-ipcountry') || null
  const city = url.searchParams.get('city') || req.headers.get('cf-ipcity') || null
  const region = url.searchParams.get('region') || req.headers.get('cf-region') || null
  const userAgent = url.searchParams.get('ua') || req.headers.get('user-agent') || null
  const referer = url.searchParams.get('ref') || req.headers.get('referer') || null

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

    // Save geo/UA snapshot for approximate identification (esp. group campaigns)
    if (userId || campaignId) {
      try {
        await supabase.from('link_clicks').insert({
          user_id: userId || null,
          campaign_id: campaignId || null,
          send_id: sendId || null,
          phone: phone || null,
          flow_name: flowName || null,
          btn_text: btnText || null,
          ip,
          country,
          city,
          region,
          user_agent: userAgent,
          referer,
          destination_url: destUrl,
        })
      } catch (lerr) {
        console.error('Error inserting link_clicks:', lerr)
      }
    }

    // Mark campaign_send as clicked (for campaign link-click metrics)
    if (campaignId || sendId) {
      const nowIso = new Date().toISOString();
      try {
        if (sendId) {
          await supabase
            .from('campaign_sends')
            .update({ clicked_at: nowIso })
            .eq('id', sendId)
            .is('clicked_at', null);
          console.log(`✅ campaign_send click marked by id=${sendId}`);
        } else if (campaignId && userId) {
          // Fallback: locate by campaign_id + phone
          const cleanPhone = String(phone).replace(/\D/g, '');
          const { data: rows } = await supabase
            .from('campaign_sends')
            .select('id, phone, clicked_at')
            .eq('campaign_id', campaignId)
            .eq('user_id', userId)
            .is('clicked_at', null);
          const match = (rows || []).find((r: any) =>
            String(r.phone).replace(/\D/g, '') === cleanPhone
          );
          if (match) {
            await supabase
              .from('campaign_sends')
              .update({ clicked_at: nowIso })
              .eq('id', match.id);
            console.log(`✅ campaign_send click marked by phone match id=${match.id}`);
          }
        }
      } catch (cerr) {
        console.error('Error marking campaign_send click:', cerr);
      }
    }
  } catch (e) {
    console.error('Error logging click:', e)
  }

  if (logOnly) {
    return new Response(JSON.stringify({ ok: true, url: destUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 302 redirect to destination
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: destUrl },
  })
})
