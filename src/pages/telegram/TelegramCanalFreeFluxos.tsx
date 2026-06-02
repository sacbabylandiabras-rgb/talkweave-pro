import { useEffect, useRef, useState } from "react";
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
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Trash2, Workflow, Play, Pause, Edit, MessageSquare, Clock,
  Image as ImageIcon, Video, FileText, Upload, Loader2, X, ArrowDown,
  Zap, Calendar as CalendarIcon, Repeat, Hash,
} from "lucide-react";
import { toast } from "sonner";

type TriggerType = "manual" | "scheduled" | "recurring" | "keyword";
type NodeType = "message" | "delay";
type ContentType = "text" | "photo" | "video" | "document";
type Btn = { text: string; url: string };

type FlowNode =
  | {
      id: string;
      type: "message";
      data: {
        content_type: ContentType;
        text?: string;
        media_url?: string | null;
        buttons?: Btn[];
      };
    }
  | {
      id: string;
      type: "delay";
      data: { seconds: number };
    };

type Flow = {
  id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_config: any;
  nodes: FlowNode[];
  edges: Array<{ source: string; target: string; sourceHandle?: string | null }>;
  start_node_id: string | null;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
};

type Run = {
  id: string;
  status: string;
  trigger_source: string | null;
  triggered_by_username: string | null;
  step_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const intervalPresets = [
  { label: "A cada 30 minutos", minutes: 30 },
  { label: "A cada 1 hora", minutes: 60 },
  { label: "A cada 3 horas", minutes: 180 },
  { label: "A cada 6 horas", minutes: 360 },
  { label: "A cada 12 horas", minutes: 720 },
  { label: "1x por dia", minutes: 1440 },
];

function newId() {
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}

function triggerLabel(t: TriggerType) {
  if (t === "manual") return "Manual";
  if (t === "scheduled") return "Agendado";
  if (t === "recurring") return "Recorrente";
  return "Palavra-chave";
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

function buildLinearEdges(nodes: FlowNode[]) {
  const edges: Array<{ source: string; target: string }> = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ source: nodes[i].id, target: nodes[i + 1].id });
  }
  return edges;
}

export default function TelegramCanalFreeFluxos({
  botId, chatId, channelTitle,
}: { botId: string; chatId: number | null; channelTitle: string }) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Flow | null>(null);

  async function load() {
    if (!botId) { setFlows([]); setRuns([]); return; }
    setLoading(true);
    const [{ data: f }, { data: r }] = await Promise.all([
      supabase.from("telegram_group_flows" as any)
        .select("*").eq("bot_id", botId).order("created_at", { ascending: false }),
      supabase.from("telegram_group_flow_runs" as any)
        .select("*").eq("bot_id", botId).order("created_at", { ascending: false }).limit(30),
    ]);
    setFlows(((f as any[]) || []) as Flow[]);
    setRuns(((r as any[]) || []) as Run[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [botId]);

  async function toggleActive(flow: Flow) {
    const { error } = await supabase
      .from("telegram_group_flows" as any)
      .update({ is_active: !flow.is_active })
      .eq("id", flow.id);
    if (error) return toast.error(error.message);
    toast.success(flow.is_active ? "Fluxo pausado" : "Fluxo ativado");
    load();
  }

  async function removeFlow(id: string) {
    const { error } = await supabase.from("telegram_group_flows" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Fluxo removido");
    load();
  }

  async function runNow(flow: Flow) {
    const { data, error } = await supabase.functions.invoke("telegram-group-flow-trigger", {
      body: { flow_id: flow.id, trigger_source: "manual" },
    });
    if (error || (data as any)?.error) {
      return toast.error(`Erro: ${error?.message || (data as any)?.error}`);
    }
    toast.success("Fluxo disparado!");
    setTimeout(load, 1500);
  }

  function openNew() {
    setEditing({
      id: "",
      name: "Novo fluxo",
      trigger_type: "manual",
      trigger_config: {},
      nodes: [
        { id: newId(), type: "message", data: { content_type: "text", text: "", buttons: [] } },
      ],
      edges: [],
      start_node_id: null,
      is_active: true,
      next_run_at: null,
      last_run_at: null,
    });
    setDialogOpen(true);
  }

  function openEdit(flow: Flow) {
    setEditing(JSON.parse(JSON.stringify(flow)));
    setDialogOpen(true);
  }

  return (
    <div className="space-y-5">
      {!channelTitle && (
        <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-500/5 text-sm text-foreground">
          Configure o canal na aba <strong>Configuração</strong> antes de criar fluxos.
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Workflow className="w-4 h-4" /> Fluxos no grupo
          </h3>
          <p className="text-xs text-muted-foreground">
            Sequências automáticas de mensagens enviadas dentro do grupo.
          </p>
        </div>
        <Button onClick={openNew} disabled={!botId || !channelTitle}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo fluxo
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Meus fluxos</TabsTrigger>
          <TabsTrigger value="runs">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-2 pt-3">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && flows.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhum fluxo criado ainda.
            </Card>
          )}
          {flows.map((f) => (
            <Card key={f.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground truncate">{f.name}</h4>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                    {triggerLabel(f.trigger_type)}
                  </span>
                  {!f.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      Pausado
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {f.nodes.length} passo(s) · último disparo: {fmt(f.last_run_at)}
                  {f.trigger_type === "recurring" && f.next_run_at && (
                    <> · próximo: {fmt(f.next_run_at)}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => runNow(f)} title="Disparar agora">
                  <Play className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(f)}>
                  {f.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-primary" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(f)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover fluxo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeFlow(f.id)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="runs" className="space-y-2 pt-3">
          {runs.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma execução registrada.
            </Card>
          ) : runs.map((r) => (
            <Card key={r.id} className="p-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-md ${
                    r.status === "completed" ? "bg-emerald-500/10 text-emerald-600"
                    : r.status === "failed" ? "bg-destructive/10 text-destructive"
                    : r.status === "running" ? "bg-amber-500/10 text-amber-600"
                    : "bg-muted text-muted-foreground"
                  }`}>{r.status}</span>
                  <span className="text-xs text-muted-foreground">{r.trigger_source || "—"}</span>
                  {r.triggered_by_username && (
                    <span className="text-xs text-muted-foreground">@{r.triggered_by_username}</span>
                  )}
                </div>
                {r.last_error && (
                  <p className="text-xs text-destructive mt-0.5 truncate">{r.last_error}</p>
                )}
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {fmt(r.created_at)} · {r.step_count} passo(s)
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {editing && (
        <FlowEditor
          open={dialogOpen}
          onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
          flow={editing}
          botId={botId}
          onSaved={() => { setDialogOpen(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function FlowEditor({
  open, onOpenChange, flow, botId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  flow: Flow;
  botId: string;
  onSaved: () => void;
}) {
  const [state, setState] = useState<Flow>(flow);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setState(flow); }, [flow]);

  function patch<K extends keyof Flow>(k: K, v: Flow[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function updateNode(idx: number, node: FlowNode) {
    setState((s) => {
      const next = [...s.nodes];
      next[idx] = node;
      return { ...s, nodes: next };
    });
  }

  function addNode(type: NodeType) {
    setState((s) => {
      const n: FlowNode = type === "message"
        ? { id: newId(), type: "message", data: { content_type: "text", text: "", buttons: [] } }
        : { id: newId(), type: "delay", data: { seconds: 60 } };
      return { ...s, nodes: [...s.nodes, n] };
    });
  }

  function removeNode(idx: number) {
    setState((s) => ({ ...s, nodes: s.nodes.filter((_, i) => i !== idx) }));
  }

  function moveNode(idx: number, dir: -1 | 1) {
    setState((s) => {
      const next = [...s.nodes];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...s, nodes: next };
    });
  }

  async function save() {
    if (!state.name.trim()) return toast.error("Dê um nome ao fluxo");
    if (state.nodes.length === 0) return toast.error("Adicione ao menos um passo");
    if (state.trigger_type === "keyword") {
      const kws: string[] = state.trigger_config?.keywords || [];
      if (kws.filter((x) => String(x || "").trim()).length === 0) {
        return toast.error("Adicione ao menos uma palavra-chave");
      }
    }
    if (state.trigger_type === "scheduled" && !state.trigger_config?.scheduled_at) {
      return toast.error("Defina a data/hora do agendamento");
    }
    if (state.trigger_type === "recurring" && !Number(state.trigger_config?.interval_minutes)) {
      return toast.error("Defina o intervalo de repetição");
    }
    // valida nós de mensagem
    for (const n of state.nodes) {
      if (n.type === "message") {
        if (n.data.content_type === "text" && !String(n.data.text || "").trim()) {
          return toast.error("Há uma mensagem de texto vazia");
        }
        if (n.data.content_type !== "text" && !n.data.media_url) {
          return toast.error("Há uma mensagem de mídia sem arquivo");
        }
      }
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Sessão expirada"); }

    const edges = buildLinearEdges(state.nodes);
    const start_node_id = state.nodes[0]?.id || null;
    const trigger_config = (() => {
      if (state.trigger_type === "scheduled") {
        return { scheduled_at: state.trigger_config?.scheduled_at };
      }
      if (state.trigger_type === "recurring") {
        return { interval_minutes: Number(state.trigger_config?.interval_minutes) };
      }
      if (state.trigger_type === "keyword") {
        return {
          keywords: (state.trigger_config?.keywords || []).filter((k: string) => k.trim()),
          match_mode: state.trigger_config?.match_mode || "contains",
        };
      }
      return {};
    })();
    const next_run_at = state.trigger_type === "scheduled" ? trigger_config.scheduled_at
      : state.trigger_type === "recurring"
        ? new Date(Date.now() + (trigger_config.interval_minutes || 60) * 60_000).toISOString()
        : null;

    const row = {
      user_id: user.id,
      bot_id: botId,
      name: state.name.trim(),
      trigger_type: state.trigger_type,
      trigger_config,
      nodes: state.nodes,
      edges,
      start_node_id,
      is_active: state.is_active,
      next_run_at,
    };

    const q = state.id
      ? supabase.from("telegram_group_flows" as any).update(row).eq("id", state.id)
      : supabase.from("telegram_group_flows" as any).insert(row);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(`Erro: ${error.message}`);
    toast.success("Fluxo salvo!");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{state.id ? "Editar fluxo" : "Novo fluxo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={state.name} onChange={(e) => patch("name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Quando disparar</Label>
            <Tabs value={state.trigger_type} onValueChange={(v) => {
              patch("trigger_type", v as TriggerType);
              patch("trigger_config", {});
            }}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="manual"><Zap className="w-4 h-4 mr-1" /> Manual</TabsTrigger>
                <TabsTrigger value="scheduled"><CalendarIcon className="w-4 h-4 mr-1" /> Agendado</TabsTrigger>
                <TabsTrigger value="recurring"><Repeat className="w-4 h-4 mr-1" /> Recorrente</TabsTrigger>
                <TabsTrigger value="keyword"><Hash className="w-4 h-4 mr-1" /> Palavra-chave</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="pt-3 text-sm text-muted-foreground">
                O fluxo só dispara quando você clicar em "Disparar agora".
              </TabsContent>
              <TabsContent value="scheduled" className="pt-3 space-y-2">
                <Label>Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={state.trigger_config?.scheduled_at
                    ? new Date(state.trigger_config.scheduled_at).toISOString().slice(0, 16)
                    : ""}
                  onChange={(e) => patch("trigger_config", {
                    ...state.trigger_config,
                    scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })}
                />
              </TabsContent>
              <TabsContent value="recurring" className="pt-3 space-y-2">
                <Label>Intervalo</Label>
                <Select
                  value={String(state.trigger_config?.interval_minutes || "")}
                  onValueChange={(v) => patch("trigger_config", {
                    ...state.trigger_config, interval_minutes: Number(v),
                  })}
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
                  placeholder="oferta&#10;promo&#10;quero saber mais"
                  value={(state.trigger_config?.keywords || []).join("\n")}
                  onChange={(e) => patch("trigger_config", {
                    ...state.trigger_config,
                    keywords: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  })}
                />
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Modo:</Label>
                  <Select
                    value={state.trigger_config?.match_mode || "contains"}
                    onValueChange={(v) => patch("trigger_config", { ...state.trigger_config, match_mode: v })}
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
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sequência de passos</Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => addNode("message")}>
                  <MessageSquare className="w-3.5 h-3.5 mr-1" /> Mensagem
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => addNode("delay")}>
                  <Clock className="w-3.5 h-3.5 mr-1" /> Esperar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {state.nodes.map((n, i) => (
                <div key={n.id}>
                  <NodeCard
                    node={n}
                    index={i}
                    onChange={(nn) => updateNode(i, nn)}
                    onRemove={() => removeNode(i)}
                    onMoveUp={i > 0 ? () => moveNode(i, -1) : undefined}
                    onMoveDown={i < state.nodes.length - 1 ? () => moveNode(i, 1) : undefined}
                  />
                  {i < state.nodes.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Switch checked={state.is_active} onCheckedChange={(v) => patch("is_active", v)} />
            <Label>Fluxo ativo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Salvar fluxo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NodeCard({
  node, index, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  node: FlowNode;
  index: number;
  onChange: (n: FlowNode) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  if (node.type === "delay") {
    const seconds = node.data.seconds;
    return (
      <Card className="p-3 space-y-2">
        <NodeHeader title={`${index + 1}. Esperar`} icon={<Clock className="w-4 h-4" />}
          onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
        <div className="flex items-center gap-2">
          <Input
            type="number" min={1}
            className="w-32"
            value={seconds}
            onChange={(e) => onChange({ ...node, data: { seconds: Math.max(1, Number(e.target.value) || 1) } })}
          />
          <span className="text-sm text-muted-foreground">segundos</span>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-3 space-y-2">
      <NodeHeader title={`${index + 1}. Mensagem`} icon={<MessageSquare className="w-4 h-4" />}
        onRemove={onRemove} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
      <MessageNodeEditor node={node} onChange={onChange} />
    </Card>
  );
}

function NodeHeader({
  title, icon, onRemove, onMoveUp, onMoveDown,
}: {
  title: string; icon: React.ReactNode;
  onRemove: () => void; onMoveUp?: () => void; onMoveDown?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {icon} {title}
      </div>
      <div className="flex gap-1">
        {onMoveUp && (
          <Button size="sm" variant="ghost" onClick={onMoveUp} className="h-7 w-7 p-0">↑</Button>
        )}
        {onMoveDown && (
          <Button size="sm" variant="ghost" onClick={onMoveDown} className="h-7 w-7 p-0">↓</Button>
        )}
        <Button size="sm" variant="ghost" onClick={onRemove} className="h-7 w-7 p-0 text-destructive">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function MessageNodeEditor({
  node, onChange,
}: {
  node: Extract<FlowNode, { type: "message" }>;
  onChange: (n: FlowNode) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const d = node.data;

  function setData(p: Partial<typeof d>) {
    onChange({ ...node, data: { ...d, ...p } });
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `group-flows/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
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
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground truncate flex-1">{d.media_url}</span>
              <Button size="sm" variant="ghost" onClick={() => setData({ media_url: null })}>
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