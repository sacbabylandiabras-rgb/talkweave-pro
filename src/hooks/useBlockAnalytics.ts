import { useState, useCallback } from 'react';
import { Node } from 'reactflow';
import { supabase } from '@/integrations/supabase/client';

export interface BlockMetrics {
  blockId: string;
  blockLabel: string;
  blockType: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  avgExecutionTime: number;
  successRate: number;
}

export const useBlockAnalytics = (flowId: string | null) => {
  const [metrics, setMetrics] = useState<Map<string, BlockMetrics>>(new Map());
  const [loading, setLoading] = useState(false);

  const recordBlockExecution = useCallback(
    async (
      blockId: string,
      blockLabel: string,
      blockType: string,
      success: boolean,
      duration: number
    ) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !flowId) return;

        const { error } = await (supabase as any)
          .from('block_metrics')
          .insert({
            user_id: user.id,
            flow_id: flowId,
            block_id: blockId,
            block_label: blockLabel,
            block_type: blockType,
            success,
            duration,
            recorded_at: new Date().toISOString(),
          });

        if (error) throw error;

        setMetrics((prev) => {
          const updated = new Map(prev);
          const current = updated.get(blockId) || {
            blockId,
            blockLabel,
            blockType,
            executionCount: 0,
            successCount: 0,
            failureCount: 0,
            avgExecutionTime: 0,
            successRate: 0,
          };

          current.executionCount += 1;
          current.successCount += success ? 1 : 0;
          current.failureCount += success ? 0 : 1;
          current.avgExecutionTime =
            (current.avgExecutionTime * (current.executionCount - 1) + duration) /
            current.executionCount;
          current.successRate =
            (current.successCount / current.executionCount) * 100;

          updated.set(blockId, current);
          return updated;
        });
      } catch (err) {
        console.error('Erro ao registrar métrica:', err);
      }
    },
    [flowId]
  );

  const fetchMetrics = useCallback(async (nodes: Node[]) => {
    if (!flowId) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('block_metrics')
        .select('*')
        .eq('flow_id', flowId);

      if (error) throw error;

      const metricsMap = new Map<string, BlockMetrics>();

      for (const node of nodes) {
        const blockData = (data || []).filter((d: any) => d.block_id === node.id);

        if (blockData.length === 0) continue;

        const execCount = blockData.length;
        const successCount = blockData.filter((d: any) => d.success).length;
        const avgDuration =
          blockData.reduce((sum: number, d: any) => sum + (d.duration || 0), 0) /
          execCount;

        metricsMap.set(node.id, {
          blockId: node.id,
          blockLabel: node.data?.label ?? '',
          blockType: node.type ?? 'unknown',
          executionCount: execCount,
          successCount,
          failureCount: execCount - successCount,
          avgExecutionTime: avgDuration,
          successRate: (successCount / execCount) * 100,
        });
      }

      setMetrics(metricsMap);
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  const getOverallStats = useCallback(() => {
    let totalExecutions = 0;
    let totalSuccesses = 0;
    let totalDuration = 0;

    metrics.forEach((metric) => {
      totalExecutions += metric.executionCount;
      totalSuccesses += metric.successCount;
      totalDuration += metric.avgExecutionTime * metric.executionCount;
    });

    return {
      totalExecutions,
      totalSuccesses,
      totalFailures: totalExecutions - totalSuccesses,
      overallSuccessRate:
        totalExecutions > 0 ? (totalSuccesses / totalExecutions) * 100 : 0,
      avgBlockExecutionTime: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
      worstPerformingBlocks: Array.from(metrics.values())
        .sort((a, b) => a.successRate - b.successRate)
        .slice(0, 3),
    };
  }, [metrics]);

  return {
    metrics,
    loading,
    recordBlockExecution,
    fetchMetrics,
    getOverallStats,
  };
};