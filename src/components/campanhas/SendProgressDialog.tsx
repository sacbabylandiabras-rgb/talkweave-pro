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
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
}

export function SendProgressDialog({ open, onOpenChange, campaignId, totalContacts, onPause }: SendProgressDialogProps) {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: totalContacts,
    sent: 0,
    delivered: 0,
    failed: 0,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const handlePause = async () => {
    if (campaignId && !isPausing) {
      try {
        setIsPausing(true);
        const { error } = await supabase
          .from('campaigns')
          .update({ status: 'paused' })
          .eq('id', campaignId);
        
        if (error) throw error;
        setIsPaused(true);
        if (onPause) onPause();
      } catch (error) {
        console.error('Error pausing campaign:', error);
        setIsPausing(false);
      }
    }
  };

  useEffect(() => {
    if (!open || !campaignId) {
      setStats({ total: 0, pending: totalContacts, sent: 0, delivered: 0, failed: 0 });
      setIsComplete(false);
      setIsPaused(false);
      setIsPausing(false);
      return;
    }

    const computeStats = (data: Array<{ status: string | null }>) => {
      return {
        total: data.length,
        pending: data.filter(s => s.status === 'pending').length,
        sent: data.filter(s => s.status === 'sent').length,
        delivered: data.filter(s => s.status === 'delivered').length,
        failed: data.filter(s => s.status === 'failed').length,
      };
    };

    const fetchAndUpdate = async () => {
      const [
        { data: sends },
        { data: campaignData }
      ] = await Promise.all([
        supabase.from('campaign_sends').select('status').eq('campaign_id', campaignId),
        supabase.from('campaigns').select('status').eq('id', campaignId).single()
      ]);

      if (sends) {
        const newStats = computeStats(sends);
        setStats(newStats);

        // Only mark complete if the campaign status is actually 'completed' in the DB
        if (campaignData?.status === 'completed') {
          setIsComplete(true);
        } else if (campaignData?.status === 'active') {
          // Campaign is actively sending — ensure we don't show as complete
          setIsComplete(false);
          setIsPaused(false);
        } else if (campaignData?.status === 'paused') {
          // Campaign is paused — never mark as complete (user may resume)
          setIsComplete(false);
        } else if (
          campaignData?.status !== 'active' &&
          campaignData?.status !== 'paused' &&
          totalContacts > 0 && 
          sends.length >= totalContacts && 
          newStats.pending === 0
        ) {
          setIsComplete(true);
        }
      }

      if (campaignData?.status === 'paused') {
        setIsPaused(true);
        setIsPausing(false);
      }
    };

    // Initial fetch
    const initialDelay = setTimeout(() => {
      fetchAndUpdate();

      // Realtime subscription for instant updates
      const channel = supabase
        .channel(`progress-${campaignId}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_sends', filter: `campaign_id=eq.${campaignId}` }, () => {
          fetchAndUpdate();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, (payload) => {
          const status = (payload.new as any)?.status;
          if (status === 'completed') setIsComplete(true);
          if (status === 'paused') { setIsPaused(true); setIsPausing(false); }
        })
        .subscribe();

      channelRef.current = channel;

      // Lightweight polling fallback every 2s
      pollingRef.current = setInterval(fetchAndUpdate, 2000);
    }, 300);

    return () => {
      clearTimeout(initialDelay);
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [open, campaignId, totalContacts]);

  const progress = totalContacts > 0 ? ((stats.sent + stats.delivered + stats.failed) / totalContacts) * 100 : 0;

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
              <div className="text-2xl font-bold">{totalContacts}</div>
            </div>

            <div className="space-y-1 p-3 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Enviadas</span>
              </div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.sent + stats.delivered}
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
                  {Math.round(((stats.sent + stats.delivered) / stats.total) * 100)}%
                </div>
              </div>
            </div>
          )}

          {!isComplete && !isPaused && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Enviando mensagens...</span>
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
