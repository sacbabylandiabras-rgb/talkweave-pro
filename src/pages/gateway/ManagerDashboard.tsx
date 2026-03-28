import { Briefcase, TrendingUp, DollarSign, Clock, CheckCircle, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { mockManagerClients, mockChartData, formatCurrencyReais, getStatusBadge } from "./mock-data";

const managerMetrics = [
  { label: "Total de Clientes", value: "8", icon: Briefcase, color: "text-blue-400" },
  { label: "Volume Carteira Mês", value: "R$ 817.500", icon: TrendingUp, color: "text-[#FF4D2E]" },
  { label: "Comissão Gerada", value: "R$ 8.175,00", icon: DollarSign, color: "text-[#FF4D2E]", glow: true },
  { label: "Comissão a Receber", value: "R$ 6.949,00", icon: Clock, color: "text-amber-400" },
  { label: "Comissão Paga", value: "R$ 20.134,00", icon: CheckCircle, color: "text-emerald-400" },
  { label: "Novos Clientes Mês", value: "2", icon: UserPlus, color: "text-blue-400" },
];

const topClients = mockManagerClients.sort((a, b) => b.volumeMonth - a.volumeMonth).slice(0, 5).map(c => ({ name: c.company.split(' ')[0], volume: c.volumeMonth }));

export default function ManagerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Dashboard</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo, Carlos Mendes</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {managerMetrics.map(m => (
          <Card key={m.label} className={`border-[#2A2A2A] ${m.glow ? 'ring-1 ring-[#FF4D2E]/20' : ''}`}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase">{m.label}</span>
              </div>
              <p className={`text-lg font-bold ${m.glow ? 'text-[#FF4D2E]' : ''}`}>{m.value}</p>
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
                <defs><linearGradient id="gMgr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FF4D2E" stopOpacity={0.15}/><stop offset="95%" stopColor="#FF4D2E" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <YAxis tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                <Area type="monotone" dataKey="volume" stroke="#FF4D2E" fill="url(#gMgr)" strokeWidth={2} />
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
                <Bar dataKey="volume" fill="#FF4D2E" radius={[4,4,0,0]} />
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

      <Card className="border-[#2A2A2A] ring-1 ring-[#FF4D2E]/20">
        <CardContent className="pt-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Próximo Pagamento</p>
            <p className="text-lg font-bold text-foreground mt-1">05/04/2025 — R$ 6.949,00</p>
            <p className="text-xs text-muted-foreground">PIX: gerente@zaplynxpay.com</p>
          </div>
          <span className="px-3 py-1 bg-[#FF4D2E]/10 text-[#FF4D2E] rounded-full text-xs font-medium cursor-pointer hover:bg-[#FF4D2E]/20 transition-colors">Ver Extrato</span>
        </CardContent>
      </Card>
    </div>
  );
}
