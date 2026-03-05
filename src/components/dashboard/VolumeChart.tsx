import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface ChartData {
  date: string;
  enviadas: number;
  entregues: number;
  erros: number;
}

export function VolumeChart() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [visible, setVisible] = useState({ enviadas: true, entregues: true, erros: true });

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      const { data: sends } = await supabase
        .from("campaign_sends")
        .select("created_at, status")
        .order("created_at", { ascending: true });

      if (sends && sends.length > 0) {
        const grouped = sends.reduce((acc: Record<string, { sent: number; delivered: number; failed: number }>, send) => {
          const date = format(parseISO(send.created_at), "dd/MM/yyyy", { locale: ptBR });
          if (!acc[date]) acc[date] = { sent: 0, delivered: 0, failed: 0 };
          acc[date].sent++;
          if (send.status === "sent" || send.status === "delivered") acc[date].delivered++;
          if (send.status === "failed") acc[date].failed++;
          return acc;
        }, {});

        setChartData(
          Object.entries(grouped).map(([date, d]) => ({
            date,
            enviadas: d.sent,
            entregues: d.delivered,
            erros: d.failed,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading chart data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: keyof typeof visible) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  const displayData = chartData.length > 0 ? chartData : [
    { date: "01/03", enviadas: 120, entregues: 95, erros: 5 },
    { date: "02/03", enviadas: 340, entregues: 280, erros: 12 },
    { date: "03/03", enviadas: 280, entregues: 250, erros: 8 },
    { date: "04/03", enviadas: 190, entregues: 170, erros: 3 },
    { date: "05/03", enviadas: 80, entregues: 65, erros: 2 },
  ];
  const isDemo = chartData.length === 0;

  const formatYAxis = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
    return v.toString();
  };

  const series = [
    { key: "enviadas", label: "Enviadas", color: "#f97316", gradientId: "gEnviadas" },
    { key: "entregues", label: "Entregues", color: "#ec4899", gradientId: "gEntregues" },
    { key: "erros", label: "Erros", color: "#dc2626", gradientId: "gErros" },
  ] as const;

  return (
    <div className="rounded-xl border bg-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-primary">Gráfico de mensagens</span>
        <div className="flex items-center gap-4">
          {series.map((s) => (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {visible[s.key] ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 opacity-40" />
              )}
              <span className={!visible[s.key] ? "opacity-40 line-through" : ""}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gEnviadas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gEntregues" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ec4899" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gErros" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#dc2626" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
              padding: "8px 12px",
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          {series.map((s) =>
            visible[s.key] ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2.5}
                fill={`url(#${s.gradientId})`}
                animationDuration={1200}
                animationEasing="ease-in-out"
              />
            ) : null
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
