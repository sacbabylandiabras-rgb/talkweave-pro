import { Eye, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockTransactions, formatCurrency, getStatusBadge, getMethodLabel } from "./mock-data";

export default function AdminTransactions() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transações Globais</h1>
          <p className="text-sm text-muted-foreground">Todas as transações de todos os lojistas</p>
        </div>
        <Button variant="outline" className="rounded-full text-xs"><Download className="w-3.5 h-3.5 mr-1.5" /> Exportar</Button>
      </div>

      <Card className="border-[#2A2A2A]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>ID</TableHead><TableHead>Lojista</TableHead><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead>Taxa</TableHead><TableHead>Líquido</TableHead><TableHead>Método</TableHead><TableHead>Adquirente</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTransactions.map(tx => {
                const badge = getStatusBadge(tx.status);
                return (
                  <TableRow key={tx.id} className="border-[#2A2A2A]">
                    <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                    <TableCell className="text-sm">TechStore</TableCell>
                    <TableCell>{tx.customer}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(tx.grossAmount)}</TableCell>
                    <TableCell className="text-red-400 text-sm">{formatCurrency(tx.fee)}</TableCell>
                    <TableCell>{formatCurrency(tx.netAmount)}</TableCell>
                    <TableCell className="text-sm">{getMethodLabel(tx.method)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">{tx.acquirer}</TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.date}</TableCell>
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
