import { ShoppingBag, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function PayMarketplace() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Marketplace
          </h1>
          <p className="text-muted-foreground">
            Descubra produtos de alta conversão para se afiliar.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produtos..." className="pl-10" />
        </div>
        <Button>Filtrar</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="overflow-hidden">
          <div className="aspect-video bg-muted flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/20" />
          </div>
          <CardHeader>
            <CardTitle>Produto Exemplo</CardTitle>
            <CardDescription>Categoria: Digital</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold">R$ 97,00</span>
              <span className="text-sm text-emerald-500 font-medium">60% de comissão</span>
            </div>
            <Button className="w-full">Afiliar-se agora</Button>
          </CardContent>
        </Card>
        
        {/* Placeholder cards */}
        {[1, 2].map((i) => (
          <Card key={i} className="overflow-hidden opacity-50">
            <div className="aspect-video bg-muted flex items-center justify-center">
              <ShoppingBag className="w-12 h-12 text-muted-foreground/20" />
            </div>
            <CardHeader>
              <CardTitle>Em breve...</CardTitle>
              <CardDescription>Novas oportunidades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-20 flex items-center justify-center border-2 border-dashed rounded-lg">
                <span className="text-muted-foreground text-sm">Carregando novos produtos</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
