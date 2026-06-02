import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ReactFlow, {
  Background, BackgroundVariant, Controls, Handle, MarkerType,
  Position, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type Node, type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus, MessageSquare, Clock, Image as ImageIcon, Video, FileText,
  Upload, Loader2, X, Zap, Calendar as CalendarIcon, Repeat,
  Hash, ArrowLeft, Save, Play,
} from "lucide-react";
import { toast } from "sonner";

type TriggerType = "manual" | "scheduled" | "recurring" | "keyword";
type CanvasNodeType = "message" | "delay";
type ContentType = "text" | "photo" | "video" | "document";
type Btn = { text: string; url: string };

type MessageData = {
  content_type: ContentType;
  text?: string;
  media_url?: string | null;
  buttons?: Btn[];
};
type DelayData = { seconds: number };
type FlowNode =
  | { id: string; type: "message"; data: MessageData }
  | { id: string; type: "delay"; data: DelayData };

const intervalPresets = [
  { label: "A cada 30 minutos", minutes: 30 },
  { label: "A cada 1 hora", minutes: 60 },
  { label: "A cada 3 horas", minutes: 180 },
  { label: "A cada 6 horas", minutes: 360 },
  { label: "A cada 12 horas", minutes: 720 },
  { label: "1x por dia", minutes: 1440 },
];

function newId() { return `n_${Math.random().toString(36).slice(2, 10)}`; }

const TRIGGER_ID = "trigger";

/* ---------------- ReactFlow node components ---------------- */

function nodeShell(
  selected: boolean,
  iconBg: string,
  iconColor: string,
  icon: React.ReactNode,
  title: string,
  subtitle: string,
  body: React.ReactNode,
  showTarget = true,
  showSource = true,
  onRemove?: () => void,
) {
  return (
    <div className={`group relative w-[260px] overflow-hidden rounded-2xl border bg-card shadow-[0_10px_28px_-18px_hsl(var(--foreground)/0.55)] transition ${selected ? "border-primary ring-2 ring-primary/25" : "border-border/70"}`}>
      {showTarget && (
        <Handle type="target" position={Position.Left}
          className="!w-3 !h-3 !bg-primary !border-2 !border-background" style={{ left: -6 }} />
      )}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>{icon}</div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-none text-card-foreground truncate">{title}</div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</div>
          </div>
        </div>
        {onRemove && (
          <button type="button" onMouseDown={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-destructive transition">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="px-3 py-2 text-[12px] text-muted-foreground">{body}</div>
      {showSource && (
        <Handle type="source" position={Position.Right}
          className="!w-3 !h-3 !bg-primary !border-2 !border-background" style={{ right: -6 }} />
      )}
    </div>
  );
}

function TriggerNode({ data, selected }: any) {
  const t: TriggerType = data?.trigger_type || "manual";
  const labels: Record<TriggerType, string> = {
    manual: "Disparo manual",
    scheduled: "Agendado",
    recurring: "Recorrente",
    keyword: "Palavra-chave",
  };
  let detail = "Clique para configurar";
  if (t === "scheduled" && data?.trigger_config?.scheduled_at)
    detail = new Date(data.trigger_config.scheduled_at).toLocaleString();
  if (t === "recurring" && data?.trigger_config?.interval_minutes)
    detail = `A cada ${data.trigger_config.interval_minutes} min`;
  if (t === "keyword")
    detail = (data?.trigger_config?.keywords || []).slice(0, 3).join(", ") || "Defina palavras";
  return nodeShell(
    selected, "bg-primary/10", "text-primary",
    <Play className="h-4 w-4" />, "Iniciar", labels[t],
    <div className="line-clamp-2">{detail}</div>,
    false, true,
  );
}

function MessageContentPreview({ message, compact = false }: { message: MessageData; compact?: boolean }) {
  const d = message || { content_type: "text", buttons: [] };
  const buttons = d.buttons || [];
  const mediaHeight = compact ? "h-28" : "max-h-64";

  return (
    <div className="space-y-2">
      {d.content_type === "photo" && d.media_url && (
        <img src={d.media_url} alt="Prévia da foto" className={`w-full ${mediaHeight} object-contain rounded-md border border-border/60 bg-muted/30`} />
      )}
      {d.content_type === "video" && d.media_url && (
        <video src={d.media_url} className={`w-full ${mediaHeight} rounded-md border border-border/60 bg-muted`} controls={!compact} muted={compact} />
      )}
      {d.content_type === "document" && d.media_url && (
        <a
          href={d.media_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 text-foreground hover:bg-muted/60"
        >
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-[11px] truncate">{d.media_url.split("/").pop() || "documento"}</span>
        </a>
      )}
      {d.content_type !== "text" && !d.media_url && (
        <div className="flex items-center justify-center h-20 rounded-md border border-dashed border-border/60 text-[11px] text-muted-foreground">
          Sem mídia
        </div>
      )}
      {d.text ? (
        <div className={`text-[12px] text-foreground whitespace-pre-wrap ${compact ? "line-clamp-4" : ""}`}>{d.text}</div>
      ) : d.content_type === "text" ? (
        <div className="text-[12px] italic text-muted-foreground">(conteúdo vazio)</div>
      ) : null}
      {buttons.length > 0 && (
        <div className="space-y-1 pt-1">
          {buttons.slice(0, compact ? 3 : buttons.length).map((b, i) => (
            <div key={i} className="text-[11px] text-center rounded border border-border/60 bg-background px-2 py-1 text-foreground truncate">
              {b.text || "(botão sem texto)"}
            </div>
          ))}
          {compact && buttons.length > 3 && (
            <div className="text-[10px] text-center text-muted-foreground">+{buttons.length - 3} botão(ões)</div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageNode({ id, data, selected }: any) {
  const d: MessageData = data?.message || { content_type: "text", buttons: [] };
  const ct = d.content_type;
  const subtitle = ct === "text" ? "Texto"
    : ct === "photo" ? "Foto"
    : ct === "video" ? "Vídeo" : "Documento";

  return nodeShell(
    selected, "bg-blue-500/10", "text-blue-500",
    <MessageSquare className="h-4 w-4" />, "Mensagem",
    subtitle, <MessageContentPreview message={d} compact />, true, true,
    () => data?._remove?.(id),
  );
}

function DelayNode({ id, data, selected }: any) {
  const s = data?.delay?.seconds ?? 60;
  return nodeShell(
    selected, "bg-amber-500/10", "text-amber-500",
    <Clock className="h-4 w-4" />, "Esperar", `${s} segundos`,
    <div>Aguarda antes do próximo passo</div>,
    true, true,
    () => data?._remove?.(id),
  );
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  delay: DelayNode,
};

/* ---------------- Editor ---------------- */

function EditorInner() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === "novo";
  const queryBotId = searchParams.get("botId") || "";

  const [botId, setBotId] = useState<string>(queryBotId);
  const [name, setName] = useState("Novo fluxo");
  const [isActive, setIsActive] = useState(true);
  const [triggerType, setTriggerType] = useState<TriggerType>("manual");
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const connectFromRef = useRef<string | null>(null);
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const [connectMenu, setConnectMenu] = useState<
    { screenX: number; screenY: number; flowX: number; flowY: number; sourceId: string } | null
  >(null);

  const flowId = useRef<string>("");

  const removeNode = useCallback((nid: string) => {
    if (nid === TRIGGER_ID) return;
    setNodes((nds) => nds.filter((n) => n.id !== nid));
    setEdges((eds) => eds.filter((e) => e.source !== nid && e.target !== nid));
    setSelectedId((s) => (s === nid ? null : s));
  }, [setNodes, setEdges]);

  // Inject _remove into every node's data so the card can self-delete
  const decoratedNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, _remove: removeNode } })),
    [nodes, removeNode],
  );

  useEffect(() => {
    (async () => {
      if (isNew) {
        const trig: Node = {
          id: TRIGGER_ID, type: "trigger", position: { x: 60, y: 160 },
          data: { trigger_type: "manual", trigger_config: {} },
        };
        const msg: Node = {
          id: newId(), type: "message", position: { x: 380, y: 140 },
          data: { message: { content_type: "text", text: "", buttons: [] } },
        };
        setNodes([trig, msg]);
        setEdges([{
          id: `e_${trig.id}_${msg.id}`, source: trig.id, target: msg.id, animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
        }]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("telegram_group_flows" as any)
        .select("*").eq("id", id!).maybeSingle();
      const row = data as any;
      if (!row) { toast.error("Fluxo não encontrado"); navigate(-1); return; }
      flowId.current = row.id;
      setBotId(row.bot_id);
      setName(row.name);
      setIsActive(row.is_active);
      setTriggerType(row.trigger_type);
      setTriggerConfig(row.trigger_config || {});

      const stored = (row.nodes || []) as FlowNode[];
      const storedEdges = (row.edges || []) as Array<{ source: string; target: string }>;
      const trig: Node = {
        id: TRIGGER_ID, type: "trigger", position: { x: 60, y: 160 },
        data: { trigger_type: row.trigger_type, trigger_config: row.trigger_config || {} },
      };
      const start = row.start_node_id as string | null;
      const rfNodes: Node[] = [trig];
      stored.forEach((n, i) => {
        rfNodes.push({
          id: n.id, type: n.type,
          position: { x: 380 + i * 320, y: 140 + (i % 2) * 40 },
          data: n.type === "message" ? { message: n.data } : { delay: n.data },
        });
      });
      const rfEdges: Edge[] = [];
      if (start && stored.find((n) => n.id === start)) {
        rfEdges.push({
          id: `e_${TRIGGER_ID}_${start}`, source: TRIGGER_ID, target: start, animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
      storedEdges.forEach((e) => rfEdges.push({
        id: `e_${e.source}_${e.target}`, source: e.source, target: e.target, animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
      }));
      setNodes(rfNodes);
      setEdges(rfEdges);
      setLoading(false);
    })();
  }, [id]);

  // keep trigger node card in sync with sidebar config
  useEffect(() => {
    setNodes((nds) => nds.map((n) =>
      n.id === TRIGGER_ID ? { ...n, data: { ...n.data, trigger_type: triggerType, trigger_config: triggerConfig } } : n,
    ));
  }, [triggerType, triggerConfig, setNodes]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    setEdges((eds) => addEdge({
      ...c, animated: true, markerEnd: { type: MarkerType.ArrowClosed },
    }, eds));
  }, [setEdges]);

  const onConnectStart = useCallback((_: any, params: { nodeId: string | null; handleType: string | null }) => {
    connectFromRef.current = params.handleType === "source" ? params.nodeId : null;
  }, []);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const sourceId = connectFromRef.current;
    connectFromRef.current = null;
    if (!sourceId) return;
    const target = (event as any).target as HTMLElement | null;
    const droppedOnPane = !!target?.classList?.contains("react-flow__pane");
    if (!droppedOnPane) return;
    const clientX = "clientX" in event ? (event as MouseEvent).clientX : (event as TouchEvent).changedTouches[0].clientX;
    const clientY = "clientY" in event ? (event as MouseEvent).clientY : (event as TouchEvent).changedTouches[0].clientY;
    const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
    const rect = flowWrapperRef.current?.getBoundingClientRect();
    setConnectMenu({
      screenX: clientX - (rect?.left ?? 0),
      screenY: clientY - (rect?.top ?? 0),
      flowX: flowPos.x,
      flowY: flowPos.y,
      sourceId,
    });
  }, [screenToFlowPosition]);

  function createNodeFromMenu(type: CanvasNodeType) {
    if (!connectMenu) return;
    const nid = newId();
    const newNode: Node = {
      id: nid, type,
      position: { x: connectMenu.flowX, y: connectMenu.flowY },
      data: type === "message"
        ? { message: { content_type: "text", text: "", buttons: [] } }
        : { delay: { seconds: 60 } },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => addEdge({
      source: connectMenu.sourceId, target: nid, sourceHandle: null, targetHandle: null,
      animated: true, markerEnd: { type: MarkerType.ArrowClosed },
    }, eds));
    setSelectedId(nid);
    setConnectMenu(null);
  }

  function addNodeAt(type: CanvasNodeType) {
    const nid = newId();
    const base = nodes[nodes.length - 1];
    const pos = base
      ? { x: base.position.x + 320, y: base.position.y }
      : { x: 380, y: 160 };
    const newNode: Node = {
      id: nid, type, position: pos,
      data: type === "message"
        ? { message: { content_type: "text", text: "", buttons: [] } }
        : { delay: { seconds: 60 } },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedId(nid);
  }

  function updateNodeData(nid: string, patcher: (d: any) => any) {
    setNodes((nds) => nds.map((n) => (n.id === nid ? { ...n, data: patcher(n.data) } : n)));
  }

  const selectedNode = decoratedNodes.find((n) => n.id === selectedId) || null;

  async function save() {
    if (!botId) return toast.error("Bot não informado");
    if (!name.trim()) return toast.error("Dê um nome ao fluxo");

    // Validate trigger config
    if (triggerType === "keyword") {
      const kws: string[] = triggerConfig?.keywords || [];
      if (kws.filter((x) => String(x || "").trim()).length === 0)
        return toast.error("Adicione ao menos uma palavra-chave");
    }
    if (triggerType === "scheduled" && !triggerConfig?.scheduled_at)
      return toast.error("Defina a data/hora do agendamento");
    if (triggerType === "recurring" && !Number(triggerConfig?.interval_minutes))
      return toast.error("Defina o intervalo de repetição");

    // Traverse from trigger following edges to build linear sequence
    const adj = new Map<string, string[]>();
    edges.forEach((e) => {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    });
    const firstChildren = adj.get(TRIGGER_ID) || [];
    if (firstChildren.length === 0) return toast.error("Conecte o gatilho a um passo");
    const ordered: string[] = [];
    const seen = new Set<string>([TRIGGER_ID]);
    let cur: string | undefined = firstChildren[0];
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      ordered.push(cur);
      const nxt = adj.get(cur) || [];
      cur = nxt[0];
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const flowNodes: FlowNode[] = ordered.map((nid) => {
      const n = nodeMap.get(nid)!;
      if (n.type === "message") return { id: nid, type: "message", data: n.data.message };
      return { id: nid, type: "delay", data: n.data.delay };
    });

    if (flowNodes.length === 0) return toast.error("Adicione ao menos um passo");
    for (const n of flowNodes) {
      if (n.type === "message") {
        if (n.data.content_type === "text" && !String(n.data.text || "").trim())
          return toast.error("Há uma mensagem de texto vazia");
        if (n.data.content_type !== "text" && !n.data.media_url)
          return toast.error("Há uma mensagem de mídia sem arquivo");
      }
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirada"); }

    const persistedEdges: Array<{ source: string; target: string }> = [];
    for (let i = 0; i < flowNodes.length - 1; i++) {
      persistedEdges.push({ source: flowNodes[i].id, target: flowNodes[i + 1].id });
    }
    const start_node_id = flowNodes[0].id;

    const trigger_config = (() => {
      if (triggerType === "scheduled") return { scheduled_at: triggerConfig?.scheduled_at };
      if (triggerType === "recurring") return { interval_minutes: Number(triggerConfig?.interval_minutes) };
      if (triggerType === "keyword")
        return {
          keywords: (triggerConfig?.keywords || []).filter((k: string) => k.trim()),
          match_mode: triggerConfig?.match_mode || "contains",
        };
      return {};
    })();
    const next_run_at = triggerType === "scheduled" ? trigger_config.scheduled_at
      : triggerType === "recurring"
        ? new Date(Date.now() + ((trigger_config as any).interval_minutes || 60) * 60_000).toISOString()
        : null;

    const row = {
      user_id: user.id, bot_id: botId, name: name.trim(),
      trigger_type: triggerType, trigger_config, nodes: flowNodes, edges: persistedEdges,
      start_node_id, is_active: isActive, next_run_at,
    };
    const q = flowId.current
      ? supabase.from("telegram_group_flows" as any).update(row).eq("id", flowId.current)
      : supabase.from("telegram_group_flows" as any).insert(row);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(`Erro: ${error.message}`);
    toast.success("Fluxo salvo!");
    navigate("/telegram/canal-free");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 bg-card">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/telegram/canal-free")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Input
            className="max-w-sm h-8 font-semibold"
            value={name} onChange={(e) => setName(e.target.value)}
          />
          <div className="flex items-center gap-2 ml-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="text-xs text-muted-foreground">{isActive ? "Ativo" : "Inativo"}</Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => addNodeAt("message")}>
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Mensagem
          </Button>
          <Button size="sm" variant="outline" onClick={() => addNodeAt("delay")}>
            <Clock className="w-3.5 h-3.5 mr-1" /> Esperar
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative bg-muted/30" ref={flowWrapperRef}>
        <ReactFlow
          nodes={decoratedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => { setSelectedId(null); setConnectMenu(null); }}
          nodeTypes={nodeTypes}
          fitView
          defaultEdgeOptions={{ animated: true, markerEnd: { type: MarkerType.ArrowClosed } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls position="bottom-left" />
        </ReactFlow>
        {connectMenu && (
          <div
            className="absolute z-50 w-48 rounded-xl border border-border/70 bg-popover shadow-xl p-1.5"
            style={{ left: connectMenu.screenX, top: connectMenu.screenY }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Adicionar bloco
            </div>
            <button
              type="button"
              onClick={() => createNodeFromMenu("message")}
              className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted/70 transition"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-3.5 w-3.5" />
              </span>
              Mensagem
            </button>
            <button
              type="button"
              onClick={() => createNodeFromMenu("delay")}
              className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted/70 transition"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
              </span>
              Esperar (delay)
            </button>
          </div>
        )}
      </div>

      {/* Right-side properties */}
      <Sheet open={!!selectedNode} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-[420px] sm:max-w-md overflow-y-auto">
          {selectedNode?.type === "trigger" && (
            <>
              <SheetHeader>
                <SheetTitle>Configurar gatilho</SheetTitle>
                <SheetDescription>Quando este fluxo deve disparar?</SheetDescription>
              </SheetHeader>
              <div className="pt-4">
                <TriggerConfigForm
                  triggerType={triggerType}
                  triggerConfig={triggerConfig}
                  onTypeChange={(t) => { setTriggerType(t); setTriggerConfig({}); }}
                  onConfigChange={setTriggerConfig}
                />
              </div>
            </>
          )}
          {selectedNode?.type === "message" && (
            <>
              <SheetHeader>
                <SheetTitle>Mensagem</SheetTitle>
                <SheetDescription>Conteúdo enviado para o grupo</SheetDescription>
              </SheetHeader>
              <div className="pt-4">
                <MessageNodeEditor
                  data={selectedNode.data.message}
                  onChange={(d) => updateNodeData(selectedNode.id, (cur) => ({ ...cur, message: d }))}
                />
              </div>
            </>
          )}
          {selectedNode?.type === "delay" && (
            <>
              <SheetHeader>
                <SheetTitle>Esperar</SheetTitle>
                <SheetDescription>Quanto tempo aguardar antes do próximo passo</SheetDescription>
              </SheetHeader>
              <div className="pt-4 flex items-center gap-2">
                <Input
                  type="number" min={1} className="w-32"
                  value={selectedNode.data.delay?.seconds ?? 60}
                  onChange={(e) => updateNodeData(selectedNode.id, (cur) => ({
                    ...cur, delay: { seconds: Math.max(1, Number(e.target.value) || 1) },
                  }))}
                />
                <span className="text-sm text-muted-foreground">segundos</span>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function TelegramCanalFreeFluxoEditor() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}

/* ---------------- Right-panel forms ---------------- */

function TriggerConfigForm({
  triggerType, triggerConfig, onTypeChange, onConfigChange,
}: {
  triggerType: TriggerType;
  triggerConfig: any;
  onTypeChange: (t: TriggerType) => void;
  onConfigChange: (c: any) => void;
}) {
  return (
    <Tabs value={triggerType} onValueChange={(v) => onTypeChange(v as TriggerType)}>
      <TabsList className="grid w-full grid-cols-4 h-9">
        <TabsTrigger value="manual" className="text-xs"><Zap className="w-3 h-3 mr-1" /> Manual</TabsTrigger>
        <TabsTrigger value="scheduled" className="text-xs"><CalendarIcon className="w-3 h-3 mr-1" /> Agendado</TabsTrigger>
        <TabsTrigger value="recurring" className="text-xs"><Repeat className="w-3 h-3 mr-1" /> Recorrente</TabsTrigger>
        <TabsTrigger value="keyword" className="text-xs"><Hash className="w-3 h-3 mr-1" /> Palavra</TabsTrigger>
      </TabsList>
      <TabsContent value="manual" className="pt-3 text-sm text-muted-foreground">
        O fluxo só dispara quando você clicar em "Disparar agora".
      </TabsContent>
      <TabsContent value="scheduled" className="pt-3 space-y-2">
        <Label>Data e hora</Label>
        <Input
          type="datetime-local"
          value={(() => {
            if (!triggerConfig?.scheduled_at) return "";
            const d = new Date(triggerConfig.scheduled_at);
            const off = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - off).toISOString().slice(0, 16);
          })()}
          onChange={(e) => onConfigChange({
            ...triggerConfig,
            scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null,
          })}
        />
      </TabsContent>
      <TabsContent value="recurring" className="pt-3 space-y-2">
        <Label>Intervalo</Label>
        <Select
          value={String(triggerConfig?.interval_minutes || "")}
          onValueChange={(v) => onConfigChange({ ...triggerConfig, interval_minutes: Number(v) })}
        >
          <SelectTrigger><SelectValue placeholder="Escolha o intervalo..." /></SelectTrigger>
          <SelectContent>
            {intervalPresets.map((p) => (
              <SelectItem key={p.minutes} value={String(p.minutes)}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TabsContent>
      <TabsContent value="keyword" className="pt-3 space-y-2">
        <Label>Palavras-chave (uma por linha)</Label>
        <Textarea
          rows={3}
          placeholder={"oferta\npromo\nquero saber mais"}
          value={(triggerConfig?.keywords || []).join("\n")}
          onChange={(e) => onConfigChange({
            ...triggerConfig,
            keywords: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
          })}
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs">Modo:</Label>
          <Select
            value={triggerConfig?.match_mode || "contains"}
            onValueChange={(v) => onConfigChange({ ...triggerConfig, match_mode: v })}
          >
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">Contém</SelectItem>
              <SelectItem value="exact">Exato</SelectItem>
              <SelectItem value="startswith">Começa com</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Quando alguém enviar uma dessas palavras no grupo, o fluxo dispara.
        </p>
      </TabsContent>
    </Tabs>
  );
}

function MessageNodeEditor({
  data, onChange,
}: {
  data: MessageData;
  onChange: (d: MessageData) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const d = data || { content_type: "text", buttons: [] };

  function setData(p: Partial<typeof d>) {
    onChange({ ...d, ...p });
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/group-flows/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("flow-media").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("flow-media").getPublicUrl(path);
      setData({ media_url: data.publicUrl });
      toast.success("Arquivo enviado");
    } catch (e: any) {
      toast.error(`Falha no upload: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Tabs value={d.content_type} onValueChange={(v) => setData({ content_type: v as ContentType, media_url: null })}>
        <TabsList className="grid w-full grid-cols-4 h-8">
          <TabsTrigger value="text" className="text-xs"><MessageSquare className="w-3 h-3 mr-1" /> Texto</TabsTrigger>
          <TabsTrigger value="photo" className="text-xs"><ImageIcon className="w-3 h-3 mr-1" /> Foto</TabsTrigger>
          <TabsTrigger value="video" className="text-xs"><Video className="w-3 h-3 mr-1" /> Vídeo</TabsTrigger>
          <TabsTrigger value="document" className="text-xs"><FileText className="w-3 h-3 mr-1" /> Doc</TabsTrigger>
        </TabsList>
      </Tabs>

      {d.content_type !== "text" && (
        <div className="space-y-1">
          {d.media_url ? (
            <div className="relative rounded-md border border-border/60 overflow-hidden bg-muted/30">
              {d.content_type === "photo" && (
                <img src={d.media_url} alt="" className="w-full max-h-56 object-contain bg-black/5" />
              )}
              {d.content_type === "video" && (
                <video src={d.media_url} className="w-full max-h-56 bg-black" controls />
              )}
              {d.content_type === "document" && (
                <a
                  href={d.media_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1">{d.media_url.split("/").pop() || "documento"}</span>
                </a>
              )}
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-1.5 right-1.5 h-6 w-6 shadow"
                onClick={() => setData({ media_url: null })}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              Enviar arquivo
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={d.content_type === "photo" ? "image/*" : d.content_type === "video" ? "video/*" : "*"}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.currentTarget.value = ""; }}
          />
        </div>
      )}

      <Textarea
        rows={3}
        placeholder={d.content_type === "text" ? "Mensagem (HTML permitido)..." : "Legenda (opcional)..."}
        value={d.text || ""}
        onChange={(e) => setData({ text: e.target.value })}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Botões (URL)</Label>
          <Button size="sm" variant="ghost" onClick={() => setData({ buttons: [...(d.buttons || []), { text: "", url: "" }] })}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        {(d.buttons || []).map((b, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="Texto"
              value={b.text}
              onChange={(e) => {
                const nb = [...(d.buttons || [])];
                nb[i] = { ...nb[i], text: e.target.value };
                setData({ buttons: nb });
              }}
            />
            <Input
              placeholder="https://..."
              value={b.url}
              onChange={(e) => {
                const nb = [...(d.buttons || [])];
                nb[i] = { ...nb[i], url: e.target.value };
                setData({ buttons: nb });
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => {
              setData({ buttons: (d.buttons || []).filter((_, j) => j !== i) });
            }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}