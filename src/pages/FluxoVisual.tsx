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
  Upload,
  Key,
} from "lucide-react";
import { toast } from "sonner";
import { BlocoInicialNode } from "@/components/flow/BlocoInicialNode";
import { BlocoConteudoNode } from "@/components/flow/BlocoConteudoNode";
import { BlocoCondicaoNode } from "@/components/flow/BlocoCondicaoNode";
import { BlocoAcaoNode } from "@/components/flow/BlocoAcaoNode";
import { SelectContactsDialog } from "@/components/flow/SelectContactsDialog";
import { useZapi } from "@/hooks/useZapi";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

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
}

export default function FluxoVisual() {
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
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [showContactsDialog, setShowContactsDialog] = useState(false);
  const { sendMessage, sendImage, sendVideo, sendAudio, sendDocument, sendButtonActions } = useZapi();
  const [uploadingFile, setUploadingFile] = useState(false);

  // Carregar fluxos do Supabase
  const fetchFluxos = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('flow_automations')
        .select('*')
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
  }, []);

  const handleNovoFluxo = () => {
    setNomeFluxo("Novo Fluxo");
    setKeywordFluxo("");
    setFluxoAtivo(true);
    setCurrentFluxoId(null);
    setNodes(initialNodes);
    setEdges(initialEdges);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedNode) return;
    setUploadingFile(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

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

  const handleSaveFluxo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Faça login para salvar fluxos");
        return;
      }

      const fluxoData = {
        user_id: user.id,
        name: nomeFluxo,
        keyword: keywordFluxo.trim().toLowerCase(),
        nodes,
        edges,
        active: fluxoAtivo,
      };

      if (currentFluxoId) {
        // Update existing
        const { error } = await (supabase as any)
          .from('flow_automations')
          .update(fluxoData)
          .eq('id', currentFluxoId);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await (supabase as any)
          .from('flow_automations')
          .insert(fluxoData)
          .select()
          .single();

        if (error) throw error;
        setCurrentFluxoId(data.id);
      }

      toast.success("Fluxo salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar fluxo:", error);
      toast.error("Erro ao salvar fluxo");
    }
  };

  const handleEnviarAgora = () => {
    if (nodes.length <= 1) {
      toast.error("Adicione blocos ao fluxo antes de enviar!");
      return;
    }
    if (edges.length === 0) {
      toast.error("Conecte os blocos antes de enviar!");
      return;
    }
    handleSaveFluxo();
    setShowContactsDialog(true);
  };

  const handleConfirmSend = async (selectedContacts: string[]) => {
    toast.success(`Iniciando envio para ${selectedContacts.length} contato(s)...`);

    try {
      const initialNode = nodes.find(n => n.type === "blocoInicial");
      if (!initialNode) {
        toast.error("Bloco inicial não encontrado!");
        return;
      }

      for (const contact of selectedContacts) {
        const visitedNodes = new Set<string>();
        await processFlow(initialNode.id, contact, visitedNodes);
      }

      toast.success("Fluxo enviado com sucesso!", {
        description: `Mensagens enviadas para ${selectedContacts.length} contato(s)`,
      });
    } catch (error) {
      console.error("Erro ao enviar fluxo:", error);
      toast.error("Erro ao enviar fluxo. Verifique o console.");
    }
  };

  const processFlow = async (currentNodeId: string, contact: string, visitedNodes: Set<string>) => {
    if (visitedNodes.has(currentNodeId)) return;
    visitedNodes.add(currentNodeId);

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const outgoingEdges = edges
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
      const targetNode = nodes.find(n => n.id === edge.target);
      if (!targetNode) continue;

      if (targetNode.type === "blocoConteudo") {
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

        if (allSendButtons.length > 0) {
          if (contentType === "image" && mediaUrl) {
            await sendImage(contact, mediaUrl);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (contentType === "video" && mediaUrl) {
            await sendVideo(contact, mediaUrl);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (contentType === "audio" && mediaUrl) {
            await sendAudio(contact, mediaUrl);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (contentType === "document" && mediaUrl) {
            await sendDocument(contact, mediaUrl, "document", "pdf");
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          await sendButtonActions(
            contact,
            content || "Escolha uma opção:",
            allSendButtons.map((btn: any, idx: number) => {
              const type = (btn?.type || "reply").toString().toLowerCase();
              const value = (btn?.value || "").toString().trim();
              const label = (btn?.text || `Botão ${idx + 1}`).toString();

              if (type === "url") {
                const url = value.match(/^https?:\/\//i) ? value : `https://${value}`;
                return { id: String(idx + 1), type: "URL" as const, label, url };
              }

              if (type === "call") {
                return { id: String(idx + 1), type: "CALL" as const, label, phone: value };
              }

              return { id: String(idx + 1), type: "REPLY" as const, label };
            })
          );
        } else {
          switch (contentType) {
            case "text":
              if (!content) continue;
              await sendMessage(contact, content);
              break;
            case "image":
              if (!mediaUrl) continue;
              await sendImage(contact, mediaUrl, content);
              break;
            case "video":
              if (!mediaUrl) continue;
              await sendVideo(contact, mediaUrl, content);
              break;
            case "audio":
              if (!mediaUrl) continue;
              await sendAudio(contact, mediaUrl, content);
              break;
            case "document":
              if (!mediaUrl) continue;
              await sendDocument(contact, mediaUrl, "document", "pdf", content);
              break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));

        const hasButtonEdges = buttons.some((_: any, idx: number) =>
          edges.some((e) => e.source === targetNode.id && e.sourceHandle === `button-${idx}`)
        );

        if (hasButtonEdges) {
          continue;
        }
      }

      await processFlow(targetNode.id, contact, visitedNodes);
    }
  };

  if (showFluxosList) {
    return (
      <div className="flex h-screen w-full bg-background items-center justify-center p-8">
        <Card className="max-w-4xl w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Fluxos Visuais</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Crie fluxos automáticos disparados por palavra-chave
              </p>
            </div>
            <Button onClick={handleNovoFluxo}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fluxo
            </Button>
          </div>

          <ScrollArea className="h-[600px]">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Carregando fluxos...</p>
              </div>
            ) : fluxosSalvos.length === 0 ? (
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
                {fluxosSalvos.map((fluxo) => (
                  <Card key={fluxo.id} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{fluxo.name}</h3>
                          <Badge variant={fluxo.active ? "default" : "secondary"}>
                            {fluxo.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        {fluxo.keyword && (
                          <div className="flex items-center gap-1 mt-1">
                            <Key className="h-3 w-3 text-primary" />
                            <span className="text-xs text-primary font-mono">
                              {fluxo.keyword}
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Atualizado em {new Date(fluxo.updated_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Switch
                        checked={fluxo.active}
                        onCheckedChange={() => handleToggleActive(fluxo)}
                      />
                    </div>

                    <div className="flex gap-2 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {(fluxo.nodes as any[])?.length || 0} blocos
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {(fluxo.edges as any[])?.length || 0} conexões
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
                        variant="destructive"
                        onClick={() => handleExcluirFluxo(fluxo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
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
    <>
      <div className="flex h-screen w-full bg-background">
        {/* Sidebar */}
        <Card className="w-64 m-2 p-3 flex flex-col shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="ghost" onClick={() => setShowFluxosList(true)}>
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

          <div className="mb-3">
            <Label>Nome do Fluxo</Label>
            <Input
              value={nomeFluxo}
              onChange={(e) => setNomeFluxo(e.target.value)}
              placeholder="Digite o nome do fluxo"
            />
          </div>

          <div className="mb-3">
            <Label className="flex items-center gap-1">
              <Key className="h-3 w-3" />
              Palavra-chave (gatilho)
            </Label>
            <Input
              value={keywordFluxo}
              onChange={(e) => setKeywordFluxo(e.target.value)}
              placeholder="Ex: oi, menu, preco"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Quando alguém enviar essa palavra, o fluxo será disparado automaticamente
            </p>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <Label>Fluxo Ativo</Label>
            <Switch checked={fluxoAtivo} onCheckedChange={setFluxoAtivo} />
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

          <div className="mt-4 pt-4 border-t space-y-1.5">
            <p className="text-xs text-muted-foreground">
              📌 Arraste blocos para o canvas
            </p>
            <p className="text-xs text-muted-foreground">
              🔗 Clique numa conexão para removê-la
            </p>
            <p className="text-xs text-muted-foreground">
              ⌫ Selecione e pressione Delete para excluir
            </p>
          </div>
        </Card>

        {/* Canvas */}
        <div className="flex-1 m-2 ml-0" ref={reactFlowWrapper}>
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
      </div>

      {/* Dialog de Seleção de Contatos */}
      <SelectContactsDialog
        open={showContactsDialog}
        onOpenChange={setShowContactsDialog}
        onConfirm={handleConfirmSend}
      />

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

                {(selectedNode.data.contentType === "image" ||
                  selectedNode.data.contentType === "video" ||
                  selectedNode.data.contentType === "audio" ||
                  selectedNode.data.contentType === "document") && (
                  <>
                    <div>
                      <Label>
                        URL da {selectedNode.data.contentType === "image" ? "Imagem" :
                                selectedNode.data.contentType === "video" ? "Vídeo" :
                                selectedNode.data.contentType === "audio" ? "Áudio" : "Documento"}
                      </Label>
                      <Input
                        value={selectedNode.data.mediaUrl || ""}
                        onChange={(e) =>
                          setSelectedNode({
                            ...selectedNode,
                            data: { ...selectedNode.data, mediaUrl: e.target.value },
                          })
                        }
                        placeholder={`https://exemplo.com/${selectedNode.data.contentType === "image" ? "imagem.jpg" :
                                      selectedNode.data.contentType === "video" ? "video.mp4" :
                                      selectedNode.data.contentType === "audio" ? "audio.mp3" : "documento.pdf"}`}
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
                            accept={
                              selectedNode.data.contentType === "image" ? "image/*" :
                              selectedNode.data.contentType === "video" ? "video/*" :
                              selectedNode.data.contentType === "audio" ? "audio/*" :
                              selectedNode.data.contentType === "document" ? ".pdf,.doc,.docx" : "*"
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </>
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
                          <SelectItem value="url">🔗 Link (URL)</SelectItem>
                          <SelectItem value="reply">💬 Resposta rápida</SelectItem>
                          <SelectItem value="call">📞 Ligação</SelectItem>
                          <SelectItem value="flow">➡️ Navegar para bloco</SelectItem>
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
    </>
  );
}
