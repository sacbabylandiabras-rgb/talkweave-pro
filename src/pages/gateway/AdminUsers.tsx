import { Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const users = [
  { name: "Admin Master", email: "admin@zaplynxpay.com", role: "Admin Master", company: "ZapLynxPay", status: "active", lastAccess: "27/03/2025 14:30" },
  { name: "Carlos Mendes", email: "gerente@zaplynxpay.com", role: "Gerente de Contas", company: "ZapLynxPay", status: "active", lastAccess: "27/03/2025 12:00" },
  { name: "Ana Gerente", email: "ana@zaplynxpay.com", role: "Gerente de Contas", company: "ZapLynxPay", status: "active", lastAccess: "26/03/2025 18:45" },
  { name: "TechStore Admin", email: "lojista@techstore.com", role: "Lojista", company: "TechStore Ltda", status: "active", lastAccess: "27/03/2025 14:00" },
  { name: "Financeiro", email: "fin@zaplynxpay.com", role: "Admin Financeiro", company: "ZapLynxPay", status: "active", lastAccess: "25/03/2025 10:30" },
];

const roleColors: Record<string, string> = {
  "Admin Master": "text-[#a78bfa] bg-[#a78bfa]/10",
  "Admin Financeiro": "text-amber-400 bg-amber-400/10",
  "Gerente de Contas": "text-purple-400 bg-purple-400/10",
  "Lojista": "text-blue-400 bg-blue-400/10",
};

export default function AdminUsers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários & Permissões</h1>
          <p className="text-sm text-muted-foreground">Gerencie usuários e seus acessos</p>
        </div>
        <Button className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-6 text-xs"><Plus className="w-4 h-4 mr-1" /> Criar Usuário</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar usuários..." className="pl-10" />
      </div>

      <Card className="border-[#2A2A2A]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A]">
                <TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Role</TableHead><TableHead>Empresa</TableHead><TableHead>Status</TableHead><TableHead>Último Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.email} className="border-[#2A2A2A]">
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleColors[u.role] || ''}`}>{u.role}</span></TableCell>
                  <TableCell className="text-sm">{u.company}</TableCell>
                  <TableCell><span className="px-2 py-0.5 rounded-full text-[10px] text-emerald-400 bg-emerald-500/10">Ativo</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.lastAccess}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
