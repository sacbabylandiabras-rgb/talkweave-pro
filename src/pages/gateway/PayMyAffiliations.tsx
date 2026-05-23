import { useState, useEffect } from "react";
import { ShoppingBag, Search, Loader2, Link2, ExternalLink, BadgePercent, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  checkouts?: { id: string; slug: string | null }[];
}

interface Affiliation {
  id: string;
  product_id: string;
  affiliate_id: string;
  created_at: string;
  product: Product;
}

export default function PayMyAffiliations() {
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
          created_at,
          product:gateway_products (
            *,
            checkouts:gateway_checkouts (id, slug)
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

  const getAffiliateLink = (productId: string, affiliateId: string) => {
    let baseUrl = window.location.origin;
    
    // Se estiver no preview do Lovable, tenta usar o domínio de produção
    if (baseUrl.includes("lovable.app") && (baseUrl.includes("preview") || baseUrl.includes("id-"))) {
      baseUrl = "https://talkweave-pro.lovable.app";
    }
    
    return `${baseUrl}/checkout/${productId}?aff=${affiliateId}`;
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
            
            const affiliateLink = getAffiliateLink(product.id, aff.affiliate_id);

            return (
              <Card key={aff.id} className="overflow-hidden group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
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
                  <div className="absolute top-2 right-2">
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
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Preço</span>
                      <span className="text-xl font-bold">{formatCurrency(product.price)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Sua Comissão</span>
                      <div className="flex items-center gap-1 text-emerald-500 font-bold">
                        <BadgePercent className="w-4 h-4" />
                        <span>{product.commission_rate}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase">Seu link de afiliado:</div>
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
                        <Link2 className="w-4 h-4" />
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
    </div>
  );
}
