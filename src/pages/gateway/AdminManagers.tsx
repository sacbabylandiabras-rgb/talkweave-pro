import { Plus, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyReais } from "./mock-data";

const managers = [
  { name: "Carlos Mendes", email: "gerente@zaplynxpay.com", clients: 8, volumeMonth: 817500, commissionMonth: 8175, status: "active" },
  { name: "Ana Gerente", email: "ana@zaplynxpay.com", clients: 5, volumeMonth: 423600, commissionMonth: 4236, status: "active" },
];

export default function AdminManagers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerentes de Contas</h1>
          <p className="text-sm text-muted-foreground">Gerencie gerentes e suas carteiras</p>
        </div>
        <Button className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-6 text-xs"><Plus className="w-4 h-4 mr-1" /> Cadastrar Gerente</Button>
      </div>

      <Card className="border-[#2A2A2A]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Nº Clientes</TableHead><TableHead>Volume Carteira</TableHead><TableHead>Comissão Mês</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map(m => (
                <TableRow key={m.email} className="border-[#2A2A2A]">
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                  <TableCell>{m.clients}</TableCell>
                  <TableCell className="font-medium">{formatCurrencyReais(m.volumeMonth)}</TableCell>
                  <TableCell className="text-emerald-400 font-medium">{formatCurrencyReais(m.commissionMonth)}</TableCell>
                  <TableCell><span className="px-2 py-0.5 rounded-full text-[10px] text-emerald-400 bg-emerald-500/10">Ativo</span></TableCell>
                  <TableCell><Button variant="outline" size="sm" className="text-xs h-7 rounded-full"><Eye className="w-3 h-3 mr-1" /> Detalhes</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
