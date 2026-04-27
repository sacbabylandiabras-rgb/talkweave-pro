import { Search, Eye, MessageCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockManagerClients, formatCurrencyReais, getStatusBadge } from "./mock-data";

export default function ManagerClients() {
  const stats = [
    { label: "Total", value: mockManagerClients.length },
    { label: "Ativos", value: mockManagerClients.filter(c => c.status === "active").length },
    { label: "Em Análise KYC", value: mockManagerClients.filter(c => c.status === "kyc_pending").length },
    { label: "Suspensos", value: mockManagerClients.filter(c => c.status === "suspended").length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minha Carteira</h1>
        <p className="text-sm text-muted-foreground">Seus clientes vinculados</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border-[#2A2A2A]">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              <p className="text-xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar clientes..." className="pl-10" />
      </div>

      <Card className="border-[#2A2A2A]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Empresa</TableHead><TableHead>CNPJ</TableHead><TableHead>Segmento</TableHead><TableHead>Status</TableHead><TableHead>Volume Mês</TableHead><TableHead>Comissão</TableHead><TableHead>Vinculação</TableHead><TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockManagerClients.map(c => {
                const badge = getStatusBadge(c.status);
                return (
                  <TableRow key={c.id} className="border-[#2A2A2A]">
                    <TableCell className="font-medium">{c.company}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.cnpj}</TableCell>
                    <TableCell className="text-sm">{c.segment}</TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                    <TableCell className="font-medium">{c.volumeMonth > 0 ? formatCurrencyReais(c.volumeMonth) : "—"}</TableCell>
                    <TableCell className="text-emerald-400">{c.commissionGenerated > 0 ? formatCurrencyReais(c.commissionGenerated) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.linkedAt}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MessageCircle className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#a78bfa]"><TrendingUp className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
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
