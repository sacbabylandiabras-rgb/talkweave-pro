import { useState, useEffect } from "react";
import { Download, DollarSign, CheckCircle, XCircle, Clock, RotateCcw, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getStatusBadge, getMethodLabel } from "./mock-data";

const COLORS = ["#FF4D2E", "#22C55E", "#F59E0B", "#60A5FA"];

interface Transaction {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  amount: number;
  fee: number;
  net: number;
  payment_method: string;
  status: string;
  created_at: string;
  product_id: string | null;
}

export default function PayReports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [checkouts, setCheckouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [txRes, ckRes] = await Promise.all([
        supabase.from("gateway_transactions" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("gateway_checkouts" as any).select("*").order("created_at", { ascending: false }),
      ]);
      setTransactions((txRes.data || []) as unknown as Transaction[]);
      setCheckouts((ckRes.data || []) as any[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const approved = transactions.filter(t => t.status === "approved");
  const declined = transactions.filter(t => t.status === "declined");
  const pending = transactions.filter(t => t.status === "pending");
  const refunded = transactions.filter(t => t.status === "refunded");
  const totalRevenue = approved.reduce((a, t) => a + t.net, 0);
  const avgTicket = approved.length > 0 ? Math.round(totalRevenue / approved.length) : 0;

  const methodGroups = transactions.reduce((acc, tx) => {
    const label = getMethodLabel(tx.payment_method);
    acc[label] = (acc[label] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);
  const methodData = Object.entries(methodGroups).map(([name, value]) => ({ name, value: value / 100 }));

  // Chart: last 30 days
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const dayTxs = approved.filter(tx => new Date(tx.created_at).toDateString() === d.toDateString());
    return { date: key, volume: dayTxs.reduce((a, t) => a + t.net, 0) / 100 };
  });

  const summaryCards = [
    { label: "Receita Total", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-[#FF4D2E]" },
    { label: "Aprovadas", value: String(approved.length), icon: CheckCircle, color: "text-emerald-400" },
    { label: "Recusadas", value: String(declined.length), icon: XCircle, color: "text-red-400" },
    { label: "Aguardando", value: String(pending.length), icon: Clock, color: "text-amber-400" },
    { label: "Estornos", value: String(refunded.length), icon: RotateCcw, color: "text-blue-400" },
    { label: "Ticket Médio", value: avgTicket > 0 ? formatCurrency(avgTicket) : "—", icon: TrendingUp, color: "text-purple-400" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise detalhada das suas vendas ({transactions.length} transações)</p>
        </div>
        <Button variant="outline" className="rounded-full"><Download className="w-4 h-4 mr-2" /> Exportar CSV</Button>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="resumo">Resumo Financeiro</TabsTrigger>
          <TabsTrigger value="transacoes">Transações</TabsTrigger>
          <TabsTrigger value="conversao">Conversão</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {summaryCards.map(c => (
              <Card key={c.label} className="border-[#2A2A2A]">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 mb-2">
                    <c.icon className={`w-4 h-4 ${c.color}`} />
                    <span className="text-[10px] text-muted-foreground uppercase">{c.label}</span>
                  </div>
                  <p className="text-lg font-bold">{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-[#2A2A2A]">
              <CardHeader><CardTitle className="text-sm">Volume por Dia</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="gVol" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FF4D2E" stopOpacity={0.15}/><stop offset="95%" stopColor="#FF4D2E" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="volume" stroke="#FF4D2E" fill="url(#gVol)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-[#2A2A2A]">
              <CardHeader><CardTitle className="text-sm">Por Método de Pagamento</CardTitle></CardHeader>
              <CardContent>
                {methodData.length === 0 ? (
                  <div className="flex items-center justify-center h-[220px]">
                    <p className="text-sm text-muted-foreground">Sem dados de transações</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={methodData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {methodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                      <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transacoes" className="mt-4">
          <Card className="border-[#2A2A2A]">
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-muted-foreground">Nenhuma transação registrada.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A]">
                      <TableHead>ID</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Bruto</TableHead><TableHead>Taxa</TableHead><TableHead>Líquido</TableHead><TableHead>Método</TableHead><TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map(tx => {
                      const badge = getStatusBadge(tx.status);
                      return (
                        <TableRow key={tx.id} className="border-[#2A2A2A]">
                          <TableCell className="font-mono text-xs">{tx.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{tx.customer_name || "—"}</TableCell>
                          <TableCell>{formatCurrency(tx.amount)}</TableCell>
                          <TableCell className="text-red-400 text-sm">{formatCurrency(tx.fee)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(tx.net)}</TableCell>
                          <TableCell className="text-sm">{getMethodLabel(tx.payment_method)}</TableCell>
                          <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversao" className="mt-4">
          <Card className="border-[#2A2A2A]">
            <CardContent className="p-0">
              {checkouts.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-muted-foreground">Nenhum checkout criado ainda.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A]">
                      <TableHead>Nome</TableHead><TableHead>Formato</TableHead><TableHead>Visitas</TableHead><TableHead>Iniciaram</TableHead><TableHead>Aprovados</TableHead><TableHead>Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkouts.map((ck: any) => {
                      const visits = ck.visits ?? 0;
                      const initiated = ck.initiated ?? 0;
                      const approved = ck.approved ?? 0;
                      const conversion = visits > 0 ? ((approved / visits) * 100).toFixed(1) : "0.0";
                      return (
                        <TableRow key={ck.id} className="border-[#2A2A2A]">
                          <TableCell className="font-medium">{ck.name}</TableCell>
                          <TableCell>{ck.format ?? "—"}</TableCell>
                          <TableCell>{visits.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{initiated.toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{approved.toLocaleString('pt-BR')}</TableCell>
                          <TableCell><span className={`font-bold ${parseFloat(conversion) > 40 ? 'text-emerald-400' : 'text-amber-400'}`}>{conversion}%</span></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}