import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const VERIFY_TOKEN = "zaplynx_whatsapp_verify_2024"
const API_VERSION = "v21.0"
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function normalizeForMatch(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isKeywordMatch(message: string, keyword: string): boolean {
  if (!keyword || !message) return false;
  const normalizedKeyword = normalizeForMatch(keyword);
  const normalizedMessage = normalizeForMatch(message);
  if (!normalizedKeyword || !normalizedMessage) return false;
  return normalizedMessage.includes(normalizedKeyword);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const payload = await req.json()
    console.log('[webhook-gateway-v2] Received event:', JSON.stringify(payload).slice(0, 500))

    // Detect user_id from query params or payload
    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id') || payload?.user_id

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400, headers: corsHeaders })
    }

    // Find active gateway flows
    const { data: flows } = await supabase
      .from('flow_automations')
      .select('*')
      .eq('user_id', userId)
      .eq('category', 'gateway')
      .eq('active', true)

    if (flows && flows.length > 0) {
      // In Gateway v2, we trigger by event_type or generic keyword
      const eventType = payload?.event_type || payload?.status || 'default'
      
      for (const flow of flows) {
        if (isKeywordMatch(eventType, flow.keyword)) {
           console.log(`[webhook-gateway-v2] Flow matched: ${flow.name}`)
           // Trigger logic here... (send-message or process flow)
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (err) {
    console.error('[webhook-gateway-v2] Error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders })
  }
})
