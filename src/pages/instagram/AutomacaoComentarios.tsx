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
  ChevronUp,
  ChevronDown,
  TableIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useInstagramAutomations } from "@/hooks/useInstagramAutomations";
import { IGGatilhoNode } from "@/components/flow/ig/IGGatilhoNode";
import { IGRespostaNode } from "@/components/flow/ig/IGRespostaNode";
import { IGDMNode } from "@/components/flow/ig/IGDMNode";
import { IGDelayNode } from "@/components/flow/ig/IGDelayNode";
import { supabase } from "@/integrations/supabase/client";

const nodeTypes: NodeTypes = {
  igGatilho: IGGatilhoNode,
  igResposta: IGRespostaNode,
  igDM: IGDMNode,
  igDelay: IGDelayNode,
};

const defaultNodes: Node[] = [
  {
    id: "1",
    type: "igGatilho",
    position: { x: 50, y: 200 },
    data: { label: "Gatilho", keywords: "" },
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
  { type: "igGatilho", label: "Gatilho", icon: MessageCircle, description: "Palavra-chave no comentário" },
  { type: "igResposta", label: "Resposta", icon: Reply, description: "Responder comentário publicamente" },
  { type: "igDM", label: "Enviar DM", icon: Send, description: "Mensagem direta com botões" },
  { type: "igDelay", label: "Espera", icon: Clock, description: "Aguardar antes do próximo passo" },
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
  const [flowName, setFlowName] = useState("Novo Fluxo");
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [buttonStats, setButtonStats] = useState<Record<string, number>>({});
  const [totalFlowRecipients, setTotalFlowRecipients] = useState(0);
  const [collectedLeads, setCollectedLeads] = useState<any[]>([]);
  const [showLeads, setShowLeads] = useState(false);

  // Fetch collected leads for this automation
  const fetchCollectedLeads = useCallback(async (automationId?: string) => {
    try {
      const { data } = await supabase
        .from("instagram_events")
        .select("*")
        .in("event_type", ["lead_whatsapp", "lead_email"])
        .order("created_at", { ascending: false })
        .limit(200);

      const allLeads = automationId
        ? (data || []).filter((l: any) => (l.payload as any)?.automation_id === automationId)
        : (data || []);

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
          return rest;
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
      const shortcode = (() => {
        const url = selectedNode.data.postUrl || "";
        const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
        return match ? match[1] : null;
      })();

      return (
        <div className="space-y-4">
          <div>
            <Label>Link do Post / Reel</Label>
            <Input
              value={selectedNode.data.postUrl || ""}
              onChange={(e) =>
                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, postUrl: e.target.value } })
              }
              placeholder="https://www.instagram.com/p/ABC123..."
            />
            <p className="text-xs text-muted-foreground mt-1">Cole o link do post que receberá os comentários</p>
          </div>

          {shortcode && (
            <div className="rounded overflow-hidden border border-border">
              <iframe
                src={`https://www.instagram.com/p/${shortcode}/embed/`}
                width="100%"
                height="400"
                frameBorder="0"
                scrolling="no"
                allowTransparency
                style={{ border: "none" }}
              />
            </div>
          )}

          <div>
            <Label>Palavras-chave (separadas por vírgula)</Label>
            <Input
              value={selectedNode.data.keywords || ""}
              onChange={(e) =>
                setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, keywords: e.target.value } })
              }
              placeholder="eu quero, me manda, info"
            />
            <p className="text-xs text-muted-foreground mt-1">Deixe vazio para disparar em qualquer comentário</p>
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

    return null;
  };

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/instagram/campanhas")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="h-8 w-48 text-sm font-medium"
          />
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-xs text-muted-foreground">{isActive ? "Ativo" : "Inativo"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Block toolbar */}
          {blocosDisponiveis.map((bloco) => {
            const Icon = bloco.icon;
            return (
              <div
                key={bloco.type}
                draggable
                onDragStart={(e) => onDragStart(e, bloco.type)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-md cursor-grab bg-card hover:bg-muted/50 transition-colors"
                title={bloco.description}
              >
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{bloco.label}</span>
              </div>
            );
          })}

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

          <Button onClick={handleSaveFlow} disabled={saving} size="sm" className="gap-1.5 ml-2">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1">
        <ReactFlow
          nodes={nodes.map(n => n.type === 'igDM' ? { ...n, data: { ...n.data, buttonStats, totalFlowRecipients } } : n)}
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
          <Controls className="!bg-card !border-border !shadow-md" />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
          <MiniMap
            className="!bg-card !border-border"
            nodeColor={() => "hsl(var(--primary))"}
            maskColor="hsl(var(--background) / 0.7)"
          />
        </ReactFlow>
      </div>

      {/* Leads Side Sheet */}
      <Sheet open={showLeads} onOpenChange={setShowLeads}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-[92vw] lg:w-[1100px] lg:max-w-[1100px] p-0">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-base">
              <TableIcon className="w-4 h-4" />
              Dados Coletados
              <Badge variant="secondary" className="text-xs">
                {collectedLeads.length}
              </Badge>
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-60px)] w-full">
            {collectedLeads.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm px-4">
                Nenhum dado coletado ainda. Quando os usuários enviarem WhatsApp ou Email via DM, aparecerão aqui.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] px-3 whitespace-nowrap">@ Post</TableHead>
                      <TableHead className="text-[11px] px-3 whitespace-nowrap">@ Comentário</TableHead>
                      <TableHead className="text-[11px] px-3 whitespace-nowrap">Tipo</TableHead>
                      <TableHead className="text-[11px] px-3 whitespace-nowrap">Dado Coletado</TableHead>
                      <TableHead className="text-[11px] px-3 whitespace-nowrap">Data</TableHead>
                      <TableHead className="text-[11px] px-3 whitespace-nowrap">Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectedLeads.map((lead: any) => {
                      const payload = lead.payload as any;
                      const isWa = lead.event_type === "lead_whatsapp";
                      const leadDate = new Date(lead.created_at);
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="text-xs px-3 py-2 whitespace-nowrap">
                            @{payload?.post_owner || "—"}
                          </TableCell>
                          <TableCell className="text-xs px-3 py-2 whitespace-nowrap">
                            @{lead.username || lead.ig_user_id || "—"}
                          </TableCell>
                          <TableCell className="px-3 py-2 whitespace-nowrap">
                            <Badge variant={isWa ? "default" : "secondary"} className="text-[10px] gap-1 whitespace-nowrap">
                              {isWa ? <Phone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                              {isWa ? "WhatsApp" : "Email"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs px-3 py-2 font-mono whitespace-nowrap">
                            {payload?.collected_value || lead.comment_text || "—"}
                          </TableCell>
                          <TableCell className="text-[11px] px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {leadDate.toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-[11px] px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {leadDate.toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Edit Node Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Editar: {selectedNode?.data.label}</span>
              {selectedNode && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                >
                  <Trash2 className="w-3 h-3" /> Excluir
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {renderEditPanel()}
          </ScrollArea>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNode}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}