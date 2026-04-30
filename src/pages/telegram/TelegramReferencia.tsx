import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Calendar,
  Copy,
  Trash2,
  Link as LinkIcon,
  Search,
  TrendingUp,
  Users,
  DollarSign,
  MousePointerClick,
} from "lucide-react";
import { toast } from "sonner";

interface RefLink {
  id: string;
  title: string;
  identifier: string;
  bot: string;
  sales_count: number;
  sales_value: number;
  leads: number;
  generated_link: string;
  created_at: string;
}

const AVAILABLE_BOTS = [
  { id: "bot1", name: "@meu_bot_vip" },
  { id: "bot2", name: "@bot_promo" },
];

const FILTERS = [
  { id: "all", label: "Mostrando todos" },
  { id: "today", label: "Hoje" },
  { id: "week", label: "Últimos 7 dias" },
  { id: "month", label: "Últimos 30 dias" },
];

export default function TelegramReferencia() {
  const [links, setLinks] = useState<RefLink[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [bot, setBot] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return links;
    const q = search.toLowerCase();
    return links.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.identifier.toLowerCase().includes(q),
    );
  }, [links, search]);

  const totals = useMemo(
    () => ({
      total: links.length,
      sales: links.reduce((s, l) => s + l.sales_count, 0),
      revenue: links.reduce((s, l) => s + l.sales_value, 0),
      leads: links.reduce((s, l) => s + l.leads, 0),
    }),
    [links],
  );

  function reset() {
    setTitle("");
    setIdentifier("");
    setBot("");
  }

  function generate() {
    if (!title.trim()) {
      toast.error("Informe um título.");
      return;
    }
    if (!identifier.trim()) {
      toast.error("Informe um identificador.");
      return;
    }
    const slug = identifier.trim().toLowerCase().replace(/\s+/g, "-");
    const novo: RefLink = {
      id: crypto.randomUUID(),
      title: title.trim(),
      identifier: slug,
      bot: bot || "—",
      sales_count: 0,
      sales_value: 0,
      leads: 0,
      generated_link: `https://t.me/${bot ? bot.replace("@", "") : "seu_bot"}?start=ref_${slug}`,
      created_at: new Date().toISOString(),
    };
    setLinks((prev) => [novo, ...prev]);
    toast.success("Link de referência gerado!");
    setOpen(false);
    reset();
  }

  function copy(link: string) {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  }

  function remove(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    toast.success("Link removido.");
  }

  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Links de Referência
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gere os links de referência para seus bots
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Links cadastrados</p>
              <p className="text-2xl font-bold">{totals.total}</p>
            </div>
            <LinkIcon className="w-8 h-8 text-primary opacity-60" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Vendas totais</p>
              <p className="text-2xl font-bold">{totals.sales}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-500 opacity-60" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Faturamento</p>
              <p className="text-2xl font-bold">{formatBRL(totals.revenue)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-amber-500 opacity-60" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Leads</p>
              <p className="text-2xl font-bold">{totals.leads}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500 opacity-60" />
          </div>
        </Card>
      </div>

      {/* Header bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Todos os links cadastrados</h2>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-56"
              />
            </div>

            <Button variant="outline" size="icon" title="Filtrar por data">
              <Calendar className="w-4 h-4" />
            </Button>

            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Gerar novo link
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Usuário bot</TableHead>
                <TableHead className="text-right">Vendas (quat.)</TableHead>
                <TableHead className="text-right">Vendas (valor)</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Link gerado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <MousePointerClick className="w-10 h-10 opacity-40" />
                      <p className="text-sm">Nenhum link cadastrado ainda.</p>
                      <Button
                        variant="link"
                        onClick={() => setOpen(true)}
                        className="h-auto p-0"
                      >
                        Gerar meu primeiro link
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.bot}
                    </TableCell>
                    <TableCell className="text-right">{l.sales_count}</TableCell>
                    <TableCell className="text-right">
                      {formatBRL(l.sales_value)}
                    </TableCell>
                    <TableCell className="text-right">{l.leads}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.identifier}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {l.generated_link}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copy(l.generated_link)}
                          title="Copiar link"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(l.id)}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crie um link de referência</DialogTitle>
            <DialogDescription>
              Gere um link personalizado e acompanhe o desempenho dele em tempo
              real
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm font-medium">
              Preencha as informações da sua conta
            </p>

            <div className="space-y-2">
              <Label htmlFor="title">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Insira um título para o seu link de referência"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="identifier">
                Identificador <span className="text-destructive">*</span>
              </Label>
              <Input
                id="identifier"
                placeholder="Insira um identificador para o seu link de referência"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground">
                Use apenas letras, números e hífens.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Escolha seu bot</Label>
              <Select value={bot} onValueChange={setBot}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o bot" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_BOTS.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={generate}>Gerar link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
