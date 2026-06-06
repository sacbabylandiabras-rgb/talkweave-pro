 import { useState, useCallback, useRef, useEffect } from "react";
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
   Trash2,
   RefreshCw,
} from "lucide-react";
 import { toast } from "sonner";
 import { supabase } from "@/integrations/supabase/client";
 import { useZapiInstances } from "@/hooks/useZapiInstances";
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
   const { instances } = useZapiInstances();
   const [availableTags, setAvailableTags] = useState<string[]>([]);
   const [loadingTags, setLoadingTags] = useState(false);
 
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
   }, [fetchTagsForEditor]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
    }, eds)),
    [setEdges]
  );

  const onEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    toast.success("Conexão removida!");
  }, [setEdges]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.type === "gatewayTrigger") {
      toast.error("Não é possível excluir o bloco trigger!");
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setIsEditDialogOpen(false);
    toast.success("Bloco removido!");
  }, [nodes, setNodes, setEdges]);

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
            onEdgeClick={onEdgeClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-background"
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
                <div>
                  <Label>Texto do Botão (opcional)</Label>
                  <Input
                    value={selectedNode.data.buttonLabel || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, buttonLabel: e.target.value },
                      })
                    }
                    placeholder="Ex: Acessar Pedido"
                  />
                </div>
                <div>
                  <Label>Link do Botão (opcional)</Label>
                  <Input
                    value={selectedNode.data.buttonUrl || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, buttonUrl: e.target.value },
                      })
                    }
                    placeholder="Ex: https://exemplo.com ou {{link}}"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Se preenchido, a mensagem será enviada com um botão clicável. Use {"{{link}}"} para link dinâmico do payload.
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
                {selectedNode.data.isProofBlock && (
                  <div className="pt-4 border-t mt-4 space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <TestTube className="h-4 w-4" />
                      Teste do Facebook Pixel
                    </h4>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Código de Teste do Gerenciador de Eventos</Label>
                      <Input
                        value={selectedNode.data.testEventCode || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, testEventCode: e.target.value },
                          })
                        }
                        placeholder="Ex: TEST12345"
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button
                      onClick={async () => {
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session) {
                            toast.error("Você precisa estar logado para testar o Pixel");
                            return;
                          }
                          toast.info("Enviando evento de teste...");
                          const { error } = await supabase.functions.invoke('webhook-zapi', {
                            body: {
                              test_event: true,
                              test_event_code: selectedNode.data.testEventCode || "TEST20723",
                              instanceId: "test-instance",
                              phone: "5511999999999",
                              moments: ["proof_of_payment"]
                            }
                          });
                          if (error) throw error;
                          toast.success("Evento de teste enviado com sucesso!");
                        } catch (error) {
                          console.error("Erro ao testar pixel:", error);
                          toast.error("Erro ao enviar evento de teste");
                        }
                      }}
                      className="w-full h-8 text-xs"
                      variant="outline"
                    >
                      Disparar Evento de Teste
                    </Button>
                  </div>
                )}
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
                  {selectedNode.data.actionType === "tag" ? (
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
                             setSelectedNode({
                               ...selectedNode,
                               data: { ...selectedNode.data, actionConfig: "" },
                             });
                           }
                         }}
                       >
                         <SelectTrigger className="flex-1">
                           <SelectValue placeholder={loadingTags ? "Carregando..." : "Selecione..."} />
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
                         <Label className="text-[11px]">Ou digite o nome:</Label>
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
                   </div>
                 ) : (
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
                 )}
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => selectedNode && handleDeleteNode(selectedNode.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveNode}>Salvar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
