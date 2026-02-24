import { useState, useCallback, useRef } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  MessageSquare,
  GitBranch,
  Zap,
  Save,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { BlocoGatewayTriggerNode } from "@/components/flow/BlocoGatewayTriggerNode";
import { BlocoConteudoNode } from "@/components/flow/BlocoConteudoNode";
import { BlocoCondicaoNode } from "@/components/flow/BlocoCondicaoNode";
import { BlocoAcaoNode } from "@/components/flow/BlocoAcaoNode";

const nodeTypes: NodeTypes = {
  gatewayTrigger: BlocoGatewayTriggerNode,
  blocoConteudo: BlocoConteudoNode,
  blocoCondicao: BlocoCondicaoNode,
  blocoAcao: BlocoAcaoNode,
};

const EVENT_TYPES = [
  { value: "payment_pending", label: "Pagamento Pendente" },
  { value: "payment_approved", label: "Pagamento Aprovado" },
  { value: "payment_refused", label: "Pagamento Recusado" },
  { value: "payment_refunded", label: "Pagamento Estornado" },
  { value: "payment_cancelled", label: "Pagamento Cancelado" },
];

const blocosDisponiveis = [
  {
    type: "blocoConteudo",
    label: "Mensagem",
    icon: MessageSquare,
    description: "Enviar mensagem de texto",
  },
  {
    type: "blocoCondicao",
    label: "Condição",
    icon: GitBranch,
    description: "Criar ramificação",
  },
  {
    type: "blocoAcao",
    label: "Ação",
    icon: Zap,
    description: "Executar uma ação (delay, tag, etc.)",
  },
];

interface IntegrationFlowEditorProps {
  onBack: () => void;
}

interface SavedFlow {
  nome: string;
  eventType: string;
  nodes: Node[];
  edges: Edge[];
  updatedAt: string;
}

export default function IntegrationFlowEditor({ onBack }: IntegrationFlowEditorProps) {
  const defaultNodes: Node[] = [
    {
      id: "trigger-1",
      type: "gatewayTrigger",
      position: { x: 250, y: 50 },
      data: { label: "Webhook Recebido", description: "Evento do gateway/checkout" },
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [nomeFluxo, setNomeFluxo] = useState("Novo Fluxo de Integração");
  const [eventType, setEventType] = useState("payment_approved");
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("integration_flows") || "[]");
    } catch { return []; }
  });
  const [showList, setShowList] = useState(true);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (node.type === "gatewayTrigger") return;
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

      const newNode: Node = {
        id: `${Date.now()}`,
        type,
        position,
        data: {
          label: type === "blocoConteudo" ? "Mensagem" : type === "blocoCondicao" ? "Condição" : "Ação",
          content: "",
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

  const handleSaveNode = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => node.id === selectedNode.id ? { ...node, data: selectedNode.data } : node)
    );
    setIsEditDialogOpen(false);
    toast.success("Bloco atualizado!");
  };

  const handleSaveFlow = () => {
    const flowData: SavedFlow = {
      nome: nomeFluxo,
      eventType,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };

    const existing = [...savedFlows];
    const idx = existing.findIndex((f) => f.nome === nomeFluxo);
    if (idx >= 0) existing[idx] = flowData;
    else existing.push(flowData);

    localStorage.setItem("integration_flows", JSON.stringify(existing));
    setSavedFlows(existing);
    toast.success("Fluxo salvo!");
  };

  const handleLoadFlow = (flow: SavedFlow) => {
    setNomeFluxo(flow.nome);
    setEventType(flow.eventType);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setShowList(false);
    toast.success(`Fluxo "${flow.nome}" carregado!`);
  };

  const handleDeleteFlow = (nome: string) => {
    const updated = savedFlows.filter((f) => f.nome !== nome);
    localStorage.setItem("integration_flows", JSON.stringify(updated));
    setSavedFlows(updated);
    toast.success("Fluxo excluído!");
  };

  const handleNewFlow = () => {
    setNomeFluxo("Novo Fluxo de Integração");
    setEventType("payment_approved");
    setNodes(defaultNodes);
    setEdges([]);
    setShowList(false);
  };

  // List view
  if (showList) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">Fluxos de Integração</h2>
          </div>
          <Button size="sm" onClick={handleNewFlow}>
            Novo Fluxo
          </Button>
        </div>

        {savedFlows.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center py-10 text-center px-4">
              <GitBranch className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-semibold mb-1">Nenhum fluxo de integração</p>
              <p className="text-sm text-muted-foreground mb-4">
                Crie um fluxo visual para definir sequências de mensagens automáticas
              </p>
              <Button size="sm" onClick={handleNewFlow}>Criar Fluxo</Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {savedFlows.map((flow) => (
              <Card key={flow.nome} className="p-4 hover:shadow-lg transition-shadow">
                <h3 className="font-semibold">{flow.nome}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Evento: {EVENT_TYPES.find(e => e.value === flow.eventType)?.label || flow.eventType}
                </p>
                <p className="text-xs text-muted-foreground">
                  {flow.nodes?.length || 0} blocos • {flow.edges?.length || 0} conexões
                </p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="flex-1" onClick={() => handleLoadFlow(flow)}>Abrir</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteFlow(flow.nome)}>Excluir</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Editor view
  return (
    <>
      <div className="flex h-[700px] w-full bg-background rounded-lg border overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 p-4 flex flex-col border-r bg-card">
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="ghost" onClick={() => setShowList(true)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-semibold flex-1">Blocos</h2>
          </div>

          <Button size="sm" onClick={handleSaveFlow} className="mb-4 w-full">
            <Save className="h-4 w-4 mr-2" /> Salvar Fluxo
          </Button>

          <div className="space-y-3 mb-4">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={nomeFluxo}
                onChange={(e) => setNomeFluxo(e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Evento Gatilho</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {blocosDisponiveis.map((bloco) => (
                <Card
                  key={bloco.type}
                  className="p-3 cursor-move hover:bg-accent transition-colors"
                  draggable
                  onDragStart={(e) => onDragStart(e, bloco.type)}
                >
                  <div className="flex items-center gap-2">
                    <bloco.icon className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs font-medium">{bloco.label}</p>
                      <p className="text-[10px] text-muted-foreground">{bloco.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t">
            Arraste os blocos para o canvas e conecte-os
          </p>
        </div>

        {/* Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar: {selectedNode?.data?.label}</DialogTitle>
            <DialogDescription>Configure as propriedades deste bloco</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedNode?.type === "blocoConteudo" && (
              <>
                <div>
                  <Label>Mensagem</Label>
                  <Textarea
                    value={selectedNode.data.content || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, content: e.target.value },
                      })
                    }
                    placeholder="Olá {{nome}}! Seu pagamento de {{valor}} foi aprovado! 🎉"
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use: {"{{nome}}"}, {"{{valor}}"}, {"{{produto}}"}, {"{{telefone}}"}, {"{{status}}"}, {"{{link}}"}
                  </p>
                </div>
              </>
            )}

            {selectedNode?.type === "blocoCondicao" && (
              <>
                <div>
                  <Label>Tipo de Condição</Label>
                  <Select
                    value={selectedNode.data.conditionType || "keyword"}
                    onValueChange={(value) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, conditionType: value },
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Palavra-chave</SelectItem>
                      <SelectItem value="status">Status do Pagamento</SelectItem>
                      <SelectItem value="variable">Variável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    value={selectedNode.data.condition || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, condition: e.target.value },
                      })
                    }
                    placeholder="Ex: Se status = aprovado"
                  />
                </div>
              </>
            )}

            {selectedNode?.type === "blocoAcao" && (
              <>
                <div>
                  <Label>Tipo de Ação</Label>
                  <Select
                    value={selectedNode.data.actionType || "delay"}
                    onValueChange={(value) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, actionType: value },
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delay">Aguardar (Delay)</SelectItem>
                      <SelectItem value="tag">Adicionar Tag</SelectItem>
                      <SelectItem value="webhook">Chamar Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Configuração</Label>
                  <Input
                    value={selectedNode.data.actionConfig || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, actionConfig: e.target.value },
                      })
                    }
                    placeholder={selectedNode.data.actionType === "delay" ? "Ex: 30 (segundos)" : "Configure..."}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveNode}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
