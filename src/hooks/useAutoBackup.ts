import { useEffect, useRef, useCallback, useState } from 'react';
import { Node, Edge } from 'reactflow';
import { supabase } from '@/integrations/supabase/client';

interface BackupConfig {
  interval?: number; // ms, padrão: 30s
  enabled?: boolean;
  maxBackups?: number;
}

export const useAutoBackup = (
  nodes: Node[],
  edges: Edge[],
  flowId: string | null,
  flowName: string,
  config: BackupConfig = {}
) => {
  const {
    interval = 30000,
    enabled = true,
    maxBackups = 10,
  } = config;

  const lastBackupRef = useRef<number>(0);
  const backupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const performBackup = useCallback(async () => {
    if (!enabled || !flowId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const backupData = {
        user_id: user.id,
        flow_id: flowId,
        flow_name: flowName,
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        backed_up_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from('flow_backups')
        .insert(backupData);

      if (error) {
        console.warn('Erro ao fazer backup:', error);
        return;
      }

      // Limpar backups antigos
      const { data: allBackups } = await (supabase as any)
        .from('flow_backups')
        .select('id')
        .eq('flow_id', flowId)
        .order('backed_up_at', { ascending: false });

      if (allBackups && allBackups.length > maxBackups) {
        const toDelete = allBackups.slice(maxBackups);
        for (const backup of toDelete) {
          await (supabase as any)
            .from('flow_backups')
            .delete()
            .eq('id', backup.id);
        }
      }

      lastBackupRef.current = Date.now();
      setHasUnsavedChanges(false);

      console.log(`✓ Backup automático realizado para "${flowName}"`);
    } catch (err) {
      console.error('Erro ao fazer backup:', err);
    }
  }, [nodes, edges, flowId, flowName, enabled, maxBackups]);

  useEffect(() => {
    if (!enabled || !flowId) return;

    setHasUnsavedChanges(true);

    if (backupTimerRef.current) {
      clearTimeout(backupTimerRef.current);
    }

    backupTimerRef.current = setTimeout(() => {
      performBackup();
    }, interval);

    return () => {
      if (backupTimerRef.current) {
        clearTimeout(backupTimerRef.current);
      }
    };
  }, [nodes, edges, flowId, interval, enabled, performBackup]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && enabled) {
        performBackup();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, performBackup, enabled]);

  return {
    performBackup,
    hasUnsavedChanges,
    lastBackupTime: lastBackupRef.current,
  };
};