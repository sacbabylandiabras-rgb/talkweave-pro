import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Save, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Template { id: string; name: string; subject: string; html: string; updated_at: string; }

export default function EmailTemplates() {
  const [list, setList] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("user_email_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    setList((data as Template[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => setEditing({ id: "", name: "", subject: "", html: "", updated_at: "" });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Informe o nome do template"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (editing.id) {
        const { error } = await (supabase as any)
          .from("user_email_templates")
          .update({ name: editing.name, subject: editing.subject, html: editing.html })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("user_email_templates")
          .insert({ user_id: user.id, name: editing.name, subject: editing.subject, html: editing.html });
        if (error) throw error;
      }
      toast.success("Template salvo");
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    await (supabase as any).from("user_email_templates").delete().eq("id", id);
    toast.success("Template excluído");
    load();
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates de Email</h1>
          <p className="text-sm text-muted-foreground">Crie e gerencie modelos reutilizáveis para seus disparos.</p>
        </div>
        <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />Novo Template
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Seus templates</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Nenhum template criado ainda.</p>
          ) : (
            <div className="space-y-2">
              {list.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.subject || "(sem assunto)"}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar template" : "Novo template"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: Boas-vindas" />
              </div>
              <div>
                <Label>Assunto</Label>
                <Input value={editing.subject} onChange={e => setEditing({ ...editing, subject: e.target.value })} placeholder="Assunto padrão" />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea value={editing.html} onChange={e => setEditing({ ...editing, html: e.target.value })} rows={14} className="text-sm" placeholder="Digite sua mensagem aqui..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}