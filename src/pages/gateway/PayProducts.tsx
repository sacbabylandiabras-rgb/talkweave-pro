import { useState } from "react";
import { Plus, Search, Edit, Trash2, ShoppingCart, Package, Repeat, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockProducts, formatCurrency } from "./mock-data";
import { toast } from "sonner";

const typeConfig = {
  digital: { label: "Digital", icon: Package, color: "text-blue-400 bg-blue-500/10" },
  physical: { label: "Físico", icon: ShoppingCart, color: "text-emerald-400 bg-emerald-500/10" },
  subscription: { label: "Assinatura", icon: Repeat, color: "text-purple-400 bg-purple-500/10" },
  service: { label: "Serviço", icon: Briefcase, color: "text-amber-400 bg-amber-500/10" },
};

export default function PayProducts() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState(mockProducts);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus produtos e serviços</p>
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
              <div><Label>Nome</Label><Input placeholder="Nome do produto" /></div>
              <div><Label>Descrição</Label><Textarea placeholder="Descrição" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Tipo</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="digital">Digital</SelectItem>
                      <SelectItem value="physical">Físico</SelectItem>
                      <SelectItem value="subscription">Assinatura</SelectItem>
                      <SelectItem value="service">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Preço (R$)</Label><Input placeholder="0,00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>SKU</Label><Input placeholder="SKU-001" /></div>
                <div><Label>Categoria</Label><Input placeholder="Categoria" /></div>
              </div>
              <Button className="w-full bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full" onClick={() => { setDialogOpen(false); toast.success("Produto criado!"); }}>Salvar Produto</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar produtos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const tc = typeConfig[p.type];
          return (
            <Card key={p.id} className="border-[#2A2A2A] hover:border-[#FF4D2E]/30 transition-colors">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <tc.icon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <Switch checked={p.status} onCheckedChange={(v) => setProducts(prev => prev.map(x => x.id === p.id ? {...x, status: v} : x))} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">{formatCurrency(p.price)}</span>
                  <Badge variant="outline" className={`text-[10px] ${tc.color} border-0`}>{tc.label}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs"><Edit className="w-3 h-3 mr-1" /> Editar</Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs text-[#FF4D2E]"><ShoppingCart className="w-3 h-3 mr-1" /> Checkout</Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
