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
