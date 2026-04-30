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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Disparo {
  id: string;
  titulo: string;
  plano: string;
  valor_promocional: number;
  vendas_quant: number;
  vendas_val: number;
  cliques: number;
  status: boolean;
  minutos: number;
  mensagem: string;
}

const MOCK: Disparo[] = [];

const PLANOS = ["Mensal", "Trimestral", "Semestral", "Anual", "Vitalício"];

export default function TelegramDownsell() {
  const [items, setItems] = useState<Disparo[]>(MOCK);
  const [open, setOpen] = useState(false);

  // Form
  const [titulo, setTitulo] = useState("");
  const [plano, setPlano] = useState(PLANOS[0]);
  const [valor, setValor] = useState("");
  const [minutos, setMinutos] = useState("30");
  const [mensagem, setMensagem] = useState("");

  function reset() {
    setTitulo(""); setPlano(PLANOS[0]); setValor(""); setMinutos("30"); setMensagem("");
  }

  function criar() {
    if (!titulo.trim() || !mensagem.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }
    setItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      titulo,
      plano,
      valor_promocional: Number(valor) || 0,
      vendas_quant: 0,
      vendas_val: 0,
      cliques: 0,
      status: true,
      minutos: Number(minutos) || 0,
      mensagem,
    }]);
    setOpen(false);
    reset();
    toast.success("Disparo criado");
  }

  function toggle(id: string) {
    setItems((prev) => prev.map((d) => d.id === id ? { ...d, status: !d.status } : d));
  }

  function remover(id: string) {
    setItems((prev) => prev.filter((d) => d.id !== id));
    toast.success("Disparo removido");
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Downsell</h1>
        <p className="text-sm text-muted-foreground mt-1">Downsell</p>
      </div>

      {/* Card principal */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            Todos os disparos criados
            <Badge className="bg-primary text-primary-foreground rounded-full">{items.length}</Badge>
          </h2>
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Criar novo disparo
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-t border-b">
                <TableHead>Título downsell</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Valor promocional</TableHead>
                <TableHead>Vendas quant.</TableHead>
                <TableHead>Vendas val.</TableHead>
                <TableHead>Cliques</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Minutos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-16">
                    <div className="flex flex-col items-center gap-1 text-center text-muted-foreground">
                      <p className="text-sm">Nenhum disparo criado ainda.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.titulo}</TableCell>
                  <TableCell>{d.plano}</TableCell>
                  <TableCell>{fmt(d.valor_promocional)}</TableCell>
                  <TableCell>{d.vendas_quant}</TableCell>
                  <TableCell>{fmt(d.vendas_val)}</TableCell>
                  <TableCell>{d.cliques}</TableCell>
                  <TableCell>
                    <Switch checked={d.status} onCheckedChange={() => toggle(d.id)} />
                  </TableCell>
                  <TableCell>{d.minutos} min</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon"><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remover(d.id)}>
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
            <DialogTitle>Criar novo disparo de downsell</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Título downsell</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Recuperação 50% OFF" />
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
                <Label className="text-xs">Valor promocional (R$)</Label>
                <Input type="number" min={0} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="9,90" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Disparar após (minutos)</Label>
              <Input type="number" min={0} value={minutos} onChange={(e) => setMinutos(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea rows={4} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Oi {nome}, última chance: {desconto}% OFF! {link}" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={criar}>Criar disparo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
