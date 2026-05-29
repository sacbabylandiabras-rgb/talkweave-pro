import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Save, Pencil, Search, Layout, FileText, Settings, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Template { id: string; name: string; subject: string; html: string; updated_at: string; category?: string; }

export default function EmailTemplates() {
  const [list, setList] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("all");

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

  const openNew = () => setEditing({ id: "", name: "", subject: "", html: "", updated_at: "", category: "Marketing" });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Informe o nome do template"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      
      const payload = { 
        name: editing.name, 
        subject: editing.subject, 
        html: editing.html,
        category: editing.category || "Marketing"
      };

      if (editing.id) {
        const { error } = await (supabase as any)
          .from("user_email_templates")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("user_email_templates")
          .insert({ user_id: user.id, ...payload });
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `email-templates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('template-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('template-media')
        .getPublicUrl(filePath);

      const textarea = document.querySelector('textarea');
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = editing?.html || "";
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newValue = before + `<img src="${publicUrl}" alt="imagem" style="max-width: 100%; border-radius: 8px;" />` + after;
        if (editing) setEditing({ ...editing, html: newValue });
      }
      toast.success("Imagem enviada com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro no upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredList = list.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                         t.subject.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === "all" || (t.category && t.category.toLowerCase() === tab.toLowerCase());
    return matchesSearch && matchesTab;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gerenciador de Templates</h1>
          <p className="text-sm text-slate-500">Crie, edite e organize seus modelos de e-mail profissionais.</p>
        </div>
        <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Criar Novo Modelo</span>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <Tabs value={tab} onValueChange={setTab} className="w-full md:w-auto">
          <TabsList className="bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg px-4 py-2 text-sm font-medium transition-all border-0 shadow-none">
              Todos
            </TabsTrigger>
            <TabsTrigger value="marketing" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg px-4 py-2 text-sm font-medium transition-all border-0 shadow-none">
              Marketing
            </TabsTrigger>
            <TabsTrigger value="transacional" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 rounded-lg px-4 py-2 text-sm font-medium transition-all border-0 shadow-none">
              Transacional
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar por nome ou assunto..." 
            className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-all rounded-lg"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500 font-medium">Carregando seus modelos...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
            <Layout className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">Nenhum template encontrado</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              {search ? "Não encontramos nenhum resultado para sua busca." : "Comece criando seu primeiro modelo de e-mail agora mesmo."}
            </p>
          </div>
          {!search && <Button variant="outline" onClick={openNew}>Criar primeiro modelo</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredList.map(t => (
            <Card key={t.id} className="group overflow-hidden border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all duration-300 rounded-2xl flex flex-col">
              <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden flex items-center justify-center group-hover:bg-slate-50 transition-colors">
                <FileText className="w-12 h-12 text-slate-300" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm text-slate-600 border-slate-200">
                    {t.category || "Marketing"}
                  </Badge>
                </div>
                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors pointer-events-none" />
              </div>
              
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{t.name}</h3>
                  <p className="text-sm text-slate-500 truncate mt-1">{t.subject || "(Sem assunto)"}</p>
                </div>
                
                <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                    Atualizado em {new Date(t.updated_at).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setEditing(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => remove(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden border-0">
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Layout className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">{editing?.id ? "Editar Template" : "Criar Novo Template"}</DialogTitle>
                <p className="text-xs text-slate-500">Configure as informações e o conteúdo do seu e-mail.</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditing(null)} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/50">
            {/* Sidebar de Configurações */}
            <div className="w-full md:w-80 border-r border-slate-200 bg-white p-6 space-y-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Identificação</Label>
                  <Input 
                    value={editing?.name} 
                    onChange={e => setEditing(editing ? { ...editing, name: e.target.value } : null)} 
                    placeholder="Ex: Campanha de Black Friday" 
                    className="border-slate-200 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Categoria</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      type="button"
                      variant={editing?.category === "Marketing" ? "default" : "outline"} 
                      size="sm"
                      className={`h-9 ${editing?.category === "Marketing" ? "bg-indigo-600 hover:bg-indigo-700" : "border-slate-200 hover:bg-slate-50"}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (editing) setEditing({ ...editing, category: "Marketing" });
                      }}
                    >
                      Marketing
                    </Button>
                    <Button 
                      type="button"
                      variant={editing?.category === "Transacional" ? "default" : "outline"} 
                      size="sm"
                      className={`h-9 ${editing?.category === "Transacional" ? "bg-indigo-600 hover:bg-indigo-700" : "border-slate-200 hover:bg-slate-50"}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (editing) setEditing({ ...editing, category: "Transacional" });
                      }}
                    >
                      Transacional
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Assunto do E-mail</Label>
                  <Input 
                    value={editing?.subject} 
                    onChange={e => setEditing(editing ? { ...editing, subject: e.target.value } : null)} 
                    placeholder="O que o cliente verá na caixa de entrada" 
                    className="border-slate-200"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <Settings className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Variáveis</span>
                  </div>
                  <p className="text-[11px] text-indigo-600 leading-relaxed">
                    Use <code className="bg-white px-1 rounded border border-indigo-200">{"{{nome}}"}</code> para personalizar o e-mail com o nome do destinatário.
                  </p>
                </div>
              </div>
            </div>

            {/* Editor de Conteúdo */}
            <div className="flex-1 p-4 md:p-8 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-[500px]">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                  <div className="flex items-center gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => {
                        const textarea = document.querySelector('textarea');
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const text = editing?.html || "";
                          const before = text.substring(0, start);
                          const after = text.substring(end);
                          const newValue = before + "{{variável}}" + after;
                          if (editing) setEditing({ ...editing, html: newValue });
                        }
                      }}
                      title="Adicionar variável"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      title="Inserir imagem (Upload)"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    </Button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                    />
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 font-bold hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => {
                        const textarea = document.querySelector('textarea');
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selected = (editing?.html || "").substring(start, end);
                          if (!selected) return;
                          const before = (editing?.html || "").substring(0, start);
                          const after = (editing?.html || "").substring(end);
                          const newValue = before + `<b>${selected}</b>` + after;
                          if (editing) setEditing({ ...editing, html: newValue });
                        }
                      }}
                      title="Negrito"
                    >
                      B
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-500 italic font-serif hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => {
                        const textarea = document.querySelector('textarea');
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selected = (editing?.html || "").substring(start, end);
                          if (!selected) return;
                          const before = (editing?.html || "").substring(0, start);
                          const after = (editing?.html || "").substring(end);
                          const newValue = before + `<i>${selected}</i>` + after;
                          if (editing) setEditing({ ...editing, html: newValue });
                        }
                      }}
                      title="Itálico"
                    >
                      I
                    </Button>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-slate-400 bg-white">Modo HTML / Texto Rico</Badge>
                </div>
                <textarea 
                  className="flex-1 p-6 text-sm focus:outline-none resize-none font-sans"
                  value={editing?.html}
                  onChange={e => setEditing(editing ? { ...editing, html: e.target.value } : null)}
                  placeholder="Escreva sua mensagem aqui..."
                />
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditing(null)} className="text-slate-500">Descartar Alterações</Button>
            <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 px-8 shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
