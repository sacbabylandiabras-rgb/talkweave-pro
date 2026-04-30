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
import { BellRing, Plus, Inbox, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Alerta {
  id: string;
  nome: string;
  evento: string;
  antecedencia: string;
  ativo: boolean;
}

const MOCK: Alerta[] = [];

const EVENTOS = [
  { value: "vencimento", label: "Antes do vencimento" },
  { value: "expirado", label: "Após expirar" },
  { value: "abandono", label: "Carrinho abandonado" },
  { value: "boas-vindas", label: "Boas-vindas (novo lead)" },
];

export default function TelegramAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>(MOCK);
  const [nome, setNome] = useState("");
  const [evento, setEvento] = useState("vencimento");
  const [antecedencia, setAntecedencia] = useState("3");
  const [mensagem, setMensagem] = useState("");

  function criar() {
    if (!nome.trim() || !mensagem.trim()) {
      toast.error("Preencha nome e mensagem");
      return;
    }
    setAlertas((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nome, evento, antecedencia: `${antecedencia} dias`, ativo: true },
    ]);
    setNome("");
    setMensagem("");
    toast.success("Alerta criado");
  }

  function toggle(id: string) {
    setAlertas((prev) => prev.map((a) => a.id === id ? { ...a, ativo: !a.ativo } : a));
  }

  function remover(id: string) {
    setAlertas((prev) => prev.filter((a) => a.id !== id));
    toast.success("Alerta removido");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alertas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure alertas automáticos enviados aos seus contatos antes do vencimento, após expirar e em outros eventos importantes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Criar alerta */}
        <Card className="overflow-hidden">
          <div className="flex">
            <div className="w-1 bg-primary shrink-0" />
            <div className="flex-1 p-5">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BellRing className="w-5 h-5" /> Novo alerta
              </h2>
            </div>
          </div>
          <div className="p-5 pt-0 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do alerta</Label>
              <Input placeholder="Ex: Lembrete 3 dias antes do vencimento" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Evento</Label>
                <Select value={evento} onValueChange={setEvento}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENTOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Antecedência (dias)</Label>
                <Input type="number" min={0} value={antecedencia} onChange={(e) => setAntecedencia(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                rows={4}
                placeholder="Olá {nome}, sua assinatura vence em {dias} dias. Renove agora!"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Use variáveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code>, <code className="bg-muted px-1 rounded">{"{dias}"}</code>, <code className="bg-muted px-1 rounded">{"{plano}"}</code>
              </p>
            </div>

            <Button onClick={criar} className="w-full">
              <Plus className="w-4 h-4 mr-1.5" /> Criar alerta
            </Button>
          </div>
        </Card>

        {/* Lista */}
        <Card className="overflow-hidden">
          <div className="flex">
            <div className="w-1 bg-primary shrink-0" />
            <div className="flex-1 p-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Alertas configurados <Badge variant="secondary" className="ml-2 rounded-full">{alertas.length}</Badge>
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Antecedência</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Inbox className="w-7 h-7" />
                        <p className="text-xs uppercase tracking-wide">Nenhum alerta configurado</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : alertas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell>{EVENTOS.find((e) => e.value === a.evento)?.label || a.evento}</TableCell>
                    <TableCell>{a.antecedencia}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={a.ativo} onCheckedChange={() => toggle(a.id)} />
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
      </div>
    </div>
  );
}
