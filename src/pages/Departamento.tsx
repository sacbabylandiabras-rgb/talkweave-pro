import { useEffect, useState } from "react";
import { Building2, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Department = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
};

const COLOR_OPTIONS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

export default function Departamento() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("departments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: "Erro", description: "Não foi possível carregar.", variant: "destructive" });
    }
    setDepartments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setName("");
    setDescription("");
    setColor(COLOR_OPTIONS[0]);
    setIsCreating(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Atenção", description: "Informe o nome do departamento.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Erro", description: "Sessão inválida.", variant: "destructive" });
      setSaving(false);
      return;
    }
    const { error } = await (supabase as any)
      .from("departments")
      .insert({ user_id: user.id, name: name.trim(), description: description.trim() || null, color });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setIsCreating(false);
    toast({ title: "Departamento criado!" });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir este departamento?")) return;
    const { error } = await (supabase as any).from("departments").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Departamento excluído" });
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Departamentos</h1>
            <p className="text-xs text-muted-foreground">Organize sua equipe por setores ou áreas de atendimento.</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Criar Departamento
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : departments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Building2 className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum departamento criado ainda.</p>
          <Button variant="link" onClick={openCreate} className="mt-2">Criar o primeiro</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {departments.map((d) => (
            <Card key={d.id} className="p-4 flex items-start justify-between gap-3 group">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: (d.color || "#3b82f6") + "22", color: d.color || "#3b82f6" }}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{d.name}</div>
                  {d.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">{d.description}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Departamento</DialogTitle>
            <DialogDescription className="text-xs">
              Defina nome, descrição e uma cor para identificá-lo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input placeholder="Ex: Suporte, Vendas, Financeiro" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                placeholder="Para que serve este departamento?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreating(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}