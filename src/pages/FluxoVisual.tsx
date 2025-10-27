import { useState, useCallback, useRef, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { BlocoInicialNode } from "@/components/flow/BlocoInicialNode";
import { BlocoConteudoNode } from "@/components/flow/BlocoConteudoNode";
import { BlocoCondicaoNode } from "@/components/flow/BlocoCondicaoNode";
import { BlocoAcaoNode } from "@/components/flow/BlocoAcaoNode";

const nodeTypes: NodeTypes = {
  blocoInicial: BlocoInicialNode,
  blocoConteudo: BlocoConteudoNode,
  blocoCondicao: BlocoCondicaoNode,
  blocoAcao: BlocoAcaoNode,
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
];

export default function FluxoVisual() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [nomeFluxo, setNomeFluxo] = useState("Novo Fluxo");
  const [fluxosSalvos, setFluxosSalvos] = useState<any[]>([]);
  const [showFluxosList, setShowFluxosList] = useState(true);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Auto-salvar quando nodes ou edges mudarem
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      const timeoutId = setTimeout(() => {
        handleSaveFluxo();
      }, 2000); // Auto-salvar após 2 segundos de inatividade

      return () => clearTimeout(timeoutId);
    }
  }, [nodes, edges]);

  // Carregar lista de fluxos salvos ao iniciar
  useEffect(() => {
    const savedFluxos = localStorage.getItem("fluxos_salvos");
    if (savedFluxos) {
      try {
        setFluxosSalvos(JSON.parse(savedFluxos));
      } catch (error) {
        console.error("Erro ao carregar fluxos:", error);
      }
    }
  }, []);

  const handleNovoFluxo = () => {
    setNomeFluxo("Novo Fluxo");
    setNodes(initialNodes);
    setEdges(initialEdges);
    setShowFluxosList(false);
  };

  const handleCarregarFluxo = (fluxo: any) => {
    setNomeFluxo(fluxo.nome);
    setNodes(fluxo.nodes || initialNodes);
    setEdges(fluxo.edges || initialEdges);
    setShowFluxosList(false);
    toast.success(`Fluxo "${fluxo.nome}" carregado!`);
  };

  const handleDuplicarFluxo = (fluxo: any) => {
    const novoNome = `${fluxo.nome} (cópia)`;
    const novoFluxo = {
      ...fluxo,
      nome: novoNome,
      updatedAt: new Date().toISOString(),
    };
    
    const novosFluxos = [...fluxosSalvos, novoFluxo];
    localStorage.setItem("fluxos_salvos", JSON.stringify(novosFluxos));
    setFluxosSalvos(novosFluxos);
    toast.success("Fluxo duplicado com sucesso!");
  };

  const handleExcluirFluxo = (fluxoNome: string) => {
    const novosFluxos = fluxosSalvos.filter((f) => f.nome !== fluxoNome);
    localStorage.setItem("fluxos_salvos", JSON.stringify(novosFluxos));
    setFluxosSalvos(novosFluxos);
    toast.success("Fluxo excluído!");
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

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

      if (typeof type === "undefined" || !type || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${Date.now()}`,
        type,
        position,
        data: {
          label: `${type === "blocoConteudo" ? "Conteúdo" : type === "blocoCondicao" ? "Condição" : "Ação"}`,
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

  const handleSaveFluxo = () => {
    const fluxoData = {
      nome: nomeFluxo,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };

    // Salvar no localStorage
    localStorage.setItem("fluxo_atual", JSON.stringify(fluxoData));
    
    // Salvar lista de fluxos
    const fluxosSalvos = JSON.parse(localStorage.getItem("fluxos_salvos") || "[]");
    const fluxoIndex = fluxosSalvos.findIndex((f: any) => f.nome === nomeFluxo);
    
    if (fluxoIndex >= 0) {
      fluxosSalvos[fluxoIndex] = fluxoData;
    } else {
      fluxosSalvos.push(fluxoData);
    }
    
    localStorage.setItem("fluxos_salvos", JSON.stringify(fluxosSalvos));
    toast.success("Fluxo salvo com sucesso!");
  };

  const handleEnviarAgora = () => {
    if (nodes.length <= 1) {
      toast.error("Adicione blocos ao fluxo antes de enviar!");
      return;
    }

    // Validar se há conexões
    if (edges.length === 0) {
      toast.error("Conecte os blocos antes de enviar!");
      return;
    }

    // Salvar antes de enviar
    handleSaveFluxo();

    // Simular envio (aqui você implementaria a lógica real)
    toast.success("Fluxo enviado com sucesso! 🚀", {
      description: `${nodes.length} blocos e ${edges.length} conexões processadas`,
    });
  };

  if (showFluxosList) {
    return (
      <div className="flex h-screen w-full bg-background items-center justify-center p-8">
        <Card className="max-w-4xl w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Fluxos Visuais</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Crie e gerencie seus fluxos de automação
              </p>
            </div>
            <Button onClick={handleNovoFluxo}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fluxo
            </Button>
          </div>

          <ScrollArea className="h-[600px]">
            {fluxosSalvos.length === 0 ? (
              <div className="text-center py-12">
                <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhum fluxo salvo ainda
                </p>
                <Button onClick={handleNovoFluxo} variant="outline">
                  Criar Primeiro Fluxo
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {fluxosSalvos.map((fluxo, index) => (
                  <Card key={index} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{fluxo.nome}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Atualizado em {new Date(fluxo.updatedAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {fluxo.nodes?.length || 0} blocos
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {fluxo.edges?.length || 0} conexões
                      </span>
                    </div>

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
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExcluirFluxo(fluxo.nome)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Sidebar - Blocos Disponíveis */}
      <Card className="w-80 m-4 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowFluxosList(true)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold flex-1">Blocos</h2>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSaveFluxo} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
            <Button size="sm" onClick={handleEnviarAgora} className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <Label>Nome do Fluxo</Label>
          <Input
            value={nomeFluxo}
            onChange={(e) => setNomeFluxo(e.target.value)}
            placeholder="Digite o nome do fluxo"
          />
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-3">
            {blocosDisponiveis.map((bloco) => (
              <Card
                key={bloco.type}
                className="p-4 cursor-move hover:bg-accent transition-colors"
                draggable
                onDragStart={(e) => onDragStart(e, bloco.type)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <bloco.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{bloco.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {bloco.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Arraste os blocos para o canvas e conecte-os para criar seu fluxo
          </p>
        </div>
      </Card>

      {/* Canvas */}
      <div className="flex-1 m-4 ml-0" ref={reactFlowWrapper}>
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
          className="bg-background rounded-lg border"
        >
          <Background variant={BackgroundVariant.Dots} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
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
                    </SelectContent>
                  </Select>
                </div>

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
                    placeholder="Digite a mensagem..."
                    rows={5}
                  />
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Palavra-chave</SelectItem>
                      <SelectItem value="menu">Menu</SelectItem>
                      <SelectItem value="variable">Variável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Descrição da Condição</Label>
                  <Input
                    value={selectedNode.data.condition || ""}
                    onChange={(e) =>
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, condition: e.target.value },
                      })
                    }
                    placeholder="Ex: Se resposta contém 'sim'"
                  />
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
                      <SelectItem value="delay">Adicionar Delay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                    placeholder="Configure a ação..."
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveNode}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
