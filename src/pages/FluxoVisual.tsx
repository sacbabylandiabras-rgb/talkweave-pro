import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  BackgroundVariant,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { useFlowLeadPositions } from "@/hooks/useFlowLeadPositions";
import { FlowLeadOverlay } from "@/components/flow/FlowLeadOverlay";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import FlowCapturedDataDialog from "@/components/flow/FlowCapturedDataDialog";
import { MemoriaAtendimentoEditor } from "@/components/flow/MemoriaAtendimentoEditor";
import { ResumoConversaEditor } from "@/components/flow/ResumoConversaEditor";
import { AdicionarTagsEditor } from "@/components/flow/AdicionarTagsEditor";
import { ListarDadosCrmEditor } from "@/components/flow/ListarDadosCrmEditor";
import { VincularRecursoCrmEditor } from "@/components/flow/VincularRecursoCrmEditor";
import { DelayEditor } from "@/components/flow/DelayEditor";
import { AdicionarMsgChatEditor } from "@/components/flow/AdicionarMsgChatEditor";
import { EnviarEmailEditor } from "@/components/flow/EnviarEmailEditor";
import { TrocarDepartamentoEditor } from "@/components/flow/TrocarDepartamentoEditor";
import { DirecionarFilaEditor } from "@/components/flow/DirecionarFilaEditor";
import { TrocarEstrategiaEditor } from "@/components/flow/TrocarEstrategiaEditor";
import { SupervisorEditor } from "@/components/flow/SupervisorEditor";
import { FimFluxoEditor } from "@/components/flow/FimFluxoEditor";
import { FinalizarAtendimentoEditor } from "@/components/flow/FinalizarAtendimentoEditor";
import { ExpertIAEditor } from "@/components/flow/ExpertIAEditor";
import { LeaderIAEditor } from "@/components/flow/LeaderIAEditor";
import { AtualizarLeadEditor } from "@/components/flow/AtualizarLeadEditor";
import { CriarRegistroCrmEditor } from "@/components/flow/CriarRegistroCrmEditor";
import {
  PlayCircle,
  MessageSquare,
  FileText,
  GitBranch,
  Zap,
  Save,
  Plus,
  Send,
  Workflow,
  ArrowLeft,
   Trash2,
   RefreshCw,
  Upload,
  Key,
  Download,
  FileUp,
  Eye,
  X,
  Image,
  Video,
  Mic,
  GripVertical,
  Link2,
  MessageCircle,
  Phone as PhoneIcon,
  CalendarClock,
  ArrowRight,
  MousePointerClick,
  Info,
  Mail,
  User,
  Database,
  Users,
  Sparkles,
  Bot,
  Globe,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { BlocoInicialNode } from "@/components/flow/BlocoInicialNode";
import { BlocoConteudoNode } from "@/components/flow/BlocoConteudoNode";
import { BlocoCondicaoNode } from "@/components/flow/BlocoCondicaoNode";
import { BlocoAcaoNode } from "@/components/flow/BlocoAcaoNode";
import { BlocoGatilhoNode } from "@/components/flow/BlocoGatilhoNode";
import { BlocoAgendamentoNode } from "@/components/flow/BlocoAgendamentoNode";
import { BlocoAgenteIANode } from "@/components/flow/BlocoAgenteIANode";
import { BlocoAgentToolNode } from "@/components/flow/BlocoAgentToolNode";
import { AGENT_TOOL_DRAG_KEY } from "@/components/flow/agentToolBlocks";
import { AgentToolConfigPanel } from "@/components/flow/AgentToolConfigPanel";
import { AddBlockDialog, type AddBlockSelection } from "@/components/flow/AddBlockDialog";
import { SelectContactsDialog } from "@/components/flow/SelectContactsDialog";
import type { FlowSendProvider } from "@/components/flow/SelectContactsDialog";
import { FlowTemplatesDialog } from "@/components/flow/FlowTemplatesDialog";
import type { FlowTemplate } from "@/components/flow/flowTemplates";
import { useZapi } from "@/hooks/useZapi";
import { useZapiInstances, type ZapiInstance } from "@/hooks/useZapiInstances";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

async function getInvokeErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (typeof error === "object" && error !== null && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        const detail = payload?.details ? ` | detalhes: ${JSON.stringify(payload.details).slice(0, 500)}` : "";
        const message = payload?.error || payload?.message || fallback;
        return `Falha no envio (HTTP ${context.status}): ${message}${detail}`;
      } catch {
        try {
          const text = await context.clone().text();
          if (text) return `Falha no envio (HTTP ${context.status}): ${text.slice(0, 700)}`;
        } catch {}
      }
    }
  }
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

const formatSendFailurePayload = (data: any, fallback: string) => {
  if (!data) return fallback;
  const message = data?.error || data?.message || fallback;
  const details = data?.details ? ` | detalhes: ${JSON.stringify(data.details).slice(0, 500)}` : "";
  return `${message}${details}`;
};

const hasConfirmedSendResponse = (payload: any): boolean => {
  if (!payload) return false;
  if (payload.success === true) return true;

  const candidates = [payload, payload.data, payload.details, payload.result].filter(Boolean);
  return candidates.some((item) => {
    const status = String(item?.status || item?.messageStatus || item?.state || item?.result || "").toLowerCase();
    return Boolean(
      item?.messageId ||
      item?.zapiMessageId ||
      item?.zaapId ||
      item?.id ||
      item?.key?.id ||
      item?.message?.id ||
      item?.queued === true ||
      item?.enqueued === true ||
      ["success", "queued", "queue", "pending", "processing", "accepted"].includes(status)
    );
  });
};

async function getSendFailureMessage(data: any, error: unknown, fallback: string) {
  if (hasConfirmedSendResponse(data)) return null;
  if (error) return await getInvokeErrorMessage(error, fallback);
  if (data?.error || data?.success === false) return formatSendFailurePayload(data, fallback);
  return null;
}

const nodeTypes: NodeTypes = {
  blocoInicial: BlocoInicialNode,
  blocoConteudo: BlocoConteudoNode,
  blocoCondicao: BlocoCondicaoNode,
  blocoAcao: BlocoAcaoNode,
  blocoGatilho: BlocoGatilhoNode,
  blocoAgendamento: BlocoAgendamentoNode,
  agenteIA: BlocoAgenteIANode,
  agentTool: BlocoAgentToolNode,
};

const initialNodes: Node[] = [
  {
    id: "1",
    type: "blocoInicial",
    position: { x: 250, y: 50 },
    data: { label: "Bloco Inicial", description: "Seu fluxo começa por este bloco. Conecte com outro bloco." },
  },
];

const initialEdges: Edge[] = [];

const isMensagemAudioBlock = (node?: Node | null) => {
  const label = String(node?.data?.label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    node?.type === "blocoConteudo" &&
    (label.includes("mensagem em audio") || label.includes("elevenlabs"))
  );
};

const isMensagemPredefinidaBlock = (node?: Node | null) => {
  const label = String(node?.data?.label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return node?.type === "blocoConteudo" && label.includes("predefinida");
};

const mapTemplateTypeToContentType = (t?: string) => {
  switch ((t || "texto").toLowerCase()) {
    case "carrossel":
      return "media-carousel";
    case "imagem":
      return "image";
    case "video":
    case "vídeo":
      return "video";
    case "audio":
    case "áudio":
      return "audio";
    case "documento":
    case "arquivo":
      return "document";
    case "lista":
      return "list";
    case "botoes":
    case "botões":
      return "interactive";
    default:
      return "text";
  }
};

const parseVoiceGenerationError = async (error: unknown, data?: any) => {
  const fallback = {
    title: "Não foi possível gerar o áudio",
    description:
      "A geração de voz não respondeu como esperado. Tente novamente em alguns minutos ou verifique se os créditos do serviço de voz estão ativos.",
  };

  const buildMessage = (payload?: any) => {
    if (!payload) return fallback;
    const title = String(payload.error || fallback.title);
    const parts = [payload.details, payload.hint]
      .filter(Boolean)
      .map((part) => String(part));

    return {
      title,
      description: parts.length ? parts.join(" ") : fallback.description,
    };
  };

  if (data?.error) return buildMessage(data);

  const maybeError = error as any;
  const response = maybeError?.context;

  if (response instanceof Response) {
    try {
      return buildMessage(await response.clone().json());
    } catch {
      return fallback;
    }
  }

  const message = maybeError?.message ? String(maybeError.message) : "";
  if (message && !message.toLowerCase().includes("non-2xx")) {
    return { title: "Não foi possível gerar o áudio", description: message };
  }

  return fallback;
};

const blocosDisponiveis = [
  // AGENTES IA
  {
    type: "agenteIA",
    label: "Agente IA",
    icon: Bot,
    description: "Agente autônomo que conversa e usa ferramentas",
    category: "Agentes IA",
  },
  {
    type: "blocoCondicao",
    label: "Roteador",
    icon: GitBranch,
    description: "Direciona o fluxo com base na conversa",
    category: "Agentes IA",
  },

  // ENVIO DE MENSAGENS
  {
    type: "blocoConteudo",
    label: "Conteúdo",
    icon: MessageSquare,
    description: "Enviar mensagem de texto, mídia ou arquivo",
    category: "Envio de Mensagens",
  },
  {
    type: "blocoConteudo",
    label: "Mensagem de Texto",
    icon: MessageCircle,
    description: "Envia resposta em texto para o lead",
    category: "Envio de Mensagens",
  },
  {
    type: "blocoConteudo",
    label: "Mensagem em Áudio",
    icon: Mic,
    description: "Envia um arquivo de áudio para o lead",
    category: "Envio de Mensagens",
    extraData: { contentType: "audio" },
  },
  {
    type: "blocoConteudo",
    label: "ElevenLabs Audio",
    icon: Mic,
    description: "Áudio com voz premium ElevenLabs",
    category: "Envio de Mensagens",
  },
  {
    type: "blocoConteudo",
    label: "Mensagem Predefinida",
    icon: FileText,
    description: "Mensagem fixa sem processamento IA",
    category: "Envio de Mensagens",
  },
  {
    type: "blocoAcao",
    label: "Digitando",
    icon: MessageSquare,
    description: "Exibe \"digitando...\" por 5 segundos",
    category: "Envio de Mensagens",
    extraData: { actionType: "typing", typingDuration: 5 },
  },
  {
    type: "blocoConteudo",
    label: "Template WhatsApp Oficial",
    icon: FileText,
    description: "Envia template aprovado por dispositivo (sessão fechada)",
    category: "Envio de Mensagens",
  },

  // DECISÕES E CONDICIONAIS
  {
    type: "blocoCondicao",
    label: "Condição",
    icon: GitBranch,
    description: "Criar ramificações no fluxo",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Condição If/Else",
    icon: GitBranch,
    description: "Múltiplas saídas baseadas em condições",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Condição IF",
    icon: GitBranch,
    description: "Se verdadeiro continua, se falso para",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Split",
    icon: GitBranch,
    description: "Divide fluxo em caminhos paralelos",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Decisão por Tags",
    icon: GitBranch,
    description: "Direciona baseado nas tags do lead",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Decisão por Horário",
    icon: CalendarClock,
    description: "Direciona por horário de funcionamento",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Filtro por Cadastro",
    icon: User,
    description: "Filtra por campos personalizados do lead",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Filtro por Mensagem",
    icon: MessageCircle,
    description: "Filtra pela última mensagem do lead",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Filtro por Status do Atendimento",
    icon: Info,
    description: "Direciona por status: na fila, humano, agente ou finalizado",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Filtro por Sessão WhatsApp",
    icon: PhoneIcon,
    description: "Verifica sessão aberta/fechada em dispositivo oficial",
    category: "Decisões e Condicionais",
  },
  {
    type: "blocoCondicao",
    label: "Filtro por Follow Up",
    icon: GitBranch,
    description: "Direciona se a task veio de mensagem follow up (status 11)",
    category: "Decisões e Condicionais",
  },

  // FERRAMENTAS DE INTEGRAÇÃO
  {
    type: "blocoAcao",
    label: "Ação",
    icon: Zap,
    description: "Executar uma ação específica",
    category: "Ferramentas de Integração",
  },
  {
    type: "blocoAcao",
    label: "Chamada de API",
    icon: Globe,
    description: "Requisição HTTP direta (GET, POST, PUT, DELETE)",
    category: "Ferramentas de Integração",
  },

  // PERSISTÊNCIA DE DADOS
  {
    type: "blocoAcao",
    label: "Memória de Atendimento",
    icon: Database,
    description: "Salva dados temporários do atendimento atual",
    category: "Persistência de Dados",
  },
  {
    type: "blocoAcao",
    label: "Memória de Lead",
    icon: Database,
    description: "Salva no cadastro do lead (permanente)",
    category: "Persistência de Dados",
  },
  {
    type: "blocoAcao",
    label: "Memória de Projeto",
    icon: Database,
    description: "Salva dados globais do projeto (todos os leads)",
    category: "Persistência de Dados",
  },
  {
    type: "blocoAcao",
    label: "Resumo de Conversa",
    icon: FileText,
    description: "Cria resumo dos atendimentos e compacta o chat atual quando necessário",
    category: "Persistência de Dados",
  },
  {
    type: "blocoAcao",
    label: "Adicionar Tags",
    icon: Plus,
    description: "Adiciona tags ao cadastro do lead",
    category: "Persistência de Dados",
  },
  {
    type: "blocoAcao",
    label: "Remover Tags",
    icon: X,
    description: "Remove tags do cadastro do lead",
    category: "Persistência de Dados",
  },
  {
    type: "blocoAcao",
    label: "Atualizar Lead",
    icon: User,
    description: "Atualiza campos do cadastro do lead",
    category: "Persistência de Dados",
  },
  {
    type: "blocoAcao",
    label: "Criar Registro CRM",
    icon: Plus,
    description: "Cria negócio, ticket ou tarefa no CRM",
    category: "Persistência de Dados",
  },
  {
    type: "blocoAcao",
    label: "Listar Dados CRM",
    icon: Database,
    description: "Lista negócios, tickets, transações e outros recursos do lead",
    category: "Persistência de Dados",
  },
  {
    type: "blocoAcao",
    label: "Vincular Recurso CRM",
    icon: Link2,
    description: "Cria associação entre dois recursos do CRM",
    category: "Persistência de Dados",
  },

  // GATILHOS
  {
    type: "blocoGatilho",
    label: "Gatilho",
    icon: Key,
    description: "Palavra-chave que dispara o fluxo",
    category: "Gatilhos",
  },

  // CONTROLE DE FLUXO
  {
    type: "blocoAgendamento",
    label: "Agendamento",
    icon: CalendarClock,
    description: "Agendar envio para data/hora específica",
    category: "Controle de Fluxo",
  },
  {
    type: "blocoAcao",
    label: "Delay",
    icon: CalendarClock,
    description: "Aguarda tempo antes de continuar",
    category: "Controle de Fluxo",
  },
  {
    type: "blocoAcao",
    label: "Adicionar Msg ao Chat",
    icon: MessageCircle,
    description: "Monta mensagem com variáveis dinâmicas",
    category: "Controle de Fluxo",
  },
  {
    type: "blocoAcao",
    label: "Enviar Email",
    icon: Mail,
    description: "Monta e envia email com variáveis dinâmicas",
    category: "Controle de Fluxo",
  },

  // FINALIZAÇÃO
  {
    type: "blocoAcao",
    label: "Trocar Departamento",
    icon: Users,
    description: "Envia lead para outro departamento",
    category: "Finalização",
  },
  {
    type: "blocoAcao",
    label: "Direcionar para Fila",
    icon: ArrowRight,
    description: "Coloca na fila do departamento atual",
    category: "Finalização",
  },
  {
    type: "blocoAcao",
    label: "Trocar Estratégia",
    icon: RefreshCw,
    description: "Transfere para outra estratégia/robô",
    category: "Finalização",
  },
  {
    type: "blocoAcao",
    label: "Finalizar Atendimento",
    icon: X,
    description: "Encerra o atendimento do lead",
    category: "Finalização",
  },
  {
    type: "blocoAcao",
    label: "Fim do Fluxo",
    icon: X,
    description: "Ponto final do processamento",
    category: "Finalização",
  },

  // AGENTE IA AVANÇADO
  {
    type: "agenteIA",
    label: "Leader IA",
    icon: Sparkles,
    description: "Coordenador que delega tarefas para Experts",
    category: "Agente IA Avançado",
  },
  {
    type: "agenteIA",
    label: "Expert IA",
    icon: Sparkles,
    description: "Especialista que executa tarefas específicas com IA",
    category: "Agente IA Avançado",
  },
  {
    type: "agenteIA",
    label: "Supervisor",
    icon: Eye,
    description: "Analisa e valida respostas dos Workers",
    category: "Agente IA Avançado",
  },
];

interface FlowAutomation {
  id: string;
  user_id: string;
  name: string;
  keyword: string;
  nodes: any[];
  edges: any[];
  active: boolean;
  created_at: string;
  updated_at: string;
  category?: string;
}

interface FluxoVisualProps {
  mode?: "contacts" | "groups" | "meta" | "telegram";
}

export default function FluxoVisual({ mode = "contacts" }: FluxoVisualProps = {}) {
  const isGroupsMode = mode === "groups";
  const isMetaMode = false;
  const isTelegramMode = mode === "telegram";
  const pageTitle = isTelegramMode
    ? "Fluxo Telegram"
    : isGroupsMode
      ? "Fluxo Grupos"
      : "Fluxos Visuais";
  const pageSubtitle = isTelegramMode
    ? "Crie automações visuais para bots do Telegram"
    : isGroupsMode
      ? "Crie automações visuais para grupos do WhatsApp"
      : "Crie automações visuais disparadas por palavra-chave";
  const emptyHelp = isTelegramMode
    ? "Crie seu primeiro fluxo visual para o Telegram"
    : isGroupsMode
      ? "Crie seu primeiro fluxo visual para grupos"
      : "Crie seu primeiro fluxo visual para automatizar conversas no WhatsApp";
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [nomeFluxo, setNomeFluxo] = useState("Novo Fluxo");
  const [keywordFluxo, setKeywordFluxo] = useState("");
  const [fluxoAtivo, setFluxoAtivo] = useState(true);
  const [currentFluxoId, setCurrentFluxoId] = useState<string | null>(null);
  const [fluxosSalvos, setFluxosSalvos] = useState<FlowAutomation[]>([]);
  const leadPositions = useFlowLeadPositions(currentFluxoId);
  const [showFluxosList, setShowFluxosList] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingFluxo, setSavingFluxo] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [showContactsDialog, setShowContactsDialog] = useState(false);
  const [showAddBlockDialog, setShowAddBlockDialog] = useState(false);
  const [pendingAgentConnection, setPendingAgentConnection] = useState<
    | {
        sourceId: string;
        sourceHandle: string | null;
        position: { x: number; y: number };
      }
    | null
  >(null);
  const connectingFromAgentRef = useRef<{ sourceId: string; sourceHandle: string | null } | null>(null);
  const { sendMessage, sendImage, sendVideo, sendAudio, sendDocument, sendButtonActions } = useZapi();
  const { instances: zapiInstances } = useZapiInstances({
    includeMeta: false,
    provider: "zapi",
  });
  const { data: metaCreds } = useMetaCredentials();

  const instances = useMemo(() => {
    // Se estivermos no modo Meta, priorizar a instância Meta na lista se ela existir
    if (isMetaMode) {
      return zapiInstances;
    }
    return zapiInstances;
  }, [zapiInstances, isMetaMode]);
  const { templates: messageTemplates } = useMessageTemplates();
  const [uploadingFile, setUploadingFile] = useState(false);
  const [generatingTts, setGeneratingTts] = useState(false);
  const [previewingTts, setPreviewingTts] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCapturedData, setShowCapturedData] = useState(false);
  const [editingConditionIndex, setEditingConditionIndex] = useState<number | null>(null);
  const [buttonStats, setButtonStats] = useState<Record<string, number>>({});
   const [totalFlowRecipients, setTotalFlowRecipients] = useState(0);
   const [availableTags, setAvailableTags] = useState<string[]>([]);
   const [loadingTags, setLoadingTags] = useState(false);

  // Para modo grupos: grupos pré-selecionados antes de criar/abrir o fluxo
  const [preselectedGroups, setPreselectedGroups] = useState<string[]>([]);
  const [preselectedInstanceIds, setPreselectedInstanceIds] = useState<string[]>([]);
  const [preselectedProvider, setPreselectedProvider] = useState<FlowSendProvider>("zapi");
  // Quando true, o diálogo de seleção é apenas para escolher grupos antes
  // de abrir o editor (não dispara envio ao confirmar).
  const [isSelectingPreGroups, setIsSelectingPreGroups] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const cancelSendRef = useRef(false);

  // Fetch button click stats for the current flow
  const fetchButtonStats = useCallback(async (flowName: string) => {
    try {
      // Get all button clicks related to this specific flow
      const { data: buttonClicks, error: btnErr } = await supabase
        .from('message_logs')
        .select('keyword_matched, message_received')
        .like('keyword_matched', '[Botão:%')
        .eq('response_sent', `[Fluxo: ${flowName}]`);

      if (btnErr || !buttonClicks) return;

      const stats: Record<string, number> = {};
      buttonClicks.forEach((log: any) => {
        const match = log.keyword_matched?.match(/\[Botão:\s*(.+?)\]/i);
        if (match) {
          const btnText = match[1].trim();
          stats[btnText] = (stats[btnText] || 0) + 1;
        }
      });
      setButtonStats(stats);

      // Get total unique recipients of this flow
      const { data: flowSends, error: flowErr } = await supabase
        .from('message_logs')
        .select('phone')
        .eq('keyword_matched', `__flow_send__:${flowName}`);

      if (!flowErr && flowSends) {
        const uniquePhones = new Set(flowSends.map((s: any) => s.phone));
        setTotalFlowRecipients(uniquePhones.size);
      }
    } catch (e) {
      console.error('Error fetching button stats:', e);
    }
  }, []);

  // Carregar fluxos do Supabase
  const fetchFluxos = async () => {
    try {
      setLoading(true);
      const category = isTelegramMode ? 'telegram' : (isMetaMode ? 'meta' : (isGroupsMode ? 'groups' : 'contacts'));
      const { data, error } = await (supabase as any)
        .from('flow_automations')
        .select('*')
        .eq('category', category)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setFluxosSalvos(data || []);
    } catch (error) {
      console.error("Erro ao carregar fluxos:", error);
      // Fallback to localStorage
      const savedFluxos = localStorage.getItem("fluxos_salvos");
      if (savedFluxos) {
        try {
          setFluxosSalvos(JSON.parse(savedFluxos));
        } catch (e) {
          console.error("Erro ao carregar fluxos do localStorage:", e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFluxos();
  }, [isGroupsMode]);

   const fetchTagsForEditor = useCallback(async () => {
     const activeInstances = instances.filter(i => (i.api_provider || 'zapi') === 'zapi' && i.is_active);
     if (activeInstances.length === 0) return;
 
     try {
       setLoadingTags(true);
       const defaultInst = activeInstances.find(i => i.is_default) || activeInstances[0];
       const instancesToTry = [defaultInst, ...activeInstances.filter(i => i.id !== defaultInst.id).slice(0, 2)];
       
       const allTagsSet = new Set<string>();
       
       for (const inst of instancesToTry) {
         const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
           body: { action: "list-tags", instanceDbId: inst.id },
         });
         
         if (!error && data) {
           const payload = data.data ?? data;
           if (Array.isArray(payload)) {
             payload.forEach((t: any) => {
               if (t.name) allTagsSet.add(t.name);
             });
             if (allTagsSet.size > 0) break;
           }
         }
       }
       
       setAvailableTags(Array.from(allTagsSet).sort());
     } catch (e) {
       console.error("Erro ao carregar etiquetas para o editor:", e);
     } finally {
       setLoadingTags(false);
     }
   }, [instances]);
 
   useEffect(() => {
     fetchTagsForEditor();
  }, [instances]);

  const handleNovoFluxo = () => {
    // Abre a galeria de modelos prontos
    setShowTemplatesDialog(true);
  };

  const proceedAfterTemplateChoice = () => {
    if (isGroupsMode) {
      setPreselectedGroups([]);
      setPreselectedInstanceIds([]);
      setPreselectedProvider("zapi");
      setIsSelectingPreGroups(true);
      setShowContactsDialog(true);
    } else {
      setShowFluxosList(false);
    }
  };

  const handleSelectTemplate = (tpl: FlowTemplate) => {
    setNomeFluxo(tpl.name);
    setKeywordFluxo(tpl.suggestedKeyword || "");
    setFluxoAtivo(true);
    setCurrentFluxoId(null);
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    setShowTemplatesDialog(false);
    toast.success(`Modelo "${tpl.name}" carregado!`);
    proceedAfterTemplateChoice();
  };

  const handleStartBlank = () => {
    setNomeFluxo("Novo Fluxo");
    setKeywordFluxo("");
    setFluxoAtivo(true);
    setCurrentFluxoId(null);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setShowTemplatesDialog(false);
    proceedAfterTemplateChoice();
  };

  const handleCarregarFluxo = (fluxo: FlowAutomation) => {
    setNomeFluxo(fluxo.name);
    setKeywordFluxo(fluxo.keyword || "");
    setFluxoAtivo(fluxo.active);
    setCurrentFluxoId(fluxo.id);
    setNodes(fluxo.nodes || initialNodes);
    setEdges(fluxo.edges || initialEdges);
    setShowFluxosList(false);
    fetchButtonStats(fluxo.name);
    toast.success(`Fluxo "${fluxo.name}" carregado!`);
  };

  const handleDuplicarFluxo = async (fluxo: FlowAutomation) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Faça login para duplicar fluxos");
        return;
      }

      const { error } = await (supabase as any)
        .from('flow_automations')
        .insert({
          user_id: user.id,
          name: `${fluxo.name} (cópia)`,
          keyword: fluxo.keyword ? `${fluxo.keyword}_copia` : "",
          nodes: fluxo.nodes,
          edges: fluxo.edges,
          active: false,
          category: isTelegramMode ? 'telegram' : (isMetaMode ? 'meta' : (isGroupsMode ? 'groups' : 'contacts')),
        });

      if (error) throw error;
      await fetchFluxos();
      toast.success("Fluxo duplicado com sucesso!");
    } catch (error) {
      console.error("Erro ao duplicar:", error);
      toast.error("Erro ao duplicar fluxo");
    }
  };

  const handleExcluirFluxo = async (fluxoId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('flow_automations')
        .delete()
        .eq('id', fluxoId);

      if (error) throw error;
      setFluxosSalvos(prev => prev.filter(f => f.id !== fluxoId));
      toast.success("Fluxo excluído!");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir fluxo");
    }
  };

  const handleToggleActive = async (fluxo: FlowAutomation) => {
    try {
      const { error } = await (supabase as any)
        .from('flow_automations')
        .update({ active: !fluxo.active })
        .eq('id', fluxo.id);

      if (error) throw error;
      setFluxosSalvos(prev => prev.map(f => f.id === fluxo.id ? { ...f, active: !f.active } : f));
      toast.success(fluxo.active ? "Fluxo desativado" : "Fluxo ativado");
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro ao atualizar fluxo");
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      console.log("Connecting:", params);
      return setEdges((eds) => addEdge({
        ...params,
        animated: true,
        style: { stroke: '#2563EB', strokeWidth: 3, zIndex: 1000 },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          color: '#2563EB',
          width: 20,
          height: 20
        },
      }, eds));
    },
    [setEdges]
  );

  const onConnectStart = useCallback(
    (_event: any, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
      if (!params.nodeId || params.handleType !== "source") {
        connectingFromAgentRef.current = null;
        return;
      }
      const node = nodes.find((n) => n.id === params.nodeId);
      if (node?.type === "agenteIA") {
        connectingFromAgentRef.current = { sourceId: params.nodeId, sourceHandle: params.handleId };
      } else {
        connectingFromAgentRef.current = null;
      }
    },
    [nodes]
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const info = connectingFromAgentRef.current;
      connectingFromAgentRef.current = null;
      if (!info || !reactFlowInstance) return;
      const target = event.target as HTMLElement | null;
      const droppedOnPane = !!target?.classList?.contains("react-flow__pane");
      if (!droppedOnPane) return;
      const clientX = "clientX" in event ? event.clientX : (event as TouchEvent).changedTouches?.[0]?.clientX ?? 0;
      const clientY = "clientY" in event ? event.clientY : (event as TouchEvent).changedTouches?.[0]?.clientY ?? 0;
      const position = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
      setPendingAgentConnection({ sourceId: info.sourceId, sourceHandle: info.sourceHandle, position });
      setShowAddBlockDialog(true);
    },
    [reactFlowInstance]
  );

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    toast.success("Conexão removida!");
  }, [setEdges]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (nodes.find(n => n.id === nodeId)?.type === "blocoInicial") {
      toast.error("Não é possível excluir o bloco inicial!");
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setIsEditDialogOpen(false);
    toast.success("Bloco removido!");
  }, [nodes, setNodes, setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const normalizedNode =
      isMensagemAudioBlock(node)
        ? { ...node, data: { ...node.data, contentType: "audio" } }
        : node;
    setSelectedNode(normalizedNode);
    setIsEditDialogOpen(true);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (typeof type === "undefined" || !type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let extraData: Record<string, unknown> = {};
      if (type === "agentTool") {
        try {
          const raw = event.dataTransfer.getData(AGENT_TOOL_DRAG_KEY);
          if (raw) extraData = JSON.parse(raw);
        } catch {
          extraData = {};
        }
      }

      const newNode: Node = {
        id: `${Date.now()}`,
        type,
        position,
        data: {
          label: `${type === "blocoConteudo" ? "Conteúdo" : type === "blocoCondicao" ? "Condição" : type === "blocoGatilho" ? "Gatilho" : type === "blocoAgendamento" ? "Agendamento" : type === "agenteIA" ? "Agente IA" : type === "agentTool" ? (extraData as any).label || "Ferramenta" : "Ação"}`,
          content: "",
          ...extraData,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      toast.success("Bloco adicionado ao fluxo!");
    },
    [reactFlowInstance, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSaveNode = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return { ...node, data: selectedNode.data };
        }
        return node;
      })
    );
    setIsEditDialogOpen(false);
    toast.success("Bloco atualizado!");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedNode) return;
    setUploadingFile(true);

    try {
      const fileExt = file.name.split('.').pop();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Usuário não autenticado");
      const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error } = await supabase.storage
        .from('flow-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('flow-media')
        .getPublicUrl(fileName);

      setSelectedNode({
        ...selectedNode,
        data: {
          ...selectedNode.data,
          mediaUrl: publicUrl,
          ...(selectedNode.data.contentType === "audio" ? { audioName: selectedNode.data.audioName || file.name } : {}),
        },
      });

      toast.success("Arquivo enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleGenerateTts = useCallback(async (mode: "save" | "preview") => {
    if (!selectedNode) return;
    const text = (selectedNode.data.ttsText || "").trim();
    if (!text) {
      toast.error("Digite o texto a ser narrado");
      return;
    }
    const apiKey = (selectedNode.data.ttsApiKey || "").trim();
    const voiceId = (selectedNode.data.ttsVoiceId || "EXAVITQu4vr4xnSDxMaL").trim();
    const stability = Number(selectedNode.data.ttsStability ?? 0.95);
    const similarityBoost = Number(selectedNode.data.ttsSimilarityBoost ?? 0.75);
    const style = Number(selectedNode.data.ttsStyle ?? 0.08);
    const speed = Number(selectedNode.data.ttsSpeed ?? 1);
    const useSpeakerBoost = selectedNode.data.ttsUseSpeakerBoost !== false;
    const audioName = (selectedNode.data.audioName || "").trim();

    if (!apiKey) {
      toast.error("Informe o Token API Key do ElevenLabs");
      return;
    }
    if (!voiceId) {
      toast.error("Informe o Voice ID");
      return;
    }

    if (mode === "preview") setPreviewingTts(true);
    else setGeneratingTts(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-tts-audio", {
        body: {
          text,
          apiKey,
          voiceId,
          stability,
          similarityBoost,
          style,
          speed,
          useSpeakerBoost,
          audioName,
          preview: mode === "preview",
        },
      });
      if (error || data?.error) {
        const friendlyError = await parseVoiceGenerationError(error, data);
        toast.error(friendlyError.title, { description: friendlyError.description, duration: 9000 });
        return;
      }

      if (mode === "preview") {
        if (!data?.audioBase64) throw new Error("Sem áudio retornado");
        const audio = new Audio(`data:${data.mimeType || "audio/mpeg"};base64,${data.audioBase64}`);
        await audio.play();
      } else {
        if (!data?.url) throw new Error("Sem URL de áudio");
        setSelectedNode((prev) =>
          prev
            ? {
                ...prev,
                data: {
                  ...prev.data,
                  mediaUrl: data.url,
                  contentType: "audio",
                  audioName: prev.data.audioName || data.audioName || "Áudio gerado",
                },
              }
            : prev
        );
        toast.success("Áudio gerado e salvo no bloco!");
      }
    } catch (err) {
      console.error("TTS error", err);
      const friendlyError = await parseVoiceGenerationError(err);
      toast.error(friendlyError.title, { description: friendlyError.description, duration: 9000 });
    } finally {
      setGeneratingTts(false);
      setPreviewingTts(false);
    }
  }, [selectedNode]);

  const handleSaveFluxo = async (): Promise<string | false> => {
    if (savingFluxo) return currentFluxoId || false;
    setSavingFluxo(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error("Faça login para salvar fluxos");
        console.error("Auth error:", authError);
        return false;
      }

      const normalizedName = (nomeFluxo || "").trim() || "Novo Fluxo";
      const nodesToPersist = selectedNode
        ? nodes.map((node) => node.id === selectedNode.id ? { ...node, data: selectedNode.data } : node)
        : nodes;

      // Serialize nodes/edges to plain JSON to avoid non-serializable data
      const serializedNodes = JSON.parse(JSON.stringify(nodesToPersist));
      const serializedEdges = JSON.parse(JSON.stringify(edges));

      const fluxoData = {
        user_id: user.id,
        name: normalizedName,
        keyword: (keywordFluxo || "").trim().toLowerCase(),
        nodes: serializedNodes,
        edges: serializedEdges,
        active: fluxoAtivo,
          category: isTelegramMode ? 'telegram' : (isMetaMode ? 'meta' : (isGroupsMode ? 'groups' : 'contacts')),
      };

      if (currentFluxoId) {
        const { data: updatedRows, error } = await (supabase as any)
          .from('flow_automations')
          .update(fluxoData)
          .eq('id', currentFluxoId)
          .eq('user_id', user.id)
          .select('id');

        if (error) {
          console.error("Erro ao atualizar fluxo:", error);
          toast.error(`Erro ao atualizar: ${error.message}`);
          return false;
        }

        if (!updatedRows || updatedRows.length === 0) {
          const { data: createdFlow, error: insertError } = await (supabase as any)
            .from('flow_automations')
            .insert(fluxoData)
            .select('id')
            .single();

          if (insertError) {
            console.error("Erro ao recriar fluxo:", insertError);
            toast.error(`Erro ao salvar: ${insertError.message}`);
            return false;
          }

          setCurrentFluxoId(createdFlow.id);
          setNodes(nodesToPersist);
          setNomeFluxo(normalizedName);
          await fetchFluxos();
          toast.success("Fluxo salvo com sucesso!");
          return createdFlow.id;
        }
      } else {
        const { data, error } = await (supabase as any)
          .from('flow_automations')
          .insert(fluxoData)
          .select('id')
          .single();

        if (error) {
          console.error("Erro ao inserir fluxo:", error);
          toast.error(`Erro ao salvar: ${error.message}`);
          return false;
        }

        setCurrentFluxoId(data.id);
        setNodes(nodesToPersist);
        setNomeFluxo(normalizedName);
        await fetchFluxos();
        toast.success("Fluxo salvo com sucesso!");
        return data.id;
      }

      setNodes(nodesToPersist);
      setNomeFluxo(normalizedName);
      await fetchFluxos();
      toast.success("Fluxo salvo com sucesso!");
      return currentFluxoId || false;
    } catch (error: any) {
      console.error("Erro ao salvar fluxo:", error);
      toast.error(`Erro ao salvar fluxo: ${error?.message || 'Erro desconhecido'}`);
      return false;
    } finally {
      setSavingFluxo(false);
    }
  };

  const handleExportJson = () => {
    const flowData = {
      name: nomeFluxo,
      keyword: keywordFluxo,
      active: fluxoAtivo,
      nodes,
      edges,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(flowData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeFluxo.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Fluxo exportado com sucesso!");
  };

  // Build preview messages by traversing the flow, simulating user replies on buttons
  const getPreviewMessages = useCallback(() => {
    type PreviewMsg = {
      id: string;
      direction: 'sent' | 'received';
      type: 'text' | 'image' | 'video' | 'audio' | 'document';
      content: string;
      mediaUrl?: string;
      buttons?: Array<{ text: string; type: string }>;
    };

    const normalizeType = (ct: string): PreviewMsg['type'] => {
      if (ct.startsWith('video')) return 'video';
      if (ct.startsWith('image') || ct === 'imagem' || ct.startsWith('imagem')) return 'image';
      if (ct.startsWith('audio')) return 'audio';
      if (ct === 'document' || ct === 'documento' || ct === 'arquivo') return 'document';
      return 'text';
    };

    const messages: PreviewMsg[] = [];
    const initialNode = nodes.find(n => n.type === 'blocoInicial');
    if (!initialNode) return messages;

    const visited = new Set<string>();
    let msgCounter = 0;

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const outgoing = edges
        .filter(e => e.source === nodeId)
        .sort((a, b) => {
          // Prioritize non-button handles first (default flow)
          const aPriority = a.sourceHandle?.startsWith('button-') ? 1 : 0;
          const bPriority = b.sourceHandle?.startsWith('button-') ? 1 : 0;
          if (aPriority !== bPriority) return aPriority - bPriority;
          const aTarget = nodes.find(n => n.id === a.target);
          const bTarget = nodes.find(n => n.id === b.target);
          return (aTarget?.position?.y ?? 0) - (bTarget?.position?.y ?? 0);
        });

      for (const edge of outgoing) {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!targetNode) continue;

        if (targetNode.type === 'blocoConteudo' && !visited.has(targetNode.id)) {
          const contentType = targetNode.data.contentType || 'text';
          const content = targetNode.data.content || '';
          const mediaUrl = targetNode.data.mediaUrl || '';
          const btns = Array.isArray(targetNode.data.buttons) ? targetNode.data.buttons : [];
          const hasButtons = btns.length > 0;

          // If has media AND buttons, send media first (like real flow)
          if (mediaUrl && hasButtons) {
            messages.push({
              id: `${targetNode.id}-media-${msgCounter++}`,
              direction: 'sent',
              type: normalizeType(contentType),
              content: '',
              mediaUrl,
            });
          }

          // Main message
          messages.push({
            id: `${targetNode.id}-${msgCounter++}`,
            direction: 'sent',
            type: (mediaUrl && !hasButtons) ? normalizeType(contentType) : 'text',
            content,
            mediaUrl: (mediaUrl && !hasButtons) ? mediaUrl : undefined,
            buttons: hasButtons ? btns.map((b: any, i: number) => ({
              text: b.text || `Botão ${i + 1}`,
              type: b.type || 'reply',
            })) : undefined,
          });

          // If has reply/flow buttons, simulate user clicking the first one
          const replyButtons = btns.filter((b: any) => b.type === 'reply' || b.type === 'flow');
          if (replyButtons.length > 0) {
            const firstBtn = replyButtons[0];
            messages.push({
              id: `reply-${targetNode.id}-${msgCounter++}`,
              direction: 'received',
              type: 'text',
              content: firstBtn.text || 'Botão 1',
            });

            // Follow the button's connection
            const btnIndex = btns.indexOf(firstBtn);
            const buttonEdge = edges.find(e => e.source === targetNode.id && e.sourceHandle === `button-${btnIndex}`);
            if (buttonEdge) {
              traverse(buttonEdge.target);
              continue; // Don't follow default path
            }
          }

          // Follow default outgoing edges from this content node
          traverse(targetNode.id);
        } else if (targetNode.type === 'blocoCondicao' && !visited.has(targetNode.id)) {
          // For condition nodes, traverse all branches
          traverse(targetNode.id);
        } else if (!visited.has(targetNode.id)) {
          traverse(targetNode.id);
        }
      }
    };

    traverse(initialNode.id);
    return messages;
  }, [nodes, edges]);


  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const flowData = JSON.parse(event.target?.result as string);

        if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
          toast.error("Arquivo JSON inválido: campo 'nodes' não encontrado");
          return;
        }

        setNodes(flowData.nodes);
        setEdges(flowData.edges || []);
        if (flowData.name) setNomeFluxo(flowData.name);
        if (flowData.keyword !== undefined) setKeywordFluxo(flowData.keyword);
        if (flowData.active !== undefined) setFluxoAtivo(flowData.active);
        setCurrentFluxoId(null);
        setShowFluxosList(false);

        toast.success("Fluxo importado com sucesso!");
      } catch {
        toast.error("Erro ao ler o arquivo JSON");
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be re-imported
    e.target.value = "";
  };

  const handleEnviarAgora = async () => {
    if (nodes.length <= 1) {
      toast.error("Adicione blocos ao fluxo antes de enviar!");
      return;
    }
    if (edges.length === 0) {
      toast.error("Conecte os blocos antes de enviar!");
      return;
    }
    const savedFlowId = await handleSaveFluxo();
    if (!savedFlowId) return;
    if (isGroupsMode && preselectedGroups.length > 0) {
      // Já temos os grupos selecionados — envia direto
      handleConfirmSend(
        preselectedGroups,
        preselectedInstanceIds.length > 0 ? preselectedInstanceIds : undefined,
        preselectedProvider
      );
      return;
    }
    setIsSelectingPreGroups(false);
    setShowContactsDialog(true);
  };

  const handleConfirmSend = async (selectedContacts: string[], instanceIds?: string[], provider?: FlowSendProvider) => {
    // Se for apenas pré-seleção de grupos antes do editor, não envia: salva e abre editor
    if (isSelectingPreGroups) {
      setPreselectedGroups(selectedContacts);
      setPreselectedInstanceIds(instanceIds || []);
      setPreselectedProvider(provider || "zapi");
      setIsSelectingPreGroups(false);
      setShowContactsDialog(false);
      setShowFluxosList(false);
      toast.success(`${selectedContacts.length} grupo(s) selecionado(s). Monte seu fluxo e clique em Enviar.`);
      return;
    }
    const recipientLabel = isGroupsMode ? "grupo" : "contato";
    toast.success(`Iniciando envio para ${selectedContacts.length} ${recipientLabel}(s)...`);

    try {
      cancelSendRef.current = false;
      setIsSending(true);
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || '';

      const savedFlowId = await handleSaveFluxo();
      if (!savedFlowId) {
        setIsSending(false);
        return;
      }

      const initialNode = nodes.find(n => n.type === "blocoInicial");
      if (!initialNode) {
        toast.error("Bloco inicial não encontrado!");
        setIsSending(false);
        return;
      }

      // Round-robin counter for instance rotation
      let sendCounter = 0;

        const sendToContacts = async () => {
          const promises = selectedContacts.map(async (contact, index) => {
            if (cancelSendRef.current) return;

            // Pequeno escalonamento para não disparar todos exatamente no mesmo milisegundo
            // mas permitir que os delays e agendamentos internos de cada fluxo rodem em paralelo
            await new Promise(resolve => setTimeout(resolve, index * 200));
            
            if (cancelSendRef.current) return;

            const visitedNodes = new Set<string>();
            let currentInstanceId = instanceIds && instanceIds.length > 0
              ? instanceIds[index % instanceIds.length]
              : undefined;
            
            try {
        const effectiveInstanceId = currentInstanceId || (isMetaMode && metaCreds?.phone_number_id ? `meta:${metaCreds.phone_number_id}` : undefined);
        if (isMetaMode && effectiveInstanceId) {
          console.log("[FluxoVisual] Envio Meta detectado:", effectiveInstanceId);
        }
        await processFlow(initialNode.id, contact, visitedNodes, effectiveInstanceId, currentUserId, provider || (isMetaMode ? "meta" : "zapi"), savedFlowId);
              sendCounter++;
            } catch (err) {
              console.error(`[FluxoVisual] Error sending to ${contact}:`, err);
            }
          });

          await Promise.all(promises);
        };

        await sendToContacts();

      if (cancelSendRef.current) {
        toast.info("Envio cancelado", {
          description: `Processados ${sendCounter} de ${selectedContacts.length} ${recipientLabel}(s)`,
        });
      } else {
        toast.success("Fluxo enviado com sucesso!", {
          description: `Mensagens enviadas para ${selectedContacts.length} ${recipientLabel}(s)`,
        });
      }
    } catch (error) {
      console.error("Erro ao enviar fluxo:", error);
      toast.error(await getInvokeErrorMessage(error, "Erro ao enviar fluxo"));
    } finally {
      setIsSending(false);
      cancelSendRef.current = false;
    }
  };

  const processFlow = async (currentNodeId: string, contact: string, visitedNodes: Set<string>, instanceId?: string, userId?: string, provider: FlowSendProvider = "zapi", flowIdForPending?: string) => {
    if (cancelSendRef.current) return;
    if (visitedNodes.has(currentNodeId)) return;
    visitedNodes.add(currentNodeId);

    const runtimeNodes = selectedNode
      ? nodes.map((node) => node.id === selectedNode.id ? { ...node, data: selectedNode.data } : node)
      : nodes;
    const runtimeEdges = edges;
    const nodeMap = new Map(runtimeNodes.map((n) => [n.id, n]));
    const outgoingEdges = runtimeEdges
      .filter((e) => e.source === currentNodeId)
      .sort((a, b) => {
        const handlePriority = (handle?: string | null) => {
          if (!handle || handle === "default") return 0;
          if (handle.startsWith("button-")) return 2;
          return 1;
        };

        const priorityDiff = handlePriority(a.sourceHandle) - handlePriority(b.sourceHandle);
        if (priorityDiff !== 0) return priorityDiff;

        const aTarget = nodeMap.get(a.target);
        const bTarget = nodeMap.get(b.target);
        const ay = aTarget?.position?.y ?? 0;
        const by = bTarget?.position?.y ?? 0;
        if (ay !== by) return ay - by;

        const ax = aTarget?.position?.x ?? 0;
        const bx = bTarget?.position?.x ?? 0;
        return ax - bx;
      });

    // Process source node if it has content (BlocoInicial or other message nodes)
    const currentNode = nodeMap.get(currentNodeId);
    const processNode = async (node: any) => {
      if (!node) return;
      
      if (node.type === "blocoConteudo" || node.type === "blocoInicial") {
        const delayMs = (node.data.delaySeconds || 0) * 1000;
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        const contentType = node.data.contentType || "text";
        const content = node.data.content || "";
        const mediaUrl = node.data.mediaUrl || "";

        if (!content && !mediaUrl && node.type !== "blocoInicial") return;
        
        const buttons = Array.isArray(node.data.buttons) ? node.data.buttons : [];
        const sendableButtons = buttons.filter((btn: any) => btn?.type && btn.type !== "flow");
        const flowButtons = buttons.filter((btn: any) => btn?.type === "flow");
        const allSendButtons = [
          ...sendableButtons,
          ...flowButtons.map((b: any) => ({ ...b, type: "reply" })),
        ];

        const wrapUrlWithTracking = (rawUrl: string, btnText: string, phone: string) => {
          const finalUrl = rawUrl.match(/^https?:\/\//i) ? rawUrl : `https://${rawUrl}`;
          const params = new URLSearchParams({
            url: finalUrl,
            flow: nomeFluxo,
            btn: btnText,
            uid: userId || '',
            ph: phone,
          });
          return `https://go.zaplynxpro.online/r?${params.toString()}`;
        };

        const sendWithInstance = async (payload: Record<string, any>, nodeData?: any) => {
          const finalPayload = { ...payload };
          const isGroup = contact.includes('@g.us') || contact.includes('-group');
          if (isGroup) {
            const numericId = contact.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '');
            finalPayload.phone = numericId ? `${numericId}-group` : contact;
            if (nodeData?.mentionAll) finalPayload.mentionAll = true;
          }

          const body = instanceId
            ? { ...finalPayload, instanceId, preferStandardConnection: true }
            : { ...finalPayload, preferStandardConnection: true };
          
          try {
            const { data, error } = await supabase.functions.invoke('send-message', { body });
            const failureMessage = await getSendFailureMessage(data, error, "Erro ao enviar fluxo");
            if (failureMessage) throw new Error(failureMessage);
          } catch (invokeErr) {
            console.error("[FluxoVisual] Error invoking send-message:", invokeErr);
            throw invokeErr;
          }
        };

        if (allSendButtons.length > 0) {
          const mappedButtons = allSendButtons.map((btn: any, idx: number) => {
            const type = (btn?.type || "reply").toString().toLowerCase();
            const value = (btn?.value || "").toString().trim();
            const label = (btn?.text || `Botão ${idx + 1}`).toString();
            if (type === "url") return { id: String(idx + 1), type: "URL" as const, label, url: wrapUrlWithTracking(value, label, contact) };
            if (type === "call") return { id: String(idx + 1), type: "CALL" as const, label, phone: value };
            return { id: btn.id || String(idx + 1), type: "REPLY" as const, label };
          });

          if (contentType === "image" && mediaUrl) {
            await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'image', message: '' }, node.data);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (contentType === "video" && mediaUrl) {
            await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'video', message: '', ...(node.data.viewOnce ? { viewOnce: true } : {}), ...(node.data.isPtv ? { isPtv: true } : {}) }, node.data);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (contentType === "audio" && mediaUrl) {
            await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'audio', message: '' }, node.data);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (contentType === "document" && mediaUrl) {
            await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'document', message: 'document' }, node.data);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const hasUrlButtons = mappedButtons.some(b => b.type === "URL");
          const hasCallButtons = mappedButtons.some(b => b.type === "CALL");
          if (hasUrlButtons || hasCallButtons) {
            await sendWithInstance({ phone: contact, message: content || "Escolha uma opção:", buttonActions: mappedButtons.slice(0, 3) }, node.data);
          } else {
            await sendWithInstance({ phone: contact, message: content || "Escolha uma opção:", buttonList: { buttons: mappedButtons.slice(0, 3).map(b => ({ id: b.id, label: b.label })) } }, node.data);
          }
        } else if (content || mediaUrl) {
          switch (contentType) {
            case "text": if (content) await sendWithInstance({ phone: contact, message: content }, node.data); break;
            case "image": if (mediaUrl) await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'image', message: content || '' }, node.data); break;
            case "video": if (mediaUrl) await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'video', message: content || '', ...(node.data.viewOnce ? { viewOnce: true } : {}), ...(node.data.isPtv ? { isPtv: true } : {}) }, node.data); break;
            case "audio": if (mediaUrl) await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'audio', message: content || '' }, node.data); break;
            case "document": if (mediaUrl) await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'document', message: content || 'document' }, node.data); break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    // Process the current node content
    await processNode(currentNode);

    if (outgoingEdges.length === 0) return;

    // Filtrar apenas uma conexão por tipo de handle de saída para evitar duplicidade no envio
    const uniqueOutgoingEdges = new Map();
    outgoingEdges.forEach(edge => {
      const handleKey = edge.sourceHandle || "default";
      if (!uniqueOutgoingEdges.has(handleKey)) {
        uniqueOutgoingEdges.set(handleKey, edge);
      }
    });

    for (const edge of uniqueOutgoingEdges.values()) {
      const targetNode = runtimeNodes.find(n => n.id === edge.target);
      if (!targetNode) continue;

      // Check if current handle has been "sent" via buttons that stop flow
      const buttons = Array.isArray(currentNode?.data?.buttons) ? currentNode.data.buttons : [];
      const hasButtonEdgesFromHandle = buttons.some((_: any, idx: number) => 
        edge.sourceHandle === `button-${idx}` || edge.sourceHandle === `button_${idx}`
      );
      
      if (hasButtonEdgesFromHandle) {
        const pendingFlowId = flowIdForPending || currentFluxoId;
        if (userId && pendingFlowId) {
          await supabase.from("flow_captured_data").upsert({
            user_id: userId,
            flow_id: pendingFlowId,
            phone: contact,
            last_node_id: currentNodeId,
            captured_data: {},
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id,flow_id,phone" });
        }
        // Pause this path — webhook will resume when user clicks button
        continue;
      }

      // Check for data collection prompts that pause flow
      const collectAny = currentNode?.data?.collectName || currentNode?.data?.collectWhatsapp || currentNode?.data?.collectEmail || currentNode?.data?.collectCPF;
      if (collectAny) {
        // Flow is already paused by processNode for this node
        return;
      }
       // Bloco de ação ou agendamento: aplica delay/agendamento antes de continuar o fluxo
       if (targetNode.type === "blocoAcao" || targetNode.type === "blocoAgendamento") {
         const actionType = targetNode.data.actionType;
         const scheduleType = targetNode.data.scheduleType || "once";
         const scheduledAt = targetNode.data.scheduledAt;
 
         if (targetNode.type === "blocoAcao" && actionType === "delay") {
           const seconds = Number(targetNode.data.delaySeconds ?? targetNode.data.actionConfig ?? 0) || 0;
           if (seconds > 0) {
             await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
           }
         } else if (
           (targetNode.type === "blocoAcao" && actionType === "schedule") ||
           targetNode.type === "blocoAgendamento"
         ) {
           if (scheduledAt) {
             const targetDate = new Date(scheduledAt);
             const now = new Date();
             const diffMs = targetDate.getTime() - now.getTime();
             
             if (diffMs > 0) {
               // Only wait if it's within a reasonable limit (e.g., 2 hours) for client-side
               // For longer ones, it might fail if tab is closed, but at least it follows the logic.
               const maxWait = 2 * 60 * 60 * 1000; 
               const waitTime = Math.min(diffMs, maxWait);
               
               console.log(`[FluxoVisual] Waiting until ${targetDate.toLocaleString()} (${waitTime}ms)`);
               await new Promise((resolve) => setTimeout(resolve, waitTime));
             }
           }
         }
       }

      await processFlow(targetNode.id, contact, visitedNodes, instanceId, userId, provider, flowIdForPending);
    }
  };

  if (showFluxosList) {
    return (
      <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {pageSubtitle}
            </p>
          </div>
          <Button onClick={handleNovoFluxo} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Fluxo
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground text-sm">Carregando fluxos...</p>
          </div>
        ) : fluxosSalvos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border rounded-xl bg-card/50">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Workflow className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Nenhum fluxo criado</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm text-center">
              {emptyHelp}
            </p>
            <Button onClick={handleNovoFluxo} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeiro Fluxo
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fluxosSalvos.map((fluxo) => (
              <div
                key={fluxo.id}
                className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200"
              >
                {/* Card accent bar */}
                <div className={`h-1 ${fluxo.active ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base truncate">{fluxo.name}</h3>
                      </div>
                      {fluxo.keyword && (
                        <div className="flex items-center gap-1.5">
                          <Key className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="text-xs text-primary font-mono truncate">
                            {fluxo.keyword}
                          </span>
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={fluxo.active}
                      onCheckedChange={() => handleToggleActive(fluxo)}
                    />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {(fluxo.nodes as any[])?.length || 0} blocos
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {(fluxo.edges as any[])?.length || 0} conexões
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground mb-4">
                    Atualizado em {new Date(fluxo.updated_at).toLocaleDateString('pt-BR')}
                  </p>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCarregarFluxo(fluxo)}
                    >
                      Abrir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDuplicarFluxo(fluxo)}
                      title="Duplicar"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleExcluirFluxo(fluxo.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Dialog de Seleção de Grupos (pré-seleção antes de criar fluxo) */}
      <SelectContactsDialog
        open={showContactsDialog}
        onOpenChange={(o) => {
          setShowContactsDialog(o);
          if (!o) setIsSelectingPreGroups(false);
        }}
        onConfirm={handleConfirmSend}
        mode={(isTelegramMode ? "contacts" : mode) as "contacts" | "groups" | "meta"}
      />
      <FlowTemplatesDialog
        open={showTemplatesDialog}
        onOpenChange={setShowTemplatesDialog}
        mode={(isTelegramMode ? "contacts" : mode) as "contacts" | "groups" | "meta"}
        onSelect={handleSelectTemplate}
        onStartBlank={handleStartBlank}
      />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col h-screen w-full bg-background">
        {/* Top Bar */}
        <div className="shrink-0 bg-card border-b border-border">
          {/* Row 1: Header + Actions */}
          <div className="flex items-center gap-3 px-4 py-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowFluxosList(true)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={nomeFluxo}
                onChange={(e) => setNomeFluxo(e.target.value)}
                placeholder="Nome do fluxo"
                className="h-8 w-40 text-sm"
              />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Ativo</Label>
                  <Switch checked={fluxoAtivo} onCheckedChange={setFluxoAtivo} />
                </div>

              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleSaveFluxo} className="h-8" disabled={savingFluxo}>
                <Save className="h-4 w-4 mr-1.5" />
                {savingFluxo ? "..." : "Salvar"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setShowTemplatesDialog(true)}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Modelos
              </Button>
              {isGroupsMode && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    setIsSelectingPreGroups(true);
                    setShowContactsDialog(true);
                  }}
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  Grupos{preselectedGroups.length > 0 ? ` (${preselectedGroups.length})` : ""}
                </Button>
              )}
              <Button size="sm" onClick={handleEnviarAgora} className="h-8" disabled={isSending}>
                <Send className="h-4 w-4 mr-1.5" />
                {isSending ? "Enviando..." : "Enviar"}
              </Button>
              {isSending && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    cancelSendRef.current = true;
                    toast.info("Cancelando envio...");
                  }}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Cancelar Envio
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleExportJson} className="h-8">
                <Download className="h-4 w-4 mr-1.5" />
                Exportar
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-8">
                <FileUp className="h-4 w-4 mr-1.5" />
                Importar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCapturedData(true)} className="h-8">
                <Database className="h-4 w-4 mr-1.5" />
                Dados Capturados
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </div>
          </div>

          {/* Row 2: Draggable Blocks */}
          <div className="flex items-center gap-2 px-4 py-2 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setShowAddBlockDialog(true)}
            >
              <Plus className="h-4 w-4" />
              Adicionar bloco
            </Button>
            <span className="text-[10px] text-muted-foreground">
              Escolha um bloco padrão ou uma ferramenta do agente para inserir no fluxo.
            </span>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 m-2 relative" ref={reactFlowWrapper}>
          {/* Preview button */}
          <Button
            size="sm"
            variant={showPreview ? "default" : "outline"}
            className="absolute top-3 right-3 z-10 gap-2"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-4 w-4" />
            Prévia
          </Button>

          <ReactFlow
            nodes={nodes.map(n => n.type === 'blocoConteudo' ? { ...n, data: { ...n.data, buttonStats, totalFlowRecipients } } : n)}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={4}
            defaultViewport={{ x: 0, y: 0, zoom: 1.5 }}
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-background rounded-lg border relative z-0"
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#2563EB', strokeWidth: 3, zIndex: 1000 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#2563EB' },
            }}
          >
            <Background variant={BackgroundVariant.Dots} />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-card !border !border-border !rounded-lg"
            />
            <FlowLeadOverlay positions={leadPositions} />
          </ReactFlow>
        </div>

        {/* WhatsApp Mobile Preview */}
        {showPreview && (
          <div className="flex items-center justify-center m-2 ml-0 shrink-0">
            {/* Phone frame */}
            <div className="w-[340px] h-[680px] bg-[#111] rounded-[40px] p-[10px] shadow-2xl relative">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[26px] bg-[#111] rounded-b-[14px] z-20" />
              
              {/* Screen */}
              <div className="w-full h-full rounded-[30px] overflow-hidden bg-[#111] flex flex-col">
                {/* Status bar */}
                <div className="bg-[#075E54] px-5 pt-2 pb-0 flex items-center justify-between text-white text-[10px]">
                  <span>{new Date().getHours().toString().padStart(2, '0')}:{new Date().getMinutes().toString().padStart(2, '0')}</span>
                  <div className="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                    <svg width="14" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                  </div>
                </div>

                {/* WhatsApp header */}
                <div className="bg-[#075E54] px-3 pb-2.5 pt-1 flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/20 -ml-1" onClick={() => setShowPreview(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="w-9 h-9 rounded-full bg-[#DFE5E7] flex items-center justify-center overflow-hidden">
                    <svg width="24" height="24" viewBox="0 0 212 212" fill="#ccc"><path d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0zm0 30c16.6 0 30 13.4 30 30s-13.4 30-30 30-30-13.4-30-30 13.4-30 30-30zm0 150c-26.5 0-49.9-13.5-63.5-34 .3-21 42.3-32.5 63.5-32.5s63.2 11.5 63.5 32.5C155.9 166.5 132.5 180 106 180z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[14px] font-medium truncate">Contato</p>
                    <p className="text-white/70 text-[11px]">online</p>
                  </div>
                  <div className="flex items-center gap-3 text-white/90">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/></svg>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                  </div>
                </div>

                {/* Chat area with WhatsApp wallpaper */}
                <div
                  className="flex-1 overflow-y-auto"
                  style={{
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'400\' viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23667781\' fill-opacity=\'0.04\'%3E%3Cpath d=\'M20 20h8v8h-8zM60 10h8v8h-8zM100 30h8v8h-8zM140 5h8v8h-8zM180 25h8v8h-8zM220 15h8v8h-8zM260 35h8v8h-8zM300 8h8v8h-8zM340 28h8v8h-8zM380 18h8v8h-8zM10 60h8v8h-8zM50 50h8v8h-8zM90 70h8v8h-8zM130 45h8v8h-8zM170 65h8v8h-8zM210 55h8v8h-8zM250 40h8v8h-8zM290 72h8v8h-8zM330 52h8v8h-8zM370 42h8v8h-8z\'/%3E%3C/g%3E%3C/svg%3E")',
                    backgroundColor: '#ECE5DD',
                  }}
                >
                  <div className="p-2.5 space-y-[2px]">
                    {/* Encryption notice */}
                    <div className="flex justify-center mb-2">
                      <div className="bg-[#FCF4CB]/90 rounded-lg px-3 py-1.5 max-w-[85%] shadow-sm">
                        <p className="text-[10.5px] text-[#54656F] text-center leading-tight">
                          🔒 As mensagens e as ligações são protegidas com a criptografia de ponta a ponta.
                        </p>
                      </div>
                    </div>

                    {/* Today separator */}
                    <div className="flex justify-center my-2">
                      <div className="bg-white/90 rounded-md px-3 py-[3px] shadow-sm">
                        <p className="text-[11.5px] text-[#54656F] font-medium uppercase">Hoje</p>
                      </div>
                    </div>

                    {getPreviewMessages().length === 0 ? (
                      <div className="text-center py-16">
                        <p className="text-xs text-[#667781]">Conecte blocos ao fluxo para ver a prévia</p>
                      </div>
                    ) : (
                      getPreviewMessages().map((msg, idx) => (
                        <div key={msg.id + idx} className={`flex ${msg.direction === 'received' ? 'justify-start' : 'justify-end'} mb-[1px]`}>
                          <div className={`max-w-[80%] rounded-[7.5px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative ${
                            msg.direction === 'received'
                              ? 'bg-white rounded-tl-[3px]'
                              : 'bg-[#D9FDD3] rounded-tr-[3px]'
                          }`}>
                            {/* Tail */}
                            {idx === 0 || getPreviewMessages()[idx - 1]?.direction !== msg.direction ? (
                              <div className={`absolute top-0 w-[8px] h-[13px] ${
                                msg.direction === 'received' ? '-left-[8px]' : '-right-[8px]'
                              }`}>
                                <svg viewBox="0 0 8 13" width="8" height="13" className="block">
                                  {msg.direction === 'received'
                                    ? <path d="M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" fill="white"/>
                                    : <path d="M6.467 3.568L0 12.193V1h5.188c1.77 0 2.338 1.156 1.28 2.568z" fill="#D9FDD3"/>
                                  }
                                </svg>
                              </div>
                            ) : null}

                            <div className="px-[9px] pt-[6px] pb-[7px]">
                              {/* Media */}
                              {msg.mediaUrl && msg.type === 'image' && (
                                <div className="mb-[3px] rounded-[6px] overflow-hidden -mx-[5px] -mt-[3px]">
                                  <img src={msg.mediaUrl} alt="" className="w-full max-h-[200px] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                </div>
                              )}
                              {msg.mediaUrl && msg.type === 'video' && (
                                <div className="mb-[3px] rounded-[6px] overflow-hidden -mx-[5px] -mt-[3px] bg-black relative">
                                  <video
                                    src={msg.mediaUrl}
                                    className="w-full max-h-[200px] object-contain"
                                    controls
                                    muted
                                    preload="metadata"
                                    playsInline
                                    onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                                  />
                                </div>
                              )}
                              {msg.mediaUrl && msg.type === 'audio' && (
                                <div className="flex items-center gap-2 py-1 min-w-[200px]">
                                  <div className="w-[34px] h-[34px] rounded-full bg-[#DFE5E7] flex items-center justify-center shrink-0">
                                    <svg width="16" height="16" viewBox="0 0 212 212" fill="#ccc"><path d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0zm0 30c16.6 0 30 13.4 30 30s-13.4 30-30 30-30-13.4-30-30 13.4-30 30-30zm0 150c-26.5 0-49.9-13.5-63.5-34 .3-21 42.3-32.5 63.5-32.5s63.2 11.5 63.5 32.5C155.9 166.5 132.5 180 106 180z"/></svg>
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <svg width="8" height="10" viewBox="0 0 8 10" fill="#54656F"><path d="M1 0v10l7-5z"/></svg>
                                      <div className="flex-1 h-[3px] bg-[#ACB9BF] rounded-full relative">
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-[#54656F]" />
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                      <span className="text-[10px] text-[#667781]">0:00</span>
                                      <Mic className="h-3 w-3 text-[#54656F]" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {msg.mediaUrl && msg.type === 'document' && (
                                <div className="flex items-center gap-2 bg-[#F0F2F5] rounded-[8px] p-2.5 mb-[3px] min-w-[200px]">
                                  <div className="w-[30px] h-[36px] bg-[#E8453C] rounded-[3px] flex items-center justify-center shrink-0">
                                    <span className="text-white text-[7px] font-bold">PDF</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12.5px] text-[#111B21] truncate">documento.pdf</p>
                                    <p className="text-[10px] text-[#667781]">PDF · 1 página · 125 KB</p>
                                  </div>
                                  <Download className="h-[18px] w-[18px] text-[#54656F] shrink-0" />
                                </div>
                              )}

                              {/* Text */}
                              {msg.content && (
                                <span className="text-[13.5px] text-[#111B21] whitespace-pre-wrap leading-[19px]">{msg.content}</span>
                              )}

                              {/* Timestamp + checks inline */}
                              <span className="float-right ml-2 mt-1 flex items-center gap-[2px]">
                                <span className="text-[10.5px] text-[#667781] leading-none">
                                  {new Date().getHours().toString().padStart(2, '0')}:{new Date().getMinutes().toString().padStart(2, '0')}
                                </span>
                                {msg.direction === 'sent' && (
                                  <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                                    <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.175a.458.458 0 0 0-.686.032.498.498 0 0 0 .037.686l2.357 2.553a.458.458 0 0 0 .347.147h.023a.457.457 0 0 0 .34-.178l6.535-8.067a.497.497 0 0 0-.067-.71z" fill="#53BDEB"/>
                                    <path d="M14.757.653a.457.457 0 0 0-.305-.102.493.493 0 0 0-.38.178L7.882 8.365 7.07 7.46l-.727.896.96 1.04a.458.458 0 0 0 .348.147h.022a.457.457 0 0 0 .34-.178l6.812-8.067a.497.497 0 0 0-.068-.645z" fill="#53BDEB"/>
                                  </svg>
                                )}
                              </span>
                            </div>

                            {/* WhatsApp-style buttons */}
                            {msg.buttons && msg.buttons.length > 0 && (
                              <div className="border-t border-[#E2E8E4]">
                                {msg.buttons.map((btn, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-center gap-1.5 py-[6px] text-[13px] font-medium text-[#027EB5] border-b border-[#E2E8E4] last:border-b-0"
                                  >
                                    {btn.type === 'url' && <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>}
                                    {btn.type === 'call' && <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>}
                                    {(btn.type === 'reply' || btn.type === 'flow') && <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>}
                                    {btn.text}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Bottom input bar */}
                <div className="bg-[#F0F2F5] px-2 py-[5px] flex items-center gap-[6px]">
                  <div className="text-[#54656F]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
                  </div>
                  <div className="flex-1 bg-white rounded-[21px] px-3 py-[7px] flex items-center">
                    <span className="text-[14px] text-[#667781]">Mensagem</span>
                  </div>
                  <div className="flex items-center gap-[2px] text-[#54656F]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
                    <div className="w-[42px] h-[42px] rounded-full bg-[#00A884] flex items-center justify-center ml-1">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 15c1.66 0 2.99-1.34 2.99-3L15 6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.41 2.72 6.23 6 6.72V22h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de Seleção de Contatos */}
      <SelectContactsDialog
        open={showContactsDialog}
        onOpenChange={setShowContactsDialog}
        onConfirm={handleConfirmSend}
        mode={(isTelegramMode ? "contacts" : mode) as "contacts" | "groups" | "meta"}
      />

      <FlowTemplatesDialog
        open={showTemplatesDialog}
        onOpenChange={setShowTemplatesDialog}
        mode={(isTelegramMode ? "contacts" : mode) as "contacts" | "groups" | "meta"}
        onSelect={handleSelectTemplate}
        onStartBlank={handleStartBlank}
      />

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar Bloco: {selectedNode?.data?.label}
            </DialogTitle>
            <DialogDescription>
              Configure as propriedades deste bloco
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedNode?.type === "blocoConteudo" && isMensagemPredefinidaBlock(selectedNode) && (
              <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                <Label className="text-sm font-semibold">Modelo de Mensagem</Label>
                <p className="text-[11px] text-muted-foreground">
                  Selecione um modelo salvo em <span className="font-medium">/modelos</span>. O conteúdo do modelo será enviado neste bloco.
                </p>
                <Select
                  value={selectedNode.data.templateId || ""}
                  onValueChange={(id) => {
                    const tpl = messageTemplates.find((t) => t.id === id);
                    if (!tpl) return;
                    const contentType = mapTemplateTypeToContentType(tpl.type);
                    const carouselCards = (tpl.carouselCards || []).map((c) => ({
                      image: c.image,
                      title: c.title,
                      subtitle: c.description,
                      buttons: (c.buttons || []).map((b) => ({
                        label: b.text,
                        url: b.value || "",
                      })),
                    }));
                    setSelectedNode({
                      ...selectedNode,
                      data: {
                        ...selectedNode.data,
                        templateId: tpl.id,
                        templateName: tpl.name,
                        contentType,
                        content: tpl.content || "",
                        mediaUrl: tpl.mediaUrl || "",
                        header: tpl.header || "",
                        footer: tpl.footer || "",
                        buttons: tpl.buttons || [],
                        listItems: tpl.listItems || [],
                        carouselCardsJson:
                          carouselCards.length > 0
                            ? JSON.stringify(carouselCards, null, 2)
                            : selectedNode.data.carouselCardsJson || "",
                      },
                    });
                    toast.success(`Modelo "${tpl.name}" carregado!`);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {messageTemplates.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Nenhum modelo salvo. Crie em /modelos.
                      </div>
                    ) : (
                      messageTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {t.type ? ` · ${t.type}` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedNode.data.templateName && (
                  <div className="text-xs text-muted-foreground">
                    Modelo atual: <span className="font-medium text-foreground">{selectedNode.data.templateName}</span>
                  </div>
                )}
                {selectedNode.data.content && (
                  <div className="rounded-md border border-border bg-background p-2 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {selectedNode.data.content}
                  </div>
                )}
              </div>
            )}

            {selectedNode?.type === "blocoConteudo" && !isMensagemPredefinidaBlock(selectedNode) && (
              <>
                {!isMensagemAudioBlock(selectedNode) && (
                <div>
                  <Label>Tipo de Conteúdo</Label>
                  <Select
                    value={selectedNode.data.contentType || "text"}
                    onValueChange={(value) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, contentType: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                      <SelectItem value="image-buttons">Imagem com botões</SelectItem>
                      <SelectItem value="video-buttons">Vídeo com botões</SelectItem>
                      <SelectItem value="audio-buttons">Áudio com botões</SelectItem>
                      <SelectItem value="list">Lista de opção</SelectItem>
                      <SelectItem value="copy-paste">Cópia e cola</SelectItem>
                      <SelectItem value="file">Arquivo</SelectItem>
                      <SelectItem value="media-carousel">Carrossel</SelectItem>
                      <SelectItem value="interactive">Menu Interativo (botões/lista)</SelectItem>
                      <SelectItem value="pix">Botão PIX</SelectItem>
                      <SelectItem value="pix-charge">PIX (cobrança)</SelectItem>
                       <SelectItem value="request-payment">Solicitar Pagamento</SelectItem>
                       <SelectItem value="gateway-billing">Cobrança Gateway</SelectItem>
                      <SelectItem value="poll">Enquete / Poll</SelectItem>
                      <SelectItem value="product">Produto</SelectItem>
                      <SelectItem value="location">Localização (Nativa)</SelectItem>
                      <SelectItem value="location-buttons">Localização com botões</SelectItem>
                      <SelectItem value="contact">Contato (vCard)</SelectItem>
                      <SelectItem value="event">Evento</SelectItem>
                      <SelectItem value="order-status">Status do pedido</SelectItem>
                      <SelectItem value="order-payment">Pagamento do pedido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                )}

                {/* === UAZAPI: configurações específicas por tipo de mensagem === */}
                {selectedNode.data.contentType === "contact" && (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                    <Label className="text-sm font-semibold">Contato (vCard)</Label>
                    <Input
                      placeholder="Nome completo"
                      value={selectedNode.data.contactName || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, contactName: e.target.value },
                        })
                      }
                    />
                    <Input
                      placeholder="Telefone (ex: 5511999999999)"
                      value={selectedNode.data.contactPhone || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, contactPhone: e.target.value },
                        })
                      }
                    />
                    <Input
                      placeholder="Organização (opcional)"
                      value={selectedNode.data.contactOrg || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, contactOrg: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {(selectedNode.data.contentType === "location" || selectedNode.data.contentType === "location-buttons") && (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                    <Label className="text-sm font-semibold">
                      {selectedNode.data.contentType === "location-buttons" ? "Localização com Botões" : "Localização Nativa"}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Latitude"
                        value={selectedNode.data.locationLat || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, locationLat: e.target.value },
                          })
                        }
                      />
                      <Input
                        placeholder="Longitude"
                        value={selectedNode.data.locationLng || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, locationLng: e.target.value },
                          })
                        }
                      />
                    </div>
                    <Input
                      placeholder="Nome do local (opcional)"
                      value={selectedNode.data.locationName || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, locationName: e.target.value },
                        })
                      }
                    />
                    <Input
                      placeholder="Endereço (opcional)"
                      value={selectedNode.data.locationAddress || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, locationAddress: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {selectedNode.data.contentType === "presence" && (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                    <Label className="text-sm font-semibold">Presença</Label>
                    <Select
                      value={selectedNode.data.presenceType || "composing"}
                      onValueChange={(v) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, presenceType: v },
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="composing">Digitando…</SelectItem>
                        <SelectItem value="recording">Gravando áudio…</SelectItem>
                        <SelectItem value="available">Disponível (online)</SelectItem>
                        <SelectItem value="unavailable">Indisponível (offline)</SelectItem>
                        <SelectItem value="paused">Pausar</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Duração em segundos (opcional)"
                      value={selectedNode.data.presenceDuration || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, presenceDuration: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {selectedNode.data.contentType === "status" && (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                    <Label className="text-sm font-semibold">Status (Stories)</Label>
                    <Select
                      value={selectedNode.data.statusKind || "text"}
                      onValueChange={(v) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, statusKind: v },
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="image">Imagem</SelectItem>
                        <SelectItem value="video">Vídeo</SelectItem>
                        <SelectItem value="audio">Áudio</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedNode.data.statusKind !== "text" && (
                      <Input
                        placeholder="URL da mídia"
                        value={selectedNode.data.mediaUrl || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, mediaUrl: e.target.value },
                          })
                        }
                      />
                    )}
                    <Textarea
                      placeholder="Texto do status / legenda"
                      rows={3}
                      value={selectedNode.data.content || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, content: e.target.value },
                        })
                      }
                    />
                    <Input
                      placeholder="Cor de fundo hex (opcional, ex: #075E54)"
                      value={selectedNode.data.statusBg || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, statusBg: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {selectedNode.data.contentType === "interactive" && (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                    <Label className="text-sm font-semibold">Menu Interativo</Label>
                    <Select
                      value={selectedNode.data.interactiveKind || "button"}
                      onValueChange={(v) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, interactiveKind: v },
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="button">Botões (até 3)</SelectItem>
                        <SelectItem value="list">Lista</SelectItem>
                        <SelectItem value="poll">Enquete</SelectItem>
                        <SelectItem value="carousel">Carrossel</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Texto da mensagem"
                      rows={3}
                      value={selectedNode.data.content || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, content: e.target.value },
                        })
                      }
                    />
                    <Input
                      placeholder="Footer (opcional)"
                      value={selectedNode.data.footer || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, footer: e.target.value },
                        })
                      }
                    />
                    {selectedNode.data.interactiveKind === "list" && (
                      <Input
                        placeholder="Texto do botão da lista (ex: Ver opções)"
                        value={selectedNode.data.listButtonText || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, listButtonText: e.target.value },
                          })
                        }
                      />
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Configure as opções/itens na seção “Botões” mais abaixo deste editor.
                    </p>
                  </div>
                )}

                {selectedNode.data.contentType === "media-carousel" && (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-semibold">Carrossel de Mídia</Label>
                      <Select
                        value=""
                        onValueChange={(id) => {
                          const tpl = messageTemplates.find((t) => t.id === id);
                          if (!tpl) return;
                          const cards = (tpl.carouselCards || []).map((c) => ({
                            image: c.image,
                            title: c.title,
                            subtitle: c.description,
                            buttons: (c.buttons || []).map((b) => ({
                              label: b.text,
                              url: b.value || "",
                            })),
                          }));
                          setSelectedNode({
                            ...selectedNode,
                            data: {
                              ...selectedNode.data,
                              carouselCardsJson: JSON.stringify(cards, null, 2),
                            },
                          });
                          toast.success(`Modelo "${tpl.name}" carregado!`);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[220px] text-xs">
                          <SelectValue placeholder="Usar modelo pronto..." />
                        </SelectTrigger>
                        <SelectContent>
                          {messageTemplates.filter((t) => t.type === "carrossel" && (t.carouselCards?.length || 0) > 0).length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              Nenhum modelo de carrossel salvo
                            </div>
                          ) : (
                            messageTemplates
                              .filter((t) => t.type === "carrossel" && (t.carouselCards?.length || 0) > 0)
                              .map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name} ({t.carouselCards?.length} cards)
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      placeholder='Cole um JSON com os cards. Ex: [{"image":"https://...","title":"...","subtitle":"...","buttons":[{"label":"Ver","url":"https://..."}]}]'
                      rows={6}
                      value={selectedNode.data.carouselCardsJson || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, carouselCardsJson: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {selectedNode.data.contentType === "request-location" && (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                    <Label className="text-sm font-semibold">Solicitar Localização</Label>
                    <Textarea
                      placeholder="Mensagem que acompanha o pedido (opcional)"
                      rows={3}
                      value={selectedNode.data.content || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, content: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {(selectedNode.data.contentType === "request-payment" || selectedNode.data.contentType === "gateway-billing") && (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                    <Label className="text-sm font-semibold">
                      {selectedNode.data.contentType === "gateway-billing" ? "Cobrança Gateway" : "Solicitar Pagamento"}
                    </Label>
                    <Select
                      value={selectedNode.data.paymentSource || "manual"}
                      onValueChange={(v) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, paymentSource: v },
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Configurar manualmente</SelectItem>
                        <SelectItem value="gateway">Gerar cobrança real pelo Gateway</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Valor (R$, ex: 49.90)"
                      value={selectedNode.data.paymentAmount || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, paymentAmount: e.target.value },
                        })
                      }
                    />
                    <Input
                      placeholder="Descrição"
                      value={selectedNode.data.paymentDescription || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, paymentDescription: e.target.value },
                        })
                      }
                    />
                    {selectedNode.data.paymentSource === "manual" && (
                      <Input
                        placeholder="Recebedor (chave PIX ou conta)"
                        value={selectedNode.data.paymentReceiver || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, paymentReceiver: e.target.value },
                          })
                        }
                      />
                    )}
                  </div>
                )}

                {(selectedNode.data.contentType === "pix" || selectedNode.data.contentType === "pix-charge") && (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                    <Label className="text-sm font-semibold">
                      {selectedNode.data.contentType === "pix-charge" ? "PIX (Cobrança)" : "Botão PIX"}
                    </Label>
                    <Select
                      value={selectedNode.data.pixSource || "manual"}
                      onValueChange={(v) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, pixSource: v },
                        })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Chave PIX manual</SelectItem>
                        <SelectItem value="gateway">Gerar cobrança real pelo Gateway</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedNode.data.pixSource === "manual" && (
                      <>
                        <Select
                          value={selectedNode.data.pixKeyType || "cpf"}
                          onValueChange={(v) =>
                            setSelectedNode({
                              ...selectedNode,
                              data: { ...selectedNode.data, pixKeyType: v },
                            })
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Tipo da chave" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cpf">CPF</SelectItem>
                            <SelectItem value="cnpj">CNPJ</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="phone">Telefone</SelectItem>
                            <SelectItem value="random">Aleatória</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Chave PIX"
                          value={selectedNode.data.pixKey || ""}
                          onChange={(e) =>
                            setSelectedNode({
                              ...selectedNode,
                              data: { ...selectedNode.data, pixKey: e.target.value },
                            })
                          }
                        />
                        <Input
                          placeholder="Beneficiário"
                          value={selectedNode.data.pixReceiver || ""}
                          onChange={(e) =>
                            setSelectedNode({
                              ...selectedNode,
                              data: { ...selectedNode.data, pixReceiver: e.target.value },
                            })
                          }
                        />
                      </>
                    )}
                    <Input
                      placeholder="Valor (R$)"
                      value={selectedNode.data.pixAmount || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, pixAmount: e.target.value },
                        })
                      }
                    />
                    <Input
                      placeholder="Descrição"
                      value={selectedNode.data.pixDescription || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, pixDescription: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {isMensagemAudioBlock(selectedNode) && (
                  <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-3">
                    <div>
                      <Label>Nome do áudio</Label>
                      <Input
                        value={selectedNode.data.audioName || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, audioName: e.target.value, contentType: "audio" },
                          })
                        }
                        placeholder="Ex: áudio de boas-vindas"
                      />
                    </div>

                    <div>
                      <Label>Upar áudio</Label>
                      <div className="mt-2">
                        <label htmlFor="audio-file-upload" className="cursor-pointer">
                          <div className="flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                            <div className="text-center">
                              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                {uploadingFile ? "Enviando..." : "Clique para selecionar o áudio"}
                              </p>
                              {selectedNode.data.mediaUrl && (
                                <p className="text-xs text-primary mt-1">
                                  ✓ Áudio carregado
                                </p>
                              )}
                            </div>
                          </div>
                          <Input
                            id="audio-file-upload"
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploadingFile}
                            accept="audio/*"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 border-t" />
                      <span className="text-xs text-muted-foreground">OU GERAR VOZ POR IA</span>
                      <div className="flex-1 border-t" />
                    </div>

                    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">ElevenLabs Audio</Label>
                      </div>

                      <div>
                        <Label className="text-xs">Texto a ser narrado</Label>
                        <Textarea
                          value={selectedNode.data.ttsText || ""}
                          onChange={(e) =>
                            setSelectedNode({
                              ...selectedNode,
                              data: { ...selectedNode.data, ttsText: e.target.value },
                            })
                          }
                          placeholder="Escreva o que a voz deve falar..."
                          rows={3}
                          maxLength={4000}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {(selectedNode.data.ttsText || "").length}/4000 caracteres
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs">Token API Key</Label>
                        <Input
                          type="password"
                          value={selectedNode.data.ttsApiKey || ""}
                          onChange={(e) =>
                            setSelectedNode({
                              ...selectedNode,
                              data: { ...selectedNode.data, ttsApiKey: e.target.value },
                            })
                          }
                          placeholder="sk_..."
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Chave da API do ElevenLabs para autenticação
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs">Voice ID</Label>
                        <Input
                          value={selectedNode.data.ttsVoiceId || ""}
                          onChange={(e) =>
                            setSelectedNode({
                              ...selectedNode,
                              data: { ...selectedNode.data, ttsVoiceId: e.target.value },
                            })
                          }
                          placeholder="EXAVITQu4vr4xnSDxMaL"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          ID da voz que será utilizada para síntese
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">
                            Stability: {(Number(selectedNode.data.ttsStability ?? 0.95)).toFixed(2)}
                          </Label>
                          <div className="pt-3">
                            <Slider
                              value={[Number(selectedNode.data.ttsStability ?? 0.95)]}
                              min={0} max={1} step={0.01}
                              onValueChange={([v]) =>
                                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ttsStability: v } })
                              }
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                              <span>0</span><span>0.5</span><span>1</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Controla a estabilidade da voz (0 = mais variação, 1 = mais estável)
                            </p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">
                            Similarity Boost: {(Number(selectedNode.data.ttsSimilarityBoost ?? 0.75)).toFixed(2)}
                          </Label>
                          <div className="pt-3">
                            <Slider
                              value={[Number(selectedNode.data.ttsSimilarityBoost ?? 0.75)]}
                              min={0} max={1} step={0.01}
                              onValueChange={([v]) =>
                                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ttsSimilarityBoost: v } })
                              }
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                              <span>0</span><span>0.5</span><span>1</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Amplifica a similaridade com a voz original
                            </p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">
                            Style: {(Number(selectedNode.data.ttsStyle ?? 0.08)).toFixed(2)}
                          </Label>
                          <div className="pt-3">
                            <Slider
                              value={[Number(selectedNode.data.ttsStyle ?? 0.08)]}
                              min={0} max={1} step={0.01}
                              onValueChange={([v]) =>
                                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ttsStyle: v } })
                              }
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                              <span>0</span><span>0.5</span><span>1</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Controla o estilo e expressividade da voz
                            </p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">
                            Speed: {(Number(selectedNode.data.ttsSpeed ?? 1)).toFixed(1)}
                          </Label>
                          <div className="pt-3">
                            <Slider
                              value={[Number(selectedNode.data.ttsSpeed ?? 1)]}
                              min={0.7} max={1.2} step={0.05}
                              onValueChange={([v]) =>
                                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ttsSpeed: v } })
                              }
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                              <span>0.7x</span><span>1x</span><span>1.2x</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Ajusta a velocidade da voz (1.0 = velocidade padrão)
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-md border border-border bg-background/40 p-2">
                        <Switch
                          checked={selectedNode.data.ttsUseSpeakerBoost !== false}
                          onCheckedChange={(v) =>
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ttsUseSpeakerBoost: v } })
                          }
                        />
                        <div className="flex-1">
                          <Label className="text-xs font-medium">Use Speaker Boost</Label>
                          <p className="text-[10px] text-muted-foreground">
                            Melhora a qualidade e clareza da voz gerada
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          disabled={previewingTts || generatingTts}
                          onClick={() => handleGenerateTts("preview")}
                        >
                          <PlayCircle className="h-4 w-4 mr-1.5" />
                          {previewingTts ? "Gerando prévia..." : "Pré-escutar"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          disabled={generatingTts || previewingTts}
                          onClick={() => handleGenerateTts("save")}
                        >
                          <Sparkles className="h-4 w-4 mr-1.5" />
                          {generatingTts ? "Gerando..." : "Gerar e salvar"}
                        </Button>
                      </div>

                      {selectedNode.data.mediaUrl && (
                        <div className="rounded-md border border-border bg-muted/40 p-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Áudio salvo no bloco{selectedNode.data.audioName ? ` — ${selectedNode.data.audioName}` : ""}
                          </Label>
                          <audio
                            controls
                            src={selectedNode.data.mediaUrl}
                            className="w-full h-9"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!isMensagemAudioBlock(selectedNode) && (["image", "video", "audio", "document", "status"].includes(selectedNode.data.contentType)) && (
                  <>
                    <div>
                      <Label>
                        URL da {selectedNode.data.contentType === "image" ? "Imagem" : 
                                selectedNode.data.contentType === "video" ? "Vídeo" : 
                                selectedNode.data.contentType === "audio" ? "Áudio" : 
                                selectedNode.data.contentType === "status" ? (selectedNode.data.statusKind === "image" ? "Imagem" : selectedNode.data.statusKind === "video" ? "Vídeo" : "Mídia") : 
                                "Mídia"}
                      </Label>
                      <Input
                        value={selectedNode.data.mediaUrl || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, mediaUrl: e.target.value },
                          })
                        }
                        placeholder={`https://exemplo.com/${
                          selectedNode.data.contentType === "image" ? "imagem.jpg" : 
                          selectedNode.data.contentType === "video" ? "video.mp4" : 
                          selectedNode.data.contentType === "audio" ? "audio.mp3" : 
                          selectedNode.data.contentType === "status" ? (selectedNode.data.statusKind === "video" ? "video.mp4" : "imagem.jpg") : 
                          "arquivo.ext"
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 border-t" />
                      <span className="text-xs text-muted-foreground">OU</span>
                      <div className="flex-1 border-t" />
                    </div>

                    <div>
                      <Label>Fazer Upload do Arquivo</Label>
                      <div className="mt-2">
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <div className="flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                            <div className="text-center">
                              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                {uploadingFile ? "Enviando..." : "Clique para selecionar um arquivo"}
                              </p>
                              {selectedNode.data.mediaUrl && (
                                <p className="text-xs text-primary mt-1">
                                  ✓ Arquivo carregado
                                </p>
                              )}
                            </div>
                          </div>
                          <Input
                            id="file-upload"
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploadingFile}
                            accept={(() => {
                              const type = selectedNode.data.contentType;
                              const kind = selectedNode.data.statusKind;
                              if (type === "image" || type === "sticker" || (type === "status" && kind === "image")) return "image/*,.webp";
                              if (type === "gif") return "video/*,image/gif";
                              if (type === "video" || (type === "status" && kind === "video")) return "video/*";
                              if (type === "audio" || (type === "status" && kind === "audio")) return "audio/*";
                              if (type === "document") return ".pdf,.doc,.docx";
                              return "*";
                            })()}
                          />
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {selectedNode.data.contentType === "video" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-accent/50 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-base">👁</span>
                        <div>
                          <Label className="text-sm font-medium cursor-pointer">Visualização Única</Label>
                          <p className="text-[10px] text-muted-foreground">Vídeo que só pode ser visto uma vez</p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedNode.data.viewOnce || false}
                        onCheckedChange={(v) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, viewOnce: v, isPtv: v ? false : selectedNode.data.isPtv },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-accent/50 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-primary" />
                        <div>
                          <Label className="text-sm font-medium cursor-pointer">Vídeo Instantâneo (PTV)</Label>
                          <p className="text-[10px] text-muted-foreground">Vídeo circular instantâneo</p>
                        </div>
                      </div>
                      <Switch
                        checked={selectedNode.data.isPtv || false}
                        onCheckedChange={(v) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, isPtv: v, viewOnce: v ? false : selectedNode.data.viewOnce },
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                                {selectedNode.data.contentType === "poll" && (
                  <div className="p-3 bg-accent/30 rounded-lg border border-border space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configuração da Enquete</Label>
                    <p className="text-[10px] text-muted-foreground">O título da enquete deve ser colocado no campo "Mensagem" abaixo. Use os botões abaixo para definir as opções.</p>
                  </div>
                )}

                {selectedNode.data.contentType === "product" && (
                  <div className="space-y-3">
                    <Label>ID do Produto (Catálogo FB/WA)</Label>
                    <Input
                      value={selectedNode.data.productId || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, productId: e.target.value },
                        })
                      }
                      placeholder="ex: 123456789"
                    />
                  </div>
                )}

                {selectedNode.data.contentType === "order" && (
                  <div className="space-y-3">
                    <Label>ID do Pedido / Título</Label>
                    <Input
                      value={selectedNode.data.orderTitle || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, orderTitle: e.target.value },
                        })
                      }
                      placeholder="ex: Pedido #001"
                    />
                    <Label>Valor Total (ex: 150.00)</Label>
                    <Input
                      type="number"
                      value={selectedNode.data.orderTotal || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, orderTotal: e.target.value },
                        })
                      }
                    />
                  </div>
                )}

                {(selectedNode.data.contentType === "reaction" || selectedNode.data.contentType === "delete" || selectedNode.data.contentType === "pin" || selectedNode.data.contentType === "read" || selectedNode.data.contentType === "reply" || selectedNode.data.contentType === "forward") && (
                  <div className="space-y-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                    <Label className="text-xs font-semibold">Mensagem Alvo (ID)</Label>
                    <Input
                      value={selectedNode.data.targetMessageId || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, targetMessageId: e.target.value },
                        })
                      }
                      placeholder="ID da mensagem (zaapId / messageId)"
                      className="h-8 text-xs"
                    />
                    {selectedNode.data.contentType === "reaction" && (
                      <>
                        <Label className="text-xs font-semibold">Emoji da Reação</Label>
                        <Input
                          value={selectedNode.data.emoji || "👍"}
                          onChange={(e) =>
                            setSelectedNode({
                              ...selectedNode,
                              data: { ...selectedNode.data, emoji: e.target.value },
                            })
                          }
                          className="h-8 text-xs"
                        />
                      </>
                    )}
                  </div>
                )}
                {selectedNode.data.contentType !== "audio" && !isMensagemAudioBlock(selectedNode) && (
                <div>
                  <Label>
                    {selectedNode.data.contentType === "text" ? "Mensagem" : "Legenda (opcional)"}
                  </Label>
                  <Textarea
                    value={selectedNode.data.content || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, content: e.target.value },
                      })
                    }
                    placeholder={selectedNode.data.contentType === "text" ? "Digite a mensagem..." : "Digite uma legenda (opcional)..."}
                    rows={5}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground mr-1">Variáveis:</span>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText("{{nome}}")}
                        className="text-[11px] px-2 py-0.5 rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted font-mono transition-colors"
                      >
                        {"{{nome}}"}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText("{{whatsapp}}")}
                        className="text-[11px] px-2 py-0.5 rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted font-mono transition-colors"
                      >
                        {"{{whatsapp}}"}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText("{{email}}")}
                        className="text-[11px] px-2 py-0.5 rounded border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted font-mono transition-colors"
                      >
                        {"{{email}}"}
                      </button>
                  </div>
                </div>
                )}

                {selectedNode.data.contentType !== "audio" && !isMensagemAudioBlock(selectedNode) && (
                <>
                <Separator />

                {/* Capturar Dados do Lead */}
                 <div className="space-y-4">
                   {isGroupsMode && (
                     <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <Users className="w-4 h-4 text-primary" />
                           <Label className="text-sm font-semibold text-primary">Marcar Membros do Grupo</Label>
                         </div>
                         <Switch
                           checked={selectedNode.data.mentionAll || false}
                           onCheckedChange={(checked) =>
                             setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, mentionAll: checked } })
                           }
                         />
                       </div>
                       <p className="text-[10px] text-muted-foreground leading-relaxed">
                         Ative para mencionar automaticamente todos os participantes do grupo nesta mensagem. Ideal para avisos importantes.
                       </p>
                     </div>
                   )}
 
                   <div className="space-y-3">
                     <Label className="text-sm font-semibold">Capturar dados do lead</Label>
                    <div className="rounded-lg border border-border/60 divide-y divide-border/60">

                  {/* Nome */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Capturar Nome</Label>
                      </div>
                      <Switch
                        checked={selectedNode.data.collectName || false}
                        onCheckedChange={(checked) =>
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, collectName: checked } })
                        }
                      />
                    </div>
                    {selectedNode.data.collectName && (
                      <div className="space-y-2">
                        <Input
                          value={selectedNode.data.namePrompt || ""}
                          onChange={(e) =>
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, namePrompt: e.target.value } })
                          }
                          placeholder="Qual o seu nome? 😊"
                          className="h-8 text-xs"
                        />
                        <Textarea
                          value={selectedNode.data.nameFollowUp || ""}
                          onChange={(e) =>
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, nameFollowUp: e.target.value } })
                          }
                          placeholder="Prazer em te conhecer, {{nome}}! 🤝"
                          rows={2}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* WhatsApp */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PhoneIcon className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Capturar WhatsApp</Label>
                      </div>
                      <Switch
                        checked={selectedNode.data.collectWhatsapp || false}
                        onCheckedChange={(checked) =>
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, collectWhatsapp: checked } })
                        }
                      />
                    </div>
                    {selectedNode.data.collectWhatsapp && (
                      <div className="space-y-2">
                        <Input
                          value={selectedNode.data.whatsappPrompt || ""}
                          onChange={(e) =>
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, whatsappPrompt: e.target.value } })
                          }
                          placeholder="Qual seu número de WhatsApp? 📱"
                          className="h-8 text-xs"
                        />
                        <Textarea
                          value={selectedNode.data.whatsappFollowUp || ""}
                          onChange={(e) =>
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, whatsappFollowUp: e.target.value } })
                          }
                          placeholder="Obrigado! Vou te enviar mais detalhes 🚀"
                          rows={2}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Capturar Email</Label>
                      </div>
                      <Switch
                        checked={selectedNode.data.collectEmail || false}
                        onCheckedChange={(checked) =>
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, collectEmail: checked } })
                        }
                      />
                    </div>
                    {selectedNode.data.collectEmail && (
                      <div className="space-y-2">
                        <Input
                          value={selectedNode.data.emailPrompt || ""}
                          onChange={(e) =>
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, emailPrompt: e.target.value } })
                          }
                          placeholder="Qual seu melhor email? 📧"
                          className="h-8 text-xs"
                        />
                        <Textarea
                          value={selectedNode.data.emailFollowUp || ""}
                          onChange={(e) =>
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, emailFollowUp: e.target.value } })
                          }
                          placeholder="Perfeito! Enviamos as informações 📧"
                          rows={2}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>
                  </div>
                </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Botões (opcional)</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const buttons = selectedNode.data.buttons || [];
                        if (buttons.length >= 3) {
                          toast.error("Máximo de 3 botões");
                          return;
                        }
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            buttons: [...buttons, { id: Date.now().toString(), text: "", type: "url", value: "" }],
                          },
                        });
                      }}
                      disabled={(selectedNode.data.buttons || []).length >= 3}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Botão
                    </Button>
                  </div>

                  {(!selectedNode.data.buttons || selectedNode.data.buttons.length === 0) && (
                    <p className="text-xs text-muted-foreground">
                      Adicione até 3 botões clicáveis à mensagem.
                    </p>
                  )}

                  {(selectedNode.data.buttons || []).map((btn: any, idx: number) => (
                    <Card key={btn.id || idx} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Botão {idx + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            const buttons = [...(selectedNode.data.buttons || [])];
                            buttons.splice(idx, 1);
                            setSelectedNode({
                              ...selectedNode,
                              data: { ...selectedNode.data, buttons },
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      <Select
                        value={btn.type || "url"}
                        onValueChange={(value) => {
                          const buttons = [...(selectedNode.data.buttons || [])];
                          buttons[idx] = { ...buttons[idx], type: value, value: "" };
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, buttons } });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="url">Link (URL)</SelectItem>
                          <SelectItem value="reply">Resposta rápida</SelectItem>
                          <SelectItem value="call">Ligação</SelectItem>
                          <SelectItem value="flow">Navegar para bloco</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        value={btn.text || ""}
                        onChange={(e) => {
                          const buttons = [...(selectedNode.data.buttons || [])];
                          buttons[idx] = { ...buttons[idx], text: e.target.value };
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, buttons } });
                        }}
                        placeholder="Texto do botão"
                        className="h-8 text-xs"
                      />

                      {btn.type === "url" && (
                        <Input
                          value={btn.value || ""}
                          onChange={(e) => {
                            const buttons = [...(selectedNode.data.buttons || [])];
                            buttons[idx] = { ...buttons[idx], value: e.target.value };
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, buttons } });
                          }}
                          placeholder="https://exemplo.com"
                          className="h-8 text-xs"
                        />
                      )}

                      {btn.type === "call" && (
                        <Input
                          value={btn.value || ""}
                          onChange={(e) => {
                            const buttons = [...(selectedNode.data.buttons || [])];
                            buttons[idx] = { ...buttons[idx], value: e.target.value };
                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, buttons } });
                          }}
                          placeholder="5511999999999"
                          className="h-8 text-xs"
                        />
                      )}

                      {btn.type === "reply" && (
                        <p className="text-[10px] text-muted-foreground">
                          O texto do botão será enviado como resposta ao clicar. Conecte a saída do botão a outro bloco.
                        </p>
                      )}

                      {btn.type === "flow" && (
                        <p className="text-[10px] text-muted-foreground">
                          Conecte a saída &quot;{btn.text || `Botão ${idx + 1}`}&quot; deste bloco ao próximo bloco desejado no canvas.
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
                </>
                )}

                <Separator />
                <div>
                  <Label>⏱️ Delay antes de enviar (segundos)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={selectedNode.data.delaySeconds ?? 0}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, delaySeconds: parseInt(e.target.value) || 0 },
                      })
                    }
                    placeholder="0"
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Tempo de espera antes de enviar esta mensagem (0 = sem delay)
                  </p>
                </div>
              </>
            )}

            {selectedNode?.type === "agenteIA" && (
              (() => {
                const agLabel = String(selectedNode.data.label || "").toLowerCase();
                if (/leader\s*ia/.test(agLabel)) {
                  return (
                    <LeaderIAEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/expert\s*ia/.test(agLabel)) {
                  return (
                    <ExpertIAEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/supervisor/.test(agLabel)) {
                  return (
                    <SupervisorEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                return (
              <div className="space-y-4">
                <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-500" />
                    <Label className="text-base font-bold text-purple-600">Configuração do Agente IA</Label>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Este bloco utiliza Inteligência Artificial para processar a mensagem do usuário e gerar uma resposta inteligente.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Nome do Bloco (Opcional)</Label>
                  <Input
                    value={selectedNode.data.label || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, label: e.target.value },
                      })
                    }
                    placeholder="Ex: Agente de Vendas"
                  />
                </div>


                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      Prompt de Sistema / Instruções
                    </Label>
                    <Select
                      onValueChange={(val) => {
                        const templates: Record<string, string> = {
                          clinica: "Você é um assistente virtual de uma clínica médica 🏥. Seu objetivo é ser empático, profissional e ajudar pacientes com informações sobre especialidades e convênios. Peça o nome do paciente caso ainda não saiba 😊.",
                          agendamento: "Você é um assistente focado em agendamento 📅. Seu objetivo é identificar o serviço desejado, verificar a disponibilidade e coletar os dados necessários para confirmar o horário. Seja direto e organizado ✅.",
                          oficina: "Você é um consultor técnico de uma oficina mecânica 🔧. Use um tom prestativo e confiável. Ajude o cliente a descrever o problema do veículo e explique a importância da manutenção preventiva 🚗.",
                          restaurante: "Você é o atendente de um restaurante 🍴. Seu tom deve ser receptivo e entusiasmado. Ajude com dúvidas sobre o cardápio, horários e reservas de mesa 🍕.",
                          estetica: "Você é um consultor de uma clínica de estética 💄. Use um tom sofisticado e acolhedor. Foque nos benefícios dos tratamentos de beleza e bem-estar para elevar a autoestima da cliente ✨.",
                          qualificacao: "Você é um especialista em qualificação de leads 📋. Seu objetivo é fazer perguntas estratégicas para entender se o cliente tem o perfil ideal para a compra antes de passar para um vendedor humano 👤.",
                          infoproduto: "Você é um especialista em vendas de infoprodutos. Siga este fluxo: 1) Primeiro contato amigável. 2) Pergunte sobre o objetivo ou sonho da pessoa. 3) Mostre autoridade citando resultados. 4) Apresente o curso/mentoria como a solução ideal. 5) Envie o link de pagamento para concluir a inscrição.",
                          encapsulado: "Você é um consultor especializado em saúde. Siga este fluxo RIGOROSAMENTE, um passo de cada vez:\n\n1) Primeiro contato acolhedor: Cumprimente e se apresente. Não faça perguntas ainda.\n2) Identificação da dor: Pergunte qual problema de saúde ou desconforto a pessoa quer resolver hoje.\n3) Prova Social: Após ela responder, envie um breve relato ou depoimento de alguém que teve resultados.\n4) Apresentação: Apresente o produto e a oferta especial, focando nos benefícios.\n5) Fechamento: Ofereça um kit ou combo promocional para fechar o pedido.\n\nREGRAS: Nunca pule etapas. Aguarde a resposta do usuário para avançar. Seja persuasivo e empático.",
                          saas: "Você é um consultor de tecnologia. Siga este fluxo: 1) Primeiro contato profissional. 2) Pergunte sobre como funciona o processo atual da empresa. 3) Mostre como nosso software resolve esses gargalos. 4) Ofereça um teste grátis ou uma demonstração. 5) Converta para um plano pago explicando os benefícios.",
                          assinatura: "Você é um curador de clube de assinatura. Siga este fluxo: 1) Primeiro contato entusiasmado. 2) Pergunte o que a pessoa consome ou precisa com frequência mensal. 3) Mostre o que vem na assinatura deste mês. 4) Ofereça o primeiro mês com um desconto exclusivo. 5) Feche a assinatura recorrente.",
                          servico: "Você é um prestador de serviços especializado. Siga este fluxo: 1) Primeiro contato direto. 2) Pergunte sobre o problema ou demanda específica do cliente. 3) Faça um diagnóstico rápido. 4) Apresente como você trabalha e seu diferencial. 5) Envie a proposta e tente fechar na própria conversa ou agendar uma reunião.",
                          ecommerce: "Você é um atendente de loja online. Siga este fluxo: 1) Primeiro contato prestativo. 2) Pergunte o que a pessoa está procurando. 3) Indique o produto ideal do catálogo. 4) Fale sobre fotos/vídeos que mostram o produto em uso. 5) Ofereça frete grátis ou um cupom e mande o link direto da compra.",
                          altoticket: "Você é um consultor de soluções de alto valor. Siga este fluxo: 1) Primeiro contato consultivo e elegante. 2) Pergunte sobre o momento atual e o objetivo de longo prazo. 3) Construa confiança com cases de sucesso e autoridade. 4) Apresente a solução de forma personalizada. 5) Agende uma reunião estratégica para fechar ao vivo.",
                          aplicativo: "Você é um suporte de aplicativo. Siga este fluxo: 1) Primeiro contato ágil. 2) Pergunte qual problema a pessoa quer resolver usando tecnologia. 3) Mostre o app funcionando na prática. 4) Mande o link para baixar grátis. 5) Apresente o plano premium dentro da conversa."
                        };
                        if (templates[val]) {
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, prompt: templates[val] },
                          });
                          toast.success("Modelo de prompt carregado!");
                        }
                      }}
                    >
                      <SelectTrigger className="w-[180px] h-7 text-[10px] bg-purple-50 dark:bg-purple-900/20 border-purple-200">
                        <SelectValue placeholder="Modelos prontos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinica">🏥 Clínica Médica</SelectItem>
                        <SelectItem value="agendamento">📅 Agendar Consulta</SelectItem>
                        <SelectItem value="oficina">🔧 Oficina Mecânica</SelectItem>
                        <SelectItem value="restaurante">🍴 Restaurante</SelectItem>
                        <SelectItem value="estetica">💄 Clínica de Estética</SelectItem>
                        <SelectItem value="qualificacao">📋 Qualificação de Lead</SelectItem>
                        <SelectItem value="infoproduto">🎯 Infoproduto</SelectItem>
                        <SelectItem value="encapsulado">💊 Encapsulado</SelectItem>
                        <SelectItem value="saas">💻 SaaS</SelectItem>
                        <SelectItem value="assinatura">📦 Assinatura</SelectItem>
                        <SelectItem value="servico">🛠️ Serviço</SelectItem>
                        <SelectItem value="ecommerce">🛒 E-commerce</SelectItem>
                        <SelectItem value="altoticket">🏠 Alto Ticket</SelectItem>
                        <SelectItem value="aplicativo">📱 Aplicativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={selectedNode.data.prompt || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, prompt: e.target.value },
                      })
                    }
                    placeholder="Ex: Você é um assistente de vendas da empresa X. Seja gentil e ajude o cliente com suas dúvidas..."
                    rows={8}
                    className="text-sm italic"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Defina o comportamento, tom de voz e as regras que a IA deve seguir para responder. Você pode editar totalmente os modelos acima.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Modelo de IA</Label>
                  <Select
                    value={selectedNode.data.model || "claude-3-5-sonnet-latest"}
                    onValueChange={(val) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, model: val },
                      })
                    }
                  >
                    <SelectTrigger className="w-full bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-900/30">
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Padrão)</SelectItem>
                      <SelectItem value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Mais rápido)</SelectItem>
                      <SelectItem value="claude-3-7-sonnet-latest">Claude 3.7 Sonnet (Mais inteligente)</SelectItem>
                      <SelectItem value="claude-3-5-sonnet-20241022-v1:0">Managed Agent (Claude 3.5 Sonnet)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    O <strong>Managed Agent</strong> permite delegar tarefas complexas para agentes gerenciados pela Anthropic.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Voz das respostas em áudio</Label>
                  <Select
                    value={selectedNode.data.voice || ""}
                    onValueChange={(val) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, voice: val === "__default__" ? "" : val },
                      })
                    }
                  >
                    <SelectTrigger className="w-full bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-900/30">
                      <SelectValue placeholder="Usar voz padrão do agente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Usar voz padrão do agente</SelectItem>
                      <SelectItem value="nova">Feminina jovem</SelectItem>
                      <SelectItem value="shimmer">Feminina suave</SelectItem>
                      <SelectItem value="alloy">Neutra equilibrada</SelectItem>
                      <SelectItem value="echo">Masculina calma</SelectItem>
                      <SelectItem value="onyx">Masculina grave</SelectItem>
                      <SelectItem value="fable">Narrador (sotaque)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Usada quando o agente responde em áudio neste bloco. Deixe em padrão para usar a voz configurada na tela do Agente IA.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-purple-100 dark:border-purple-900/20 bg-purple-50/50 dark:bg-purple-900/5">
                  <div className="pr-3">
                    <Label className="text-sm font-semibold">Desativar envio em grupos</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Quando ativado, este bloco não responde mensagens recebidas em grupos.
                    </p>
                  </div>
                  <Switch
                    checked={selectedNode.data.disable_in_groups === true}
                    onCheckedChange={(checked) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, disable_in_groups: checked },
                      })
                    }
                  />
                </div>

                <div className="p-3 rounded-lg border border-purple-100 bg-purple-50/50 dark:bg-purple-900/5 dark:border-purple-900/20">
                   <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                     Dica: Você pode usar variáveis como {"{{nome}}"} no prompt para que a IA saiba o nome do cliente.
                   </p>
                </div>
              </div>
                );
              })()
            )}

            {selectedNode?.type === "blocoCondicao" && (selectedNode.data?.label || "").toLowerCase().includes("if/else") && (
              (() => {
                const operatorsByType: Record<string, { value: string; label: string }[]> = {
                  string: [
                    { value: "equals", label: "Igual a" },
                    { value: "not_equals", label: "Diferente de" },
                    { value: "contains", label: "Contém" },
                    { value: "not_contains", label: "Não contém" },
                    { value: "starts_with", label: "Começa com" },
                    { value: "ends_with", label: "Termina com" },
                    { value: "is_empty", label: "Está vazio" },
                    { value: "is_not_empty", label: "Não está vazio" },
                    { value: "matches_regex", label: "Corresponde ao padrão" },
                    { value: "not_matches_regex", label: "Não corresponde ao padrão" },
                    { value: "length_equals", label: "Tamanho igual a" },
                    { value: "length_greater", label: "Tamanho maior que" },
                    { value: "length_less", label: "Tamanho menor que" },
                    { value: "is_numeric", label: "É numérico" },
                  ],
                  number: [
                    { value: "equals", label: "Igual a" },
                    { value: "not_equals", label: "Diferente de" },
                    { value: "greater", label: "Maior que" },
                    { value: "greater_equals", label: "Maior ou igual a" },
                    { value: "less", label: "Menor que" },
                    { value: "less_equals", label: "Menor ou igual a" },
                    { value: "between", label: "Entre" },
                    { value: "is_empty", label: "Está vazio" },
                    { value: "is_not_empty", label: "Não está vazio" },
                  ],
                  boolean: [
                    { value: "is_true", label: "É verdadeiro" },
                    { value: "is_false", label: "É falso" },
                  ],
                  array: [
                    { value: "contains", label: "Contém" },
                    { value: "not_contains", label: "Não contém" },
                    { value: "is_empty", label: "Está vazia" },
                    { value: "is_not_empty", label: "Não está vazia" },
                    { value: "length_equals", label: "Tamanho igual a" },
                    { value: "length_greater", label: "Tamanho maior que" },
                    { value: "length_less", label: "Tamanho menor que" },
                  ],
                  date: [
                    { value: "equals", label: "Igual a" },
                    { value: "before", label: "Antes de" },
                    { value: "after", label: "Depois de" },
                    { value: "between", label: "Entre" },
                    { value: "is_empty", label: "Está vazio" },
                    { value: "is_not_empty", label: "Não está vazio" },
                  ],
                };
                const dataTypeLabels: Record<string, string> = {
                  string: "Texto (String)",
                  number: "Número",
                  boolean: "Booleano",
                  array: "Lista",
                  date: "Data",
                };
                const noValueOps = [
                  "is_empty",
                  "is_not_empty",
                  "is_numeric",
                  "is_true",
                  "is_false",
                ];
                // Migrate legacy single-condition data into the conditions array
                const rawConditions = Array.isArray(selectedNode.data.conditions)
                  ? selectedNode.data.conditions
                  : (selectedNode.data.variable || selectedNode.data.condition)
                    ? [{
                        variable: selectedNode.data.variable || "",
                        dataType: selectedNode.data.dataType || "string",
                        operator: selectedNode.data.operator || "equals",
                        compareValue: selectedNode.data.compareValue ?? selectedNode.data.condition ?? "",
                      }]
                    : [];
                const conditions = rawConditions;
                const updateConditions = (next: any[]) => {
                  setSelectedNode({
                    ...selectedNode,
                    data: { ...selectedNode.data, conditions: next },
                  });
                };
                const addCondition = () => {
                  updateConditions([
                    ...conditions,
                    { variable: "", dataType: "string", operator: "equals", compareValue: "" },
                  ]);
                  setEditingConditionIndex(conditions.length);
                };
                const removeCondition = (idx: number) => {
                  updateConditions(conditions.filter((_: any, i: number) => i !== idx));
                };
                const summarize = (c: any) => {
                  const op = (operatorsByType[c.dataType] || operatorsByType.string)
                    .find((o) => o.value === c.operator)?.label?.toLowerCase() || c.operator;
                  const valuePart = noValueOps.includes(c.operator) ? "" : ` "${c.compareValue ?? ""}"`;
                  return { type: dataTypeLabels[c.dataType] || "Texto", variable: c.variable || "—", op, valuePart };
                };
                const editing = editingConditionIndex != null ? conditions[editingConditionIndex] : null;
                const updateEditing = (patch: any) => {
                  if (editingConditionIndex == null) return;
                  const next = conditions.map((c: any, i: number) =>
                    i === editingConditionIndex ? { ...c, ...patch } : c
                  );
                  updateConditions(next);
                };
                return (
              <>
                <div className="space-y-2">
                  {conditions.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma condição definida. Clique em "Adicionar nova condição (IF)".
                    </p>
                  )}
                  {conditions.map((c: any, idx: number) => {
                    const s = summarize(c);
                    return (
                      <div
                        key={idx}
                        className="group flex items-center gap-2 rounded-md border bg-card hover:bg-muted/50 transition px-3 py-2 cursor-pointer"
                        onClick={() => setEditingConditionIndex(idx)}
                      >
                        <span className="inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-bold bg-muted text-foreground">
                          IF {idx + 1}
                        </span>
                        <div className="flex-1 text-xs text-foreground/90 truncate">
                          <span className="text-muted-foreground mr-1">{s.type}</span>
                          <code className="font-mono text-primary">{s.variable}</code>
                          <span className="mx-1 text-muted-foreground">{s.op}</span>
                          {s.valuePart && <span className="font-medium">{s.valuePart}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeCondition(idx); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs"
                          title="Remover"
                        >
                          ✕
                        </button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2">
                    <span className="inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-bold bg-orange-500/80 text-white">
                      ELSE (Padrão)
                    </span>
                    <span className="text-xs text-foreground/80">
                      Executado quando nenhuma condição IF for verdadeira
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center"
                    onClick={addCondition}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Adicionar nova condição (IF)
                  </Button>

                  <details className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-medium flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                      Como funciona
                    </summary>
                    <div className="mt-2 space-y-1 text-muted-foreground">
                      <p>• As condições IF são avaliadas em ordem.</p>
                      <p>• A primeira condição verdadeira segue seu caminho.</p>
                      <p>• Se nenhuma for verdadeira, o caminho ELSE (Padrão) é seguido.</p>
                    </div>
                  </details>
                </div>

                {/* Sub-dialog: editar uma condição */}
                <Dialog
                  open={editingConditionIndex != null}
                  onOpenChange={(open) => { if (!open) setEditingConditionIndex(null); }}
                >
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Editar condição IF {(editingConditionIndex ?? 0) + 1}</DialogTitle>
                    </DialogHeader>
                    {editing && (() => {
                      const dataType = editing.dataType || "string";
                      const operator = editing.operator || "equals";
                      const currentOperators = operatorsByType[dataType] || operatorsByType.string;
                      const needsValue = !noValueOps.includes(operator);
                      return (
                        <div className="space-y-4">
                          <div>
                            <Label>Variável a verificar</Label>
                            <Select
                              value={editing.variable || ""}
                              onValueChange={(v) => updateEditing({ variable: v })}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Selecione uma variável" />
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                                  Variáveis do Lead
                                </div>
                                <SelectItem value="{{lead.id}}">{"{{lead.id}}"} — ID do lead</SelectItem>
                                <SelectItem value="{{lead.code}}">{"{{lead.code}}"} — Código do lead</SelectItem>
                                <SelectItem value="{{lead.name}}">{"{{lead.name}}"} — Nome completo</SelectItem>
                                <SelectItem value="{{lead.first_name}}">{"{{lead.first_name}}"} — Primeiro nome</SelectItem>
                                <SelectItem value="{{lead.phone}}">{"{{lead.phone}}"} — Telefone</SelectItem>
                                <SelectItem value="{{lead.email}}">{"{{lead.email}}"} — E-mail</SelectItem>
                                <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase">
                                  Campos personalizados
                                </div>
                                <SelectItem value="{{lead.origen}}">{"{{lead.origen}}"} — Origen</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Tipo de dado</Label>
                              <Select
                                value={dataType}
                                onValueChange={(v) =>
                                  updateEditing({
                                    dataType: v,
                                    operator: (operatorsByType[v] || operatorsByType.string)[0].value,
                                  })
                                }
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">Texto (String)</SelectItem>
                                  <SelectItem value="number">Número</SelectItem>
                                  <SelectItem value="boolean">Booleano (Verdadeiro/Falso)</SelectItem>
                                  <SelectItem value="array">Lista (Array)</SelectItem>
                                  <SelectItem value="date">Data</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Operador</Label>
                              <Select
                                value={operator}
                                onValueChange={(v) => updateEditing({ operator: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-72">
                                  {currentOperators.map((op) => (
                                    <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {needsValue && (
                            <div>
                              <Label>Valor para comparar</Label>
                              <Input
                                value={editing.compareValue ?? ""}
                                onChange={(e) => updateEditing({ compareValue: e.target.value })}
                                placeholder="Ex: sucesso"
                                type={dataType === "date" ? "datetime-local" : dataType === "number" ? "number" : "text"}
                              />
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setEditingConditionIndex(null)}>
                              Concluir
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </DialogContent>
                </Dialog>
              </>
                );
              })()
            )}

            {selectedNode?.type === "blocoCondicao" && !(selectedNode.data?.label || "").toLowerCase().includes("if/else") && (
              <>
                {(() => {
                  const isSplit = (selectedNode.data?.label || "").toLowerCase().includes("split");
                  const isTags = (selectedNode.data?.label || "").toLowerCase().includes("tag");
                  const isHorario = (selectedNode.data?.label || "").toLowerCase().includes("horário") || (selectedNode.data?.label || "").toLowerCase().includes("horario");
                  const isFiltroCadastro = (selectedNode.data?.label || "").toLowerCase().includes("filtro por cadastro");
                  const isFiltroMensagem = (selectedNode.data?.label || "").toLowerCase().includes("filtro por mensagem");
                  const isFiltroStatus = (selectedNode.data?.label || "").toLowerCase().includes("filtro por status do atendimento") || (selectedNode.data?.label || "").toLowerCase().includes("status do atendimento");
                  const isFiltroSessao = (selectedNode.data?.label || "").toLowerCase().includes("filtro por sessão") || (selectedNode.data?.label || "").toLowerCase().includes("filtro por sessao");
                  const isFiltroFollowUp = (selectedNode.data?.label || "").toLowerCase().includes("follow up") || (selectedNode.data?.label || "").toLowerCase().includes("followup");
                  if (isSplit || isTags || isHorario || isFiltroCadastro || isFiltroMensagem || isFiltroStatus || isFiltroSessao || isFiltroFollowUp) return null;
                  return (
                <div>
                  <Label>Variável a verificar</Label>
                  <div className="flex gap-2 mt-1">
                    <Select
                      value={selectedNode.data.variable || ""}
                      onValueChange={(v) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, variable: v },
                        })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione uma variável" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                          Variáveis do Lead
                        </div>
                        <SelectItem value="{{lead.id}}">{"{{lead.id}}"} — ID do lead</SelectItem>
                        <SelectItem value="{{lead.code}}">{"{{lead.code}}"} — Código do lead</SelectItem>
                        <SelectItem value="{{lead.name}}">{"{{lead.name}}"} — Nome completo</SelectItem>
                        <SelectItem value="{{lead.first_name}}">{"{{lead.first_name}}"} — Primeiro nome</SelectItem>
                        <SelectItem value="{{lead.phone}}">{"{{lead.phone}}"} — Telefone</SelectItem>
                        <SelectItem value="{{lead.email}}">{"{{lead.email}}"} — E-mail</SelectItem>
                        <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase">
                          Campos personalizados
                        </div>
                        <SelectItem value="{{lead.origen}}">{"{{lead.origen}}"} — Origen</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={selectedNode.data.variable || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, variable: e.target.value },
                        })
                      }
                      placeholder="ou digite manualmente"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Selecione uma variável pronta ou digite a sua própria.
                  </p>
                </div>
                  );
                })()}
                {(() => {
                  const isSplit = (selectedNode.data?.label || "").toLowerCase().includes("split");
                  const isTags = (selectedNode.data?.label || "").toLowerCase().includes("tag");
                  const isHorario = (selectedNode.data?.label || "").toLowerCase().includes("horário") || (selectedNode.data?.label || "").toLowerCase().includes("horario");
                  const isFiltroCadastro = (selectedNode.data?.label || "").toLowerCase().includes("filtro por cadastro");
                  const isFiltroMensagem = (selectedNode.data?.label || "").toLowerCase().includes("filtro por mensagem");
                  const isFiltroStatus = (selectedNode.data?.label || "").toLowerCase().includes("filtro por status do atendimento") || (selectedNode.data?.label || "").toLowerCase().includes("status do atendimento");
                  const isFiltroSessao = (selectedNode.data?.label || "").toLowerCase().includes("filtro por sessão") || (selectedNode.data?.label || "").toLowerCase().includes("filtro por sessao");
                  const isFiltroFollowUp = (selectedNode.data?.label || "").toLowerCase().includes("follow up") || (selectedNode.data?.label || "").toLowerCase().includes("followup");
                  if (isHorario) {
                    const rules: any[] = Array.isArray(selectedNode.data.scheduleRules) ? selectedNode.data.scheduleRules : [];
                    const updateRules = (next: any[]) => {
                      setSelectedNode({
                        ...selectedNode,
                        data: {
                          ...selectedNode.data,
                          scheduleRules: next,
                          branches: [
                            { label: "Dentro do Horário", value: "in" },
                            { label: "Fora do Horário", value: "out" },
                          ],
                          condition: "in",
                        },
                      });
                    };
                    const DAYS = [
                      { k: 0, label: "Dom" }, { k: 1, label: "Seg" }, { k: 2, label: "Ter" },
                      { k: 3, label: "Qua" }, { k: 4, label: "Qui" }, { k: 5, label: "Sex" }, { k: 6, label: "Sáb" },
                    ];
                    return (
                      <div className="space-y-3">
                        <div>
                          <Label>Regras de horário</Label>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Defina dias da semana e janelas de horário. Se o momento atual bater em qualquer regra, segue por <b>Dentro do Horário</b>; caso contrário, por <b>Fora do Horário</b>.
                          </p>
                        </div>
                        {rules.length === 0 && (
                          <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-md">
                            Nenhuma regra configurada
                          </div>
                        )}
                        {rules.map((r: any, idx: number) => (
                          <div key={idx} className="space-y-2 rounded-md border bg-card p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">Regra {idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => updateRules(rules.filter((_, i) => i !== idx))}
                                className="text-muted-foreground hover:text-destructive text-xs"
                              >
                                Remover
                              </button>
                            </div>
                            <div>
                              <Label className="text-[11px]">Dias da semana</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {DAYS.map((d) => {
                                  const selected = (r.days || []).includes(d.k);
                                  return (
                                    <button
                                      key={d.k}
                                      type="button"
                                      onClick={() => {
                                        const days = selected
                                          ? (r.days || []).filter((x: number) => x !== d.k)
                                          : [...(r.days || []), d.k];
                                        updateRules(rules.map((x, i) => i === idx ? { ...x, days } : x));
                                      }}
                                      className={`px-2.5 py-1 text-[11px] rounded border ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-foreground"}`}
                                    >
                                      {d.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[11px]">Início</Label>
                                <Input
                                  type="time"
                                  value={r.start || ""}
                                  onChange={(e) => updateRules(rules.map((x, i) => i === idx ? { ...x, start: e.target.value } : x))}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-[11px]">Término</Label>
                                <Input
                                  type="time"
                                  value={r.end || ""}
                                  onChange={(e) => updateRules(rules.map((x, i) => i === idx ? { ...x, end: e.target.value } : x))}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-center"
                          onClick={() => updateRules([...rules, { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" }])}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Adicionar nova regra
                        </Button>
                        <div className="rounded-md border border-border bg-muted/30 p-2 text-[11px] space-y-1">
                          <div className="font-semibold text-foreground">Saídas fixas</div>
                          <div className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Dentro do Horário</div>
                          <div className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> Fora do Horário</div>
                        </div>
                      </div>
                    );
                  }
                  if (isFiltroCadastro) {
                    const OPERATORS = [
                      { v: "equals", label: "Igual a" },
                      { v: "greater", label: "Maior que" },
                      { v: "less", label: "Menor que" },
                      { v: "is_null", label: "É nulo" },
                      { v: "is_empty", label: "Está vazio" },
                    ];
                    const NO_VALUE = new Set(["is_null", "is_empty"]);
                    const FIELDS = [
                      "{{lead.name}}", "{{lead.first_name}}", "{{lead.phone}}", "{{lead.email}}",
                      "{{lead.code}}", "{{lead.id}}", "{{lead.origen}}", "{{lead.tags}}",
                      "{{lead.city}}", "{{lead.state}}", "{{lead.country}}",
                      "{{lead.created_at}}", "{{lead.updated_at}}",
                    ];
                    const branches: any[] = Array.isArray(selectedNode.data.branches) && selectedNode.data.branches.length > 0
                      ? selectedNode.data.branches
                      : [{ label: "Filtro 1", field: "", operator: "equals", value: "" }];
                    const updateBranches = (next: any[]) => {
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, branches: next },
                      });
                    };
                    return (
                      <div className="space-y-2">
                        <datalist id="fluxo-cadastro-fields">
                          {FIELDS.map((f) => (<option key={f} value={f} />))}
                        </datalist>
                        <Label>Campos personalizados</Label>
                        <p className="text-[10px] text-muted-foreground -mt-1">
                          Cada filtro gera uma saída. O fluxo segue pelo primeiro filtro que o lead atender. Se nenhum bater, o ELSE (Padrão) é usado.
                        </p>
                        {branches.map((b: any, idx: number) => {
                          const hideValue = NO_VALUE.has(b.operator);
                          return (
                            <div key={idx} className="space-y-2 rounded-md border bg-card p-3">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-bold bg-muted text-foreground">
                                  {idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateBranches(branches.filter((_, i) => i !== idx))}
                                  className="text-muted-foreground hover:text-destructive text-xs"
                                  disabled={branches.length <= 1}
                                  title="Remover filtro"
                                >
                                  ✕ Remover
                                </button>
                              </div>
                              <div>
                                <Label className="text-[11px]">Chave personalizada</Label>
                                <Input
                                  value={b.field || ""}
                                  list="fluxo-cadastro-fields"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    updateBranches(branches.map((x, i) => i === idx ? { ...x, field: v, label: v || `Filtro ${idx + 1}` } : x));
                                  }}
                                  placeholder="Ex: {{lead.email}} ou nome do campo"
                                  className="mt-1"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px]">Tipo de Comparação</Label>
                                  <Select
                                    value={b.operator || "equals"}
                                    onValueChange={(v) => updateBranches(branches.map((x, i) => i === idx ? { ...x, operator: v } : x))}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {OPERATORS.map((o) => (
                                        <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-[11px]">Valor</Label>
                                  <Input
                                    value={b.value || ""}
                                    onChange={(e) => updateBranches(branches.map((x, i) => i === idx ? { ...x, value: e.target.value } : x))}
                                    placeholder={hideValue ? "—" : "Valor ou {{variável}}"}
                                    disabled={hideValue}
                                    className="mt-1"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2">
                          <span className="inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-bold bg-orange-500/80 text-white">
                            ELSE (Padrão)
                          </span>
                          <span className="text-xs text-foreground/80">
                            Executado quando nenhum filtro acima corresponder
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-center"
                          onClick={() => {
                            const i = branches.length + 1;
                            updateBranches([...branches, { label: `Filtro ${i}`, field: "", operator: "equals", value: "" }]);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Adicionar campo personalizado
                        </Button>
                      </div>
                    );
                  }
                  if (isFiltroStatus) {
                    const STATUSES = [
                      { value: "queue", label: "Na Fila", desc: "Atendimento aguardando na fila", color: "bg-amber-500" },
                      { value: "human", label: "Humano", desc: "Em atendimento com atendente humano", color: "bg-blue-500" },
                      { value: "agent", label: "Agente", desc: "Em atendimento conduzido pela IA", color: "bg-violet-500" },
                      { value: "done", label: "Finalizado", desc: "Atendimento encerrado", color: "bg-emerald-500" },
                    ];
                    if (!Array.isArray(selectedNode.data.branches) || selectedNode.data.branches.length !== 4) {
                      setTimeout(() => {
                        setSelectedNode((prev: any) => prev ? ({
                          ...prev,
                          data: {
                            ...prev.data,
                            branches: STATUSES.map((s) => ({ label: s.label, value: s.value })),
                          },
                        }) : prev);
                      }, 0);
                    }
                    return (
                      <div className="space-y-2">
                        <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-[11px] text-foreground/80">
                          Conecte cada saída no canvas ao fluxo correspondente. O ramo é escolhido automaticamente conforme o status do atendimento no momento da execução.
                        </div>
                        <Label>Saídas fixas</Label>
                        {STATUSES.map((s) => (
                          <div key={s.value} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2">
                            <span className={`mt-1 inline-block w-2 h-2 rounded-full ${s.color}`} />
                            <div className="flex-1">
                              <div className="text-sm font-semibold">{s.label}</div>
                              <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if (isFiltroSessao) {
                    const SESSIONS = [
                      { value: "open", label: "Sessão Aberta", desc: "Dispositivo não oficial ou oficial com sessão WhatsApp ativa (expiration_at futuro)", color: "bg-emerald-500" },
                      { value: "closed", label: "Sessão Fechada", desc: "Dispositivo oficial sem sessão ativa ou com expiration_at expirado", color: "bg-rose-500" },
                    ];
                    if (!Array.isArray(selectedNode.data.branches) || selectedNode.data.branches.length !== 2 || selectedNode.data.branches[0]?.value !== "open") {
                      setTimeout(() => {
                        setSelectedNode((prev: any) => prev ? ({
                          ...prev,
                          data: {
                            ...prev.data,
                            branches: SESSIONS.map((s) => ({ label: s.label, value: s.value })),
                          },
                        }) : prev);
                      }, 0);
                    }
                    return (
                      <div className="space-y-2">
                        <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-[11px] text-foreground/80">
                          Dispositivos não oficiais seguem sempre pela saída <b>Sessão Aberta</b>. Dispositivos oficiais verificam a sessão WhatsApp (janela de 24h) no momento da execução.
                        </div>
                        <Label>Saídas fixas</Label>
                        {SESSIONS.map((s) => (
                          <div key={s.value} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2">
                            <span className={`mt-1 inline-block w-2 h-2 rounded-full ${s.color}`} />
                            <div className="flex-1">
                              <div className="text-sm font-semibold">{s.label}</div>
                              <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if (isFiltroFollowUp) {
                    const FOLLOWS = [
                      { value: "followup", label: "Follow Up", desc: "Task em processamento vinculada a mensagem do sistema (status≠0)", color: "bg-cyan-500" },
                      { value: "not_followup", label: "Não é Follow Up", desc: "Task disparada por mensagem normal do lead ou de outro gatilho", color: "bg-slate-500" },
                    ];
                    if (!Array.isArray(selectedNode.data.branches) || selectedNode.data.branches.length !== 2 || selectedNode.data.branches[0]?.value !== "followup") {
                      setTimeout(() => {
                        setSelectedNode((prev: any) => prev ? ({
                          ...prev,
                          data: {
                            ...prev.data,
                            branches: FOLLOWS.map((s) => ({ label: s.label, value: s.value })),
                          },
                        }) : prev);
                      }, 0);
                    }
                    return (
                      <div className="space-y-2">
                        <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-[11px] text-foreground/80">
                          Conecte cada saída no canvas. O ramo é escolhido conforme a task em processamento estar vinculada a uma mensagem status≠0 (follow up automático/watcher).
                        </div>
                        <Label>Saídas fixas</Label>
                        {FOLLOWS.map((s) => (
                          <div key={s.value} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2">
                            <span className={`mt-1 inline-block w-2 h-2 rounded-full ${s.color}`} />
                            <div className="flex-1">
                              <div className="text-sm font-semibold">{s.label}</div>
                              <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if (isFiltroMensagem) {
                    const OPERATORS = [
                      { v: "equals", label: "Igual" },
                      { v: "contains", label: "Contém" },
                      { v: "starts_with", label: "Inicia com" },
                      { v: "ends_with", label: "Finaliza com" },
                    ];
                    const branches: any[] = Array.isArray(selectedNode.data.branches) && selectedNode.data.branches.length > 0
                      ? selectedNode.data.branches
                      : [{ label: "Resposta 1", operator: "contains", value: "" }];
                    const updateBranches = (next: any[]) => {
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, branches: next },
                      });
                    };
                    return (
                      <div className="space-y-2">
                        <Label>Respostas do usuário</Label>
                        <p className="text-[10px] text-muted-foreground -mt-1">
                          Cada filtro de mensagem gera uma saída. O fluxo segue pelo primeiro que corresponder à mensagem recebida. Se nenhum bater, o ELSE (Padrão) é usado.
                        </p>
                        {branches.map((b: any, idx: number) => (
                          <div key={idx} className="space-y-2 rounded-md border bg-card p-3">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-bold bg-muted text-foreground">
                                {idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateBranches(branches.filter((_, i) => i !== idx))}
                                className="text-muted-foreground hover:text-destructive text-xs"
                                disabled={branches.length <= 1}
                                title="Remover filtro"
                              >
                                ✕ Remover
                              </button>
                            </div>
                            <div>
                              <Label className="text-[11px]">Tipo de filtro</Label>
                              <Select
                                value={b.operator || "contains"}
                                onValueChange={(v) => updateBranches(branches.map((x, i) => i === idx ? { ...x, operator: v } : x))}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {OPERATORS.map((o) => (
                                    <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[11px]">Texto da mensagem</Label>
                              <Textarea
                                value={b.value || ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateBranches(branches.map((x, i) => i === idx ? { ...x, value: v, label: v.slice(0, 30) || `Resposta ${idx + 1}` } : x));
                                }}
                                placeholder="Ex: sim, quero, comprar..."
                                className="mt-1 min-h-[60px]"
                              />
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2">
                          <span className="inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-bold bg-orange-500/80 text-white">
                            ELSE (Padrão)
                          </span>
                          <span className="text-xs text-foreground/80">
                            Executado quando nenhum filtro corresponder
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-center"
                          onClick={() => {
                            const i = branches.length + 1;
                            updateBranches([...branches, { label: `Resposta ${i}`, operator: "contains", value: "" }]);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Adicionar nova resposta do usuário
                        </Button>
                      </div>
                    );
                  }
                  const branches: any[] = Array.isArray(selectedNode.data.branches) && selectedNode.data.branches.length > 0
                    ? selectedNode.data.branches
                    : [
                        isTags
                          ? { label: "Tag 1", value: "" }
                          : { label: isSplit ? "Caminho 1" : "Verdadeiro", value: selectedNode.data.condition || "" },
                        isTags
                          ? { label: "Tag 2", value: "" }
                          : { label: isSplit ? "Caminho 2" : "Falso", value: "" },
                      ];
                  const updateBranches = (next: any[]) => {
                    setSelectedNode({
                      ...selectedNode,
                      data: { ...selectedNode.data, branches: next, condition: next[0]?.value ?? "" },
                    });
                  };
                  return (
                    <div className="space-y-2">
                      {isTags && (
                        <datalist id="fluxo-tag-presets">
                          {[
                            "abandonou-carrinho","abmex","active-campaign","aguardando-pagamento","appmax","ativo-whatsapp",
                            "b4you","braip","calendly","cancelado","cartao-credito","cartpanda","compra-realizada","custom",
                            "digital_guru","disputando","doppus","eduzz","email","email-cold","email-hot","email-warm",
                            "estornou","evermart","facebook","form","gerou-boleto","gerou-pix","greenn","grupo-whats",
                            "grupo-whatsapp","herospark","hotmart","hotwebinar","importado-csv","import-contact",
                            "iniciou-pagamento-cartao","irroba","iset","kirvano","kiwify","lastlink","leadster",
                            "loja_integrada","manychat","melldin","monetizze","neemo","notazz","nuvemshop","pagarme",
                            "payt","pepper","perfect-pay","proaluno","rd_station_marketing","sacoleiroapp","sellflux",
                            "sellfront","shopify","telefone","ticto","tictov2","tray","unbounce","vnda","voomp","wbuy",
                            "wix","woocommerce","wordpress","yampi",
                          ].map((t) => (<option key={t} value={t} />))}
                        </datalist>
                      )}
                      <Label>
                        {isSplit ? "Caminhos paralelos" : isTags ? "Tags" : "Caminhos (valores comparados)"}
                      </Label>
                      <p className="text-[10px] text-muted-foreground -mt-1">
                        {isSplit
                          ? "Cada caminho gera uma saída paralela. Todos serão executados ao mesmo tempo."
                          : isTags
                          ? "Cada tag gera uma saída. O fluxo segue pela tag que o lead possuir. Se nenhuma bater, o ELSE (Padrão) é usado."
                          : "Cada caminho gera uma saída no bloco. Se nenhum valor bater, o ELSE (Padrão) é usado."}
                      </p>
                      {branches.map((b: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 rounded-md border bg-card px-2 py-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-bold bg-muted text-foreground">
                            {idx + 1}
                          </span>
                          {isTags ? (
                            <>
                              <Input
                                value={b.value || ""}
                                list="fluxo-tag-presets"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const next = branches.map((x, i) => i === idx ? { ...x, value: v, label: v } : x);
                                  updateBranches(next);
                                }}
                                placeholder="Selecione ou digite uma tag"
                                className="flex-1"
                              />
                            </>
                          ) : (
                            <Input
                              value={b.label || ""}
                              onChange={(e) => {
                                const next = branches.map((x, i) => i === idx ? { ...x, label: e.target.value } : x);
                                updateBranches(next);
                              }}
                              placeholder="Nome do caminho"
                              className={isSplit ? "flex-1" : "w-32"}
                            />
                          )}
                          {!isSplit && !isTags && (
                            <Input
                              value={b.value || ""}
                              onChange={(e) => {
                                const next = branches.map((x, i) => i === idx ? { ...x, value: e.target.value } : x);
                                updateBranches(next);
                              }}
                              placeholder="Valor (ex: sim)"
                              className="flex-1"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => updateBranches(branches.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-destructive text-xs px-1"
                            title={isTags ? "Remover tag" : "Remover caminho"}
                            disabled={branches.length <= 1}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {!isSplit && (
                        <div className="flex items-center gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2">
                          <span className="inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-bold bg-orange-500/80 text-white">
                            ELSE (Padrão)
                          </span>
                          <span className="text-xs text-foreground/80">
                            {isTags ? "Executado quando nenhuma tag acima corresponder" : "Executado quando nenhum valor acima for atendido"}
                          </span>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center"
                        onClick={() => {
                          const i = branches.length + 1;
                          const item = isTags
                            ? { label: `Tag ${i}`, value: "" }
                            : { label: `Caminho ${i}`, value: isSplit ? `path-${i}` : "" };
                          updateBranches([...branches, item]);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> {isTags ? "Adicionar nova tag" : "Adicionar novo caminho"}
                      </Button>
                    </div>
                  );
                })()}
              </>
            )}

            {selectedNode?.type === "blocoGatilho" && (
              <>
                <div>
                  <Label className="flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    Palavras-chave (Gatilho)
                  </Label>
                  {(() => {
                    const raw = String(selectedNode.data.keyword ?? keywordFluxo ?? "");
                    const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
                    const updateList = (next: string[]) => {
                      const joined = next.join(", ");
                      setKeywordFluxo(joined);
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, keyword: joined },
                      });
                    };
                    const addFromInput = (value: string) => {
                      const pieces = value.split(",").map((s) => s.trim()).filter(Boolean);
                      if (!pieces.length) return;
                      const merged = Array.from(new Set([...list, ...pieces]));
                      updateList(merged);
                    };
                    return (
                      <>
                        <div className="mt-1 flex flex-wrap gap-1.5 p-2 rounded-md border border-input bg-background min-h-[42px]">
                          {list.map((kw, idx) => (
                            <span
                              key={`${kw}-${idx}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/15 text-primary border border-primary/30"
                            >
                              {kw}
                              <button
                                type="button"
                                onClick={() => updateList(list.filter((_, i) => i !== idx))}
                                className="hover:text-destructive ml-0.5 leading-none"
                                aria-label={`Remover ${kw}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <input
                            id="gatilho-keyword-input"
                            type="text"
                            placeholder={list.length ? "Adicionar..." : "Ex: oi, menu, preço"}
                            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                            onKeyDown={(e) => {
                              const target = e.currentTarget;
                              if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                                if (target.value.trim()) {
                                  e.preventDefault();
                                  addFromInput(target.value);
                                  target.value = "";
                                }
                              } else if (e.key === "Backspace" && !target.value && list.length) {
                                updateList(list.slice(0, -1));
                              }
                            }}
                            onBlur={(e) => {
                              if (e.currentTarget.value.trim()) {
                                addFromInput(e.currentTarget.value);
                                e.currentTarget.value = "";
                              }
                            }}
                            onPaste={(e) => {
                              const text = e.clipboardData.getData("text");
                              if (text.includes(",")) {
                                e.preventDefault();
                                addFromInput(text);
                              }
                            }}
                          />
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const el = document.getElementById("gatilho-keyword-input") as HTMLInputElement | null;
                              if (el?.value.trim()) {
                                addFromInput(el.value);
                                el.value = "";
                                el.focus();
                              } else {
                                el?.focus();
                              }
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar palavra-chave
                          </Button>
                          {list.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              {list.length} palavra(s)-chave
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Adicione várias palavras-chave. Pressione Enter ou vírgula para confirmar. O fluxo dispara quando qualquer uma for recebida.
                        </p>
                      </>
                    );
                  })()}
                </div>
              </>
            )}

            {selectedNode?.type === "blocoAcao" && (
              (() => {
                const isApiCall = /chamada\s*de\s*api/i.test(String(selectedNode.data.label || ""));
                if (isApiCall) {
                  const apiConfig = selectedNode.data.apiConfig || {};
                  const method = apiConfig.method || "GET";
                  const url = apiConfig.url || "";
                  const headers: Array<{ key: string; value: string }> = Array.isArray(apiConfig.headers) ? apiConfig.headers : [];
                  const bodyParams: Array<{ key: string; value: string }> = Array.isArray(apiConfig.body) ? apiConfig.body : [];
                  const queryParams: Array<{ key: string; value: string }> = Array.isArray(apiConfig.query) ? apiConfig.query : [];
                  const updateApi = (patch: any) =>
                    setSelectedNode({
                      ...selectedNode,
                      data: {
                        ...selectedNode.data,
                        actionType: "api_call",
                        apiConfig: { method, url, headers, body: bodyParams, query: queryParams, ...patch },
                      },
                    });
                  const allowsBody = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
                  const updateList = (
                    list: Array<{ key: string; value: string }>,
                    index: number,
                    field: "key" | "value",
                    value: string,
                  ) => list.map((item, i) => (i === index ? { ...item, [field]: value } : item));
                  return (
                    <>
                      <div>
                        <Label>Endpoint da API</Label>
                        <div className="flex gap-2 mt-1">
                          <Select value={method} onValueChange={(v) => updateApi({ method: v })}>
                            <SelectTrigger className="w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GET">GET</SelectItem>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="DELETE">DELETE</SelectItem>
                              <SelectItem value="PATCH">PATCH</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            className="flex-1"
                            value={url}
                            onChange={(e) => updateApi({ url: e.target.value })}
                            placeholder="https://api.exemplo.com/endpoint"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Use variáveis: {"{{lead.campo}}"}, {"{{node.respostas}}"}, {"{{memoria.campo}}"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border/40 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">Headers</Label>
                            <p className="text-[11px] text-muted-foreground">
                              Cabeçalhos HTTP enviados nesta requisição.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateApi({ headers: [...headers, { key: "", value: "" }] })}
                          >
                            + Adicionar
                          </Button>
                        </div>
                        {headers.map((h, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <Input
                              className="flex-1"
                              placeholder="Chave (ex: Authorization)"
                              value={h.key}
                              onChange={(e) => updateApi({ headers: updateList(headers, i, "key", e.target.value) })}
                            />
                            <Input
                              className="flex-1"
                              placeholder="Valor"
                              value={h.value}
                              onChange={(e) => updateApi({ headers: updateList(headers, i, "value", e.target.value) })}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateApi({ headers: headers.filter((_, idx) => idx !== i) })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className={`rounded-lg border border-border/40 p-3 space-y-2 ${!allowsBody ? "opacity-50" : ""}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">Parâmetros Body</Label>
                            <p className="text-[11px] text-muted-foreground">
                              Campos do corpo (POST, PUT, PATCH, DELETE).
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!allowsBody}
                            onClick={() => updateApi({ body: [...bodyParams, { key: "", value: "" }] })}
                          >
                            + Adicionar
                          </Button>
                        </div>
                        {bodyParams.map((p, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <Input
                              className="flex-1"
                              placeholder="Chave"
                              value={p.key}
                              disabled={!allowsBody}
                              onChange={(e) => updateApi({ body: updateList(bodyParams, i, "key", e.target.value) })}
                            />
                            <Input
                              className="flex-1"
                              placeholder="Valor"
                              value={p.value}
                              disabled={!allowsBody}
                              onChange={(e) => updateApi({ body: updateList(bodyParams, i, "value", e.target.value) })}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={!allowsBody}
                              onClick={() => updateApi({ body: bodyParams.filter((_, idx) => idx !== i) })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border border-border/40 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">Parâmetros Query</Label>
                            <p className="text-[11px] text-muted-foreground">
                              Parâmetros de query string acrescentados à URL.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateApi({ query: [...queryParams, { key: "", value: "" }] })}
                          >
                            + Adicionar
                          </Button>
                        </div>
                        {queryParams.map((p, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <Input
                              className="flex-1"
                              placeholder="Chave"
                              value={p.key}
                              onChange={(e) => updateApi({ query: updateList(queryParams, i, "key", e.target.value) })}
                            />
                            <Input
                              className="flex-1"
                              placeholder="Valor"
                              value={p.value}
                              onChange={(e) => updateApi({ query: updateList(queryParams, i, "value", e.target.value) })}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateApi({ query: queryParams.filter((_, idx) => idx !== i) })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div>
                        <Label>Salvar resposta em (opcional)</Label>
                        <Input
                          value={apiConfig.responseVariable || ""}
                          onChange={(e) => updateApi({ responseVariable: e.target.value })}
                          placeholder="Ex: api_resposta"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          O retorno da API ficará disponível como {"{{memoria.<nome>}}"} nos blocos seguintes.
                        </p>
                      </div>
                    </>
                  );
                }
                const label = String(selectedNode.data.label || "").toLowerCase();
                if (/resumo\s*de\s*conversa/.test(label)) {
                  return (
                    <ResumoConversaEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                const memoryVariant: "atendimento" | "lead" | "projeto" | null =
                  /mem[oó]ria de atendimento/.test(label)
                    ? "atendimento"
                    : /mem[oó]ria de lead/.test(label)
                    ? "lead"
                    : /mem[oó]ria de projeto/.test(label)
                    ? "projeto"
                    : null;
                if (memoryVariant) {
                  return (
                    <MemoriaAtendimentoEditor
                      data={selectedNode.data}
                      variant={memoryVariant}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, actionType: `memory_${memoryVariant}`, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/remover\s*tags/.test(label)) {
                  const raw = selectedNode.data.removeTags;
                  const tags: string[] = Array.isArray(raw)
                    ? raw
                    : typeof selectedNode.data.actionConfig === "string" && selectedNode.data.actionConfig.trim()
                    ? selectedNode.data.actionConfig.split(",").map((s: string) => s.trim()).filter(Boolean)
                    : [];
                  return (
                    <AdicionarTagsEditor
                      mode="remove"
                      value={tags}
                      availableTags={availableTags}
                      loading={loadingTags}
                      onRefresh={fetchTagsForEditor}
                      onChange={(next) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            actionType: "untag",
                            removeTags: next,
                            actionConfig: next.join(","),
                          },
                        })
                      }
                    />
                  );
                }
                if (/adicionar\s*tags/.test(label)) {
                  const raw = selectedNode.data.tags;
                  const tags: string[] = Array.isArray(raw)
                    ? raw
                    : typeof selectedNode.data.actionConfig === "string" && selectedNode.data.actionConfig.trim()
                    ? selectedNode.data.actionConfig.split(",").map((s: string) => s.trim()).filter(Boolean)
                    : [];
                  return (
                    <AdicionarTagsEditor
                      value={tags}
                      availableTags={availableTags}
                      loading={loadingTags}
                      onRefresh={fetchTagsForEditor}
                      onChange={(next) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: {
                            ...selectedNode.data,
                            actionType: "tag",
                            tags: next,
                            actionConfig: next.join(","),
                          },
                        })
                      }
                    />
                  );
                }
                if (/atualizar\s*lead/.test(label)) {
                  return (
                    <AtualizarLeadEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/criar\s*registro\s*crm/.test(label)) {
                  return (
                    <CriarRegistroCrmEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/listar\s*dados\s*crm/.test(label)) {
                  return (
                    <ListarDadosCrmEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/vincular\s*recurso\s*crm/.test(label)) {
                  return (
                    <VincularRecursoCrmEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/^\s*delay\s*$/i.test(label) || selectedNode.data.actionType === "delay") {
                  return (
                    <DelayEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/adicionar\s*msg\s*ao\s*chat/i.test(label)) {
                  return (
                    <AdicionarMsgChatEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/enviar\s*email/i.test(label)) {
                  return (
                    <EnviarEmailEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/trocar\s*departamento/i.test(label)) {
                  return (
                    <TrocarDepartamentoEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/direcionar\s*para\s*fila/i.test(label)) {
                  return (
                    <DirecionarFilaEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/trocar\s*estrat[ée]gia/i.test(label)) {
                  return (
                    <TrocarEstrategiaEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/supervisor/i.test(label)) {
                  return (
                    <SupervisorEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/fim\s*do?\s*fluxo/i.test(label)) {
                  return (
                    <FimFluxoEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/finalizar\s*atendimento/i.test(label)) {
                  return (
                    <FinalizarAtendimentoEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/expert\s*ia/i.test(label)) {
                  return (
                    <ExpertIAEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                if (/leader\s*ia/i.test(label)) {
                  return (
                    <LeaderIAEditor
                      data={selectedNode.data}
                      onChange={(patch) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, ...patch },
                        })
                      }
                    />
                  );
                }
                const isTypingBlock =
                  selectedNode.data.actionType === "typing" ||
                  /digitando/i.test(String(selectedNode.data.label || ""));
                if (isTypingBlock && selectedNode.data.actionType !== "typing") {
                  // auto-corrige blocos antigos
                  setTimeout(() => {
                    setSelectedNode((prev: any) =>
                      prev && prev.id === selectedNode.id
                        ? { ...prev, data: { ...prev.data, actionType: "typing" } }
                        : prev,
                    );
                  }, 0);
                }
                return (
              <>
                {!isTypingBlock && (
                <div>
                  <Label>Tipo de Ação</Label>
                  <Select
                    value={selectedNode.data.actionType || "tag"}
                    onValueChange={(value) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, actionType: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tag">Adicionar Tag</SelectItem>
                      <SelectItem value="variable">Salvar Variável</SelectItem>
                      <SelectItem value="webhook">Chamar Webhook</SelectItem>
                      <SelectItem value="delay">Adicionar Delay (Segundos)</SelectItem>
                      <SelectItem value="schedule">Agendar Horário (Fixo)</SelectItem>
                      <SelectItem value="typing">Mostrar "Digitando…"</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                )}

                {isTypingBlock && (
                  <div>
                    <Label>Duração (segundos)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="25"
                      value={selectedNode.data.typingDuration ?? 5}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, actionType: "typing", typingDuration: e.target.value },
                        })
                      }
                      placeholder="Ex: 5"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Exibe o status "digitando…" no WhatsApp do contato pelo tempo definido, simulando que você está digitando antes de enviar a próxima mensagem.
                    </p>
                  </div>
                )}

                 {selectedNode.data.actionType === "delay" && (
                   <div>
                     <Label>Tempo do Delay (segundos)</Label>
                     <Input
                       type="number"
                       min="1"
                       value={selectedNode.data.delaySeconds ?? selectedNode.data.actionConfig ?? ""}
                       onChange={(e) =>
                         setSelectedNode({
                           ...selectedNode,
                           data: { 
                             ...selectedNode.data, 
                             delaySeconds: e.target.value,
                             actionConfig: e.target.value 
                           },
                         })
                       }
                       placeholder="Ex: 5"
                     />
                     <p className="text-[11px] text-muted-foreground mt-1">
                       O fluxo aguardará este tempo antes de prosseguir para o próximo bloco.
                     </p>
                   </div>
                 )}
 
                 {selectedNode.data.actionType === "schedule" && (
                   <div>
                     <Label>Data e Hora do Agendamento</Label>
                     <Input
                       type="datetime-local"
                       value={selectedNode.data.scheduledAt || selectedNode.data.actionConfig || ""}
                       onChange={(e) =>
                         setSelectedNode({
                           ...selectedNode,
                           data: { 
                             ...selectedNode.data, 
                             scheduledAt: e.target.value,
                             actionConfig: e.target.value 
                           },
                         })
                       }
                     />
                     <p className="text-[11px] text-muted-foreground mt-1">
                       O fluxo aguardará até esta data/hora antes de prosseguir.
                     </p>
                   </div>
                 )}
 
                  {selectedNode.data.actionType === "tag" && (
                    (() => {
                      const raw = selectedNode.data.tags;
                      const tags: string[] = Array.isArray(raw)
                        ? raw
                        : typeof selectedNode.data.actionConfig === "string" && selectedNode.data.actionConfig.trim()
                        ? selectedNode.data.actionConfig.split(",").map((s: string) => s.trim()).filter(Boolean)
                        : [];
                      return (
                        <AdicionarTagsEditor
                          value={tags}
                          availableTags={availableTags}
                          loading={loadingTags}
                          onRefresh={fetchTagsForEditor}
                          onChange={(next) =>
                            setSelectedNode({
                              ...selectedNode,
                              data: {
                                ...selectedNode.data,
                                tags: next,
                                actionConfig: next.join(","),
                              },
                            })
                          }
                        />
                      );
                    })()
                  )}

                  {["variable", "webhook"].includes(selectedNode.data.actionType || "") && (
                    <div>
                      <Label>Configuração da Ação</Label>
                      <Input
                        value={selectedNode.data.actionConfig || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, actionConfig: e.target.value },
                          })
                        }
                        placeholder={selectedNode.data.actionType === "variable" ? "Nome da variável..." : "URL do Webhook..."}
                      />
                      {selectedNode.data.actionType === "variable" && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Nome da variável para salvar a resposta (ex: nome, email).
                        </p>
                      )}
                      {selectedNode.data.actionType === "webhook" && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          URL do Webhook para onde os dados serão enviados.
                        </p>
                      )}
                    </div>
                  )}
              </>
              );
              })()
            )}

            {selectedNode?.type === "blocoAgendamento" && (
              <>
                <div>
                  <Label>Tipo de Agendamento</Label>
                  <Select
                    value={selectedNode.data.scheduleType || "once"}
                    onValueChange={(value) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, scheduleType: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Data e hora única</SelectItem>
                      <SelectItem value="recurring">Recorrente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedNode.data.scheduleType === "recurring" ? (
                  <div>
                    <Label>Padrão de Recorrência</Label>
                    <Select
                      value={selectedNode.data.recurrencePattern || "daily"}
                      onValueChange={(value) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, recurrencePattern: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diariamente</SelectItem>
                        <SelectItem value="weekly">Semanalmente</SelectItem>
                        <SelectItem value="monthly">Mensalmente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div>
                  <Label>{selectedNode.data.scheduleType === "recurring" ? "Início em" : "Data e Hora"}</Label>
                  <Input
                    type="datetime-local"
                    value={selectedNode.data.scheduledAt || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, scheduledAt: e.target.value },
                      })
                    }
                  />
                </div>

                {selectedNode.data.scheduleType === "recurring" && (
                  <div>
                    <Label>Horário de envio</Label>
                    <Input
                      type="time"
                      value={selectedNode.data.scheduleTime || ""}
                      onChange={(e) =>
                        setSelectedNode({
                          ...selectedNode,
                          data: { ...selectedNode.data, scheduleTime: e.target.value },
                        })
                      }
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Horário em que o envio será disparado em cada recorrência
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground p-2 bg-accent/50 rounded">
                  💡 O bloco seguinte será executado na data/hora agendada. Conecte ao bloco de conteúdo que deseja enviar.
                </p>
              </>
            )}

            {selectedNode?.type === "agentTool" && (
              <>
                <AgentToolConfigPanel node={selectedNode} setNode={setSelectedNode} />
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="text-sm font-medium">Ferramenta ativa</div>
                    <div className="text-[11px] text-muted-foreground">
                      Quando desativada o agente não poderá usá-la.
                    </div>
                  </div>
                  <Switch
                    checked={selectedNode.data?.enabled !== false}
                    onCheckedChange={(checked) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, enabled: checked },
                      })
                    }
                  />
                </div>
              </>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => selectedNode && handleDeleteNode(selectedNode.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir Bloco
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveNode}>Salvar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <FlowCapturedDataDialog
        open={showCapturedData}
        onOpenChange={setShowCapturedData}
        flowId={currentFluxoId}
        flowName={nomeFluxo}
      />
      <AddBlockDialog
        open={showAddBlockDialog}
        onOpenChange={(open) => {
          setShowAddBlockDialog(open);
          if (!open) setPendingAgentConnection(null);
        }}
        baseBlocks={blocosDisponiveis}
        showAgentTools={!!pendingAgentConnection}
        onSelect={(sel) => {
          const position = pendingAgentConnection
            ? pendingAgentConnection.position
            : reactFlowInstance
            ? reactFlowInstance.screenToFlowPosition({
                x: (reactFlowWrapper.current?.clientWidth ?? 600) / 2,
                y: (reactFlowWrapper.current?.clientHeight ?? 400) / 2,
              })
            : { x: 250, y: 200 };
          const newId = `${Date.now()}`;
          const newNode: Node = {
            id: newId,
            type: sel.type,
            position,
            data: {
              label: sel.label,
              content: "",
              ...(sel.description ? { description: sel.description } : {}),
              ...(sel.extraData || {}),
            },
          };
          setNodes((nds) => nds.concat(newNode));
          if (pendingAgentConnection) {
            setEdges((eds) =>
              addEdge(
                {
                  source: pendingAgentConnection.sourceId,
                  sourceHandle: pendingAgentConnection.sourceHandle ?? undefined,
                  target: newId,
                  animated: true,
                  style: { stroke: "#2563EB", strokeWidth: 3, zIndex: 1000 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: "#2563EB", width: 20, height: 20 },
                } as any,
                eds
              )
            );
            setPendingAgentConnection(null);
          }
          toast.success("Bloco adicionado ao fluxo!");
        }}
      />
    </>
  );
}
