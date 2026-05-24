import { useState, useEffect, useRef } from "react";
import { Plus, Search, Edit, Trash2, ShoppingCart, Package, Repeat, Briefcase, Loader2, ImagePlus, X, Link, Copy, ExternalLink, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "./mock-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
  affiliate_enabled: boolean;
  commission_rate: number;
  visible_in_store?: boolean;
  auto_approve_affiliates?: boolean;
  access_buyer_data?: boolean;
  commission_type?: 'percentage' | 'fixed';
  commission_value?: number;
  affiliate_description?: string | null;
}


interface FormState {
  name: string;
  description: string;
  type: string;
  price: string;
  sku: string;
  category: string;
  affiliate_enabled: boolean;
  commission_rate: string;
  marketplace_visible: boolean;
  auto_approve_affiliates: boolean;
  buyer_data_access: boolean;
  commission_type: 'percentage' | 'fixed';
  affiliate_description: string;
  plans: Plan[];
}

const emptyForm: FormState = { 
  name: "", 
  description: "", 
  type: "digital", 
  price: "", 
  sku: "", 
  category: "",
  affiliate_enabled: false,
  commission_rate: "0",
  marketplace_visible: true,
  auto_approve_affiliates: true,
  buyer_data_access: false,
  commission_type: 'percentage',
  affiliate_description: "",
  plans: []
};

export default function PayProducts() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<(Product & { plan_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checkoutsByProduct, setCheckoutsByProduct] = useState<Record<string, { id: string; name: string; slug: string | null; status: boolean }[]>>({});
  const platformCheckoutDomain = "zaplynx.com";
  const [customCheckoutDomain, setCustomCheckoutDomain] = useState("");

  const fetchProducts = async () => {
    const { data: productsData, error } = await supabase.from("gateway_products").select("*").order("created_at", { ascending: false });
    
    if (!error && productsData) {
      // Fetch plan counts for each product
      const { data: plansData } = await supabase
        .from("gateway_plans" as any)
        .select("product_id");
      
      const planCounts: Record<string, number> = {};
      if (plansData) {
        plansData.forEach((p: any) => {
          planCounts[p.product_id] = (planCounts[p.product_id] || 0) + 1;
        });
      }

      const productsWithPlans = productsData.map((p: any) => ({
        ...p,
        plan_count: planCounts[p.id] || 0
      }));

      setProducts(productsWithPlans as any);
    }
    setLoading(false);
  };

  const fetchCheckouts = async () => {
    const { data } = await supabase.from("gateway_checkouts" as any).select("id, name, slug, status, product_id").order("created_at", { ascending: false });
    if (data) {
      const map: Record<string, { id: string; name: string; slug: string | null; status: boolean }[]> = {};
      for (const c of data as any[]) {
        if (c.product_id) {
          if (!map[c.product_id]) map[c.product_id] = [];
          map[c.product_id].push({ id: c.id, name: c.name, slug: c.slug, status: c.status });
        }
      }
      setCheckoutsByProduct(map);
    }
  };

  const fetchCustomDomain = async () => {
    const storedDomain = localStorage.getItem("checkout_custom_domain") || "";
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setCustomCheckoutDomain(storedDomain);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("custom_domain")
        .eq("id", user.id)
        .maybeSingle();

      const resolvedDomain = (profile as { custom_domain?: string | null } | null)?.custom_domain || storedDomain;
      if (resolvedDomain) {
        localStorage.setItem("checkout_custom_domain", resolvedDomain);
      }
      setCustomCheckoutDomain(resolvedDomain);
    } catch {
      setCustomCheckoutDomain(storedDomain);
    }
  };

  const buildCheckoutUrl = (domain: string, slugOrId: string) => `https://${domain}/pay/${slugOrId}`;

  const copyCheckoutUrl = async (url: string, label: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await navigator.clipboard.writeText(url);
    toast.success(`${label} copiado!`);
  };

  useEffect(() => { fetchProducts(); fetchCheckouts(); fetchCustomDomain(); }, []);

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

  const openEditDialog = async (product: Product) => {
    setEditingProduct(product);
    
    // Fetch plans for this product
    const { data: plansData } = await supabase
      .from("gateway_plans" as any)
      .select("*")
      .eq("product_id", product.id);

    const mappedPlans = (plansData || []).map((plan: any) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description || "",
      price: (plan.price / 100).toFixed(2).replace(".", ","),
      billing_cycle: plan.billing_cycle || "one-time",
    }));

    setForm({
      name: product.name,
      description: product.description || "",
      type: product.type,
      price: (product.price / 100).toFixed(2).replace(".", ","),
      sku: product.sku || "",
      category: product.category || "",
      affiliate_enabled: product.affiliate_enabled || false,
      marketplace_visible: product.visible_in_store ?? true,
      auto_approve_affiliates: product.auto_approve_affiliates ?? true,
      buyer_data_access: product.access_buyer_data ?? false,
      commission_type: product.commission_type as 'percentage' | 'fixed' || 'percentage',
      commission_rate: (product.commission_type === 'fixed' ? (product.commission_value || 0) : (product.commission_rate || 0)).toString().replace(".", ","),
      affiliate_description: product.affiliate_description || "",
      plans: mappedPlans,
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

  const buildCheckoutSlug = (name: string) => {
    const base = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 45) || "produto";

    return `${base}-${Date.now().toString().slice(-6)}`;
  };

  const syncLinkedCheckoutPrices = async (productId: string, price: number) => {
    const { data: linkedCheckouts, error } = await supabase
      .from("gateway_checkouts" as any)
      .select("id, config")
      .eq("product_id", productId);

    if (error) throw error;
    if (!linkedCheckouts?.length) return;

    const updates = linkedCheckouts.map((checkout: any) =>
      supabase
        .from("gateway_checkouts" as any)
        .update({
          config: {
            ...(checkout.config || {}),
            price,
          },
        } as any)
        .eq("id", checkout.id)
    );

    const results = await Promise.all(updates);
    const failedUpdate = results.find((result) => result.error);
    if (failedUpdate?.error) throw failedUpdate.error;
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
      imageUrl = null;
    }

    const priceInCents = Math.round(parseFloat(form.price.replace(",", ".")) * 100) || 0;

    if (editingProduct) {
      const updateData: any = {
        name: form.name,
        description: form.description || null,
        type: form.type,
        price: priceInCents,
        sku: form.sku || null,
        category: form.category || null,
        affiliate_enabled: form.affiliate_enabled,
        commission_rate: form.commission_type === 'percentage' ? (parseFloat(form.commission_rate.replace(",", ".")) || 0) : 0,
        commission_value: form.commission_type === 'fixed' ? (parseFloat(form.commission_rate.replace(",", ".")) || 0) : 0,
        affiliate_description: form.affiliate_description || null,
      };
      
      if (form.affiliate_enabled) {
        updateData.visible_in_store = form.marketplace_visible;
        updateData.auto_approve_affiliates = form.auto_approve_affiliates;
        updateData.access_buyer_data = form.buyer_data_access;
        updateData.commission_type = form.commission_type;
      }

      if (imageUrl !== undefined) updateData.image_url = imageUrl;

      const { error } = await supabase.from("gateway_products" as any).update(updateData as any).eq("id", editingProduct.id);
      if (error) { toast.error("Erro: " + error.message); setSaving(false); return; }

      // Save plans
      await savePlans(editingProduct.id, form.plans);

      try {
        await syncLinkedCheckoutPrices(editingProduct.id, priceInCents);
      } catch (syncError: any) {
        setSaving(false);
        toast.error("Produto atualizado, mas houve erro ao sincronizar o checkout: " + (syncError?.message || "erro desconhecido"));
        return;
      }

      setSaving(false);
      toast.success("Produto atualizado!");
    } else {
      const insertData: any = {
        user_id: user.id,
        name: form.name,
        description: form.description || null,
        type: form.type,
        price: priceInCents,
        sku: form.sku || null,
        category: form.category || null,
        affiliate_enabled: form.affiliate_enabled,
        commission_rate: form.commission_type === 'percentage' ? (parseFloat(form.commission_rate.replace(",", ".")) || 0) : 0,
        commission_value: form.commission_type === 'fixed' ? (parseFloat(form.commission_rate.replace(",", ".")) || 0) : 0,
        affiliate_description: form.affiliate_description || null,
      };

      if (form.affiliate_enabled) {
        insertData.visible_in_store = form.marketplace_visible;
        insertData.auto_approve_affiliates = form.auto_approve_affiliates;
        insertData.access_buyer_data = form.buyer_data_access;
        insertData.commission_type = form.commission_type;
      }

      if (imageUrl) insertData.image_url = imageUrl;

      const { data: createdProductRaw, error: productError } = await supabase
        .from("gateway_products" as any)
        .insert(insertData as any)
        .select("id, name, price, image_url")
        .single();

      const createdProduct = createdProductRaw as any;

      if (productError || !createdProduct) {
        setSaving(false);
        toast.error("Erro: " + (productError?.message || "não foi possível criar o produto"));
        return;
      }

      // Save plans
      await savePlans(createdProduct.id, form.plans);

      let checkoutDefaults: Record<string, any> = {};
      const { data: defaultsRow } = await supabase
        .from("gateway_platform_config")
        .select("value")
        .eq("key", `checkout_defaults:${user.id}`)
        .maybeSingle();

      if (defaultsRow?.value) {
        try {
          checkoutDefaults = JSON.parse(defaultsRow.value);
        } catch {
          checkoutDefaults = {};
        }
      }

      const slug = buildCheckoutSlug(form.name);
      const checkoutConfig = {
        ...checkoutDefaults,
        productName: form.name,
        offerName: form.name,
        price: priceInCents,
        productImage: imageUrl || createdProduct.image_url || "",
        showAddress: form.category === "fisico" ? true : checkoutDefaults.showAddress,
      };

      const { error: checkoutError } = await supabase.from("gateway_checkouts" as any).insert({
        user_id: user.id,
        name: form.name,
        product_id: createdProduct.id,
        slug,
        status: true,
        config: checkoutConfig,
      } as any);

      setSaving(false);
      if (checkoutError) {
        toast.error("Produto criado, mas houve erro ao gerar o link: " + checkoutError.message);
      } else {
        toast.success("Produto criado com link automático!");
      }
    }

    setDialogOpen(false);
    resetForm();
    fetchProducts();
    fetchCheckouts();
  };

  const savePlans = async (productId: string, plans: Plan[]) => {
    // Delete removed plans
    const planIdsToKeep = plans.filter(p => p.id).map(p => p.id);
    if (planIdsToKeep.length > 0) {
      await supabase
        .from("gateway_plans" as any)
        .delete()
        .eq("product_id", productId)
        .not("id", "in", `(${planIdsToKeep.join(",")})`);
    } else {
      await supabase
        .from("gateway_plans" as any)
        .delete()
        .eq("product_id", productId);
    }

    // Upsert plans
    const plansToUpsert = plans.map(plan => ({
      id: plan.id,
      product_id: productId,
      name: plan.name,
      description: plan.description,
      price: Math.round(parseFloat(plan.price.replace(",", ".")) * 100) || 0,
      billing_cycle: plan.billing_cycle,
    }));

    if (plansToUpsert.length > 0) {
      const { error } = await supabase
        .from("gateway_plans" as any)
        .upsert(plansToUpsert);
      
      if (error) {
        console.error("Error saving plans:", error);
        toast.error("Erro ao salvar alguns planos");
      }
    }
  };

  const addPlan = () => {
    setForm(p => ({
      ...p,
      plans: [...p.plans, { name: "", description: "", price: "", billing_cycle: "one-time" }]
    }));
  };

  const removePlan = (index: number) => {
    setForm(p => ({
      ...p,
      plans: p.plans.filter((_, i) => i !== index)
    }));
  };

  const updatePlan = (index: number, field: keyof Plan, value: string) => {
    setForm(p => ({
      ...p,
      plans: p.plans.map((plan, i) => i === index ? { ...plan, [field]: value } : plan)
    }));
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
        <Button className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-6" onClick={openCreateDialog}>
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
                  className="mt-2 w-full h-32 rounded-lg border-2 border-dashed border-[#2A2A2A] hover:border-[#a78bfa]/50 flex flex-col items-center justify-center gap-2 transition-colors bg-muted/30"
                >
                  <ImagePlus className="w-8 h-8 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Clique para adicionar uma foto</span>
                  <span className="text-[10px] text-muted-foreground/60">PNG, JPG até 5MB</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input placeholder="Nome do produto" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
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
              <div className="flex flex-col justify-end">
                <div className="flex items-center justify-between border rounded-md px-3 py-2 h-10">
                  <Label className="text-sm cursor-pointer" htmlFor="affiliate-toggle">Ativar afiliação</Label>
                  <Switch 
                    id="affiliate-toggle"
                    checked={form.affiliate_enabled} 
                    onCheckedChange={v => setForm(p => ({ ...p, affiliate_enabled: v }))} 
                  />
                </div>
              </div>
            </div>

            {/* Plans Section */}
            <div className="space-y-3 pt-2 border-t border-[#2A2A2A]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-[#a78bfa]" />
                  <Label className="font-semibold text-sm">Planos / Variações de Preço</Label>
                </div>
                <Button variant="outline" size="sm" onClick={addPlan} className="h-7 text-[10px] gap-1">
                  <Plus className="w-3 h-3" /> Adicionar Plano
                </Button>
              </div>

              {form.plans.length === 0 ? (
                <p className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-md border border-dashed border-[#2A2A2A]">
                  Nenhum plano extra adicionado. O produto usará o preço principal definido acima.
                </p>
              ) : (
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                  {form.plans.map((plan, index) => (
                    <div key={index} className="bg-muted/30 border border-[#2A2A2A] rounded-lg p-3 space-y-3 relative group">
                      <button 
                        onClick={() => removePlan(index)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Nome do Plano</Label>
                          <Input 
                            placeholder="Ex: Trimestral, VIP, etc" 
                            className="h-8 text-xs" 
                            value={plan.name} 
                            onChange={e => updatePlan(index, "name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Preço (R$)</Label>
                          <Input 
                            placeholder="0,00" 
                            className="h-8 text-xs" 
                            value={plan.price} 
                            onChange={e => updatePlan(index, "price", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Ciclo de Faturamento</Label>
                          <Select value={plan.billing_cycle} onValueChange={v => updatePlan(index, "billing_cycle", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="one-time">Pagamento Único</SelectItem>
                              <SelectItem value="monthly">Mensal</SelectItem>
                              <SelectItem value="quarterly">Trimestral</SelectItem>
                              <SelectItem value="semiannual">Semestral</SelectItem>
                              <SelectItem value="yearly">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Descrição (opcional)</Label>
                          <Input 
                            placeholder="Breve descrição" 
                            className="h-8 text-xs" 
                            value={plan.description} 
                            onChange={e => updatePlan(index, "description", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {form.affiliate_enabled && (
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Configurações de Afiliação</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm" htmlFor="marketplace-visible">Visível na loja?</Label>
                      <p className="text-[10px] text-muted-foreground">Mostrar este produto no marketplace</p>
                    </div>
                    <Switch 
                      id="marketplace-visible"
                      checked={form.marketplace_visible} 
                      onCheckedChange={v => setForm(p => ({ ...p, marketplace_visible: v }))} 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm" htmlFor="auto-approve">Aprovação automática?</Label>
                      <p className="text-[10px] text-muted-foreground">Aprovar novos afiliados instantaneamente</p>
                    </div>
                    <Switch 
                      id="auto-approve"
                      checked={form.auto_approve_affiliates} 
                      onCheckedChange={v => setForm(p => ({ ...p, auto_approve_affiliates: v }))} 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm" htmlFor="buyer-data">Acesso aos dados do comprador?</Label>
                      <p className="text-[10px] text-muted-foreground">Afiliados podem ver e-mail e nome dos clientes</p>
                    </div>
                    <Switch 
                      id="buyer-data"
                      checked={form.buyer_data_access} 
                      onCheckedChange={v => setForm(p => ({ ...p, buyer_data_access: v }))} 
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-primary/10">
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo de comissão</Label>
                    <Select value={form.commission_type} onValueChange={v => setForm(p => ({ ...p, commission_type: v as 'percentage' | 'fixed' }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">
                      {form.commission_type === 'percentage' ? 'Porcentagem da comissão' : 'Valor da comissão'}
                    </Label>
                    <div className="relative">
                      <Input 
                        placeholder="0,00" 
                        value={form.commission_rate} 
                        onChange={e => setForm(p => ({ ...p, commission_rate: e.target.value }))}
                        className="h-9 pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        {form.commission_type === 'percentage' ? '%' : 'R$'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Descrição para Afiliados</Label>
                    <Textarea 
                      placeholder="Instruções e detalhes importantes para seus afiliados..." 
                      value={form.affiliate_description} 
                      onChange={e => setForm(p => ({ ...p, affiliate_description: e.target.value }))}
                      className="min-h-[80px] text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
            <Button className="w-full bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full" onClick={handleSave} disabled={saving || !form.name}>
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
              <Card key={p.id} className="border-[#2A2A2A] hover:border-[#a78bfa]/30 transition-colors overflow-hidden">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{formatCurrency(p.price)}</span>
                    {p.plan_count && p.plan_count > 0 ? (
                      <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/20 bg-blue-400/5">
                        {p.plan_count} {p.plan_count === 1 ? "Plano" : "Planos"}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className={`text-[10px] ${tc.color} border-0`}>{tc.label}</Badge>
                    {p.affiliate_enabled && (
                      <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                        Afiliados: {p.commission_type === 'fixed' ? formatCurrency((p.commission_value || 0) * 100) : `${p.commission_rate}%`}
                      </Badge>
                    )}
                  </div>
                  {/* Checkout Links */}
                  {checkoutsByProduct[p.id] && checkoutsByProduct[p.id].length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Link className="w-3 h-3" /> Links de Checkout
                      </span>
                      {checkoutsByProduct[p.id].map((ck) => {
                        const slugOrId = ck.slug || ck.id;
                        const platformUrl = buildCheckoutUrl(platformCheckoutDomain, slugOrId);
                        const hasCustomDomain = Boolean(customCheckoutDomain && customCheckoutDomain !== platformCheckoutDomain);
                        const customUrl = hasCustomDomain ? buildCheckoutUrl(customCheckoutDomain, slugOrId) : "";

                        return (
                          <div key={ck.id} className="space-y-2 bg-muted/50 rounded-md px-2 py-2">
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${ck.status ? "bg-emerald-500" : "bg-red-400"}`} />
                              <span className="text-[11px] text-foreground truncate flex-1" title={ck.name}>{ck.name}</span>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <div className="flex gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-[10px] h-7"
                                  onClick={(e) => void copyCheckoutUrl(platformUrl, "Link da plataforma", e)}
                                >
                                  <Copy className="w-3 h-3 mr-1" /> Plataforma
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => window.open(platformUrl, '_blank')}
                                  title="Abrir checkout"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </div>

                              {hasCustomDomain && (
                                <div className="flex gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-[10px] h-7"
                                    onClick={(e) => void copyCheckoutUrl(customUrl, "Link personalizado", e)}
                                  >
                                    <Copy className="w-3 h-3 mr-1" /> Personalizado
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => window.open(customUrl, '_blank')}
                                    title="Abrir checkout"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
