import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Bot } from "lucide-react";
import { toast } from "sonner";

interface Admin {
  id: string;
  user_id: string;
  added_at: string;
}

export default function TelegramAdministradores() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");

  function openAdd() {
    setUserId("");
    setOpen(true);
  }

  function save() {
    const cleaned = userId.trim();
    if (!cleaned) {
      toast.error("Informe o ID do usuário.");
      return;
    }
    if (!/^-?\d+$/.test(cleaned)) {
      toast.error("ID deve conter apenas números.");
      return;
    }
    if (admins.some((a) => a.user_id === cleaned)) {
      toast.error("Este usuário já é administrador.");
      return;
    }
    setAdmins((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        user_id: cleaned,
        added_at: new Date().toISOString(),
      },
    ]);
    toast.success("Administrador adicionado!");
    setOpen(false);
  }

  function remove(id: string) {
    setAdmins((prev) => prev.filter((a) => a.id !== id));
    toast.success("Administrador removido.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administradores</h1>
        <p className="text-sm text-muted-foreground mt-1">Administradores</p>
      </div>

      {/* Banner de instruções */}
      <Card className="p-6 md:p-8 overflow-hidden relative">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1 max-w-xl space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              Funções de administrador
            </h2>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Coloque o ID de usuários em "adicionar administrador".</p>
              <p>Após isso, dê o seguinte comando no seu BOT no</p>
              <p>
                Telegram:{" "}
                <code className="text-foreground font-mono">/comandos</code>
              </p>
            </div>
            <Button size="lg" onClick={openAdd} className="mt-2">
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar administrador
            </Button>
          </div>
          <div className="hidden md:flex items-center justify-center w-48 h-48 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
            <Bot className="w-24 h-24 text-primary" />
          </div>
        </div>
      </Card>

      {/* Lista */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Administradores ativos
        </h2>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID do usuário</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center text-sm text-muted-foreground py-12"
                  >
                    <button
                      onClick={openAdd}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-dashed border-muted-foreground/40 hover:border-primary hover:text-primary transition"
                      aria-label="Adicionar administrador"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </TableCell>
                </TableRow>
              ) : (
                admins.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.user_id}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(a.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar administrador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="admin-id">ID do usuário no Telegram</Label>
              <Input
                id="admin-id"
                placeholder="Ex: 123456789"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Use apenas números. Após adicionar, envie o comando{" "}
                <code className="font-mono text-foreground">/comandos</code> no
                bot.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
