import { useEffect, useMemo, useState } from "react";
import {
  readTelegramGroupsChannels,
  writeTelegramGroupsChannels,
} from "@/hooks/useTelegramGroups";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Trash2,
  Pencil,
  Copy,
  ExternalLink,
  Search,
  Users,
  Megaphone,
  Hash,
  Send,
  Check,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

type GroupKind = "group" | "channel";

interface TgGroup {
  id: string;
  title: string;
  link: string;
  group_id: string;
  kind: GroupKind;
  plan_ids: string[];
  created_at: string;
}

const KIND_LABEL: Record<GroupKind, string> = {
  group: "Grupo",
  channel: "Canal",
};

// Planos disponíveis (mock - viria da página de Planos)
const AVAILABLE_PLANS: { id: string; name: string; price: string }[] = [];

export default function TelegramGruposCanais() {
  const [items, setItems] = useState<TgGroup[]>([]);

  useEffect(() => {
    const stored = readTelegramGroupsChannels();
    if (stored.length) {
      setItems(
        stored.map((s) => ({
          id: s.id,
          title: s.title,
          link: s.link ?? "",
          group_id: s.group_id,
          kind: (s.kind === "channel" ? "channel" : "group") as GroupKind,
          plan_ids: [],
          created_at: new Date().toISOString(),
        })),
      );
    }
  }, []);

  useEffect(() => {
    writeTelegramGroupsChannels(
      items.map((i) => ({
        id: i.id,
        title: i.title,
        group_id: i.group_id,
        kind: i.kind,
        link: i.link,
      })),
    );
  }, [items]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TgGroup | null>(null);
  const [search, setSearch] = useState("");

  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [groupId, setGroupId] = useState("");
  const [kind, setKind] = useState<GroupKind>("group");
  const [planIds, setPlanIds] = useState<string[]>([]);

  function reset() {
    setTitle("");
    setLink("");
    setGroupId("");
    setKind("group");
    setPlanIds([]);
    setEditing(null);
  }

  function openCreate() {
    reset();
    setOpen(true);
  }

  function openEdit(g: TgGroup) {
    setEditing(g);
    setTitle(g.title);
    setLink(g.link);
    setGroupId(g.group_id);
    setKind(g.kind);
    setPlanIds(g.plan_ids ?? []);
    setOpen(true);
  }

  function save() {
    if (!title.trim()) {
      toast.error("Informe o título.");
      return;
    }
    if (!link.trim()) {
      toast.error("Informe o link de convite.");
      return;
    }
    try {
      new URL(link.trim());
    } catch {
      toast.error("Link inválido. Use https://t.me/...");
      return;
    }
    if (!/^-?\d{4,20}$/.test(groupId.trim())) {
      toast.error("ID inválido. Use apenas números (com ou sem '-').");
      return;
    }
    if (
      items.some(
        (i) => i.group_id === groupId.trim() && i.id !== editing?.id,
      )
    ) {
      toast.error("Já existe um item com esse ID.");
      return;
    }

    if (editing) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editing.id
            ? {
                ...i,
                title: title.trim(),
                link: link.trim(),
                group_id: groupId.trim(),
                kind,
                plan_ids: planIds,
              }
            : i,
        ),
      );
      toast.success("Atualizado com sucesso!");
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          title: title.trim(),
          link: link.trim(),
          group_id: groupId.trim(),
          kind,
          plan_ids: planIds,
          created_at: new Date().toISOString(),
        },
      ]);
      toast.success("Adicionado com sucesso!");
    }

    setOpen(false);
    reset();
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Removido.");
  }

  function copy(text: string, label = "Copiado") {
    navigator.clipboard.writeText(text);
    toast.success(`${label}!`);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.link.toLowerCase().includes(q) ||
        i.group_id.toLowerCase().includes(q),
    );
  }, [items, search]);

  const stats = useMemo(
    () => ({
      total: items.length,
      groups: items.filter((i) => i.kind === "group").length,
      channels: items.filter((i) => i.kind === "channel").length,
    }),
    [items],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Grupos e Canais</h1>
        <p className="text-sm text-muted-foreground mt-1">Grupos e Canais</p>
      </div>

      {/* Banner */}
      <Card className="p-6 md:p-8 overflow-hidden relative">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1 max-w-xl space-y-4">
            <h2 className="text-2xl font-bold text-foreground">
              Tenha grupos e canais agora mesmo
            </h2>
            <p className="text-sm text-muted-foreground">
              Adicione canais para expandir sua comunidade e gerenciar grupos de
              forma mais eficiente.
            </p>
            <Button size="lg" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              Criar novo grupo
            </Button>
          </div>
          <div className="hidden md:flex items-center justify-center w-48 h-48 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
            <Send className="w-24 h-24 text-primary" />
          </div>
        </div>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <Hash className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Grupos</p>
            <p className="text-2xl font-bold text-foreground">{stats.groups}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-sky-500/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-sky-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Canais</p>
            <p className="text-2xl font-bold text-foreground">
              {stats.channels}
            </p>
          </div>
        </Card>
      </div>

      {/* Lista */}
      <div>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <h2 className="text-xl font-bold text-foreground">Grupos ativos</h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, link ou ID..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>ID do grupo</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-12"
                  >
                    {items.length === 0
                      ? "Nenhum grupo extra encontrado"
                      : "Nenhum resultado para a busca."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          g.kind === "channel"
                            ? "bg-sky-500/15 text-sky-500 border-sky-500/30"
                            : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                        }
                      >
                        {KIND_LABEL[g.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <a
                        href={g.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[260px]"
                      >
                        <span className="truncate">{g.link}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {g.group_id}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copy(g.link, "Link copiado")}
                          title="Copiar link"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(g)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(g.id)}
                          title="Remover"
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
        </Card>
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Grupo" : "Criar Grupo"}
            </DialogTitle>
            <DialogDescription>
              Cadastre o título, ID, planos vinculados e link de convite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="g-title">Título do Grupo</Label>
              <Input
                id="g-title"
                placeholder="Título do Grupo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="g-id">Id do Grupo</Label>
              <Input
                id="g-id"
                placeholder="Id do Grupo"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use apenas números. IDs de canais costumam começar com{" "}
                <code className="font-mono text-foreground">-100</code>.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Planos Disponíveis</Label>
                <span className="text-xs text-muted-foreground">
                  {planIds.length} plano(s) selecionado(s)
                </span>
              </div>
              <div className="rounded-md border bg-muted/30 min-h-[140px] p-3">
                {AVAILABLE_PLANS.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">
                    Nenhum plano disponível no momento
                  </p>
                ) : (
                  <div className="space-y-2">
                    {AVAILABLE_PLANS.map((p) => {
                      const checked = planIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setPlanIds((prev) =>
                              checked
                                ? prev.filter((x) => x !== p.id)
                                : [...prev, p.id],
                            )
                          }
                          className={`w-full flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition ${
                            checked
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:bg-muted/50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {p.price}
                            </span>
                          </span>
                          {checked && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="g-link">Link do Grupo</Label>
              <Input
                id="g-link"
                placeholder="Link do Grupo"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as GroupKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">Grupo</SelectItem>
                  <SelectItem value="channel">Canal</SelectItem>
                </SelectContent>
              </Select>
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
