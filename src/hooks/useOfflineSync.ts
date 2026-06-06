import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OfflinePendingAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  flowId: string;
  flowData: any;
  timestamp: number;
  retries: number;
  maxRetries?: number;
}

export const useOfflineSync = (flowId: string | null) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<OfflinePendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const performSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);

    try {
      const stored = localStorage.getItem('pending_flow_actions');
      const actions: OfflinePendingAction[] = stored ? JSON.parse(stored) : [];

      if (actions.length === 0) {
        setIsSyncing(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const remainingActions: OfflinePendingAction[] = [];

      for (const action of actions) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Não autenticado');

          if (action.type === 'create' || action.type === 'update') {
            const { error } = await (supabase as any)
              .from('flow_automations')
              .upsert({
                ...action.flowData,
                user_id: user.id,
              })
              .eq('id', action.flowId);

            if (error) throw error;
            successCount++;
          } else if (action.type === 'delete') {
            const { error } = await (supabase as any)
              .from('flow_automations')
              .delete()
              .eq('id', action.flowId);

            if (error) throw error;
            successCount++;
          }
        } catch (err: any) {
          failCount++;
          action.retries = (action.retries || 0) + 1;

          if ((action.maxRetries || 3) > action.retries) {
            remainingActions.push(action);
          }

          console.error(`Erro sincronizando ação ${action.id}:`, err);
        }
      }

      if (remainingActions.length > 0) {
        localStorage.setItem('pending_flow_actions', JSON.stringify(remainingActions));
        setPendingActions(remainingActions);
        toast.warning(
          `${successCount} sincronizados, ${failCount} falharam`,
          { description: 'Tentará novamente em breve' }
        );
      } else {
        localStorage.removeItem('pending_flow_actions');
        setPendingActions([]);
        if (successCount > 0) {
          toast.success(`${successCount} alterações sincronizadas! ✓`);
        }
      }
    } catch (err) {
      console.error('Erro na sincronização:', err);
      toast.error('Erro ao sincronizar');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Detectar mudanças de conexão
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexão restaurada', { description: 'Sincronizando dados...' });
      performSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Modo offline', {
        description: 'Alterações serão sincronizadas quando conectado',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSync]);

  // Carregar ações pendentes do storage ao montar
  useEffect(() => {
    const stored = localStorage.getItem('pending_flow_actions');
    if (stored) {
      try {
        setPendingActions(JSON.parse(stored));
      } catch {
        localStorage.removeItem('pending_flow_actions');
      }
    }
  }, []);

  const addPendingAction = useCallback(
    (action: Omit<OfflinePendingAction, 'id' | 'retries'>) => {
      const newAction: OfflinePendingAction = {
        ...action,
        id: `${Date.now()}_${Math.random()}`,
        retries: 0,
        maxRetries: 3,
      };

      const stored = localStorage.getItem('pending_flow_actions');
      const actions: OfflinePendingAction[] = stored ? JSON.parse(stored) : [];
      actions.push(newAction);
      localStorage.setItem('pending_flow_actions', JSON.stringify(actions));

      setPendingActions(actions);
      toast.info('Alteração salva offline', { duration: 2000 });

      return newAction;
    },
    []
  );

  // Tentar sincronizar periodicamente
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(performSync, 5000);
    return () => clearInterval(interval);
  }, [isOnline, performSync]);

  return {
    isOnline,
    pendingActions,
    addPendingAction,
    performSync,
    isSyncing,
  };
};