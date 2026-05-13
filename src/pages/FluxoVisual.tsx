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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import FlowCapturedDataDialog from "@/components/flow/FlowCapturedDataDialog";
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
} from "lucide-react";
import { toast } from "sonner";
import { BlocoInicialNode } from "@/components/flow/BlocoInicialNode";
import { BlocoConteudoNode } from "@/components/flow/BlocoConteudoNode";
import { BlocoCondicaoNode } from "@/components/flow/BlocoCondicaoNode";
import { BlocoAcaoNode } from "@/components/flow/BlocoAcaoNode";
import { BlocoGatilhoNode } from "@/components/flow/BlocoGatilhoNode";
import { BlocoAgendamentoNode } from "@/components/flow/BlocoAgendamentoNode";
import { SelectContactsDialog } from "@/components/flow/SelectContactsDialog";
import type { FlowSendProvider } from "@/components/flow/SelectContactsDialog";
import { FlowTemplatesDialog } from "@/components/flow/FlowTemplatesDialog";
import type { FlowTemplate } from "@/components/flow/flowTemplates";
import { useZapi } from "@/hooks/useZapi";
import { useZapiInstances } from "@/hooks/useZapiInstances";
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

const blocosDisponiveis = [
  {
    type: "blocoConteudo",
    label: "Conteúdo",
    icon: MessageSquare,
    description: "Enviar mensagem de texto, mídia ou arquivo",
  },
  {
    type: "blocoCondicao",
    label: "Condição",
    icon: GitBranch,
    description: "Criar ramificações no fluxo",
  },
  {
    type: "blocoAcao",
    label: "Ação",
    icon: Zap,
    description: "Executar uma ação específica",
  },
  {
    type: "blocoGatilho",
    label: "Gatilho",
    icon: Key,
    description: "Palavra-chave que dispara o fluxo",
  },
  {
    type: "blocoAgendamento",
    label: "Agendamento",
    icon: CalendarClock,
    description: "Agendar envio para data/hora específica",
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
  mode?: "contacts" | "groups" | "meta";
}

export default function FluxoVisual({ mode = "contacts" }: FluxoVisualProps = {}) {
  const isGroupsMode = mode === "groups";
  const isMetaMode = mode === "meta";
  const pageTitle = isGroupsMode ? "Fluxo Grupos" : isMetaMode ? "Fluxo Oficial" : "Fluxos Visuais";
  const pageSubtitle = isGroupsMode
    ? "Crie automações visuais para grupos do WhatsApp"
    : "Crie automações visuais disparadas por palavra-chave";
  const emptyHelp = isGroupsMode
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
  const [showFluxosList, setShowFluxosList] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingFluxo, setSavingFluxo] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [showContactsDialog, setShowContactsDialog] = useState(false);
  const { sendMessage, sendImage, sendVideo, sendAudio, sendDocument, sendButtonActions } = useZapi();
  const { instances: allInstances } = useZapiInstances({ provider: isMetaMode ? 'meta' : undefined });
   const instances = useMemo(() => {
     return allInstances.filter((i) => {
       const provider = (i.api_provider || "zapi").toLowerCase();
       // Se estiver no modo Meta, mostrar apenas instâncias Meta.
       // Se estiver no modo Zaplynx (contacts/groups), mostrar apenas instâncias Z-API Web.
       if (isMetaMode) {
         return provider === "meta";
       }
        return provider === "zapi";
     });
   }, [allInstances, isMetaMode]);
  const { templates: messageTemplates } = useMessageTemplates();
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCapturedData, setShowCapturedData] = useState(false);
  const [buttonStats, setButtonStats] = useState<Record<string, number>>({});
   const [totalFlowRecipients, setTotalFlowRecipients] = useState(0);
   const [availableTags, setAvailableTags] = useState<string[]>([]);
   const [loadingTags, setLoadingTags] = useState(false);

  // Para modo grupos: grupos pré-selecionados antes de criar/abrir o fluxo
  const [preselectedGroups, setPreselectedGroups] = useState<string[]>([]);
  const [preselectedInstanceIds, setPreselectedInstanceIds] = useState<string[]>([]);
  const [preselectedProvider, setPreselectedProvider] = useState<FlowSendProvider>("zapi");
  const [preselectedMetaPhoneId, setPreselectedMetaPhoneId] = useState<string | undefined>(undefined);
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
      const { data, error } = await (supabase as any)
        .from('flow_automations')
        .select('*')
        .eq('category', isGroupsMode ? 'groups' : 'contacts')
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
     const uazapiInstances = instances.filter((instance) => (instance.api_provider || "zapi").toLowerCase() === "uazapi");
     if (uazapiInstances.length === 0) return;

    try {
      const flagKey = "uazapi_webhook_synced_flow_v1";
      if (sessionStorage.getItem(flagKey)) return;
      sessionStorage.setItem(flagKey, "1");
      supabase.functions.invoke("uazapi-set-webhook", { body: {} }).catch(() => {
        /* silent */
      });
    } catch {
      /* ignore */
    }
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
      setPreselectedMetaPhoneId(undefined);
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
          category: isGroupsMode ? 'groups' : 'contacts',
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
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    }, eds)),
    [setEdges]
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
    setSelectedNode(node);
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

      const newNode: Node = {
        id: `${Date.now()}`,
        type,
        position,
        data: {
          label: `${type === "blocoConteudo" ? "Conteúdo" : type === "blocoCondicao" ? "Condição" : type === "blocoGatilho" ? "Gatilho" : type === "blocoAgendamento" ? "Agendamento" : "Ação"}`,
          content: "",
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
        data: { ...selectedNode.data, mediaUrl: publicUrl },
      });

      toast.success("Arquivo enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setUploadingFile(false);
    }
  };

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
        category: isGroupsMode ? 'groups' : 'contacts',
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
        preselectedProvider,
        preselectedMetaPhoneId,
      );
      return;
    }
    setIsSelectingPreGroups(false);
    setShowContactsDialog(true);
  };

  const handleConfirmSend = async (selectedContacts: string[], instanceIds?: string[], provider?: FlowSendProvider, metaPhoneNumberId?: string) => {
    // Se for apenas pré-seleção de grupos antes do editor, não envia: salva e abre editor
    if (isSelectingPreGroups) {
      setPreselectedGroups(selectedContacts);
      setPreselectedInstanceIds(instanceIds || []);
      setPreselectedProvider(provider || "zapi");
      setPreselectedMetaPhoneId(metaPhoneNumberId);
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

       for (let index = 0; index < selectedContacts.length; index++) {
         if (cancelSendRef.current) break;

         const contact = selectedContacts[index];
         const visitedNodes = new Set<string>();
         const currentInstanceId = instanceIds && instanceIds.length > 0
           ? instanceIds[index % instanceIds.length]
           : undefined;

         try {
           await processFlow(initialNode.id, contact, visitedNodes, currentInstanceId, currentUserId, provider || "zapi", metaPhoneNumberId, savedFlowId);
           sendCounter++;
         } catch (err) {
           console.error(`[FluxoVisual] Error sending to ${contact}:`, err);
         }

         // Small delay between contacts to avoid rate limits
         if (index < selectedContacts.length - 1) {
           await new Promise(resolve => setTimeout(resolve, 500));
         }
       }

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

  const processFlow = async (currentNodeId: string, contact: string, visitedNodes: Set<string>, instanceId?: string, userId?: string, provider: FlowSendProvider = "zapi", metaPhoneNumberId?: string, flowIdForPending?: string) => {
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

    if (outgoingEdges.length === 0) return;

    for (const edge of outgoingEdges) {
      const targetNode = runtimeNodes.find(n => n.id === edge.target);
      if (!targetNode) continue;

      if (targetNode.type === "blocoConteudo" || targetNode.type === "blocoInicial") {
        const delayMs = (targetNode.data.delaySeconds || 0) * 1000;
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        const contentType = targetNode.data.contentType || "text";
        const content = targetNode.data.content || "";
        const mediaUrl = targetNode.data.mediaUrl || "";

        const buttons = Array.isArray(targetNode.data.buttons) ? targetNode.data.buttons : [];

        // "flow" buttons are sent as REPLY so the user can click them
        const sendableButtons = buttons.filter((btn: any) => btn?.type && btn.type !== "flow");
        const flowButtons = buttons.filter((btn: any) => btn?.type === "flow");
        const allSendButtons = [
          ...sendableButtons,
          ...flowButtons.map((b: any) => ({ ...b, type: "reply" })),
        ];

         const sendWithInstance = async (payload: Record<string, any>, nodeData?: any) => {
           const finalPayload = { ...payload };
           
           // Adiciona opção de marcar todos se estiver em modo grupo
           if (isGroupsMode && nodeData?.mentionAll) {
             finalPayload.mentionAll = true;
           }
 
          if (provider === "meta") {
            const overrideHeader = metaPhoneNumberId ? { override_phone_number_id: metaPhoneNumberId } : {};
            const invokeMeta = async (body: Record<string, any>) => {
              const { data, error } = await supabase.functions.invoke('send-meta-message', {
                body,
              });
              if (error) throw error;
              if (data?.error) throw new Error(data.error);
              return data;
            };

            // Interactive buttons via Meta API
            if (payload.buttonActions && payload.buttonActions.length > 0) {
              const replyButtons = payload.buttonActions
                .filter((b: any) => b.type === "REPLY")
                .slice(0, 3)
                .map((b: any) => ({ id: b.id, title: b.label.slice(0, 20) }));

              if (replyButtons.length > 0) {
               await invokeMeta({
                 action: "send_interactive",
                 phone: finalPayload.phone,
                 message: finalPayload.message || "Escolha uma opção:",
                 buttons: replyButtons,
                 ...overrideHeader,
               });
                return;
              }
            }

            // Media via Meta API
            if (payload.mediaUrl && payload.mediaType) {
               await invokeMeta({
                 action: "send_media",
                 phone: finalPayload.phone,
                 media_url: finalPayload.mediaUrl,
                 media_type: finalPayload.mediaType,
                 ...(finalPayload.mediaType === 'audio' ? { voice: true } : {}),
                 caption: finalPayload.message || undefined,
                 ...overrideHeader,
               });
              return;
            }

            // Text via Meta API
             await invokeMeta({
               action: "send_text",
               phone: finalPayload.phone,
               message: finalPayload.message || "",
               ...overrideHeader,
             });
          } else {
             const body = instanceId
               ? { ...finalPayload, instanceId, preferStandardConnection: true }
               : { ...finalPayload, preferStandardConnection: true };
            try {
              const { data, error } = await supabase.functions.invoke('send-message', { body });
              console.log("[FluxoVisual] send-message result", { body, data, error });
              const failureMessage = await getSendFailureMessage(data, error, "Erro ao enviar fluxo");
              if (failureMessage) {
                console.error("[FluxoVisual] Falha real no envio", { body, data, error, failureMessage });
                throw new Error(failureMessage);
              }
            } catch (invokeErr) {
              console.error("[FluxoVisual] Edge function invocation error", invokeErr);
              throw invokeErr;
            }
          }
        };

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

        // === CAPTURE BLOCK: send only the prompt and pause until user replies ===
        const collectName = !!targetNode.data.collectName;
        const collectWhatsapp = !!targetNode.data.collectWhatsapp;
        const collectEmail = !!targetNode.data.collectEmail;

        if (collectName || collectWhatsapp || collectEmail) {
          const captureField: "name" | "whatsapp" | "email" = collectName
            ? "name"
            : collectWhatsapp
            ? "whatsapp"
            : "email";

          const promptMap: Record<typeof captureField, string> = {
            name: targetNode.data.content || targetNode.data.namePrompt || "Qual o seu nome?",
            whatsapp: targetNode.data.content || targetNode.data.whatsappPrompt || "Qual seu WhatsApp?",
            email: targetNode.data.content || targetNode.data.emailPrompt || "Qual seu melhor email?",
          };

           await sendWithInstance({ phone: contact, message: promptMap[captureField] }, targetNode.data);

          // Persist pending capture state so webhook-zapi can resume the flow when the user replies
          const pendingFlowId = flowIdForPending || currentFluxoId;
          if (userId && pendingFlowId) {
            await (supabase as any).from("message_logs").insert({
              phone: contact,
              message_received: null,
              response_sent: JSON.stringify({
                flowId: pendingFlowId,
                flowName: nomeFluxo || null,
                nodeId: targetNode.id,
                field: captureField,
                instanceId: instanceId || null,
                captured: {},
              }),
              keyword_matched: `__flow_capture__:${userId}`,
              timestamp: new Date().toISOString(),
              user_id: userId,
              instance_id: instanceId || null,
            });
          }

          // Stop processing — wait for user reply (webhook-zapi handles resume)
          return;
        }

        if (allSendButtons.length > 0) {
          const mappedButtons = allSendButtons.map((btn: any, idx: number) => {
            const type = (btn?.type || "reply").toString().toLowerCase();
            const value = (btn?.value || "").toString().trim();
            const label = (btn?.text || `Botão ${idx + 1}`).toString();

            if (type === "url") {
              const url = wrapUrlWithTracking(value, label, contact);
              return { id: String(idx + 1), type: "URL" as const, label, url };
            }

            if (type === "call") {
              return { id: String(idx + 1), type: "CALL" as const, label, phone: value };
            }

            return { id: String(idx + 1), type: "REPLY" as const, label };
          });
           if (contentType === "image" && mediaUrl) {
             await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'image', message: '' }, targetNode.data);
             await new Promise(resolve => setTimeout(resolve, 1000));
           } else if (contentType === "video" && mediaUrl) {
             await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'video', message: '', ...(targetNode.data.viewOnce ? { viewOnce: true } : {}), ...(targetNode.data.isPtv ? { isPtv: true } : {}) }, targetNode.data);
             await new Promise(resolve => setTimeout(resolve, 1000));
           } else if (contentType === "audio" && mediaUrl) {
             await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'audio', message: '' }, targetNode.data);
             await new Promise(resolve => setTimeout(resolve, 1000));
           } else if (contentType === "document" && mediaUrl) {
             await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'document', message: 'document' }, targetNode.data);
             await new Promise(resolve => setTimeout(resolve, 1000));
           } else if (contentType === "contact") {
             await sendWithInstance({
               phone: contact,
               specialType: 'contato',
               specialPayload: {
                 contactName: targetNode.data.contactName || '',
                 contactPhone: targetNode.data.contactPhone || '',
                 contactOrg: targetNode.data.contactOrg || '',
               },
             }, targetNode.data);
             await new Promise(resolve => setTimeout(resolve, 1000));
            } else if (contentType === "location" || contentType === "request-location") {
              await sendWithInstance({
                phone: contact,
                specialType: 'localizacao',
                specialPayload: {
                  latitude: targetNode.data.locationLat || 0,
                  longitude: targetNode.data.locationLng || 0,
                  title: targetNode.data.locationName || '',
                  address: targetNode.data.locationAddress || '',
                },
              }, targetNode.data);
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else if (contentType === "media-carousel") {
              let cards = [];
              try {
                cards = JSON.parse(targetNode.data.carouselCardsJson || '[]');
              } catch (e) {
                console.error("Erro ao parsear cards do carrossel:", e);
              }
              if (cards.length > 0) {
                await sendWithInstance({
                  phone: contact,
                  message: content || '',
                  carouselCards: cards
                }, targetNode.data);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }

          const hasUrlButtons = mappedButtons.some(b => b.type === "URL");
          const hasCallButtons = mappedButtons.some(b => b.type === "CALL");
          
          if (hasUrlButtons || hasCallButtons) {
            // Use send-button-actions for templates with URL or CALL buttons
             await sendWithInstance({
               phone: contact,
               message: content || "Escolha uma opção:",
               buttonActions: mappedButtons.slice(0, 3),
             }, targetNode.data);
          } else {
            // Use standard button-list for REPLY only buttons (better compatibility)
             await sendWithInstance({
               phone: contact,
               message: content || "Escolha uma opção:",
               buttonList: {
                 buttons: mappedButtons.slice(0, 3).map(b => ({ id: b.id, label: b.label }))
               },
             }, targetNode.data);
          }

          const hasButtonEdgesForPending = buttons.some((btn: any, idx: number) => {
            if (btn?.type !== "flow" && btn?.type !== "reply") return false;
            const aliases = [
              `button-${idx}`,
              `button_${idx}`,
              `btn-${idx}`,
              `btn_${idx}`,
              `button-${idx + 1}`,
              `button_${idx + 1}`,
              `btn-${idx + 1}`,
              `btn_${idx + 1}`,
              btn?.id ? String(btn.id) : "",
            ].filter(Boolean);
            return runtimeEdges.some((e) => e.source === targetNode.id && aliases.includes(String(e.sourceHandle || "")));
          });

          const pendingFlowId = flowIdForPending || currentFluxoId;
          if (hasButtonEdgesForPending && userId && pendingFlowId) {
            await (supabase as any).from("message_logs").insert({
              phone: contact,
              message_received: null,
              response_sent: JSON.stringify({
                flowId: pendingFlowId,
                flowName: nomeFluxo || null,
                nodeId: targetNode.id,
                instanceId: instanceId || null,
                buttons: buttons
                  .map((btn: any, idx: number) => ({
                    text: String(btn?.text || `Botão ${idx + 1}`).trim(),
                    handleAliases: [
                      `button-${idx}`,
                      `button_${idx}`,
                      `btn-${idx}`,
                      `btn_${idx}`,
                      `button-${idx + 1}`,
                      `button_${idx + 1}`,
                      `btn-${idx + 1}`,
                      `btn_${idx + 1}`,
                      btn?.id ? String(btn.id) : "",
                    ].filter(Boolean),
                    index: idx,
                    menuIndex: idx + 1,
                  })),
                captured: {},
              }),
              keyword_matched: `__flow_button__:${userId}`,
              timestamp: new Date().toISOString(),
              user_id: userId,
              instance_id: instanceId || null,
            });
          }
        } else {
           switch (contentType) {
              case "text": {
                if (!content) continue;
                await sendWithInstance({ phone: contact, message: content }, targetNode.data);
                break;
              }
              case "product": {
                if (!targetNode.data.productId) continue;
                await sendWithInstance({
                  phone: contact,
                  message: content || '',
                  mediaType: 'product',
                  specialPayload: { productId: targetNode.data.productId }
                }, targetNode.data);
                break;
              }
             case "image":
               if (!mediaUrl) continue;
               await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'image', message: content || '' }, targetNode.data);
               break;
             case "video":
               if (!mediaUrl) continue;
               await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'video', message: content || '', ...(targetNode.data.viewOnce ? { viewOnce: true } : {}), ...(targetNode.data.isPtv ? { isPtv: true } : {}) }, targetNode.data);
               break;
             case "audio":
               if (!mediaUrl) continue;
               await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'audio', message: content || '' }, targetNode.data);
               break;
             case "document":
               if (!mediaUrl) continue;
               await sendWithInstance({ phone: contact, mediaUrl, mediaType: 'document', message: content || 'document' }, targetNode.data);
               break;
             case "pix": {
               const body: Record<string, any> = {
                 phone: contact,
                 specialType: 'pix',
                 specialPayload: {
                   pixKey: targetNode.data.pixKey || '',
                   pixKeyType: targetNode.data.pixKeyType || 'cpf',
                   merchantName: targetNode.data.pixReceiver || '',
                   amount: targetNode.data.pixAmount || '',
                   description: targetNode.data.pixDescription || content || '',
                 },
               };
               await sendWithInstance(body, targetNode.data);
               break;
             }
              case "request-payment":
              case "gateway-billing": {
                const body: Record<string, any> = {
                  phone: contact,
                  specialType: targetNode.data.contentType === 'gateway-billing' ? 'gateway-billing' : 'pix',
                  specialPayload: {
                    pixKey: targetNode.data.paymentReceiver || '',
                    pixKeyType: 'random',
                    merchantName: targetNode.data.paymentReceiver || '',
                    amount: targetNode.data.paymentAmount || '',
                    description: targetNode.data.paymentDescription || content || '',
                    paymentSource: targetNode.data.paymentSource || (targetNode.data.contentType === 'gateway-billing' ? 'gateway' : 'manual'),
                  },
                };
                await sendWithInstance(body, targetNode.data);
                break;
              }
              case "order-status": {
                const body: Record<string, any> = {
                  phone: contact,
                  specialType: 'order-status',
                  specialPayload: {
                    orderStatus: targetNode.data.orderStatus || 'PROCESSING',
                    referenceId: targetNode.data.orderReferenceId || '',
                    order: targetNode.data.orderJson ? JSON.parse(targetNode.data.orderJson) : {},
                  },
                };
                await sendWithInstance(body, targetNode.data);
                break;
              }
              case "order-payment": {
                const body: Record<string, any> = {
                  phone: contact,
                  specialType: 'order-payment',
                  specialPayload: {
                    paymentStatus: targetNode.data.orderPaymentStatus || 'PAID',
                    referenceId: targetNode.data.orderReferenceId || '',
                    order: targetNode.data.orderJson ? JSON.parse(targetNode.data.orderJson) : {},
                  },
                };
                await sendWithInstance(body, targetNode.data);
                break;
              }
             case "location":
             case "request-location": {
               const body: Record<string, any> = {
                 phone: contact,
                 specialType: 'localizacao',
                 specialPayload: {
                   latitude: targetNode.data.locationLat || 0,
                   longitude: targetNode.data.locationLng || 0,
                   title: targetNode.data.locationName || '',
                   address: targetNode.data.locationAddress || '',
                 },
               };
               await sendWithInstance(body, targetNode.data);
               break;
             }
              case "contact": {
                const body: Record<string, any> = {
                  phone: contact,
                  specialType: 'contato',
                  specialPayload: {
                    contactName: targetNode.data.contactName || '',
                    contactPhone: targetNode.data.contactPhone || '',
                    contactOrg: targetNode.data.contactOrg || '',
                  },
                };
                await sendWithInstance(body, targetNode.data);
                break;
              }
              case "media-carousel": {
                let cards = [];
                try {
                  cards = JSON.parse(targetNode.data.carouselCardsJson || "[]");
                } catch (e) {
                  console.error("Erro ao parsear carrossel:", e);
                }
                if (cards.length > 0) {
                  await sendWithInstance({
                    phone: contact,
                    message: content || '',
                    carouselCards: cards
                  }, targetNode.data);
                }
                break;
              }
           }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));

        const hasButtonEdges = buttons.some((_: any, idx: number) =>
          runtimeEdges.some((e) => e.source === targetNode.id && e.sourceHandle === `button-${idx}`)
        );

        if (hasButtonEdges) {
          continue;
        }
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

      await processFlow(targetNode.id, contact, visitedNodes, instanceId, userId, provider, metaPhoneNumberId, flowIdForPending);
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
        mode={isGroupsMode ? "groups" : "contacts"}
      />
      <FlowTemplatesDialog
        open={showTemplatesDialog}
        onOpenChange={setShowTemplatesDialog}
        mode={isGroupsMode ? "groups" : "contacts"}
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
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Ativo</Label>
                <Switch checked={fluxoAtivo} onCheckedChange={setFluxoAtivo} />
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
          <div className="flex items-center gap-2 px-4 py-2 border-t border-border overflow-x-auto">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">Blocos:</p>
            {blocosDisponiveis.map((bloco) => (
              <div
                key={bloco.type}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/30 cursor-grab hover:bg-accent/50 hover:border-primary/30 transition-all active:cursor-grabbing shrink-0"
                draggable
                onDragStart={(e) => onDragStart(e, bloco.type)}
              >
                <div className="p-1 rounded-md bg-primary/10">
                  <bloco.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-xs">{bloco.label}</h3>
                  <p className="text-[10px] text-muted-foreground leading-tight">{bloco.description}</p>
                </div>
                <GripVertical className="h-3 w-3 text-muted-foreground/40" />
              </div>
            ))}
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
            className="bg-background rounded-lg border"
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
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
        mode={isGroupsMode ? "groups" : "contacts"}
      />

      <FlowTemplatesDialog
        open={showTemplatesDialog}
        onOpenChange={setShowTemplatesDialog}
        mode={isGroupsMode ? "groups" : "contacts"}
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
            {selectedNode?.type === "blocoConteudo" && (
              <>
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

                {(["image", "video", "audio", "document", "status"].includes(selectedNode.data.contentType)) && (
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

            {selectedNode?.type === "blocoCondicao" && (
              <>
                <div>
                  <Label>Palavra-chave para este caminho</Label>
                  <Input
                    value={selectedNode.data.condition || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, condition: e.target.value },
                      })
                    }
                    placeholder="Ex: sim, não, 1, 2"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Se a mensagem recebida contém essa palavra, segue por este caminho
                  </p>
                </div>
              </>
            )}

            {selectedNode?.type === "blocoGatilho" && (
              <>
                <div>
                  <Label className="flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    Palavra-chave (Gatilho)
                  </Label>
                  <Input
                    value={keywordFluxo}
                    onChange={(e) => setKeywordFluxo(e.target.value)}
                    placeholder="Ex: oi, menu, preco"
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Quando alguém enviar essa palavra, o fluxo será disparado automaticamente
                  </p>
                </div>
              </>
            )}

            {selectedNode?.type === "blocoAcao" && (
              <>
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
                    </SelectContent>
                  </Select>
                </div>

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
                    <div>
                       <div className="flex items-center justify-between mb-1">
                         <Label>Escolher Etiqueta</Label>
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="h-6 w-6" 
                           onClick={fetchTagsForEditor}
                           disabled={loadingTags}
                         >
                           <RefreshCw className={`h-3 w-3 ${loadingTags ? "animate-spin" : ""}`} />
                         </Button>
                       </div>
                       <div className="flex gap-2 mb-2">
                        <Select
                          value={availableTags.includes(selectedNode.data.actionConfig || "") ? selectedNode.data.actionConfig : "manual"}
                          onValueChange={(value) => {
                            if (value !== "manual") {
                              setSelectedNode({
                                ...selectedNode,
                                data: { ...selectedNode.data, actionConfig: value },
                              });
                            } else if (availableTags.includes(selectedNode.data.actionConfig || "")) {
                              // Se selecionou manual mas o valor atual é uma tag conhecida, limpa o campo
                              setSelectedNode({
                                ...selectedNode,
                                data: { ...selectedNode.data, actionConfig: "" },
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={loadingTags ? "Carregando etiquetas..." : "Selecione uma etiqueta..."} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">-- Digitar manualmente --</SelectItem>
                            {availableTags.map((tag) => (
                              <SelectItem key={tag} value={tag}>
                                {tag}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {(!availableTags.includes(selectedNode.data.actionConfig || "") || selectedNode.data.actionConfig === "") && (
                        <div className="mt-2">
                          <Label className="text-[11px]">Ou digite o nome da etiqueta:</Label>
                          <Input
                            value={selectedNode.data.actionConfig || ""}
                            onChange={(e) =>
                              setSelectedNode({
                                ...selectedNode,
                                data: { ...selectedNode.data, actionConfig: e.target.value },
                              })
                            }
                            placeholder="Ex: Interessado"
                          />
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Esta etiqueta será adicionada ao contato no WhatsApp.
                      </p>
                    </div>
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
    </>
  );
}
