import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, Send, Pause, Check, CheckCheck, ChevronDown, ChevronUp, Smartphone } from "lucide-react";

interface SendProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string | null;
  totalContacts: number;
  onPause?: () => void;
}

interface Stats {
  total: number;
  sending: number;
  pending: number;
  sent: number; // status === 'sent' (1 checkmark, sem confirmação de entrega)
  delivered: number; // status === 'delivered' (2 checkmarks, confirmado pelo WhatsApp)
  failed: number;
  lastError?: string | null;
}

interface CampaignSendRow {
  phone: string | null;
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  message_id?: string | null;
  error_message?: string | null;
  instance_name?: string | null;
  contact_name?: string | null;
}

const normalizePhoneKey = (phone?: string | null) => {
  if (!phone) return "";
  return phone.replace(/@lid$/i, "").replace(/\D/g, "");
};

const getSendTimestamp = (send?: Pick<CampaignSendRow, "delivered_at" | "sent_at" | "created_at"> | null) =>
  send?.delivered_at || send?.sent_at || send?.created_at || "";

export function SendProgressDialog({
  open,
  onOpenChange,
  campaignId,
  totalContacts,
  onPause,
}: SendProgressDialogProps) {
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
  const channelRef = useRef<any>(null);

  const resetProgressState = () => {
    setStats({
      total: totalContacts,
      sending: 0,
      pending: totalContacts,
      sent: 0,
      delivered: 0,
      failed: 0,
    });
    setIsComplete(false);
    setIsPaused(false);
    setIsPausing(false);
  };

  const handlePause = async () => {
    if (campaignId && !isPausing) {
      try {
        setIsPausing(true);
        const { error } = await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaignId);
        if (error) throw error;
        setIsPaused(true);
        setIsPausing(false);
        if (onPause) onPause();
      } catch (error) {
        console.error("Error pausing campaign:", error);
        setIsPausing(false);
      }
    }
  };

  useEffect(() => {
    if (!open || !campaignId) {
      resetProgressState();
      return;
    }

    resetProgressState();

    const fetchAndUpdate = async () => {
      const [{ data: sendRows, error: sendRowsError }, { data: campaignData }] = await Promise.all([
        supabase
          .from("campaign_sends")
          .select("phone, status, sent_at, delivered_at, created_at, message_id, error_message, instance_name, contact_name")
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: true }),
        supabase.from("campaigns").select("status, target_audience").eq("id", campaignId).single(),
      ]);

      if (sendRowsError) {
        console.error("Erro ao carregar progresso da campanha:", sendRowsError);
        return;
      }

      const targetContacts = Array.isArray((campaignData?.target_audience as any)?.contacts)
        ? (campaignData?.target_audience as any).contacts
        : [];

      const targetPhoneKeys = new Set<string>(
        targetContacts
          .map((contact: any) => normalizePhoneKey(contact?.phone))
          .filter((phoneKey: string) => Boolean(phoneKey)),
      );

      // Mantém apenas o registro de maior prioridade por telefone
      const sendsByPhone = new Map<string, CampaignSendRow>();
      (sendRows as CampaignSendRow[] | null | undefined)?.forEach((send) => {
        const phoneKey = normalizePhoneKey(send.phone) || String(send.phone || "");
        if (!phoneKey) return;

        const existing = sendsByPhone.get(phoneKey);
        // Prioridade: delivered (4) > sent (3) > pending com message_id (2) > failed (1) > pending (0)
        const getStatusPriority = (s?: string | null, row?: CampaignSendRow) => {
          if (s === "delivered") return 4;
          if (s === "failed" || (row?.error_message && s !== "delivered")) return 3;
          if (s === "sent") return 2;
          if (s === "pending" && (row?.message_id || row?.sent_at)) return 1.5;
          return 0;
        };

        const nextPriority = getStatusPriority(send.status, send);
        const currentPriority = getStatusPriority(existing?.status, existing);

        if (
          !existing ||
          nextPriority > currentPriority ||
          (nextPriority === currentPriority && getSendTimestamp(send) > getSendTimestamp(existing))
        ) {
          sendsByPhone.set(phoneKey, send);
        }
      });

      // Save deduped rows for the details list (sorted by most recent activity)
      const detailRows = Array.from(sendsByPhone.values()).sort(
        (a, b) => (getSendTimestamp(b) || "").localeCompare(getSendTimestamp(a) || ""),
      );
      setSendRows(detailRows);

      const allPhoneKeys = new Set<string>([...Array.from(targetPhoneKeys), ...Array.from(sendsByPhone.keys())]);

      const effectiveTotal = Math.max(totalContacts, allPhoneKeys.size);

      // ─── CONTAGEM CORRIGIDA ───────────────────────────────────────────────────
      // "sent"     = confirmado pelo servidor (1 check), NÃO inclui delivered
      // "delivered"= confirmado pelo WhatsApp (2 checks)
      // pending com message_id = o servidor enviou mas ainda aguarda ACK do WhatsApp → conta como "sent"
      // pending sem message_id = ainda não foi processado → conta como pending
      // ─────────────────────────────────────────────────────────────────────────
      let delivered = 0;
      let failed = 0;
      let sending = 0;
      let pending = 0;
      let sent = 0;
      let lastError: string | null = null;

      allPhoneKeys.forEach((phoneKey) => {
        const send = sendsByPhone.get(phoneKey);

        if (!send) {
          // Contato alvo sem nenhum registro ainda
          pending += 1;
        } else if (send.status === "delivered") {
          // Confirmado pelo WhatsApp (2 checks)
          delivered += 1;
        } else if (send.status === "failed" || (send.error_message && send.status !== "delivered")) {
          // Falhou ou tem mensagem de erro (e não foi entregue com sucesso depois)
          failed += 1;
          if (send.error_message) lastError = send.error_message;
        } else if (send.status === "sent") {
          // Enviado pelo servidor, aguardando confirmação de entrega (1 check)
          sent += 1;
        } else if (send.status === "pending") {
          if (send.message_id || send.sent_at) {
            // Já foi enviado pelo servidor mas ainda está com status "pending" no banco
            sent += 1;
          } else {
            // Ainda não foi processado
            pending += 1;
          }
        } else {
          pending += 1;
        }
      });

      // Total de processados = enviados + entregues + falhas
      const processed = sent + delivered + failed;

      const newStats: Stats = {
        total: effectiveTotal,
        sending,
        pending,
        sent,
        delivered,
        failed,
        lastError,
      };
      setStats(newStats);

      // ─── LÓGICA DE STATUS DA CAMPANHA ────────────────────────────────────────
      if (campaignData?.status === "completed") {
        // Campanha já marcada como completa no banco
        setIsComplete(true);
      } else if (campaignData?.status === "paused") {
        setIsComplete(false);
        setIsPaused(true);
        setIsPausing(false);
      } else if (campaignData?.status === "active") {
        setIsComplete(false);
        setIsPaused(false);

        // Considera completo quando não há mais pendentes e todos foram processados
        const allProcessed = effectiveTotal > 0 && pending === 0 && sending === 0;
        if (allProcessed) {
          setIsComplete(true);
          try {
            await supabase
              .from("campaigns")
              .update({ status: "completed", updated_at: new Date().toISOString() })
              .eq("id", campaignId);
          } catch (err) {
            console.warn("Falha ao marcar campanha como completa:", err);
          }
        }
      }
    };

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
          const status = (payload.new as any)?.status;
          fetchAndUpdate();
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
        if (status === "SUBSCRIBED") {
          fetchAndUpdate();
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [open, campaignId, totalContacts]);

  const effectiveTotal = Math.max(stats.total, totalContacts);

  // Barra de progresso: conta tudo que foi processado (enviado + entregue + falhas)
  const processed = stats.sent + stats.delivered + stats.failed;
  const progress = effectiveTotal > 0 ? (processed / effectiveTotal) * 100 : 0;

  // Taxa de sucesso final: (enviados + entregues) / total
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
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex gap-2 text-red-800 dark:text-red-300">
                <div className="mt-0.5">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider">Atenção ao Status de Envio</p>
                  <p className="text-sm leading-relaxed">{stats.lastError}</p>
                  {(stats.lastError.toLowerCase().includes("shadow ban") || stats.lastError.toLowerCase().includes("unauthorized")) && (
                    <div className="mt-2 pt-2 border-t border-red-200/50 dark:border-red-900/20">
                      <p className="text-xs italic opacity-80">
                        {stats.lastError.toLowerCase().includes("unauthorized") 
                          ? "Conexão perdida ou instância desconectada. Verifique seu WhatsApp."
                          : "Dica: Reduza a velocidade de envio ou troque o conteúdo para proteger seu número."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 relative">
            {/* Total */}
            <div className="space-y-1 p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Send className="w-3.5 h-3.5" />
                <span>Total</span>
              </div>
              <div className="text-xl font-bold">{effectiveTotal}</div>
            </div>

            {/* Pendentes */}
            <div className="space-y-1 p-2 bg-yellow-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Pendentes</span>
              </div>
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
            </div>

            {/* Enviados (1 check) — enviados pelo servidor, aguardando ACK do WhatsApp */}
            <div className="space-y-1 p-2 bg-blue-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                <Check className="w-4 h-4" />
                <span>Enviados (✓)</span>
              </div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.sent}</div>
            </div>

            {/* Entregues (2 checks) — confirmados pelo WhatsApp via webhook */}
            <div className="space-y-1 p-2 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <CheckCheck className="w-4 h-4" />
                <span>Entregues (✓✓)</span>
              </div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.delivered}</div>
            </div>

            {/* Falhas */}
            <div className="col-span-2 space-y-1 p-2 bg-red-500/10 rounded-lg border border-red-200/50 dark:border-red-500/20">
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <XCircle className="w-3.5 h-3.5" />
                <span>Falhas</span>
              </div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
            </div>
          </div>


          {isComplete && stats.total > 0 && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Taxa de Sucesso</div>
                <div className="text-3xl font-bold text-primary">{successRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.delivered > 0
                    ? `${stats.delivered} confirmados entregues pelo WhatsApp`
                    : `${stats.sent} enviados aguardando confirmação`}
                </div>
              </div>
            </div>
          )}

          {!isComplete && !isPaused && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Enviando mensagens... {stats.sending > 0 ? `(${stats.sending} em andamento)` : ""}</span>
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
                        return { icon: <CheckCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />, label: "Entregue" };
                      if (row.status === "sent" || (row.status === "pending" && (row.message_id || row.sent_at)))
                        return { icon: <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />, label: "Enviado" };
                      if (row.status === "failed")
                        return { icon: <XCircle className="w-3.5 h-3.5 text-red-500" />, label: "Falhou" };
                      return { icon: <Clock className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />, label: "Pendente" };
                    })();
                    return (
                      <div key={`${row.phone}-${idx}`} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {statusInfo.icon}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{row.contact_name || row.phone}</div>
                            <div className="text-muted-foreground truncate">{row.phone}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-muted-foreground">{statusInfo.label}</div>
                          {row.instance_name && (
                            <div className="text-[10px] text-muted-foreground/70 truncate max-w-[140px]" title={row.instance_name}>
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
