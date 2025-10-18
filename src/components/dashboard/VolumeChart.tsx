import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, TrendingUp } from "lucide-react";

interface ChartData {
  date: string;
  volume: number;
  sent: number;
  failed: number;
}

export function VolumeChart() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      const { data: sends } = await supabase
        .from('campaign_sends')
        .select('created_at, status')
        .order('created_at', { ascending: true });

      if (sends && sends.length > 0) {
        // Agrupar por data
        const groupedByDate = sends.reduce((acc: Record<string, { total: number; sent: number; failed: number }>, send) => {
          const date = format(parseISO(send.created_at), 'dd/MM', { locale: ptBR });
          
          if (!acc[date]) {
            acc[date] = { total: 0, sent: 0, failed: 0 };
          }
          
          acc[date].total++;
          
          if (send.status === 'sent' || send.status === 'delivered') {
            acc[date].sent++;
          } else if (send.status === 'failed') {
            acc[date].failed++;
          }
          
          return acc;
        }, {});

        // Converter para array
        const chartArray = Object.entries(groupedByDate).map(([date, data]) => ({
          date,
          volume: data.total,
          sent: data.sent,
          failed: data.failed,
        }));

        setChartData(chartArray);
        setTotalVolume(sends.length);
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Volume Diário de Mensagens
          </CardTitle>
          <CardDescription>Acompanhe o volume diário da sua empresa</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          Nenhum dado disponível ainda. Envie campanhas para ver o gráfico.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full backdrop-blur-sm bg-card/95 shadow-xl border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <TrendingUp className="w-6 h-6 text-primary" />
              Volume Diário de Mensagens
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Acompanhe o volume diário da sua empresa • Total: {totalVolume.toLocaleString('pt-BR')} mensagens
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-8">
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  volume: 'Total',
                  sent: 'Enviadas',
                  failed: 'Falhas'
                };
                return [value.toLocaleString('pt-BR'), labels[name] || name];
              }}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#10b981"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorVolume)"
              animationDuration={1500}
              animationEasing="ease-in-out"
            />
            <Area
              type="monotone"
              dataKey="sent"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSent)"
              animationDuration={1500}
              animationEasing="ease-in-out"
            />
            <Area
              type="monotone"
              dataKey="failed"
              stroke="#ef4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorFailed)"
              animationDuration={1500}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
        
        {/* Legenda personalizada */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-muted-foreground">Total de Mensagens</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-sm text-muted-foreground">Enviadas com Sucesso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-muted-foreground">Falhas</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
