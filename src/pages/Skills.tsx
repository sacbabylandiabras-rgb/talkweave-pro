import { useEffect, useState } from "react";
import { Sparkles, Plus, Trash2, Loader2, FolderOpen, FileText, ArrowLeft, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Folder = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
};

type Content = {
  id: string;
  folder_id: string;
  title: string;
  content: string;
  connected_to_agent: boolean;
  created_at: string;
};

const COLOR_OPTIONS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#64748b"];

export default function Skills() {
  const { toast } = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [activeFolder, setActiveFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);

  // folder dialog
  const [folderOpen, setFolderOpen] = useState(false);
  const [fName, setFName] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fColor, setFColor] = useState(COLOR_OPTIONS[0]);

  // content dialog
  const [contentOpen, setContentOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [cTitle, setCTitle] = useState("");
  const [cBody, setCBody] = useState("");
  const [cConnected, setCConnected] = useState(true);

  const [saving, setSaving] = useState(false);

  const loadFolders = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("skill_folders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: "Erro", description: "Não foi possível carregar.", variant: "destructive" });
    }
    setFolders(data || []);
    setLoading(false);
  };

  const loadContents = async (folderId: string) => {
    const { data, error } = await (supabase as any)
      .from("skill_contents")
      .select("*")
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setContents(data || []);
  };

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    if (activeFolder) loadContents(activeFolder.id);
  }, [activeFolder]);

  const openCreateFolder = () => {
    setFName("");
    setFDesc("");
    setFColor(COLOR_OPTIONS[0]);
    setFolderOpen(true);
  };

  const createFolder = async () => {
    if (!fName.trim()) {
      toast({ title: "Atenção", description: "Informe o nome da pasta.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await (supabase as any)
      .from("skill_folders")
      .insert({ user_id: user.id, name: fName.trim(), description: fDesc.trim() || null, color: fColor });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setFolderOpen(false);
    toast({ title: "Pasta criada!" });
    loadFolders();
  };

  const deleteFolder = async (id: string) => {
    if (!window.confirm("Excluir esta pasta e todo seu conteúdo?")) return;
    const { error } = await (supabase as any).from("skill_folders").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pasta excluída" });
    loadFolders();
  };

  const openCreateContent = () => {
    setEditingContent(null);
    setCTitle("");
    setCBody("");
    setCConnected(true);
    setContentOpen(true);
  };

  const openEditContent = (c: Content) => {
    setEditingContent(c);
    setCTitle(c.title);
    setCBody(c.content);
    setCConnected(c.connected_to_agent);
    setContentOpen(true);
  };

  const saveContent = async () => {
    if (!activeFolder) return;
    if (!cTitle.trim()) {
      toast({ title: "Atenção", description: "Informe o título.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    if (editingContent) {
      const { error } = await (supabase as any)
        .from("skill_contents")
        .update({ title: cTitle.trim(), content: cBody, connected_to_agent: cConnected })
        .eq("id", editingContent.id);
      setSaving(false);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Conteúdo atualizado" });
    } else {
      const { error } = await (supabase as any)
        .from("skill_contents")
        .insert({
          user_id: user.id,
          folder_id: activeFolder.id,
          title: cTitle.trim(),
          content: cBody,
          connected_to_agent: cConnected,
        });
      setSaving(false);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Conteúdo criado" });
    }
    setContentOpen(false);
    loadContents(activeFolder.id);
  };

  const toggleConnect = async (c: Content) => {
    const next = !c.connected_to_agent;
    setContents((prev) => prev.map((x) => (x.id === c.id ? { ...x, connected_to_agent: next } : x)));
    const { error } = await (supabase as any)
      .from("skill_contents")
      .update({ connected_to_agent: next })
      .eq("id", c.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      if (activeFolder) loadContents(activeFolder.id);
    }
  };

  const deleteContent = async (id: string) => {
    if (!window.confirm("Excluir este conteúdo?")) return;
    const { error } = await (supabase as any).from("skill_contents").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Excluído" });
    if (activeFolder) loadContents(activeFolder.id);
  };

  // ===== Inside folder view =====
  if (activeFolder) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => setActiveFolder(null)} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: (activeFolder.color || "#8b5cf6") + "22", color: activeFolder.color || "#8b5cf6" }}
            >
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">{activeFolder.name}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {activeFolder.description || "Conteúdos desta pasta são usados pelo Agente IA quando conectados."}
              </p>
            </div>
          </div>
          <Button onClick={openCreateContent} className="gap-2">
            <Plus className="w-4 h-4" /> Novo conteúdo
          </Button>
        </div>

        {contents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum conteúdo nesta pasta ainda.</p>
            <Button variant="link" onClick={openCreateContent} className="mt-2">
              Adicionar conteúdo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contents.map((c) => (
              <Card key={c.id} className="p-4 space-y-3 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{c.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {c.content || <span className="italic">Sem conteúdo</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteContent(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Bot className="w-3.5 h-3.5" />
                    Conectar ao Agente IA
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={c.connected_to_agent} onCheckedChange={() => toggleConnect(c)} />
                    <Button variant="ghost" size="sm" onClick={() => openEditContent(c)}>
                      Editar
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={contentOpen} onOpenChange={setContentOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingContent ? "Editar conteúdo" : "Novo conteúdo"}</DialogTitle>
              <DialogDescription className="text-xs">
                Adicione informação que o Agente IA vai usar para responder.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input
                  placeholder="Ex: Política de troca"
                  value={cTitle}
                  onChange={(e) => setCTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Conteúdo</Label>
                <Textarea
                  placeholder="Escreva aqui a informação, instruções, FAQ, etc."
                  value={cBody}
                  onChange={(e) => setCBody(e.target.value)}
                  rows={8}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <div>
                    <div className="text-xs font-medium">Conectar ao Agente IA</div>
                    <div className="text-[11px] text-muted-foreground">
                      Quando ativo, o agente vai considerar este conteúdo.
                    </div>
                  </div>
                </div>
                <Switch checked={cConnected} onCheckedChange={setCConnected} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setContentOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={saveContent} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editingContent ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ===== Folders list =====
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Skills</h1>
            <p className="text-xs text-muted-foreground">
              Crie pastas com conteúdos para alimentar e conectar ao seu Agente IA.
            </p>
          </div>
        </div>
        <Button onClick={openCreateFolder} className="gap-2">
          <Plus className="w-4 h-4" /> Criar Pasta
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : folders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma pasta criada ainda.</p>
          <Button variant="link" onClick={openCreateFolder} className="mt-2">
            Criar a primeira
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {folders.map((f) => (
            <Card
              key={f.id}
              className="p-4 flex items-start justify-between gap-3 group cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setActiveFolder(f)}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: (f.color || "#8b5cf6") + "22", color: f.color || "#8b5cf6" }}
                >
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{f.name}</div>
                  {f.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">{f.description}</div>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFolder(f.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Pasta</DialogTitle>
            <DialogDescription className="text-xs">
              Pastas agrupam conteúdos que o Agente IA pode usar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex: FAQ, Produtos, Políticas"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                placeholder="Para que serve esta pasta?"
                value={fDesc}
                onChange={(e) => setFDesc(e.target.value)}
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
                    onClick={() => setFColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${fColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={createFolder} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}