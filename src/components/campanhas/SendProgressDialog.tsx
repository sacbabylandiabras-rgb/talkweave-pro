import { useState, useEffect } from "react";
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

  const handlePause = async () => {
    if (campaignId) {
      try {
        // Update campaign status to paused
        await supabase
          .from('campaigns')
          .update({ status: 'paused' })
          .eq('id', campaignId);
        
        setIsPaused(true);
        
        // Call the onPause callback if provided
        if (onPause) {
          onPause();
        }
      } catch (error) {
        console.error('Error pausing campaign:', error);
      }
    }
  };

  useEffect(() => {
    if (!open || !campaignId) {
      setStats({
        total: 0,
        pending: totalContacts,
        sent: 0,
        delivered: 0,
        failed: 0,
      });
      setIsComplete(false);
      setIsPaused(false);
      return;
    }

    // Poll for updates every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('campaign_sends')
          .select('status')
          .eq('campaign_id', campaignId);

        if (error) throw error;

        const newStats = {
          total: data.length,
          pending: data.filter(s => s.status === 'pending').length,
          sent: data.filter(s => s.status === 'sent').length,
          delivered: data.filter(s => s.status === 'delivered').length,
          failed: data.filter(s => s.status === 'failed').length,
        };

        setStats(newStats);

        // Check if complete (no pending messages)
        if (data.length >= totalContacts && newStats.pending === 0) {
          setIsComplete(true);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling campaign stats:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
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
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Stats Grid */}
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

          {/* Success Rate */}
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

          {/* Loading indicator or Pause button */}
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
                  className="gap-2"
                >
                  <Pause className="w-4 h-4" />
                  Pausar Campanha
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
