import { useEffect, useRef, useState } from "react";
import { Package, Plus, Pencil, Trash2, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  image_urls: string[] | null;
  active: boolean;
  created_at: string;
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export default function Produtos() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("agent_products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setItems((data as unknown as Product[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null);
    setName(""); setDescription(""); setPrice(""); setActive(true); setImages([]);
  };

  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description || "");
    setPrice(String(p.price ?? ""));
    setActive(p.active);
    const arr = Array.isArray(p.image_urls) && p.image_urls.length > 0
      ? p.image_urls
      : (p.image_url ? [p.image_url] : []);
    setImages(arr);
    setOpen(true);
  };

  const handleUpload = async (files: File[]) => {
    console.log("[Produtos] handleUpload start", { count: files?.length });
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Você precisa estar logado para enviar fotos.");
      const uploaded: string[] = [];
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        console.log("[Produtos] uploading", { path, size: file.size, type: file.type });
        const { data: upData, error: upErr } = await (supabase as any).storage
          .from("agent-products")
          .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
        if (upErr) {
          console.error("[Produtos] upload error", upErr);
          throw upErr;
        }
        console.log("[Produtos] uploaded ok", upData);
        const { data: pub } = (supabase as any).storage.from("agent-products").getPublicUrl(path);
        console.log("[Produtos] publicUrl", pub?.publicUrl);
        uploaded.push(pub.publicUrl);
      }
      setImages((prev) => [...prev, ...uploaded]);
      toast({
        title: `${uploaded.length} foto(s) enviada(s)`,
        description: uploaded.length > 0 ? "Clique em Criar/Salvar para gravar o produto." : "Nenhum arquivo processado.",
      });
    } catch (e: any) {
      console.error("[Produtos] upload error", e);
      toast({
        title: "Erro no upload",
        description: e?.message || e?.error || JSON.stringify(e),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Informe o nome", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = {
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        price: Number(String(price).replace(",", ".")) || 0,
        image_url: images[0] || null,
        image_urls: images,
        active,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await (supabase as any).from("agent_products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Produto atualizado" });
      } else {
        const { error } = await (supabase as any).from("agent_products").insert(payload);
        if (error) throw error;
        toast({ title: "Produto criado" });
      }
      setOpen(false);
      reset();
      load();
    } catch (e: any) {
      console.error("[Produtos] save error", e);
      toast({ title: "Erro ao salvar", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    const { error } = await (supabase as any).from("agent_products").delete().eq("id", p.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Produto excluído" });
    load();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Produtos</h1>
            <p className="text-sm text-muted-foreground">Cadastre seus produtos com foto, descrição e valor</p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Novo produto
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum produto cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-4">Clique em "Novo produto" para começar.</p>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo produto</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <Card key={p.id} className="overflow-hidden flex flex-col">
              <div className="aspect-video bg-muted relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                {!p.active && (
                  <span className="absolute top-2 left-2 text-xs bg-background/90 border border-border rounded px-2 py-0.5">Inativo</span>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-medium text-foreground line-clamp-1">{p.name}</h3>
                {p.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                )}
                <div className="mt-3 text-lg font-semibold text-foreground">{formatBRL(p.price)}</div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(p)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Fotos</Label>
              <div className="mt-1.5 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {images.map((url, i) => (
                    <div key={url + i} className="relative w-20 h-20 rounded-lg bg-muted border border-border overflow-hidden group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 bg-background/90 border border-border rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                        aria-label="Remover"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-background/80 text-foreground text-center py-0.5">Principal</span>
                      )}
                    </div>
                  ))}
                  <label
                    htmlFor="produto-fotos-input"
                    className={`relative w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={() => console.log("[Produtos] label clicked")}
                  >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    <span className="text-[10px] mt-1">Adicionar</span>
                  </label>
                  <input
                    id="produto-fotos-input"
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading}
                    style={{ position: "fixed", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                    onChange={(e) => {
                      const fs = e.target.files;
                      console.log("[Produtos] file input change", { count: fs?.length });
                      const arr = fs ? Array.from(fs) : [];
                      e.target.value = "";
                      if (arr.length > 0) handleUpload(arr);
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">A primeira imagem será usada como capa.</p>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Plano Premium" />
            </div>

            <div>
              <Label htmlFor="desc">Descrição</Label>
              <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o produto..." />
            </div>

            <div>
              <Label htmlFor="price">Valor (R$)</Label>
              <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="cursor-pointer">Ativo</Label>
                <p className="text-xs text-muted-foreground">Disponível para uso pelo agente</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
