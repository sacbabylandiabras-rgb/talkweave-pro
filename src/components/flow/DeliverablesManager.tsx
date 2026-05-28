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
import { Plus, Trash2, Upload, PackageCheck, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface DeliverableItem {
  id: string;
  title: string;
  description: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: string;
  content_text: string | null;
  product_id: string | null;
  order_index: number;
  active: boolean;
}

const BUCKET = "agent-deliverables";

function detectMediaType(file: File): string {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

export function DeliverablesManager() {
  const [items, setItems] = useState<DeliverableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    caption: "",
    media_type: "text",
    media_url: "",
    content_text: "",
    product_id: "",
    order_index: 0,
  });
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_deliverables")
      .select("*")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setItems((data as any) || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({ title: "", description: "", caption: "", media_type: "text", media_url: "", content_text: "", product_id: "", order_index: items.length });
    setFile(null);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "Informe um título", variant: "destructive" });
      return;
    }
    if (form.media_type === "text") {
      if (!form.content_text.trim()) {
        toast({ title: "Informe o texto do entregável", variant: "destructive" });
        return;
      }
    } else if (!file && !form.media_url) {
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
      const { error } = await supabase.from("agent_deliverables").insert({
        user_id: user.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        caption: form.caption.trim() || null,
        media_url: mediaUrl || null,
        media_type: mediaType,
        content_text: form.content_text.trim() || null,
        product_id: form.product_id.trim() || null,
        order_index: Number(form.order_index) || 0,
      });
      if (error) throw error;
      toast({ title: "Entregável adicionado" });
      resetForm();
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(item: DeliverableItem) {
    const { error } = await supabase
      .from("agent_deliverables")
      .update({ active: !item.active })
      .eq("id", item.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir este entregável?")) return;
    const { error } = await supabase.from("agent_deliverables").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <PackageCheck className="h-4 w-4 text-primary" />
          Base de Entregáveis
        </div>
        <Button size="sm" onClick={() => { resetForm(); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Cadastre vídeos, fotos, documentos, áudios e textos que serão enviados ao lead
        assim que o pagamento for confirmado. A ordem define a sequência de envio.
      </p>

      <div className="border border-border rounded-lg divide-y divide-border max-h-[280px] overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-xs text-muted-foreground">Carregando...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Nenhum entregável cadastrado ainda.
          </div>
        )}
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 p-2">
            <div className="w-12 h-12 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
              {it.media_type === "image" && it.media_url ? (
                <img src={it.media_url} alt={it.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] uppercase text-muted-foreground">{it.media_type}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                #{it.order_index} · {it.title}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {it.media_type}{it.product_id ? ` · produto: ${it.product_id}` : ""}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo entregável</DialogTitle>
            <DialogDescription>
              Cadastre o conteúdo que será enviado ao lead após o pagamento confirmado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Vídeo de boas-vindas" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={form.media_type} onValueChange={(v) => setForm({ ...form, media_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ordem de envio</Label>
                <Input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>ID do produto (opcional)</Label>
              <Input value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} placeholder="Vincula este entregável a um produto específico" />
            </div>
            <div>
              <Label>Descrição (interna)</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Observações internas" />
            </div>
            {form.media_type === "text" ? (
              <div>
                <Label>Texto enviado ao lead *</Label>
                <Textarea rows={4} value={form.content_text} onChange={(e) => setForm({ ...form, content_text: e.target.value })} placeholder="Escreva o conteúdo que será enviado..." />
              </div>
            ) : (
              <>
                <div>
                  <Label>Arquivo (imagem, vídeo, áudio ou documento)</Label>
                  <Input type="file" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  {file && <div className="text-[11px] text-muted-foreground mt-1">{file.name}</div>}
                </div>
                <div>
                  <Label>Ou cole uma URL pública</Label>
                  <Input value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <Label>Legenda enviada ao lead</Label>
                  <Textarea rows={2} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Ex: Aqui está o seu acesso 🎉" />
                </div>
              </>
            )}
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