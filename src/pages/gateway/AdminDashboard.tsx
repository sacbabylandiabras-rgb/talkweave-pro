import { useState, useEffect } from "react";
import { Building2, Users, TrendingUp, AlertTriangle, CreditCard, Shield, BarChart3, Activity, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { mockCompanies, mockChartData, getStatusBadge } from "./mock-data";

const acquirerData = [
  { name: "Cielo", volume: 456000 },
  { name: "Stone", volume: 312000 },
  { name: "Rede", volume: 89000 },
  { name: "GetNet", volume: 45000 },
];

export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      setTotalUsers(count || 0);
      setLoading(false);
    };
    fetchData();
  }, []);

  const adminMetrics = [
    { label: "Usuários Cadastrados", value: String(totalUsers), icon: Users, color: "text-emerald-400" },
    { label: "Em Análise KYC", value: "8", icon: Shield, color: "text-blue-400" },
    { label: "Volume Hoje", value: "R$ 234.500", icon: TrendingUp, color: "text-[#FF4D2E]" },
    { label: "Volume Mês", value: "R$ 4.8M", icon: BarChart3, color: "text-purple-400" },
    { label: "Taxa Aprovação", value: "93,4%", icon: Activity, color: "text-emerald-400" },
    { label: "Chargebacks Mês", value: "12", icon: AlertTriangle, color: "text-red-400" },
    { label: "Receita ZapLynxPay", value: "R$ 96.400", icon: CreditCard, color: "text-amber-400" },
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
          <CardHeader><CardTitle className="text-sm">Volume por Adquirente</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={acquirerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="name" tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                <Bar dataKey="volume" fill="#FF4D2E" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
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