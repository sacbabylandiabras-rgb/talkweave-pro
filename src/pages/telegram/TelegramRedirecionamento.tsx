import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Search,
  Copy,
  Download,
  ArrowUp,
  ArrowDown,
  Link2,
  ShoppingCart,
  MessageCircle,
  Globe,
  Sparkles,
  MousePointerClick,
  Eye,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";

type ButtonType = "url" | "checkout" | "whatsapp" | "telegram";

interface RedirectButton {
  id: string;
  title: string;
  url: string;
  type: ButtonType;
  description?: string;
  active: boolean;
  clicks: number;
  position: number;
  created_at: string;
}

const LIMIT = 3;

const TYPE_META: Record<
  ButtonType,
  { label: string; icon: typeof Link2; color: string }
> = {
  url: {
    label: "Link externo",
    icon: Globe,
    color: "bg-primary/15 text-primary border-primary/30",
  },
  checkout: {
    label: "Checkout",
    icon: ShoppingCart,
    color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    color: "bg-green-500/15 text-green-600 border-green-500/30",
  },
  telegram: {
    label: "Telegram",
    icon: Sparkles,
    color: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  },
};

export default function TelegramRedirecionamento() {
  const [buttons, setButtons] = useState<RedirectButton[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RedirectButton | null>(null);
  const [search, setSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<ButtonType>("url");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);

  function reset() {
    setEditing(null);
    setTitle("");
    setUrl("");
    setType("url");
    setDescription("");
    setActive(true);
  }

  function openCreate() {
    if (buttons.length >= LIMIT) {
      toast.error(`Limite de ${LIMIT} botões atingido.`);
      return;
    }
    reset();
    setOpen(true);
  }

  function openEdit(btn: RedirectButton) {
    setEditing(btn);
    setTitle(btn.title);
    setUrl(btn.url);
    setType(btn.type);
    setDescription(btn.description ?? "");
    setActive(btn.active);
    setOpen(true);
  }

  function save() {
    if (!title.trim()) {
      toast.error("Informe o título do botão.");
      return;
    }
    if (title.trim().length > 40) {
      toast.error("Título deve ter no máximo 40 caracteres.");
      return;
    }
    if (!url.trim()) {
      toast.error("Informe o link.");
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
          b.id === editing.id
            ? {
                ...b,
                title: title.trim(),
                url: url.trim(),
                type,
                description: description.trim() || undefined,
                active,
              }
            : b,
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
        {
          id: crypto.randomUUID(),
          title: title.trim(),
          url: url.trim(),
          type,
          description: description.trim() || undefined,
          active,
          clicks: 0,
          position: prev.length + 1,
          created_at: new Date().toISOString(),
        },
      ]);
      toast.success("Botão criado!");
    }
    setOpen(false);
    reset();
  }

  function remove(id: string) {
    setButtons((prev) =>
      prev
        .filter((b) => b.id !== id)
        .map((b, idx) => ({ ...b, position: idx + 1 })),
    );
    toast.success("Botão removido.");
  }

  function duplicate(btn: RedirectButton) {
    if (buttons.length >= LIMIT) {
      toast.error(`Limite de ${LIMIT} botões atingido.`);
      return;
    }
    setButtons((prev) => [
      ...prev,
      {
        ...btn,
        id: crypto.randomUUID(),
        title: `${btn.title} (cópia)`.slice(0, 40),
        clicks: 0,
        position: prev.length + 1,
        created_at: new Date().toISOString(),
      },
    ]);
    toast.success("Botão duplicado!");
  }

  function toggleActive(id: string) {
    setButtons((prev) =>
      prev.map((b) => (b.id === id ? { ...b, active: !b.active } : b)),
    );
  }

  function move(id: string, dir: "up" | "down") {
    setButtons((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const target = dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((b, i) => ({ ...b, position: i + 1 }));
    });
  }

  function copyUrl(u: string) {
    navigator.clipboard.writeText(u);
    toast.success("Link copiado!");
  }

  function exportCsv() {
    if (buttons.length === 0) {
      toast.error("Nada para exportar.");
      return;
    }
    const rows = [
      ["Posição", "Título", "Tipo", "Link", "Ativo", "Cliques", "Criado em"],
      ...buttons.map((b) => [
        String(b.position),
        b.title,
        TYPE_META[b.type].label,
        b.url,
        b.active ? "Sim" : "Não",
        String(b.clicks),
        new Date(b.created_at).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `botoes-redirecionamento-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(u);
    toast.success("CSV exportado!");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buttons;
    return buttons.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        TYPE_META[b.type].label.toLowerCase().includes(q),
    );
  }, [buttons, search]);

  const stats = useMemo(
    () => ({
      total: buttons.length,
      active: buttons.filter((b) => b.active).length,
      clicks: buttons.reduce((acc, b) => acc + b.clicks, 0),
    }),
    [buttons],
  );

  const atLimit = buttons.length >= LIMIT;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Botões de redirecionamento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Botões extras que aparecerão no bot, redirecionando o usuário para
            outro lugar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            disabled={buttons.length === 0}
          >
            <Eye className="w-4 h-4 mr-1.5" />
            Pré-visualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Botões cadastrados</p>
            <p className="text-2xl font-bold text-foreground">
              {stats.total}{" "}
              <span className="text-sm text-muted-foreground font-normal">
                / {LIMIT}
              </span>
            </p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <ToggleRight className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <MousePointerClick className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cliques totais</p>
            <p className="text-2xl font-bold text-foreground">{stats.clicks}</p>
          </div>
        </Card>
      </div>

      {/* Card principal */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Button onClick={openCreate} disabled={atLimit}>
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar novo
          </Button>
          <span className="text-xs text-destructive">
            *Limite: {LIMIT} botões
          </span>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="w-20">Cliques</TableHead>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-44 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground py-10"
                  >
                    {buttons.length === 0
                      ? "Nenhum botão cadastrado."
                      : "Nenhum resultado para a busca."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b, idx) => {
                  const Icon = TYPE_META[b.type].icon;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {b.position}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{b.title}</span>
                          {b.description && (
                            <span className="text-xs text-muted-foreground">
                              {b.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${TYPE_META[b.type].color} gap-1`}
                        >
                          <Icon className="w-3 h-3" />
                          {TYPE_META[b.type].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[260px]"
                        >
                          <span className="truncate">{b.url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {b.clicks}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={b.active}
                          onCheckedChange={() => toggleActive(b.id)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => move(b.id, "up")}
                            disabled={idx === 0}
                            title="Mover para cima"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => move(b.id, "down")}
                            disabled={idx === filtered.length - 1}
                            title="Mover para baixo"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyUrl(b.url)}
                            title="Copiar link"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => duplicate(b)}
                            title="Duplicar"
                            disabled={atLimit}
                          >
                            <Sparkles className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(b)}
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(b.id)}
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal Add/Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Botão" : "Adicionar Novo Botão"}
            </DialogTitle>
            <DialogDescription>
              Configure o tipo, título, link e descrição do botão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de botão</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(Object.keys(TYPE_META) as ButtonType[]).map((t) => {
                  const Icon = TYPE_META[t].icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`px-3 py-3 rounded-md border text-sm transition flex flex-col items-center gap-1 ${
                        type === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{TYPE_META[t].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="btn-title">Título</Label>
                <Input
                  id="btn-title"
                  placeholder="Ex: Comprar agora"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={40}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {title.length}/40
                </p>
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

            <div className="space-y-2">
              <Label htmlFor="btn-desc">Descrição interna (opcional)</Label>
              <Textarea
                id="btn-desc"
                placeholder="Anotação interna sobre o botão..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={160}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">
                  Botões inativos não aparecem para os usuários.
                </p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
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

      {/* Modal Pré-visualização */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pré-visualização no bot</DialogTitle>
            <DialogDescription>
              Assim os botões aparecerão para o usuário no Telegram.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/40 p-4 space-y-2">
            {buttons
              .filter((b) => b.active)
              .map((b) => {
                const Icon = TYPE_META[b.type].icon;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-background border px-4 py-2 text-sm font-medium hover:bg-muted transition"
                  >
                    <Icon className="w-4 h-4" />
                    {b.title}
                  </button>
                );
              })}
            {buttons.filter((b) => b.active).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                Nenhum botão ativo para exibir.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
