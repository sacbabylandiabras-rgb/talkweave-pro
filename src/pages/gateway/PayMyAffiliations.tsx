import { useState, useEffect } from "react";
import { ShoppingBag, Search, Loader2, Link2, ExternalLink, BadgePercent, TrendingUp, Copy, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  type: string;
  image_url: string | null;
  category: string | null;
  commission_rate: number;
  commission_type?: 'percentage' | 'fixed';
  commission_value?: number;
  checkouts?: { id: string; slug: string | null }[];
  plans?: { id: string; name: string; price: number }[];
}

interface Affiliation {
  id: string;
  product_id: string;
  affiliate_id: string;
  status: 'approved' | 'pending' | 'rejected';
  created_at: string;
  product: Product;
}

export default function PayMyAffiliations() {
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAffiliation, setSelectedAffiliation] = useState<Affiliation | null>(null);

  const fetchMyAffiliations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("gateway_affiliates" as any)
        .select(`
          id,
          product_id,
          affiliate_id,
          status,
          created_at,
          product:gateway_products (
            *,
            checkouts:gateway_checkouts (id, slug),
            plans:gateway_plans (*)
          )
        `)
        .eq("affiliate_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAffiliations(data as any[] || []);
    } catch (error: any) {
      console.error("Error fetching affiliations:", error);
      toast.error("Erro ao carregar suas afiliações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyAffiliations();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  const getAffiliateLink = (product: Product, affiliateId: string) => {
    let baseUrl = "https://zaplynx.com";
    
    // Fallback para localhost/desenvolvimento se necessário, mas o usuário pediu zaplynx.com
    if (window.location.hostname === "localhost") {
      baseUrl = window.location.origin;
    }

    
    // Usa o slug do checkout se disponível, senão usa o ID do produto (que pode falhar se não houver checkout com esse ID)
    const identifier = product.checkouts && product.checkouts.length > 0 
      ? (product.checkouts[0].slug || product.checkouts[0].id) 
      : product.id;
      
    return `${baseUrl}/pay/${identifier}?aff=${affiliateId}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copiado para a área de transferência!");
  };

  const filteredAffiliations = affiliations.filter(aff => 
    aff.product?.name.toLowerCase().includes(search.toLowerCase()) ||
    (aff.product?.category && aff.product.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Produtos que Sou Afiliado
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus links de afiliado e acompanhe seus produtos.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou categoria..." 
            className="pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando suas afiliações...</p>
        </div>
      ) : filteredAffiliations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAffiliations.map((aff) => {
            const product = aff.product;
            if (!product) return null;
            
            const affiliateLink = getAffiliateLink(product, aff.affiliate_id);

            return (
              <Card key={aff.id} className="overflow-hidden group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                <div 
                  className="cursor-pointer"
                  onClick={() => setSelectedAffiliation(aff)}
                >
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary">
                        <ShoppingBag className="w-12 h-12 text-muted-foreground/20" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Badge className={`${aff.status === 'pending' ? 'bg-yellow-500' : aff.status === 'rejected' ? 'bg-red-500' : 'bg-black/60'} backdrop-blur-md border-none text-white`}>
                        {aff.status === 'pending' ? 'Pendente' : aff.status === 'rejected' ? 'Recusado' : 'Aprovado'}
                      </Badge>
                      <Badge className="bg-black/60 backdrop-blur-md border-none text-white">
                        {product.type === "digital" ? "Digital" : "Físico"}
                      </Badge>
                    </div>
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">
                        {product.name}
                      </CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                      {product.description || "Sem descrição disponível."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Preço</span>
                        <span className="text-xl font-bold">{formatCurrency(product.price)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Sua Comissão</span>
                        <div className="flex items-center gap-1 text-emerald-500 font-bold">
                          <BadgePercent className="w-4 h-4" />
                          <span>{product.commission_type === 'fixed' ? formatCurrency((product.commission_value || 0) * 100) : `${product.commission_rate}%`}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </div>
                <CardContent className="pt-0 space-y-4">
                  <div className="pt-2 space-y-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground uppercase">
                      {aff.status === 'approved' ? 'Seu link de afiliado:' : 'Link ficará disponível após aprovação'}
                    </div>
                    {aff.status === 'approved' ? (
                      <div className="flex gap-2">
                        <Input 
                          readOnly 
                          value={affiliateLink} 
                          className="text-xs bg-muted/50"
                        />
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => copyToClipboard(affiliateLink)}
                          title="Copiar link"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          onClick={() => window.open(affiliateLink, '_blank')}
                          title="Abrir no navegador"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="p-2 bg-muted rounded text-xs text-center text-muted-foreground italic">
                        {aff.status === 'pending' ? 'Aguardando aprovação do produtor' : 'Sua solicitação foi recusada'}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Você ainda não é afiliado de nenhum produto</h3>
          <p className="text-muted-foreground mb-6">Explore o marketplace para encontrar ótimas oportunidades.</p>
          <Button onClick={() => window.location.href = '/gateway-checkout/marketplace'}>
            Ir para o Marketplace
          </Button>
        </div>
      )}

      <Dialog open={!!selectedAffiliation} onOpenChange={(open) => !open && setSelectedAffiliation(null)}>
        <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
          {selectedAffiliation && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedAffiliation.product.name}</DialogTitle>
                <DialogDescription>
                  Detalhes do produto e seus links de afiliado.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-4">
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    {selectedAffiliation.product.image_url ? (
                      <img 
                        src={selectedAffiliation.product.image_url} 
                        alt={selectedAffiliation.product.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-12 h-12 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-secondary/30 p-4 rounded-lg space-y-3">
                    <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Informações de Ganhos</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Preço do Produto</span>
                      <span className="font-bold">{formatCurrency(selectedAffiliation.product.price)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Sua Comissão</span>
                      <span className="font-bold text-emerald-500">
                        {selectedAffiliation.product.commission_type === 'fixed' 
                          ? formatCurrency((selectedAffiliation.product.commission_value || 0) * 100) 
                          : `${selectedAffiliation.product.commission_rate}%`}
                      </span>
                    </div>
                    <div className="pt-2 border-t flex justify-between items-center">
                      <span className="text-sm font-medium">Você ganha até</span>
                      <span className="text-lg font-black text-emerald-600">
                        {selectedAffiliation.product.commission_type === 'fixed' 
                          ? formatCurrency((selectedAffiliation.product.commission_value || 0) * 100) 
                          : formatCurrency((selectedAffiliation.product.price * selectedAffiliation.product.commission_rate) / 100)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">Links de Divulgação</h4>
                    <div className="space-y-4">
                      {/* Se o produto tiver múltiplos checkouts, podemos listar todos */}
                      {selectedAffiliation.product.checkouts && selectedAffiliation.product.checkouts.length > 0 ? (
                        selectedAffiliation.product.checkouts.map((checkout, index) => {
                          // Gerar link para cada checkout
                          let baseUrl = "https://zaplynx.com";
                          if (window.location.hostname === "localhost") baseUrl = window.location.origin;
                          const identifier = checkout.slug || checkout.id;
                          const link = `${baseUrl}/pay/${identifier}?aff=${selectedAffiliation.affiliate_id}`;
                          
                          return (
                            <div key={checkout.id} className="p-3 border rounded-lg bg-card space-y-2 hover:border-primary/50 transition-colors">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold uppercase text-primary">Checkout {selectedAffiliation.product.checkouts!.length > 1 ? index + 1 : ""}</span>
                                <Badge variant="outline" className="text-[10px]">Padrão</Badge>
                              </div>
                              <div className="flex gap-2">
                                <Input readOnly value={link} className="text-xs h-8" />
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(link)}>
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(link, '_blank')}>
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-3 border rounded-lg bg-card space-y-2">
                           <div className="text-xs font-bold uppercase text-primary">Checkout Principal</div>
                           <div className="flex gap-2">
                             <Input 
                               readOnly 
                               value={getAffiliateLink(selectedAffiliation.product, selectedAffiliation.affiliate_id)} 
                               className="text-xs h-8" 
                             />
                             <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(getAffiliateLink(selectedAffiliation.product, selectedAffiliation.affiliate_id))}>
                               <Copy className="w-4 h-4" />
                             </Button>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-2">Sobre o Produto</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedAffiliation.product.description || "Este produto não possui uma descrição detalhada cadastrada."}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
