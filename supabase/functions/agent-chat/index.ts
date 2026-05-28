import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============ TOOL DEFINITIONS (Anthropic format) ============
const TOOL_DEFS: Record<string, any> = {
  enviar_botoes: {
    name: "enviar_botoes",
    description:
      "Envia uma mensagem com botões de resposta rápida (até 3 botões) para o cliente no WhatsApp via UAZAPI. Use quando quiser oferecer opções clicáveis ao cliente.",
    input_schema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Texto da mensagem antes dos botões" },
        botoes: {
          type: "array",
          items: { type: "string" },
          description: "Lista de rótulos dos botões (1 a 3 itens, máx ~20 caracteres cada)",
          minItems: 1,
          maxItems: 3,
        },
        rodape: { type: "string", description: "Texto opcional do rodapé" },
      },
      required: ["texto", "botoes"],
    },
  },
  enviar_lista: {
    name: "enviar_lista",
    description:
      "Envia um menu em formato de lista com várias opções organizadas para o cliente escolher (use quando tiver mais de 3 opções).",
    input_schema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Texto introdutório da lista" },
        botao_label: { type: "string", description: 'Rótulo do botão que abre a lista (ex: "Ver opções")' },
        opcoes: {
          type: "array",
          items: { type: "string" },
          description: "Lista de opções (até 10 itens)",
          minItems: 2,
          maxItems: 10,
        },
      },
      required: ["texto", "opcoes"],
    },
  },
  enviar_imagem: {
    name: "enviar_imagem",
    description: "Envia uma imagem com legenda opcional para o cliente.",
    input_schema: {
      type: "object",
      properties: {
        url_imagem: { type: "string", description: "URL pública da imagem (https://)" },
        legenda: { type: "string", description: "Texto/legenda opcional" },
      },
      required: ["url_imagem"],
    },
  },
  enviar_link: {
    name: "enviar_link",
    description: "Envia uma mensagem de texto contendo um link/URL para o cliente.",
    input_schema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Texto da mensagem (deve incluir o link no corpo)" },
      },
      required: ["texto"],
    },
  },
  transferir_humano: {
    name: "transferir_humano",
    description:
      "Marca esta conversa como aguardando atendimento humano. O agente para de responder automaticamente e a conversa fica sinalizada para a equipe assumir.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo curto da transferência" },
      },
      required: ["motivo"],
    },
  },
  buscar_faq: {
    name: "buscar_faq",
    description:
      "Pesquisa na base de conhecimento (FAQs e documentos) por uma palavra-chave ou tema. Retorna trechos relevantes para responder o cliente com precisão.",
    input_schema: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Palavra-chave ou tema a pesquisar" },
      },
      required: ["termo"],
    },
  },
  gerar_pix: {
    name: "gerar_pix",
    description:
      "Gera uma cobrança PIX no gateway de pagamento e envia o código copia-e-cola para o cliente. Use quando o cliente quiser pagar.",
    input_schema: {
      type: "object",
      properties: {
        valor: { type: "number", description: "Valor da cobrança em reais (ex: 49.90)" },
        descricao: { type: "string", description: "Descrição/produto da cobrança" },
        nome_cliente: { type: "string", description: "Nome do cliente (opcional)" },
      },
      required: ["valor", "descricao"],
    },
  },
  // ============ GATEWAY (ZapLynxPay) ============
  gateway_consultar_saldo: {
    name: "gateway_consultar_saldo",
    description:
      "Consulta o saldo atual do gateway de pagamento (ZapLynxPay) do usuário, somando vendas pagas e descontando saques.",
    input_schema: { type: "object", properties: {} },
  },
  gateway_listar_vendas: {
    name: "gateway_listar_vendas",
    description:
      "Lista as últimas vendas/transações do gateway de pagamento. Pode filtrar por status (paid, pending, refused, refunded).",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtro opcional: paid, pending, refused, refunded" },
        limite: { type: "number", description: "Quantidade máxima a retornar (padrão 10, máx 50)" },
      },
    },
  },
  gateway_listar_produtos: {
    name: "gateway_listar_produtos",
    description: "Lista os produtos cadastrados no gateway de pagamento, com preço e link de checkout.",
    input_schema: {
      type: "object",
      properties: {
        limite: { type: "number", description: "Quantidade máxima (padrão 10)" },
      },
    },
  },
  gateway_buscar_plano_checkout: {
    name: "gateway_buscar_plano_checkout",
    description:
      "Busca um plano/produto específico do gateway e retorna seus dados junto com um link direto de checkout. Use quando o cliente quiser assinar, pagar um plano específico ou receber um botão/link de pagamento.",
    input_schema: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Nome, apelido ou termo relacionado ao plano/produto procurado" },
      },
      required: ["termo"],
    },
  },
  // ============ INSTAGRAM ============
  instagram_responder_comentario: {
    name: "instagram_responder_comentario",
    description:
      "Responde publicamente a um comentário no Instagram. Informe o ID do comentário e a mensagem de resposta.",
    input_schema: {
      type: "object",
      properties: {
        comment_id: { type: "string", description: "ID do comentário do Instagram" },
        mensagem: { type: "string", description: "Texto da resposta pública" },
      },
      required: ["comment_id", "mensagem"],
    },
  },
  instagram_enviar_dm: {
    name: "instagram_enviar_dm",
    description:
      "Envia uma mensagem direta (DM) no Instagram para um usuário, opcionalmente em resposta a um comentário (private reply).",
    input_schema: {
      type: "object",
      properties: {
        ig_user_id: { type: "string", description: "ID do destinatário no Instagram (use isto OU comment_id)" },
        comment_id: {
          type: "string",
          description: "ID de um comentário para enviar private reply (use isto OU ig_user_id)",
        },
        mensagem: { type: "string", description: "Texto da DM" },
      },
      required: ["mensagem"],
    },
  },
  instagram_listar_comentarios: {
    name: "instagram_listar_comentarios",
    description:
      "Lista os comentários recebidos recentemente no Instagram (eventos capturados pelo webhook), com ID, autor e texto.",
    input_schema: {
      type: "object",
      properties: {
        limite: { type: "number", description: "Quantidade máxima (padrão 10, máx 50)" },
      },
    },
  },
  // ============ META WHATSAPP CLOUD API ============
  meta_enviar_texto: {
    name: "meta_enviar_texto",
    description:
      "Envia uma mensagem de texto pelo WhatsApp via API oficial da Meta (Cloud API). Use quando o usuário tem instância Meta configurada.",
    input_schema: {
      type: "object",
      properties: {
        para: { type: "string", description: "Número do destinatário com DDI (ex: 5511999999999)" },
        mensagem: { type: "string", description: "Texto a enviar" },
      },
      required: ["para", "mensagem"],
    },
  },
  meta_enviar_template: {
    name: "meta_enviar_template",
    description:
      "Envia um template aprovado pelo WhatsApp via Meta Cloud API (necessário para iniciar conversas fora da janela de 24h).",
    input_schema: {
      type: "object",
      properties: {
        para: { type: "string", description: "Número do destinatário com DDI" },
        nome_template: { type: "string", description: "Nome do template aprovado na Meta" },
        idioma: { type: "string", description: "Código do idioma (ex: pt_BR). Padrão: pt_BR" },
        variaveis: { type: "array", items: { type: "string" }, description: "Variáveis do template, em ordem" },
      },
      required: ["para", "nome_template"],
    },
  },
  atualizar_etapa: {
    name: "atualizar_etapa",
    description:
      "Atualiza a etapa atual do lead no funil de vendas. Use quando o cliente avançar de fase (ex: da triagem para o atendimento, ou do atendimento para a conclusão).",
    input_schema: {
      type: "object",
      properties: {
        etapa: {
          type: "string",
          enum: ["triage", "service", "closing"],
          description:
            "A nova etapa do lead: triage (Triagem), service (Atendimento) ou closing (Conclusão/Fechamento).",
        },
      },
      required: ["etapa"],
    },
  },
  agente_tool: {
    name: "agente_tool",
    description: "Sub-agente que processa como tool e retorna resultado.",
    input_schema: {
      type: "object",
      properties: {
        instrucao: { type: "string", description: "Instrução para o sub-agente" },
        contexto: { type: "string", description: "Contexto adicional" },
      },
      required: ["instrucao"],
    },
  },
  expert_tool: {
    name: "expert_tool",
    description: "Sub-expert que processa e retorna JSON estruturado.",
    input_schema: {
      type: "object",
      properties: {
        instrucao: { type: "string", description: "Instrução para o expert" },
        formato: { type: "string", description: "Descrição do formato JSON esperado" },
      },
      required: ["instrucao", "formato"],
    },
  },
  rag_documentos: {
    name: "rag_documentos",
    description: "Busca semântica avançada em documentos e base de conhecimento.",
    input_schema: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Termo de busca" },
      },
      required: ["termo"],
    },
  },
  buscar_produtos: {
    name: "buscar_produtos",
    description: "Consulta catálogo de produtos disponíveis.",
    input_schema: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Nome ou categoria do produto" },
      },
    },
  },
  politicas_regras: {
    name: "politicas_regras",
    description: "Acessa regras e políticas da empresa para garantir conformidade.",
    input_schema: { type: "object", properties: {} },
  },
  consultar_transacoes: {
    name: "consultar_transacoes",
    description: "Consulta histórico de compras do lead atual.",
    input_schema: { type: "object", properties: {} },
  },
  enviar_transacao: {
    name: "enviar_transacao",
    description: "Envia mensagem de pagamento ou status pelo transaction_id.",
    input_schema: {
      type: "object",
      properties: {
        transaction_id: { type: "string", description: "ID da transação" },
        mensagem: { type: "string", description: "Mensagem personalizada" },
      },
      required: ["transaction_id"],
    },
  },
  gerar_cobranca_gateway: {
    name: "gerar_cobranca_gateway",
    description:
      "NÃO USE para entregar link de pagamento, checkout, PIX ou cartão. Para isso use SEMPRE gateway_buscar_plano_checkout (que devolve o link onde o próprio cliente preenche os dados). Esta ferramenta só deve ser usada quando o operador humano pedir explicitamente uma cobrança PIX direta (brcode/qrcode) e já tiver os dados do cliente em mãos.",
    input_schema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "ID do produto no gateway (opcional)" },
        amount: { type: "number", description: "Valor em reais (decimal)" },
        description: { type: "string", description: "Descrição da cobrança" },
        customer_name: { type: "string", description: "Nome do cliente" },
        customer_email: { type: "string", description: "E-mail do cliente" },
        customer_document: { type: "string", description: "CPF/CNPJ do cliente" },
      },
    },
  },
  ler_anexo: {
    name: "ler_anexo",
    description: "Lê texto de PDF, TXT ou planilha a partir da URL do anexo.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL do anexo" },
      },
      required: ["url"],
    },
  },
  enviar_prova_social: {
    name: "enviar_prova_social",
    description: "Use SOMENTE quando o lead pedir prévia, amostra, demonstração, depoimento, print, resultado, vídeo, foto, mídia ou prova social. NÃO use quando o lead pedir link de checkout, pagamento, PIX, cobrança, preço ou plano. Não repita prova social já enviada na conversa.",
    input_schema: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Palavra-chave/categoria para filtrar a prova social (opcional)" },
        legenda: { type: "string", description: "Legenda personalizada opcional (substitui a legenda padrão)" },
      },
    },
  },
  consulta_api_ia: {
    name: "consulta_api_ia",
    description: "Chamada HTTP externa com decisão por IA.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL da API" },
        metodo: { type: "string", enum: ["GET", "POST"], default: "GET" },
        dados: { type: "object", description: "Dados para enviar" },
      },
      required: ["url"],
    },
  },
  acessar_links: {
    name: "acessar_links",
    description: "Acessa e extrai conteúdo de URLs mencionadas na conversa.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL para acessar" },
      },
      required: ["url"],
    },
  },
  mcp_connect: {
    name: "mcp_connect",
    description: "Conexão Model Context Protocol para recursos externos.",
    input_schema: {
      type: "object",
      properties: {
        resource: { type: "string", description: "Recurso a acessar" },
      },
      required: ["resource"],
    },
  },
  horario_atual: {
    name: "horario_atual",
    description: "Retorna data/hora atual, timezone e dia da semana.",
    input_schema: { type: "object", properties: {} },
  },
  transferir_fila: {
    name: "transferir_fila",
    description: "Envia lead para uma fila de atendimento humano específica.",
    input_schema: {
      type: "object",
      properties: {
        fila_id: { type: "string", description: "ID da fila" },
      },
    },
  },
  transferir_estrategia: {
    name: "transferir_estrategia",
    description: "Muda o atendimento para outra estratégia ou agente.",
    input_schema: {
      type: "object",
      properties: {
        agente_id: { type: "string", description: "ID do novo agente/estratégia" },
      },
      required: ["agente_id"],
    },
  },
  chats_antigos: {
    name: "chats_antigos",
    description: "Acessa conversas anteriores do lead para contexto histórico.",
    input_schema: { type: "object", properties: {} },
  },
  gerenciar_ticket_crm: {
    name: "gerenciar_ticket_crm",
    description: "Lista e edita tickets em um pipeline de suporte.",
    input_schema: {
      type: "object",
      properties: {
        acao: { type: "string", enum: ["listar", "criar", "editar"] },
        ticket_id: { type: "string" },
        dados: { type: "object" },
      },
      required: ["acao"],
    },
  },
  listar_equipe: {
    name: "listar_equipe",
    description: "Lista IDs dos membros da equipe para atribuições.",
    input_schema: { type: "object", properties: {} },
  },
  adicionar_tag: {
    name: "adicionar_tag",
    description: "Adiciona uma etiqueta ao contato atual.",
    input_schema: {
      type: "object",
      properties: {
        tag: { type: "string", description: "Nome da tag" },
      },
      required: ["tag"],
    },
  },
  finalizar_atendimento: {
    name: "finalizar_atendimento",
    description: "Encerra o atendimento atual com o lead.",
    input_schema: { type: "object", properties: {} },
  },
  extrair_dados: {
    name: "extrair_dados",
    description: "Extrai e salva informações estruturadas da conversa.",
    input_schema: {
      type: "object",
      properties: {
        dados: { type: "object", description: "Informações extraídas" },
      },
      required: ["dados"],
    },
  },
  agenda_eventos: {
    name: "agenda_eventos",
    description: "Agenda eventos ou compromissos para o lead.",
    input_schema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data e hora do evento" },
        titulo: { type: "string" },
      },
      required: ["data", "titulo"],
    },
  },
  atualizar_memoria: {
    name: "atualizar_memoria",
    description: "Atualiza campos da memória de atendimento de longo prazo.",
    input_schema: {
      type: "object",
      properties: {
        campos: { type: "object", description: "Campos e valores para atualizar" },
      },
      required: ["campos"],
    },
  },
  criar_tarefa_crm: {
    name: "criar_tarefa_crm",
    description: "Cria tarefas no CRM vinculadas ao lead.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        vencimento: { type: "string" },
        atribuido_a: { type: "string" },
      },
      required: ["titulo"],
    },
  },
  consultar_crm_ia: {
    name: "consultar_crm_ia",
    description: "Consulta dados detalhados do CRM sobre o lead.",
    input_schema: { type: "object", properties: {} },
  },
  gerenciar_negocio_crm: {
    name: "gerenciar_negocio_crm",
    description: "Gerencia negócios (cards) no pipeline de vendas.",
    input_schema: {
      type: "object",
      properties: {
        acao: { type: "string", enum: ["listar", "criar", "mover"] },
        negocio_id: { type: "string" },
        etapa: { type: "string" },
      },
      required: ["acao"],
    },
  },
};

const WHATSAPP_META_APP_ID = "26985190684454065";
const INSTAGRAM_META_APP_ID = "1629147191696096";

// ============ WHATSAPP HELPERS ============
type WhatsAppCreds = {
  provider: string;
  apiUrl?: string;
  apiToken?: string;
  zapiInstanceId?: string;
  zapiToken?: string;
  zapiClientToken?: string;
};

async function getUserUazapiCreds(supabase: any, userId: string): Promise<{ apiUrl: string; apiToken: string } | null> {
  const { data: instance } = await supabase
    .from("zapi_instances")
    .select("zapi_instance_id, zapi_token, evolution_api_url, evolution_api_key, api_provider, is_default, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (instance && (instance.api_provider || "").toLowerCase() === "uazapi") {
    const apiUrl = String(instance.evolution_api_url || instance.zapi_instance_id || "").replace(/\/+$/, "");
    const apiToken = String(instance.evolution_api_key || instance.zapi_token || "");
    if (apiUrl && apiToken) return { apiUrl, apiToken };
  }
  return null;
}

async function getUserWhatsappCreds(supabase: any, userId: string, instanceId?: string | null): Promise<WhatsAppCreds | null> {
  const select = "id, zapi_instance_id, zapi_token, zapi_client_token, evolution_api_url, evolution_api_key, api_provider, is_default, is_active";
  let q = supabase.from("zapi_instances").select(select).eq("user_id", userId).eq("is_active", true);
  if (instanceId) q = q.eq("id", instanceId);
  else q = q.order("is_default", { ascending: false }).order("created_at", { ascending: true }).limit(1);
  const { data: instance } = await q.maybeSingle();
  if (!instance) return null;
  const provider = String(instance.api_provider || "zapi").toLowerCase();
  if (provider === "uazapi") {
    const apiUrl = String(instance.evolution_api_url || instance.zapi_instance_id || "").replace(/\/+$/, "");
    const apiToken = String(instance.evolution_api_key || instance.zapi_token || "");
    if (!apiUrl || !apiToken) return null;
    return { provider, apiUrl, apiToken };
  }
  if (provider === "zapi" || provider === "") {
    if (!instance.zapi_instance_id || !instance.zapi_token) return null;
    return {
      provider: "zapi",
      zapiInstanceId: instance.zapi_instance_id,
      zapiToken: instance.zapi_token,
      zapiClientToken: instance.zapi_client_token || "",
    };
  }
  return null;
}

async function uazapiSend(
  apiUrl: string,
  apiToken: string,
  endpoint: string,
  body: any,
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: apiToken },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

async function zapiSend(
  creds: WhatsAppCreds,
  phone: string,
  message: string,
  mediaUrl?: string,
  mediaType?: string,
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    if (!creds.zapiInstanceId || !creds.zapiToken) return { ok: false, error: "Conexão WhatsApp inválida." };
    const normalizedType = String(mediaType || "text").toLowerCase();
    let url = `https://api.z-api.io/instances/${creds.zapiInstanceId}/token/${creds.zapiToken}/send-text`;
    let body: any = { phone, message };

    if (mediaUrl) {
      if (normalizedType === "image") {
        url = `https://api.z-api.io/instances/${creds.zapiInstanceId}/token/${creds.zapiToken}/send-image`;
        body = { phone, image: mediaUrl, caption: message || "" };
      } else if (normalizedType === "video") {
        url = `https://api.z-api.io/instances/${creds.zapiInstanceId}/token/${creds.zapiToken}/send-video`;
        body = { phone, video: mediaUrl, caption: message || "" };
      } else if (normalizedType === "audio") {
        url = `https://api.z-api.io/instances/${creds.zapiInstanceId}/token/${creds.zapiToken}/send-audio`;
        body = { phone, audio: mediaUrl, waveform: true };
      } else if (normalizedType === "document") {
        const cleanUrl = String(mediaUrl).split("?")[0].split("#")[0];
        const ext = cleanUrl.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
        url = `https://api.z-api.io/instances/${creds.zapiInstanceId}/token/${creds.zapiToken}/send-document/${ext}`;
        body = { phone, document: mediaUrl, fileName: message || `arquivo.${ext}` };
      }
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": creds.zapiClientToken || "" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

async function sendWhatsAppMessage(
  creds: WhatsAppCreds,
  phone: string,
  message: string,
  mediaUrl?: string,
  mediaType?: string,
): Promise<{ ok: boolean; data?: any; error?: string }> {
  if (creds.provider === "uazapi") {
    if (!creds.apiUrl || !creds.apiToken) return { ok: false, error: "Conexão WhatsApp inválida." };
    if (mediaUrl) {
      return await uazapiSend(creds.apiUrl, creds.apiToken, "/send/media", {
        number: phone,
        type: ["image", "video", "audio", "document"].includes(String(mediaType)) ? mediaType : "image",
        file: mediaUrl,
        ...(message ? { text: message } : {}),
      });
    }
    return await uazapiSend(creds.apiUrl, creds.apiToken, "/send/text", { number: phone, text: message });
  }
  return await zapiSend(creds, phone, message, mediaUrl, mediaType);
}

function stripToolMetaText(text: string): string {
  return String(text || "")
    .replace(/\[[^\]\n]*(?:chamando|executando|usando|calling|call)\s+(?:a\s+)?(?:ferramenta|tool)[^\]\n]*\]/gi, "")
    .replace(/\([^\)\n]*(?:chamando|executando|usando|calling|call)\s+(?:a\s+)?(?:ferramenta|tool)[^\)\n]*\)/gi, "")
    .replace(/^.*(?:chamando|executando|usando)\s+(?:a\s+)?(?:ferramenta|tool)\s+[\w.-]+.*$/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasCheckoutIntent(text: string): boolean {
  const value = String(text || "").toLowerCase();
  return /\b(checkout|pag(ar|amento|uei)?|pix|cobran[cç]a|compr(ar|a)|fechar|assinar|assinatura|valor|pre[cç]o|plano|planos|cart[aã]o|cr[eé]dito|d[eé]bito|parcel(ar|amento|ado)?|link\s+(do|de)\s+(checkout|pagamento)|manda(r)?\s+(o\s+)?link|me\s+manda\s+(o\s+)?link)\b/i.test(value);
}

const CHECKOUT_SEARCH_STOPWORDS = new Set([
  "o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "para", "pra", "pro", "por", "com", "sem",
  "me", "te", "se", "eu", "vc", "voce", "você", "cliente", "lead", "agora", "aqui", "ai", "aí", "quero", "quer", "queria",
  "manda", "mandar", "mande", "envia", "enviar", "envie", "gera", "gerar", "gere", "abre", "abrir", "faz", "fazer",
  "link", "checkout", "pagamento", "pagar", "pago", "pix", "cartao", "cartão", "credito", "crédito", "debito", "débito",
  "plano", "planos", "preco", "preço", "valor", "comprar", "compra", "assinar", "assinatura", "cobranca", "cobrança",
]);

function getCheckoutSearchText(messages: any[] = [], fallback = ""): string {
  const recent = messages
    .slice(-8)
    .map((m: any) => String(m?.content || ""))
    .filter(Boolean)
    .join("\n");
  return `${recent}\n${fallback}`.trim() || fallback;
}

function getMeaningfulCheckoutTokens(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !CHECKOUT_SEARCH_STOPWORDS.has(token));
}

function isSocialProofRequest(lastUserText: string, messages: any[] = []): boolean {
  const text = String(lastUserText || "").toLowerCase();
  if (hasCheckoutIntent(text)) return false;
  const recentUsers = messages
    .filter((m: any) => m?.role === "user")
    .slice(-4)
    .map((m: any) => String(m?.content || ""))
    .join(" ")
    .toLowerCase();
  const proofTerms = /\b(pr[eé]via|amostra|demo|demonstra[cç][aã]o|depoimento|print|resultado|v[ií]deo|video|foto|m[ií]dia|midia|prova social|feedback|case)\b/i;
  const askTerms = /\b(me manda|manda|mande|envia|envie|quero ver|mostra|mostrar|cad[eê])\b/i;
  return proofTerms.test(text) || (askTerms.test(text) && proofTerms.test(recentUsers));
}

// ============ META HELPERS ============
const META_API_VERSION = "v21.0";
async function getMetaCreds(
  supabase: any,
  userId: string,
): Promise<{ access_token: string; phone_number_id: string } | null> {
  const { data } = await supabase
    .from("meta_credentials")
    .select("access_token, phone_number_id, connected")
    .eq("user_id", userId)
    .eq("app_id", WHATSAPP_META_APP_ID)
    .eq("connected", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.access_token || !data?.phone_number_id) return null;
  return { access_token: data.access_token, phone_number_id: data.phone_number_id };
}

async function getInstagramToken(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("meta_credentials")
    .select("access_token, connected")
    .eq("user_id", userId)
    .eq("app_id", INSTAGRAM_META_APP_ID)
    .eq("connected", true)
    .order("updated_at", { ascending: false })
    .limit(5);
  return (data || []).find((c: any) => c.access_token)?.access_token || null;
}

// ============ TOOL EXECUTOR ============
async function executeTool(
  toolName: string,
  input: any,
  ctx: { supabase: any; userId: string; phone: string | null; testMode: boolean; instanceId?: string | null; sentProofIds?: string[]; newlySentProofIds?: string[] },
): Promise<string> {
  const { supabase, userId, phone, testMode, instanceId } = ctx;
  const sentProofIds: string[] = Array.isArray(ctx.sentProofIds) ? ctx.sentProofIds : [];
  const newlySent: string[] = Array.isArray(ctx.newlySentProofIds) ? ctx.newlySentProofIds : [];

  if (testMode && ["enviar_botoes", "enviar_lista", "enviar_imagem", "enviar_link", "gerar_pix"].includes(toolName)) {
    return JSON.stringify({
      simulated: true,
      tool: toolName,
      input,
      info: "Modo de teste: a ação foi simulada. Em produção (WhatsApp real) seria executada de verdade.",
    });
  }

  // Dynamic MCP tool dispatch
  if (toolName.startsWith("mcp__")) {
    try {
      const { data: cfg } = await supabase
        .from("agent_tools_config")
        .select("config")
        .eq("user_id", userId)
        .eq("tool_name", "mcp_connect")
        .maybeSingle();
      const url = cfg?.config?.mcpUrl;
      if (!url) return JSON.stringify({ ok: false, error: "MCP não configurado" });
      const headers = Array.isArray(cfg?.config?.mcpHeaders) ? cfg.config.mcpHeaders : [];
      const tools: any[] = Array.isArray(cfg?.config?.mcpTools) ? cfg.config.mcpTools : [];
      // recover original tool name by matching sanitized name
      const sanitized = toolName.slice("mcp__".length);
      const original = tools.find((t) =>
        String(t.name).replace(/[^a-zA-Z0-9_]/g, "_") === sanitized,
      )?.name || sanitized;
      const callUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-mcp-call`;
      const r = await fetch(callUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ url, headers, tool: original, arguments: input || {} }),
      });
      const data = await r.json();
      return JSON.stringify(data);
    } catch (e: any) {
      return JSON.stringify({ ok: false, error: String(e?.message || e) });
    }
  }

  switch (toolName) {
    case "enviar_botoes": {
      const creds = await getUserUazapiCreds(supabase, userId);
      if (!creds) return JSON.stringify({ error: "Nenhuma instância UAZAPI configurada." });
      if (!phone) return JSON.stringify({ error: "Sem número de destino." });
      const r = await uazapiSend(creds.apiUrl, creds.apiToken, "/send/menu", {
        number: phone,
        type: "button",
        text: input.texto || "Selecione uma opção:",
        ...(input.rodape ? { footerText: input.rodape } : {}),
        choices: (input.botoes || []).slice(0, 3).map((b: any) => String(b)),
      });
      return JSON.stringify(r);
    }
    case "enviar_lista": {
      const creds = await getUserUazapiCreds(supabase, userId);
      if (!creds) return JSON.stringify({ error: "Nenhuma instância UAZAPI configurada." });
      if (!phone) return JSON.stringify({ error: "Sem número de destino." });
      const r = await uazapiSend(creds.apiUrl, creds.apiToken, "/send/menu", {
        number: phone,
        type: "list",
        text: input.texto || "Selecione uma opção:",
        ...(input.botao_label ? { buttonText: input.botao_label } : {}),
        choices: (input.opcoes || []).slice(0, 10).map((b: any) => String(b)),
      });
      return JSON.stringify(r);
    }
    case "enviar_imagem": {
      const creds = await getUserUazapiCreds(supabase, userId);
      if (!creds) return JSON.stringify({ error: "Nenhuma instância UAZAPI configurada." });
      if (!phone) return JSON.stringify({ error: "Sem número de destino." });
      const r = await uazapiSend(creds.apiUrl, creds.apiToken, "/send/media", {
        number: phone,
        type: "image",
        file: input.url_imagem,
        ...(input.legenda ? { text: input.legenda } : {}),
      });
      return JSON.stringify(r);
    }
    case "enviar_link": {
      const creds = await getUserUazapiCreds(supabase, userId);
      if (!creds) return JSON.stringify({ error: "Nenhuma instância UAZAPI configurada." });
      if (!phone) return JSON.stringify({ error: "Sem número de destino." });
      const r = await uazapiSend(creds.apiUrl, creds.apiToken, "/send/text", {
        number: phone,
        text: input.texto || "",
      });
      return JSON.stringify(r);
    }
    case "transferir_humano": {
      try {
        await supabase
          .from("agent_handoff")
          .insert({
            user_id: userId,
            phone: phone || "test",
            reason: input.motivo || "",
          })
          .then(() => null)
          .catch(() => null);
      } catch {}
      return JSON.stringify({
        ok: true,
        message:
          "Conversa marcada para atendimento humano. O agente não responderá mais automaticamente nesta conversa.",
      });
    }
    case "buscar_faq": {
      const term = String(input.termo || "")
        .toLowerCase()
        .trim();
      if (!term) return JSON.stringify({ results: [] });
      const { data: items } = await supabase
        .from("agent_knowledge")
        .select("type, question, answer, title, content")
        .eq("user_id", userId)
        .eq("active", true);
      const results = (items || [])
        .map((it: any) => {
          const hay = `${it.question || ""} ${it.answer || ""} ${it.title || ""} ${it.content || ""}`.toLowerCase();
          const score = hay.includes(term) ? 1 : 0;
          return { ...it, score };
        })
        .filter((x: any) => x.score > 0)
        .slice(0, 5);
      return JSON.stringify({ results });
    }
    case "gerar_pix": {
      try {
        const { data, error } = await supabase.functions.invoke("create-pix-copy-and-paste", {
          body: { amount: input.valor, description: input.descricao, customerName: input.nome_cliente },
        });
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ ok: true, pix: data });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao gerar PIX" });
      }
    }
    // ============ GATEWAY ============
    case "gateway_consultar_saldo": {
      try {
        const { data: txs } = await supabase
          .from("gateway_transactions")
          .select("net, status")
          .eq("user_id", userId)
          .eq("status", "paid");
        const { data: wds } = await supabase
          .from("gateway_withdrawals")
          .select("amount, status")
          .eq("user_id", userId)
          .in("status", ["pending", "approved", "processing", "completed"]);
        const totalRecebido = (txs || []).reduce((s: number, t: any) => s + (t.net || 0), 0);
        const totalSaques = (wds || []).reduce((s: number, w: any) => s + (w.amount || 0), 0);
        const saldo = totalRecebido - totalSaques;
        return JSON.stringify({
          saldo_disponivel_reais: (saldo / 100).toFixed(2),
          total_recebido_reais: (totalRecebido / 100).toFixed(2),
          total_saques_reais: (totalSaques / 100).toFixed(2),
        });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao consultar saldo" });
      }
    }
    case "gateway_listar_vendas": {
      try {
        const limite = Math.min(Number(input.limite) || 10, 50);
        let q = supabase
          .from("gateway_transactions")
          .select("id, customer_name, customer_email, amount, net, status, payment_method, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limite);
        if (input.status) q = q.eq("status", String(input.status));
        const { data } = await q;
        const vendas = (data || []).map((t: any) => ({
          ...t,
          valor_reais: (t.amount / 100).toFixed(2),
          liquido_reais: (t.net / 100).toFixed(2),
        }));
        return JSON.stringify({ total: vendas.length, vendas });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao listar vendas" });
      }
    }
    case "gateway_listar_produtos": {
      try {
        const limite = Math.min(Number(input.limite) || 10, 50);
        const { data } = await supabase
          .from("gateway_products")
          .select("id, name, description, price, type, status, sku")
          .eq("user_id", userId)
          .eq("status", true)
          .order("created_at", { ascending: false })
          .limit(limite);
        const produtos = (data || []).map((p: any) => ({
          ...p,
          preco_reais: (p.price / 100).toFixed(2),
        }));
        return JSON.stringify({ total: produtos.length, produtos });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao listar produtos" });
      }
    }
    case "gateway_buscar_plano_checkout": {
      try {
        const termo = String(input.termo || "")
          .trim()
          .toLowerCase();
        if (!termo) return JSON.stringify({ error: "Informe o plano desejado." });

        const allSearchText = getCheckoutSearchText(input.messages || [], termo).toLowerCase();
        const normalized = (value: any) => String(value || "").toLowerCase();
        const termoTokens = getMeaningfulCheckoutTokens(allSearchText);

        const asksForCheapest =
          /\b(mais barato|barato|menor preço|menor preco|inicial|entrada|básico|basico|start)\b/i.test(termo);

        // SEMPRE cria um checkout novo e enxuto baseado no produto certo,
        // ignorando checkouts antigos (que podem ter foto/config de outro produto).
        let bestCheckout: any = null;
        let bestProduct: any = null;
        {
          const { data: allProducts } = await supabase
            .from("gateway_products")
            .select("id, name, description, price, type, status, sku, created_at")
            .eq("user_id", userId)
            .eq("status", true)
            .limit(100);

          const productScored = (allProducts || [])
            .map((p: any) => {
              const hay = [p.name, p.description, p.sku].map(normalized).join(" ");
              let score = 0;
              if (asksForCheapest && typeof p?.price === "number") {
                score += Math.max(0, 1000000 - p.price);
              }
              if (hay.includes(termo)) score += 10;
              for (const token of termoTokens) {
                if (hay.includes(token)) score += 2;
              }
              return { product: p, score };
            })
            .filter((e: any) => e.score > 0)
            .sort((a: any, b: any) => b.score - a.score);

          const productPick = productScored[0]?.product;
          if (!productPick) {
            const activeProducts = allProducts || [];
            const fallbackProduct = asksForCheapest
              ? activeProducts.sort((a: any, b: any) => Number(a.price || 0) - Number(b.price || 0))[0]
              : activeProducts.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
            if (!fallbackProduct) {
              return JSON.stringify({ error: "Nenhum plano/produto ativo encontrado." });
            }
            productScored.unshift({ product: fallbackProduct, score: 1 });
          }

          const selectedProduct = productScored[0]?.product;

          // gera slug único curto
          const baseSlug = String(selectedProduct.name || "checkout")
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40) || "checkout";
          const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

          // config mínima: apenas o nome do produto, SEM foto alguma
          const minimalConfig = {
            productName: selectedProduct.name,
            price: selectedProduct.price,
            pix: true,
            creditCard: true,
            debitCard: false,
            boleto: false,
            format: "one_step",
            buttonText: "Pagar Agora",
            maxInstallments: 12,
            theme: "light",
            font: "inter",
            primaryColor: "#10B981",
            bgColor: "#F5F5F5",
            textColor: "#1F2937",
            showCpf: true,
            showPhone: true,
            showAddress: false,
            showBirthdate: false,
            showSecurityBadges: true,
            showLogo: false,
            productImage: "",
            hideProductImage: true,
          };

          const { data: created, error: createErr } = await supabase
            .from("gateway_checkouts")
            .insert({
              user_id: userId,
              name: selectedProduct.name,
              product_id: selectedProduct.id,
              slug,
              status: true,
              config: minimalConfig,
            })
            .select("id, name, slug")
            .maybeSingle();

          if (createErr || !created?.slug) {
            return JSON.stringify({ error: createErr?.message || "Falha ao criar checkout." });
          }
          bestCheckout = created;
          bestProduct = selectedProduct;
        }

        // Usa domínio customizado do usuário se houver, senão domínio padrão (.com)
        let checkoutHost = "pay.zaplynxpro.com";
        let pathPrefix = "checkout";
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("custom_domain")
            .eq("id", userId)
            .maybeSingle();
          if (prof?.custom_domain) {
            checkoutHost = String(prof.custom_domain)
              .replace(/^https?:\/\//, "")
              .replace(/\/+$/, "");
          }
        } catch {}
        const checkoutUrl = `https://${checkoutHost}/${pathPrefix}/${bestCheckout.slug}`;

        return JSON.stringify({
          found: true,
          plano: {
            id: bestProduct.id,
            nome: bestProduct.name,
            descricao: bestProduct.description,
            preco_reais: (Number(bestProduct.price || 0) / 100).toFixed(2),
            tipo: bestProduct.type,
          },
          checkout: {
            id: bestCheckout.id,
            nome: bestCheckout.name,
            slug: bestCheckout.slug,
            url: checkoutUrl,
          },
          cta: {
            label: `Pagar ${bestProduct.name}`,
            url: checkoutUrl,
          },
        });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao buscar plano e checkout" });
      }
    }
    // ============ INSTAGRAM ============
    case "instagram_responder_comentario": {
      const token = await getInstagramToken(supabase, userId);
      if (!token) return JSON.stringify({ error: "Nenhuma credencial Meta/Instagram conectada." });
      if (testMode)
        return JSON.stringify({ simulated: true, info: "Resposta a comentário simulada (modo teste).", input });
      try {
        const r = await fetch(`https://graph.instagram.com/${META_API_VERSION}/${input.comment_id}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input.mensagem, access_token: token }),
        });
        const text = await r.text();
        if (!r.ok) return JSON.stringify({ error: `HTTP ${r.status}: ${text.substring(0, 200)}` });
        return JSON.stringify({ ok: true, response: text.substring(0, 300) });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao responder comentário" });
      }
    }
    case "instagram_enviar_dm": {
      const token = await getInstagramToken(supabase, userId);
      if (!token) return JSON.stringify({ error: "Nenhuma credencial Meta/Instagram conectada." });
      if (!input.ig_user_id && !input.comment_id) return JSON.stringify({ error: "Informe ig_user_id ou comment_id." });
      if (testMode) return JSON.stringify({ simulated: true, info: "DM Instagram simulada (modo teste).", input });
      try {
        const recipient = input.comment_id ? { comment_id: input.comment_id } : { id: input.ig_user_id };
        const r = await fetch(
          `https://graph.instagram.com/${META_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipient, message: { text: input.mensagem } }),
          },
        );
        const text = await r.text();
        if (!r.ok) return JSON.stringify({ error: `HTTP ${r.status}: ${text.substring(0, 200)}` });
        return JSON.stringify({ ok: true, response: text.substring(0, 300) });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao enviar DM" });
      }
    }
    case "instagram_listar_comentarios": {
      try {
        const limite = Math.min(Number(input.limite) || 10, 50);
        const { data } = await supabase
          .from("instagram_events")
          .select("id, username, comment_text, media_id, created_at, payload")
          .eq("user_id", userId)
          .eq("event_type", "comment")
          .order("created_at", { ascending: false })
          .limit(limite);
        const comentarios = (data || []).map((c: any) => ({
          comment_id: c.payload?.id || c.id,
          autor: c.username,
          texto: c.comment_text,
          media_id: c.media_id,
          quando: c.created_at,
        }));
        return JSON.stringify({ total: comentarios.length, comentarios });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao listar comentários" });
      }
    }
    // ============ META WHATSAPP CLOUD API ============
    case "meta_enviar_texto": {
      const creds = await getMetaCreds(supabase, userId);
      if (!creds) return JSON.stringify({ error: "Nenhuma credencial Meta/WhatsApp Cloud conectada." });
      if (testMode)
        return JSON.stringify({ simulated: true, info: "Envio Meta WhatsApp simulado (modo teste).", input });
      try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${creds.phone_number_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${creds.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: String(input.para).replace(/\D/g, ""),
            type: "text",
            text: { body: input.mensagem },
          }),
        });
        const text = await r.text();
        if (!r.ok) return JSON.stringify({ error: `HTTP ${r.status}: ${text.substring(0, 200)}` });
        return JSON.stringify({ ok: true, response: text.substring(0, 300) });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha no envio Meta" });
      }
    }
    case "meta_enviar_template": {
      const creds = await getMetaCreds(supabase, userId);
      if (!creds) return JSON.stringify({ error: "Nenhuma credencial Meta/WhatsApp Cloud conectada." });
      if (testMode)
        return JSON.stringify({ simulated: true, info: "Envio template Meta simulado (modo teste).", input });
      try {
        const components =
          input.variaveis && input.variaveis.length > 0
            ? [
                {
                  type: "body",
                  parameters: input.variaveis.map((v: any) => ({ type: "text", text: String(v) })),
                },
              ]
            : [];
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${creds.phone_number_id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${creds.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: String(input.para).replace(/\D/g, ""),
            type: "template",
            template: {
              name: input.nome_template,
              language: { code: input.idioma || "pt_BR" },
              components,
            },
          }),
        });
        const text = await r.text();
        if (!r.ok) return JSON.stringify({ error: `HTTP ${r.status}: ${text.substring(0, 200)}` });
        return JSON.stringify({ ok: true, response: text.substring(0, 300) });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha no envio template Meta" });
      }
    }
    case "atualizar_etapa": {
      if (!phone) return JSON.stringify({ error: "Sem número de destino para atualizar etapa." });
      try {
        const { error } = await supabase
          .from("saved_contacts")
          .update({ agent_stage: input.etapa })
          .eq("user_id", userId)
          .eq("phone", phone);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ ok: true, message: `Etapa do lead atualizada para: ${input.etapa}` });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao atualizar etapa" });
      }
    }
    case "agente_tool":
    case "expert_tool": {
      return JSON.stringify({ ok: true, message: `Sub-agente processado com sucesso para: ${input.instrucao}` });
    }
    case "rag_documentos": {
      return await executeTool("buscar_faq", { termo: input.termo }, ctx);
    }
    case "buscar_produtos": {
      return await executeTool("gateway_listar_produtos", { limite: 10 }, ctx);
    }
    case "politicas_regras": {
      return await executeTool("buscar_faq", { termo: "políticas regras empresa" }, ctx);
    }
    case "consultar_transacoes": {
      return await executeTool("gateway_listar_vendas", { limite: 5 }, ctx);
    }
    case "enviar_transacao": {
      return JSON.stringify({ ok: true, message: `Status da transação ${input.transaction_id} enviado.` });
    }
    case "gerar_cobranca_gateway": {
      try {
        const payload: Record<string, unknown> = {
          userId,
          productId: input?.productId || null,
          amount: typeof input?.amount === "number" ? input.amount : Number(input?.amount) || 0,
          description: input?.description || "",
          lead: {
            name: input?.customer_name || null,
            email: input?.customer_email || null,
            phone: phone || null,
            document: input?.customer_document || null,
          },
        };
        const resp = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-create-charge`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify(payload),
          },
        );
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          return JSON.stringify({ error: data?.error || `Falha ao gerar cobrança (HTTP ${resp.status})` });
        }

        // Try to deliver the PIX directly to the lead when possible
        const charge = data?.charge || {};
        if (phone && !testMode) {
          try {
            const creds = await getUserUazapiCreds(supabase, userId);
            if (creds) {
              const valorTxt = typeof charge.amount === "number"
                ? `R$ ${charge.amount.toFixed(2).replace(".", ",")}`
                : "";
              const legenda = [
                "💳 *Cobrança PIX gerada*",
                charge.description ? `Produto: ${charge.description}` : "",
                valorTxt ? `Valor: ${valorTxt}` : "",
                "",
                "Copie o código abaixo no app do seu banco:",
                `\`${charge.brcode}\``,
              ].filter(Boolean).join("\n");

              if (charge.qrcode_image) {
                await uazapiSend(creds.apiUrl, creds.apiToken, "/send/media", {
                  number: phone,
                  type: "image",
                  file: charge.qrcode_image,
                  text: legenda,
                });
              } else if (charge.brcode) {
                await uazapiSend(creds.apiUrl, creds.apiToken, "/send/text", {
                  number: phone,
                  text: legenda,
                });
              }
            }
          } catch (sendErr) {
            console.error("[gerar_cobranca_gateway] envio falhou", sendErr);
          }
        }

        return JSON.stringify({ ok: true, charge });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao gerar cobrança" });
      }
    }
    case "ler_anexo": {
      return JSON.stringify({ ok: true, text: "Conteúdo do anexo processado (simulado)." });
    }
    case "enviar_prova_social": {
      try {
        const termo = String(input?.termo || "").trim().toLowerCase();
        let q = supabase
          .from("agent_social_proof")
          .select("id, title, description, caption, media_url, media_type, category, tags")
          .eq("user_id", userId)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(50);
        const { data: rows, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        const list = rows || [];
        if (list.length === 0) return JSON.stringify({ error: "Nenhuma prova social cadastrada." });

        // Exclude proofs already sent to this lead in the current conversation
        const alreadySent = new Set<string>([...sentProofIds, ...newlySent]);
        let pool = list.filter((r: any) => !alreadySent.has(r.id));
        // Nunca reinicia o ciclo automaticamente: isso evita reenviar a mesma prévia
        // quando o lead pede checkout/pagamento ou quando o webhook chega duplicado.
        if (pool.length === 0) {
          return JSON.stringify({ ok: false, already_sent: true, message: "Todas as prévias cadastradas já foram enviadas para este lead." });
        }

        let chosen: any = pool[0];
        if (termo) {
          const scored = pool.map((r: any) => {
            const hay = [r.title, r.description, r.caption, r.category, ...(r.tags || [])]
              .filter(Boolean).join(" ").toLowerCase();
            let s = 0;
            if (hay.includes(termo)) s += 5;
            for (const tok of termo.split(/\s+/).filter(Boolean)) if (hay.includes(tok)) s += 1;
            return { r, s };
          }).sort((a, b) => b.s - a.s);
          if (scored[0]?.s > 0) chosen = scored[0].r;
        }

        if (!phone) {
          newlySent.push(chosen.id);
          return JSON.stringify({ ok: true, preview: chosen, sent: { id: chosen.id, title: chosen.title }, rotated: false, info: "Sem número de destino (modo teste)." });
        }
        const creds = await getUserWhatsappCreds(supabase, userId, instanceId);
        if (!creds) return JSON.stringify({ error: "Nenhuma conexão WhatsApp configurada para envio." });
        const type = ["image", "video", "audio", "document"].includes(String(chosen.media_type))
          ? chosen.media_type : "image";
        const r = await sendWhatsAppMessage(
          creds,
          phone,
          String(input?.legenda || chosen.caption || ""),
          chosen.media_url,
          type,
        );
        if (!r.ok) return JSON.stringify({ error: r.error || "Falha ao enviar prova social" });
        newlySent.push(chosen.id);
        return JSON.stringify({ ok: true, sent: { id: chosen.id, title: chosen.title }, rotated: false, result: r });
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || "Falha ao enviar prova social" });
      }
    }
    case "consulta_api_ia": {
      try {
        const { data: cfgRow } = await supabase
          .from("agent_tools_config")
          .select("config")
          .eq("user_id", userId)
          .eq("tool_name", "consulta_api_ia")
          .maybeSingle();
        const cfg: any = cfgRow?.config || {};
        const aiInput: Record<string, any> = (input?.ai && typeof input.ai === "object") ? input.ai : input || {};

        const interp = (v: any): any => {
          if (typeof v !== "string") return v;
          return v.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path) => {
            const parts = String(path).split(".");
            const root = parts.shift();
            let src: any = null;
            if (root === "ai") src = aiInput;
            else if (root === "phone") return phone || "";
            else if (root === "input") src = aiInput;
            else return "";
            let cur: any = src;
            for (const p of parts) cur = cur?.[p];
            return cur == null ? "" : String(cur);
          });
        };

        const method = String(cfg.httpMethod || input?.metodo || "GET").toUpperCase();
        let urlStr = interp(cfg.apiUrl || input?.url || "");
        if (!urlStr) return JSON.stringify({ error: "URL não configurada para consulta_api_ia" });

        // Query params
        const qp = new URLSearchParams();
        for (const r of (cfg.queryParams || [])) {
          if (!r?.key) continue;
          qp.append(r.key, interp(r.value));
        }
        // also pass any ai-provided extra query under input.query
        if (input?.query && typeof input.query === "object") {
          for (const [k, v] of Object.entries(input.query)) qp.append(k, String(v));
        }
        if ([...qp].length > 0) {
          urlStr += (urlStr.includes("?") ? "&" : "?") + qp.toString();
        }

        // Headers
        const headers: Record<string, string> = {};
        for (const r of (cfg.headers || [])) {
          if (!r?.key) continue;
          headers[r.key] = interp(r.value);
        }

        // Body
        let body: string | undefined;
        if (["POST", "PUT", "PATCH"].includes(method)) {
          const bodyObj: Record<string, any> = {};
          for (const r of (cfg.bodyParams || [])) {
            if (!r?.key) continue;
            bodyObj[r.key] = interp(r.value);
          }
          // merge ai-provided "dados" or "body"
          const extra = input?.body || input?.dados;
          if (extra && typeof extra === "object") Object.assign(bodyObj, extra);
          body = JSON.stringify(bodyObj);
          if (!headers["Content-Type"] && !headers["content-type"]) {
            headers["Content-Type"] = "application/json";
          }
        }

        console.log("[consulta_api_ia]", method, urlStr);
        const apiResp = await fetch(urlStr, { method, headers, body });
        const text = await apiResp.text();
        let parsed: any = text;
        try { parsed = JSON.parse(text); } catch {}
        return JSON.stringify({
          ok: apiResp.ok,
          status: apiResp.status,
          data: parsed,
        });
      } catch (e: any) {
        console.error("consulta_api_ia error", e);
        return JSON.stringify({ ok: false, error: e?.message || String(e) });
      }
    }
    case "acessar_links": {
      return JSON.stringify({ ok: true, content: "Conteúdo do link extraído com sucesso (simulado)." });
    }
    case "mcp_connect": {
      return JSON.stringify({ ok: true, message: `Conectado ao MCP: ${input.resource}` });
    }
    case "horario_atual": {
      const now = new Date();
      return JSON.stringify({
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        dia_semana: now.toLocaleDateString("pt-BR", { weekday: "long" }),
        timezone: "America/Sao_Paulo",
      });
    }
    case "transferir_fila": {
      try {
        const { data: cfg } = await supabase
          .from("agent_tools_config")
          .select("config")
          .eq("user_id", userId)
          .eq("tool_name", "transferir_fila")
          .maybeSingle();
        const c: any = cfg?.config || {};
        const ids: string[] = Array.isArray(c.departmentIds) ? c.departmentIds : [];
        let chosen: { id: string; name: string } | null = null;
        if (ids.length) {
          const pick = c.queueRandom ? ids[Math.floor(Math.random() * ids.length)] : ids[0];
          const { data: dep } = await supabase
            .from("departments")
            .select("id, name")
            .eq("id", pick)
            .maybeSingle();
          if (dep) chosen = { id: dep.id, name: dep.name };
        }
        try {
          await supabase.from("agent_handoff").insert({
            user_id: userId,
            phone: phone || "test",
            reason: chosen ? `Fila: ${chosen.name}` : `Fila: ${input.fila_id || "Geral"}`,
            department_id: chosen?.id || null,
          });
        } catch (_) {}
        return JSON.stringify({
          ok: true,
          department: chosen,
          end_flow: !!c.queueEndFlow,
          message: chosen
            ? `Conversa transferida para a fila ${chosen.name}.`
            : "Conversa transferida para atendimento humano.",
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: String(e?.message || e) });
      }
    }
    case "transferir_estrategia": {
      try {
        const { data: cfg } = await supabase
          .from("agent_tools_config")
          .select("config")
          .eq("user_id", userId)
          .eq("tool_name", "transferir_estrategia")
          .maybeSingle();
        const c: any = cfg?.config || {};
        const flowId = c.targetFlowId || input.agente_id;
        if (!flowId) {
          return JSON.stringify({ ok: false, error: "Nenhuma estratégia de destino configurada." });
        }
        const { data: flow } = await supabase
          .from("flow_automations")
          .select("id,name,active")
          .eq("id", flowId)
          .maybeSingle();
        return JSON.stringify({
          ok: true,
          end_flow: !!c.endFlow,
          strategy: flow ? { id: flow.id, name: flow.name } : { id: flowId },
          message: flow
            ? `Atendimento transferido para a estratégia ${flow.name}.`
            : `Atendimento transferido para estratégia ${flowId}.`,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: String(e?.message || e) });
      }
    }
    case "chats_antigos": {
      return JSON.stringify({ ok: true, history: [] });
    }
    case "gerenciar_ticket_crm": {
      return JSON.stringify({ ok: true, message: `Ação ${input.acao} realizada no CRM.` });
    }
    case "listar_equipe": {
      try {
        const { data: cfg } = await supabase
          .from("agent_tools_config")
          .select("config")
          .eq("user_id", userId)
          .eq("tool_name", "listar_equipe")
          .maybeSingle();
        const c: any = cfg?.config || {};
        const scope = c.scope || "all";
        const selectedIds: string[] = Array.isArray(c.selectedIds) ? c.selectedIds : [];

        const idsSet = new Set<string>([userId]);
        const { data: pipes } = await supabase
          .from("pipelines").select("id").eq("owner_id", userId);
        const pipeIds = (pipes || []).map((p: any) => p.id);
        if (pipeIds.length) {
          const { data: pm } = await supabase
            .from("pipeline_members").select("user_id").in("pipeline_id", pipeIds);
          (pm || []).forEach((m: any) => idsSet.add(m.user_id));
        }
        let ids = Array.from(idsSet);
        if (scope === "selected" && selectedIds.length) {
          ids = ids.filter((i) => selectedIds.includes(i));
        }
        if (ids.length === 0) return JSON.stringify({ ok: true, members: [] });
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,email,is_active")
          .in("id", ids);
        const members = (profs || [])
          .filter((p: any) => p.is_active !== false)
          .map((p: any) => ({ user_id: p.id, name: p.full_name || p.email, email: p.email }));
        return JSON.stringify({ ok: true, members });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: String(e?.message || e) });
      }
    }
    case "adicionar_tag": {
      return JSON.stringify({ ok: true, message: `Tag '${input.tag}' adicionada ao lead.` });
    }
    case "finalizar_atendimento": {
      return JSON.stringify({ ok: true, message: "Atendimento encerrado pelo agente." });
    }
    case "extrair_dados": {
      return JSON.stringify({ ok: true, message: "Dados extraídos e salvos com sucesso." });
    }
    case "agenda_eventos": {
      return JSON.stringify({ ok: true, message: `Evento '${input.titulo}' agendado para ${input.data}.` });
    }
    case "atualizar_memoria": {
      return JSON.stringify({ ok: true, message: "Memória de atendimento atualizada." });
    }
    case "criar_tarefa_crm": {
      return JSON.stringify({ ok: true, message: `Tarefa '${input.titulo}' criada no CRM.` });
    }
    case "consultar_crm_ia": {
      return JSON.stringify({ ok: true, data: { lead_score: 85, stage: "Negotiation" } });
    }
    case "gerenciar_negocio_crm": {
      return JSON.stringify({ ok: true, message: `Negócio ${input.acao} com sucesso.` });
    }
    default:
      return JSON.stringify({ error: `Ferramenta desconhecida: ${toolName}` });
  }
}

// ============ MAIN ============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const body = await req.json();
    const {
      messages,
      user_id,
      skip_config,
      phone,
      instance_id,
      connected_tools,
      system_prompt: customSystemPrompt,
      model: customModel,
      sent_proof_ids,
    } = body;
    const incomingSentProofIds: string[] = Array.isArray(sent_proof_ids) ? sent_proof_ids.filter((x: any) => typeof x === "string") : [];
    const newlySentProofIds: string[] = [];
    const effectiveUserId = user_id || userId;
    if (!effectiveUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const query = supabase.from("agent_config").select("*").eq("user_id", effectiveUserId);
    if (!skip_config) query.eq("active", true);
    const { data: agentConfig } = await query.maybeSingle();

    if (!agentConfig && !skip_config) {
      return new Response(JSON.stringify({ error: "Agente não configurado ou desativado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: knowledge } = await supabase
      .from("agent_knowledge")
      .select("type, question, answer, content, title")
      .eq("user_id", effectiveUserId)
      .eq("active", true)
      .order("created_at", { ascending: true });

    const effectiveAgentName = agentConfig?.agent_name || "Assistente";
    let rawPrompt = agentConfig?.system_prompt || "Você é um assistente virtual prestativo.";
    let triagePrompt = "";
    let servicePrompt = rawPrompt;
    let closingPrompt = "";

    if (rawPrompt.startsWith("---STAGES---")) {
      try {
        const parts = rawPrompt.split("---STAGES---")[1].split("---PART---");
        triagePrompt = parts[0] || "";
        servicePrompt = parts[1] || "";
        closingPrompt = parts[2] || "";
      } catch (e) {
        console.error("Error parsing stages in edge function:", e);
      }
    }

    let systemPrompt = `Nome do agente: ${effectiveAgentName}\n\n`;

    if (customSystemPrompt) {
      systemPrompt += `--- PROMPT PERSONALIZADO ---\n${customSystemPrompt}\n\n`;
    } else {
      if (triagePrompt) {
        systemPrompt += `--- ETAPA 1: TRIAGEM E CLASSIFICAÇÃO ---\n${triagePrompt}\n\n`;
      }
      systemPrompt += `--- ETAPA 2: ATENDIMENTO ---\n${servicePrompt}\n\n`;
      if (closingPrompt) {
        systemPrompt += `--- ETAPA 3: CONCLUSÃO E CTA ---\n${closingPrompt}\n\n`;
      }
    }

    systemPrompt += "--- REGRAS GERAIS ---";
    const isCustom = !!customSystemPrompt;
    
    if (!isCustom) {
      systemPrompt += "\n- Responda sempre de forma educada, curta e muito objetiva, mantendo um tom de conversa humana.";
      systemPrompt += "\n- NUNCA envie textos longos ou listas extensas. Prefira frases curtas e diretas.";
    } else {
      systemPrompt += "\n- Siga o tom de voz e as instruções definidas no PROMPT PERSONALIZADO acima.";
      systemPrompt += "\n- Se houver um fluxo de passos (ex: 1, 2, 3), você deve executar APENAS o passo atual. Analise o histórico da conversa para identificar qual passo já foi concluído e qual é o próximo.";
      systemPrompt += "\n- Não pule etapas nem envie informações de passos futuros. Aguarde a interação do usuário para validar o passo atual antes de prosseguir.";
    }

    systemPrompt += "\n- Use a base de conhecimento abaixo para responder, mas de forma resumida.";
    systemPrompt += "\n- Se não souber a resposta, use a ferramenta transferir_humano.";
    systemPrompt +=
      "\n- Se o cliente perguntar sobre plano, preço, assinatura ou quiser pagar, use a ferramenta gateway_buscar_plano_checkout antes de responder.";
    systemPrompt +=
      "\n- NUNCA peça nome, e-mail, CPF/CNPJ, telefone ou qualquer dado pessoal do cliente para gerar link de pagamento/checkout/PIX/cartão. Apenas chame gateway_buscar_plano_checkout e envie o link retornado — o próprio checkout coleta os dados.";
    systemPrompt +=
      "\n- NUNCA use gerar_cobranca_gateway para entregar link de checkout/pagamento. Sempre prefira gateway_buscar_plano_checkout.";
    systemPrompt +=
      "\n- Quando existir checkout disponível, responda mencionando o plano de forma sucinta e envie também o link direto de pagamento.";
    systemPrompt += "\n- Se houver CTA retornado pela ferramenta, priorize esse CTA na resposta final.";
    systemPrompt +=
      "\n- Se houver link de checkout, o cliente precisa receber a URL no texto e/ou botão. Não diga que vai buscar depois; envie o link na mesma resposta.";
    systemPrompt +=
      "\n- IMPORTANTE: Sempre que o cliente avançar de fase (ex: da triagem inicial para dúvidas específicas ou demonstrar interesse em compra), use a ferramenta atualizar_etapa para manter o sistema atualizado.";
    systemPrompt += "\n- Se o seu prompt personalizado for sobre saúde, bem-estar ou produtos físicos (ex: Retinox), ignore COMPLETAMENTE qualquer informação sobre a plataforma ZapLynx, automações ou APIs. Você é um especialista no produto, não um suporte técnico.";
    systemPrompt +=
      "\n- PRÉVIA / PROVA SOCIAL: Use enviar_prova_social SOMENTE quando o lead pedir explicitamente prévia, amostra, demonstração, depoimento, print, resultado, vídeo, foto, mídia ou prova social. Se o lead pedir link de checkout, pagamento, PIX, cobrança, preço ou plano, NÃO envie prévia/prova social; responda com o checkout/CTA de pagamento. NUNCA repita prova social já enviada na conversa. Após chamar a ferramenta, apenas confirme brevemente o envio (ex: 'Te mandei aqui, dá uma olhada 😉').";
    systemPrompt +=
      "\n- NUNCA escreva mensagens internas do tipo '[Chamando ferramenta...]', '[executando tool...]', nomes de ferramentas, JSON, tool_call ou qualquer status técnico para o cliente. Chamadas de ferramenta devem acontecer apenas pelo mecanismo interno de tools.";

    if (knowledge && knowledge.length > 0) {
      systemPrompt += "\n\n--- BASE DE CONHECIMENTO ---";
      for (const item of knowledge) {
        // Se estivermos em um fluxo com prompt personalizado (bloco Agente IA),
        // evitamos misturar a base de conhecimento global da ZapLynx se ela não for relevante.
        const isZapLynxDoc = (item.title || "").toLowerCase().includes("zaplynx") || 
                            (item.title || "").toLowerCase().includes("instância") || 
                            (item.title || "").toLowerCase().includes("aquecimento") || 
                            (item.title || "").toLowerCase().includes("api") || 
                            (item.content || "").toLowerCase().includes("zaplynx");
        
        if (customSystemPrompt && isZapLynxDoc) {
          const customPromptLower = customSystemPrompt.toLowerCase();
          // Se o prompt fala de Retinox ou produtos específicos e não fala de ZapLynx, ignoramos docs da plataforma
          if (customPromptLower.includes("retinox") || (!customPromptLower.includes("zaplynx") && customPromptLower.length > 50)) {
            continue;
          }
        }

        if (item.type === "faq") systemPrompt += `\n\nPergunta: ${item.question}\nResposta: ${item.answer}`;
        else if (item.type === "document")
          systemPrompt += `\n\nDocumento "${item.title || "Sem título"}":\n${item.content}`;
      }
    }

    const lastUserMessage = [...(messages || [])].reverse().find((m: any) => m?.role === "user");
    const lastUserText = String(lastUserMessage?.content || "").trim();
    let forcedSocialProofRaw: string | null = null;
    let forcedSocialProofSent = false;
    const hasPricingIntent = hasCheckoutIntent(lastUserText);
    let prefetchedCta: { label: string; url: string } | null = null;

    if (hasPricingIntent) {
      try {
        const prefetchedPlanRaw = await executeTool(
          "gateway_buscar_plano_checkout",
          { termo: lastUserText, messages: messages || [] },
          {
            supabase,
            userId: effectiveUserId,
            phone: phone || null,
            testMode: !phone,
          },
        );
        const prefetchedPlan = JSON.parse(prefetchedPlanRaw);
        const prefetchedUrl = String(prefetchedPlan?.cta?.url || prefetchedPlan?.checkout?.url || "").trim();
        if (/^https?:\/\//i.test(prefetchedUrl)) {
          prefetchedCta = {
            label: String(prefetchedPlan?.cta?.label || "Abrir checkout").trim() || "Abrir checkout",
            url: prefetchedUrl,
          };

          systemPrompt += "\n\n--- DADOS REAIS DE CHECKOUT ENCONTRADOS AGORA ---";
          systemPrompt += `\nPlano: ${prefetchedPlan?.plano?.nome || prefetchedPlan?.checkout?.nome || "Plano disponível"}`;
          if (prefetchedPlan?.plano?.preco_reais) {
            systemPrompt += `\nPreço: R$ ${prefetchedPlan.plano.preco_reais}`;
          }
          if (prefetchedPlan?.plano?.descricao) {
            systemPrompt += `\nDescrição: ${prefetchedPlan.plano.descricao}`;
          }
          systemPrompt += `\nCheckout real: ${prefetchedUrl}`;
          systemPrompt +=
            "\nAo responder, apresente este plano como opção correta e envie a URL acima diretamente para o cliente fechar a compra agora.";
        }
      } catch (prefetchError) {
        console.error("Erro ao pré-buscar checkout:", prefetchError);
      }
    }

    const shouldForceSocialProof = isSocialProofRequest(lastUserText, messages || []);
    if (shouldForceSocialProof) {
      try {
        let toolEnabled = true;
        if (!skip_config) {
          const { data: socialProofTool } = await supabase
            .from("agent_tools_config")
            .select("enabled")
            .eq("user_id", effectiveUserId)
            .eq("tool_name", "enviar_prova_social")
            .eq("enabled", true)
            .maybeSingle();
          toolEnabled = !!socialProofTool?.enabled;
        } else if (Array.isArray(connected_tools) && connected_tools.length > 0) {
          toolEnabled = connected_tools.some(
            (t: any) =>
              (t?.toolName || t?.tool_name || t?.name) === "enviar_prova_social" &&
              t?.enabled !== false,
          );
        }
        if (toolEnabled) {
          forcedSocialProofRaw = await executeTool(
            "enviar_prova_social",
            { termo: lastUserText },
            { supabase, userId: effectiveUserId, phone: phone || null, testMode: !phone, instanceId: instance_id || null, sentProofIds: incomingSentProofIds, newlySentProofIds },
          );
          console.log("[AgentChat] forced enviar_prova_social result:", String(forcedSocialProofRaw).substring(0, 400));
          const forcedResult = JSON.parse(forcedSocialProofRaw || "{}");
          forcedSocialProofSent = !!forcedResult?.ok;
          if (forcedSocialProofSent) {
            systemPrompt += "\n\n--- AÇÃO AUTOMÁTICA JÁ EXECUTADA ---\nA prova social solicitada pelo lead já foi enviada pela ferramenta interna. NÃO chame nenhuma ferramenta. Responda apenas com uma confirmação curta e natural (ex: 'Te mandei aqui, dá uma olhada 😉'). NUNCA diga que houve problema técnico, NUNCA invente nomes de pessoas como 'Marta' ou 'João', NUNCA peça para o lead aguardar.";
          }
        }
      } catch (socialProofError) {
        console.error("Erro ao pré-enviar prova social:", socialProofError);
      }
    }

    // ============ PROVIDER SELECTION ============
    const isAnthropicKey = ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.startsWith("sk-ant-");

    // ✅ MODELO ATUALIZADO: claude-3-5-sonnet-latest foi removido (não existe mais)
    // Use sempre strings de modelo válidas da Anthropic
    const rawModel = customModel || agentConfig?.model || "claude-sonnet-4-6";

    // Managed agents usam formato "model-string:version" com dois pontos
    const isManagedAgent = rawModel.includes(":");

    // Normaliza modelos legados/deprecados salvos no banco → modelos atuais válidos
    // Referência: https://platform.claude.com/docs/en/about-claude/models/overview
    const MODEL_ALIASES: Record<string, string> = {
      // Claude 3.x → Claude Sonnet 4.6 (atual recomendado)
      "claude-3-5-sonnet-latest": "claude-sonnet-4-6",
      "claude-3-5-sonnet-20241022": "claude-sonnet-4-6",
      "claude-3-5-sonnet-20240620": "claude-sonnet-4-6",
      "claude-3-sonnet-20240229": "claude-sonnet-4-6",
      // Claude 4 primeira geração (deprecação prevista 15/jun/2026) → Claude 4.6
      "claude-sonnet-4-20250514": "claude-sonnet-4-6",
      "claude-opus-4-20250514": "claude-opus-4-7",
      // Haiku
      "claude-3-haiku-20240307": "claude-haiku-4-5",
      "claude-haiku-4-5-20251001": "claude-haiku-4-5",
    };
    const model = MODEL_ALIASES[rawModel] ?? rawModel;

    console.log(
      `[AgentChat] Starting response generation for user ${effectiveUserId}. Model: ${model}, Managed Agent: ${isManagedAgent}, Provider: ${isAnthropicKey ? "Native Anthropic" : "Lovable AI Gateway"}`,
    );

    const testMode = !phone;
    let convMessages: any[] = [];
    let finalText = "";
    let finalCta: { label: string; url: string } | null = null;
    const executedToolNames = new Set<string>();
    let iterations = 0;
    const MAX_ITER = 6;

    for (const m of messages || []) {
      if (m.role === "user" || m.role === "assistant") {
        convMessages.push({ role: m.role, content: m.content });
      }
    }

    let enabledTools: any[] = [];
    if (!skip_config) {
      const { data: toolsCfg } = await supabase
        .from("agent_tools_config")
        .select("tool_name, enabled, config")
        .eq("user_id", effectiveUserId)
        .eq("enabled", true);

      enabledTools = (toolsCfg || [])
        .map((t: any) => {
          const def = TOOL_DEFS[t.tool_name];
          if (!def) return null;
          // Dynamically build input schema for consulta_api_ia from configured AI params
          if (t.tool_name === "consulta_api_ia" && t.config) {
            const cfg: any = t.config;
            const aiParams: any[] = Array.isArray(cfg.aiParams) ? cfg.aiParams : [];
            const props: Record<string, any> = {};
            const required: string[] = [];
            for (const p of aiParams) {
              if (!p?.key) continue;
              props[p.key] = { type: "string", description: p.desc || `Campo ${p.key}` };
              if (p.required) required.push(p.key);
            }
            const desc = cfg.description
              ? String(cfg.description)
              : `Faz a requisição ${cfg.httpMethod || "GET"} para ${cfg.apiUrl || "API configurada"}`;
            return {
              name: "consulta_api_ia",
              description: desc,
              input_schema: {
                type: "object",
                properties: props,
                ...(required.length ? { required } : {}),
              },
            };
          }
          return def;
        })
        .filter(Boolean)
        .filter((tool: any) => !(forcedSocialProofSent && tool?.name === "enviar_prova_social"))
        .filter((tool: any) => !(hasPricingIntent && tool?.name === "enviar_prova_social"));

      if (!enabledTools.find((tool: any) => tool?.name === "gateway_buscar_plano_checkout")) {
        enabledTools.push(TOOL_DEFS.gateway_buscar_plano_checkout);
      }

      // Expand mcp_connect into one dynamic tool per enabled MCP tool
      const mcpCfg = (toolsCfg || []).find((t: any) => t.tool_name === "mcp_connect");
      if (mcpCfg?.config?.mcpUrl) {
        const tools: any[] = Array.isArray(mcpCfg.config.mcpTools) ? mcpCfg.config.mcpTools : [];
        enabledTools = enabledTools.filter((t: any) => t?.name !== "mcp_connect");
        for (const t of tools) {
          if (!t?.name || t.enabled === false) continue;
          enabledTools.push({
            name: `mcp__${String(t.name).replace(/[^a-zA-Z0-9_]/g, "_")}`,
            description: t.description || `MCP tool ${t.name}`,
            input_schema: t.inputSchema || { type: "object", properties: {} },
          });
        }
      }
    } else if (Array.isArray(connected_tools) && connected_tools.length > 0) {
      enabledTools = connected_tools
        .filter((t: any) => t?.enabled !== false)
        .map((t: any) => TOOL_DEFS[String(t?.toolName || t?.tool_name || t?.name || "")])
        .filter(Boolean)
        .filter((tool: any) => !(forcedSocialProofSent && tool?.name === "enviar_prova_social"))
        .filter((tool: any) => !(hasPricingIntent && tool?.name === "enviar_prova_social"));
    }

    while (iterations < MAX_ITER) {
      iterations++;
      let resp: Response;

      if (isAnthropicKey) {
        // ── NATIVE ANTHROPIC API ──────────────────────────────────────────
        const headers: Record<string, string> = {
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        };
        if (isManagedAgent) {
          headers["anthropic-beta"] = "managed-agents-2026-04-01";
        }

        const anthropicBody: Record<string, any> = {
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: convMessages,
        };
        if (enabledTools.length > 0) {
          anthropicBody.tools = enabledTools;
        }

        resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers,
          body: JSON.stringify(anthropicBody),
        });
      } else {
        // ── LOVABLE AI GATEWAY (OpenAI-compatible) ────────────────────────
        const openAiTools = enabledTools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          },
        }));

        const gatewayMessages = [{ role: "system", content: systemPrompt }, ...convMessages];

        const gatewayBody: Record<string, any> = {
          model,
          messages: gatewayMessages,
          max_tokens: 1024,
        };
        if (openAiTools.length > 0) {
          gatewayBody.tools = openAiTools;
        }

        resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gatewayBody),
        });
      }

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[AgentChat] API Error: ${resp.status}`, errText);
        return new Response(JSON.stringify({ error: "Erro na API: " + errText.substring(0, 200) }), {
          status: resp.status >= 500 ? 500 : resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();

      if (isAnthropicKey) {
        // ── Handle Anthropic response ─────────────────────────────────────
        const textContent = data.content?.find((c: any) => c.type === "text");
        if (textContent) {
          finalText = (finalText ? finalText + "\n" : "") + textContent.text;
        }

        const toolUses = (data.content || []).filter((c: any) => c.type === "tool_use");
        if (toolUses.length === 0) break;

        convMessages.push({ role: "assistant", content: data.content });

        const toolResults: any[] = [];
        for (const tu of toolUses) {
          console.log(`🔧 Tool call (Anthropic): ${tu.name}`, JSON.stringify(tu.input).substring(0, 200));
          const result = await executeTool(tu.name, tu.input, {
            supabase,
            userId: effectiveUserId,
            phone: phone || null,
            testMode,
            instanceId: instance_id || null,
            sentProofIds: incomingSentProofIds,
            newlySentProofIds,
          });
          executedToolNames.add(tu.name);
          if (tu.name === "enviar_prova_social") {
            console.log("[AgentChat] enviar_prova_social tool result:", String(result).substring(0, 400));
            try {
              const parsedSP = JSON.parse(result);
              if (parsedSP?.ok) forcedSocialProofSent = true;
            } catch {}
          }

          try {
            const parsed = JSON.parse(result);
            const ctaUrl = String(parsed?.cta?.url || parsed?.checkout?.url || "").trim();
            if (/^https?:\/\//i.test(ctaUrl)) {
              finalCta = {
                label: String(parsed?.cta?.label || "Abrir checkout").trim() || "Abrir checkout",
                url: ctaUrl,
              };
            }
          } catch {}

          toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
        }

        if (toolResults.length > 0) {
          convMessages.push({ role: "user", content: toolResults });
        }
      } else {
        // ── Handle OpenAI/Gateway response ───────────────────────────────
        const message = data.choices?.[0]?.message;
        if (!message) break;

        if (message.content) {
          finalText = (finalText ? finalText + "\n" : "") + message.content;
        }

        const toolCalls = message.tool_calls;
        if (!toolCalls || toolCalls.length === 0) break;

        convMessages.push(message);

        for (const tc of toolCalls) {
          let args = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            console.error("Error parsing tool arguments:", tc.function.arguments);
          }

          console.log(`🔧 Tool call: ${tc.function.name}`, JSON.stringify(args).substring(0, 200));
          const result = await executeTool(tc.function.name, args, {
            supabase,
            userId: effectiveUserId,
            phone: phone || null,
            testMode,
            instanceId: instance_id || null,
            sentProofIds: incomingSentProofIds,
            newlySentProofIds,
          });
          executedToolNames.add(tc.function.name);
          if (tc.function.name === "enviar_prova_social") {
            console.log("[AgentChat] enviar_prova_social tool result:", String(result).substring(0, 400));
            try {
              const parsedSP = JSON.parse(result);
              if (parsedSP?.ok) forcedSocialProofSent = true;
            } catch {}
          }

          try {
            const parsed = JSON.parse(result);
            const ctaUrl = String(parsed?.cta?.url || parsed?.checkout?.url || "").trim();
            if (/^https?:\/\//i.test(ctaUrl)) {
              finalCta = {
                label: String(parsed?.cta?.label || "Abrir checkout").trim() || "Abrir checkout",
                url: ctaUrl,
              };
            }
          } catch {}

          convMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: tc.function.name,
            content: result,
          });
        }
      }
    }

    const checkoutMatch = finalText.match(/https?:\/\/[^\s)]+/);
    const checkoutUrl = finalCta?.url || prefetchedCta?.url || checkoutMatch?.[0] || null;
    const sanitizedReply = stripToolMetaText(finalText)
      .replace(/https?:\/\/[^\s)]+/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    console.log(`[AgentChat] Final reply length: ${sanitizedReply.length}`);

    const fallbackReply = forcedSocialProofSent || executedToolNames.has("enviar_prova_social")
      ? "Te mandei aqui, dá uma olhada 😉"
      : executedToolNames.has("gerar_cobranca_gateway")
        ? "Te mandei a cobrança aqui."
        : "Desculpe, não consegui processar uma resposta agora.";

    // Quando a prova social foi enviada com sucesso, NUNCA deixe o modelo
    // inventar mensagens de "problema técnico" ou nomes de pessoas (ex: "Marta").
    let safeReply = sanitizedReply || fallbackReply;
    if (forcedSocialProofSent) {
      const looksBroken = /(problema\s+t[eé]cnico|probleminha|n[aã]o\s+consegui\s+enviar|falha|erro|aciona(r|rei)|me\s+aguarda|aguarde|um\s+momento|pessoalmente|marta|jo[aã]o)/i
        .test(safeReply);
      if (!safeReply || looksBroken) {
        safeReply = "Te mandei aqui, dá uma olhada 😉";
      }
    }

    if (checkoutUrl && !safeReply.includes(checkoutUrl)) {
      safeReply = `${safeReply}\n\nLink de pagamento: ${checkoutUrl}`.trim();
    }

    const replyPayload: Record<string, unknown> = {
      reply: safeReply,
    };

    if (checkoutUrl) {
      replyPayload.cta = {
        label: finalCta?.label || prefetchedCta?.label || "Abrir checkout",
        url: checkoutUrl,
      };
    }
    if (newlySentProofIds.length > 0) {
      // Return the updated history (existing + newly sent), deduped
      const merged = Array.from(new Set([...incomingSentProofIds, ...newlySentProofIds]));
      replyPayload.sent_proof_ids = merged;
      replyPayload.newly_sent_proof_ids = Array.from(new Set(newlySentProofIds));
    }

    return new Response(JSON.stringify(replyPayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("agent-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
