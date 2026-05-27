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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("agent_products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setItems((data as Product[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null);
    setName(""); setDescription(""); setPrice(""); setActive(true); setImageUrl(null);
  };

  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description || "");
    setPrice(String(p.price ?? ""));
    setActive(p.active);
    setImageUrl(p.image_url);
    setOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await (supabase as any).storage.from("agent-products").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = (supabase as any).storage.from("agent-products").getPublicUrl(path);
      setImageUrl(pub.publicUrl);
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
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
        image_url: imageUrl,
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
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
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
              <Label>Foto</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="w-20 h-20 rounded-lg bg-muted border border-border overflow-hidden flex items-center justify-center">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {imageUrl ? "Trocar" : "Enviar"}
                </Button>
                {imageUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
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
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
