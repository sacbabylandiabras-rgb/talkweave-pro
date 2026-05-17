import { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Eye, EyeOff, CalendarIcon, TrendingUp } from "lucide-react";
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
    if (!selected) { setDateTo(undefined); return; }
    setDateTo(selected);
  };

  const handleSelectTo = (selected?: Date) => {
    setDateTo(selected);
    if (!selected) return;
    if (!dateFrom || selected < dateFrom) setDateFrom(selected);
  };

  const loadRawData = useCallback(async () => {
    try {
      let allData: RawSend[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("campaign_sends")
          .select("created_at, status")
          .order("created_at", { ascending: true })
          .range(from, from + batchSize - 1);
        if (error || !data || data.length === 0) { hasMore = false; break; }
        allData = [...allData, ...data];
        hasMore = data.length === batchSize;
        from += batchSize;
      }
      setAllSends(allData);
    } catch (error) {
      console.error("Error loading chart data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { loadRawData(); } else { setLoading(false); }
    };
    init();

    const channel = supabase
      .channel('volume-chart-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_sends' }, (payload) => {
        const record = payload.new as { created_at?: string; status?: string | null };
        if (record?.created_at) {
          setAllSends(prev => [...prev, { created_at: record.created_at!, status: record.status ?? null }]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_sends' }, (payload) => {
        const record = payload.new as { created_at?: string; status?: string | null };
        const oldRecord = payload.old as { created_at?: string };
        if (record?.created_at && oldRecord?.created_at) {
          setAllSends(prev => prev.map(s =>
            s.created_at === oldRecord.created_at ? { created_at: record.created_at!, status: record.status ?? null } : s
          ));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'campaign_sends' }, () => loadRawData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadRawData]);

  useEffect(() => {
    const filtered = allSends.filter((send) => {
      const sendLocalDate = toLocalDateStr(new Date(send.created_at));
      if (dateFrom && dateTo) {
        return sendLocalDate >= toLocalDateStr(dateFrom) && sendLocalDate <= toLocalDateStr(dateTo);
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
        rangeData.push({ date: format(cursor, "dd/MM", { locale: ptBR }), enviadas: totals.sent, entregues: totals.delivered, erros: totals.failed });
        cursor.setDate(cursor.getDate() + 1);
        if (rangeData.length > 366) break;
      }
      setChartData(rangeData);
      return;
    }

    const sortedKeys = Object.keys(grouped).sort();
    if (sortedKeys.length > 0) {
      setChartData(sortedKeys.map((key) => {
        const [year, month, day] = key.split("-").map(Number);
        const localDate = new Date(year, month - 1, day);
        const totals = grouped[key];
        return { date: format(localDate, "dd/MM", { locale: ptBR }), enviadas: totals.sent, entregues: totals.delivered, erros: totals.failed };
      }));
    } else {
      setChartData([]);
    }
  }, [allSends, dateFrom, dateTo]);

  const toggle = (key: keyof typeof visible) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  const buildFallbackData = (): ChartData[] => {
    if (dateFrom && dateTo) {
      const start = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
      const end = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());
      const rangeData: ChartData[] = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        rangeData.push({ date: format(cursor, "dd/MM", { locale: ptBR }), enviadas: 0, entregues: 0, erros: 0 });
        cursor.setDate(cursor.getDate() + 1);
        if (rangeData.length > 31) break;
      }
      return rangeData;
    }
    if (dateFrom) return [{ date: format(dateFrom, "dd/MM", { locale: ptBR }), enviadas: 0, entregues: 0, erros: 0 }];
    if (dateTo) return [{ date: format(dateTo, "dd/MM", { locale: ptBR }), enviadas: 0, entregues: 0, erros: 0 }];
    return Array.from({ length: 7 }).map((_, index) => {
      const date = subDays(new Date(), 6 - index);
      return { date: format(date, "dd/MM", { locale: ptBR }), enviadas: 0, entregues: 0, erros: 0 };
    });
  };

  const displayData = chartData.length > 0 ? chartData : buildFallbackData();
  const formatYAxis = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString());

  const series = [
    { key: "enviadas", label: "Enviadas", color: "#a78bfa", gradientId: "gEnviadas" },
    { key: "entregues", label: "Entregues", color: "#f472b6", gradientId: "gEntregues" },
    { key: "erros", label: "Erros", color: "#f87171", gradientId: "gErros" },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[340px] glass-chart">
        <Loader2 className="w-6 h-6 animate-spin text-[#a78bfa]" />
      </div>
    );
  }

  return (
    <div className="glass-chart p-5 transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[rgba(167,139,250,0.16)]">
            <TrendingUp className="w-4 h-4 text-[#a78bfa]" />
          </div>
          <div>
             <span className="font-bebas text-[18px] text-white tracking-wider">Volume de Mensagens</span>
            {chartData.length === 0 && (
              <p className="font-nunito text-[11px] text-white/30">Nenhum envio registrado ainda</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-xs h-8 rounded border-border/60", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={handleSelectFrom} disabled={(date) => (dateTo ? date > dateTo : date > new Date())} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <span className="text-[11px] text-muted-foreground">até</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-xs h-8 rounded border-border/60", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateTo} onSelect={handleSelectTo} disabled={(date) => (dateFrom ? date < dateFrom : false) || date > new Date()} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />

          <div className="flex items-center gap-3">
            {series.map((s) => (
              <button key={s.key} onClick={() => toggle(s.key)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {visible[s.key] ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                <span className={cn("text-[11px]", !visible[s.key] && "opacity-40 line-through")}>{s.label}</span>
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
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.40} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gEntregues" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f472b6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f472b6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gErros" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f87171" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)", fontFamily: "Nunito" }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)", fontFamily: "Nunito" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(26,16,64,0.92)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "10px",
              fontSize: "12px",
              color: "#ffffff",
              backdropFilter: "blur(14px)",
              padding: "10px 14px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}
            labelStyle={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: "#ffffff" }}
          />
          {series.map((s) =>
            visible[s.key] ? (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={s.key === "enviadas" ? 2.5 : 1.8} strokeDasharray={s.key === "entregues" ? "4 3" : undefined} fill={`url(#${s.gradientId})`} animationDuration={1200} animationEasing="ease-in-out" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#1a1040" }} />
            ) : null
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
