import { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit, Trash2, ShoppingCart, Package, Repeat, Briefcase, Loader2, ImagePlus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "./mock-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  digital: { label: "Digital", icon: Package, color: "text-blue-400 bg-blue-500/10" },
  physical: { label: "Físico", icon: ShoppingCart, color: "text-emerald-400 bg-emerald-500/10" },
  subscription: { label: "Assinatura", icon: Repeat, color: "text-purple-400 bg-purple-500/10" },
  service: { label: "Serviço", icon: Briefcase, color: "text-amber-400 bg-amber-500/10" },
};

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  type: string;
  status: boolean;
  sku: string | null;
  category: string | null;
  image_url?: string | null;
}

interface FormState {
  name: string;
  description: string;
  type: string;
  price: string;
  sku: string;
  category: string;
}

const emptyForm: FormState = { name: "", description: "", type: "digital", price: "", sku: "", category: "" };

export default function PayProducts() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("gateway_products" as any).select("*").order("created_at", { ascending: false });
    if (!error && data) setProducts(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadImage = async (userId: string): Promise<string | null> => {
    if (!imageFile) return null;
    const ext = imageFile.name.split(".").pop();
    const fileName = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, imageFile, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar imagem");
      return null;
    }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || "",
      type: product.type,
      price: (product.price / 100).toFixed(2).replace(".", ","),
      sku: product.sku || "",
      category: product.category || "",
    });
    setImagePreview(product.image_url || null);
    setImageFile(null);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    resetForm();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro"); return; }
    setSaving(true);

    let imageUrl: string | null | undefined = undefined;
    if (imageFile) {
      setUploading(true);
      imageUrl = await uploadImage(user.id);
      setUploading(false);
      if (imageUrl === null && imageFile) {
        setSaving(false);
        return;
      }
    } else if (imagePreview === null && editingProduct?.image_url) {
      // User removed the image
      imageUrl = null;
    }

    const priceInCents = Math.round(parseFloat(form.price.replace(",", ".")) * 100) || 0;

    if (editingProduct) {
      // UPDATE
      const updateData: any = {
        name: form.name,
        description: form.description || null,
        type: form.type,
        price: priceInCents,
        sku: form.sku || null,
        category: form.category || null,
      };
      if (imageUrl !== undefined) updateData.image_url = imageUrl;

      const { error } = await supabase.from("gateway_products" as any).update(updateData as any).eq("id", editingProduct.id);
      setSaving(false);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Produto atualizado!");
    } else {
      // INSERT
      const insertData: any = {
        user_id: user.id,
        name: form.name,
        description: form.description || null,
        type: form.type,
        price: priceInCents,
        sku: form.sku || null,
        category: form.category || null,
      };
      if (imageUrl) insertData.image_url = imageUrl;

      const { error } = await supabase.from("gateway_products" as any).insert(insertData as any);
      setSaving(false);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Produto criado!");
    }

    setDialogOpen(false);
    resetForm();
    fetchProducts();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setEditingProduct(null);
  };

  const toggleStatus = async (id: string, current: boolean) => {
    await supabase.from("gateway_products" as any).update({ status: !current } as any).eq("id", id);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("gateway_products" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Produto removido");
    fetchProducts();
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus produtos e serviços ({products.length})</p>
        </div>
        <Button className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full px-6" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" /> Novo Produto
        </Button>
      </div>

      {/* Product Dialog (Create & Edit) */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg border-[#2A2A2A]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Criar Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Image Upload */}
            <div>
              <Label>Foto do produto</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative mt-2 w-full h-40 rounded-lg overflow-hidden border border-[#2A2A2A] bg-muted">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                      title="Trocar foto"
                    >
                      <Edit className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                      title="Remover foto"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 w-full h-32 rounded-lg border-2 border-dashed border-[#2A2A2A] hover:border-[#FF4D2E]/50 flex flex-col items-center justify-center gap-2 transition-colors bg-muted/30"
                >
                  <ImagePlus className="w-8 h-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Clique para adicionar uma foto</span>
                  <span className="text-[10px] text-muted-foreground/60">PNG, JPG até 5MB</span>
                </button>
              )}
            </div>

            <div><Label>Nome</Label><Input placeholder="Nome do produto" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Descrição</Label><Textarea placeholder="Descrição" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="physical">Físico</SelectItem>
                    <SelectItem value="subscription">Assinatura</SelectItem>
                    <SelectItem value="service">Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Preço (R$)</Label><Input placeholder="0,00" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>SKU</Label><Input placeholder="SKU-001" value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} /></div>
              <div><Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="infoproduto">Infoproduto</SelectItem>
                    <SelectItem value="software">Software / SaaS</SelectItem>
                    <SelectItem value="consultoria">Consultoria</SelectItem>
                    <SelectItem value="curso">Curso Online</SelectItem>
                    <SelectItem value="ebook">E-book</SelectItem>
                    <SelectItem value="mentoria">Mentoria</SelectItem>
                    <SelectItem value="template">Template / Modelo</SelectItem>
                    <SelectItem value="ferramenta">Ferramenta</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="fisico">Produto Físico</SelectItem>
                    <SelectItem value="assinatura">Assinatura</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full" onClick={handleSave} disabled={saving || !form.name}>
              {(saving || uploading) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {uploading ? "Enviando foto..." : editingProduct ? "Atualizar Produto" : "Salvar Produto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar produtos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-[#2A2A2A]">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{products.length === 0 ? "Nenhum produto cadastrado. Crie seu primeiro produto!" : "Nenhum resultado encontrado."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const tc = typeConfig[p.type] || typeConfig.digital;
            const IconComp = tc.icon;
            return (
              <Card key={p.id} className="border-[#2A2A2A] hover:border-[#FF4D2E]/30 transition-colors overflow-hidden">
                {p.image_url ? (
                  <div className="w-full h-36 bg-muted overflow-hidden">
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-24 bg-muted/50 flex items-center justify-center">
                    <IconComp className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description || "Sem descrição"}</p>
                    </div>
                    <Switch checked={p.status} onCheckedChange={() => toggleStatus(p.id, p.status)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{formatCurrency(p.price)}</span>
                    <Badge variant="outline" className={`text-[10px] ${tc.color} border-0`}>{tc.label}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEditDialog(p)}>
                      <Edit className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => deleteProduct(p.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
