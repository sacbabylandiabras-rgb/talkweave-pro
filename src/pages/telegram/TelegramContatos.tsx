import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, Search, Download, MessageCircle, UserCheck, UserX, Crown } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  username: string;
  telegram_id: string;
  status: "lead" | "vip" | "expirado" | "trial";
  joined_at: string;
  last_interaction: string;
  total_spent: number;
}

const MOCK: Contact[] = [
  { id: "1", name: "João Silva", username: "@joaosilva", telegram_id: "123456789", status: "vip", joined_at: "2026-04-12", last_interaction: "2026-04-29", total_spent: 297 },
  { id: "2", name: "Maria Souza", username: "@mariasz", telegram_id: "987654321", status: "lead", joined_at: "2026-04-25", last_interaction: "2026-04-28", total_spent: 0 },
  { id: "3", name: "Pedro Lima", username: "@pedrolima", telegram_id: "456789123", status: "expirado", joined_at: "2026-02-10", last_interaction: "2026-04-01", total_spent: 47 },
  { id: "4", name: "Ana Costa", username: "@anacosta", telegram_id: "321654987", status: "trial", joined_at: "2026-04-28", last_interaction: "2026-04-30", total_spent: 0 },
];

const STATUS_LABEL: Record<Contact["status"], { label: string; cls: string }> = {
  vip: { label: "VIP", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  lead: { label: "Lead", cls: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  trial: { label: "Trial", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  expirado: { label: "Expirado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function TelegramContatos() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return MOCK.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q) || c.telegram_id.includes(q);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const totals = useMemo(() => ({
    total: MOCK.length,
    vip: MOCK.filter((c) => c.status === "vip").length,
    leads: MOCK.filter((c) => c.status === "lead").length,
    expirados: MOCK.filter((c) => c.status === "expirado").length,
  }), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contatos</h1>
        <p className="text-sm text-muted-foreground mt-1">Lista de usuários que interagiram com o bot</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{totals.total}</p></div>
          <Users className="w-8 h-8 text-primary opacity-60" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">VIPs</p><p className="text-2xl font-bold">{totals.vip}</p></div>
          <Crown className="w-8 h-8 text-emerald-500 opacity-60" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">Leads</p><p className="text-2xl font-bold">{totals.leads}</p></div>
          <UserCheck className="w-8 h-8 text-blue-500 opacity-60" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">Expirados</p><p className="text-2xl font-bold">{totals.expirados}</p></div>
          <UserX className="w-8 h-8 text-destructive opacity-60" />
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Todos os contatos <Badge variant="secondary" className="ml-2">{filtered.length}</Badge></h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar contato..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-64" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="vip">VIPs</SelectItem>
                <SelectItem value="lead">Leads</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="expirado">Expirados</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => toast.success("Exportação iniciada")}>
              <Download className="w-4 h-4 mr-1.5" /> Exportar
            </Button>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>ID Telegram</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entrou em</TableHead>
                <TableHead>Última interação</TableHead>
                <TableHead className="text-right">Gasto total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum contato encontrado.</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8"><AvatarFallback>{c.name.charAt(0)}</AvatarFallback></Avatar>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.telegram_id}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_LABEL[c.status].cls}>{STATUS_LABEL[c.status].label}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(c.joined_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">{new Date(c.last_interaction).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-medium">{c.total_spent.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Mensagem"><MessageCircle className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
