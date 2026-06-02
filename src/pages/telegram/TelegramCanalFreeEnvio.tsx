import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Send, Calendar as CalendarIcon, Repeat, Plus, Trash2, Image as ImageIcon,
  Video, FileText, MessageSquare, Link as LinkIcon, Loader2, X, Upload,
} from "lucide-react";
import { toast } from "sonner";

type ContentType = "text" | "photo" | "video" | "document";
type Mode = "now" | "scheduled" | "recurring";
type Btn = { text: string; url: string };
type Template = {
  id: string; name: string; content: string;
  buttons: Array<{ type?: string; text: string; url?: string }>;
};
type Post = {
  id: string;
  content_type: ContentType;
  text: string | null;
  media_url: string | null;
  buttons: Btn[];
  mode: Mode;
  scheduled_at: string | null;
  recurring_interval_minutes: number | null;
  next_run_at: string | null;
  status: string;
  last_error: string | null;
  sent_count: number;
  last_sent_at: string | null;
  created_at: string;
};

const intervalPresets: { label: string; minutes: number }[] = [
  { label: "A cada 30 minutos", minutes: 30 },
  { label: "A cada 1 hora", minutes: 60 },
  { label: "A cada 3 horas", minutes: 180 },
  { label: "A cada 6 horas", minutes: 360 },
  { label: "A cada 12 horas", minutes: 720 },
  { label: "1x por dia", minutes: 1440 },
];

function statusBadge(p: Post) {
  const base = "text-xs px-2 py-0.5 rounded-md";
  if (p.status === "sent") return <span className={`${base} bg-emerald-500/10 text-emerald-600`}>Enviado</span>;
  if (p.status === "failed") return <span className={`${base} bg-destructive/10 text-destructive`}>Falhou</span>;
  if (p.status === "recurring") return <span className={`${base} bg-primary/10 text-primary`}>Recorrente</span>;
  if (p.status === "paused") return <span className={`${base} bg-muted text-muted-foreground`}>Pausado</span>;
  return <span className={`${base} bg-amber-500/10 text-amber-600`}>Agendado</span>;
}

function formatDt(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

export default function TelegramCanalFreeEnvio({ botId, chatId, channelTitle }: {
  botId: string; chatId: number | null; channelTitle: string;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // form state
  const [mode, setMode] = useState<Mode>("now");
  const [contentType, setContentType] = useState<ContentType>("text");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [buttons, setButtons] = useState<Btn[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [intervalMin, setIntervalMin] = useState<string>("60");

  async function load() {
    if (!botId) return;
    setLoading(true);
    const { data } = await supabase
      .from("telegram_channel_posts" as any)
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts(((data as any[]) || []) as Post[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [botId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("telegram_message_templates" as any)
        .select("id, name, content, buttons")
        .eq("active", true)
        .order("name");
      setTemplates(((data as any[]) || []) as Template[]);
    })();
  }, []);

  function resetForm() {
    setMode("now"); setContentType("text"); setText(""); setMediaUrl("");
    setButtons([]); setTemplateId(""); setScheduledAt(""); setIntervalMin("60");
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setText(t.content || "");
    setButtons(
      (t.buttons || [])
        .filter((b) => b?.url && b?.text)
        .map((b) => ({ text: String(b.text), url: String(b.url) })),
    );
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `telegram-channel/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("flow-media").upload(path, file, {
        cacheControl: "3600", upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("flow-media").getPublicUrl(path);
      setMediaUrl(data.publicUrl);
      toast.success("Mídia enviada!");
    } catch (e: any) {
      toast.error(`Erro no upload: ${e?.message || "tente novamente"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function submit() {
    if (!botId) { toast.error("Selecione um bot."); return; }
    if (!chatId) { toast.error("Configure o Canal Free primeiro."); return; }
    if (contentType === "text" && !text.trim()) { toast.error("Texto obrigatório."); return; }
    if (contentType !== "text" && !mediaUrl) { toast.error("Envie a mídia."); return; }
    if (mode === "scheduled" && !scheduledAt) { toast.error("Escolha a data e hora."); return; }
    if (mode === "recurring" && !(Number(intervalMin) >= 1)) {
      toast.error("Intervalo inválido."); return;
    }
    for (const b of buttons) {
      if (!b.text.trim() || !b.url.trim()) { toast.error("Botões precisam de texto e URL."); return; }
      try { new URL(b.url); } catch { toast.error(`URL inválida: ${b.url}`); return; }
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("telegram-channel-post-send", {
      body: {
        bot_id: botId,
        content_type: contentType,
        text,
        media_url: mediaUrl || null,
        buttons,
        template_id: templateId || null,
        mode,
        scheduled_at: mode === "scheduled" ? new Date(scheduledAt).toISOString() : null,
        recurring_interval_minutes: mode === "recurring" ? Number(intervalMin) : null,
      },
    });
    setSubmitting(false);

    if (error || (data as any)?.error) {
      toast.error(`Erro: ${(data as any)?.error || error?.message || "tente novamente"}`);
      return;
    }
    toast.success(
      mode === "now" ? "Mensagem enviada!" :
      mode === "scheduled" ? "Envio agendado!" : "Recorrência criada!",
    );
    setDialogOpen(false);
    resetForm();
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("telegram_channel_posts" as any).delete().eq("id", id);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    toast.success("Removido.");
    load();
  }

  async function togglePause(p: Post) {
    if (p.mode !== "recurring") return;
    const nextStatus = p.status === "paused" ? "recurring" : "paused";
    const patch: any = { status: nextStatus };
    if (nextStatus === "recurring") {
      patch.next_run_at = new Date(Date.now() + (p.recurring_interval_minutes || 60) * 60_000).toISOString();
    }
    const { error } = await supabase.from("telegram_channel_posts" as any).update(patch).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  const canConfigure = !!chatId;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Enviar no Canal Free</h2>
          <p className="text-sm text-muted-foreground">
            {canConfigure
              ? `Disparos dentro do canal "${channelTitle}".`
              : "Configure o canal antes de enviar conteúdo."}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button disabled={!canConfigure}>
              <Plus className="w-4 h-4 mr-1.5" /> Novo envio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo envio no canal</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Modo */}
              <div className="space-y-2">
                <Label>Quando enviar</Label>
                <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="now"><Send className="w-4 h-4 mr-1.5" /> Agora</TabsTrigger>
                    <TabsTrigger value="scheduled"><CalendarIcon className="w-4 h-4 mr-1.5" /> Agendar</TabsTrigger>
                    <TabsTrigger value="recurring"><Repeat className="w-4 h-4 mr-1.5" /> Recorrente</TabsTrigger>
                  </TabsList>
                  <TabsContent value="scheduled" className="pt-3">
                    <Label htmlFor="when">Data e hora</Label>
                    <Input
                      id="when"
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </TabsContent>
                  <TabsContent value="recurring" className="pt-3 space-y-2">
                    <Label>Intervalo</Label>
                    <Select value={intervalMin} onValueChange={setIntervalMin}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {intervalPresets.map((p) => (
                          <SelectItem key={p.minutes} value={String(p.minutes)}>{p.label}</SelectItem>
                        ))}
                        <SelectItem value="custom-x" disabled>— ou personalizado abaixo —</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Intervalo em minutos"
                      value={intervalMin}
                      onChange={(e) => setIntervalMin(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Primeira execução acontece após o intervalo configurado.
                    </p>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Modelo salvo */}
              {templates.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Usar modelo salvo (opcional)</Label>
                  <Select value={templateId} onValueChange={applyTemplate}>
                    <SelectTrigger><SelectValue placeholder="Selecione um modelo..." /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tipo de conteúdo */}
              <div className="space-y-2">
                <Label>Tipo de conteúdo</Label>
                <Tabs value={contentType} onValueChange={(v) => { setContentType(v as ContentType); setMediaUrl(""); }}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="text"><MessageSquare className="w-4 h-4 mr-1.5" /> Texto</TabsTrigger>
                    <TabsTrigger value="photo"><ImageIcon className="w-4 h-4 mr-1.5" /> Foto</TabsTrigger>
                    <TabsTrigger value="video"><Video className="w-4 h-4 mr-1.5" /> Vídeo</TabsTrigger>
                    <TabsTrigger value="document"><FileText className="w-4 h-4 mr-1.5" /> Arquivo</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Mídia */}
              {contentType !== "text" && (
                <div className="space-y-2">
                  <Label>Mídia</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="URL pública da mídia"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                    />
                    <Button type="button" variant="outline" disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      accept={
                        contentType === "photo" ? "image/*" :
                        contentType === "video" ? "video/*" : "*/*"
                      }
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
                    />
                  </div>
                  {mediaUrl && contentType === "photo" && (
                    <img src={mediaUrl} alt="" className="max-h-40 rounded-md border" />
                  )}
                </div>
              )}

              {/* Texto / legenda */}
              <div className="space-y-1.5">
                <Label>{contentType === "text" ? "Mensagem" : "Legenda (opcional)"}</Label>
                <Textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Conteúdo da mensagem (HTML básico: <b>, <i>, <a href='...'>)"
                />
              </div>

              {/* Botões */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Botões (URL)</Label>
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => buttons.length < 6 && setButtons([...buttons, { text: "", url: "" }])}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
                {buttons.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
                    <Input placeholder="Texto" value={b.text}
                      onChange={(e) => { const n=[...buttons]; n[i]={...n[i],text:e.target.value}; setButtons(n); }} />
                    <div className="relative">
                      <LinkIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-8" placeholder="https://..." value={b.url}
                        onChange={(e) => { const n=[...buttons]; n[i]={...n[i],url:e.target.value}; setButtons(n); }} />
                    </div>
                    <Button type="button" variant="ghost" size="icon"
                      onClick={() => setButtons(buttons.filter((_, x) => x !== i))}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                {mode === "now" ? "Enviar agora" : mode === "scheduled" ? "Agendar" : "Criar recorrência"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Carregando envios...</Card>
      ) : posts.length === 0 ? (
        <Card className="p-10 text-center">
          <Send className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-foreground">Nenhum envio ainda</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Clique em "Novo envio" para mandar uma mensagem dentro do canal.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {posts.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(p)}
                    <span className="text-xs text-muted-foreground">
                      {p.content_type === "text" ? "Texto"
                        : p.content_type === "photo" ? "Foto"
                        : p.content_type === "video" ? "Vídeo" : "Arquivo"}
                    </span>
                    {p.mode === "recurring" && p.recurring_interval_minutes && (
                      <span className="text-xs text-muted-foreground">
                        • a cada {p.recurring_interval_minutes} min
                      </span>
                    )}
                    {p.mode === "scheduled" && (
                      <span className="text-xs text-muted-foreground">• {formatDt(p.scheduled_at)}</span>
                    )}
                  </div>
                  {p.text && (
                    <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">{p.text}</p>
                  )}
                  {p.media_url && p.content_type === "photo" && (
                    <img src={p.media_url} alt="" className="max-h-24 rounded border mt-1" />
                  )}
                  <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                    {p.last_sent_at && <span>Último envio: {formatDt(p.last_sent_at)}</span>}
                    {p.sent_count > 0 && <span>{p.sent_count}x enviado</span>}
                    {p.next_run_at && p.status !== "sent" && p.status !== "failed" && (
                      <span>Próximo: {formatDt(p.next_run_at)}</span>
                    )}
                  </div>
                  {p.last_error && (
                    <p className="text-xs text-destructive mt-1">{p.last_error}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.mode === "recurring" && (
                    <Button variant="outline" size="sm" onClick={() => togglePause(p)}>
                      {p.status === "paused" ? "Retomar" : "Pausar"}
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Excluir">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir envio?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(p.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}