import { useState, useEffect } from "react";
import { Building2, Users, TrendingUp, AlertTriangle, CreditCard, Shield, BarChart3, Activity, Loader2, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { mockCompanies, mockChartData, getStatusBadge } from "./mock-data";

const formatCurrency = (cents: number) => {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState({
    volumeToday: 0,
    volumeMonth: 0,
    revenueMonth: 0,
    approvalRate: 0,
    pendingKyc: 0,
    totalTransactions: 0,
    approvedTransactions: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [profilesRes, allTxRes, todayTxRes, monthTxRes, kycRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("gateway_transactions").select("amount, fee, status"),
          supabase.from("gateway_transactions").select("amount, status").gte("created_at", startOfDay),
          supabase.from("gateway_transactions").select("amount, fee, status").gte("created_at", startOfMonth),
          supabase.from("gateway_kyc").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        ]);

        setTotalUsers(profilesRes.count || 0);

        const monthTx = monthTxRes.data || [];
        const todayTx = todayTxRes.data || [];
        const allTx = allTxRes.data || [];

        const approved = allTx.filter(t => t.status === "approved");
        const monthApproved = monthTx.filter(t => t.status === "approved");

        setRevenueData({
          volumeToday: todayTx.filter(t => t.status === "approved").reduce((s, t) => s + t.amount, 0),
          volumeMonth: monthApproved.reduce((s, t) => s + t.amount, 0),
          revenueMonth: monthApproved.reduce((s, t) => s + t.fee, 0),
          approvalRate: allTx.length > 0 ? (approved.length / allTx.length) * 100 : 0,
          pendingKyc: kycRes.count || 0,
          totalTransactions: allTx.length,
          approvedTransactions: approved.length,
        });
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const adminMetrics = [
    { label: "Usuários Cadastrados", value: String(totalUsers), icon: Users, color: "text-emerald-400" },
    { label: "Em Análise KYC", value: String(revenueData.pendingKyc), icon: Shield, color: "text-blue-400" },
    { label: "Volume Hoje", value: formatCurrency(revenueData.volumeToday), icon: TrendingUp, color: "text-[#FF4D2E]" },
    { label: "Volume Mês", value: formatCurrency(revenueData.volumeMonth), icon: BarChart3, color: "text-purple-400" },
    { label: "Taxa Aprovação", value: revenueData.approvalRate > 0 ? `${revenueData.approvalRate.toFixed(1)}%` : "0%", icon: Activity, color: "text-emerald-400" },
    { label: "Transações Aprovadas", value: String(revenueData.approvedTransactions), icon: DollarSign, color: "text-emerald-400" },
    { label: "Receita ZapLynxPay", value: formatCurrency(revenueData.revenueMonth), icon: CreditCard, color: "text-amber-400" },
    { label: "Empresas Ativas", value: String(mockCompanies.filter(c => c.status === "active").length), icon: Building2, color: "text-blue-400" },
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
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Admin</h1>
        <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FF4D2E]/10 text-[#FF4D2E] rounded-full">Admin Master</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {adminMetrics.map(m => (
          <Card key={m.label} className="border-[#2A2A2A]">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase">{m.label}</span>
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <p className="text-xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[#2A2A2A]">
          <CardHeader><CardTitle className="text-sm">Volume Diário da Plataforma</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mockChartData}>
                <defs><linearGradient id="gAdm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FF4D2E" stopOpacity={0.15}/><stop offset="95%" stopColor="#FF4D2E" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                <Area type="monotone" dataKey="volume" stroke="#FF4D2E" fill="url(#gAdm)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-[#2A2A2A]">
          <CardHeader><CardTitle className="text-sm">Resumo de Transações</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
            <DollarSign className="w-10 h-10 text-[#FF4D2E]/40" />
            <p className="text-2xl font-bold">{revenueData.totalTransactions} transações</p>
            <p className="text-sm text-muted-foreground">{revenueData.approvedTransactions} aprovadas · Receita: {formatCurrency(revenueData.revenueMonth)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-sm">Últimas Empresas Cadastradas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Empresa</TableHead><TableHead>CNPJ</TableHead><TableHead>Status</TableHead><TableHead>Gerente</TableHead><TableHead>Data</TableHead><TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCompanies.slice(0, 5).map(c => {
                const badge = getStatusBadge(c.status);
                return (
                  <TableRow key={c.id} className="border-[#2A2A2A]">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.cnpj}</TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                    <TableCell className="text-sm">{c.manager || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.createdAt}</TableCell>
                    <TableCell><Button variant="outline" size="sm" className="text-xs h-7 rounded-full">Ver</Button></TableCell>
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