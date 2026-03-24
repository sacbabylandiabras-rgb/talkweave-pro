import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth user from token
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    const body = await req.json()
    const { messages, user_id, skip_config } = body

    // Allow service-level calls (from webhook-zapi) with user_id directly
    const effectiveUserId = user_id || userId
    if (!effectiveUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch agent config (skip active check for analysis/utility calls)
    const query = supabase
      .from('agent_config')
      .select('*')
      .eq('user_id', effectiveUserId)

    if (!skip_config) {
      query.eq('active', true)
    }

    const { data: agentConfig } = await query.maybeSingle()

    if (!agentConfig && !skip_config) {
      return new Response(JSON.stringify({ error: 'Agente não configurado ou desativado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch knowledge base
    const { data: knowledge } = await supabase
      .from('agent_knowledge')
      .select('type, question, answer, content, title')
      .eq('user_id', effectiveUserId)
      .eq('active', true)
      .order('created_at', { ascending: true })

    // Build system prompt with knowledge
    let systemPrompt = agentConfig.system_prompt || 'Você é um assistente virtual prestativo.'
    systemPrompt += '\n\n--- REGRAS ---'
    systemPrompt += '\n- Responda sempre de forma educada e objetiva.'
    systemPrompt += '\n- Use a base de conhecimento abaixo para responder.'
    systemPrompt += '\n- Se não souber a resposta, diga que vai encaminhar para um atendente humano.'
    systemPrompt += `\n- Nome do agente: ${agentConfig.agent_name || 'Assistente'}`

    if (knowledge && knowledge.length > 0) {
      systemPrompt += '\n\n--- BASE DE CONHECIMENTO ---'
      for (const item of knowledge) {
        if (item.type === 'faq') {
          systemPrompt += `\n\nPergunta: ${item.question}\nResposta: ${item.answer}`
        } else if (item.type === 'document') {
          systemPrompt += `\n\nDocumento "${item.title || 'Sem título'}":\n${item.content}`
        }
      }
    }

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages || []),
    ]

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: aiMessages,
        stream: false,
      }),
    })

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit excedido, tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const errText = await response.text()
      console.error('AI Gateway error:', response.status, errText)
      return new Response(JSON.stringify({ error: 'Erro no AI Gateway' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.'

    return new Response(JSON.stringify({ reply }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('agent-chat error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
