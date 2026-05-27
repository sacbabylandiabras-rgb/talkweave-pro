import {
  Bot,
  Sparkles,
  BookOpen,
  Package,
  ShieldCheck,
  Receipt,
  Send,
  Paperclip,
  Globe,
  Link2,
  Plug,
  Clock,
  Users,
  ArrowRightLeft,
  History,
  Ticket,
  UserCog,
  Tag,
  CheckCircle2,
  Database,
  CalendarClock,
  Brain,
  ClipboardList,
  Briefcase,
  Search,
  type LucideIcon,
} from "lucide-react";

export interface AgentToolBlock {
  toolName: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: string;
}

export const AGENT_TOOL_BLOCKS: AgentToolBlock[] = [
  // Agentes IA
  { category: "Agentes IA", toolName: "agente_tool", label: "Agente Tool", description: "Sub-agente que processa como tool e retorna resultado", icon: Bot },
  { category: "Agentes IA", toolName: "expert_tool", label: "Expert Tool", description: "Sub-expert que processa e retorna JSON estruturado", icon: Sparkles },

  // Ferramentas de Conhecimento
  { category: "Conhecimento", toolName: "rag_documentos", label: "RAG", description: "Busca semântica em documentos", icon: BookOpen },
  { category: "Conhecimento", toolName: "buscar_produtos", label: "Produtos", description: "Consulta catálogo de produtos", icon: Package },
  { category: "Conhecimento", toolName: "politicas_regras", label: "Políticas e Regras", description: "Acessa regras e políticas da empresa", icon: ShieldCheck },
  { category: "Conhecimento", toolName: "consultar_transacoes", label: "Transações", description: "Consulta histórico de compras do lead", icon: Receipt },
  { category: "Conhecimento", toolName: "enviar_transacao", label: "Enviar transação", description: "Envia mensagem de pagamento ao lead", icon: Send },
  { category: "Conhecimento", toolName: "ler_anexo", label: "Ler anexo do chat", description: "Lê arquivo enviado a partir da URL do anexo", icon: Paperclip },

  // Integração
  { category: "Integração", toolName: "consulta_api_ia", label: "Consulta API (IA)", description: "Chamada HTTP feita pelo agente IA", icon: Globe },
  { category: "Integração", toolName: "acessar_links", label: "Acessar Links", description: "Acessa URLs mencionadas na conversa", icon: Link2 },
  { category: "Integração", toolName: "mcp_connect", label: "MCP", description: "Conecta ao Model Context Protocol", icon: Plug },
  { category: "Integração", toolName: "horario_atual", label: "Horário Atual", description: "Retorna data, hora e dia da semana", icon: Clock },

  // Atendimento
  { category: "Atendimento", toolName: "transferir_fila", label: "Transferir para Fila", description: "Envia lead para atendimento humano", icon: Users },
  { category: "Atendimento", toolName: "transferir_estrategia", label: "Transferir para Estratégia", description: "Move para outra estratégia/funil", icon: ArrowRightLeft },
  { category: "Atendimento", toolName: "chats_antigos", label: "Chats Antigos", description: "Acessa conversas anteriores do lead", icon: History },
  { category: "Atendimento", toolName: "gerenciar_ticket_crm", label: "Gerenciar Ticket CRM", description: "Abre e atualiza tickets de suporte", icon: Ticket },
  { category: "Atendimento", toolName: "listar_equipe", label: "Listar usuários da equipe", description: "Lista membros da equipe disponíveis", icon: UserCog },
  { category: "Atendimento", toolName: "adicionar_tag", label: "Adicionar tag", description: "Adiciona tag ao lead durante o fluxo", icon: Tag },
  { category: "Atendimento", toolName: "finalizar_atendimento", label: "Finalizar Atendimento", description: "Encerra o atendimento do lead", icon: CheckCircle2 },

  // Persistência
  { category: "Persistência", toolName: "extrair_dados", label: "Extrair Dados", description: "Extrai informações da conversa e salva", icon: Database },
  { category: "Persistência", toolName: "agenda_eventos", label: "Agenda", description: "Cria agendamentos para o lead", icon: CalendarClock },
  { category: "Persistência", toolName: "atualizar_memoria", label: "Atualizar Memória Atendimento", description: "Salva contexto do atendimento", icon: Brain },
  { category: "Persistência", toolName: "criar_tarefa_crm", label: "Criar tarefa CRM no lead", description: "Cria tarefa vinculada ao lead no CRM", icon: ClipboardList },
  { category: "Persistência", toolName: "gerenciar_negocio_crm", label: "Gerenciar Negócio CRM", description: "Cria e atualiza negócios no pipeline", icon: Briefcase },
  { category: "Persistência", toolName: "consultar_crm_ia", label: "Consultar dados do CRM pela IA", description: "Busca dados do lead no CRM", icon: Search },
];

export const AGENT_TOOL_CATEGORIES = [
  "Agentes IA",
  "Conhecimento",
  "Integração",
  "Atendimento",
  "Persistência",
];

export const AGENT_TOOL_DRAG_KEY = "application/agent-tool";

export function findAgentToolBlock(toolName: string): AgentToolBlock | undefined {
  return AGENT_TOOL_BLOCKS.find((b) => b.toolName === toolName);
}