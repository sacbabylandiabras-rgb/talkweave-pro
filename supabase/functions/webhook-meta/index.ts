import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const VERIFY_TOKEN = "zaplynx_whatsapp_verify_2024"
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)

  // ─── GET: Meta webhook verification ───
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    console.log('[webhook-meta] Verification request:', { mode, token, challenge })

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[webhook-meta] ✅ Verification successful')
      return new Response(challenge || '', { status: 200 })
    }

    console.log('[webhook-meta] ❌ Verification failed - token mismatch')
    return new Response('Forbidden', { status: 403 })
  }

  // ─── POST: Incoming webhook events ───
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      console.log('[webhook-meta] Received event:', JSON.stringify(body).slice(0, 500))

      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      // Process each entry from Meta
      const entries = body?.entry || []
      for (const entry of entries) {
        const changes = entry?.changes || []
        for (const change of changes) {
          const field = change?.field
          const value = change?.value

          // WhatsApp messages
          if (field === 'messages') {
            const messages = value?.messages || []
            const contacts = value?.contacts || []
            const phoneNumberId = value?.metadata?.phone_number_id

            if (!phoneNumberId) continue

            // Find user by phone_number_id
            const { data: cred } = await supabase
              .from('meta_credentials')
              .select('user_id')
              .eq('phone_number_id', phoneNumberId)
              .maybeSingle()

            if (!cred) {
              console.log('[webhook-meta] No user found for phone_number_id:', phoneNumberId)
              continue
            }

            const userId = cred.user_id

            for (const msg of messages) {
              const fromPhone = msg?.from || ''
              const msgText = msg?.text?.body || msg?.button?.text || ''
              const contactName = contacts?.find((c: any) => c?.wa_id === fromPhone)?.profile?.name || ''

              console.log(`[webhook-meta] Message from ${fromPhone}: ${msgText.slice(0, 100)}`)

              // Log the received message
              await supabase.from('message_logs').insert({
                user_id: userId,
                phone: fromPhone,
                message_received: msgText,
                keyword_matched: null,
                response_sent: null,
                instance_id: `meta:${phoneNumberId}`,
              })

              // ── Auto-response: check keywords ──
              const { data: autoResponses } = await supabase
                .from('auto_responses')
                .select('*')
                .eq('user_id', userId)
                .eq('active', true)

              if (autoResponses && msgText) {
                const normalizedMsg = msgText.toLowerCase().trim()
                for (const ar of autoResponses) {
                  if (normalizedMsg.includes(ar.keyword.toLowerCase().trim())) {
                    // Send response via Meta Cloud API
                    const { data: fullCred } = await supabase
                      .from('meta_credentials')
                      .select('access_token, phone_number_id')
                      .eq('user_id', userId)
                      .maybeSingle()

                    if (fullCred?.access_token && fullCred?.phone_number_id) {
                      const sendRes = await fetch(
                        `https://graph.facebook.com/v21.0/${fullCred.phone_number_id}/messages`,
                        {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${fullCred.access_token}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            messaging_product: 'whatsapp',
                            to: fromPhone,
                            type: 'text',
                            text: { body: ar.response },
                          }),
                        }
                      )

                      const sendResult = await sendRes.json()
                      console.log(`[webhook-meta] Auto-response sent for keyword "${ar.keyword}":`, sendResult)

                      // Update log with response
                      await supabase.from('message_logs').insert({
                        user_id: userId,
                        phone: fromPhone,
                        message_received: msgText,
                        keyword_matched: ar.keyword,
                        response_sent: ar.response,
                        instance_id: `meta:${phoneNumberId}`,
                      })
                    }
                    break // Only first match
                  }
                }
              }
            }
          }

          // Status updates (delivered, read, etc.)
          if (field === 'messages' && value?.statuses) {
            for (const status of value.statuses) {
              console.log(`[webhook-meta] Status update: ${status?.id} → ${status?.status}`)
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      console.error('[webhook-meta] Error processing webhook:', err)
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 200, // Meta expects 200 even on errors to avoid retries
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})
