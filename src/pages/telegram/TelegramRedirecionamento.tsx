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
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface RedirectButton {
  id: string;
  title: string;
  url: string;
}

const LIMIT = 3;

export default function TelegramRedirecionamento() {
  const [buttons, setButtons] = useState<RedirectButton[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RedirectButton | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  function openCreate() {
    setEditing(null);
    setTitle("");
    setUrl("");
    setOpen(true);
  }

  function openEdit(btn: RedirectButton) {
    setEditing(btn);
    setTitle(btn.title);
    setUrl(btn.url);
    setOpen(true);
  }

  function save() {
    if (!title.trim() || !url.trim()) {
      toast.error("Preencha título e link.");
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      toast.error("Link inválido. Use https://...");
      return;
    }

    if (editing) {
      setButtons((prev) =>
        prev.map((b) =>
          b.id === editing.id ? { ...b, title: title.trim(), url: url.trim() } : b,
        ),
      );
      toast.success("Botão atualizado!");
    } else {
      if (buttons.length >= LIMIT) {
        toast.error(`Limite de ${LIMIT} botões atingido.`);
        return;
      }
      setButtons((prev) => [
        ...prev,
        { id: crypto.randomUUID(), title: title.trim(), url: url.trim() },
      ]);
      toast.success("Botão criado!");
    }
    setOpen(false);
  }

  function remove(id: string) {
    setButtons((prev) => prev.filter((b) => b.id !== id));
    toast.success("Botão removido.");
  }

  const atLimit = buttons.length >= LIMIT;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Botões de redirecionamento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Botões de redirecionamento
        </p>
      </div>

      <Card className="p-6 max-w-3xl">
        <p className="text-sm text-foreground mb-4">
          Botões Extras que aparecerão no bot, redirecionando o usuário para outro
          lugar.
        </p>

        <div className="flex items-center gap-3 mb-6">
          <Button onClick={openCreate} disabled={atLimit}>
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar novo
          </Button>
          <span className="text-xs text-destructive">
            *Limite: {LIMIT} botões
          </span>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buttons.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Nenhum botão cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                buttons.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell>
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[320px]"
                      >
                        <span className="truncate">{b.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(b)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(b.id)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Botão" : "Adicionar Novo Botão"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="btn-title">Título</Label>
              <Input
                id="btn-title"
                placeholder="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="btn-url">Link de Redirecionamento</Label>
              <Input
                id="btn-url"
                placeholder="https://exemplo.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
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
