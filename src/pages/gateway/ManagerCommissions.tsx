import { DollarSign, Clock, CheckCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockCommissions, formatCurrencyReais, getStatusBadge } from "./mock-data";

export default function ManagerCommissions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas Comissões</h1>
        <p className="text-sm text-muted-foreground">Acompanhe seus ganhos e recebimentos</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Comissão Mês Atual", value: "R$ 8.175,00", icon: DollarSign, color: "text-[#a78bfa]" },
          { label: "Mês Anterior", value: "R$ 7.562,00", icon: Calendar, color: "text-blue-400" },
          { label: "Total Pago", value: "R$ 20.134,00", icon: CheckCircle, color: "text-emerald-400" },
          { label: "Total a Receber", value: "R$ 6.949,00", icon: Clock, color: "text-amber-400" },
        ].map(c => (
          <Card key={c.label} className="border-[#2A2A2A]">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase">{c.label}</span>
              </div>
              <p className="text-xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#2A2A2A]">
        <CardHeader><CardTitle className="text-sm">Configuração de Comissão</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4 max-w-md">
            <div><Label className="text-xs text-muted-foreground">% Cartão Crédito</Label><Input value="1,00%" readOnly className="h-8 text-xs mt-1 bg-muted/30" /></div>
            <div><Label className="text-xs text-muted-foreground">% PIX</Label><Input value="0,50%" readOnly className="h-8 text-xs mt-1 bg-muted/30" /></div>
            <div><Label className="text-xs text-muted-foreground">% Boleto</Label><Input value="0,50%" readOnly className="h-8 text-xs mt-1 bg-muted/30" /></div>
          </div>
          <div className="max-w-sm">
            <Label className="text-xs">Chave PIX para Recebimento</Label>
            <Input defaultValue="gerente@zaplynxpay.com" className="h-8 text-xs mt-1" />
          </div>
          <p className="text-[10px] text-muted-foreground">Pagamento mensal, todo dia 5</p>
        </CardContent>
      </Card>

      <Card className="border-[#2A2A2A]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Extrato Completo</CardTitle>
          <Button className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-4 text-xs">Solicitar Antecipação</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Mês</TableHead><TableHead>Volume Carteira</TableHead><TableHead>%</TableHead><TableHead>Bruto</TableHead><TableHead>IR Retido</TableHead><TableHead>Líquido</TableHead><TableHead>Status</TableHead><TableHead>Pagamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCommissions.map(c => {
                const badge = getStatusBadge(c.status);
                return (
                  <TableRow key={c.month} className="border-[#2A2A2A]">
                    <TableCell className="font-medium">{c.month}</TableCell>
                    <TableCell>{formatCurrencyReais(c.volumePortfolio)}</TableCell>
                    <TableCell className="text-muted-foreground">{c.commissionPercent}%</TableCell>
                    <TableCell>{formatCurrencyReais(c.grossValue)}</TableCell>
                    <TableCell className="text-red-400">{formatCurrencyReais(c.taxWithheld)}</TableCell>
                    <TableCell className="font-medium text-emerald-400">{formatCurrencyReais(c.netValue)}</TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.paymentDate || "—"}</TableCell>
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
