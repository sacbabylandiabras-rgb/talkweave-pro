import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Webhook, Plus, Trash2, RefreshCw, Copy, Pencil, MessageSquare, History, GitBranch, Smartphone, Zap, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import IntegrationFlowEditor from "@/components/gateway/IntegrationFlowEditor";
import { useToast } from "@/hooks/use-toast";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const EVENT_TYPES = [
  { value: "payment_pending", label: "Pagamento Pendente" },
  { value: "payment_approved", label: "Pagamento Aprovado" },
  { value: "payment_refused", label: "Pagamento Recusado" },
  { value: "payment_refunded", label: "Pagamento Estornado" },
  { value: "payment_cancelled", label: "Pagamento Cancelado" },
];

interface Funnel {
  id: string;
  event_type: string;
  event_label: string;
  message_template: string;
  active: boolean;
  delay_seconds: number;
  button_label: string | null;
  button_url: string | null;
  instance_ids: string[];
}

interface WebhookLog {
  id: string;
  event_type: string | null;
  phone: string | null;
  message_sent: string | null;
  status: string | null;
  created_at: string;
}

const GatewayIntegracoes = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFlowEditor, setShowFlowEditor] = useState(false);

  // Form
  const [eventType, setEventType] = useState("payment_approved");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [zlpStatus, setZlpStatus] = useState<{ id: string; active: boolean } | null>(null);
  const [zlpLoading, setZlpLoading] = useState(false);

  const { toast } = useToast();
  const { instances } = useZapiInstances();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        loadData(data.user.id);
        loadZaplynxPayIntegration(data.user.id);
      }
    });
  }, []);

  const loadData = async (uid: string) => {
    setLoading(true);
    const [funnelsRes, logsRes] = await Promise.all([
      supabase.from("gateway_funnels").select("*").eq("user_id", uid).order("created_at"),
      supabase.from("gateway_webhook_logs").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
    ]);
    setFunnels((funnelsRes.data as unknown as Funnel[]) || []);
    setLogs((logsRes.data as unknown as WebhookLog[]) || []);
    setLoading(false);
  };

  const loadZaplynxPayIntegration = async (uid: string) => {
    const { data } = await supabase
      .from("gateway_integrations")
      .select("id, active")
      .eq("user_id", uid)
      .eq("name", "ZapLynx")
      .maybeSingle();
    if (data) setZlpStatus({ id: data.id, active: data.active });
  };

  const handleConnectZaplynxPay = async () => {
    if (!userId) return;
    setZlpLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-gateway?user_id=${userId}`;
      const payload = {
        user_id: userId,
        name: "ZapLynx",
        webhook_url: url,
        method: "POST",
        auth_type: "none",
        active: true,
      };
      if (zlpStatus) {
        const { error } = await supabase
          .from("gateway_integrations")
          .update({ webhook_url: url, active: true })
          .eq("id", zlpStatus.id);
        if (error) throw error;
        setZlpStatus({ ...zlpStatus, active: true });
      } else {
        const { data, error } = await supabase
          .from("gateway_integrations")
          .insert(payload)
          .select("id, active")
          .single();
        if (error) throw error;
        setZlpStatus({ id: data.id, active: data.active });
      }
      toast({ title: "Integração ativada!", description: "Seu ZaplynxPay agora envia os eventos automaticamente para o ZapLynx." });
    } catch (error: any) {
      toast({ title: "Erro ao conectar", description: error.message, variant: "destructive" });
    } finally {
      setZlpLoading(false);
    }
  };

  const webhookUrl = userId
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-gateway?user_id=${userId}`
    : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "URL copiada!" });
  };

  const openCreate = () => {
    setEditingId(null);
    setEventType("payment_approved");
    setMessageTemplate("Olá {{nome}}! Seu pagamento de {{valor}} foi aprovado! 🎉");
    setDelaySeconds(0);
    setButtonLabel("");
    setButtonUrl("");
    setSelectedInstanceIds([]);
    setDialogOpen(true);
  };

  const openEdit = (f: Funnel) => {
    setEditingId(f.id);
    setEventType(f.event_type);
    setMessageTemplate(f.message_template);
    setDelaySeconds(f.delay_seconds);
    setButtonLabel(f.button_label || "");
    setButtonUrl(f.button_url || "");
    setSelectedInstanceIds(f.instance_ids || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!messageTemplate || !userId) return;
    setSaving(true);
    try {
      const label = EVENT_TYPES.find(e => e.value === eventType)?.label || eventType;
      const payload = {
        user_id: userId,
        event_type: eventType,
        event_label: label,
        message_template: messageTemplate,
        delay_seconds: delaySeconds,
        button_label: buttonLabel || null,
        button_url: buttonUrl || null,
        instance_ids: selectedInstanceIds.length > 0 ? selectedInstanceIds : null,
        active: true,
      };

      if (editingId) {
        const { error } = await supabase.from("gateway_funnels").update(payload as any).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("gateway_funnels").insert(payload as any);
        if (error) throw error;
      }

      toast({ title: editingId ? "Funil atualizado!" : "Funil criado!" });
      setDialogOpen(false);
      loadData(userId);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    await supabase.from("gateway_funnels").delete().eq("id", id);
    toast({ title: "Funil removido" });
    loadData(userId);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("gateway_funnels").update({ active } as any).eq("id", id);
    setFunnels(prev => prev.map(f => f.id === id ? { ...f, active } : f));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">


      {/* URL Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            Sua URL de Webhook
          </CardTitle>
          <CardDescription>Cole esta URL no seu gateway de pagamento ou checkout</CardDescription>
        </CardHeader>
        <CardContent>
          {userId ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button onClick={copyUrl} className="shrink-0">
                <Copy className="w-4 h-4 mr-2" /> Copiar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          )}

          {userId && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    Integrar com ZaplynxPay
                    {zlpStatus?.active && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-0 text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Conectado
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Configure automaticamente o webhook no seu gateway ZaplynxPay</p>
                </div>
              </div>
              <Button
                onClick={handleConnectZaplynxPay}
                disabled={zlpLoading}
                size="sm"
                className="shrink-0"
                variant={zlpStatus?.active ? "outline" : "default"}
              >
                {zlpLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {zlpStatus?.active ? "Reconectar" : "Conectar agora"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Funnel + Logs */}
      <Tabs defaultValue="funnel">
        <TabsList>
          <TabsTrigger value="funnel" className="gap-1">
            <MessageSquare className="w-4 h-4" /> Funil de Mensagens
          </TabsTrigger>
          <TabsTrigger value="flow" className="gap-1">
            <GitBranch className="w-4 h-4" /> Fluxo Visual
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1">
            <History className="w-4 h-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Configure mensagens automáticas para cada evento</p>
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Novo Funil
            </Button>
          </div>

          {funnels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-10 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="font-semibold mb-1">Nenhum funil configurado</p>
                <p className="text-sm text-muted-foreground mb-4">Crie um funil para enviar mensagens automáticas quando receber um webhook</p>
                <Button onClick={openCreate} size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Criar Funil
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {funnels.map(f => (
                <div
                  key={f.id}
                  className="px-4 py-3 shadow-lg rounded-lg border-2 border-blue-500 bg-card min-w-[200px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-blue-500/10">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-card-foreground">
                          {EVENT_TYPES.find(e => e.value === f.event_type)?.label || f.event_type}
                        </span>
                        {f.delay_seconds > 0 && (
                          <Badge variant="outline" className="text-xs">⏱ {f.delay_seconds}s</Badge>
                        )}
                        {f.button_label && (
                          <Badge variant="outline" className="text-xs">🔗 {f.button_label}</Badge>
                        )}
                        {f.instance_ids && f.instance_ids.length > 0 ? (
                          <Badge variant="outline" className="text-xs">
                            📱 {f.instance_ids.length} instância{f.instance_ids.length > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-destructive">⚠ Sem instância</Badge>
                        )}
                        {!f.active && (
                          <Badge variant="secondary" className="text-xs">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{f.message_template}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={f.active} onCheckedChange={(v) => handleToggle(f.id, v)} />
                      <Button variant="outline" size="icon" onClick={() => openEdit(f)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(f.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Card className="border-dashed">
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground font-semibold mb-2">Variáveis disponíveis:</p>
              <div className="flex flex-wrap gap-2">
                {["{{nome}}", "{{valor}}", "{{produto}}", "{{telefone}}", "{{status}}", "{{link}}", "{{link_pedido}}"].map(v => (
                  <Badge key={v} variant="outline" className="font-mono text-xs">{v}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flow">
          <IntegrationFlowEditor onBack={() => {}} />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {logs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum webhook recebido ainda</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <Card key={log.id}>
                  <CardContent className="py-3 flex items-center gap-4">
                    <Badge variant={log.status === "sent" ? "default" : log.status === "error" ? "destructive" : "secondary"} className="text-xs shrink-0">
                      {log.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{log.event_type || "—"}</span>
                        {log.phone && <span className="text-muted-foreground">• {log.phone}</span>}
                      </div>
                      {log.message_sent && (
                        <p className="text-xs text-muted-foreground truncate">{log.message_sent}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(log.created_at), "dd/MM HH:mm")}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Funil" : "Novo Funil"}</DialogTitle>
            <DialogDescription>Configure a mensagem automática para um evento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(e => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
                placeholder="Olá {{nome}}! Seu pagamento de {{valor}} foi aprovado! 🎉"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use: {"{{nome}}"}, {"{{valor}}"}, {"{{produto}}"}, {"{{telefone}}"}, {"{{status}}"}, {"{{link}}"}, {"{{link_pedido}}"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Atraso (segundos)</Label>
              <Input
                type="number"
                min={0}
                value={delaySeconds}
                onChange={e => setDelaySeconds(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Texto do Botão (opcional)</Label>
              <Input
                value={buttonLabel}
                onChange={e => setButtonLabel(e.target.value)}
                placeholder="Ex: Acessar Pedido"
              />
            </div>
            <div className="space-y-2">
              <Label>Link do Botão (opcional)</Label>
              <Input
                value={buttonUrl}
                onChange={e => setButtonUrl(e.target.value)}
                placeholder="Ex: https://exemplo.com ou {{link}}"
              />
              <p className="text-xs text-muted-foreground">
                Se preenchido, o botão usará este link. Use {"{{link}}"} para link dinâmico do payload. Se vazio, será extraído automaticamente do webhook.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Instâncias de envio
              </Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {instances.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma instância configurada</p>
                ) : (
                  instances.map((inst) => {
                    const checked = selectedInstanceIds.includes(inst.id);
                    return (
                      <div key={inst.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`inst-${inst.id}`}
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (v) {
                              setSelectedInstanceIds(prev => [...prev, inst.id]);
                            } else {
                              setSelectedInstanceIds(prev => prev.filter(id => id !== inst.id));
                            }
                          }}
                        />
                        <label htmlFor={`inst-${inst.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                          {inst.instance_name}
                          {inst.is_default && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Padrão</span>
                          )}
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione as instâncias que serão usadas no revezamento. Se mais de uma, o sistema alterna entre elas.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GatewayIntegracoes;
