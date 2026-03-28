import { useState } from "react";
import { Download, DollarSign, CheckCircle, XCircle, Clock, RotateCcw, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { mockTransactions, mockCheckouts, mockChartData, formatCurrency, getStatusBadge, getMethodLabel } from "./mock-data";

const summaryCards = [
  { label: "Receita Total", value: "R$ 28.940,00", icon: DollarSign, color: "text-[#FF4D2E]" },
  { label: "Aprovadas", value: "47", icon: CheckCircle, color: "text-emerald-400" },
  { label: "Recusadas", value: "5", icon: XCircle, color: "text-red-400" },
  { label: "Aguardando", value: "3", icon: Clock, color: "text-amber-400" },
  { label: "Estornos", value: "1", icon: RotateCcw, color: "text-blue-400" },
  { label: "Ticket Médio", value: "R$ 190,21", icon: TrendingUp, color: "text-purple-400" },
];

const methodData = [
  { name: "Cartão Crédito", value: 18500 },
  { name: "PIX", value: 6200 },
  { name: "Boleto", value: 2800 },
  { name: "Débito", value: 1440 },
];
const COLORS = ["#FF4D2E", "#22C55E", "#F59E0B", "#60A5FA"];

export default function PayReports() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise detalhada das suas vendas</p>
        </div>
        <Button variant="outline" className="rounded-full"><Download className="w-4 h-4 mr-2" /> Exportar CSV</Button>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="resumo">Resumo Financeiro</TabsTrigger>
          <TabsTrigger value="transacoes">Transações</TabsTrigger>
          <TabsTrigger value="conversao">Conversão</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
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
                  <AreaChart data={mockChartData}>
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
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={methodData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {methodData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                    <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transacoes" className="mt-4">
          <Card className="border-[#2A2A2A]">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A]">
                    <TableHead>ID</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Bruto</TableHead><TableHead>Taxa</TableHead><TableHead>Líquido</TableHead><TableHead>Método</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTransactions.map(tx => {
                    const badge = getStatusBadge(tx.status);
                    return (
                      <TableRow key={tx.id} className="border-[#2A2A2A]">
                        <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tx.date}</TableCell>
                        <TableCell>{tx.customer}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.product}</TableCell>
                        <TableCell>{formatCurrency(tx.grossAmount)}</TableCell>
                        <TableCell className="text-red-400 text-sm">{formatCurrency(tx.fee)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(tx.netAmount)}</TableCell>
                        <TableCell className="text-sm">{getMethodLabel(tx.method)}</TableCell>
                        <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversao" className="mt-4">
          <Card className="border-[#2A2A2A]">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A]">
                    <TableHead>Nome</TableHead><TableHead>Produto</TableHead><TableHead>Formato</TableHead><TableHead>Visitas</TableHead><TableHead>Iniciaram</TableHead><TableHead>Aprovados</TableHead><TableHead>Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCheckouts.map(ck => (
                    <TableRow key={ck.id} className="border-[#2A2A2A]">
                      <TableCell className="font-medium">{ck.name}</TableCell>
                      <TableCell className="text-muted-foreground">{ck.product}</TableCell>
                      <TableCell>{ck.format}</TableCell>
                      <TableCell>{ck.visits.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{ck.initiated.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{ck.approved.toLocaleString('pt-BR')}</TableCell>
                      <TableCell><span className={`font-bold ${ck.conversion > 40 ? 'text-emerald-400' : 'text-amber-400'}`}>{ck.conversion}%</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <Card className="border-[#2A2A2A]">
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-muted-foreground text-sm">Dados de clientes serão exibidos conforme as transações forem processadas.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
