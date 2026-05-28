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
  Star,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export interface AgentToolBlock {
  toolName: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: string;
  instructions: string;
}

export const AGENT_TOOL_BLOCKS: AgentToolBlock[] = [
  // Agentes IA
  { category: "Agentes IA", toolName: "agente_tool", label: "Agente Tool", description: "Sub-agente que processa como tool e retorna resultado", icon: Bot, instructions: "Use esta ferramenta para delegar uma sub-tarefa a outro agente especializado. Envie o contexto necessário e aguarde o resultado antes de continuar a resposta ao lead." },
  { category: "Agentes IA", toolName: "expert_tool", label: "Expert Tool", description: "Sub-expert que processa e retorna JSON estruturado", icon: Sparkles, instructions: "Acione um expert quando precisar de uma análise estruturada (JSON) sobre um tema específico. Use o JSON retornado para tomar decisões, não exiba ao lead." },

  // Ferramentas de Conhecimento
  { category: "Conhecimento", toolName: "rag_documentos", label: "RAG", description: "Busca semântica em documentos", icon: BookOpen, instructions: "Use sempre que o lead fizer uma pergunta cuja resposta possa estar nos documentos da empresa. Cite somente informações encontradas; se não houver resultado, diga que não localizou." },
  { category: "Conhecimento", toolName: "buscar_produtos", label: "Produtos", description: "Consulta catálogo de produtos", icon: Package, instructions: "Consulte o catálogo quando o lead perguntar sobre preços, disponibilidade, planos ou características de produtos. Nunca invente valores: use somente os dados retornados." },
  { category: "Conhecimento", toolName: "politicas_regras", label: "Políticas e Regras", description: "Acessa regras e políticas da empresa", icon: ShieldCheck, instructions: "Consulte antes de responder dúvidas sobre trocas, devoluções, prazos, cancelamentos ou termos. Siga rigorosamente o que estiver nas políticas retornadas." },
  { category: "Conhecimento", toolName: "consultar_transacoes", label: "Transações", description: "Consulta histórico de compras do lead", icon: Receipt, instructions: "Use para verificar pedidos, pagamentos pendentes ou histórico de compras do lead antes de responder dúvidas financeiras ou de pós-venda." },
  { category: "Conhecimento", toolName: "enviar_transacao", label: "Enviar transação", description: "Envia mensagem de pagamento ao lead", icon: Send, instructions: "Acione quando o lead pedir o link de pagamento, segunda via, status ou comprovante. Informe o transaction_id corretamente." },
  { category: "Conhecimento", toolName: "ler_anexo", label: "Ler anexo do chat", description: "Lê arquivo enviado a partir da URL do anexo", icon: Paperclip, instructions: "Use sempre que o lead enviar PDF, planilha ou texto e for necessário entender o conteúdo para responder. Resuma e use o conteúdo extraído na resposta." },
  { category: "Conhecimento", toolName: "enviar_prova_social", label: "Prévia / Prova Social", description: "Envia depoimentos, prints e mídias de prova social ao lead", icon: Star, instructions: "Use quando o lead pedir prévia do produto, depoimentos, resultados, prints, vídeos ou qualquer prova social. Busque a mídia mais relevante na base e envie diretamente ao lead com legenda apropriada." },
  { category: "Conhecimento", toolName: "gerar_cobranca_gateway", label: "Gerar Cobrança (Gateway)", description: "Gera uma cobrança PIX pelo gateway e envia ao lead", icon: CreditCard, instructions: "Use quando o lead confirmar interesse e quiser pagar. Informe productId (preferencial) ou amount em reais e uma descrição. A ferramenta gera o PIX (brcode + QR Code) via gateway configurado e retorna os dados para envio ao lead." },

  // Integração
  { category: "Integração", toolName: "consulta_api_ia", label: "Consulta API (IA)", description: "Chamada HTTP feita pelo agente IA", icon: Globe, instructions: "Use para consultar APIs externas (rastreio, CEP, sistemas internos). Monte os parâmetros conforme a documentação e use o retorno para responder o lead." },
  { category: "Integração", toolName: "acessar_links", label: "Acessar Links", description: "Acessa URLs mencionadas na conversa", icon: Link2, instructions: "Quando o lead enviar um link, acesse para entender o conteúdo antes de responder. Não execute ações no site, apenas leia." },
  { category: "Integração", toolName: "mcp_connect", label: "MCP", description: "Conecta ao Model Context Protocol", icon: Plug, instructions: "Use para acessar ferramentas externas conectadas via MCP. Selecione a ferramenta apropriada conforme a necessidade do lead." },
  { category: "Integração", toolName: "horario_atual", label: "Horário Atual", description: "Retorna data, hora e dia da semana", icon: Clock, instructions: "Use sempre que precisar referenciar data/hora atual, validar horário comercial ou calcular prazos. Nunca chute o horário." },

  // Atendimento
  { category: "Atendimento", toolName: "transferir_fila", label: "Transferir para Fila", description: "Envia lead para atendimento humano", icon: Users, instructions: "Use quando o lead pedir atendente humano, demonstrar insatisfação ou tiver dúvida fora do seu escopo. Informe o lead antes de transferir." },
  { category: "Atendimento", toolName: "transferir_estrategia", label: "Transferir para Estratégia", description: "Move para outra estratégia/funil", icon: ArrowRightLeft, instructions: "Use quando o lead se encaixar em outro fluxo (ex: suporte, vendas, pós-venda). Escolha a estratégia certa antes de transferir." },
  { category: "Atendimento", toolName: "chats_antigos", label: "Chats Antigos", description: "Acessa conversas anteriores do lead", icon: History, instructions: "Consulte antes de responder leads recorrentes para manter contexto e não repetir perguntas já feitas anteriormente." },
  { category: "Atendimento", toolName: "gerenciar_ticket_crm", label: "Gerenciar Ticket CRM", description: "Abre e atualiza tickets de suporte", icon: Ticket, instructions: "Use para criar, listar ou atualizar tickets de suporte do lead. Preencha título, descrição e prioridade conforme o caso." },
  { category: "Atendimento", toolName: "listar_equipe", label: "Listar usuários da equipe", description: "Lista membros da equipe disponíveis", icon: UserCog, instructions: "Use quando precisar atribuir um ticket, tarefa ou negócio a um membro específico da equipe." },
  { category: "Atendimento", toolName: "adicionar_tag", label: "Adicionar tag", description: "Adiciona tag ao lead durante o fluxo", icon: Tag, instructions: "Marque o lead com tags relevantes (ex: 'interessado', 'lead-quente', 'sem-interesse') conforme o desenrolar da conversa." },
  { category: "Atendimento", toolName: "finalizar_atendimento", label: "Finalizar Atendimento", description: "Encerra o atendimento do lead", icon: CheckCircle2, instructions: "Encerre o atendimento quando o lead confirmar que sua dúvida foi resolvida ou quando não houver mais interação esperada." },

  // Persistência
  { category: "Persistência", toolName: "extrair_dados", label: "Extrair Dados", description: "Extrai informações da conversa e salva", icon: Database, instructions: "Capture e salve dados importantes do lead durante a conversa (nome, email, CPF, interesse). Salve assim que o dado for informado." },
  { category: "Persistência", toolName: "agenda_eventos", label: "Agenda", description: "Cria agendamentos para o lead", icon: CalendarClock, instructions: "Use para criar agendamentos. Confirme com o lead data, hora e assunto antes de salvar." },
  { category: "Persistência", toolName: "atualizar_memoria", label: "Atualizar Memória Atendimento", description: "Salva contexto do atendimento", icon: Brain, instructions: "Atualize a memória sempre que descobrir informações novas sobre o lead que devem persistir entre conversas." },
  { category: "Persistência", toolName: "criar_tarefa_crm", label: "Criar tarefa CRM no lead", description: "Cria tarefa vinculada ao lead no CRM", icon: ClipboardList, instructions: "Crie tarefas no CRM para follow-ups, retornos agendados ou ações pendentes vinculadas ao lead." },
  { category: "Persistência", toolName: "gerenciar_negocio_crm", label: "Gerenciar Negócio CRM", description: "Cria e atualiza negócios no pipeline", icon: Briefcase, instructions: "Crie ou atualize negócios (cards) no pipeline conforme o lead avança nas etapas de venda. Mova de etapa quando houver progresso real." },
  { category: "Persistência", toolName: "consultar_crm_ia", label: "Consultar dados do CRM pela IA", description: "Busca dados do lead no CRM", icon: Search, instructions: "Consulte os dados do lead no CRM antes de responder para personalizar a abordagem com base no histórico." },
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