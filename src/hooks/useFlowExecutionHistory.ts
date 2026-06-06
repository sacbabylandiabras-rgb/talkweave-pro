import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FlowExecution {
  id: string;
  flowId: string;
  flowName: string;
  recipient: string;
  status: 'success' | 'failed' | 'pending' | 'cancelled';
  startTime: number;
  endTime?: number;
  duration?: number;
  nodesProcessed: number;
  nodesTotal: number;
  errorMessage?: string;
  lastNodeId?: string;
  executedAt: string;
}

export const useFlowExecutionHistory = (flowId: string | null) => {
  const [history, setHistory] = useState<FlowExecution[]>([]);
  const [loading, setLoading] = useState(false);

  const logExecution = useCallback(
    async (execution: Omit<FlowExecution, 'id' | 'executedAt'>) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const record = {
          user_id: user.id,
          flow_id: flowId,
          flow_name: execution.flowName,
          recipient: execution.recipient,
          status: execution.status,
          start_time: execution.startTime,
          end_time: execution.endTime,
          duration: execution.duration,
          nodes_processed: execution.nodesProcessed,
          nodes_total: execution.nodesTotal,
          error_message: execution.errorMessage,
          last_node_id: execution.lastNodeId,
          executed_at: new Date().toISOString(),
        };

        const { data, error } = await (supabase as any)
          .from('flow_executions')
          .insert(record)
          .select('id')
          .single();

        if (error) throw error;

        setHistory((prev) => [
          { ...execution, id: data.id, executedAt: record.executed_at },
          ...prev,
        ]);
      } catch (err) {
        console.error('Erro ao registrar execução:', err);
      }
    },
    [flowId]
  );

  const fetchHistory = useCallback(async (limit: number = 20) => {
    if (!flowId) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('flow_executions')
        .select('*')
        .eq('flow_id', flowId)
        .order('executed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      setHistory(
        (data || []).map((row: any) => ({
          id: row.id,
          flowId: row.flow_id,
          flowName: row.flow_name,
          recipient: row.recipient,
          status: row.status,
          startTime: row.start_time ?? new Date(row.executed_at).getTime(),
          endTime: row.end_time ? Number(row.end_time) : undefined,
          duration: row.duration,
          nodesProcessed: row.nodes_processed,
          nodesTotal: row.nodes_total,
          errorMessage: row.error_message,
          lastNodeId: row.last_node_id,
          executedAt: row.executed_at,
        }))
      );
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  const getStats = useCallback(() => {
    const total = history.length;
    const successful = history.filter((e) => e.status === 'success').length;
    const failed = history.filter((e) => e.status === 'failed').length;
    const avgDuration =
      history.reduce((sum, e) => sum + (e.duration || 0), 0) / Math.max(total, 1);

    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      successful,
      failed,
      successRate: successRate.toFixed(1),
      avgDuration: Math.round(avgDuration),
    };
  }, [history]);

  return {
    history,
    loading,
    logExecution,
    fetchHistory,
    getStats,
  };
};