import { useState } from "react";
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
import { TrendingDown, Plus, Inbox, Pencil, Trash2, Percent } from "lucide-react";
import { toast } from "sonner";

interface Oferta {
  id: string;
  nome: string;
  gatilho: string;
  desconto: number;
  delay: string;
  ativo: boolean;
}

const MOCK: Oferta[] = [];

const GATILHOS = [
  { value: "abandono", label: "Pagamento abandonado" },
  { value: "recusa", label: "Recusou oferta principal" },
  { value: "expirado", label: "Após expirar plano" },
  { value: "inativo", label: "Cliente inativo (30d)" },
];

export default function TelegramDownsell() {
  const [ofertas, setOfertas] = useState<Oferta[]>(MOCK);
  const [nome, setNome] = useState("");
  const [gatilho, setGatilho] = useState("abandono");
  const [desconto, setDesconto] = useState("30");
  const [delay, setDelay] = useState("30");
  const [valorOriginal, setValorOriginal] = useState("");
  const [mensagem, setMensagem] = useState("");

  function criar() {
    if (!nome.trim() || !mensagem.trim()) {
      toast.error("Preencha nome e mensagem");
      return;
    }
    setOfertas((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nome,
        gatilho,
        desconto: Number(desconto),
        delay: `${delay} min`,
        ativo: true,
      },
    ]);
    setNome("");
    setMensagem("");
    setValorOriginal("");
    toast.success("Downsell criado");
  }

  function toggle(id: string) {
    setOfertas((prev) => prev.map((o) => o.id === id ? { ...o, ativo: !o.ativo } : o));
  }

  function remover(id: string) {
    setOfertas((prev) => prev.filter((o) => o.id !== id));
    toast.success("Downsell removido");
  }

  const valorComDesconto = valorOriginal && desconto
    ? (Number(valorOriginal) * (1 - Number(desconto) / 100)).toFixed(2)
    : "0.00";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Downsell</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie ofertas com desconto para recuperar usuários que abandonaram o pagamento ou recusaram a oferta principal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Criar oferta */}
        <Card className="overflow-hidden">
          <div className="flex">
            <div className="w-1 bg-primary shrink-0" />
            <div className="flex-1 p-5">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingDown className="w-5 h-5" /> Nova oferta de downsell
              </h2>
            </div>
          </div>
          <div className="p-5 pt-0 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da oferta</Label>
              <Input placeholder="Ex: Recuperação 30% após abandono" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Gatilho</Label>
                <Select value={gatilho} onValueChange={setGatilho}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GATILHOS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Disparar após (min)</Label>
                <Input type="number" min={0} value={delay} onChange={(e) => setDelay(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Desconto (%)</Label>
                <div className="relative">
                  <Input type="number" min={0} max={99} value={desconto} onChange={(e) => setDesconto(e.target.value)} className="pr-9" />
                  <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor original (R$)</Label>
                <Input type="number" min={0} placeholder="97,00" value={valorOriginal} onChange={(e) => setValorOriginal(e.target.value)} />
              </div>
            </div>

            {valorOriginal && (
              <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Valor com desconto</span>
                <span className="text-lg font-bold text-emerald-500">R$ {valorComDesconto}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem da oferta</Label>
              <Textarea
                rows={4}
                placeholder="Oi {nome}, vimos que você não finalizou. Que tal {desconto}% OFF? Aproveite: {link}"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Variáveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code>, <code className="bg-muted px-1 rounded">{"{desconto}"}</code>, <code className="bg-muted px-1 rounded">{"{link}"}</code>
              </p>
            </div>

            <Button onClick={criar} className="w-full">
              <Plus className="w-4 h-4 mr-1.5" /> Criar downsell
            </Button>
          </div>
        </Card>

        {/* Lista */}
        <Card className="overflow-hidden">
          <div className="flex">
            <div className="w-1 bg-primary shrink-0" />
            <div className="flex-1 p-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Ofertas configuradas <Badge variant="secondary" className="ml-2 rounded-full">{ofertas.length}</Badge>
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead className="text-center">Desconto</TableHead>
                  <TableHead>Delay</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ofertas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Inbox className="w-7 h-7" />
                        <p className="text-xs uppercase tracking-wide">Nenhuma oferta configurada</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : ofertas.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nome}</TableCell>
                    <TableCell>{GATILHOS.find((g) => g.value === o.gatilho)?.label || o.gatilho}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        -{o.desconto}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{o.delay}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={o.ativo} onCheckedChange={() => toggle(o.id)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon"><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remover(o.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
