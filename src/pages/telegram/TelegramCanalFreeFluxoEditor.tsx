import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  Plus, MessageSquare, Clock, Image as ImageIcon, Video, FileText,
  Upload, Loader2, X, ArrowDown, Zap, Calendar as CalendarIcon, Repeat,
  Hash, ArrowLeft, Save,
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
  | { id: string; type: "delay"; data: { seconds: number } };

type Flow = {
  id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_config: any;
  nodes: FlowNode[];
  is_active: boolean;
};

const intervalPresets = [
  { label: "A cada 30 minutos", minutes: 30 },
  { label: "A cada 1 hora", minutes: 60 },
  { label: "A cada 3 horas", minutes: 180 },
  { label: "A cada 6 horas", minutes: 360 },
  { label: "A cada 12 horas", minutes: 720 },
  { label: "1x por dia", minutes: 1440 },
];

function newId() { return `n_${Math.random().toString(36).slice(2, 10)}`; }

function buildLinearEdges(nodes: FlowNode[]) {
  const edges: Array<{ source: string; target: string }> = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ source: nodes[i].id, target: nodes[i + 1].id });
  }
  return edges;
}

export default function TelegramCanalFreeFluxoEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === "novo";
  const queryBotId = searchParams.get("botId") || "";

  const [botId, setBotId] = useState<string>(queryBotId);
  const [state, setState] = useState<Flow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (isNew) {
        setState({
          id: "",
          name: "Novo fluxo",
          trigger_type: "manual",
          trigger_config: {},
          nodes: [
            { id: newId(), type: "message", data: { content_type: "text", text: "", buttons: [] } },
          ],
          is_active: true,
        });
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("telegram_group_flows" as any)
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      const row = data as any;
      if (!row) {
        toast.error("Fluxo não encontrado");
        navigate(-1);
        return;
      }
      setBotId(row.bot_id);
      setState({
        id: row.id,
        name: row.name,
        trigger_type: row.trigger_type,
        trigger_config: row.trigger_config || {},
        nodes: (row.nodes || []) as FlowNode[],
        is_active: row.is_active,
      });
      setLoading(false);
    })();
  }, [id]);

  function patch<K extends keyof Flow>(k: K, v: Flow[K]) {
    setState((s) => (s ? { ...s, [k]: v } : s));
  }

  function updateNode(idx: number, node: FlowNode) {
    setState((s) => {
      if (!s) return s;
      const next = [...s.nodes];
      next[idx] = node;
      return { ...s, nodes: next };
    });
  }

  function addNode(type: NodeType) {
    setState((s) => {
      if (!s) return s;
      const n: FlowNode = type === "message"
        ? { id: newId(), type: "message", data: { content_type: "text", text: "", buttons: [] } }
        : { id: newId(), type: "delay", data: { seconds: 60 } };
      return { ...s, nodes: [...s.nodes, n] };
    });
  }

  function removeNode(idx: number) {
    setState((s) => (s ? { ...s, nodes: s.nodes.filter((_, i) => i !== idx) } : s));
  }

  function moveNode(idx: number, dir: -1 | 1) {
    setState((s) => {
      if (!s) return s;
      const next = [...s.nodes];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...s, nodes: next };
    });
  }

  async function save() {
    if (!state) return;
    if (!botId) return toast.error("Bot não informado");
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
    navigate("/telegram/canal-free");
  }

  if (loading || !state) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate("/telegram/canal-free")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">
              {state.id ? "Editar fluxo" : "Novo fluxo"}
            </h1>
            <p className="text-xs text-muted-foreground">Fluxos automáticos no grupo</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Salvar fluxo
        </Button>
      </div>

      <Card className="p-5 space-y-5">
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
                placeholder={"oferta\npromo\nquero saber mais"}
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

        <div className="flex items-center gap-2 pt-2 border-t">
          <Switch checked={state.is_active} onCheckedChange={(v) => patch("is_active", v)} />
          <Label>Fluxo ativo</Label>
        </div>
      </Card>

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="outline" onClick={() => navigate("/telegram/canal-free")}>Cancelar</Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Salvar fluxo
        </Button>
      </div>
    </div>
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