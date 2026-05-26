import { useEffect, useState } from "react";
import { Sparkles, Plus, Trash2, Loader2, FolderOpen, FileText, ArrowLeft, Bot, Search, Settings } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [editingDetail, setEditingDetail] = useState<Content | null>(null);

  // folder dialog
  const [folderOpen, setFolderOpen] = useState(false);
  const [fName, setFName] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fColor, setFColor] = useState(COLOR_OPTIONS[0]);

  // new content dialog (just title)
  const [contentOpen, setContentOpen] = useState(false);
  const [cTitle, setCTitle] = useState("");

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
    if (folders.length && !activeFolder) {
      setActiveFolder(folders[0]);
    }
  }, [folders]);

  useEffect(() => {
    if (activeFolder) loadContents(activeFolder.id);
    else setContents([]);
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
    setCTitle("");
    setContentOpen(true);
  };

  const createContent = async () => {
    if (!activeFolder) return;
    if (!cTitle.trim()) {
      toast({ title: "Atenção", description: "Informe a pergunta ou tópico.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await (supabase as any)
      .from("skill_contents")
      .insert({
        user_id: user.id,
        folder_id: activeFolder.id,
        title: cTitle.trim(),
        content: "",
        connected_to_agent: true,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setContentOpen(false);
    setEditingDetail(data as Content);
    loadContents(activeFolder.id);
  };

  const saveDetail = async () => {
    if (!editingDetail) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("skill_contents")
      .update({
        title: editingDetail.title,
        content: editingDetail.content,
        connected_to_agent: editingDetail.connected_to_agent,
      })
      .eq("id", editingDetail.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Salvo" });
    if (activeFolder) loadContents(activeFolder.id);
    setEditingDetail(null);
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

  // ===== Detail editor view =====
  if (editingDetail) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => setEditingDetail(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
              <Bot className="w-3.5 h-3.5" />
              Conectar ao Agente IA
              <Switch
                checked={editingDetail.connected_to_agent}
                onCheckedChange={(v) => setEditingDetail({ ...editingDetail, connected_to_agent: v })}
              />
            </div>
            <Button onClick={saveDetail} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
        <Card className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Pergunta ou tópico</Label>
            <Input
              value={editingDetail.title}
              onChange={(e) => setEditingDetail({ ...editingDetail, title: e.target.value })}
              className="text-base font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conteúdo completo</Label>
            <Textarea
              value={editingDetail.content}
              onChange={(e) => setEditingDetail({ ...editingDetail, content: e.target.value })}
              rows={18}
              placeholder="Escreva aqui a resposta, instruções ou conhecimento que o Agente IA deve usar..."
            />
          </div>
        </Card>
      </div>
    );
  }

  const filteredContents = contents.filter((c) =>
    !search.trim() ? true : c.title.toLowerCase().includes(search.toLowerCase()),
  );

  // ===== Main view =====
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Skills</h1>
            <p className="text-xs text-muted-foreground">
              Ensine habilidades aos seus agentes de IA com conhecimento estruturado.
            </p>
          </div>
        </div>
        <Button onClick={openCreateContent} disabled={!activeFolder} className="gap-2">
          <Plus className="w-4 h-4" /> Novo conteúdo
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar conteúdo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Folder chips */}
      <div className="flex items-center gap-2 flex-wrap border-b border-border pb-2">
        {folders.map((f) => {
          const isActive = activeFolder?.id === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFolder(f)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted border border-transparent"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" style={{ color: f.color || undefined }} />
              {f.name}
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFolder(f.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive ml-1"
              >
                <Trash2 className="w-3 h-3" />
              </span>
            </button>
          );
        })}
        <button
          onClick={openCreateFolder}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nova Skill
        </button>
      </div>

      {/* Content list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !activeFolder ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Crie sua primeira Skill para começar.</p>
          <Button variant="link" onClick={openCreateFolder} className="mt-2">
            Nova Skill
          </Button>
        </div>
      ) : filteredContents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm">Nenhum conteúdo nesta Skill ainda.</p>
          <Button variant="link" onClick={openCreateContent} className="mt-1">
            Adicionar conteúdo
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredContents.map((c) => (
            <Card
              key={c.id}
              className="p-3 flex items-center justify-between gap-3 hover:border-primary/40 transition-colors cursor-pointer group"
              onClick={() => setEditingDetail(c)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  {c.content && (
                    <div className="text-xs text-muted-foreground line-clamp-1">{c.content}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Bot className="w-3 h-3" />
                  <Switch checked={c.connected_to_agent} onCheckedChange={() => toggleConnect(c)} />
                </div>
                <button
                  onClick={() => deleteContent(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New content dialog */}
      <Dialog open={contentOpen} onOpenChange={setContentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Novo conteúdo da Skill
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Pergunta ou tópico</Label>
            <Input
              placeholder="Ex: Como funciona o plano premium?"
              value={cTitle}
              onChange={(e) => setCTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) createContent();
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Depois de criar, você será levado à página para escrever o conteúdo completo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContentOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={createContent} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Skill</DialogTitle>
            <DialogDescription className="text-xs">
              Skills agrupam conteúdos que o Agente IA pode usar.
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