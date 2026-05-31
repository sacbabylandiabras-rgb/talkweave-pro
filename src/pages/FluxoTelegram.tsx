import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  Handle,
  MarkerType,
  Node,
  NodeTypes,
  Position,
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  PlayCircle,
  Plus,
  Save,
  Trash2,
  ArrowLeft,
  Key,
  MessageSquare,
  Image as ImageIcon,
  Video,
  FileText,
  Mic,
  Zap,
  Clock,
  GitBranch,
  CheckCircle,
  MousePointerClick,
  X,
  Send,
  Activity,
  Workflow,
  CreditCard,
  Users,
  FolderOpen,
  Copy,
  Type,
} from "lucide-react";

/* ----------------------------- Types ----------------------------- */
interface TelegramBot {
  id: string;
  username: string;
  first_name: string;
}

interface FluxoTelegramItem {
  id: string;
  name: string;
  active: boolean;
  bot_id: string | null;
  nodes: any[];
  edges: any[];
  updated_at: string;
}

/* --------------------------- Custom nodes -------------------------- */

function IniciarNode({ data }: any) {
  return (
    <div className="relative rounded-[28px] bg-card shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] w-[640px] overflow-hidden px-10 pt-9 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <PlayCircle className="h-9 w-9 text-primary" strokeWidth={1.75} />
        <div className="text-[36px] font-semibold text-foreground tracking-tight leading-none">
          Iniciar
        </div>
      </div>
      {/* Body */}
      <p className="text-[26px] text-muted-foreground/80 leading-snug mb-8 font-light">
        O gatilho é responsável por acionar a automação
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data?.onAddTrigger?.();
        }}
        className="w-full inline-flex items-center justify-center gap-3 text-[28px] font-light py-8 rounded-2xl border-2 border-dashed border-border/70 text-foreground/70 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition"
      >
        Novo gatilho <Plus className="h-7 w-7" strokeWidth={1.75} />
      </button>
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data?.onAddTrigger?.();
          }}
          className="text-[20px] font-medium text-primary hover:underline"
        >
          Primeiro gatilho
        </button>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-background !border-2 !border-muted-foreground/40"
      />
    </div>
  );
}

function StepNode({ data, selected }: any) {
  const Icon = data.icon || MessageSquare;
  return (
    <div
      className={`relative px-4 py-3 rounded-xl border bg-card shadow-md min-w-[220px] transition ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      {data.badge && (
        <span className="absolute -top-2.5 left-3 px-2 py-0.5 text-[10px] font-semibold tracking-wide rounded-md bg-primary text-primary-foreground">
          {data.badge}
        </span>
      )}
      <div className="flex items-start gap-2">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{data.label}</div>
          {data.summary && (
            <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">
              {data.summary}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
}

function IntervaloNode({ id, data, selected }: any) {
  return _IntervaloNodeImpl({ id, data, selected });
}
function MensagemNode({ id, data, selected }: any) {
  const { setNodes, setEdges, getNode } = useReactFlow();
  const variant = data?.contentVariant || "texto";
  const preview =
    variant === "midia"
      ? data?.mediaUrl || "Mídia sem URL"
      : variant === "atraso"
      ? `Aguardar ${data?.delaySeconds ?? 10}`
      : data?.message || "Mensagem de texto";
  const duplicate = () => {
    const src = getNode(id);
    if (!src) return;
    const newId = `n_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
    setNodes((nds) => [
      ...nds,
      {
        ...src,
        id: newId,
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        selected: false,
        data: { ...src.data },
      } as Node,
    ]);
  };
  const remove = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };
  return (
    <div
      className={`group relative w-[320px] overflow-hidden rounded-2xl border bg-card shadow-[0_10px_28px_-18px_hsl(var(--foreground)/0.55)] transition ${
        selected ? "border-primary ring-2 ring-primary/25" : "border-border/70"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-primary !border-2 !border-background !shadow-md"
        style={{ left: -8 }}
      />

      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageSquare className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-none text-card-foreground">
              Mensagem
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Bloco de conteúdo
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              duplicate();
            }}
            className="p-1 rounded hover:bg-muted/60 hover:text-foreground transition"
            aria-label="Duplicar"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              remove();
            }}
            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition"
            aria-label="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-[13px] font-medium text-card-foreground">
                {variant === "midia"
                  ? "Mídia"
                  : variant === "atraso"
                  ? "Atraso inteligente"
                  : "Texto"}
              </span>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Ativo
            </span>
          </div>
          <div className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground break-words">
            {preview}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-primary !border-2 !border-background !shadow-md"
        style={{ right: -8 }}
      />
    </div>
  );
}
function _IntervaloNodeImpl({ id, data, selected }: any) {
  const { setNodes, setEdges, getNode } = useReactFlow();
  const unit: "seconds" | "minutes" | "hours" = data.timeUnit || "seconds";
  const value = data.delaySeconds ?? 10;
  const showTyping = !!data.showTyping;

  const patch = (p: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const merged = { ...n.data, ...p };
        return { ...n, data: { ...merged, summary: summaryFor(merged) } };
      }),
    );
  };

  const duplicate = () => {
    const src = getNode(id);
    if (!src) return;
    const newId = `n_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
    setNodes((nds) => [
      ...nds,
      {
        ...src,
        id: newId,
        position: { x: src.position.x + 40, y: src.position.y + 40 },
        selected: false,
        data: { ...src.data },
      } as Node,
    ]);
  };

  const remove = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <div
      className={`relative rounded-xl border bg-card shadow-md w-[280px] transition ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-500">
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold truncate">Intervalo</div>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              duplicate();
            }}
            className="p-1 rounded hover:bg-muted/60 hover:text-foreground transition"
            aria-label="Duplicar"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              remove();
            }}
            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition"
            aria-label="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-3 pt-2 space-y-2 nodrag">
        <div>
          <label className="text-[11px] font-medium text-foreground/80">
            Tempo<span className="text-destructive">*</span>
          </label>
          <div className="mt-1 flex items-stretch gap-2">
            <Input
              type="number"
              min={1}
              value={value}
              onChange={(e) => patch({ delaySeconds: Number(e.target.value) })}
              className="h-9 flex-1"
            />
            <Select
              value={unit}
              onValueChange={(v) => patch({ timeUnit: v })}
            >
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Segundos</SelectItem>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Switch
            checked={showTyping}
            onCheckedChange={(c) => patch({ showTyping: c })}
          />
          <span className="text-xs text-foreground/80">
            Mostrar &quot;digitando...&quot;
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  iniciar: IniciarNode,
  step: StepNode,
  intervalo: IntervaloNode,
  mensagem: MensagemNode,
};

/* --------------------------- Block catalog -------------------------- */

type StepKind =
  | "gatilho"
  | "texto"
  | "imagem"
  | "video"
  | "documento"
  | "audio"
  | "botoes"
  | "digitando"
  | "atraso"
  | "condicao"
  | "fim";

interface BlockDef {
  kind: StepKind;
  label: string;
  description: string;
  icon: any;
  badge?: string;
  initialData: Record<string, any>;
}

const BLOCKS: BlockDef[] = [
  {
    kind: "texto",
    label: "Mensagem de texto",
    description: "Envia uma mensagem de texto",
    icon: MessageSquare,
    initialData: { message: "" },
  },
  {
    kind: "imagem",
    label: "Foto",
    description: "Envia uma foto com legenda opcional",
    icon: ImageIcon,
    initialData: { mediaUrl: "", message: "" },
  },
  {
    kind: "video",
    label: "Vídeo",
    description: "Envia um vídeo com legenda opcional",
    icon: Video,
    initialData: { mediaUrl: "", message: "" },
  },
  {
    kind: "audio",
    label: "Áudio",
    description: "Envia um arquivo de áudio",
    icon: Mic,
    initialData: { mediaUrl: "", message: "" },
  },
  {
    kind: "documento",
    label: "Documento",
    description: "Envia um arquivo (PDF, etc.)",
    icon: FileText,
    initialData: { mediaUrl: "", message: "" },
  },
  {
    kind: "botoes",
    label: "Botões interativos",
    description: "Envia mensagem com botões inline",
    icon: MousePointerClick,
    initialData: {
      message: "Escolha uma opção:",
      buttons: [{ title: "Opção 1", callback_data: "btn_1" }],
    },
  },
  {
    kind: "digitando",
    label: "Mostrar 'digitando...'",
    description: "Mostra status de digitando por alguns segundos",
    icon: Activity,
    initialData: { typingDuration: 3 },
  },
  {
    kind: "atraso",
    label: "Intervalo",
    description: "Aguarda alguns segundos antes do próximo bloco",
    icon: Clock,
    initialData: { delaySeconds: 10, timeUnit: "seconds", showTyping: false },
  },
  {
    kind: "condicao",
    label: "Condição",
    description: "Ramifica o fluxo com base em uma condição",
    icon: GitBranch,
    initialData: { variable: "last_message", operator: "contains", value: "" },
  },
  {
    kind: "fim",
    label: "Fim do fluxo",
    description: "Encerra a execução",
    icon: CheckCircle,
    initialData: {},
  },
];

const blockByKind = (k: StepKind) => BLOCKS.find((b) => b.kind === k);

/* ---------- Menu compacto exibido ao puxar uma linha ou clicar em "+" ---------- */
interface MenuItem {
  label: string;
  icon: any;
  iconClass: string;
  kind?: StepKind;       // bloco real a inserir; ausente = em breve
  comingSoon?: boolean;
}
const BLOCK_MENU: MenuItem[] = [
  { label: "Mensagem", icon: Send, iconClass: "text-sky-500", kind: "texto" },
  { label: "Gerar pagamento", icon: CreditCard, iconClass: "text-muted-foreground/60", comingSoon: true },
  { label: "Intervalo", icon: Clock, iconClass: "text-amber-500", kind: "atraso" },
  { label: "Grupo", icon: Users, iconClass: "text-muted-foreground/60", comingSoon: true },
];

/* ---------------------------- Helpers ----------------------------- */

function makeId() {
  return `n_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function nodeFromBlock(block: BlockDef, position: { x: number; y: number }): Node {
  const Icon = block.icon;
  return {
    id: makeId(),
    type:
      block.kind === "atraso"
        ? "intervalo"
        : block.kind === "texto"
        ? "mensagem"
        : "step",
    position,
    data: {
      kind: block.kind,
      label: block.label,
      icon: Icon,
      badge: block.kind === "fim" ? "Fim" : undefined,
      summary: "",
      ...block.initialData,
    },
  };
}

function gatilhoNode(position: { x: number; y: number }): Node {
  return {
    id: makeId(),
    type: "step",
    position,
    data: {
      kind: "gatilho",
      label: "Gatilho",
      icon: Key,
      badge: "Gatilho",
      triggerType: "command",
      keyword: "/start",
      summary: "Comando: /start",
    },
  };
}

function summaryFor(data: any): string {
  switch (data.kind as StepKind) {
    case "gatilho":
      if (data.triggerType === "new_member") return "Primeiro contato com o bot";
      if (data.triggerType === "callback") return `Botão: ${data.keyword || "—"}`;
      if (data.triggerType === "keyword") return `Palavra-chave: ${data.keyword || "—"}`;
      return `Comando: ${data.keyword || "—"}`;
    case "texto":
      return data.message?.slice(0, 80) || "(sem texto)";
    case "imagem":
    case "video":
    case "audio":
    case "documento":
      return data.mediaUrl ? "Mídia: " + data.mediaUrl.slice(0, 40) : "(sem mídia)";
    case "botoes":
      return `${data.buttons?.length || 0} botão(ões)`;
    case "digitando":
      return `${data.typingDuration || 3}s digitando`;
    case "atraso":
      {
        const u = data.timeUnit || "seconds";
        const label =
          u === "days" ? "d" : u === "hours" ? "h" : u === "minutes" ? "min" : "s";
        return `Aguarda ${data.delaySeconds ?? 10}${label}`;
      }
    case "condicao":
      return `${data.variable} ${data.operator} ${data.value}`;
    default:
      return "";
  }
}

/* ============================ Main page ============================ */

export default function FluxoTelegram() {
  const [list, setList] = useState<FluxoTelegramItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [name, setName] = useState("Novo Flow");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"fluxo" | "desempenho">("fluxo");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [addOpenForSource, setAddOpenForSource] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<
    | {
        sourceId: string;
        sourceHandle: string | null;
        position: { x: number; y: number };
        screen: { x: number; y: number };
      }
    | null
  >(null);
  const rfWrapperRef = useRef<HTMLDivElement | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const lastSelectedRef = useRef<Node | null>(null);
  useEffect(() => {
    if (selectedNode) lastSelectedRef.current = selectedNode;
  }, [selectedNode]);
  const connectStartRef = useRef<
    { nodeId: string | null; handleId: string | null; handleType: string | null } | null
  >(null);

  /* ----------------------- Load data ----------------------- */
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("telegram_bots")
        .select("id,username,first_name")
        .eq("active", true)
        .order("created_at", { ascending: false });
      setBots((data as TelegramBot[]) || []);
    })();
    refreshList();
  }, []);

  const refreshList = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("flow_automations")
        .select("*")
        .eq("category", "telegram")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setList((data as FluxoTelegramItem[]) || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteFlow = async (id: string, flowName: string) => {
    if (!confirm(`Apagar o fluxo "${flowName}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const { error } = await (supabase as any)
        .from("flow_automations")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Fluxo apagado");
      setList((prev) => prev.filter((f) => f.id !== id));
      if (currentId === id) {
        setCurrentId(null);
        setNodes([]);
        setEdges([]);
        setSelectedNode(null);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao apagar: " + (e?.message || ""));
    }
  };

  /* ----------------------- New / open ----------------------- */
  const buildInitialCanvas = useCallback(() => {
    const iniciarId = "iniciar";
    setNodes([
      {
        id: iniciarId,
        type: "iniciar",
        position: { x: 80, y: 200 },
        data: { onAddTrigger: () => addTriggerFromIniciar(iniciarId) },
      },
    ]);
    setEdges([]);
  }, [setNodes, setEdges]);

  const openNew = () => {
    setCurrentId(null);
    setName("Novo Flow");
    setActive(true);
    setSelectedNode(null);
    buildInitialCanvas();
  };

  const openExisting = (item: FluxoTelegramItem) => {
    setCurrentId(item.id);
    setName(item.name);
    setActive(item.active);
    setSelectedBotId(item.bot_id || null);
    setSelectedNode(null);

    // Rehydrate nodes — restore icons by kind
    const hydrated = (item.nodes || []).map((n: any) => {
      if (n.type === "iniciar") {
        return {
          ...n,
          data: {
            ...n.data,
            onAddTrigger: () => addTriggerFromIniciar(n.id),
          },
        };
      }
      const block =
        n.data?.kind === "gatilho"
          ? { icon: Key }
          : blockByKind(n.data?.kind as StepKind);
      return {
        ...n,
        type:
          n.data?.kind === "atraso"
            ? "intervalo"
            : n.data?.kind === "texto"
            ? "mensagem"
            : n.type,
        data: { ...n.data, icon: block?.icon || MessageSquare, summary: summaryFor(n.data) },
      };
    });
    setNodes(hydrated);
    setEdges(item.edges || []);
  };

  const addTriggerFromIniciar = (iniciarId: string) => {
    const g = gatilhoNode({ x: 420, y: 200 });
    setNodes((nds) => [...nds, g]);
    setEdges((eds) => [
      ...eds,
      {
        id: `e_${iniciarId}_${g.id}`,
        source: iniciarId,
        target: g.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ]);
    setSelectedNode(g);
  };

  /* ----------------------- Add block from "+" ----------------------- */
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...params, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
          eds,
        ),
      ),
    [setEdges],
  );

  const addBlockAfter = (sourceId: string, block: BlockDef) => {
    const source = nodes.find((n) => n.id === sourceId);
    const base = source?.position || { x: 200, y: 200 };
    const node = nodeFromBlock(block, { x: base.x + 320, y: base.y });
    setNodes((nds) => [...nds, node]);
    setEdges((eds) => [
      ...eds,
      {
        id: `e_${sourceId}_${node.id}`,
        source: sourceId,
        target: node.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ]);
    setAddOpenForSource(null);
    setSelectedNode(node);
  };

  const addBlockAtPosition = (
    sourceId: string,
    sourceHandle: string | null,
    position: { x: number; y: number },
    block: BlockDef,
  ) => {
    const node = nodeFromBlock(block, position);
    setNodes((nds) => [...nds, node]);
    setEdges((eds) => [
      ...eds,
      {
        id: `e_${sourceId}_${node.id}`,
        source: sourceId,
        sourceHandle: sourceHandle ?? undefined,
        target: node.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ]);
    setPendingDrop(null);
    setSelectedNode(node);
  };

  /* ----------------------- Update / delete node ----------------------- */
  const patchNode = (id: string, patch: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const merged = { ...n.data, ...patch };
        return { ...n, data: { ...merged, summary: summaryFor(merged) } };
      }),
    );
    setSelectedNode((sel) =>
      sel && sel.id === id ? { ...sel, data: { ...sel.data, ...patch } } : sel,
    );
  };

  const deleteNode = (id: string) => {
    if (id === "iniciar") {
      toast.error("O bloco Iniciar não pode ser removido");
      return;
    }
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  };

  /* ----------------------- Save ----------------------- */
  const save = async () => {
    try {
      if (!selectedBotId) {
        toast.error("Selecione um bot do Telegram antes de salvar");
        return;
      }
      const gatilho = nodes.find((n) => n.data?.kind === "gatilho");
      if (!gatilho) {
        toast.error("Adicione pelo menos um Gatilho ao fluxo");
        return;
      }
      setSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        toast.error("Faça login novamente");
        return;
      }

      // strip non-serializable
      const cleanNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: Object.fromEntries(
          Object.entries(n.data || {}).filter(
            ([k, v]) => k !== "icon" && k !== "onAddTrigger" && typeof v !== "function",
          ),
        ),
      }));
      const cleanEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        type: e.type || "smoothstep",
      }));

      const payload: any = {
        user_id: userId,
        name,
        active,
        category: "telegram",
        bot_id: selectedBotId,
        keyword: String(gatilho.data?.keyword || ""),
        nodes: cleanNodes,
        edges: cleanEdges,
      };

      if (currentId) {
        const { error } = await (supabase as any)
          .from("flow_automations")
          .update(payload)
          .eq("id", currentId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("flow_automations")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setCurrentId(data.id);
      }
      toast.success("Flow salvo!");
      refreshList();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  /* ============================ Render ============================ */

  const inEditor = currentId !== null || nodes.length > 0;

  if (!inEditor) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Flow Chat</h1>
                <Badge variant="secondary" className="text-[10px]">
                  {list.length} FLOWS
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Crie e gerencie seus flows personalizados
              </p>
            </div>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo flow
            </Button>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-16">Carregando…</div>
          ) : list.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-xl">
              <Workflow className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground mb-4">
                Nenhum flow ainda. Crie o primeiro!
              </p>
              <Button onClick={openNew} className="gap-2">
                <Plus className="h-4 w-4" /> Criar primeiro flow
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((f) => (
                <div
                  key={f.id}
                  className="group relative text-left border rounded-xl p-4 bg-card hover:border-primary/40 hover:shadow transition cursor-pointer"
                  onClick={() => openExisting(f)}
                >
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="font-semibold truncate flex-1">{f.name}</span>
                    {f.active ? (
                      <Badge variant="default" className="text-[10px]">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                    )}
                    <button
                      type="button"
                      title="Apagar fluxo"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFlow(f.id, f.name);
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(f.nodes?.length || 0)} blocos
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* --------------------- Editor view --------------------- */
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setCurrentId(null);
            setNodes([]);
            setEdges([]);
            setSelectedNode(null);
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-base font-semibold border-0 px-1 focus-visible:ring-0 max-w-[260px]"
            />
            <Badge variant="outline" className="text-[10px]">MEU FLOW</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Crie e gerencie seus flows personalizados
          </p>
        </div>

        <Select value={selectedBotId || ""} onValueChange={(v) => setSelectedBotId(v)}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Selecione um bot" />
          </SelectTrigger>
          <SelectContent>
            {bots.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">
                Conecte um bot na aba Conexão
              </div>
            ) : (
              bots.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.first_name || b.username} (@{b.username})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Label className="text-xs">Ativo</Label>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-4">
        <div className="flex gap-1">
          {[
            { id: "fluxo", label: "Meu Fluxo", icon: Workflow },
            { id: "desempenho", label: "Desempenho", icon: Activity },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {tab === "fluxo" ? (
          <div ref={rfWrapperRef} className="h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={(inst) => (rfInstanceRef.current = inst)}
            onConnectStart={(_, params) => {
              connectStartRef.current = {
                nodeId: params.nodeId ?? null,
                handleId: params.handleId ?? null,
                handleType: params.handleType ?? null,
              };
            }}
            onConnectEnd={(event) => {
              const start = connectStartRef.current;
              connectStartRef.current = null;
              if (!start || !start.nodeId || start.handleType !== "source") return;
              const target = event.target as HTMLElement | null;
              const droppedOnPane =
                !!target && target.classList.contains("react-flow__pane");
              if (!droppedOnPane) return;
              const bounds = rfWrapperRef.current?.getBoundingClientRect();
              const inst = rfInstanceRef.current;
              if (!bounds || !inst) return;
              const clientX =
                (event as MouseEvent).clientX ??
                (event as TouchEvent).changedTouches?.[0]?.clientX ??
                0;
              const clientY =
                (event as MouseEvent).clientY ??
                (event as TouchEvent).changedTouches?.[0]?.clientY ??
                0;
              const position = inst.screenToFlowPosition
                ? inst.screenToFlowPosition({ x: clientX, y: clientY })
                : (inst as any).project({
                    x: clientX - bounds.left,
                    y: clientY - bounds.top,
                  });
              setPendingDrop({
                sourceId: start.nodeId,
                sourceHandle: start.handleId,
                position,
                screen: { x: clientX - bounds.left, y: clientY - bounds.top },
              });
            }}
            onNodeClick={(_, n) => {
              if (n.type === "iniciar") return;
              setSelectedNode(n);
            }}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: true,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 22,
                height: 22,
                color: "#8B5CF6",
              },
              style: {
                stroke: "#8B5CF6",
                strokeWidth: 3,
                filter: "drop-shadow(0 1px 2px rgba(139, 92, 246, 0.4))",
              },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              color="hsl(var(--muted-foreground) / 0.3)"
            />
            <Controls position="bottom-left" />
          </ReactFlow>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Desempenho do flow estará disponível em breve.</p>
            </div>
          </div>
        )}

        {/* Floating block picker (drop on pane) */}
        {pendingDrop && tab === "fluxo" && (
          <>
            <div
              className="absolute inset-0 z-40"
              onClick={() => setPendingDrop(null)}
            />
            <div
              className="absolute z-50 w-[260px] bg-card border rounded-xl shadow-xl py-1.5 animate-in fade-in zoom-in-95"
              style={{
                left: Math.max(8, pendingDrop.screen.x - 12),
                top: Math.max(8, pendingDrop.screen.y - 12),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {BLOCK_MENU.map((m, idx) => {
                const Icon = m.icon;
                const block = m.kind ? blockByKind(m.kind) : null;
                const disabled = !block;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (!block) {
                        toast.info("Em breve");
                        return;
                      }
                      addBlockAtPosition(
                        pendingDrop.sourceId,
                        pendingDrop.sourceHandle,
                        pendingDrop.position,
                        block,
                      );
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[14px] text-left transition group ${
                      disabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${m.iconClass}`} />
                      <span className="truncate text-foreground/80">{m.label}</span>
                    </span>
                    {!disabled && (
                      <Plus className="h-4 w-4 text-muted-foreground/70" />
                    )}
                  </button>
                );
              })}
              <div className="border-t mt-1 pt-1 px-1.5">
                <button
                  onClick={() => setPendingDrop(null)}
                  className="w-full text-center text-[13px] py-2 rounded-md text-foreground/70 hover:bg-muted transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </>
        )}

        {/* Floating action bar */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 bg-card border rounded-xl shadow-lg p-2">
          <Button
            size="icon"
            variant="ghost"
            title="Adicionar bloco após o selecionado"
            onClick={() => {
              if (!selectedNode) {
                toast.error("Selecione um bloco no canvas primeiro");
                return;
              }
              setAddOpenForSource(selectedNode.id);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Salvar"
            onClick={save}
            disabled={saving}
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="Remover bloco selecionado"
            onMouseDown={(e) => {
              // Roda antes do outside-click do Sheet, preservando a seleção
              e.preventDefault();
              const target = selectedNode || lastSelectedRef.current;
              if (!target) {
                toast.error("Selecione um bloco no canvas primeiro");
                return;
              }
              if (target.id === "iniciar") {
                toast.error("O bloco Iniciar não pode ser removido");
                return;
              }
              deleteNode(target.id);
              lastSelectedRef.current = null;
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Editor sheet */}
      <Sheet
        open={!!selectedNode && selectedNode.type !== "iniciar"}
        onOpenChange={(o) => !o && setSelectedNode(null)}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedNode?.data?.label}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Configure o bloco e clique em Salvar no canto direito do canvas.
            </SheetDescription>
          </SheetHeader>

          {selectedNode && (
            <div className="mt-4 space-y-4">
              <BlockEditor
                node={selectedNode}
                onPatch={(p) => patchNode(selectedNode.id, p)}
              />

              <div className="pt-3 border-t flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddOpenForSource(selectedNode.id)}
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Próximo bloco
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-destructive"
                  onClick={() => deleteNode(selectedNode.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add block dialog */}
      <Dialog
        open={!!addOpenForSource}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpenForSource(null);
          }
        }}
      >
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="sr-only">Adicionar bloco</DialogTitle>
            <DialogDescription className="sr-only">
              Escolha o tipo de bloco que será executado em seguida.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1.5">
            {BLOCK_MENU.map((m, idx) => {
              const Icon = m.icon;
              const block = m.kind ? blockByKind(m.kind) : null;
              const disabled = !block;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!block) {
                      toast.info("Em breve");
                      return;
                    }
                    if (addOpenForSource) addBlockAfter(addOpenForSource, block);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-5 py-3 text-[14px] text-left transition ${
                    disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${m.iconClass}`} />
                    <span className="truncate text-foreground/80">{m.label}</span>
                  </span>
                  {!disabled && <Plus className="h-4 w-4 text-muted-foreground/70" />}
                </button>
              );
            })}
            <div className="border-t mt-1 pt-1 px-2 pb-2">
              <button
                type="button"
                onClick={() => setAddOpenForSource(null)}
                className="w-full text-center text-[13px] py-2 rounded-md text-foreground/70 hover:bg-muted transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================ BlockEditor ============================ */

function BlockEditor({
  node,
  onPatch,
}: {
  node: Node;
  onPatch: (p: Record<string, any>) => void;
}) {
  const kind = node.data?.kind as StepKind;
  const d = node.data || {};

  if (kind === "gatilho") {
    return (
      <>
        <div>
          <Label className="text-xs">Tipo de gatilho</Label>
          <Select
            value={String(d.triggerType || "command")}
            onValueChange={(v) =>
              onPatch({ triggerType: v, keyword: v === "new_member" ? "" : d.keyword })
            }
          >
            <SelectTrigger className="mt-1 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="command">Comando (/start, /menu…)</SelectItem>
              <SelectItem value="keyword">Palavra-chave (texto)</SelectItem>
              <SelectItem value="callback">Clique em botão</SelectItem>
              <SelectItem value="new_member">Primeiro contato</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {d.triggerType !== "new_member" && (
          <div>
            <Label className="text-xs">
              {d.triggerType === "command"
                ? "Comandos (separados por vírgula)"
                : d.triggerType === "callback"
                ? "Callback data dos botões"
                : "Palavras-chave"}
            </Label>
            <Input
              value={d.keyword || ""}
              onChange={(e) => onPatch({ keyword: e.target.value })}
              placeholder={
                d.triggerType === "command"
                  ? "/start, /menu, /comprar"
                  : d.triggerType === "callback"
                  ? "btn_comprar, btn_planos"
                  : "oi, menu, preço"
              }
              className="mt-1 h-9"
            />
          </div>
        )}
      </>
    );
  }

  if (kind === "texto") {
    const variant: "texto" | "midia" | "atraso" = d.contentVariant || "texto";
    const options = [
      {
        id: "texto" as const,
        icon: Type,
        title: "Texto",
        desc: "Adicione texto simples e botões",
        color: "text-sky-500 bg-sky-500/10",
      },
      {
        id: "midia" as const,
        icon: ImageIcon,
        title: "Mídia",
        desc: "Impulsione o engajamento com estímulos visuais",
        color: "text-violet-500 bg-violet-500/10",
      },
      {
        id: "atraso" as const,
        icon: Clock,
        title: "Atraso inteligente",
        desc: "Configure um atraso estratégico entre os envios",
        color: "text-amber-500 bg-amber-500/10",
      },
    ];
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Adicione um dos blocos de conteúdo
          </p>
          <div className="mt-3 space-y-2">
            {options.map((o) => {
              const Icon = o.icon;
              const active = variant === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onPatch({ contentVariant: o.id })}
                  className={`w-full text-left flex items-start gap-3 rounded-lg border p-3 transition ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className={`p-2 rounded-md ${o.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{o.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {o.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {variant === "texto" && (
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={d.message || ""}
              onChange={(e) => onPatch({ message: e.target.value })}
              rows={6}
              placeholder="Olá {{user.first_name}}! Bem-vindo."
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Variáveis: <code>{`{{user.first_name}}`}</code>,{" "}
              <code>{`{{chat.id}}`}</code>, <code>{`{{last_message}}`}</code>,{" "}
              <code>{`{{last_button}}`}</code>
            </p>
          </div>
        )}

        {variant === "midia" && (
          <>
            <div>
              <Label className="text-xs">URL da mídia</Label>
              <Input
                value={d.mediaUrl || ""}
                onChange={(e) => onPatch({ mediaUrl: e.target.value })}
                placeholder="https://..."
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Legenda (opcional)</Label>
              <Textarea
                value={d.message || ""}
                onChange={(e) => onPatch({ message: e.target.value })}
                rows={3}
                className="mt-1"
              />
            </div>
          </>
        )}

        {variant === "atraso" && (
          <div>
            <Label className="text-xs">
              Tempo <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1 flex gap-2">
              <Input
                type="number"
                min={1}
                value={d.delaySeconds ?? 10}
                onChange={(e) =>
                  onPatch({ delaySeconds: Number(e.target.value) })
                }
                className="h-9 flex-1"
              />
              <Select
                value={String(d.timeUnit || "seconds")}
                onValueChange={(v) => onPatch({ timeUnit: v })}
              >
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Segundos</SelectItem>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (["imagem", "video", "audio", "documento"].includes(kind)) {
    return (
      <>
        <div>
          <Label className="text-xs">URL da mídia</Label>
          <Input
            value={d.mediaUrl || ""}
            onChange={(e) => onPatch({ mediaUrl: e.target.value })}
            placeholder="https://..."
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Legenda (opcional)</Label>
          <Textarea
            value={d.message || ""}
            onChange={(e) => onPatch({ message: e.target.value })}
            rows={3}
            className="mt-1"
          />
        </div>
      </>
    );
  }

  if (kind === "botoes") {
    const buttons: any[] = Array.isArray(d.buttons) ? d.buttons : [];
    const update = (next: any[]) => onPatch({ buttons: next });
    return (
      <>
        <div>
          <Label className="text-xs">Mensagem</Label>
          <Textarea
            value={d.message || ""}
            onChange={(e) => onPatch({ message: e.target.value })}
            rows={3}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Botões inline</Label>
          <div className="mt-2 space-y-2">
            {buttons.map((b, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid gap-1.5">
                  <Input
                    value={b.title || ""}
                    onChange={(e) => {
                      const next = [...buttons];
                      next[i] = { ...b, title: e.target.value };
                      update(next);
                    }}
                    placeholder="Texto do botão"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={b.url || b.callback_data || ""}
                    onChange={(e) => {
                      const next = [...buttons];
                      const v = e.target.value;
                      next[i] = v.startsWith("http")
                        ? { title: b.title, url: v }
                        : { title: b.title, callback_data: v };
                      update(next);
                    }}
                    placeholder="callback_data ou https://link"
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => update(buttons.filter((_, idx) => idx !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1"
              onClick={() =>
                update([
                  ...buttons,
                  { title: `Opção ${buttons.length + 1}`, callback_data: `btn_${buttons.length + 1}` },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar botão
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (kind === "digitando") {
    return (
      <div>
        <Label className="text-xs">Duração (segundos)</Label>
        <Input
          type="number"
          min={1}
          max={8}
          value={d.typingDuration || 3}
          onChange={(e) => onPatch({ typingDuration: Number(e.target.value) })}
          className="mt-1 h-9"
        />
      </div>
    );
  }

  if (kind === "atraso") {
    return (
      <>
        <div>
          <Label className="text-xs">
            Tempo <span className="text-destructive">*</span>
          </Label>
          <div className="mt-1 flex gap-2">
            <Input
              type="number"
              min={1}
              value={d.delaySeconds ?? 10}
              onChange={(e) => onPatch({ delaySeconds: Number(e.target.value) })}
              className="h-9 flex-1"
            />
            <Select
              value={String(d.timeUnit || "seconds")}
              onValueChange={(v) => onPatch({ timeUnit: v })}
            >
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Segundos</SelectItem>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!d.showTyping}
            onCheckedChange={(c) => onPatch({ showTyping: c })}
          />
          <span className="text-xs text-foreground/80">
            Mostrar &quot;digitando...&quot;
          </span>
        </div>
      </>
    );
  }

  if (kind === "condicao") {
    return (
      <>
        <div>
          <Label className="text-xs">Variável</Label>
          <Input
            value={d.variable || "last_message"}
            onChange={(e) => onPatch({ variable: e.target.value })}
            className="mt-1 h-9"
            placeholder="last_message, last_button, user.username..."
          />
        </div>
        <div>
          <Label className="text-xs">Operador</Label>
          <Select
            value={String(d.operator || "contains")}
            onValueChange={(v) => onPatch({ operator: v })}
          >
            <SelectTrigger className="mt-1 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">contém</SelectItem>
              <SelectItem value="equals">igual a</SelectItem>
              <SelectItem value="not_equals">diferente de</SelectItem>
              <SelectItem value="starts_with">começa com</SelectItem>
              <SelectItem value="ends_with">termina com</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Valor</Label>
          <Input
            value={d.value || ""}
            onChange={(e) => onPatch({ value: e.target.value })}
            className="mt-1 h-9"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Conecte a saída TRUE no primeiro próximo bloco e a saída FALSE no segundo.
        </p>
      </>
    );
  }

  if (kind === "fim") {
    return (
      <p className="text-sm text-muted-foreground">
        Este bloco encerra a execução do fluxo para o usuário.
      </p>
    );
  }

  return null;
}