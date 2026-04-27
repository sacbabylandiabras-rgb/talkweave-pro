import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, CreditCard, DollarSign, Loader2, Activity, Trophy, CalendarIcon, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getStatusBadge, getMethodLabel } from "./mock-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCheckoutPresenceChannel } from "@/hooks/useCheckoutPresence";

const InteractiveGlobe = lazy(() => import("@/components/gateway/InteractiveGlobe"));

type PeriodFilter = "today" | "week" | "30d" | "custom";

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

interface ActiveVisitor {
  kind?: "checkout" | "dashboard";
  sessionId: string;
  ownerUserId: string;
  checkoutSlug: string;
  productName?: string;
  joinedAt?: string;
  latitude?: number;
  longitude?: number;
}

export default function PayDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30d");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeVisitors, setActiveVisitors] = useState<ActiveVisitor[]>([]);

  const periodStart = useMemo(() => {
    const now = new Date();
    if (periodFilter === "today") {
      const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
    }
    if (periodFilter === "week") return startOfWeek(now, { locale: ptBR });
    if (periodFilter === "custom" && selectedDate) {
      const d = new Date(selectedDate); d.setHours(0, 0, 0, 0); return d;
    }
    const d = new Date(now); d.setDate(d.getDate() - 30); return d;
  }, [periodFilter, selectedDate]);

  const periodEnd = useMemo(() => {
    if (periodFilter === "custom" && selectedDate) {
      const d = new Date(selectedDate); d.setHours(23, 59, 59, 999); return d;
    }
    return new Date();
  }, [periodFilter, selectedDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.created_at);
      return d >= periodStart && d <= periodEnd;
    });
  }, [transactions, periodStart, periodEnd]);

  const periodLabel = useMemo(() => {
    if (periodFilter === "today") return "hoje";
    if (periodFilter === "week") return "esta semana";
    if (periodFilter === "custom" && selectedDate) return format(selectedDate, "dd/MM/yyyy", { locale: ptBR });
    return "últimos 30 dias";
  }, [periodFilter, selectedDate]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const [profileRes, txRes, wdRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("gateway_transactions" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
        supabase.from("gateway_withdrawals").select("amount, status").eq("user_id", user.id),
      ]);

      setProfile(profileRes.data);
      setTransactions((txRes.data || []) as unknown as Transaction[]);
      const wdData = (wdRes.data || []) as any[];
      setTotalWithdrawn(wdData.filter((w: any) => ["approved", "paid", "completed"].includes(w.status)).reduce((a: number, w: any) => a + (w.amount || 0), 0));
      setLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const primaryChannel = supabase.channel(getCheckoutPresenceChannel(currentUserId), {
      config: {
        presence: {
          key: `dashboard-${currentUserId}`,
        },
      },
    });

    const legacyChannel = supabase.channel("gateway-active-checkouts", {
      config: {
        presence: {
          key: `dashboard-legacy-${currentUserId}`,
        },
      },
    });

    const syncVisitors = () => {
      const primaryState = primaryChannel.presenceState() as Record<string, Array<ActiveVisitor & { presence_ref?: string }>>;
      const legacyState = legacyChannel.presenceState() as Record<string, Array<ActiveVisitor & { presence_ref?: string }>>;

      const uniqueVisitors = Array.from(
        new Map(
          [...Object.values(primaryState).flat(), ...Object.values(legacyState).flat()]
            .filter(
              (visitor) =>
                visitor.kind !== "dashboard" &&
                visitor.ownerUserId === currentUserId &&
                typeof visitor.sessionId === "string" &&
                typeof visitor.checkoutSlug === "string"
            )
            .map((visitor) => [
              visitor.sessionId,
              {
                kind: "checkout",
                sessionId: visitor.sessionId,
                ownerUserId: visitor.ownerUserId,
                checkoutSlug: visitor.checkoutSlug,
                productName: visitor.productName || visitor.checkoutSlug,
                joinedAt: visitor.joinedAt,
                latitude: visitor.latitude,
                longitude: visitor.longitude,
              } satisfies ActiveVisitor,
            ])
        ).values()
      );

      setActiveVisitors(uniqueVisitors);
    };

    const subscribeChannel = (channel: typeof primaryChannel, payload: Record<string, string>) => {
      channel
        .on("presence", { event: "sync" }, syncVisitors)
        .on("presence", { event: "join" }, syncVisitors)
        .on("presence", { event: "leave" }, syncVisitors)
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track(payload);
            syncVisitors();
          }
        });
    };

    subscribeChannel(primaryChannel, {
      kind: "dashboard",
      sessionId: `dashboard-${currentUserId}`,
      ownerUserId: currentUserId,
      checkoutSlug: "__dashboard__",
    });

    subscribeChannel(legacyChannel, {
      kind: "dashboard",
      sessionId: `dashboard-legacy-${currentUserId}`,
      ownerUserId: currentUserId,
      checkoutSlug: "__dashboard__",
    });

    return () => {
      setActiveVisitors([]);
      void primaryChannel.untrack();
      void legacyChannel.untrack();
      void supabase.removeChannel(primaryChannel);
      void supabase.removeChannel(legacyChannel);
    };
  }, [currentUserId]);

  const filteredApproved = filteredTransactions.filter((t) => t.status === "approved" || t.status === "paid");
  const filteredVolume = filteredApproved.reduce((a, t) => a + t.amount, 0);
  const filteredAvgTicket = filteredApproved.length > 0 ? filteredVolume / filteredApproved.length : 0;
  const filteredApprovalRate = filteredTransactions.length > 0 ? ((filteredApproved.length / filteredTransactions.length) * 100).toFixed(1) : "0";

  const approvedTx = transactions.filter((t) => t.status === "approved" || t.status === "paid");
  const totalVolume = approvedTx.reduce((a, t) => a + t.amount, 0);
  const totalNet = approvedTx.reduce((a, t) => a + t.net, 0);
  const availableBalance = Math.max(0, totalNet - totalWithdrawn);

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

  const computedChartData = useMemo(() => {
    const days = periodFilter === "today" ? 1 : periodFilter === "week" ? 7 : periodFilter === "custom" ? 1 : 30;
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(periodStart);
      d.setDate(d.getDate() + i);
      const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      const dayTxs = transactions.filter((tx) => new Date(tx.created_at).toDateString() === d.toDateString());
      const pagas = dayTxs.filter((t) => t.status === "approved" || t.status === "paid").reduce((a, t) => a + t.amount, 0) / 100;
      const pendentes = dayTxs.filter((t) => t.status === "pending").reduce((a, t) => a + t.amount, 0) / 100;
      return { date: key, pagas, pendentes };
    });
  }, [transactions, periodStart, periodFilter]);

  const metrics = [
    { label: "Vendas Aprovadas", value: String(filteredApproved.length), icon: Activity, change: periodLabel },
    { label: "Volume Aprovado", value: formatCurrency(filteredVolume), icon: DollarSign, change: periodLabel },
    { label: "Taxa de Aprovação", value: filteredTransactions.length > 0 ? `${filteredApprovalRate}%` : "—", icon: TrendingUp, change: periodLabel },
    { label: "Ticket Médio", value: filteredApproved.length > 0 ? formatCurrency(Math.round(filteredAvgTicket)) : "—", icon: CreditCard, change: periodLabel },
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
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={periodFilter} onValueChange={(v) => { setPeriodFilter(v as PeriodFilter); if (v !== "custom") setSelectedDate(undefined); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Data específica</SelectItem>
            </SelectContent>
          </Select>
          {periodFilter === "custom" && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 text-sm">
                  <CalendarIcon className="w-4 h-4" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => { setSelectedDate(date); setCalendarOpen(false); }}
                  locale={ptBR}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}
          <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2.5 min-w-[280px] lg:min-w-[340px]">
            <Trophy className="w-4 h-4 text-[#a78bfa] shrink-0" />
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
                    background: "linear-gradient(90deg, #a78bfa 0%, #FF8C00 100%)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border ring-1 ring-primary/20">
        <CardContent className="pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo Disponível para Saque</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(availableBalance)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Líquido total: {formatCurrency(totalNet)} · Sacado: {formatCurrency(totalWithdrawn)}</p>
            </div>
          </div>
          <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10" onClick={() => navigate("/gateway-checkout/withdrawals")}>
            Solicitar Saque
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className="w-4 h-4 text-[#a78bfa]" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{m.value}</p>
              {m.change && <p className="text-xs mt-1 text-muted-foreground">{m.change}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Volume de Vendas — {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={computedChartData}>
                <defs>
                  <linearGradient id="gPagas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPendentes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF7856" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#FF7856" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fill: "#A0A0A0", fontSize: 11 }} />
                <YAxis tick={{ fill: "#A0A0A0", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", borderRadius: 8 }} />
                <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v === "pagas" ? "Pagas" : "Pendentes"}</span>} />
                <Area type="monotone" dataKey="pagas" stroke="#a78bfa" fill="url(#gPagas)" strokeWidth={2} name="pagas" />
                <Area type="monotone" dataKey="pendentes" stroke="#FF7856" fill="url(#gPendentes)" strokeWidth={2} name="pendentes" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border overflow-hidden">
          <CardContent className="p-0 h-full flex flex-col">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-medium text-primary">Visualização em Tempo Real</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-foreground">{activeVisitors.length}</span>
                <span className="text-[10px] text-muted-foreground">visitantes ativos</span>
              </div>
            </div>
            <div className="flex-1 min-h-[340px]">
              <Suspense fallback={<div className="flex items-center justify-center h-[340px]"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
                <InteractiveGlobe visitors={activeVisitors} />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Transações — {periodLabel}
          </CardTitle>
          <span className="text-xs text-muted-foreground">{filteredTransactions.length} transação(ões)</span>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                {selectedDate ? "Nenhuma transação neste dia." : "Nenhuma transação registrada ainda."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">ID</TableHead>
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">Valor</TableHead>
                  <TableHead className="text-muted-foreground">Método</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => {
                  const badge = getStatusBadge(tx.status);
                  return (
                    <TableRow key={tx.id} className="border-border">
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
