import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DollarSign, ShoppingBag, TrendingUp, Search, Download, RefreshCcw, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Sale {
  id: string;
  contact_name: string;
  username: string;
  plan: string;
  value: number;
  status: "aprovada" | "pendente" | "estornada" | "expirada";
  payment_method: "pix" | "cartao";
  date: string;
  expires_at: string;
}

const MOCK: Sale[] = [
  { id: "TX-1001", contact_name: "João Silva", username: "@joaosilva", plan: "VIP Mensal", value: 47, status: "aprovada", payment_method: "pix", date: "2026-04-30", expires_at: "2026-05-30" },
  { id: "TX-1002", contact_name: "Maria Souza", username: "@mariasz", plan: "VIP Trimestral", value: 127, status: "aprovada", payment_method: "cartao", date: "2026-04-29", expires_at: "2026-07-29" },
  { id: "TX-1003", contact_name: "Pedro Lima", username: "@pedrolima", plan: "VIP Mensal", value: 47, status: "pendente", payment_method: "pix", date: "2026-04-30", expires_at: "—" },
  { id: "TX-1004", contact_name: "Ana Costa", username: "@anacosta", plan: "VIP Anual", value: 397, status: "estornada", payment_method: "cartao", date: "2026-04-25", expires_at: "—" },
];

const STATUS: Record<Sale["status"], { label: string; cls: string }> = {
  aprovada: { label: "Aprovada", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  estornada: { label: "Estornada", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  expirada: { label: "Expirada", cls: "bg-muted text-muted-foreground border-muted" },
};

export default function TelegramVendas() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState("month");

  const filtered = useMemo(() => MOCK.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.contact_name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  }), [search, statusFilter]);

  const totals = useMemo(() => {
    const aprovadas = MOCK.filter((s) => s.status === "aprovada");
    return {
      faturamento: aprovadas.reduce((acc, s) => acc + s.value, 0),
      vendas: aprovadas.length,
      pendentes: MOCK.filter((s) => s.status === "pendente").length,
      ticket: aprovadas.length ? aprovadas.reduce((a, s) => a + s.value, 0) / aprovadas.length : 0,
    };
  }, []);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Gestão de Vendas <Badge className="bg-primary/20 text-primary border-0 text-[10px]">NOVO</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe vendas, assinaturas e renovações</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44"><Calendar className="w-4 h-4 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Últimos 30 dias</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => toast.success("Atualizado")}>
            <RefreshCcw className="w-4 h-4 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">Faturamento</p><p className="text-2xl font-bold">{fmt(totals.faturamento)}</p></div>
          <DollarSign className="w-8 h-8 text-emerald-500 opacity-60" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">Vendas aprovadas</p><p className="text-2xl font-bold">{totals.vendas}</p></div>
          <ShoppingBag className="w-8 h-8 text-primary opacity-60" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-2xl font-bold">{totals.pendentes}</p></div>
          <Calendar className="w-8 h-8 text-amber-500 opacity-60" />
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div><p className="text-xs text-muted-foreground">Ticket médio</p><p className="text-2xl font-bold">{fmt(totals.ticket)}</p></div>
          <TrendingUp className="w-8 h-8 text-blue-500 opacity-60" />
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Transações <Badge variant="secondary" className="ml-2">{filtered.length}</Badge></h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-64" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="aprovada">Aprovadas</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="estornada">Estornadas</SelectItem>
                <SelectItem value="expirada">Expiradas</SelectItem>
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
                <TableHead>ID</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Nenhuma venda encontrada.</TableCell></TableRow>
              ) : filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell>
                    <p className="font-medium">{s.contact_name}</p>
                    <p className="text-xs text-muted-foreground">{s.username}</p>
                  </TableCell>
                  <TableCell>{s.plan}</TableCell>
                  <TableCell><Badge variant="outline" className="uppercase text-xs">{s.payment_method}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={STATUS[s.status].cls}>{STATUS[s.status].label}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(s.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">{s.expires_at === "—" ? "—" : new Date(s.expires_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(s.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
