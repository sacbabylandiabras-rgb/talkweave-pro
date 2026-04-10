import { useState, useEffect, useMemo } from "react";
import { TrendingUp, CreditCard, DollarSign, Loader2, Activity, Trophy, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getStatusBadge, getMethodLabel } from "./mock-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Transaction {
  id: string;
  customer_name: string | null;
  amount: number;
  fee: number;
  net: number;
  payment_method: string;
  status: string;
  created_at: string;
}

export default function PayDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [approvedToday, setApprovedToday] = useState(0);
  const [sales30d, setSales30d] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const filteredTransactions = useMemo(() => {
    if (!selectedDate) return transactions;
    return transactions.filter(t => {
      const txDate = new Date(t.created_at);
      return txDate.toDateString() === selectedDate.toDateString();
    });

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [profileRes, txRes, todayRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("gateway_transactions" as any).select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("gateway_transactions" as any).select("id", { count: "exact", head: true }).eq("status", "approved").gte("created_at", today.toISOString()),
      ]);

      setProfile(profileRes.data);
      setTransactions((txRes.data || []) as unknown as Transaction[]);
      setApprovedToday(todayRes.count || 0);

      // Sales last 30 days
      const d30 = new Date();
      d30.setDate(d30.getDate() - 30);
      const allTx = (txRes.data || []) as unknown as Transaction[];
      const sales30 = allTx.filter(t => t.status === "approved" && new Date(t.created_at) >= d30).reduce((a, t) => a + t.amount, 0);
      setSales30d(sales30);

      // Build chart from transactions (last 30 days)
      const chartTx = (txRes.data || []) as unknown as Transaction[];
      const last30 = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const dayTxs = chartTx.filter(tx => {
          const txDate = new Date(tx.created_at);
          return txDate.toDateString() === d.toDateString();
        });
        return { date: key, volume: dayTxs.reduce((a, t) => a + (t.amount || 0), 0) / 100 };
      });
      setChartData(last30);
      setLoading(false);
    };
    fetchData();
  }, []);

  const approvedTx = transactions.filter(t => t.status === "approved" || t.status === "paid");
  const totalVolume = approvedTx.reduce((a, t) => a + t.amount, 0);
  const avgTicket = approvedTx.length > 0 ? totalVolume / approvedTx.length : 0;
  const approvalRate = transactions.length > 0 ? ((approvedTx.length / transactions.length) * 100).toFixed(1) : "0";

  // Milestones in cents
  const milestones = [
    { label: "R$ 0", value: 0 },
    { label: "R$ 10k", value: 10_000_00 },
    { label: "R$ 100k", value: 100_000_00 },
    { label: "R$ 500k", value: 500_000_00 },
    { label: "R$ 1M", value: 1_000_000_00 },
  ];

  const progressInfo = useMemo(() => {
    const vol = totalVolume;
    let currentIdx = 0;
    for (let i = milestones.length - 1; i >= 0; i--) {
      if (vol >= milestones[i].value) { currentIdx = i; break; }
    }
    const nextIdx = Math.min(currentIdx + 1, milestones.length - 1);
    const from = milestones[currentIdx].value;
    const to = milestones[nextIdx].value;
    const segmentPct = Math.min(to > from ? ((vol - from) / (to - from)) * 100 : 100, 100);
    return {
      segmentPct,
      currentLabel: milestones[currentIdx].label,
      nextLabel: milestones[nextIdx].label,
      volumeFormatted: formatCurrency(vol),
    };
  }, [totalVolume]);

  const metrics = [
    { label: "Vendas Aprovadas Hoje", value: String(approvedToday), icon: Activity, change: "hoje" },
    { label: "Vendas Últimos 30 dias", value: formatCurrency(sales30d), icon: DollarSign, change: "últimos 30 dias" },
    { label: "Taxa de Aprovação", value: transactions.length > 0 ? `${approvalRate}%` : "—", icon: TrendingUp, change: "" },
    { label: "Ticket Médio", value: approvedTx.length > 0 ? formatCurrency(Math.round(avgTicket)) : "—", icon: CreditCard, change: "" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Bem-vindo, {profile?.full_name || profile?.email || "Usuário"} — Visão geral das suas vendas e transações
          </p>
        </div>
        {/* Sales Milestone Progress Bar - Top Right */}
        <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2.5 min-w-[280px] lg:min-w-[340px]">
          <Trophy className="w-4 h-4 text-[#FF4D2E] shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                {progressInfo.currentLabel} → {progressInfo.nextLabel}
              </span>
              <span className="text-[10px] text-muted-foreground">{progressInfo.volumeFormatted}</span>
            </div>
            <div className="relative w-full h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progressInfo.segmentPct}%`,
                  background: "linear-gradient(90deg, #FF4D2E 0%, #FF8C00 100%)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className="w-4 h-4 text-[#FF4D2E]" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{m.value}</p>
              {m.change && <p className="text-xs mt-1 text-muted-foreground">{m.change}</p>}
            </CardContent>
          </Card>
        ))}
      </div>




      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Volume de Vendas — Últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF4D2E" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#FF4D2E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 11 }} />
              <YAxis tick={{ fill: '#A0A0A0', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
              <Area type="monotone" dataKey="volume" stroke="#FF4D2E" fill="url(#colorVolume)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Transações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Nenhuma transação registrada ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A]">
                  <TableHead className="text-muted-foreground">ID</TableHead>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">Valor</TableHead>
                  <TableHead className="text-muted-foreground">Método</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const badge = getStatusBadge(tx.status);
                  return (
                    <TableRow key={tx.id} className="border-[#2A2A2A]">
                      <TableCell className="font-mono text-xs">{tx.id.slice(0, 8)}</TableCell>
                      <TableCell>{tx.customer_name || "—"}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell>{getMethodLabel(tx.payment_method)}</TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(tx.created_at).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}