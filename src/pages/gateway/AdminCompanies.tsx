import { Search, Download, Eye, Edit, Trash2, UserCheck, LogIn } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockCompanies, formatCurrencyReais, getStatusBadge } from "./mock-data";

export default function AdminCompanies() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empresas / Lojistas</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as empresas da plataforma</p>
        </div>
        <Button variant="outline" className="rounded-full text-xs"><Download className="w-3.5 h-3.5 mr-1.5" /> Exportar CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Ativas", value: "47", color: "text-emerald-400" },
          { label: "Em Análise", value: "8", color: "text-blue-400" },
          { label: "Suspensas", value: "3", color: "text-red-400" },
          { label: "Total", value: "58", color: "text-foreground" },
        ].map(c => (
          <Card key={c.label} className="border-[#2A2A2A]">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar empresas..." className="pl-10" />
      </div>

      <Card className="border-[#2A2A2A]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Empresa</TableHead><TableHead>CNPJ</TableHead><TableHead>Segmento</TableHead><TableHead>Status</TableHead><TableHead>Gerente</TableHead><TableHead>Volume Mês</TableHead><TableHead>Aprovação</TableHead><TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCompanies.map(c => {
                const badge = getStatusBadge(c.status);
                return (
                  <TableRow key={c.id} className="border-[#2A2A2A]">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.cnpj}</TableCell>
                    <TableCell className="text-sm">{c.segment}</TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded-full text-xs ${badge.color} ${badge.bg}`}>{badge.label}</span></TableCell>
                    <TableCell className="text-sm">{c.manager || "—"}</TableCell>
                    <TableCell className="font-medium">{c.volumeMonth > 0 ? formatCurrencyReais(c.volumeMonth) : "—"}</TableCell>
                    <TableCell>{c.approvalRate > 0 ? `${c.approvalRate}%` : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#a78bfa]" title="Impersonar"><LogIn className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button>
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
