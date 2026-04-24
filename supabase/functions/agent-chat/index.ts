import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ============ TOOL DEFINITIONS (Anthropic format) ============
const TOOL_DEFS: Record<string, any> = {
  enviar_botoes: {
    name: 'enviar_botoes',
    description: 'Envia uma mensagem com botões de resposta rápida (até 3 botões) para o cliente no WhatsApp via UAZAPI. Use quando quiser oferecer opções clicáveis ao cliente.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Texto da mensagem antes dos botões' },
        botoes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de rótulos dos botões (1 a 3 itens, máx ~20 caracteres cada)',
          minItems: 1, maxItems: 3,
        },
        rodape: { type: 'string', description: 'Texto opcional do rodapé' },
      },
      required: ['texto', 'botoes'],
    },
  },
  enviar_lista: {
    name: 'enviar_lista',
    description: 'Envia um menu em formato de lista com várias opções organizadas para o cliente escolher (use quando tiver mais de 3 opções).',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Texto introdutório da lista' },
        botao_label: { type: 'string', description: 'Rótulo do botão que abre a lista (ex: "Ver opções")' },
        opcoes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de opções (até 10 itens)',
          minItems: 2, maxItems: 10,
        },
      },
      required: ['texto', 'opcoes'],
    },
  },
  enviar_imagem: {
    name: 'enviar_imagem',
    description: 'Envia uma imagem com legenda opcional para o cliente.',
    input_schema: {
      type: 'object',
      properties: {
        url_imagem: { type: 'string', description: 'URL pública da imagem (https://)' },
        legenda: { type: 'string', description: 'Texto/legenda opcional' },
      },
      required: ['url_imagem'],
    },
  },
  enviar_link: {
    name: 'enviar_link',
    description: 'Envia uma mensagem de texto contendo um link/URL para o cliente.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Texto da mensagem (deve incluir o link no corpo)' },
      },
      required: ['texto'],
    },
  },
  transferir_humano: {
    name: 'transferir_humano',
    description: 'Marca esta conversa como aguardando atendimento humano. O agente para de responder automaticamente e a conversa fica sinalizada para a equipe assumir.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Motivo curto da transferência' },
      },
      required: ['motivo'],
    },
  },
  buscar_faq: {
    name: 'buscar_faq',
    description: 'Pesquisa na base de conhecimento (FAQs e documentos) por uma palavra-chave ou tema. Retorna trechos relevantes para responder o cliente com precisão.',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Palavra-chave ou tema a pesquisar' },
      },
      required: ['termo'],
    },
  },
  gerar_pix: {
    name: 'gerar_pix',
    description: 'Gera uma cobrança PIX no gateway de pagamento e envia o código copia-e-cola para o cliente. Use quando o cliente quiser pagar.',
    input_schema: {
      type: 'object',
      properties: {
        valor: { type: 'number', description: 'Valor da cobrança em reais (ex: 49.90)' },
        descricao: { type: 'string', description: 'Descrição/produto da cobrança' },
        nome_cliente: { type: 'string', description: 'Nome do cliente (opcional)' },
      },
      required: ['valor', 'descricao'],
    },
  },
  // ============ GATEWAY (ZapLynxPay) ============
  gateway_consultar_saldo: {
    name: 'gateway_consultar_saldo',
    description: 'Consulta o saldo atual do gateway de pagamento (ZapLynxPay) do usuário, somando vendas pagas e descontando saques.',
    input_schema: { type: 'object', properties: {} },
  },
  gateway_listar_vendas: {
    name: 'gateway_listar_vendas',
    description: 'Lista as últimas vendas/transações do gateway de pagamento. Pode filtrar por status (paid, pending, refused, refunded).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtro opcional: paid, pending, refused, refunded' },
        limite: { type: 'number', description: 'Quantidade máxima a retornar (padrão 10, máx 50)' },
      },
    },
  },
  gateway_listar_produtos: {
    name: 'gateway_listar_produtos',
    description: 'Lista os produtos cadastrados no gateway de pagamento, com preço e link de checkout.',
    input_schema: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Quantidade máxima (padrão 10)' },
      },
    },
  },
  gateway_buscar_plano_checkout: {
    name: 'gateway_buscar_plano_checkout',
    description: 'Busca um plano/produto específico do gateway e retorna seus dados junto com um link direto de checkout. Use quando o cliente quiser assinar, pagar um plano específico ou receber um botão/link de pagamento.',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Nome, apelido ou termo relacionado ao plano/produto procurado' },
      },
      required: ['termo'],
    },
  },
  // ============ INSTAGRAM ============
  instagram_responder_comentario: {
    name: 'instagram_responder_comentario',
    description: 'Responde publicamente a um comentário no Instagram. Informe o ID do comentário e a mensagem de resposta.',
    input_schema: {
      type: 'object',
      properties: {
        comment_id: { type: 'string', description: 'ID do comentário do Instagram' },
        mensagem: { type: 'string', description: 'Texto da resposta pública' },
      },
      required: ['comment_id', 'mensagem'],
    },
  },
  instagram_enviar_dm: {
    name: 'instagram_enviar_dm',
    description: 'Envia uma mensagem direta (DM) no Instagram para um usuário, opcionalmente em resposta a um comentário (private reply).',
    input_schema: {
      type: 'object',
      properties: {
        ig_user_id: { type: 'string', description: 'ID do destinatário no Instagram (use isto OU comment_id)' },
        comment_id: { type: 'string', description: 'ID de um comentário para enviar private reply (use isto OU ig_user_id)' },
        mensagem: { type: 'string', description: 'Texto da DM' },
      },
      required: ['mensagem'],
    },
  },
  instagram_listar_comentarios: {
    name: 'instagram_listar_comentarios',
    description: 'Lista os comentários recebidos recentemente no Instagram (eventos capturados pelo webhook), com ID, autor e texto.',
    input_schema: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Quantidade máxima (padrão 10, máx 50)' },
      },
    },
  },
  // ============ META WHATSAPP CLOUD API ============
  meta_enviar_texto: {
    name: 'meta_enviar_texto',
    description: 'Envia uma mensagem de texto pelo WhatsApp via API oficial da Meta (Cloud API). Use quando o usuário tem instância Meta configurada.',
    input_schema: {
      type: 'object',
      properties: {
        para: { type: 'string', description: 'Número do destinatário com DDI (ex: 5511999999999)' },
        mensagem: { type: 'string', description: 'Texto a enviar' },
      },
      required: ['para', 'mensagem'],
    },
  },
  meta_enviar_template: {
    name: 'meta_enviar_template',
    description: 'Envia um template aprovado pelo WhatsApp via Meta Cloud API (necessário para iniciar conversas fora da janela de 24h).',
    input_schema: {
      type: 'object',
      properties: {
        para: { type: 'string', description: 'Número do destinatário com DDI' },
        nome_template: { type: 'string', description: 'Nome do template aprovado na Meta' },
        idioma: { type: 'string', description: 'Código do idioma (ex: pt_BR). Padrão: pt_BR' },
        variaveis: { type: 'array', items: { type: 'string' }, description: 'Variáveis do template, em ordem' },
      },
      required: ['para', 'nome_template'],
    },
  },
}

// ============ UAZAPI HELPERS ============
async function getUserUazapiCreds(supabase: any, userId: string): Promise<{ apiUrl: string; apiToken: string } | null> {
  const { data: instance } = await supabase
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, api_provider, is_default, is_active')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('is_active', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (instance && (instance.api_provider || '').toLowerCase() === 'uazapi') {
    return { apiUrl: String(instance.zapi_instance_id).replace(/\/+$/, ''), apiToken: instance.zapi_token || '' }
  }
  return null
}

async function uazapiSend(apiUrl: string, apiToken: string, endpoint: string, body: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: apiToken },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let data: any = {}
    try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.substring(0, 200)}` }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro de rede' }
  }
}

// ============ META HELPERS ============
const META_API_VERSION = 'v21.0'
async function getMetaCreds(supabase: any, userId: string): Promise<{ access_token: string; phone_number_id: string } | null> {
  const { data } = await supabase
    .from('meta_credentials')
    .select('access_token, phone_number_id, connected')
    .eq('user_id', userId)
    .eq('connected', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.access_token || !data?.phone_number_id) return null
  return { access_token: data.access_token, phone_number_id: data.phone_number_id }
}

async function getInstagramToken(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('meta_credentials')
    .select('access_token, connected')
    .eq('user_id', userId)
    .eq('connected', true)
    .order('updated_at', { ascending: false })
    .limit(5)
  return (data || []).find((c: any) => c.access_token)?.access_token || null
}

// ============ TOOL EXECUTOR ============
async function executeTool(
  toolName: string,
  input: any,
  ctx: { supabase: any; userId: string; phone: string | null; testMode: boolean }
): Promise<string> {
  const { supabase, userId, phone, testMode } = ctx

  // Se for testMode (chat de teste sem destino real), simula
  if (testMode && ['enviar_botoes', 'enviar_lista', 'enviar_imagem', 'enviar_link', 'gerar_pix'].includes(toolName)) {
    return JSON.stringify({
      simulated: true,
      tool: toolName,
      input,
      info: 'Modo de teste: a ação foi simulada. Em produção (WhatsApp real) seria executada de verdade.',
    })
  }

  switch (toolName) {
    case 'enviar_botoes': {
      const creds = await getUserUazapiCreds(supabase, userId)
      if (!creds) return JSON.stringify({ error: 'Nenhuma instância UAZAPI configurada.' })
      if (!phone) return JSON.stringify({ error: 'Sem número de destino.' })
      const r = await uazapiSend(creds.apiUrl, creds.apiToken, '/send/menu', {
        number: phone,
        type: 'button',
        text: input.texto || 'Selecione uma opção:',
        ...(input.rodape ? { footerText: input.rodape } : {}),
        choices: (input.botoes || []).slice(0, 3).map((b: any) => String(b)),
      })
      return JSON.stringify(r)
    }
    case 'enviar_lista': {
      const creds = await getUserUazapiCreds(supabase, userId)
      if (!creds) return JSON.stringify({ error: 'Nenhuma instância UAZAPI configurada.' })
      if (!phone) return JSON.stringify({ error: 'Sem número de destino.' })
      const r = await uazapiSend(creds.apiUrl, creds.apiToken, '/send/menu', {
        number: phone,
        type: 'list',
        text: input.texto || 'Selecione uma opção:',
        ...(input.botao_label ? { buttonText: input.botao_label } : {}),
        choices: (input.opcoes || []).slice(0, 10).map((b: any) => String(b)),
      })
      return JSON.stringify(r)
    }
    case 'enviar_imagem': {
      const creds = await getUserUazapiCreds(supabase, userId)
      if (!creds) return JSON.stringify({ error: 'Nenhuma instância UAZAPI configurada.' })
      if (!phone) return JSON.stringify({ error: 'Sem número de destino.' })
      const r = await uazapiSend(creds.apiUrl, creds.apiToken, '/send/media', {
        number: phone,
        type: 'image',
        file: input.url_imagem,
        ...(input.legenda ? { text: input.legenda } : {}),
      })
      return JSON.stringify(r)
    }
    case 'enviar_link': {
      const creds = await getUserUazapiCreds(supabase, userId)
      if (!creds) return JSON.stringify({ error: 'Nenhuma instância UAZAPI configurada.' })
      if (!phone) return JSON.stringify({ error: 'Sem número de destino.' })
      const r = await uazapiSend(creds.apiUrl, creds.apiToken, '/send/text', {
        number: phone, text: input.texto || '',
      })
      return JSON.stringify(r)
    }
    case 'transferir_humano': {
      // Marca em uma tabela simples (ou só loga). Vamos inserir em message_logs como sinalizador.
      try {
        await supabase.from('agent_handoff').insert({
          user_id: userId,
          phone: phone || 'test',
          reason: input.motivo || '',
        }).then(() => null).catch(() => null)
      } catch {}
      return JSON.stringify({ ok: true, message: 'Conversa marcada para atendimento humano. O agente não responderá mais automaticamente nesta conversa.' })
    }
    case 'buscar_faq': {
      const term = String(input.termo || '').toLowerCase().trim()
      if (!term) return JSON.stringify({ results: [] })
      const { data: items } = await supabase
        .from('agent_knowledge')
        .select('type, question, answer, title, content')
        .eq('user_id', userId)
        .eq('active', true)
      const results = (items || [])
        .map((it: any) => {
          const hay = `${it.question || ''} ${it.answer || ''} ${it.title || ''} ${it.content || ''}`.toLowerCase()
          const score = hay.includes(term) ? 1 : 0
          return { ...it, score }
        })
        .filter((x: any) => x.score > 0)
        .slice(0, 5)
      return JSON.stringify({ results })
    }
    case 'gerar_pix': {
      try {
        const { data, error } = await supabase.functions.invoke('create-pix-copy-and-paste', {
          body: { amount: input.valor, description: input.descricao, customerName: input.nome_cliente },
        })
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ ok: true, pix: data })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha ao gerar PIX' })
      }
    }
    // ============ GATEWAY ============
    case 'gateway_consultar_saldo': {
      try {
        const { data: txs } = await supabase
          .from('gateway_transactions')
          .select('net, status')
          .eq('user_id', userId)
          .eq('status', 'paid')
        const { data: wds } = await supabase
          .from('gateway_withdrawals')
          .select('amount, status')
          .eq('user_id', userId)
          .in('status', ['pending', 'approved', 'processing', 'completed'])
        const totalRecebido = (txs || []).reduce((s: number, t: any) => s + (t.net || 0), 0)
        const totalSaques = (wds || []).reduce((s: number, w: any) => s + (w.amount || 0), 0)
        const saldo = totalRecebido - totalSaques
        return JSON.stringify({
          saldo_disponivel_reais: (saldo / 100).toFixed(2),
          total_recebido_reais: (totalRecebido / 100).toFixed(2),
          total_saques_reais: (totalSaques / 100).toFixed(2),
        })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha ao consultar saldo' })
      }
    }
    case 'gateway_listar_vendas': {
      try {
        const limite = Math.min(Number(input.limite) || 10, 50)
        let q = supabase
          .from('gateway_transactions')
          .select('id, customer_name, customer_email, amount, net, status, payment_method, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limite)
        if (input.status) q = q.eq('status', String(input.status))
        const { data } = await q
        const vendas = (data || []).map((t: any) => ({
          ...t,
          valor_reais: (t.amount / 100).toFixed(2),
          liquido_reais: (t.net / 100).toFixed(2),
        }))
        return JSON.stringify({ total: vendas.length, vendas })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha ao listar vendas' })
      }
    }
    case 'gateway_listar_produtos': {
      try {
        const limite = Math.min(Number(input.limite) || 10, 50)
        const { data } = await supabase
          .from('gateway_products')
          .select('id, name, description, price, type, status, sku')
          .eq('user_id', userId)
          .eq('status', true)
          .order('created_at', { ascending: false })
          .limit(limite)
        const produtos = (data || []).map((p: any) => ({
          ...p,
          preco_reais: (p.price / 100).toFixed(2),
        }))
        return JSON.stringify({ total: produtos.length, produtos })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha ao listar produtos' })
      }
    }
    case 'gateway_buscar_plano_checkout': {
      try {
        const termo = String(input.termo || '').trim().toLowerCase()
        if (!termo) return JSON.stringify({ error: 'Informe o plano desejado.' })

        const { data: products } = await supabase
          .from('gateway_products')
          .select('id, name, description, price, type, status, sku, created_at')
          .eq('user_id', userId)
          .eq('status', true)
          .order('created_at', { ascending: false })
          .limit(50)

        const normalized = (value: any) => String(value || '').toLowerCase()
        const scored = (products || []).map((p: any) => {
          const hay = `${normalized(p.name)} ${normalized(p.description)} ${normalized(p.sku)}`
          let score = 0
          if (hay.includes(termo)) score += 10
          const termoTokens = termo.split(/\s+/).filter(Boolean)
          for (const token of termoTokens) {
            if (hay.includes(token)) score += 2
          }
          return { ...p, score }
        }).filter((p: any) => p.score > 0)

        const best = scored.sort((a: any, b: any) => b.score - a.score)[0]
        if (!best) return JSON.stringify({ error: 'Nenhum plano encontrado com esse termo.' })

        const { data: checkout } = await supabase
          .from('gateway_checkouts')
          .select('id, name, slug, status, product_id')
          .eq('user_id', userId)
          .eq('status', true)
          .eq('product_id', best.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const checkoutUrl = checkout?.slug
          ? `https://pay.zaplynxpro.online/checkout/${checkout.slug}`
          : null

        return JSON.stringify({
          found: true,
          plano: {
            id: best.id,
            nome: best.name,
            descricao: best.description,
            preco_reais: (best.price / 100).toFixed(2),
            tipo: best.type,
          },
          checkout: checkout ? {
            id: checkout.id,
            nome: checkout.name,
            slug: checkout.slug,
            url: checkoutUrl,
          } : null,
          cta: checkoutUrl ? {
            label: `Pagar ${best.name}`,
            url: checkoutUrl,
          } : null,
        })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha ao buscar plano e checkout' })
      }
    }
    // ============ INSTAGRAM ============
    case 'instagram_responder_comentario': {
      const token = await getInstagramToken(supabase, userId)
      if (!token) return JSON.stringify({ error: 'Nenhuma credencial Meta/Instagram conectada.' })
      if (testMode) return JSON.stringify({ simulated: true, info: 'Resposta a comentário simulada (modo teste).', input })
      try {
        const r = await fetch(`https://graph.instagram.com/${META_API_VERSION}/${input.comment_id}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input.mensagem, access_token: token }),
        })
        const text = await r.text()
        if (!r.ok) return JSON.stringify({ error: `HTTP ${r.status}: ${text.substring(0, 200)}` })
        return JSON.stringify({ ok: true, response: text.substring(0, 300) })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha ao responder comentário' })
      }
    }
    case 'instagram_enviar_dm': {
      const token = await getInstagramToken(supabase, userId)
      if (!token) return JSON.stringify({ error: 'Nenhuma credencial Meta/Instagram conectada.' })
      if (!input.ig_user_id && !input.comment_id) return JSON.stringify({ error: 'Informe ig_user_id ou comment_id.' })
      if (testMode) return JSON.stringify({ simulated: true, info: 'DM Instagram simulada (modo teste).', input })
      try {
        const recipient = input.comment_id ? { comment_id: input.comment_id } : { id: input.ig_user_id }
        const r = await fetch(`https://graph.instagram.com/${META_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient, message: { text: input.mensagem } }),
        })
        const text = await r.text()
        if (!r.ok) return JSON.stringify({ error: `HTTP ${r.status}: ${text.substring(0, 200)}` })
        return JSON.stringify({ ok: true, response: text.substring(0, 300) })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha ao enviar DM' })
      }
    }
    case 'instagram_listar_comentarios': {
      try {
        const limite = Math.min(Number(input.limite) || 10, 50)
        const { data } = await supabase
          .from('instagram_events')
          .select('id, username, comment_text, media_id, created_at, payload')
          .eq('user_id', userId)
          .eq('event_type', 'comment')
          .order('created_at', { ascending: false })
          .limit(limite)
        const comentarios = (data || []).map((c: any) => ({
          comment_id: c.payload?.id || c.id,
          autor: c.username,
          texto: c.comment_text,
          media_id: c.media_id,
          quando: c.created_at,
        }))
        return JSON.stringify({ total: comentarios.length, comentarios })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha ao listar comentários' })
      }
    }
    // ============ META WHATSAPP CLOUD API ============
    case 'meta_enviar_texto': {
      const creds = await getMetaCreds(supabase, userId)
      if (!creds) return JSON.stringify({ error: 'Nenhuma credencial Meta/WhatsApp Cloud conectada.' })
      if (testMode) return JSON.stringify({ simulated: true, info: 'Envio Meta WhatsApp simulado (modo teste).', input })
      try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${creds.phone_number_id}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: String(input.para).replace(/\D/g, ''),
            type: 'text',
            text: { body: input.mensagem },
          }),
        })
        const text = await r.text()
        if (!r.ok) return JSON.stringify({ error: `HTTP ${r.status}: ${text.substring(0, 200)}` })
        return JSON.stringify({ ok: true, response: text.substring(0, 300) })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha no envio Meta' })
      }
    }
    case 'meta_enviar_template': {
      const creds = await getMetaCreds(supabase, userId)
      if (!creds) return JSON.stringify({ error: 'Nenhuma credencial Meta/WhatsApp Cloud conectada.' })
      if (testMode) return JSON.stringify({ simulated: true, info: 'Envio template Meta simulado (modo teste).', input })
      try {
        const components = (input.variaveis && input.variaveis.length > 0) ? [{
          type: 'body',
          parameters: input.variaveis.map((v: any) => ({ type: 'text', text: String(v) })),
        }] : []
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${creds.phone_number_id}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: String(input.para).replace(/\D/g, ''),
            type: 'template',
            template: {
              name: input.nome_template,
              language: { code: input.idioma || 'pt_BR' },
              components,
            },
          }),
        })
        const text = await r.text()
        if (!r.ok) return JSON.stringify({ error: `HTTP ${r.status}: ${text.substring(0, 200)}` })
        return JSON.stringify({ ok: true, response: text.substring(0, 300) })
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'Falha no envio template Meta' })
      }
    }
    default:
      return JSON.stringify({ error: `Ferramenta desconhecida: ${toolName}` })
  }
}

// ============ MAIN ============
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    const body = await req.json()
    const { messages, user_id, skip_config, phone } = body
    const effectiveUserId = user_id || userId
    if (!effectiveUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const query = supabase.from('agent_config').select('*').eq('user_id', effectiveUserId)
    if (!skip_config) query.eq('active', true)
    const { data: agentConfig } = await query.maybeSingle()

    if (!agentConfig && !skip_config) {
      return new Response(JSON.stringify({ error: 'Agente não configurado ou desativado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: knowledge } = await supabase
      .from('agent_knowledge')
      .select('type, question, answer, content, title')
      .eq('user_id', effectiveUserId)
      .eq('active', true)
      .order('created_at', { ascending: true })

    const effectiveAgentName = agentConfig?.agent_name || 'Assistente'
    let systemPrompt = agentConfig?.system_prompt || 'Você é um assistente virtual prestativo.'
    systemPrompt += '\n\n--- REGRAS ---'
    systemPrompt += '\n- Responda sempre de forma educada e objetiva.'
    systemPrompt += '\n- Use a base de conhecimento abaixo para responder.'
    systemPrompt += '\n- Se não souber a resposta, use a ferramenta transferir_humano.'
    systemPrompt += `\n- Nome do agente: ${effectiveAgentName}`

    if (knowledge && knowledge.length > 0) {
      systemPrompt += '\n\n--- BASE DE CONHECIMENTO ---'
      for (const item of knowledge) {
        if (item.type === 'faq') systemPrompt += `\n\nPergunta: ${item.question}\nResposta: ${item.answer}`
        else if (item.type === 'document') systemPrompt += `\n\nDocumento "${item.title || 'Sem título'}":\n${item.content}`
      }
    }

    const provider = (agentConfig?.provider || 'lovable') as 'lovable' | 'anthropic'

    // ============ PROVIDER: LOVABLE (sem tools, fluxo antigo) ============
    if (provider !== 'anthropic') {
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const model = agentConfig?.model || 'google/gemini-3-flash-preview'
      const aiMessages = [{ role: 'system', content: systemPrompt }, ...(messages || [])]
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: aiMessages, stream: false }),
      })
      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit excedido.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        if (response.status === 402) return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        const errText = await response.text()
        console.error('AI Gateway error:', response.status, errText)
        return new Response(JSON.stringify({ error: 'Erro no AI Gateway' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.'
      return new Response(JSON.stringify({ reply }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ============ PROVIDER: ANTHROPIC (com tool use loop) ============
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Carregar ferramentas habilitadas (skip se análise sem config)
    let enabledTools: any[] = []
    if (!skip_config) {
      const { data: toolsCfg, error: toolsCfgError } = await supabase
        .from('agent_tools_config')
        .select('tool_name, enabled')
        .eq('user_id', effectiveUserId)
        .eq('enabled', true)
      if (toolsCfgError) {
        const toolsErrorMessage = String(toolsCfgError.message || '').toLowerCase()
        const missingToolsTable = toolsErrorMessage.includes('agent_tools_config') && (
          toolsErrorMessage.includes('could not find the table') ||
          toolsErrorMessage.includes('does not exist')
        )
        if (!missingToolsTable) {
          console.error('Erro ao carregar agent_tools_config:', toolsCfgError)
        }
      }
      enabledTools = (toolsCfg || [])
        .map((t: any) => TOOL_DEFS[t.tool_name])
        .filter(Boolean)
    }

    const testMode = !phone // chat de teste = sem destino real
    const model = agentConfig?.model || 'claude-sonnet-4-5-20250929'

    // Mensagens só user/assistant (system vai à parte na API Anthropic)
    let convMessages: any[] = (messages || [])
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({ role: m.role, content: m.content }))

    let finalText = ''
    let iterations = 0
    const MAX_ITER = 6

    while (iterations < MAX_ITER) {
      iterations++

      const reqBody: any = {
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: convMessages,
      }
      if (enabledTools.length > 0) reqBody.tools = enabledTools

      const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      })
      if (!anthropicResp.ok) {
        const errText = await anthropicResp.text()
        console.error('Anthropic error:', anthropicResp.status, errText)
        if (anthropicResp.status === 401) return new Response(JSON.stringify({ error: 'Chave Anthropic inválida.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        if (anthropicResp.status === 429) return new Response(JSON.stringify({ error: 'Rate limit Anthropic excedido.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        return new Response(JSON.stringify({ error: 'Erro Anthropic: ' + errText.substring(0, 200) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const data = await anthropicResp.json()
      const stopReason = data.stop_reason
      const contentBlocks: any[] = data.content || []

      // Coletar texto
      const textBlocks = contentBlocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      if (textBlocks) finalText = (finalText ? finalText + '\n' : '') + textBlocks

      // Se não pediu tool, terminamos
      if (stopReason !== 'tool_use') break

      const toolUses = contentBlocks.filter((b: any) => b.type === 'tool_use')
      if (toolUses.length === 0) break

      // Adiciona resposta do assistant ao histórico
      convMessages.push({ role: 'assistant', content: contentBlocks })

      // Executa cada tool e adiciona tool_result
      const toolResults: any[] = []
      for (const tu of toolUses) {
        console.log(`🔧 Tool call: ${tu.name}`, JSON.stringify(tu.input).substring(0, 200))
        const result = await executeTool(tu.name, tu.input || {}, {
          supabase, userId: effectiveUserId, phone: phone || null, testMode,
        })
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
      }
      convMessages.push({ role: 'user', content: toolResults })
    }

    return new Response(JSON.stringify({ reply: finalText || 'Sem resposta.' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('agent-chat error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
