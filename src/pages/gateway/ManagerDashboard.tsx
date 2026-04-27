import { useState, useEffect } from "react";
import { Briefcase, TrendingUp, DollarSign, Clock, CheckCircle, UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { mockManagerClients, mockChartData, formatCurrencyReais, getStatusBadge } from "./mock-data";

const managerMetrics = [
  { label: "Total de Clientes", value: "8", icon: Briefcase, color: "text-blue-400" },
  { label: "Volume Carteira Mês", value: "R$ 817.500", icon: TrendingUp, color: "text-[#a78bfa]" },
  { label: "Comissão Gerada", value: "R$ 8.175,00", icon: DollarSign, color: "text-[#a78bfa]", glow: true },
  { label: "Comissão a Receber", value: "R$ 6.949,00", icon: Clock, color: "text-amber-400" },
  { label: "Comissão Paga", value: "R$ 20.134,00", icon: CheckCircle, color: "text-emerald-400" },
  { label: "Novos Clientes Mês", value: "2", icon: UserPlus, color: "text-blue-400" },
];

const topClients = mockManagerClients.sort((a, b) => b.volumeMonth - a.volumeMonth).slice(0, 5).map(c => ({ name: c.company.split(' ')[0], volume: c.volumeMonth }));

export default function ManagerDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const userName = profile?.full_name || profile?.email || "Gerente";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Dashboard</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo, {userName}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {managerMetrics.map(m => (
          <Card key={m.label} className={`border-[#2A2A2A] ${m.glow ? 'ring-1 ring-[#a78bfa]/20' : ''}`}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase">{m.label}</span>
              </div>
              <p className={`text-lg font-bold ${m.glow ? 'text-[#a78bfa]' : ''}`}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[#2A2A2A]">
          <CardHeader><CardTitle className="text-sm">Comissão Gerada — 30 dias</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mockChartData.map(d => ({ ...d, volume: Math.floor(d.volume * 0.01) }))}>
                <defs><linearGradient id="gMgr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.15}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                <Area type="monotone" dataKey="volume" stroke="#a78bfa" fill="url(#gMgr)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-[#2A2A2A]">
          <CardHeader><CardTitle className="text-sm">Volume por Cliente (Top 5)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topClients}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="name" tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                <Bar dataKey="volume" fill="#a78bfa" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-sm">Meus Clientes — Performance Este Mês</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Empresa</TableHead><TableHead>Volume Mês</TableHead><TableHead>Variação</TableHead><TableHead>Comissão</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockManagerClients.map(c => {
                const badge = getStatusBadge(c.status);
                const variation = Math.floor(Math.random() * 40) - 10;
                return (
                  <TableRow key={c.id} className="border-[#2A2A2A]">
                    <TableCell className="font-medium">{c.company}</TableCell>
                    <TableCell>{formatCurrencyReais(c.volumeMonth)}</TableCell>
                    <TableCell className={variation >= 0 ? 'text-emerald-400' : 'text-red-400'}>{variation >= 0 ? '+' : ''}{variation}%</TableCell>
                    <TableCell className="text-emerald-400">{formatCurrencyReais(c.commissionGenerated)}</TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A2A] ring-1 ring-[#a78bfa]/20">
        <CardContent className="pt-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Próximo Pagamento</p>
            <p className="text-lg font-bold text-foreground mt-1">05/04/2025 — R$ 6.949,00</p>
            <p className="text-xs text-muted-foreground">PIX: {profile?.email || "—"}</p>
          </div>
          <span className="px-3 py-1 bg-[#a78bfa]/10 text-[#a78bfa] rounded-full text-xs font-medium cursor-pointer hover:bg-[#a78bfa]/20 transition-colors">Ver Extrato</span>
        </CardContent>
      </Card>
    </div>
  );
}