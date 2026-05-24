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

export default function PayProducts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<(Product & { plans: any[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutsByProduct, setCheckoutsByProduct] = useState<Record<string, { id: string; name: string; slug: string | null; status: boolean }[]>>({});
  const platformCheckoutDomain = "zaplynx.com";
  const [customCheckoutDomain, setCustomCheckoutDomain] = useState("");

  const fetchProducts = async () => {
    const { data: productsData, error } = await supabase.from("gateway_products").select("*").order("created_at", { ascending: false });
    
    if (!error && productsData) {
      const { data: plansData } = await supabase.from("gateway_plans" as any).select("*");
      const plansMap: Record<string, any[]> = {};
      if (plansData) {
        plansData.forEach((p: any) => {
          if (!plansMap[p.product_id]) plansMap[p.product_id] = [];
          plansMap[p.product_id].push(p);
        });
      }
      const productsWithPlans = productsData.map((p: any) => ({
        ...p,
        plans: plansMap[p.id] || []
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
    if (!user) { setCustomCheckoutDomain(storedDomain); return; }
    try {
      const { data: profile } = await supabase.from("profiles").select("custom_domain").eq("id", user.id).maybeSingle();
      const resolvedDomain = (profile as any)?.custom_domain || storedDomain;
      setCustomCheckoutDomain(resolvedDomain);
    } catch { setCustomCheckoutDomain(storedDomain); }
  };

  const buildCheckoutUrl = (domain: string, slugOrId: string) => `https://${domain}/pay/${slugOrId}`;

  const copyCheckoutUrl = async (url: string, label: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await navigator.clipboard.writeText(url);
    toast.success(`${label} copiado!`);
  };

  useEffect(() => { fetchProducts(); fetchCheckouts(); fetchCustomDomain(); }, []);

  const toggleStatus = async (id: string, current: boolean) => {
    await supabase.from("gateway_products" as any).update({ status: !current } as any).eq("id", id);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    const { error } = await supabase.from("gateway_products" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Produto removido");
    fetchProducts();
  };

  const autoCreateCheckout = async (product: Product) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const checkoutSlug = product.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Math.random().toString(36).substring(2, 7);
      const { error } = await supabase.from("gateway_checkouts" as any).insert({
        user_id: user.id,
        product_id: product.id,
        name: `Checkout - ${product.name}`,
        slug: checkoutSlug,
        status: true,
        config: {
          productName: product.name,
          price: product.price,
          productImage: product.image_url || null
        }
      } as any);

      if (error) throw error;
      toast.success("Checkout criado com sucesso!");
      fetchCheckouts();
    } catch (error: any) {
      toast.error("Erro ao criar checkout: " + error.message);
    }
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
        <Button className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full px-6" onClick={() => navigate("/gateway-checkout/products/new")}>
          <Plus className="w-4 h-4 mr-2" /> Novo Produto
        </Button>
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
                    {p.plans && p.plans.length > 0 ? (
                      <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/20 bg-blue-400/5">
                        {p.plans.length} {p.plans.length === 1 ? "Plano" : "Planos"}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className={`text-[10px] ${tc.color} border-0`}>{tc.label}</Badge>
                    {p.affiliate_enabled && (
                      <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                        Afiliados: {p.commission_type === 'fixed' ? formatCurrency((p.commission_value || 0) * 100) : `${p.commission_rate}%`}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {checkoutsByProduct[p.id] && checkoutsByProduct[p.id].length > 0 ? (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-[#a78bfa] uppercase tracking-wider flex items-center gap-1">
                          <Link className="w-3 h-3" /> Links de Divulgação
                        </span>
                        {checkoutsByProduct[p.id].map((ck) => {
                          const slugOrId = ck.slug || ck.id;
                          const platformUrl = buildCheckoutUrl(platformCheckoutDomain, slugOrId);
                          const hasCustomDomain = Boolean(customCheckoutDomain && customCheckoutDomain !== platformCheckoutDomain);
                          const customUrl = hasCustomDomain ? buildCheckoutUrl(customCheckoutDomain, slugOrId) : "";
                          
                          return (
                            <div key={ck.id} className="space-y-2 bg-muted/30 rounded-lg p-2.5 border border-border/40">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${ck.status ? "bg-emerald-500" : "bg-red-400"}`} />
                                <span className="text-[11px] font-medium text-foreground truncate flex-1" title={ck.name}>{ck.name}</span>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-1.5">
                                <div className="flex gap-1">
                                  <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7 bg-background/50" onClick={(e) => void copyCheckoutUrl(platformUrl, "Link da plataforma", e)}>
                                    <Copy className="w-3 h-3 mr-1" /> Checkout
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-background/50" onClick={() => window.open(platformUrl, '_blank')} title="Abrir checkout">
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                </div>
                                {hasCustomDomain && (
                                  <div className="flex gap-1">
                                    <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7 bg-background/50" onClick={(e) => void copyCheckoutUrl(customUrl, "Link personalizado", e)}>
                                      <Copy className="w-3 h-3 mr-1" /> Personalizado
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-background/50" onClick={() => window.open(customUrl, '_blank')} title="Abrir checkout">
                                      <ExternalLink className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Links para Planos se existirem para este checkout */}
                              {p.plans && p.plans.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                                  <p className="text-[9px] font-bold text-[#a78bfa] uppercase tracking-tighter">Links de Planos:</p>
                                  <div className="space-y-1">
                                    {p.plans.map((plan) => {
                                      const planPlatformUrl = `${platformUrl}?plan=${plan.id}`;
                                      return (
                                        <div key={plan.id} className="flex items-center justify-between gap-2 p-1.5 bg-[#a78bfa]/5 rounded border border-[#a78bfa]/10">
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] font-medium truncate" title={plan.name}>{plan.name}</span>
                                            <span className="text-[9px] text-muted-foreground">{formatCurrency(plan.price)}</span>
                                          </div>
                                          <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-[#a78bfa]/20" onClick={(e) => void copyCheckoutUrl(planPlatformUrl, `Link do plano ${plan.name}`, e)} title="Copiar link do plano">
                                              <Copy className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-[#a78bfa]/20" onClick={() => window.open(planPlatformUrl, '_blank')} title="Abrir plano">
                                              <ExternalLink className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-4 px-3 border border-dashed rounded-lg bg-[#a78bfa]/5 border-[#a78bfa]/30 flex flex-col items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#a78bfa]/10 flex items-center justify-center">
                          <Link className="w-4 h-4 text-[#a78bfa]" />
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-semibold text-foreground">Sem links de divulgação</p>
                          <p className="text-[10px] text-muted-foreground">Gere os checkouts para obter seus links.</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-[10px] px-4 border-[#a78bfa]/50 hover:bg-[#a78bfa] hover:text-white transition-all bg-transparent" 
                          onClick={() => autoCreateCheckout(p)}
                        >
                          <Plus className="w-3 h-3 mr-1.5" /> Gerar Links de Divulgação
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border/30">
                    <Button variant="ghost" size="sm" className="flex-1 text-xs h-8 hover:bg-muted" onClick={() => navigate(`/gateway-checkout/products/edit/${p.id}`)}>
                      <Edit className="w-3 h-3 mr-1.5" /> Editar
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400" onClick={() => deleteProduct(p.id)}>
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
