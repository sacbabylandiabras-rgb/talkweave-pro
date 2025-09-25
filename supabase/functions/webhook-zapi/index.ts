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
  instanceId?: string
  timestamp: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Webhook recebido - URL:', req.url)
    console.log('Webhook recebido - Method:', req.method)
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const webhook = await req.json() as WebhookMessage
    console.log('Webhook data:', JSON.stringify(webhook, null, 2))
    
    // Ignora mensagens enviadas por nós
    if (webhook.message.fromMe) {
      console.log('Mensagem enviada por nós - ignorando')
      return new Response('ignored', { status: 200, headers: corsHeaders })
    }

    const messageText = webhook.message.text?.toLowerCase() || ''
    const phone = webhook.phone
    
    console.log('Processando mensagem:', messageText, 'do telefone:', phone)
    
    // Verifica se o sistema está ativo
    const { data: config, error: configError } = await supabase
      .from('auto_response_config')
      .select('active')
      .single()
    
    if (configError) {
      console.error('Erro ao buscar config:', configError)
      return new Response('config_error', { status: 500, headers: corsHeaders })
    }
    
    if (!config?.active) {
      console.log('Sistema desativado')
      return new Response('system_disabled', { status: 200, headers: corsHeaders })
    }

    // Busca respostas automáticas ativas
    const { data: responses, error: responsesError } = await supabase
      .from('auto_responses')
      .select('*')
      .eq('active', true)
    
    if (responsesError) {
      console.error('Erro ao buscar respostas:', responsesError)
      return new Response('responses_error', { status: 500, headers: corsHeaders })
    }
    
    if (!responses || responses.length === 0) {
      console.log('Nenhuma resposta ativa encontrada')
      return new Response('no_responses', { status: 200, headers: corsHeaders })
    }

    console.log('Respostas ativas encontradas:', responses.length)

    // Procura por palavra-chave correspondente
    const matchedResponse = responses.find(response => 
      messageText.includes(response.keyword.toLowerCase())
    )

    if (matchedResponse) {
      console.log('Palavra-chave encontrada:', matchedResponse.keyword)
      
      // Log da mensagem recebida
      const { error: logError } = await supabase
        .from('message_logs')
        .insert({
          phone,
          message_received: webhook.message.text,
          keyword_matched: matchedResponse.keyword,
          response_sent: matchedResponse.response,
          timestamp: new Date().toISOString()
        })
      
      if (logError) {
        console.error('Erro ao salvar log:', logError)
      }

      // Obter instanceId dos secrets ou tentar extrair do webhook
      const instanceId = webhook.instanceId || Deno.env.get('ZAPI_INSTANCE_ID')
      const zapiToken = Deno.env.get('ZAPI_TOKEN')
      const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')
      
      if (!instanceId || !zapiToken) {
        console.error('Credenciais Z-API não configuradas')
        return new Response('missing_credentials', { status: 500, headers: corsHeaders })
      }

      console.log('Enviando resposta via Z-API para:', phone)
      
      // Envia resposta automática via Z-API
      const zapiResponse = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken || ''
        },
        body: JSON.stringify({
          phone,
          message: matchedResponse.response
        })
      })

      const zapiResult = await zapiResponse.text()
      console.log('Resposta Z-API status:', zapiResponse.status)
      console.log('Resposta Z-API body:', zapiResult)

      if (zapiResponse.ok) {
        console.log('Resposta enviada com sucesso')
        return new Response('response_sent', { status: 200, headers: corsHeaders })
      } else {
        console.error('Erro ao enviar resposta Z-API:', zapiResult)
        return new Response('send_error', { status: 500, headers: corsHeaders })
      }
    } else {
      console.log('Nenhuma palavra-chave correspondente encontrada')
    }

    return new Response('no_match', { status: 200, headers: corsHeaders })
    
  } catch (error) {
    console.error('Erro no webhook:', error)
    return new Response('error', { status: 500, headers: corsHeaders })
  }
})