import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Plus,
  Trash2,
  Bot,
  Search,
  Copy,
  Users,
  ShieldCheck,
  ShieldOff,
  Download,
  Info,
  Crown,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

interface Admin {
  id: string;
  user_id: string;
  name?: string;
  role: "owner" | "admin" | "moderator";
  active: boolean;
  added_at: string;
}

const ROLE_LABEL: Record<Admin["role"], string> = {
  owner: "Proprietário",
  admin: "Administrador",
  moderator: "Moderador",
};

const ROLE_COLOR: Record<Admin["role"], string> = {
  owner: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  admin: "bg-primary/15 text-primary border-primary/30",
  moderator: "bg-sky-500/15 text-sky-500 border-sky-500/30",
};

export default function TelegramAdministradores() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [search, setSearch] = useState("");

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Admin["role"]>("admin");
  const [active, setActive] = useState(true);

  const [showHelp, setShowHelp] = useState(false);

  function resetForm() {
    setUserId("");
    setName("");
    setRole("admin");
    setActive(true);
    setEditing(null);
  }

  function openAdd() {
    resetForm();
    setOpen(true);
  }

  function openEdit(a: Admin) {
    setEditing(a);
    setUserId(a.user_id);
    setName(a.name ?? "");
    setRole(a.role);
    setActive(a.active);
    setOpen(true);
  }

  function save() {
    const cleaned = userId.trim();
    if (!cleaned) {
      toast.error("Informe o ID do usuário.");
      return;
    }
    if (!/^-?\d{4,15}$/.test(cleaned)) {
      toast.error("ID inválido. Use apenas números (4 a 15 dígitos).");
      return;
    }
    if (
      admins.some((a) => a.user_id === cleaned && a.id !== editing?.id)
    ) {
      toast.error("Este usuário já está na lista.");
      return;
    }

    if (editing) {
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === editing.id
            ? { ...a, user_id: cleaned, name: name.trim() || undefined, role, active }
            : a,
        ),
      );
      toast.success("Administrador atualizado!");
    } else {
      setAdmins((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          user_id: cleaned,
          name: name.trim() || undefined,
          role,
          active,
          added_at: new Date().toISOString(),
        },
      ]);
      toast.success("Administrador adicionado!");
    }
    setOpen(false);
    resetForm();
  }

  function remove(id: string) {
    setAdmins((prev) => prev.filter((a) => a.id !== id));
    toast.success("Administrador removido.");
  }

  function toggleActive(id: string) {
    setAdmins((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
    );
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id);
    toast.success("ID copiado!");
  }

  function exportCsv() {
    if (admins.length === 0) {
      toast.error("Nenhum administrador para exportar.");
      return;
    }
    const rows = [
      ["ID", "Nome", "Função", "Status", "Adicionado em"],
      ...admins.map((a) => [
        a.user_id,
        a.name ?? "",
        ROLE_LABEL[a.role],
        a.active ? "Ativo" : "Inativo",
        new Date(a.added_at).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `administradores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(
      (a) =>
        a.user_id.toLowerCase().includes(q) ||
        (a.name ?? "").toLowerCase().includes(q) ||
        ROLE_LABEL[a.role].toLowerCase().includes(q),
    );
  }, [admins, search]);

  const stats = useMemo(
    () => ({
      total: admins.length,
      active: admins.filter((a) => a.active).length,
      owners: admins.filter((a) => a.role === "owner").length,
    }),
    [admins],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administradores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie quem pode operar e moderar o seu bot.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHelp(true)}>
          <Info className="w-4 h-4 mr-1.5" />
          Como obter o ID
        </Button>
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
            <div className="flex items-center gap-2 mt-2">
              <Button size="lg" onClick={openAdd}>
                <Plus className="w-4 h-4 mr-1.5" />
                Adicionar administrador
              </Button>
              <Button size="lg" variant="outline" onClick={exportCsv}>
                <Download className="w-4 h-4 mr-1.5" />
                Exportar CSV
              </Button>
            </div>
          </div>
          <div className="hidden md:flex items-center justify-center w-48 h-48 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
            <Bot className="w-24 h-24 text-primary" />
          </div>
        </div>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total de admins</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Crown className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Proprietários</p>
            <p className="text-2xl font-bold text-foreground">{stats.owners}</p>
          </div>
        </Card>
      </div>

      {/* Lista */}
      <div>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <h2 className="text-xl font-bold text-foreground">
            Administradores ativos
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, nome ou função..."
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
                <TableHead>ID do usuário</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Adicionado em</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-12"
                  >
                    {admins.length === 0 ? (
                      <button
                        onClick={openAdd}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-dashed border-muted-foreground/40 hover:border-primary hover:text-primary transition"
                        aria-label="Adicionar administrador"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    ) : (
                      "Nenhum resultado para a busca."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.user_id}</TableCell>
                    <TableCell>
                      {a.name || (
                        <span className="text-muted-foreground italic">
                          Sem nome
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ROLE_COLOR[a.role]}
                      >
                        {ROLE_LABEL[a.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleActive(a.id)}
                        className="inline-flex items-center gap-1.5 text-xs"
                      >
                        {a.active ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-emerald-500">Ativo</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                            <span className="text-muted-foreground">
                              Inativo
                            </span>
                          </>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.added_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyId(a.user_id)}
                          title="Copiar ID"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleActive(a.id)}
                          title={a.active ? "Desativar" : "Ativar"}
                        >
                          {a.active ? (
                            <ShieldOff className="w-4 h-4" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(a)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(a.id)}
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

      {/* Modal Add/Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar administrador" : "Adicionar administrador"}
            </DialogTitle>
            <DialogDescription>
              Defina ID, nome e nível de permissão do administrador.
            </DialogDescription>
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
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                Use apenas números. Após adicionar, envie{" "}
                <code className="font-mono text-foreground">/comandos</code> no
                bot.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-name">Nome (opcional)</Label>
              <Input
                id="admin-name"
                placeholder="Ex: João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
            </div>

            <div className="space-y-2">
              <Label>Função</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["owner", "admin", "moderator"] as Admin["role"][]).map(
                  (r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`px-3 py-2 rounded-md border text-sm transition ${
                        role === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">
                  Administradores inativos não recebem comandos.
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

      {/* Modal Ajuda */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Como obter o ID de um usuário?</DialogTitle>
            <DialogDescription>
              Siga os passos abaixo para descobrir o ID do Telegram.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
            <li>
              Peça para o usuário enviar uma mensagem ao bot{" "}
              <code className="font-mono">@userinfobot</code>.
            </li>
            <li>
              O bot retornará o número de ID — copie esse número exatamente
              como exibido.
            </li>
            <li>
              Cole o ID no campo "ID do usuário no Telegram" e salve.
            </li>
            <li>
              No seu bot, execute o comando{" "}
              <code className="font-mono">/comandos</code> para sincronizar as
              permissões.
            </li>
          </ol>
          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
