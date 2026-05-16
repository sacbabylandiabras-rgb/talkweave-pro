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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Save,
   Plus,
   Pencil,
  ArrowLeft,
  Trash2,
  MessageCircle,
  Send,
  Clock,
  Reply,
  Link2,
  X,
  Variable,
  Phone,
  Mail,
  User,
  ChevronUp,
  ChevronDown,
   TableIcon,
   MessageSquare,
   Download,
   Heart,
   Settings2,
   Share2,
   PlayCircle,
   Star,
   Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useInstagramAutomations } from "@/hooks/useInstagramAutomations";
import { IGGatilhoNode } from "@/components/flow/ig/IGGatilhoNode";
import { IGRespostaNode } from "@/components/flow/ig/IGRespostaNode";
import { IGDMNode } from "@/components/flow/ig/IGDMNode";
import { IGDelayNode } from "@/components/flow/ig/IGDelayNode";
import { IGWhatsAppNode } from "@/components/flow/ig/IGWhatsAppNode";
import { supabase } from "@/integrations/supabase/client";

const nodeTypes: NodeTypes = {
  igGatilho: IGGatilhoNode,
  igResposta: IGRespostaNode,
  igDM: IGDMNode,
  igDelay: IGDelayNode,
  igWhatsApp: IGWhatsAppNode,
};

const defaultNodes: Node[] = [
  {
    id: "1",
    type: "igGatilho",
    position: { x: 50, y: 200 },
     data: { label: "Gatilho", keywords: "", triggerType: "comment" },
  },
  {
    id: "2",
    type: "igResposta",
    position: { x: 350, y: 100 },
    data: { label: "Responder Comentário", message: "" },
  },
  {
    id: "3",
    type: "igDM",
    position: { x: 350, y: 300 },
    data: { label: "Enviar DM", message: "", buttons: [] },
  },
];

const defaultEdges: Edge[] = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    sourceHandle: "source-right",
    targetHandle: "target-left",
    animated: true,
    style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
  },
  {
    id: "e1-3",
    source: "1",
    target: "3",
    sourceHandle: "source-bottom",
    targetHandle: "target-top",
    animated: true,
    style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
  },
];

const blocosDisponiveis = [
   { type: "igGatilho", label: "Gatilho", icon: Zap, description: "O que inicia seu fluxo" },
   { type: "igResposta", label: "Resposta", icon: MessageCircle, description: "Responder comentário no IG" },
   { type: "igDM", label: "Enviar DM", icon: Send, description: "Mensagem direta no Instagram" },
   { type: "igDelay", label: "Espera", icon: Clock, description: "Aguardar um tempo" },
   { type: "igWhatsApp", label: "WhatsApp", icon: MessageSquare, description: "Enviar para o WhatsApp" },
];

export default function AutomacaoComentarios() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const { automations, createAutomation, updateAutomation } = useInstagramAutomations();

  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
   const [flowName, setFlowName] = useState("Novo Fluxo Instagram");
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [buttonStats, setButtonStats] = useState<Record<string, number>>({});
  const [totalFlowRecipients, setTotalFlowRecipients] = useState(0);
  const [collectedLeads, setCollectedLeads] = useState<any[]>([]);
  const [showLeads, setShowLeads] = useState(false);
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [waFlows, setWaFlows] = useState<any[]>([]);
  const [waInstances, setWaInstances] = useState<any[]>([]);

  // Fetch WhatsApp resources for the igWhatsApp node
  useEffect(() => {
    const fetchWaResources = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: tpl }, { data: flows }, { data: inst }] = await Promise.all([
        supabase.from("message_templates").select("id, name, category, type, content").eq("user_id", user.id).eq("active", true).order("name"),
        supabase.from("flow_automations").select("id, name, keyword").eq("user_id", user.id).eq("active", true).order("name"),
        (supabase as any).from("zapi_instances").select("id, instance_name, api_provider, is_default").eq("user_id", user.id).eq("is_active", true).order("instance_name"),
      ]);
      setWaTemplates(tpl || []);
      setWaFlows(flows || []);
      setWaInstances(inst || []);
    };
    fetchWaResources();
  }, []);

  // Fetch collected leads for this automation
  const fetchCollectedLeads = useCallback(async (automationId?: string) => {
    try {
      const [{ data: eventsData }, { data: contactsData }] = await Promise.all([
        supabase
          .from("instagram_events")
          .select("*")
          .in("event_type", ["lead_whatsapp", "lead_email"])
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("instagram_contacts")
          .select("ig_user_id, username")
      ]);

      // Build a map of ig_user_id -> username from contacts
      const contactMap = new Map<string, string>();
      (contactsData || []).forEach((c: any) => {
        if (c.ig_user_id && c.username) contactMap.set(c.ig_user_id, c.username);
      });

      // Enrich leads with username from contacts when missing
      const enriched = (eventsData || []).map((lead: any) => {
        if (!lead.username && lead.ig_user_id && contactMap.has(lead.ig_user_id)) {
          return { ...lead, username: contactMap.get(lead.ig_user_id) };
        }
        return lead;
      });

      const allLeads = automationId
        ? enriched.filter((l: any) => (l.payload as any)?.automation_id === automationId)
        : enriched;

      setCollectedLeads(allLeads);
    } catch (e) {
      console.error("Error fetching leads:", e);
    }
  }, []);

  // Fetch leads on mount (for new flows, show all; for existing, filtered)
  useEffect(() => {
    fetchCollectedLeads(editId || undefined);
  }, [editId, fetchCollectedLeads]);

  // Fetch button click stats for the current flow
  const fetchButtonStats = useCallback(async (automationName: string) => {
    try {
      const { data: buttonClicks } = await supabase
        .from('message_logs')
        .select('keyword_matched, message_received')
        .like('keyword_matched', '[Botão:%')
        .eq('response_sent', `[IG-Fluxo: ${automationName}]`);

      if (!buttonClicks) return;

      const stats: Record<string, number> = {};
      buttonClicks.forEach((log: any) => {
        const match = log.keyword_matched?.match(/\[Botão:\s*(.+?)\]/i);
        if (match) {
          const btnText = match[1].trim();
          stats[btnText] = (stats[btnText] || 0) + 1;
        }
      });
      setButtonStats(stats);

      const { data: flowSends } = await supabase
        .from('message_logs')
        .select('phone')
        .eq('keyword_matched', `__ig_flow_send__:${automationName}`);

      if (flowSends) {
        const uniquePhones = new Set(flowSends.map((s: any) => s.phone));
        setTotalFlowRecipients(uniquePhones.size);
      }
    } catch (e) {
      console.error('Error fetching IG button stats:', e);
    }
  }, []);

  // Load existing automation
   useEffect(() => {
     const params = new URLSearchParams(window.location.search);
     const templateId = params.get("template");
 
     if (templateId && nodes.length === defaultNodes.length) {
       const template = {
         "venda-comentarios-reels": {
           name: "Venda pelos comentários de Reels",
           nodes: [
             { id: "1", type: "igGatilho", position: { x: 50, y: 200 }, data: { label: "Comentário no Reel", triggerType: "comment", postScope: "any", matchType: "any" } },
             { id: "2", type: "igResposta", position: { x: 350, y: 100 }, data: { label: "Resposta", message: "Te enviei os detalhes no Direct! 😉" } },
             { id: "3", type: "igDM", position: { x: 350, y: 300 }, data: { label: "Enviar Oferta", message: "Olá! Vi seu comentário no nosso Reel. Aqui está o link da oferta: {{link}}", buttons: [{ title: "Ver Oferta", url: "https://", type: "url" }] } },
           ],
           edges: [
             { id: "e1-2", source: "1", target: "2", sourceHandle: "source-right", targetHandle: "target-left", animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" } },
             { id: "e1-3", source: "1", target: "3", sourceHandle: "source-bottom", targetHandle: "target-top", animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" } },
           ]
         },
          "cupons-stories": {
            name: "Cupom via Story",
            nodes: [
              { id: "1", type: "igGatilho", position: { x: 50, y: 200 }, data: { label: "Resposta Story", triggerType: "story_reply", storyScope: "all", matchType: "any" } },
              { id: "2", type: "igDM", position: { x: 350, y: 200 }, data: { label: "Enviar Cupom", message: "Obrigado por acompanhar nossos Stories! Aqui está seu cupom de 10% OFF: VIP10", buttons: [{ title: "Usar Cupom", url: "https://", type: "url" }] } },
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", sourceHandle: "source-right", targetHandle: "target-left", animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" } },
            ]
          },
          "iniciadores": {
            name: "Iniciadores de Conversa (FAQ)",
            nodes: [
              { id: "1", type: "igGatilho", position: { x: 50, y: 200 }, data: { label: "FAQ / Início", triggerType: "dm", matchType: "any" } },
              { id: "2", type: "igDM", position: { x: 350, y: 200 }, data: { label: "Resposta FAQ", message: "Olá! Como posso te ajudar hoje?", buttons: [{ title: "Preços", type: "text" }, { title: "Horários", type: "text" }, { title: "Falar com Humano", type: "text" }] } },
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", sourceHandle: "source-right", targetHandle: "target-left", animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" } },
            ]
          },
          "story-mentions": {
            name: "Menção em Stories",
            nodes: [
              { id: "1", type: "igGatilho", position: { x: 50, y: 200 }, data: { label: "Menção em Story", triggerType: "story_reply", storyScope: "all", matchType: "any" } },
              { id: "2", type: "igDM", position: { x: 350, y: 200 }, data: { label: "Agradecimento", message: "Uau! Obrigado por nos marcar no seu Story! 😍 Preparamos um presente especial para você...", buttons: [{ title: "Resgatar Presente", url: "https://", type: "url" }] } },
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", sourceHandle: "source-right", targetHandle: "target-left", animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" } },
            ]
          },
          "resposta-padrao": {
            name: "Resposta Padrão (Fallback)",
            nodes: [
              { id: "1", type: "igGatilho", position: { x: 50, y: 200 }, data: { label: "Qualquer Mensagem", triggerType: "dm", matchType: "any", keywords: "" } },
              { id: "2", type: "igDM", position: { x: 350, y: 200 }, data: { label: "Fallback", message: "Recebemos sua mensagem! No momento nossos atendentes estão ocupados, mas logo te responderemos. Enquanto isso, escolha uma opção abaixo:", buttons: [{ title: "Ver Site", url: "https://", type: "url" }, { title: "Suporte", type: "text" }] } },
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", sourceHandle: "source-right", targetHandle: "target-left", animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" } },
            ]
          },
          "menu-principal": {
            name: "Menu Principal nas DMs",
            nodes: [
              { id: "1", type: "igGatilho", position: { x: 50, y: 200 }, data: { label: "Palavra 'Menu'", triggerType: "dm", keywords: "menu,ajuda,oi,ola", matchType: "any" } },
              { id: "2", type: "igDM", position: { x: 350, y: 200 }, data: { label: "Menu Principal", message: "Seja bem-vindo ao nosso canal de atendimento! Como podemos ser úteis hoje?", buttons: [{ title: "Nossos Produtos", type: "text" }, { title: "Rastrear Pedido", url: "https://", type: "url" }, { title: "Falar com Consultor", type: "text" }] } },
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", sourceHandle: "source-right", targetHandle: "target-left", animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" } },
            ]
          },
          "saudacao-novo-seguidor": {
            name: "Saudação para novos seguidores",
            nodes: [
              { id: "1", type: "igGatilho", position: { x: 50, y: 200 }, data: { label: "Novo Seguidor", triggerType: "follow" } },
              { id: "2", type: "igDM", position: { x: 350, y: 200 }, data: { label: "Bem-vindo", message: "Olá {{username}}! Obrigado por me seguir! 😍 Como posso te ajudar hoje?", buttons: [{ title: "Ver Produtos", url: "https://", type: "url" }, { title: "Falar com Humano", type: "text" }] } },
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", sourceHandle: "source-right", targetHandle: "target-left", animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" } },
            ]
          }
        }[templateId as keyof any];
            name: "Menu Principal nas DMs",
            nodes: [
              { id: "1", type: "igGatilho", position: { x: 50, y: 200 }, data: { label: "Palavra 'Menu'", triggerType: "dm", keywords: "menu,ajuda,oi,ola", matchType: "any" } },
              { id: "2", type: "igDM", position: { x: 350, y: 200 }, data: { label: "Menu Principal", message: "Seja bem-vindo ao nosso canal de atendimento! Como podemos ser úteis hoje?", buttons: [{ title: "Nossos Produtos", type: "text" }, { title: "Rastrear Pedido", url: "https://", type: "url" }, { title: "Falar com Consultor", type: "text" }] } },
            ],
            edges: [
              { id: "e1-2", source: "1", target: "2", sourceHandle: "source-right", targetHandle: "target-left", animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" } },
            ]
          }
        }[templateId as keyof any];
 
       if (template) {
         setFlowName(template.name);
         setNodes(template.nodes as Node[]);
         setEdges(template.edges as Edge[]);
         toast.success("Modelo carregado com sucesso!");
       }
     }
 
     if (editId && automations.length > 0) {
      const existing = automations.find((a) => a.id === editId);
      if (!existing) return;

      setFlowName(existing.name);
      setIsActive(existing.active);
      fetchButtonStats(existing.name);
      fetchCollectedLeads(existing.id);

      // Check if dm_message contains flow data
      let flowData: any = null;
      try {
        const parsed = JSON.parse(existing.dm_message || "");
        if (parsed.__flow__) flowData = parsed;
      } catch {}

       if (flowData && flowData.nodes?.length > 0) {
         // Strip cached dimensions so React Flow recalculates node sizes
         const cleanNodes = flowData.nodes.map((n: any) => {
           const { width, height, positionAbsolute, selected, dragging, ...rest } = n;
           return {
             ...rest,
             // Fix for old triggers
             data: {
               ...rest.data,
               triggerType: rest.data.triggerType || (rest.type === 'igGatilho' ? 'comment' : undefined)
             }
           };
         });
         setNodes(cleanNodes);
         setEdges(flowData.edges || []);
      } else {
        // Legacy: convert old format to flow nodes
        let dmText = existing.dm_message || "";
        let dmButtons: any[] = [];
        try {
          const parsed = JSON.parse(dmText);
          if (parsed.text !== undefined) {
            dmText = parsed.text || "";
            dmButtons = parsed.buttons || [];
          }
        } catch {}

        const legacyNodes: Node[] = [
          {
            id: "1",
            type: "igGatilho",
            position: { x: 50, y: 200 },
            data: { label: "Gatilho", keywords: existing.keyword || "" },
          },
          {
            id: "2",
            type: "igResposta",
            position: { x: 350, y: 100 },
            data: { label: "Responder Comentário", message: existing.reply_comment || "" },
          },
          {
            id: "3",
            type: "igDM",
            position: { x: 350, y: 300 },
            data: { label: "Enviar DM", message: dmText, buttons: dmButtons },
          },
        ];
        setNodes(legacyNodes);
        setEdges(defaultEdges);
      }
    }
  }, [editId, automations]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--primary))" },
          },
          eds
        )
      ),
    [setEdges]
  );

  const onEdgeClick = useCallback(
    (_e: React.MouseEvent, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      toast.success("Conexão removida");
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
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
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const labelMap: Record<string, string> = {
        igGatilho: "Gatilho",
        igResposta: "Responder Comentário",
        igDM: "Enviar DM",
        igDelay: "Espera",
        igWhatsApp: "Enviar WhatsApp",
      };

      const newNode: Node = {
        id: `${Date.now()}`,
        type,
        position,
        data: {
          label: labelMap[type] || type,
          message: "",
          keywords: "",
          buttons: [],
           triggerType: type === 'igGatilho' ? 'comment' : undefined,
           delayValue: 5,
           delayUnit: "seconds",
        },
      };

      setNodes((nds) => nds.concat(newNode));
      toast.success("Bloco adicionado!");
    },
    [reactFlowInstance, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setIsEditDialogOpen(false);
      toast.success("Bloco removido!");
    },
    [setNodes, setEdges]
  );

  const handleSaveNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.map((n) => (n.id === selectedNode.id ? { ...n, data: selectedNode.data } : n)));
    setIsEditDialogOpen(false);
    toast.success("Bloco atualizado!");
  };

  const handleSaveFlow = async () => {
    if (saving) return;
    setSaving(true);

    try {
      // Extract keyword from trigger nodes
      const triggerNodes = nodes.filter((n) => n.type === "igGatilho");
      const keywords = triggerNodes.map((n) => n.data.keywords || "").filter(Boolean).join(",");

      // Extract reply_comment from first reply node (for backward compat)
      const replyNode = nodes.find((n) => n.type === "igResposta");
      const replyComment = replyNode?.data.message || "";

      // Store the full flow in dm_message
      const serializedNodes = JSON.parse(JSON.stringify(nodes));
      const serializedEdges = JSON.parse(JSON.stringify(edges));
      const flowJson = JSON.stringify({
        __flow__: true,
        nodes: serializedNodes,
        edges: serializedEdges,
      });

      const payload = {
        name: flowName,
        keyword: keywords,
        reply_comment: replyComment,
        dm_message: flowJson,
        active: isActive,
      };

      if (editId) {
        updateAutomation.mutate(
          { id: editId, ...payload },
          { onSuccess: () => navigate("/instagram/campanhas") }
        );
      } else {
        createAutomation.mutate(payload, {
          onSuccess: () => navigate("/instagram/campanhas"),
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar fluxo");
    } finally {
      setSaving(false);
    }
  };

  // Edit dialog content
  const renderEditPanel = () => {
    if (!selectedNode) return null;
    const { type } = selectedNode;

     if (type === "igGatilho") {
       const triggerType = selectedNode.data.triggerType || "comment";
       const shortcode = (() => {
         const url = selectedNode.data.postUrl || "";
         const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
         return match ? match[1] : null;
       })();
 
       return (
         <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
           <div>
             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Tipo de Gatilho</Label>
             <div className="grid grid-cols-2 gap-2">
               {[
                 { id: "comment", label: "Comentário", icon: MessageCircle },
                 { id: "story_reply", label: "Story Reply", icon: Share2 },
                 { id: "dm", label: "Mensagem Direta", icon: Heart },
                 { id: "share", label: "Compartilhar", icon: Zap },
                 { id: "live", label: "Live Comment", icon: PlayCircle },
                 { id: "ads", label: "Anúncios", icon: Star },
               ].map((t) => (
                 <Button
                   key={t.id}
                   variant={triggerType === t.id ? "default" : "outline"}
                   size="sm"
                   className="h-9 gap-2 justify-start font-semibold text-xs"
                   onClick={() => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, triggerType: t.id } })}
                 >
                   <t.icon className="w-3.5 h-3.5" />
                   {t.label}
                 </Button>
               ))}
             </div>
           </div>
 
           {triggerType === "comment" && (
             <div className="space-y-3 animate-in fade-in duration-300">
               <div>
                 <Label className="text-xs font-bold text-muted-foreground mb-1 block">Configuração do Post</Label>
                 <Select 
                   value={selectedNode.data.postScope || "any"} 
                   onValueChange={(v) => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, postScope: v } })}
                 >
                   <SelectTrigger className="h-9 text-xs">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="any">Qualquer Post ou Reel</SelectItem>
                     <SelectItem value="specific">Post/Reel Específico</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
 
               {selectedNode.data.postScope === "specific" && (
                 <div className="space-y-2">
                   <Label className="text-xs font-bold text-muted-foreground mb-1 block">Link do Post / Reel</Label>
                   <Input
                     value={selectedNode.data.postUrl || ""}
                     onChange={(e) =>
                       setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, postUrl: e.target.value } })
                     }
                     placeholder="https://www.instagram.com/p/ABC123..."
                     className="h-9 text-xs"
                   />
                   {shortcode && (
                     <div className="rounded-xl overflow-hidden border border-border shadow-inner bg-black/5 mt-2">
                       <iframe
                         src={`https://www.instagram.com/p/${shortcode}/embed/`}
                         width="100%"
                         height="320"
                         frameBorder="0"
                         scrolling="no"
                         allowTransparency
                         style={{ border: "none" }}
                       />
                     </div>
                   )}
                 </div>
               )}
             </div>
           )}
 
           {triggerType === "story_reply" && (
             <div className="space-y-3 animate-in fade-in duration-300">
               <div>
                 <Label className="text-xs font-bold text-muted-foreground mb-1 block">Configuração do Story</Label>
                 <Select 
                   value={selectedNode.data.storyScope || "all"} 
                   onValueChange={(v) => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, storyScope: v } })}
                 >
                   <SelectTrigger className="h-9 text-xs">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">Todos os Stories</SelectItem>
                     <SelectItem value="specific">Apenas Story Específico</SelectItem>
                   </SelectContent>
                 </Select>
                 <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed bg-pink-500/5 p-2 rounded-lg border border-pink-500/10 italic">
                   Nota: Para Stories específicos, você precisará capturar o ID do story após publicá-lo.
                 </p>
               </div>
             </div>
           )}
 
           <div className="pt-2 border-t border-border/40">
             <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Regras de Ativação</Label>
             <div className="space-y-3">
               <Select 
                 value={selectedNode.data.matchType || "contains"} 
                 onValueChange={(v) => setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, matchType: v } })}
               >
                 <SelectTrigger className="h-9 text-xs">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="contains">Mensagem contém palavras-chave</SelectItem>
                   <SelectItem value="exact">Mensagem é exatamente a palavra-chave</SelectItem>
                   <SelectItem value="any">Qualquer mensagem/comentário</SelectItem>
                 </SelectContent>
               </Select>
               
               {selectedNode.data.matchType !== "any" && (
                 <div>
                   <Label className="text-[11px] font-semibold text-muted-foreground mb-1.5 block">Palavras-chave (separadas por vírgula)</Label>
                   <Input
                     value={selectedNode.data.keywords || ""}
                     onChange={(e) =>
                       setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, keywords: e.target.value } })
                     }
                     placeholder="eu quero, me manda, info"
                     className="h-9 text-xs"
                   />
                 </div>
               )}
             </div>
           </div>
         </div>
       );
     }

    if (type === "igResposta") {
      return (
        <div className="space-y-4">
          <div>
            <Label>Mensagem de resposta no comentário</Label>
            <Textarea
              value={selectedNode.data.message || ""}
              onChange={(e) =>
                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, message: e.target.value } })
              }
              placeholder="Obrigado pelo interesse! Te enviei uma DM 😉"
              rows={3}
            />
            <div className="flex gap-1 mt-1">
              {["nome_usuario", "comentario"].map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant="outline"
                  className="text-xs h-6 gap-1"
                  onClick={() =>
                    setSelectedNode({
                      ...selectedNode,
                      data: { ...selectedNode.data, message: (selectedNode.data.message || "") + `{{${v}}}` },
                    })
                  }
                >
                  <Variable className="w-3 h-3" />
                  {v}
                </Button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (type === "igDM") {
      const buttons = selectedNode.data.buttons || [];
      return (
        <div className="space-y-4">
          <div>
            <Label>Mensagem da DM</Label>
            <Textarea
              value={selectedNode.data.message || ""}
              onChange={(e) =>
                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, message: e.target.value } })
              }
              placeholder="Olá {{nome_usuario}}! Aqui está o que você pediu 🎁"
              rows={4}
            />
            <div className="flex gap-1 mt-1">
              {["nome_usuario", "comentario"].map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant="outline"
                  className="text-xs h-6 gap-1"
                  onClick={() =>
                    setSelectedNode({
                      ...selectedNode,
                      data: { ...selectedNode.data, message: (selectedNode.data.message || "") + `{{${v}}}` },
                    })
                  }
                >
                  <Variable className="w-3 h-3" />
                  {v}
                </Button>
              ))}
            </div>
          </div>

          {/* Name Collection Container */}
          <div className="p-3 border border-purple-500/30 rounded-lg bg-purple-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-purple-500" />
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
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagem de solicitação</Label>
                  <Input
                    value={selectedNode.data.namePrompt || ""}
                    onChange={(e) =>
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, namePrompt: e.target.value } })
                    }
                    placeholder="Qual o seu nome? 😊"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagem após receber o Nome</Label>
                  <Textarea
                    value={selectedNode.data.nameFollowUp || ""}
                    onChange={(e) =>
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, nameFollowUp: e.target.value } })
                    }
                    placeholder="Prazer em te conhecer, {{nome}}! 🤝"
                    rows={2}
                    className="text-xs mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp Collection Container */}
          <div className="p-3 border border-emerald-500/30 rounded-lg bg-emerald-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-500" />
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
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagem de solicitação</Label>
                  <Input
                    value={selectedNode.data.whatsappPrompt || ""}
                    onChange={(e) =>
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, whatsappPrompt: e.target.value } })
                    }
                    placeholder="Qual seu número de WhatsApp? 📱"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagem após receber o WhatsApp</Label>
                  <Textarea
                    value={selectedNode.data.whatsappFollowUp || ""}
                    onChange={(e) =>
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, whatsappFollowUp: e.target.value } })
                    }
                    placeholder="Obrigado! Vou te enviar mais detalhes no WhatsApp 🚀"
                    rows={2}
                    className="text-xs mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Email Collection Container */}
          <div className="p-3 border border-blue-500/30 rounded-lg bg-blue-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
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
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagem de solicitação</Label>
                  <Input
                    value={selectedNode.data.emailPrompt || ""}
                    onChange={(e) =>
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, emailPrompt: e.target.value } })
                    }
                    placeholder="Qual seu melhor email? 📧"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagem após receber o Email</Label>
                  <Textarea
                    value={selectedNode.data.emailFollowUp || ""}
                    onChange={(e) =>
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, emailFollowUp: e.target.value } })
                    }
                    placeholder="Perfeito! Enviamos as informações para seu email 📧"
                    rows={2}
                    className="text-xs mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Botões (máx. 3)
            </Label>
            {buttons.map((btn: any, idx: number) => (
              <div key={idx} className="space-y-1.5 p-2 border border-border rounded-md">
                <div className="flex gap-2 items-center">
                  <select
                    value={btn.type || "url"}
                    onChange={(e) => {
                      const newBtns = [...buttons];
                      newBtns[idx] = { ...newBtns[idx], type: e.target.value, url: e.target.value === "reply" ? "" : newBtns[idx].url };
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, buttons: newBtns } });
                    }}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[80px]"
                  >
                    <option value="url">URL</option>
                    <option value="reply">Reply</option>
                  </select>
                  <Input
                    value={btn.title || ""}
                    onChange={(e) => {
                      const newBtns = [...buttons];
                      newBtns[idx] = { ...newBtns[idx], title: e.target.value };
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, buttons: newBtns } });
                    }}
                    placeholder="Texto do botão"
                    className="h-8 text-xs"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => {
                      const newBtns = buttons.filter((_: any, i: number) => i !== idx);
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, buttons: newBtns } });
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                {(btn.type || "url") === "url" && (
                  <Input
                    value={btn.url || ""}
                    onChange={(e) => {
                      const newBtns = [...buttons];
                      newBtns[idx] = { ...newBtns[idx], url: e.target.value };
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, buttons: newBtns } });
                    }}
                    placeholder="https://..."
                    className="h-8 text-xs"
                  />
                )}
              </div>
            ))}
            {buttons.length < 3 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1 border-dashed w-full"
                onClick={() => {
                  const newBtns = [...buttons, { title: "", url: "", type: "url" }];
                  setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, buttons: newBtns } });
                }}
              >
                <Plus className="w-3 h-3" /> Adicionar Botão
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (type === "igDelay") {
      return (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Tempo</Label>
              <Input
                type="number"
                min={0}
                value={selectedNode.data.delayValue || 0}
                onChange={(e) =>
                  setSelectedNode({
                    ...selectedNode,
                    data: { ...selectedNode.data, delayValue: parseInt(e.target.value) || 0 },
                  })
                }
              />
            </div>
            <div className="flex-1">
              <Label>Unidade</Label>
              <Select
                value={selectedNode.data.delayUnit || "seconds"}
                onValueChange={(v) =>
                  setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, delayUnit: v } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Segundos</SelectItem>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );
    }

    if (type === "igWhatsApp") {
      const sendType = selectedNode.data.sendType || "template";
      return (
        <div className="space-y-4">
          {/* Instance selector */}
          <div>
            <Label>Instância WhatsApp</Label>
            <Select
              value={selectedNode.data.instanceId || ""}
              onValueChange={(v) => {
                const inst = waInstances.find((i: any) => i.id === v);
                setSelectedNode({
                  ...selectedNode,
                  data: { ...selectedNode.data, instanceId: v, instanceName: inst?.instance_name || "" },
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a instância" />
              </SelectTrigger>
              <SelectContent>
                {waInstances.map((inst: any) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.instance_name} {inst.is_default ? "(padrão)" : ""} — {inst.api_provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Send type */}
          <div>
            <Label>Tipo de envio</Label>
            <Select
              value={sendType}
              onValueChange={(v) =>
                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, sendType: v } })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texto livre</SelectItem>
                <SelectItem value="template">Modelo salvo</SelectItem>
                <SelectItem value="flow">Fluxo visual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Text */}
          {sendType === "text" && (
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={selectedNode.data.message || ""}
                onChange={(e) =>
                  setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, message: e.target.value } })
                }
                placeholder="Olá! Obrigado pelo seu interesse..."
                rows={4}
              />
              <div className="flex gap-1 mt-1">
                {["nome_usuario"].map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant="outline"
                    className="text-xs h-6 gap-1"
                    onClick={() =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, message: (selectedNode.data.message || "") + `{{${v}}}` },
                      })
                    }
                  >
                    <Variable className="w-3 h-3" />
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Template */}
          {sendType === "template" && (
            <div>
              <Label>Modelo</Label>
              <Select
                value={selectedNode.data.templateId || ""}
                onValueChange={(v) => {
                  const tpl = waTemplates.find((t: any) => t.id === v);
                  setSelectedNode({
                    ...selectedNode,
                    data: { ...selectedNode.data, templateId: v, templateName: tpl?.name || "" },
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {waTemplates.map((tpl: any) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedNode.data.templateId && (() => {
                const tpl = waTemplates.find((t: any) => t.id === selectedNode.data.templateId);
                if (!tpl) return null;
                return (
                  <div className="mt-2 p-2 bg-muted/40 rounded text-xs text-muted-foreground whitespace-pre-wrap">
                    {tpl.content}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Flow */}
          {sendType === "flow" && (
            <div>
              <Label>Fluxo Visual</Label>
              <Select
                value={selectedNode.data.flowId || ""}
                onValueChange={(v) => {
                  const flow = waFlows.find((f: any) => f.id === v);
                  setSelectedNode({
                    ...selectedNode,
                    data: { ...selectedNode.data, flowId: v, flowName: flow?.name || "" },
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fluxo" />
                </SelectTrigger>
                <SelectContent>
                  {waFlows.map((flow: any) => (
                    <SelectItem key={flow.id} value={flow.id}>
                      {flow.name} {flow.keyword ? `(${flow.keyword})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col">
      {/* Top Bar */}
       <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card/60 backdrop-blur-md shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/instagram/campanhas")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
           <div className="relative group">
             <Input
               value={flowName}
               onChange={(e) => setFlowName(e.target.value)}
               className="h-9 w-64 text-sm font-bold bg-transparent border-transparent hover:border-border/40 focus:bg-background/50 transition-all pl-2 pr-8"
               placeholder="Nome do Fluxo"
             />
             <Pencil className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
           </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-xs text-muted-foreground">{isActive ? "Ativo" : "Inativo"}</span>
          </div>
        </div>

         <div className="flex items-center gap-2 pr-2 border-r border-border/40 mr-2">
           {/* Floating style toolbar */}
           <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/40">
             {blocosDisponiveis.map((bloco) => {
               const Icon = bloco.icon;
               return (
                 <div
                   key={bloco.type}
                   draggable
                   onDragStart={(e) => onDragStart(e, bloco.type)}
                   className="flex flex-col items-center justify-center w-12 h-12 rounded-md cursor-grab bg-card border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm group"
                   title={bloco.description}
                 >
                   <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mb-0.5" />
                   <span className="text-[9px] font-bold text-muted-foreground group-hover:text-primary uppercase tracking-tighter">{bloco.label}</span>
                 </div>
               );
             })}
           </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowLeads(true)}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Leads
            {collectedLeads.length > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">
                {collectedLeads.length}
              </Badge>
            )}
          </Button>

           <Button 
             onClick={handleSaveFlow} 
             disabled={saving} 
             size="sm" 
             className="gap-1.5 ml-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
           >
             <Save className="w-3.5 h-3.5" />
             {saving ? "Publicando..." : "Publicar Fluxo"}
           </Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1">
        <ReactFlow
           nodes={nodes.map(n => {
             if (n.type === 'igDM') return { ...n, data: { ...n.data, buttonStats, totalFlowRecipients } };
             // Ensure triggerType is present for rendering
             if (n.type === 'igGatilho' && !n.data.triggerType) return { ...n, data: { ...n.data, triggerType: 'comment' } };
             return n;
           })}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeClick={onNodeClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
           <Controls className="!bg-card !border-border/50 !shadow-xl !rounded-lg !overflow-hidden" />
           <Background variant={BackgroundVariant.Lines} gap={40} size={1} color="rgba(255,255,255,0.03)" className="!bg-[#0f1115]" />
           <MiniMap
             className="!bg-card/80 !border-border/50 !rounded-xl !shadow-2xl backdrop-blur-md"
             nodeColor={() => "hsl(var(--primary))"}
             maskColor="rgba(0,0,0,0.5)"
             style={{ right: 20, bottom: 20 }}
           />
        </ReactFlow>
      </div>

      {/* Leads Side Sheet */}
      <Sheet open={showLeads} onOpenChange={setShowLeads}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-[92vw] lg:w-[1100px] lg:max-w-[1100px] p-0">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4" />
                Dados Coletados
                <Badge variant="secondary" className="text-xs">
                  {collectedLeads.length}
                </Badge>
              </div>
              {collectedLeads.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    const headers = ["@ Post", "@ Comentário", "WhatsApp", "Email", "Data", "Hora"];
                    const grouped = new Map<string, any>();
                    collectedLeads.forEach((lead: any) => {
                      const payload = lead.payload as any;
                      const key = lead.username || lead.ig_user_id || "unknown";
                      if (!grouped.has(key)) {
                        grouped.set(key, { postOwner: payload?.post_owner || "", username: key, whatsapp: "", email: "", created_at: lead.created_at });
                      }
                      const g = grouped.get(key)!;
                      const val = payload?.collected_value || lead.comment_text || "";
                      if (lead.event_type === "lead_whatsapp" && val) g.whatsapp = val;
                      if (lead.event_type === "lead_email" && val) g.email = val;
                      if (new Date(lead.created_at) > new Date(g.created_at)) g.created_at = lead.created_at;
                      if (payload?.post_owner) g.postOwner = payload.post_owner;
                    });
                    const rows = Array.from(grouped.values()).map((g: any) => {
                      const d = new Date(g.created_at);
                      return [
                        `@${g.postOwner}`,
                        `@${g.username}`,
                        g.whatsapp,
                        g.email,
                        d.toLocaleDateString("pt-BR"),
                        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
                    });
                    const csv = [headers.join(","), ...rows].join("\n");
                    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("CSV exportado!");
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar CSV
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-60px)] w-full">
            {collectedLeads.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm px-4">
                Nenhum dado coletado ainda. Quando os usuários enviarem WhatsApp ou Email via DM, aparecerão aqui.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                {(() => {
                  const grouped = new Map<string, any>();
                  collectedLeads.forEach((lead: any) => {
                    const payload = lead.payload as any;
                    const key = lead.username || lead.ig_user_id || "unknown";
                    if (!grouped.has(key)) {
                      grouped.set(key, { postOwner: payload?.post_owner || "", username: key, whatsapp: "", email: "", created_at: lead.created_at });
                    }
                    const g = grouped.get(key)!;
                    const val = payload?.collected_value || lead.comment_text || "";
                    if (lead.event_type === "lead_whatsapp" && val) g.whatsapp = val;
                    if (lead.event_type === "lead_email" && val) g.email = val;
                    if (new Date(lead.created_at) > new Date(g.created_at)) g.created_at = lead.created_at;
                    if (payload?.post_owner) g.postOwner = payload.post_owner;
                  });
                  const groupedLeads = Array.from(grouped.values());
                  return (
                    <Table className="min-w-[780px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px] px-3 whitespace-nowrap">@ Post</TableHead>
                          <TableHead className="text-[11px] px-3 whitespace-nowrap">@ Comentário</TableHead>
                          <TableHead className="text-[11px] px-3 whitespace-nowrap">WhatsApp</TableHead>
                          <TableHead className="text-[11px] px-3 whitespace-nowrap">Email</TableHead>
                          <TableHead className="text-[11px] px-3 whitespace-nowrap">Data</TableHead>
                          <TableHead className="text-[11px] px-3 whitespace-nowrap">Hora</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedLeads.map((g: any, i: number) => {
                          const d = new Date(g.created_at);
                          return (
                            <TableRow key={g.username + i}>
                              <TableCell className="text-xs px-3 py-2 whitespace-nowrap">
                                @{g.postOwner || "—"}
                              </TableCell>
                              <TableCell className="text-xs px-3 py-2 whitespace-nowrap">
                                @{g.username}
                              </TableCell>
                              <TableCell className="text-xs px-3 py-2 font-mono whitespace-nowrap">
                                {g.whatsapp ? (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-green-500" />
                                    {g.whatsapp}
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-xs px-3 py-2 font-mono whitespace-nowrap">
                                {g.email ? (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-blue-500" />
                                    {g.email}
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-[11px] px-3 py-2 text-muted-foreground whitespace-nowrap">
                                {d.toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell className="text-[11px] px-3 py-2 text-muted-foreground whitespace-nowrap">
                                {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  );
                })()}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

       {/* Edit Node Panel - ManyChat Style (Sheet or Right Sidebar) */}
       <Sheet open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
         <SheetContent side="right" className="sm:max-w-md p-0 overflow-hidden flex flex-col border-l border-border/40">
           <SheetHeader className="p-4 border-b border-border/40 bg-muted/20">
             <SheetTitle className="flex items-center justify-between text-base font-bold">
               <div className="flex items-center gap-2">
                 <div className="p-1.5 rounded bg-primary/10">
                   <Settings2 className="w-4 h-4 text-primary" />
                 </div>
                 <span>Configurar Bloco</span>
               </div>
               {selectedNode && (
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-8 w-8 text-destructive hover:bg-destructive/10"
                   onClick={() => handleDeleteNode(selectedNode.id)}
                 >
                   <Trash2 className="w-3.5 h-3.5" />
                 </Button>
               )}
             </SheetTitle>
           </SheetHeader>
           <ScrollArea className="flex-1 p-6">
             {renderEditPanel()}
           </ScrollArea>
           <div className="p-4 border-t border-border/40 bg-muted/20 flex gap-3">
             <Button variant="outline" className="flex-1 font-semibold" onClick={() => setIsEditDialogOpen(false)}>
               Cancelar
             </Button>
             <Button className="flex-1 font-semibold" onClick={handleSaveNode}>
               Aplicar Alterações
             </Button>
           </div>
         </SheetContent>
       </Sheet>
    </div>
  );
}