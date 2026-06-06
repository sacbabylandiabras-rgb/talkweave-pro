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
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PlayCircle,
  Save,
  Plus,
  ArrowLeft,
  RefreshCw,
  Eye,
  Trash2,
  Copy,
  Zap,
  MessageSquare,
  Key,
  CalendarClock,
  Bot,
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
import { AddBlockDialog } from "@/components/flow/AddBlockDialog";
import { FlowTemplatesDialog } from "@/components/flow/FlowTemplatesDialog";
import type { FlowTemplate } from "@/components/flow/flowTemplates";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const nodeTypes: NodeTypes = {
  blocoInicial: BlocoInicialNode,
  blocoConteudo: BlocoConteudoNode,
  blocoCondicao: BlocoCondicaoNode,
  blocoAcao: BlocoAcaoNode,
  blocoGatilho: BlocoGatilhoNode,
  blocoAgendamento: BlocoAgendamentoNode,
  agenteIA: BlocoAgenteIANode,
  agentTool: BlocoAgentToolNode,
  // Aliases
  inicio: BlocoInicialNode,
  conteudo: BlocoConteudoNode,
  condicao: BlocoCondicaoNode,
  acao: BlocoAcaoNode,
  gatilho: BlocoGatilhoNode,
  agendamento: BlocoAgendamentoNode,
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

interface FlowAutomation {
  id: string;
  user_id: string;
  name: string;
  keyword: string;
  nodes: any[];
  edges: any[];
  active: boolean;
  category: string;
  created_at: string;
  updated_at: string;
}

interface FluxoVisualBaseProps {
  category: "contacts" | "groups" | "meta" | "instagram" | "telegram";
  title: string;
  subtitle: string;
  emptyHelp: string;
  availableBlocks?: any[];
}

export default function FluxoVisualBase({ 
  category, 
  title, 
  subtitle, 
  emptyHelp,
  availableBlocks 
}: FluxoVisualBaseProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nomeFluxo, setNomeFluxo] = useState("Novo Fluxo");
  const [keywordFluxo, setKeywordFluxo] = useState("");
  const [fluxoAtivo, setFluxoAtivo] = useState(true);
  const [currentFluxoId, setCurrentFluxoId] = useState<string | null>(null);
  const [fluxosSalvos, setFluxosSalvos] = useState<FlowAutomation[]>([]);
  const [showFluxosList, setShowFluxosList] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savingFluxo, setSavingFluxo] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showAddBlockDialog, setShowAddBlockDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);

  const fetchFluxos = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('flow_automations')
        .select('*')
        .eq('category', category)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setFluxosSalvos(data || []);
    } catch (error) {
      console.error("Erro ao carregar fluxos:", error);
      toast.error("Erro ao carregar fluxos");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchFluxos();
  }, [fetchFluxos]);

  const handleNovoFluxo = () => {
    setShowTemplatesDialog(true);
  };

  const handleSelectTemplate = (tpl: FlowTemplate) => {
    setNomeFluxo(tpl.name);
    setKeywordFluxo(tpl.suggestedKeyword || "");
    setFluxoAtivo(true);
    setCurrentFluxoId(null);
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    setShowTemplatesDialog(false);
    setShowFluxosList(false);
    toast.success(`Modelo "${tpl.name}" carregado!`);
  };

  const handleStartBlank = () => {
    setNomeFluxo("Novo Fluxo");
    setKeywordFluxo("");
    setFluxoAtivo(true);
    setCurrentFluxoId(null);
    setNodes(initialNodes);
    setEdges(initialEdges);
    setShowTemplatesDialog(false);
    setShowFluxosList(false);
  };

  const handleCarregarFluxo = (fluxo: FlowAutomation) => {
    setNomeFluxo(fluxo.name);
    setKeywordFluxo(fluxo.keyword || "");
    setFluxoAtivo(fluxo.active);
    setCurrentFluxoId(fluxo.id);
    setNodes(fluxo.nodes || initialNodes);
    setEdges(fluxo.edges || initialEdges);
    setShowFluxosList(false);
    toast.success(`Fluxo "${fluxo.name}" carregado!`);
  };

  const handleSalvarFluxo = async () => {
    if (!nomeFluxo.trim()) {
      toast.error("Dê um nome ao seu fluxo");
      return;
    }

    try {
      setSavingFluxo(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Faça login para salvar fluxos");
        return;
      }

      const flowData = {
        user_id: user.id,
        name: nomeFluxo,
        keyword: keywordFluxo,
        nodes,
        edges,
        active: fluxoAtivo,
        category,
      };

      if (currentFluxoId) {
        const { error } = await supabase
          .from('flow_automations')
          .update(flowData)
          .eq('id', currentFluxoId);
        if (error) throw error;
        toast.success("Fluxo atualizado com sucesso!");
      } else {
        const { data, error } = await supabase
          .from('flow_automations')
          .insert(flowData)
          .select()
          .single();
        if (error) throw error;
        setCurrentFluxoId(data.id);
        toast.success("Novo fluxo salvo!");
      }
      fetchFluxos();
    } catch (error) {
      console.error("Erro ao salvar fluxo:", error);
      toast.error("Erro ao salvar fluxo");
    } finally {
      setSavingFluxo(false);
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

  const onInit = (instance: ReactFlowInstance) => setReactFlowInstance(instance);

  if (showFluxosList) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            <p className="text-muted-foreground mt-2">{subtitle}</p>
          </div>
          <Button onClick={handleNovoFluxo} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Fluxo
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : fluxosSalvos.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <p className="text-xl font-medium">{emptyHelp}</p>
              <Button onClick={handleNovoFluxo} variant="outline" className="mt-2">
                Começar agora
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fluxosSalvos.map((fluxo) => (
              <Card key={fluxo.id} className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleCarregarFluxo(fluxo)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-5 w-5" />
                  </div>
                  <Badge variant={fluxo.active ? "default" : "secondary"}>
                    {fluxo.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <h3 className="text-xl font-semibold mb-2 line-clamp-1">{fluxo.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {fluxo.keyword ? `Palavra-chave: ${fluxo.keyword}` : "Sem palavra-chave"}
                </p>
                <div className="flex items-center text-xs text-muted-foreground">
                  Atualizado em {new Date(fluxo.updated_at).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        )}

        <FlowTemplatesDialog
          open={showTemplatesDialog}
          onOpenChange={setShowTemplatesDialog}
          onSelectTemplate={handleSelectTemplate}
          onStartBlank={handleStartBlank}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setShowFluxosList(true)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <Input
              value={nomeFluxo}
              onChange={(e) => setNomeFluxo(e.target.value)}
              className="h-8 font-semibold text-lg border-none focus-visible:ring-0 p-0 bg-transparent"
              placeholder="Nome do fluxo"
            />
            <div className="flex items-center gap-2 mt-1">
              <Key className="h-3 w-3 text-muted-foreground" />
              <Input
                value={keywordFluxo}
                onChange={(e) => setKeywordFluxo(e.target.value)}
                className="h-5 text-xs border-none focus-visible:ring-0 p-0 bg-transparent w-40"
                placeholder="Palavra-chave gatilho"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-xs font-medium text-muted-foreground">Ativo</span>
            <Switch checked={fluxoAtivo} onCheckedChange={setFluxoAtivo} />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Eye className="h-4 w-4" /> Prévia
          </Button>
          <Button onClick={handleSalvarFluxo} disabled={savingFluxo} className="gap-2">
            {savingFluxo ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={onInit}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          <MiniMap />
        </ReactFlow>

        <div className="absolute top-4 right-4 z-10">
          <Button onClick={() => setShowAddBlockDialog(true)} className="rounded-full h-12 w-12 shadow-xl">
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>

      <AddBlockDialog
        open={showAddBlockDialog}
        onOpenChange={setShowAddBlockDialog}
        onSelect={(selection) => {
          // Logic to add node at center or relative to viewport
          const newNode: Node = {
            id: `n_${Math.random().toString(36).slice(2, 9)}`,
            type: selection.type,
            position: { x: 400, y: 300 },
            data: { label: selection.label, ...selection.extraData },
          };
          setNodes((nds) => [...nds, newNode]);
          setShowAddBlockDialog(false);
        }}
      />
    </div>
  );
}
