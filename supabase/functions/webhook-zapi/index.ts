import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface WebhookMessage {
  phone: string
  message: {
    text?: string
    fromMe: boolean
  }
  instanceId: string
  timestamp: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const webhook = await req.json() as WebhookMessage
    
    // Ignora mensagens enviadas por nós
    if (webhook.message.fromMe) {
      return new Response('ignored', { status: 200, headers: corsHeaders })
    }

    const messageText = webhook.message.text?.toLowerCase() || ''
    const phone = webhook.phone
    
    // Verifica se o sistema está ativo
    const { data: config } = await supabase
      .from('auto_response_config')
      .select('active')
      .single()
    
    if (!config?.active) {
      return new Response('system_disabled', { status: 200, headers: corsHeaders })
    }

    // Busca respostas automáticas ativas
    const { data: responses } = await supabase
      .from('auto_responses')
      .select('*')
      .eq('active', true)
    
    if (!responses || responses.length === 0) {
      return new Response('no_responses', { status: 200, headers: corsHeaders })
    }

    // Procura por palavra-chave correspondente
    const matchedResponse = responses.find(response => 
      messageText.includes(response.keyword.toLowerCase())
    )

    if (matchedResponse) {
      // Log da mensagem recebida
      await supabase
        .from('message_logs')
        .insert({
          phone,
          message_received: webhook.message.text,
          keyword_matched: matchedResponse.keyword,
          response_sent: matchedResponse.response,
          timestamp: new Date().toISOString()
        })

      // Envia resposta automática via Z-API
      const zapiResponse = await fetch(`https://api.z-api.io/instances/${webhook.instanceId}/token/${Deno.env.get('ZAPI_TOKEN')}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': Deno.env.get('ZAPI_CLIENT_TOKEN') || ''
        },
        body: JSON.stringify({
          phone,
          message: matchedResponse.response
        })
      })

      if (zapiResponse.ok) {
        return new Response('response_sent', { status: 200, headers: corsHeaders })
      } else {
        console.error('Erro ao enviar resposta:', await zapiResponse.text())
        return new Response('send_error', { status: 500, headers: corsHeaders })
      }
    }

    return new Response('no_match', { status: 200, headers: corsHeaders })
    
  } catch (error) {
    console.error('Erro no webhook:', error)
    return new Response('error', { status: 500, headers: corsHeaders })
  }
})