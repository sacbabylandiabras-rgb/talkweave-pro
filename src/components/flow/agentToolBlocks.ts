// src/components/flow/agentToolBlocks.ts
import {
  Wrench,
  Search,
  Database,
  FileText,
  BarChart3,
  Mail,
  Calendar,
  MapPin,
  Phone,
  Clock,
  Shield,
} from "lucide-react";

export interface AgentToolBlock {
  id: string;
  name: string;
  /** Alias for `name` used by drag-and-drop and node data */
  toolName: string;
  label: string;
  description: string;
  category: string;
  icon: any;
  /** Optional default instructions injected when this tool is added */
  instructions?: string;
}

/** dataTransfer key used when dragging an agent tool block onto the canvas */
export const AGENT_TOOL_DRAG_KEY = "application/x-agent-tool-block";

const RAW_AGENT_TOOL_BLOCKS: Omit<AgentToolBlock, "toolName">[] = [

/**
 * Catálogo de ferramentas disponíveis para o Agente IA
 * Adicione novas ferramentas aqui
 */
  // Ferramentas de Busca
  {
    id: "web-search",
    name: "web-search",
    label: "Busca Web",
    description: "Pesquisa informações na internet",
    category: "Busca",
    icon: Search,
  },
  {
    id: "knowledge-search",
    name: "knowledge-search",
    label: "Busca na Base de Conhecimento",
    description: "Busca em documentos internos",
    category: "Busca",
    icon: Database,
  },

  // Ferramentas de Dados
  {
    id: "data-lookup",
    name: "data-lookup",
    label: "Consulta de Dados",
    description: "Busca dados em banco de dados",
    category: "Dados",
    icon: Database,
  },
  {
    id: "data-update",
    name: "data-update",
    label: "Atualização de Dados",
    description: "Modifica dados em banco de dados",
    category: "Dados",
    icon: Database,
  },

  // Ferramentas de Relatórios
  {
    id: "generate-report",
    name: "generate-report",
    label: "Gerar Relatório",
    description: "Cria relatórios e documentos",
    category: "Relatórios",
    icon: FileText,
  },
  {
    id: "analytics",
    name: "analytics",
    label: "Análise de Dados",
    description: "Analisa métricas e dados",
    category: "Relatórios",
    icon: BarChart3,
  },

  // Ferramentas de Comunicação
  {
    id: "send-email",
    name: "send-email",
    label: "Enviar Email",
    description: "Envia emails aos usuários",
    category: "Comunicação",
    icon: Mail,
  },
  {
    id: "schedule-event",
    name: "schedule-event",
    label: "Agendar Evento",
    description: "Cria eventos no calendário",
    category: "Comunicação",
    icon: Calendar,
  },

  // Ferramentas de Localização
  {
    id: "location-service",
    name: "location-service",
    label: "Serviço de Localização",
    description: "Encontra endereços e rotas",
    category: "Localização",
    icon: MapPin,
  },

  // Ferramentas de Contato
  {
    id: "contact-info",
    name: "contact-info",
    label: "Informações de Contato",
    description: "Busca dados de contato",
    category: "Contato",
    icon: Phone,
  },

  // Ferramentas de Tempo
  {
    id: "time-check",
    name: "time-check",
    label: "Verificação de Horário",
    description: "Valida horários e zonas",
    category: "Tempo",
    icon: Clock,
  },

  // Ferramentas de Segurança
  {
    id: "verify-identity",
    name: "verify-identity",
    label: "Verificação de Identidade",
    description: "Valida informações do usuário",
    category: "Segurança",
    icon: Shield,
  },
];

/** Public catalogue with `toolName` derived from `name` */
export const AGENT_TOOL_BLOCKS: AgentToolBlock[] = RAW_AGENT_TOOL_BLOCKS.map((b) => ({
  ...b,
  toolName: b.name,
}));

/** All distinct categories, in declaration order */
export const AGENT_TOOL_CATEGORIES: string[] = Array.from(
  new Set(AGENT_TOOL_BLOCKS.map((b) => b.category)),
);

/**
 * Encontra um bloco de ferramenta pelo nome
 * @param toolName - Nome da ferramenta (ex: "web-search")
 * @returns Bloco de ferramenta ou undefined
 */
export function findAgentToolBlock(toolName: string): AgentToolBlock | undefined {
  if (!toolName) return undefined;
  return AGENT_TOOL_BLOCKS.find(
    (block) => block.id === toolName || block.name === toolName || block.label.toLowerCase() === toolName.toLowerCase(),
  );
}

/**
 * Lista todas as ferramentas de uma categoria
 */
export function getToolsByCategory(category: string): AgentToolBlock[] {
  return AGENT_TOOL_BLOCKS.filter((block) => block.category === category);
}

/**
 * Lista todas as categorias disponíveis
 */
export function getAllCategories(): string[] {
  return Array.from(new Set(AGENT_TOOL_BLOCKS.map((block) => block.category)));
}
