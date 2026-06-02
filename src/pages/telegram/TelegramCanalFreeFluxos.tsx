import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Workflow, Play, Pause, Edit } from "lucide-react";
import { toast } from "sonner";

type TriggerType = "manual" | "scheduled" | "recurring" | "keyword";

type Flow = {
  id: string;
  name: string;
  trigger_type: TriggerType;
  nodes: any[];
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

function isScheduledForFuture(flow: Flow) {
  if (flow.trigger_type !== "scheduled" || !flow.next_run_at) return false;
  const scheduledAt = new Date(flow.next_run_at).getTime();
  return Number.isFinite(scheduledAt) && scheduledAt > Date.now();
}

export default function TelegramCanalFreeFluxos({
  botId, chatId, channelTitle,
}: { botId: string; chatId: number | null; channelTitle: string }) {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);

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
    if (isScheduledForFuture(flow)) {
      toast.info(`Este fluxo está agendado para ${fmt(flow.next_run_at)}. Ele não será disparado antes do horário.`);
      return;
    }
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
    navigate(`/telegram/canal-free/fluxos/novo?botId=${botId}`);
  }

  function openEdit(flow: Flow) {
    navigate(`/telegram/canal-free/fluxos/${flow.id}?botId=${botId}`);
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
                  {(f.nodes?.length ?? 0)} passo(s) · último disparo: {fmt(f.last_run_at)}
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
    </div>
  );
}