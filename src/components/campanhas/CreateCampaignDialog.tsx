import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { useContacts } from "@/hooks/useContacts";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { ROTATE_ALL } from "@/components/envio/InstanceSelector";
import { setZapiInstanceOverride, setZapiRotateMode } from "@/hooks/useZapi";
import { Users, Loader2, Search, MessageSquare, Clock, Calendar } from "lucide-react";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const { toast } = useToast();
  const { createCampaign, sendCampaign } = useCampaigns();
  const { templates } = useMessageTemplates();
  const { contacts, loading: loadingContacts } = useContacts({ enabled: open });
  const { instances: allInstances } = useZapiInstances();

  const instances = useMemo(() => allInstances.filter(i => {
    const provider = (i.api_provider || 'zapi').toLowerCase();
    const name = (i.instance_name || '').toLowerCase();
    if (name.includes('aquecimento') || name.includes('warmup')) return false;
    return provider !== 'meta';
  }), [allInstances]);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template_id: "",
    delay_seconds: 2,
    schedule_type: "immediate" as "immediate" | "scheduled",
    scheduled_at: "",
  });
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedTemplate = templates.find(t => t.id === formData.template_id);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return contacts.filter(c =>
      (c.name || "").toLowerCase().includes(q) || (c.phone || "").includes(q)
    );
  }, [contacts, searchQuery]);

  const togglePhone = (phone: string) => {
    setSelectedPhones(prev => prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]);
  };

  const selectAll = () => {
    if (selectedPhones.length === filteredContacts.length) {
      setSelectedPhones([]);
    } else {
      setSelectedPhones(filteredContacts.map(c => c.phone));
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({ title: "Erro", description: "Nome da campanha é obrigatório", variant: "destructive" });
      return;
    }
    if (!formData.template_id) {
      toast({ title: "Erro", description: "Selecione um modelo de mensagem", variant: "destructive" });
      return;
    }
    if (selectedPhones.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um contato", variant: "destructive" });
      return;
    }
    if (formData.schedule_type === 'scheduled' && !formData.scheduled_at) {
      toast({ title: "Erro", description: "Selecione data e hora do agendamento", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const contactList = selectedPhones.map(phone => {
        const c = contacts.find(x => x.phone === phone);
        return { phone, name: c?.name || "" };
      });

      const campaign = await createCampaign({
        name: formData.name,
        description: formData.description || `Campanha para ${selectedPhones.length} contato(s)`,
        template_id: formData.template_id,
        target_audience: { type: "contacts", contacts: contactList },
        delay_seconds: formData.delay_seconds,
        schedule_type: formData.schedule_type,
        scheduled_at: formData.schedule_type === 'scheduled' ? formData.scheduled_at : undefined,
      });

      if (formData.schedule_type === 'immediate') {
        let instanceToUse: string | null = null;
        if (selectedInstanceId === ROTATE_ALL) {
          setZapiRotateMode(instances);
        } else if (selectedInstanceId) {
          const inst = instances.find(i => i.id === selectedInstanceId);
          if (inst) {
            setZapiInstanceOverride(inst);
            instanceToUse = selectedInstanceId;
          }
        }
        await sendCampaign(campaign.id, contactList, instanceToUse);
      }

      toast({
        title: "Campanha criada",
        description: formData.schedule_type === 'scheduled'
          ? `Campanha "${formData.name}" agendada para ${new Date(formData.scheduled_at).toLocaleString('pt-BR')}`
          : `Campanha "${formData.name}" iniciada para ${selectedPhones.length} contato(s)`,
      });
      onOpenChange(false);
      setFormData({ name: "", description: "", template_id: "", delay_seconds: 2, schedule_type: "immediate", scheduled_at: "" });
      setSelectedPhones([]);
    } catch (error) {
      console.error("Error creating contact campaign:", error);
      toast({ title: "Erro", description: "Erro ao criar campanha", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Nova Campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da Campanha</Label>
            <Input
              placeholder="Ex: Promoção"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Modelo de Mensagem</Label>
              <Select
                value={formData.template_id}
                onValueChange={val => setFormData(prev => ({ ...prev, template_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {templates.filter(t => t.active).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Instância de Envio</Label>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância (ou rodízio)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROTATE_ALL}>Rodízio (Todas as instâncias)</SelectItem>
                  {instances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedTemplate && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Prévia:</p>
              <p className="text-sm whitespace-pre-wrap">{selectedTemplate.content}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Tipo de Envio</Label>
            </div>
            <RadioGroup
              value={formData.schedule_type}
              onValueChange={(val: "immediate" | "scheduled") => setFormData(prev => ({ ...prev, schedule_type: val }))}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="immediate" id="cc-now" />
                <Label htmlFor="cc-now" className="cursor-pointer text-sm">Enviar agora</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scheduled" id="cc-later" />
                <Label htmlFor="cc-later" className="cursor-pointer text-sm">Agendar horário</Label>
              </div>
            </RadioGroup>

            {formData.schedule_type === "scheduled" && (
              <div className="flex items-center gap-2 pl-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={e => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  className="flex-1"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}
          </div>

          <div>
            <Label>Intervalo entre envios (segundos)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={formData.delay_seconds}
              onChange={e => setFormData(prev => ({ ...prev, delay_seconds: parseInt(e.target.value) || 2 }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Selecionar Contatos ({selectedPhones.length})</Label>
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                {selectedPhones.length === filteredContacts.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contato..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {loadingContacts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando contatos...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Nenhum contato encontrado</div>
            ) : (
              <ScrollArea className="h-[280px] border border-border/50 rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredContacts.map(c => (
                    <label
                      key={c.phone}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedPhones.includes(c.phone)}
                        onCheckedChange={() => togglePhone(c.phone)}
                      />
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.name || c.phone}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Campanha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Legacy export kept for backwards compatibility
function _LegacySendProgressDialog({
  open,
  onOpenChange,
  campaignId,
  totalContacts,
  onPause,
}: { open: boolean; onOpenChange: (open: boolean) => void; campaignId: string | null; totalContacts: number; onPause?: () => void }) {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    sending: 0,
    pending: totalContacts,
    sent: 0,
    delivered: 0,
    failed: 0,
    lastError: null,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [sendRows, setSendRows] = useState<CampaignSendRow[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const resetState = useCallback(() => {
    setStats({ total: totalContacts, sending: 0, pending: totalContacts, sent: 0, delivered: 0, failed: 0 });
    setIsComplete(false);
    setIsPaused(false);
    setIsPausing(false);
  }, [totalContacts]);

  const handlePause = async () => {
    if (!campaignId || isPausing) return;
    setIsPausing(true);
    try {
      const { error } = await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaignId);
      if (error) throw error;
      setIsPaused(true);
      onPause?.();
    } catch (err) {
      console.error("Error pausing campaign:", err);
    } finally {
      setIsPausing(false);
    }
  };

  /**
   * FIX: fetchAndUpdate is now defined with useCallback outside the useEffect
   * so it has a stable reference and no stale closure over campaignId.
   */
  const fetchAndUpdate = useCallback(async () => {
    if (!campaignId) return;

    const [{ data: rows, error: rowsErr }, { data: campaignData }] = await Promise.all([
      supabase
        .from("campaign_sends")
        .select(
          "phone, status, sent_at, delivered_at, created_at, message_id, error_message, instance_name, contact_name",
        )
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true }),
      supabase.from("campaigns").select("status, target_audience").eq("id", campaignId).single(),
    ]);

    if (rowsErr) {
      console.error("Erro ao carregar progresso da campanha:", rowsErr);
      return;
    }

    const targetContacts: any[] = Array.isArray((campaignData?.target_audience as any)?.contacts)
      ? (campaignData?.target_audience as any).contacts
      : [];

    const targetPhoneKeys = new Set<string>(
      targetContacts.map((c: any) => normalizePhoneKey(c?.phone)).filter(Boolean),
    );

    // Deduplicate by phone, keeping highest-priority status
    const sendsByPhone = new Map<string, CampaignSendRow>();
    for (const send of (rows as CampaignSendRow[] | null) ?? []) {
      const phoneKey = normalizePhoneKey(send.phone) || String(send.phone ?? "");
      if (!phoneKey) continue;

      const existing = sendsByPhone.get(phoneKey);
      const np = getStatusPriority(send.status, send);
      const cp = getStatusPriority(existing?.status, existing);

      if (!existing || np > cp || (np === cp && getSendTimestamp(send) > getSendTimestamp(existing))) {
        sendsByPhone.set(phoneKey, send);
      } else if (existing && cp === 4 && np < 4 && np > 0 && !send.error_message && existing.error_message) {
        sendsByPhone.set(phoneKey, { ...send, error_message: existing.error_message, status: "failed" });
      }
    }

    const detailRows = Array.from(sendsByPhone.values()).sort((a, b) =>
      (getSendTimestamp(b) ?? "").localeCompare(getSendTimestamp(a) ?? ""),
    );
    setSendRows(detailRows);

    const allPhoneKeys = new Set([...targetPhoneKeys, ...sendsByPhone.keys()]);
    const effectiveTotal = Math.max(totalContacts, allPhoneKeys.size);

    let delivered = 0,
      failed = 0,
      sending = 0,
      pending = 0,
      sent = 0;
    let lastError: string | null = null;

    allPhoneKeys.forEach((key) => {
      const s = sendsByPhone.get(key);
      if (!s) {
        pending++;
        return;
      }
      if (s.status === "delivered") {
        delivered++;
        return;
      }
      if (s.status === "failed" || (s.error_message && s.status !== "delivered")) {
        failed++;
        if (s.error_message) lastError = s.error_message;
        return;
      }
      if (s.status === "sent") {
        sent++;
        return;
      }
      if (s.status === "pending") {
        if (s.message_id || s.sent_at) {
          sent++;
        } else {
          pending++;
        }
        return;
      }
      pending++;
    });

    setStats({ total: effectiveTotal, sending, pending, sent, delivered, failed, lastError });

    if (campaignData?.status === "completed") {
      setIsComplete(true);
    } else if (campaignData?.status === "paused") {
      setIsComplete(false);
      setIsPaused(true);
      setIsPausing(false);
    } else if (campaignData?.status === "active") {
      setIsComplete(false);
      setIsPaused(false);
      const allProcessed = effectiveTotal > 0 && pending === 0 && sending === 0;
      if (allProcessed) {
        setIsComplete(true);
        try {
          await supabase
            .from("campaigns")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", campaignId);
        } catch (e) {
          console.warn("Falha ao marcar campanha como completa:", e);
        }
      }
    }
  }, [campaignId, totalContacts]);

  useEffect(() => {
    if (!open || !campaignId) {
      resetState();
      return;
    }

    resetState();

    // FIX: clean up existing channel BEFORE creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`progress-${campaignId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_sends", filter: `campaign_id=eq.${campaignId}` },
        () => {
          fetchAndUpdate();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "campaigns", filter: `id=eq.${campaignId}` },
        (payload) => {
          fetchAndUpdate();
          const status = (payload.new as any)?.status;
          if (status === "paused") {
            setIsPaused(true);
            setIsPausing(false);
          }
          if (status === "active") {
            setIsPaused(false);
            setIsComplete(false);
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchAndUpdate();
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [open, campaignId, fetchAndUpdate, resetState]);

  const effectiveTotal = Math.max(stats.total, totalContacts);
  const processed = stats.sent + stats.delivered + stats.failed;
  const progress = effectiveTotal > 0 ? (processed / effectiveTotal) * 100 : 0;
  const successCount = stats.sent + stats.delivered;
  const successRate = stats.total > 0 ? Math.round((successCount / stats.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isComplete ? "Envio Concluído!" : isPaused ? "Campanha Pausada" : "Enviando Campanha..."}
          </DialogTitle>
          <DialogDescription>
            {isComplete
              ? "A campanha foi enviada com sucesso"
              : isPaused
                ? "A campanha foi pausada. Você pode retomá-la na lista de campanhas"
                : "Aguarde enquanto as mensagens são enviadas"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {stats.failed > 0 && stats.lastError && !stats.lastError.toLowerCase().includes("@lid") && (
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg">
              <div className="flex gap-2 text-red-800 dark:text-red-300">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider">Atenção ao Status de Envio</p>
                  <p className="text-sm leading-relaxed">{stats.lastError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Send className="w-3.5 h-3.5" />
                <span>Total</span>
              </div>
              <div className="text-xl font-bold">{effectiveTotal}</div>
            </div>
            <div className="space-y-1 p-2 bg-yellow-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Pendentes</span>
              </div>
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
            </div>
            <div className="space-y-1 p-2 bg-blue-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <Check className="w-4 h-4" />
                <span>Enviados (✓)</span>
              </div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.sent}</div>
            </div>
            <div className="space-y-1 p-2 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <CheckCheck className="w-4 h-4" />
                <span>Entregues (✓✓)</span>
              </div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.delivered}</div>
            </div>
            <div className="col-span-2 space-y-1 p-2 bg-red-500/10 rounded-lg border border-red-200/50 dark:border-red-500/20">
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <XCircle className="w-3.5 h-3.5" />
                <span>Falhas</span>
              </div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            </div>
          </div>

          {isComplete && stats.total > 0 && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg text-center">
              <div className="text-sm text-muted-foreground mb-1">Taxa de Sucesso</div>
              <div className="text-3xl font-bold text-primary">{successRate}%</div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.delivered > 0
                  ? `${stats.delivered} confirmados entregues pelo WhatsApp`
                  : `${stats.sent} enviados aguardando confirmação`}
              </div>
            </div>
          )}

          {!isComplete && !isPaused && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                <span>Enviando mensagens...</span>
              </div>
              <div className="flex justify-center">
                <Button variant="outline" onClick={handlePause} disabled={isPausing} className="gap-2">
                  <Pause className="w-4 h-4" />
                  {isPausing ? "Pausando..." : "Pausar Campanha"}
                </Button>
              </div>
            </div>
          )}

          {isPaused && (
            <div className="flex items-center justify-center gap-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 p-3 rounded-lg">
              <Pause className="w-4 h-4" />
              <span>Campanha pausada com sucesso</span>
            </div>
          )}

          {sendRows.length > 0 && (
            <div className="border rounded-lg">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Detalhes por envio ({sendRows.length})
                </span>
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showDetails && (
                <div className="max-h-64 overflow-y-auto border-t divide-y divide-border/50">
                  {sendRows.map((row, idx) => {
                    const statusInfo = (() => {
                      if (row.status === "delivered")
                        return {
                          icon: <CheckCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />,
                          label: "Entregue",
                        };
                      if (row.status === "failed" || (row.error_message && row.status !== "delivered"))
                        return { icon: <XCircle className="w-3.5 h-3.5 text-red-500" />, label: "Falhou" };
                      if (row.status === "sent" || (row.status === "pending" && (row.message_id || row.sent_at)))
                        return {
                          icon: <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
                          label: "Enviado",
                        };
                      return {
                        icon: <Clock className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />,
                        label: "Pendente",
                      };
                    })();
                    return (
                      <div
                        key={`${row.phone}-${idx}`}
                        className="px-3 py-2 text-xs flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {statusInfo.icon}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{row.contact_name ?? row.phone}</div>
                            <div className="text-muted-foreground truncate">{row.phone}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-muted-foreground">{statusInfo.label}</div>
                          {row.instance_name && (
                            <div className="text-[10px] text-muted-foreground/70 truncate max-w-[140px]">
                              via {row.instance_name}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {(isComplete || isPaused) && (
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
