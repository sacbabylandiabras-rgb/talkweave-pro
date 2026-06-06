// src/components/flow/exemploBlocos.ts
// Estruturas de dados de referência para cada tipo de bloco do Fluxo Visual.
// Usa as chaves curtas (aliases) registradas em `nodeTypes.ts`.

import { isValidNodeType } from "./nodeTypes";

export const EXEMPLO_BLOCOS = {
  // ========== BÁSICOS ==========
  inicio: {
    id: "node-inicio",
    type: "inicio",
    position: { x: 0, y: 0 },
    data: { label: "Início do Fluxo", description: "Começa aqui", isTelegram: false },
  },
  gatilho: {
    id: "node-gatilho",
    type: "gatilho",
    position: { x: 250, y: 0 },
    data: {
      label: "Aguardar Mensagem",
      keyword: "oi",
      description: "Dispara quando usuário escreve 'oi'",
      isWebhook: false,
      isTelegram: false,
    },
  },
  gatilhoWebhook: {
    id: "node-webhook",
    type: "gatilho",
    position: { x: 250, y: 50 },
    data: {
      label: "Webhook Recebido",
      isWebhook: true,
      description: "Dispara ao receber webhook",
      isTelegram: false,
    },
  },
  gateway: {
    id: "node-gateway",
    type: "gateway",
    position: { x: 250, y: 100 },
    data: { label: "Gateway Externo", description: "Webhook recebido" },
  },

  // ========== CONTEÚDO ==========
  conteudoTexto: {
    id: "node-texto",
    type: "conteudo",
    position: { x: 500, y: 0 },
    data: {
      label: "Mensagem de Boas-vindas",
      contentType: "text",
      content: "Olá! Bem-vindo ao nosso fluxo!",
      isTelegram: false,
    },
  },
  conteudoImagem: {
    id: "node-imagem",
    type: "conteudo",
    position: { x: 500, y: 100 },
    data: {
      label: "Enviar Imagem",
      contentType: "image",
      mediaUrl: "https://exemplo.com/imagem.jpg",
      isTelegram: false,
    },
  },
  conteudoComBotoes: {
    id: "node-botoes",
    type: "conteudo",
    position: { x: 500, y: 200 },
    data: {
      label: "Menu com Opções",
      contentType: "text",
      content: "Escolha uma opção:",
      buttons: [
        { id: "btn1", type: "flow", text: "Opção 1" },
        { id: "btn2", type: "flow", text: "Opção 2" },
      ],
      isTelegram: false,
    },
  },
  conteudoComCaptura: {
    id: "node-captura",
    type: "conteudo",
    position: { x: 500, y: 300 },
    data: {
      label: "Coletar Informações",
      contentType: "text",
      content: "Qual é seu nome?",
      collectName: true,
      collectEmail: true,
      collectWhatsapp: true,
      isTelegram: false,
    },
  },

  // ========== LÓGICA ==========
  condicaoSplit: {
    id: "node-split",
    type: "condicao",
    position: { x: 750, y: 0 },
    data: {
      label: "Split - Dividir Fluxo",
      branches: [
        { label: "Caminho A", value: "a" },
        { label: "Caminho B", value: "b" },
        { label: "Caminho C", value: "c" },
      ],
      isTelegram: false,
    },
  },
  condicaoIfElse: {
    id: "node-ifelse",
    type: "condicao",
    position: { x: 750, y: 100 },
    data: {
      label: "Condição If/Else",
      conditions: [
        { variable: "user_age", operator: "greater", compareValue: "18", dataType: "number" },
      ],
      isTelegram: false,
    },
  },
  condicaoHorario: {
    id: "node-horario",
    type: "condicao",
    position: { x: 750, y: 200 },
    data: {
      label: "Filtro por Horário",
      branches: [
        { label: "Dentro do Horário", value: "in" },
        { label: "Fora do Horário", value: "out" },
      ],
      isTelegram: false,
    },
  },
  condicaoTags: {
    id: "node-tags",
    type: "condicao",
    position: { x: 750, y: 300 },
    data: {
      label: "Filtro por Tags",
      branches: [
        { label: "Tag 1", value: "tag1" },
        { label: "Tag 2", value: "tag2" },
      ],
      isTelegram: false,
    },
  },

  // ========== AÇÃO ==========
  acao: {
    id: "node-acao",
    type: "acao",
    position: { x: 1000, y: 0 },
    data: { label: "Registrar Contato", actionType: "save_contact", isTelegram: false },
  },
  acaoTelegram: {
    id: "node-acao-telegram",
    type: "acao",
    position: { x: 1000, y: 50 },
    data: { label: "Enviar Ação", actionType: "send_message", isTelegram: true },
  },

  // ========== AGENDAMENTO ==========
  agendamentoSimples: {
    id: "node-agend1",
    type: "agendamento",
    position: { x: 1250, y: 0 },
    data: {
      label: "Agendar para depois",
      scheduleType: "once",
      scheduledAt: "2025-12-15T10:30:00Z",
      isTelegram: false,
    },
  },
  agendamentoRecorrente: {
    id: "node-agend2",
    type: "agendamento",
    position: { x: 1250, y: 100 },
    data: {
      label: "Recorrência Diária",
      scheduleType: "recurring",
      recurrencePattern: "Diariamente às 9h",
      isTelegram: false,
    },
  },

  // ========== IA ==========
  agenteIA: {
    id: "node-ia",
    type: "agenteIA",
    position: { x: 1500, y: 0 },
    data: {
      label: "Agente Inteligente",
      model: "claude-3-5-sonnet-latest",
      prompt: "Você é um assistente amigável. Responda de forma concisa.",
      isTelegram: false,
    },
  },
  agenteTool: {
    id: "node-tool",
    type: "agenteTool",
    position: { x: 1500, y: 100 },
    data: {
      label: "Busca na Web",
      toolName: "web-search",
      description: "Pesquisa informações na internet",
      category: "Busca",
    },
  },
} as const;

const TEMPLATES: Record<string, keyof typeof EXEMPLO_BLOCOS> = {
  inicio: "inicio",
  gatilho: "gatilho",
  gateway: "gateway",
  conteudo: "conteudoTexto",
  condicao: "condicaoSplit",
  acao: "acao",
  agendamento: "agendamentoSimples",
  agenteIA: "agenteIA",
  agenteTool: "agenteTool",
};

/**
 * Cria um novo nó com posição aleatória, baseado em um template do EXEMPLO_BLOCOS.
 */
export function criarNovoNode(type: string, label?: string) {
  const templateKey = TEMPLATES[type];
  const template = templateKey ? EXEMPLO_BLOCOS[templateKey] : undefined;

  if (!template) {
    throw new Error(`Tipo de bloco desconhecido: ${type}`);
  }

  return {
    ...template,
    id: `${type}-${Date.now()}`,
    position: { x: Math.random() * 500, y: Math.random() * 500 },
    data: {
      ...template.data,
      label: label || template.data.label,
    },
  };
}

/**
 * Valida se um nó tem todos os dados mínimos necessários para renderizar.
 */
export function validarNode(node: any): { valido: boolean; erros: string[] } {
  const erros: string[] = [];
  if (!node?.id) erros.push("ID do nó não definido");
  if (!node?.type) erros.push("Tipo do nó não definido");
  else if (!isValidNodeType(node.type)) erros.push(`Tipo de nó inválido: ${node.type}`);
  if (!node?.position) erros.push("Posição do nó não definida");
  if (!node?.data) erros.push("Dados do nó não definidos");
  if (node?.data && !node.data.label) erros.push("Label do nó não definido");
  return { valido: erros.length === 0, erros };
}