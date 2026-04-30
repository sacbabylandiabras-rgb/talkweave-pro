import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Copy, Youtube, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ContingenciaBot {
  id: string;
  nome: string;
  url: string;
  ativo: boolean;
}

export default function TelegramLinksTraqueamento() {
  const [redirectLink] = useState("https://redirect.zaplynx.com.br/bot/access/490697");
  const [bots, setBots] = useState<ContingenciaBot[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", url: "" });

  const handleCopy = () => {
    navigator.clipboard.writeText(redirectLink);
    toast.success("Link copiado");
  };

  const handleCreate = () => {
    if (!form.nome || !form.url) {
      toast.error("Preencha nome e URL");
      return;
    }
    setBots((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nome: form.nome, url: form.url, ativo: true },
    ]);
    setForm({ nome: "", url: "" });
    setOpen(false);
    toast.success("Bot de contingência adicionado");
  };

  const toggle = (id: string) =>
    setBots((prev) => prev.map((b) => (b.id === id ? { ...b, ativo: !b.ativo } : b)));

  const remove = (id: string) =>
    setBots((prev) => prev.filter((b) => b.id !== id));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Links de Traqueamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere os links de traqueamento para seus anúncios de marketing
          </p>
        </div>
        <button className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
          <Youtube className="w-4 h-4 text-red-500" />
          Assistir tutorial
        </button>
      </div>

      <Card className="p-6">
        <Tabs defaultValue="redirect" className="w-full">
          <div className="flex items-center justify-between border-b border-border mb-6">
            <h2 className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3">
              Redirecionador
            </h2>
            <TabsList className="bg-transparent border-0 p-0 h-auto gap-6">
              <TabsTrigger
                value="redirect"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
              >
                Redirecionador
              </TabsTrigger>
              <TabsTrigger
                value="contingencia"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-3"
              >
                Gestão de Contingência
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="redirect" className="space-y-6 mt-0">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Redirecionador</h3>
              <p className="text-sm text-muted-foreground">
                Configure caminhos automáticos para direcionar o usuário ao próximo passo desejado.
                Essa função permite enviar mensagens, acionar fluxos específicos ou redirecionar para outros bots.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Link do redirecionar</Label>
              <div className="relative">
                <Input value={redirectLink} readOnly className="pr-12" />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={handleCopy}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contingencia" className="space-y-6 mt-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Gestão de Contingência</h3>
                <p className="text-sm text-muted-foreground">
                  Cadastre bots de contingência que receberão o tráfego caso o bot principal seja banido ou fique offline.
                </p>
              </div>
              <Button onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar bot
              </Button>
            </div>

            {bots.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhum bot de contingência cadastrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bots.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{b.url}</TableCell>
                      <TableCell>
                        <Switch checked={b.ativo} onCheckedChange={() => toggle(b.id)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(b.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar bot de contingência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do bot</Label>
              <Input
                id="nome"
                placeholder="Ex: Bot Reserva"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL do bot</Label>
              <Input
                id="url"
                placeholder="https://t.me/seu_bot"
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}