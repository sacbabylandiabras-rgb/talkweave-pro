import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { mockTransactions, mockChartData, formatCurrency, getStatusBadge, getMethodLabel } from "./mock-data";

export default function AdminReports() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatório Global</h1>
          <p className="text-sm text-muted-foreground">Análise completa da plataforma</p>
        </div>
        <Button variant="outline" className="rounded-full text-xs"><Download className="w-3.5 h-3.5 mr-1.5" /> Exportar</Button>
      </div>

      <Tabs defaultValue="performance">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="adquirentes">Adquirentes</TabsTrigger>
          <TabsTrigger value="chargebacks">Chargebacks</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Volume Diário</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={mockChartData}>
                  <defs><linearGradient id="gAR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.15}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="date" tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#A0A0A0', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#141414', border: '1px solid #2A2A2A', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="volume" stroke="#a78bfa" fill="url(#gAR)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Receita Total (Taxas)", value: "R$ 96.400" },
              { label: "Maior Lojista", value: "TechStore" },
              { label: "Maior Adquirente", value: "Cielo" },
              { label: "Taxa Média", value: "2,34%" },
            ].map(c => (
              <Card key={c.label} className="border-[#2A2A2A]">
                <CardContent className="pt-4 pb-3"><p className="text-[10px] text-muted-foreground">{c.label}</p><p className="text-lg font-bold mt-1">{c.value}</p></CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="adquirentes" className="mt-4">
          <Card className="border-[#2A2A2A]">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A]">
                    <TableHead>Adquirente</TableHead><TableHead>Volume</TableHead><TableHead>Aprovadas</TableHead><TableHead>Recusadas</TableHead><TableHead>Taxa Aprovação</TableHead><TableHead>Tempo Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { name: "Cielo", vol: "R$ 456.000", approved: "4.280", declined: "248", rate: "94,5%", time: "340ms" },
                    { name: "Stone", vol: "R$ 312.000", approved: "2.910", declined: "210", rate: "93,3%", time: "280ms" },
                  ].map(a => (
                    <TableRow key={a.name} className="border-[#2A2A2A]">
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.vol}</TableCell>
                      <TableCell className="text-emerald-400">{a.approved}</TableCell>
                      <TableCell className="text-red-400">{a.declined}</TableCell>
                      <TableCell className="font-medium">{a.rate}</TableCell>
                      <TableCell className="text-muted-foreground">{a.time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chargebacks" className="mt-4">
          <Card className="border-[#2A2A2A]">
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Nenhum chargeback acima do limite detectado.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
