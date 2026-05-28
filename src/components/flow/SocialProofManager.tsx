import { useEffect, useState } from "react";
import { supabase as sb } from "@/integrations/supabase/client";
const supabase: any = sb;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload, Star, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SocialProofItem {
  id: string;
  title: string;
  description: string | null;
  caption: string | null;
  media_url: string;
  media_type: string;
  category: string | null;
  tags: string[];
  active: boolean;
}

const BUCKET = "agent-social-proof";

function detectMediaType(file: File): string {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

export function SocialProofManager() {
  const [items, setItems] = useState<SocialProofItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    caption: "",
    category: "depoimento",
    tags: "",
    media_url: "",
    media_type: "image",
  });
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_social_proof")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setItems((data as any) || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({ title: "", description: "", caption: "", category: "depoimento", tags: "", media_url: "", media_type: "image" });
    setFile(null);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "Informe um título", variant: "destructive" });
      return;
    }
    if (!file && !form.media_url) {
      toast({ title: "Envie um arquivo ou cole uma URL", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      let mediaUrl = form.media_url;
      let mediaType = form.media_type;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        mediaUrl = pub.publicUrl;
        mediaType = detectMediaType(file);
      }
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { error } = await supabase.from("agent_social_proof").insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        caption: form.caption.trim() || null,
        category: form.category || null,
        tags,
        media_url: mediaUrl,
        media_type: mediaType,
      });
      if (error) throw error;
      toast({ title: "Prova social adicionada" });
      resetForm();
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(item: SocialProofItem) {
    const { error } = await supabase
      .from("agent_social_proof")
      .update({ active: !item.active })
      .eq("id", item.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta prova social?")) return;
    const { error } = await supabase.from("agent_social_proof").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Star className="h-4 w-4 text-amber-500" />
          Base de Provas Sociais
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Faça upload de depoimentos, prints e vídeos. O agente buscará automaticamente
        na base e enviará ao lead quando a ferramenta for chamada.
      </p>

      <div className="border border-border rounded-lg divide-y divide-border max-h-[280px] overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-xs text-muted-foreground">Carregando...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Nenhuma prova social cadastrada ainda.
          </div>
        )}
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 p-2">
            <div className="w-12 h-12 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
              {it.media_type === "image" ? (
                <img src={it.media_url} alt={it.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] uppercase text-muted-foreground">{it.media_type}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{it.title}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {it.category || "—"} {it.tags?.length ? `· ${it.tags.join(", ")}` : ""}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => toggleActive(it)}>
              {it.active ? "Ativo" : "Inativo"}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(it.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova prova social</DialogTitle>
            <DialogDescription>
              Faça upload da mídia ou cole uma URL pública. O agente usará isso para enviar ao lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Depoimento Maria - Resultado em 30 dias" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="depoimento">Depoimento</SelectItem>
                    <SelectItem value="print">Print/Resultado</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="previa">Prévia/Demonstração</SelectItem>
                    <SelectItem value="antes_depois">Antes e Depois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tags (vírgula)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="emagrecimento, antes-depois" />
              </div>
            </div>
            <div>
              <Label>Descrição (interna)</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Quando usar esta prova social..." />
            </div>
            <div>
              <Label>Legenda enviada ao lead</Label>
              <Textarea rows={2} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Olha o resultado da Maria! 😍" />
            </div>
            <div>
              <Label>Arquivo (imagem, vídeo, áudio ou documento)</Label>
              <Input type="file" accept="image/*,video/*,audio/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file && <div className="text-[11px] text-muted-foreground mt-1">{file.name}</div>}
            </div>
            <div>
              <Label>Ou cole uma URL pública</Label>
              <Input value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}