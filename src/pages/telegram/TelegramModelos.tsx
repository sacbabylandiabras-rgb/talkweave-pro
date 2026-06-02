import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { FileText, Plus, Pencil, Trash2, Link as LinkIcon, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type TgButton = { type: "url" | "reply"; text: string; url?: string; payload?: string };
type TgTemplate = {
  id: string;
  name: string;
  content: string;
  buttons: TgButton[];
  active: boolean;
};

const emptyForm = (): {
  id: string | null;
  name: string;
  content: string;
  buttons: TgButton[];
  active: boolean;
} => ({ id: null, name: "", content: "", buttons: [], active: true });

export default function TelegramModelos() {
  const [list, setList] = useState<TgTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("telegram_message_templates" as any)
      .select("id, name, content, buttons, active")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar modelos.");
      return;
    }
    setList(
      ((data as any[]) || []).map((r) => ({
        id: r.id,
        name: r.name,
        content: r.content || "",
        buttons: Array.isArray(r.buttons)
          ? r.buttons.map((b: any) => ({
              type: b?.type === "reply" ? "reply" : "url",
              text: String(b?.text || ""),
              url: b?.url ? String(b.url) : undefined,
              payload: b?.payload ? String(b.payload) : undefined,
            }))
          : [],
        active: !!r.active,
      })),
    );
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(t: TgTemplate) {
    setForm({
      id: t.id,
      name: t.name,
      content: t.content,
      buttons: [...t.buttons],
      active: t.active,
    });
    setDialogOpen(true);
  }

  function addButton() {
    if (form.buttons.length >= 10) {
      toast.error("Máximo de 10 botões.");
      return;
    }
    setForm({ ...form, buttons: [...form.buttons, { type: "url", text: "", url: "" }] });
  }
  function updateButton(idx: number, field: keyof TgButton, val: string) {
    const next = [...form.buttons];
    next[idx] = { ...next[idx], [field]: val } as TgButton;
    setForm({ ...form, buttons: next });
  }
  function setButtonType(idx: number, type: "url" | "reply") {
    const next = [...form.buttons];
    const cur = next[idx];
    next[idx] = type === "url"
      ? { type: "url", text: cur.text, url: cur.url ?? "" }
      : { type: "reply", text: cur.text, payload: cur.payload ?? "" };
    setForm({ ...form, buttons: next });
  }
  function removeButton(idx: number) {
    setForm({ ...form, buttons: form.buttons.filter((_, i) => i !== idx) });
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Informe o nome do modelo."); return; }
    if (!form.content.trim()) { toast.error("Informe o conteúdo do modelo."); return; }
    for (const b of form.buttons) {
      if (!b.text.trim()) {
        toast.error("Botões precisam ter texto.");
        return;
      }
      if (b.type === "url") {
        if (!b.url || !b.url.trim()) { toast.error("Botões de URL precisam ter um link."); return; }
        try { new URL(b.url); } catch { toast.error(`Link inválido: ${b.url}`); return; }
      }
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); toast.error("Sessão expirada."); return; }

    const payload: any = {
      user_id: user.id,
      name: form.name.trim(),
      content: form.content,
      buttons: form.buttons,
      active: form.active,
    };

    let error;
    if (form.id) {
      ({ error } = await supabase
        .from("telegram_message_templates" as any)
        .update(payload)
        .eq("id", form.id));
    } else {
      ({ error } = await supabase
        .from("telegram_message_templates" as any)
        .insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
    toast.success("Modelo salvo!");
    setDialogOpen(false);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("telegram_message_templates" as any)
      .delete()
      .eq("id", id);
    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return; }
    toast.success("Modelo excluído.");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Modelos do Telegram</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie modelos de mensagens reutilizáveis para boas-vindas, fluxos e disparos no Telegram.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Novo modelo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tg-tpl-name">Nome</Label>
                <Input
                  id="tg-tpl-name"
                  placeholder="Ex: Boas-vindas VIP"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tg-tpl-content">Conteúdo</Label>
                <Textarea
                  id="tg-tpl-content"
                  placeholder="Ex: Olá {nome}, seja bem-vindo!"
                  rows={6}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{nome}"} para o primeiro nome do contato. HTML básico suportado (&lt;b&gt;, &lt;i&gt;, &lt;a&gt;).
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Botões (opcional)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addButton}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
                {form.buttons.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sem botões. Adicione para enviar links clicáveis abaixo da mensagem.
                  </p>
                )}
                {form.buttons.map((b, i) => (
                  <div key={i} className="space-y-2 rounded-md border p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setButtonType(i, "url")}
                          className={`px-2 py-1 rounded ${b.type === "url" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                        >
                          <LinkIcon className="w-3 h-3 inline mr-1" /> URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setButtonType(i, "reply")}
                          className={`px-2 py-1 rounded ${b.type === "reply" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                        >
                          <MessageSquare className="w-3 h-3 inline mr-1" /> Resposta
                        </button>
                      </div>
                      <div className="flex-1" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeButton(i)}
                        title="Remover botão"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Texto do botão"
                        value={b.text}
                        onChange={(e) => updateButton(i, "text", e.target.value)}
                      />
                      {b.type === "url" ? (
                        <div className="relative">
                          <LinkIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-8"
                            placeholder="https://..."
                            value={b.url || ""}
                            onChange={(e) => updateButton(i, "url", e.target.value)}
                          />
                        </div>
                      ) : (
                        <Input
                          placeholder="Identificador (opcional)"
                          value={b.payload || ""}
                          onChange={(e) => updateButton(i, "payload", e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="tg-tpl-active" className="cursor-pointer">Ativo</Label>
                <Switch
                  id="tg-tpl-active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Carregando modelos...
        </Card>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-foreground">Nenhum modelo cadastrado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Crie seu primeiro modelo para reutilizar nas boas-vindas e fluxos.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">{t.name}</h3>
                    {!t.active && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">
                    {t.content}
                  </p>
                  {t.buttons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.buttons.map((b, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-md border bg-muted/40 text-foreground"
                        >
                          {b.text || "(sem texto)"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Excluir">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. O modelo "{t.name}" será removido.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(t.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
