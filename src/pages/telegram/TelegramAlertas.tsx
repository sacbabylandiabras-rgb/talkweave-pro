import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Alerta {
  id: string;
  titulo: string;
  plano: string;
  valor_promocao: number;
  usuarios_alvo: string;
  status: boolean;
  mensagem: string;
}

const MOCK: Alerta[] = [];

const PLANOS = ["Mensal", "Trimestral", "Semestral", "Anual", "Vitalício"];
const ALVOS = ["Todos", "VIPs", "Leads", "Trial", "Expirados"];

export default function TelegramAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>(MOCK);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("all");
  const [open, setOpen] = useState(false);

  // Form
  const [titulo, setTitulo] = useState("");
  const [plano, setPlano] = useState(PLANOS[0]);
  const [valor, setValor] = useState("");
  const [alvo, setAlvo] = useState(ALVOS[0]);
  const [mensagem, setMensagem] = useState("");

  function reset() {
    setTitulo(""); setPlano(PLANOS[0]); setValor(""); setAlvo(ALVOS[0]); setMensagem("");
  }

  function criar() {
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }
    setAlertas((prev) => [...prev, {
      id: crypto.randomUUID(),
      titulo,
      plano,
      valor_promocao: Number(valor) || 0,
      usuarios_alvo: alvo,
      status: true,
      mensagem,
    }]);
    setOpen(false);
    reset();
    toast.success("Alerta criado");
  }

  function toggle(id: string) {
    setAlertas((prev) => prev.map((a) => a.id === id ? { ...a, status: !a.status } : a));
  }

  function remover(id: string) {
    setAlertas((prev) => prev.filter((a) => a.id !== id));
    toast.success("Alerta removido");
  }

  const filtered = useMemo(() => alertas.filter((a) => {
    const matchSearch = !search || a.titulo.toLowerCase().includes(search.toLowerCase());
    const matchFiltro = filtro === "all" || (filtro === "ativo" && a.status) || (filtro === "inativo" && !a.status);
    return matchSearch && matchFiltro;
  }), [alertas, search, filtro]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Alertas</h1>
        <p className="text-sm text-muted-foreground mt-1">Alertas</p>
      </div>

      {/* Card principal */}
      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Todos os alertas cadastrados
            <Badge className="bg-primary text-primary-foreground rounded-full">{filtered.length}</Badge>
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon">
              <Search className="w-4 h-4" />
            </Button>
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mostrando todos</SelectItem>
                <SelectItem value="ativo">Apenas ativos</SelectItem>
                <SelectItem value="inativo">Apenas inativos</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Criar novo alerta
            </Button>
          </div>
        </div>

        {/* Busca expansível */}
        {search !== "" && (
          <div className="mb-3">
            <Input placeholder="Buscar por título..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-t border-b">
                <TableHead>Título</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Valor da promoção</TableHead>
                <TableHead>Usuários alvo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <p className="font-semibold">Nenhum alerta encontrado</p>
                      <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou criar um novo disparo</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.titulo}</TableCell>
                  <TableCell>{a.plano}</TableCell>
                  <TableCell>{fmt(a.valor_promocao)}</TableCell>
                  <TableCell>{a.usuarios_alvo}</TableCell>
                  <TableCell>
                    <Switch checked={a.status} onCheckedChange={() => toggle(a.id)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon"><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remover(a.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal criar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar novo alerta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Promoção de boas-vindas" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Plano</Label>
                <Select value={plano} onValueChange={setPlano}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLANOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor da promoção (R$)</Label>
                <Input type="number" min={0} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="9,90" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Usuários alvo</Label>
              <Select value={alvo} onValueChange={setAlvo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALVOS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Olá {nome}, aproveite nossa promoção!" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={criar}>Criar alerta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
