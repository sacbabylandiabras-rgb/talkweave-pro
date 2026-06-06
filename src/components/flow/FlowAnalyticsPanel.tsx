import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Activity,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useFlowExecutionHistory } from '@/hooks/useFlowExecutionHistory';
import { useBlockAnalytics } from '@/hooks/useBlockAnalytics';
import { Node } from 'reactflow';

interface FlowAnalyticsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string | null;
  flowName: string;
  nodes: Node[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))'];

export const FlowAnalyticsPanel: React.FC<FlowAnalyticsPanelProps> = ({
  open,
  onOpenChange,
  flowId,
  flowName,
  nodes,
}) => {
  const {
    history,
    loading: historyLoading,
    fetchHistory,
    getStats,
  } = useFlowExecutionHistory(flowId);
  const {
    metrics,
    loading: metricsLoading,
    fetchMetrics,
    getOverallStats,
  } = useBlockAnalytics(flowId);

  useEffect(() => {
    if (open && flowId) {
      fetchHistory(50);
      fetchMetrics(nodes);
    }
  }, [open, flowId, nodes, fetchHistory, fetchMetrics]);

  const executionStats = getStats();
  const blockStats = getOverallStats();

  const executionTrend = [...history]
    .reverse()
    .map((exec) => ({
      time: new Date(exec.executedAt).toLocaleTimeString(),
      success: exec.status === 'success' ? 1 : 0,
      failed: exec.status === 'failed' ? 1 : 0,
    }))
    .slice(-20);

  const blockPerformance = Array.from(metrics.values())
    .map((m) => ({
      name: (m.blockLabel || m.blockType || m.blockId).slice(0, 20),
      success: m.successCount,
      failure: m.failureCount,
    }))
    .sort((a, b) => b.failure - a.failure);

  const successRateData = [
    { name: 'Sucesso', value: executionStats.successful },
    { name: 'Falha', value: executionStats.failed },
  ];

  const refresh = () => {
    fetchHistory(50);
    fetchMetrics(nodes);
  };

  const exportCsv = () => {
    const csv = [
      ['Métrica', 'Valor'],
      ['Total de Execuções', executionStats.total],
      ['Sucesso', executionStats.successful],
      ['Falhas', executionStats.failed],
      ['Taxa de Sucesso', `${executionStats.successRate}%`],
      ['Duração Média', `${executionStats.avgDuration}ms`],
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flowName}_analytics.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Analytics: {flowName}
          </DialogTitle>
          <DialogDescription>
            Métricas de execução e desempenho dos blocos
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
            disabled={historyLoading || metricsLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${historyLoading || metricsLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>

        <Tabs defaultValue="summary" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="executions">Execuções</TabsTrigger>
            <TabsTrigger value="blocks">Blocos</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 pr-4">
            <TabsContent value="summary" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{executionStats.total}</p>
                    </div>
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Taxa de Sucesso</p>
                      <p className="text-2xl font-bold">{executionStats.successRate}%</p>
                    </div>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Sucesso</p>
                      <p className="text-2xl font-bold text-primary">{executionStats.successful}</p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Falhas</p>
                      <p className="text-2xl font-bold text-destructive">{executionStats.failed}</p>
                    </div>
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                </Card>
              </div>

              {executionStats.total > 0 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Taxa de Sucesso vs Falha</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={successRateData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                          outerRadius={80}
                          dataKey="value"
                        >
                          {successRateData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="executions" className="space-y-4 mt-0">
              {executionTrend.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Tendência de Execuções</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={executionTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="success" stroke="hsl(var(--primary))" />
                        <Line type="monotone" dataKey="failed" stroke="hsl(var(--destructive))" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Histórico Recente</h3>
                <div className="space-y-2">
                  {history.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>
                  )}
                  {history.slice(0, 10).map((exec) => (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between p-2 rounded border border-border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {exec.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{exec.recipient}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(exec.executedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {exec.duration && (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {exec.duration}ms
                          </Badge>
                        )}
                        <Badge variant={exec.status === 'success' ? 'default' : 'destructive'}>
                          {exec.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="blocks" className="space-y-4 mt-0">
              {blockPerformance.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Desempenho por Bloco</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={blockPerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="success" fill="hsl(var(--primary))" />
                        <Bar dataKey="failure" fill="hsl(var(--destructive))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Métricas de Blocos
                </h3>
                <div className="space-y-3">
                  {metrics.size === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma métrica registrada.</p>
                  )}
                  {Array.from(metrics.values())
                    .sort((a, b) => b.executionCount - a.executionCount)
                    .map((metric) => (
                      <div key={metric.blockId} className="p-3 rounded border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium truncate">{metric.blockLabel}</p>
                          <Badge variant="outline">{metric.blockType}</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Execuções</p>
                            <p className="font-semibold text-sm">{metric.executionCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Taxa Sucesso</p>
                            <p className="font-semibold text-sm text-primary">
                              {metric.successRate.toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tempo Médio</p>
                            <p className="font-semibold text-sm">
                              {Math.round(metric.avgExecutionTime)}ms
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Falhas</p>
                            <p className="font-semibold text-sm text-destructive">
                              {metric.failureCount}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                {blockStats.totalExecutions > 0 && (
                  <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                    Total: {blockStats.totalExecutions} execuções · Taxa geral{' '}
                    {blockStats.overallSuccessRate.toFixed(1)}% · Tempo médio{' '}
                    {Math.round(blockStats.avgBlockExecutionTime)}ms
                  </div>
                )}
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};