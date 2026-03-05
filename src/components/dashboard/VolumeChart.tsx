import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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
        const groupedByDate = sends.reduce((acc: Record<string, { total: number; sent: number; failed: number }>, send) => {
          const date = format(parseISO(send.created_at), 'dd/MM', { locale: ptBR });
          if (!acc[date]) acc[date] = { total: 0, sent: 0, failed: 0 };
          acc[date].total++;
          if (send.status === 'sent' || send.status === 'delivered') acc[date].sent++;
          else if (send.status === 'failed') acc[date].failed++;
          return acc;
        }, {});

        setChartData(Object.entries(groupedByDate).map(([date, data]) => ({
          date, volume: data.total, sent: data.sent, failed: data.failed,
        })));
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Volume Diário</span>
        </div>
        <p className="text-xs text-muted-foreground">Envie campanhas para ver o gráfico.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Volume Diário</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Total</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Enviadas</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Falhas</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
              padding: '8px',
            }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = { volume: 'Total', sent: 'Enviadas', failed: 'Falhas' };
              return [value, labels[name] || name];
            }}
          />
          <Area type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={2} fill="url(#colorVolume)" />
          <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={1.5} fill="url(#colorSent)" />
          <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={1.5} fill="url(#colorFailed)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
