import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Eye, EyeOff, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ChartData {
  date: string;
  enviadas: number;
  entregues: number;
  erros: number;
}

interface RawSend {
  created_at: string;
  status: string | null;
}

export function VolumeChart() {
  const [loading, setLoading] = useState(true);
  const [allSends, setAllSends] = useState<RawSend[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [visible, setVisible] = useState({ enviadas: true, entregues: true, erros: true });
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const toLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const handleSelectFrom = (selected?: Date) => {
    setDateFrom(selected);

    if (!selected) {
      setDateTo(undefined);
      return;
    }

    setDateTo(selected);
  };

  const handleSelectTo = (selected?: Date) => {
    setDateTo(selected);
    if (!selected) return;

    if (!dateFrom || selected < dateFrom) {
      setDateFrom(selected);
    }
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        loadRawData();
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const filtered = allSends.filter((send) => {
      const sendLocalDate = toLocalDateStr(new Date(send.created_at));

      if (dateFrom && dateTo) {
        const fromStr = toLocalDateStr(dateFrom);
        const toStr = toLocalDateStr(dateTo);
        return sendLocalDate >= fromStr && sendLocalDate <= toStr;
      }

      if (dateFrom) return sendLocalDate === toLocalDateStr(dateFrom);
      if (dateTo) return sendLocalDate === toLocalDateStr(dateTo);
      return true;
    });

    const grouped = filtered.reduce((acc: Record<string, { sent: number; delivered: number; failed: number }>, send) => {
      const key = toLocalDateStr(new Date(send.created_at));
      if (!acc[key]) acc[key] = { sent: 0, delivered: 0, failed: 0 };

      acc[key].sent++;
      if (send.status === "sent" || send.status === "delivered") acc[key].delivered++;
      if (send.status === "failed") acc[key].failed++;

      return acc;
    }, {});

    if (dateFrom && dateTo) {
      const start = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
      const end = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());
      const cursor = new Date(start);
      const rangeData: ChartData[] = [];

      while (cursor <= end) {
        const key = toLocalDateStr(cursor);
        const totals = grouped[key] ?? { sent: 0, delivered: 0, failed: 0 };

        rangeData.push({
          date: format(cursor, "dd/MM/yyyy", { locale: ptBR }),
          enviadas: totals.sent,
          entregues: totals.delivered,
          erros: totals.failed,
        });

        cursor.setDate(cursor.getDate() + 1);
        if (rangeData.length > 366) break;
      }

      setChartData(rangeData);
      return;
    }

    const sortedKeys = Object.keys(grouped).sort();

    if (sortedKeys.length > 0) {
      setChartData(
        sortedKeys.map((key) => {
          const [year, month, day] = key.split("-").map(Number);
          const localDate = new Date(year, month - 1, day);
          const totals = grouped[key];

          return {
            date: format(localDate, "dd/MM/yyyy", { locale: ptBR }),
            enviadas: totals.sent,
            entregues: totals.delivered,
            erros: totals.failed,
          };
        })
      );
    } else {
      setChartData([]);
    }
  }, [allSends, dateFrom, dateTo]);

  const loadRawData = async () => {
    try {
      const { data: sends, error } = await supabase
        .from("campaign_sends")
        .select("created_at, status")
        .order("created_at", { ascending: true });

      console.log("[VolumeChart] sends loaded:", sends?.length, "error:", error);
      setAllSends(sends || []);
    } catch (error) {
      console.error("Error loading chart data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: keyof typeof visible) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  const buildFallbackData = (): ChartData[] => {
    if (dateFrom && dateTo) {
      const start = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
      const end = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());
      const rangeData: ChartData[] = [];
      const cursor = new Date(start);

      while (cursor <= end) {
        rangeData.push({
          date: format(cursor, "dd/MM/yyyy", { locale: ptBR }),
          enviadas: 0,
          entregues: 0,
          erros: 0,
        });
        cursor.setDate(cursor.getDate() + 1);
        if (rangeData.length > 31) break;
      }

      return rangeData;
    }

    if (dateFrom) {
      return [
        {
          date: format(dateFrom, "dd/MM/yyyy", { locale: ptBR }),
          enviadas: 0,
          entregues: 0,
          erros: 0,
        },
      ];
    }

    if (dateTo) {
      return [
        {
          date: format(dateTo, "dd/MM/yyyy", { locale: ptBR }),
          enviadas: 0,
          entregues: 0,
          erros: 0,
        },
      ];
    }

    return Array.from({ length: 5 }).map((_, index) => {
      const date = subDays(new Date(), 4 - index);
      return {
        date: format(date, "dd/MM/yyyy", { locale: ptBR }),
        enviadas: 0,
        entregues: 0,
        erros: 0,
      };
    });
  };

  const displayData = chartData.length > 0 ? chartData : buildFallbackData();

  const formatYAxis = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
    return v.toString();
  };

  const series = [
    { key: "enviadas", label: "Enviadas", color: "rgb(var(--warning))", gradientId: "gEnviadas" },
    { key: "entregues", label: "Entregues", color: "rgb(var(--accent))", gradientId: "gEntregues" },
    { key: "erros", label: "Erros", color: "rgb(var(--destructive))", gradientId: "gErros" },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px] rounded-xl border bg-card">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-primary">Gráfico de mensagens</span>
          {chartData.length === 0 && (
            <span className="text-[10px] text-muted-foreground">(sem envios ainda)</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date From */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal text-xs h-8",
                  !dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={handleSelectFrom}
                disabled={(date) => (dateTo ? date > dateTo : date > new Date())}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground">até</span>

          {/* Date To */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal text-xs h-8",
                  !dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={handleSelectTo}
                disabled={(date) => (dateFrom ? date < dateFrom : false) || date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {/* Series toggles */}
          <div className="flex items-center gap-3 ml-2">
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
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={displayData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gEnviadas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgb(var(--warning))" stopOpacity={0.45} />
              <stop offset="95%" stopColor="rgb(var(--warning))" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="gEntregues" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgb(var(--accent))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="rgb(var(--accent))" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="gErros" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgb(var(--destructive))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="rgb(var(--destructive))" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" opacity={0.4} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
            axisLine={{ stroke: "rgb(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgb(var(--card))",
              border: "1px solid rgb(var(--border))",
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
