import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Clock, Send, Pause } from "lucide-react";

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
  sent: number;
  delivered: number;
  failed: number;
}

interface CampaignSendRow {
  phone: string | null;
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  message_id?: string | null;
}

const normalizePhoneKey = (phone?: string | null) => {
  if (!phone) return '';
  return phone.replace(/@lid$/i, '').replace(/\D/g, '');
};

const getSendPriority = (status?: string | null) => {
  if (status === 'delivered' || status === 'sent') return 3;
  if (status === 'failed') return 1;
  return 0;
};

const getSendTimestamp = (send?: Pick<CampaignSendRow, 'delivered_at' | 'sent_at' | 'created_at'> | null) =>
  send?.delivered_at || send?.sent_at || send?.created_at || '';

export function SendProgressDialog({ open, onOpenChange, campaignId, totalContacts, onPause }: SendProgressDialogProps) {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    sending: 0,
    pending: totalContacts,
    sent: 0,
    delivered: 0,
    failed: 0,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
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

        // 1. Update status to paused
        const { error } = await supabase
          .from('campaigns')
          .update({ status: 'paused' })
          .eq('id', campaignId);
        
        if (error) throw error;

        setIsPaused(true);
        setIsPausing(false);
        if (onPause) onPause();
      } catch (error) {
        console.error('Error pausing campaign:', error);
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
      const [
        { data: sendRows, error: sendRowsError },
        { data: campaignData },
      ] = await Promise.all([
        supabase
          .from('campaign_sends')
          .select('phone, status, sent_at, delivered_at, created_at, message_id')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: true }),
        supabase.from('campaigns').select('status, target_audience').eq('id', campaignId).single(),
      ]);

      if (sendRowsError) {
        console.error('Erro ao carregar progresso da campanha:', sendRowsError);
        return;
      }

      const targetContacts = Array.isArray((campaignData?.target_audience as any)?.contacts)
        ? (campaignData?.target_audience as any).contacts
        : [];

      const targetPhoneKeys = new Set<string>(
        targetContacts
          .map((contact: any) => normalizePhoneKey(contact?.phone))
          .filter((phoneKey: string) => Boolean(phoneKey))
      );

      const sendsByPhone = new Map<string, CampaignSendRow>();
      (sendRows as CampaignSendRow[] | null | undefined)?.forEach((send) => {
        const phoneKey = normalizePhoneKey(send.phone) || String(send.phone || '');
        if (!phoneKey) return;

        const existing = sendsByPhone.get(phoneKey);
        const nextPriority = send.status === 'pending' && Boolean(send.message_id || send.sent_at) ? 3 : getSendPriority(send.status);
        const currentPriority = getSendPriority(existing?.status);

        if (
          !existing ||
          nextPriority > currentPriority ||
          (nextPriority === currentPriority && getSendTimestamp(send) > getSendTimestamp(existing))
        ) {
          sendsByPhone.set(phoneKey, send);
        }
      });

      const allPhoneKeys = new Set<string>([
        ...Array.from(targetPhoneKeys),
        ...Array.from(sendsByPhone.keys()),
      ]);

      const effectiveTotal = Math.max(totalContacts, allPhoneKeys.size);
      let delivered = 0;
      let failed = 0;
      let sending = 0;
      let pending = 0;
      let sent = 0;

      allPhoneKeys.forEach((phoneKey) => {
        const send = sendsByPhone.get(phoneKey);
        if (send?.status === 'delivered' || send?.status === 'sent' || (send?.status === 'pending' && Boolean(send.message_id || send.sent_at))) {
          delivered += 1;
          sent += 1;
        } else if (send?.status === 'pending') {
          pending += 1;
        } else if (send?.status === 'failed') {
          failed += 1;
        } else {
          pending += 1;
        }
      });

      const newStats = {
        total: effectiveTotal,
        sending,
        pending,
        sent,
        delivered,
        failed,
      };
      setStats(newStats);

      if (campaignData?.status === 'completed') {
        const trulyDelivered = effectiveTotal > 0 && delivered >= effectiveTotal;
        setIsComplete(trulyDelivered);
        if (!trulyDelivered) {
          // Não rebaixar para "paused" só porque alguns callbacks ainda não chegaram.
          // Mensagens com status "sent" estão aguardando confirmação do WhatsApp e não
          // significam falha. Só voltamos para "active" se ainda há trabalho real pendente.
          if (sending + pending > 0) {
            await supabase
              .from('campaigns')
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq('id', campaignId);
          }
        }
        } else if (campaignData?.status === 'active') {
        setIsComplete(false);
        setIsPaused(false);
        // Só completa quando não há pendentes aguardando confirmação real.
        if (
          effectiveTotal > 0 &&
          sending === 0 &&
          pending === 0 &&
          delivered >= effectiveTotal
        ) {
          setIsComplete(true);
          try {
            await supabase
              .from('campaigns')
              .update({ status: 'completed', updated_at: new Date().toISOString() })
              .eq('id', campaignId);
          } catch (err) {
            console.warn('Falha ao marcar campanha como completa:', err);
          }
        }
      } else if (campaignData?.status === 'paused') {
        setIsComplete(false);
        setIsPaused(true);
        setIsPausing(false);
      } else if (
        campaignData?.status !== 'active' &&
        campaignData?.status !== 'paused' &&
        campaignData?.status !== 'draft' &&
        effectiveTotal > 0 && 
        newStats.pending === 0 &&
        delivered >= effectiveTotal
      ) {
        setIsComplete(true);
      }
    };

    const channel = supabase
      .channel(`progress-${campaignId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_sends', filter: `campaign_id=eq.${campaignId}` }, () => {
        fetchAndUpdate();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, (payload) => {
        const status = (payload.new as any)?.status;
        fetchAndUpdate();
        if (status === 'paused') { setIsPaused(true); setIsPausing(false); }
        if (status === 'active') { setIsPaused(false); setIsComplete(false); }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchAndUpdate();
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, [open, campaignId, totalContacts]);

  const effectiveTotal = Math.max(stats.total, totalContacts);
  const confirmedCount = stats.delivered;
  const progress = effectiveTotal > 0 ? ((confirmedCount + stats.failed) / effectiveTotal) * 100 : 0;

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Send className="w-4 h-4" />
                <span>Total</span>
              </div>
              <div className="text-2xl font-bold">{effectiveTotal}</div>
            </div>

            <div className="space-y-1 p-3 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Entregues</span>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {confirmedCount}
              </div>
            </div>

            <div className="space-y-1 p-3 bg-yellow-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                <Clock className="w-4 h-4" />
                <span>Pendentes</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.pending}
              </div>
            </div>

            <div className="space-y-1 p-3 bg-red-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircle className="w-4 h-4" />
                <span>Falhas</span>
              </div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.failed}
              </div>
            </div>

          </div>

          {isComplete && stats.total > 0 && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Taxa de Sucesso</div>
                <div className="text-3xl font-bold text-primary">
                  {Math.round((stats.delivered / stats.total) * 100)}%
                </div>
              </div>
            </div>
          )}

          {!isComplete && !isPaused && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Enviando mensagens... {stats.sending > 0 ? `(${stats.sending} em andamento)` : ''}</span>
              </div>
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={handlePause}
                  disabled={isPausing}
                  className="gap-2"
                >
                  <Pause className="w-4 h-4" />
                  {isPausing ? 'Pausando...' : 'Pausar Campanha'}
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
        </div>

        {(isComplete || isPaused) && (
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
