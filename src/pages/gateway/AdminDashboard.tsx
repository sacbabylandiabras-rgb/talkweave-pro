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
    revenueToday: 0,
    revenueMonth: 0,
    revenueTotal: 0,
    approvalRate: 0,
    pendingKyc: 0,
    totalTransactions: 0,
    approvedTransactions: 0,
    feePercent: 6.99,
    feeFixed: 199,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("admin-stats");
        if (error) throw error;
        if (data) {
          setTotalUsers(data.totalUsers || 0);
          setRevenueData({
            volumeToday: data.volumeToday || 0,
            volumeMonth: data.volumeMonth || 0,
            revenueToday: data.revenueToday || 0,
            revenueMonth: data.revenueMonth || 0,
            revenueTotal: data.revenueTotal || 0,
            approvalRate: data.approvalRate || 0,
            pendingKyc: data.pendingKyc || 0,
            totalTransactions: data.totalTransactions || 0,
            approvedTransactions: data.approvedTransactions || 0,
            feePercent: data.feePercent || 6.99,
            feeFixed: data.feeFixed || 199,
          });
        }
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const adminMetrics = [
    { label: "Usuários Cadastrados", value: String(totalUsers), icon: Users, color: "text-emerald-400" },
    { label: "Em Análise KYC", value: String(revenueData.pendingKyc), icon: Shield, color: "text-blue-400" },
    { label: "Volume Hoje", value: formatCurrency(revenueData.volumeToday), icon: TrendingUp, color: "text-[#a78bfa]" },
    { label: "Volume Mês", value: formatCurrency(revenueData.volumeMonth), icon: BarChart3, color: "text-purple-400" },
    { label: "Taxa Aprovação", value: revenueData.approvalRate > 0 ? `${revenueData.approvalRate.toFixed(1)}%` : "0%", icon: Activity, color: "text-emerald-400" },
    { label: "Transações Aprovadas", value: String(revenueData.approvedTransactions), icon: DollarSign, color: "text-emerald-400" },
    { label: "Receita Hoje", value: formatCurrency(revenueData.revenueToday), icon: CreditCard, color: "text-amber-400" },
    { label: "Receita Mês", value: formatCurrency(revenueData.revenueMonth), icon: CreditCard, color: "text-amber-400" },
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
        <span className="px-2 py-0.5 text-[10px] font-bold bg-[#a78bfa]/10 text-[#a78bfa] rounded-full">Admin Master</span>
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
                <defs><linearGradient id="gAdm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.15}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                <Area type="monotone" dataKey="volume" stroke="#a78bfa" fill="url(#gAdm)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-[#2A2A2A]">
          <CardHeader><CardTitle className="text-sm">Receita da Plataforma (Taxas)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-400">{formatCurrency(revenueData.revenueTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">Receita total acumulada</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-lg font-bold">{formatCurrency(revenueData.revenueToday)}</p>
                <p className="text-[10px] text-muted-foreground">Hoje</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <p className="text-lg font-bold">{formatCurrency(revenueData.revenueMonth)}</p>
                <p className="text-[10px] text-muted-foreground">Este mês</p>
              </div>
            </div>
            <div className="border-t border-[#2A2A2A] pt-3">
              <p className="text-xs text-muted-foreground mb-2">Configuração de taxa atual:</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">PIX</span>
                <span className="font-mono font-medium">{revenueData.feePercent}% + R$ {(revenueData.feeFixed / 100).toFixed(2)}</span>
              </div>
            </div>
            <div className="border-t border-[#2A2A2A] pt-3">
              <p className="text-xs text-muted-foreground">{revenueData.approvedTransactions} transações aprovadas · {revenueData.totalTransactions} total</p>
            </div>
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