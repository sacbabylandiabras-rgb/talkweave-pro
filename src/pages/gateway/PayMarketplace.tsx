import { useState, useEffect } from "react";
import { ShoppingBag, Search, Loader2, Star, BadgePercent, TrendingUp } from "lucide-react";
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
  user_id: string;
}

export default function PayMarketplace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchMarketplaceProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("gateway_products" as any)
        .select("*")
        .eq("affiliate_enabled", true)
        .eq("status", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data as any[] || []);
    } catch (error: any) {
      console.error("Error fetching marketplace:", error);
      toast.error("Erro ao carregar o marketplace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketplaceProducts();
  }, []);

  const handleAffiliate = async (productId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para se afiliar");
        return;
      }

      const { error } = await supabase
        .from("gateway_affiliates" as any)
        .insert({
          product_id: productId,
          affiliate_id: user.id
        });

      if (error) {
        if (error.code === "23505") {
          toast.info("Você já é afiliado deste produto");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Afiliação realizada com sucesso!");
    } catch (error: any) {
      console.error("Error affiliating:", error);
      toast.error("Erro ao realizar afiliação");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Marketplace
          </h1>
          <p className="text-muted-foreground">
            Descubra produtos de alta conversão para se afiliar e lucrar.
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
        <Button variant="outline">Filtrar</Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando oportunidades...</p>
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden group hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
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
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Comissão</span>
                    <div className="flex items-center gap-1 text-emerald-500 font-bold">
                      <BadgePercent className="w-4 h-4" />
                      <span>{product.commission_rate}%</span>
                    </div>
                  </div>
                </div>
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                  onClick={() => handleAffiliate(product.id)}
                >
                  Afiliar-se agora
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Nenhum produto encontrado</h3>
          <p className="text-muted-foreground">Tente ajustar sua busca ou volte mais tarde.</p>
        </div>
      )}
    </div>
  );
}
