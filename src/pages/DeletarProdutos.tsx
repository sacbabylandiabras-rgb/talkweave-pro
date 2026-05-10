import { useState, useEffect } from "react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, AlertTriangle, Search, ShoppingBag, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
}

const DeletarProdutos = () => {
  const { instances, loading: loadingInstances } = useZapiInstances();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances, selectedInstanceId]);

  useEffect(() => {
    if (selectedInstanceId) {
      fetchProducts();
    }
  }, [selectedInstanceId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { 
          action: "list-products", 
          instanceDbId: selectedInstanceId 
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error?.message || data.error);
      
      setProducts(data?.data?.products || []);
    } catch (err: any) {
      toast({
        title: "Erro ao buscar produtos",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    setDeletingId(productId);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { 
          action: "delete-product", 
          instanceDbId: selectedInstanceId, 
          payload: { id: productId } 
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error?.message || data.error);

      toast({
        title: "Produto removido",
        description: "O produto foi excluído com sucesso do catálogo.",
      });

      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (err: any) {
      toast({
        title: "Erro ao excluir",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.includes(searchTerm)
  );

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Remover Produtos</h1>
        <p className="text-muted-foreground">Selecione uma instância e exclua produtos do seu catálogo do WhatsApp.</p>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Configuração
          </CardTitle>
          <CardDescription>Escolha a instância do Z-API para gerenciar os produtos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Instância Z-API</Label>
            <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.instance_name || inst.zapi_instance_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou ID..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
           <Button variant="ghost" size="sm" onClick={fetchProducts} disabled={loading || !selectedInstanceId}>
             <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
             Atualizar Lista
           </Button>
        </CardFooter>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Carregando produtos...</div>
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <Card key={product.id} className="border-border/50 bg-card/40 backdrop-blur-sm hover:border-primary/20 transition-all">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-medium text-sm leading-none">{product.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">ID: {product.id}</span>
                    <span>•</span>
                    <Badge variant="secondary" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
                      {product.currency} {(Number(product.price || 0) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Badge>
                  </div>
                </div>
                
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="shrink-0"
                  onClick={() => {
                    if (confirm(`Deseja realmente excluir o produto "${product.name}"?`)) {
                      handleDelete(product.id);
                    }
                  }}
                  disabled={deletingId === product.id}
                >
                  {deletingId === product.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-12 text-center border-2 border-dashed border-border/50 rounded-xl">
            <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium">Nenhum produto encontrado</h3>
            <p className="text-sm text-muted-foreground">Selecione uma instância ou altere sua busca.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeletarProdutos;
