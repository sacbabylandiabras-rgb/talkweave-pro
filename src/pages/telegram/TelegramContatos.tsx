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
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Download, Eye, ChevronsLeft, ChevronsRight } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  cliente: string;
  email: string;
  telefone: string;
  telegram: string;
  vencimento: string;
  status: "ATIVO" | "INATIVO" | "TRIAL" | "EXPIRADO";
}

const MOCK: Contact[] = [];

const STATUS_STYLE: Record<Contact["status"], string> = {
  ATIVO: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  INATIVO: "bg-muted text-muted-foreground border-border",
  TRIAL: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  EXPIRADO: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function TelegramContatos() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [perPage, setPerPage] = useState("10");

  const filtered = useMemo(() => {
    return MOCK.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        c.cliente.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.telegram.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus contatos, acompanhe atividades e consulte o histórico de assinaturas individualmente
          </p>
        </div>
        <Button variant="outline" onClick={() => toast.success("Exportação iniciada")}>
          <Download className="w-4 h-4 mr-2" /> Exportar relatório
        </Button>
      </div>

      {/* Card principal com barra lateral colorida */}
      <Card className="overflow-hidden">
        <div className="flex">
          <div className="w-1 bg-primary shrink-0" />
          <div className="flex-1 p-5">
            <h2 className="text-lg font-semibold">Gestão de Contatos</h2>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Sub-header da tabela */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2 border-t">
            <div className="pt-3">
              <h3 className="font-semibold flex items-center gap-2">
                Todos os contatos
                <Badge variant="secondary" className="rounded-full">{filtered.length}</Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visualize o histórico de compras e todas as informações dos seus clientes
              </p>
            </div>
            <div className="flex items-center gap-2 pt-3">
              <Button variant="outline" size="icon" onClick={() => {}}>
                <Search className="w-4 h-4" />
              </Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ATIVO">Ativos</SelectItem>
                  <SelectItem value="INATIVO">Inativos</SelectItem>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="EXPIRADO">Expirados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Busca expansível (input simples opcional) */}
          {search !== "" || true ? (
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, e-mail ou telegram..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          ) : null}

          {/* Tabela */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="text-center">Cliente</TableHead>
                  <TableHead className="text-center">E-mail</TableHead>
                  <TableHead className="text-center">Telefone</TableHead>
                  <TableHead className="text-center">Telegram</TableHead>
                  <TableHead className="text-center">Vencimento</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                      Nenhum contato encontrado.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-center font-medium">{c.cliente}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{c.email || "—"}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{c.telefone || "—"}</TableCell>
                    <TableCell className="text-center">{c.telegram || "—"}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{c.vencimento || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={STATUS_STYLE[c.status]}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Página 1 de 1
            </p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <Button variant="ghost" size="icon" disabled>
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => e.preventDefault()} />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#" isActive onClick={(e) => e.preventDefault()}>1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => e.preventDefault()} />
                </PaginationItem>
                <PaginationItem>
                  <Button variant="ghost" size="icon" disabled>
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <Select value={perPage} onValueChange={setPerPage}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / página</SelectItem>
                <SelectItem value="25">25 / página</SelectItem>
                <SelectItem value="50">50 / página</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </div>
  );
}
