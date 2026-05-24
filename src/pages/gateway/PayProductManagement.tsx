import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Save, Loader2, ImagePlus, X, Package, ShoppingCart, Repeat, Briefcase, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Plan {
  id?: string;
  name: string;
  description: string;
  price: string;
  billing_cycle: string;
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

export default function ProductEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id;
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data: product, error } = await supabase
        .from("gateway_products" as any)
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (product) {
        const { data: plansData } = await supabase
          .from("gateway_plans" as any)
          .select("*")
          .eq("product_id", id);

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
      }
    } catch (error: any) {
      toast.error("Erro ao carregar produto: " + error.message);
      navigate("/gateway-checkout/products");
    } finally {
      setLoading(false);
    }
  };

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
      toast.error("Erro ao enviar imagem");
      return null;
    }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Nome do produto é obrigatório"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro"); return; }
    setSaving(true);

    let imageUrl: string | null | undefined = undefined;
    if (imageFile) {
      setUploading(true);
      imageUrl = await uploadImage(user.id);
      setUploading(false);
      if (imageUrl === null) {
        setSaving(false);
        return;
      }
    } else if (imagePreview === null) {
      imageUrl = null;
    }

    const priceInCents = Math.round(parseFloat(form.price.replace(",", ".")) * 100) || 0;

    const productData: any = {
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
      visible_in_store: form.marketplace_visible,
      auto_approve_affiliates: form.auto_approve_affiliates,
      access_buyer_data: form.buyer_data_access,
      commission_type: form.commission_type,
    };

    if (imageUrl !== undefined) productData.image_url = imageUrl;

    try {
      let productId = id;
      if (isEditing) {
        const { error } = await supabase.from("gateway_products" as any).update(productData).eq("id", id);
        if (error) throw error;
      } else {
        productData.user_id = user.id;
        const { data, error } = await supabase.from("gateway_products" as any).insert(productData).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      // Save plans
      await savePlans(productId!, form.plans);

      toast.success(isEditing ? "Produto atualizado!" : "Produto criado!");
      navigate("/gateway-checkout/products");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const savePlans = async (productId: string, plans: Plan[]) => {
    const planIdsToKeep = plans.filter(p => p.id).map(p => p.id);
    if (planIdsToKeep.length > 0) {
      await supabase.from("gateway_plans" as any).delete().eq("product_id", productId).not("id", "in", `(${planIdsToKeep.join(",")})`);
    } else {
      await supabase.from("gateway_plans" as any).delete().eq("product_id", productId);
    }

    const plansToUpsert = plans.map(plan => ({
      id: plan.id,
      product_id: productId,
      name: plan.name,
      description: plan.description,
      price: Math.round(parseFloat(plan.price.replace(",", ".")) * 100) || 0,
      billing_cycle: plan.billing_cycle,
    }));

    if (plansToUpsert.length > 0) {
      await supabase.from("gateway_plans" as any).upsert(plansToUpsert);
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/gateway-checkout/products")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isEditing ? "Editar Produto" : "Novo Produto"}</h1>
            <p className="text-sm text-muted-foreground">Preencha os detalhes do seu produto ou serviço</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/gateway-checkout/products")} className="rounded-full px-6">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-8">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {isEditing ? "Atualizar" : "Salvar Produto"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Core Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
              <CardDescription>Detalhes básicos que aparecerão no checkout e marketplace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Produto</Label>
                <Input placeholder="Ex: Curso de Marketing Digital" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea placeholder="Descreva seu produto..." className="min-h-[120px]" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="digital">Digital / Infoproduto</SelectItem>
                      <SelectItem value="physical">Produto Físico</SelectItem>
                      <SelectItem value="subscription">Assinatura</SelectItem>
                      <SelectItem value="service">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Preço Principal (R$)</Label>
                  <Input placeholder="0,00" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Planos e Variações</CardTitle>
                <CardDescription>Ofereça diferentes opções de preço ou ciclos de cobrança</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addPlan} className="rounded-full gap-2">
                <Plus className="w-4 h-4" /> Novo Plano
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.plans.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                  <Repeat className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum plano extra adicionado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {form.plans.map((plan, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-muted/10 relative group animate-in fade-in slide-in-from-top-2">
                      <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-red-100 text-red-600 hover:bg-red-200" onClick={() => removePlan(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Nome do Plano</Label>
                          <Input placeholder="Ex: Plano VIP" value={plan.name} onChange={e => updatePlan(index, "name", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Preço (R$)</Label>
                          <Input placeholder="0,00" value={plan.price} onChange={e => updatePlan(index, "price", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Ciclo</Label>
                          <Select value={plan.billing_cycle} onValueChange={v => updatePlan(index, "billing_cycle", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="one-time">Pagamento Único</SelectItem>
                              <SelectItem value="monthly">Mensal</SelectItem>
                              <SelectItem value="yearly">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Descrição Curta</Label>
                          <Input placeholder="O que está incluso?" value={plan.description} onChange={e => updatePlan(index, "description", e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Imagem do Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              {imagePreview ? (
                <div className="relative aspect-square rounded-xl overflow-hidden border bg-muted">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => fileInputRef.current?.click()}><ImagePlus className="w-4 h-4" /></Button>
                    <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full" onClick={() => { setImageFile(null); setImagePreview(null); }}><X className="w-4 h-4" /></Button>
                  </div>
                </div>
              ) : (
                <div className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="p-4 rounded-full bg-primary/10 text-primary"><ImagePlus className="w-8 h-8" /></div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Adicionar Imagem</p>
                    <p className="text-xs text-muted-foreground">Recomendado: 800x800px</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Afiliação</CardTitle>
              <CardDescription>Configure como outros usuários podem vender seu produto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                <div className="space-y-0.5">
                  <Label>Ativar Programa de Afiliados</Label>
                  <p className="text-[10px] text-muted-foreground">Permitir que terceiros vendam este produto</p>
                </div>
                <Switch checked={form.affiliate_enabled} onCheckedChange={v => setForm(p => ({ ...p, affiliate_enabled: v }))} />
              </div>

              {form.affiliate_enabled && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo de Comissão</Label>
                    <Select value={form.commission_type} onValueChange={v => setForm(p => ({ ...p, commission_type: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Valor da Comissão</Label>
                    <Input value={form.commission_rate} onChange={e => setForm(p => ({ ...p, commission_rate: e.target.value }))} />
                  </div>
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Aprovação Automática</Label>
                      <Switch checked={form.auto_approve_affiliates} onCheckedChange={v => setForm(p => ({ ...p, auto_approve_affiliates: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Visível no Marketplace</Label>
                      <Switch checked={form.marketplace_visible} onCheckedChange={v => setForm(p => ({ ...p, marketplace_visible: v }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Instruções para Afiliados</Label>
                    <Textarea placeholder="Quaisquer regras ou dicas..." value={form.affiliate_description} onChange={e => setForm(p => ({ ...p, affiliate_description: e.target.value }))} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventário & Extras</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">SKU / Código de Identificação</Label>
                <Input placeholder="PROD-001" value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curso">Curso Online</SelectItem>
                    <SelectItem value="ebook">E-book</SelectItem>
                    <SelectItem value="software">Software / SaaS</SelectItem>
                    <SelectItem value="fisico">Produto Físico</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
