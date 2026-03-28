import { useState, useEffect } from "react";
import { TrendingUp, CreditCard, CheckCircle, DollarSign, Loader2, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { mockTransactions, mockChartData, formatCurrency, getStatusBadge, getMethodLabel } from "./mock-data";

export default function PayDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [webhookCount, setWebhookCount] = useState(0);
  const [integrationCount, setIntegrationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [profileRes, webhookRes, intRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("gateway_webhook_logs").select("id", { count: "exact", head: true }),
        supabase.from("gateway_integrations").select("id", { count: "exact", head: true }),
      ]);

      setProfile(profileRes.data);
      setWebhookCount(webhookRes.count || 0);
      setIntegrationCount(intRes.count || 0);
      setLoading(false);
    };
    fetchData();
  }, []);

  const metrics = [
    { label: "Webhooks Recebidos", value: String(webhookCount), icon: Activity, change: "total" },
    { label: "Integrações Ativas", value: String(integrationCount), icon: CheckCircle, change: "total" },
    { label: "Taxa de Aprovação", value: "94,2%", icon: TrendingUp, change: "+2,1%" },
    { label: "Ticket Médio", value: "R$ 190,21", icon: CreditCard, change: "-3,4%" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vindo, {profile?.full_name || profile?.email || "Usuário"} — Visão geral das suas vendas e transações
        </p>
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
              <p className={`text-xs mt-1 ${m.change.startsWith('+') ? 'text-emerald-400' : m.change.startsWith('-') ? 'text-red-400' : 'text-muted-foreground'}`}>{m.change}</p>
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
            <AreaChart data={mockChartData}>
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
              {mockTransactions.slice(0, 8).map((tx) => {
                const badge = getStatusBadge(tx.status);
                return (
                  <TableRow key={tx.id} className="border-[#2A2A2A]">
                    <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                    <TableCell>{tx.customer}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(tx.grossAmount)}</TableCell>
                    <TableCell>{getMethodLabel(tx.method)}</TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{tx.date}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}