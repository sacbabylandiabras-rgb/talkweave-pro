import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, ShoppingCart, Package, Repeat, Briefcase, Loader2 } from "lucide-react";
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
}

export default function PayProducts() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", type: "digital", price: "", sku: "", category: "" });

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("gateway_products" as any).select("*").order("created_at", { ascending: false });
    if (!error && data) setProducts(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleCreate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro"); return; }
    setSaving(true);
    const priceInCents = Math.round(parseFloat(form.price.replace(",", ".")) * 100) || 0;
    const { error } = await supabase.from("gateway_products" as any).insert({
      user_id: user.id,
      name: form.name,
      description: form.description || null,
      type: form.type,
      price: priceInCents,
      sku: form.sku || null,
      category: form.category || null,
    } as any);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Produto criado!");
    setDialogOpen(false);
    setForm({ name: "", description: "", type: "digital", price: "", sku: "", category: "" });
    fetchProducts();
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full px-6">
              <Plus className="w-4 h-4 mr-2" /> Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg border-[#2A2A2A]">
            <DialogHeader>
              <DialogTitle>Criar Produto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
                <div><Label>Categoria</Label><Input placeholder="Categoria" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} /></div>
              </div>
              <Button className="w-full bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full" onClick={handleCreate} disabled={saving || !form.name}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar Produto
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
              <Card key={p.id} className="border-[#2A2A2A] hover:border-[#FF4D2E]/30 transition-colors">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <IconComp className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <Switch checked={p.status} onCheckedChange={() => toggleStatus(p.id, p.status)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description || "Sem descrição"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{formatCurrency(p.price)}</span>
                    <Badge variant="outline" className={`text-[10px] ${tc.color} border-0`}>{tc.label}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs"><Edit className="w-3 h-3 mr-1" /> Editar</Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => deleteProduct(p.id)}><Trash2 className="w-3 h-3" /></Button>
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