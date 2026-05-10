import { useEffect, useState } from "react";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
 import { Building2, Mail, MapPin, Globe, Clock, LayoutGrid, RefreshCw, AlertCircle, ShoppingBag, Plus, Pencil, Trash2, ExternalLink, Eye, EyeOff } from "lucide-react";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

 interface Product {
   id: string;
   name: string;
   description: string;
   price: number;
   currency: string;
   retailerId?: string;
   url?: string;
   isHidden?: boolean;
   salePrice?: number;
   imageUrls?: {
     requested: string;
     original: string;
     thumbnail: string;
   };
 }
 
 interface BusinessProfile {
   description?: string;
   address?: string;
   email?: string;
   websites?: string[];
   categories?: { id: string; label: string }[];
   businessHours?: any;
 }

const PerfilEmpresa = () => {
  const { instances, loading: loadingInstances } = useZapiInstances();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
   const [profile, setProfile] = useState<BusinessProfile | null>(null);
   const [products, setProducts] = useState<Product[]>([]);
   const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [isExternalCatalog, setIsExternalCatalog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances, selectedInstanceId]);

   useEffect(() => {
     if (selectedInstanceId) {
       fetchProfile(selectedInstanceId);
       fetchProducts(selectedInstanceId);
     }
   }, [selectedInstanceId]);
    const fetchProducts = async (instanceId: string, phone?: string) => {
     setLoadingProducts(true);
     try {
       const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
          body: { 
            action: "list-products", 
            instanceDbId: instanceId,
            payload: phone ? { phone } : undefined
          },
       });
 
       if (error) throw error;
       if (data?.error) throw new Error(data.error?.message || data.error);
       
       setProducts(data?.data?.products || []);
        setIsExternalCatalog(!!phone);
     } catch (err: any) {
       console.error("Erro ao buscar produtos:", err);
       toast({
         title: "Erro ao carregar catálogo",
         description: err.message,
         variant: "destructive",
       });
     } finally {
       setLoadingProducts(false);
     }
   };
 
   const handleSaveProduct = async () => {
     if (!editingProduct?.name || !editingProduct?.price || !editingProduct?.currency) {
       toast({
         title: "Campos obrigatórios",
         description: "Nome, preço e moeda são obrigatórios.",
         variant: "destructive",
       });
       return;
     }
 
     setIsSaving(true);
     try {
       const action = editingProduct.id ? "edit-product" : "create-product";
       const payload = {
         ...editingProduct,
         // Z-API expects an array of image URLs
         images: typeof editingProduct.imageUrls === 'string' 
           ? [editingProduct.imageUrls] 
           : (editingProduct.imageUrls as any)?.requested 
             ? [(editingProduct.imageUrls as any).requested]
             : []
       };
 
       const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
         body: { action, instanceDbId: selectedInstanceId, payload },
       });
 
       if (error) throw error;
       if (data?.error) throw new Error(data.error?.message || data.error);
 
       toast({
         title: editingProduct.id ? "Produto atualizado" : "Produto criado",
         description: "As alterações foram salvas com sucesso.",
       });
 
       setIsDialogOpen(false);
       fetchProducts(selectedInstanceId);
     } catch (err: any) {
       console.error("Erro ao salvar produto:", err);
       toast({
         title: "Erro ao salvar",
         description: err.message,
         variant: "destructive",
       });
     } finally {
       setIsSaving(false);
     }
   };
 
   const handleDeleteProduct = async (productId: string) => {
     if (!confirm("Tem certeza que deseja excluir este produto?")) return;
 
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
         title: "Produto excluído",
         description: "O produto foi removido do catálogo.",
       });
 
       fetchProducts(selectedInstanceId);
     } catch (err: any) {
       console.error("Erro ao excluir produto:", err);
       toast({
         title: "Erro ao excluir",
         description: err.message,
         variant: "destructive",
       });
     }
   };

  const fetchProfile = async (instanceId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action: "business-profile", instanceDbId: instanceId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error?.message || data.error);
      
      setProfile(data?.data || null);
    } catch (err: any) {
      console.error("Erro ao buscar perfil:", err);
      toast({
        title: "Erro ao carregar perfil",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingInstances) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

   return (
     <div className="container mx-auto py-6 space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
           <h1 className="text-2xl font-bold text-foreground">Gestão Comercial</h1>
           <p className="text-muted-foreground">Gerencie o perfil e o catálogo de produtos da sua empresa no WhatsApp.</p>
         </div>
         
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                fetchProfile(selectedInstanceId);
                setSearchPhone("");
                fetchProducts(selectedInstanceId);
              }} 
              disabled={loading || loadingProducts || !selectedInstanceId}
            >
              <RefreshCw className={`w-4 h-4 ${loading || loadingProducts ? "animate-spin" : ""}`} />
            </Button>
            <div className="flex items-center gap-2 min-w-[200px]">
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
          </div>
        </div>
 
       <Tabs defaultValue="perfil" className="w-full">
         <TabsList className="grid w-full grid-cols-2 mb-8">
           <TabsTrigger value="perfil" className="flex items-center gap-2">
             <Building2 className="w-4 h-4" />
             Perfil de Negócios
           </TabsTrigger>
           <TabsTrigger value="catalogo" className="flex items-center gap-2">
             <ShoppingBag className="w-4 h-4" />
             Catálogo de Produtos
           </TabsTrigger>
         </TabsList>
 
         <TabsContent value="perfil" className="space-y-6">
           {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Skeleton className="h-48 w-full" />
               <Skeleton className="h-48 w-full" />
               <Skeleton className="h-48 w-full" />
               <Skeleton className="h-48 w-full" />
             </div>
           ) : profile ? (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações Básicas */}
           <Card className="border-border/50 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Sobre a Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <p className="text-sm leading-relaxed">{profile.description || "Sem descrição definida"}</p>
              </div>
              
              <div className="flex items-start gap-2 pt-2">
                <LayoutGrid className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Categorias</Label>
                  <div className="flex flex-wrap gap-1">
                    {profile.categories && profile.categories.length > 0 ? (
                      profile.categories.map((cat: any) => (
                        <Badge key={cat.id || cat.label} variant="secondary" className="text-[10px] font-medium uppercase tracking-wider">
                          {cat.label || cat.id}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm italic">Nenhuma categoria</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contato e Endereço */}
           <Card className="border-border/50 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Contato e Localização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-muted-foreground mt-1" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                  <p className="text-sm">{profile.email || "Não informado"}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Endereço</Label>
                  <p className="text-sm">{profile.address || "Não informado"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-muted-foreground mt-1" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Websites</Label>
                  {profile.websites && profile.websites.length > 0 ? (
                    <div className="space-y-1">
                      {profile.websites.map((url, idx) => (
                        <a 
                          key={idx} 
                          href={url.startsWith('http') ? url : `https://${url}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline block break-all"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm">Não informado</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horários */}
           <Card className="md:col-span-2 border-border/50 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Horário de Funcionamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.businessHours ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Simplified display for now as businessHours structure can vary */}
                  <div className="col-span-full">
                    <p className="text-sm font-medium">
                      {profile.businessHours.mode === 'open24h' ? 'Aberto 24 horas' : 
                       profile.businessHours.mode === 'appointmentOnly' ? 'Apenas com hora marcada' : 
                       'Horário específico'}
                    </p>
                  </div>
                   {profile.businessHours.days && profile.businessHours.days.map((day: any) => (
                     <div key={day.dayOfWeek} className="p-3 rounded-xl bg-secondary/20 border border-border/40 hover:border-primary/30 transition-colors">
                       <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest mb-1">{day.dayOfWeek}</p>
                       <p className="text-sm font-mono text-foreground/90">{day.openTime} - {day.closeTime}</p>
                     </div>
                   ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">Nenhum horário configurado</p>
                </div>
              )}
            </CardContent>
          </Card>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center py-20 text-center">
               <AlertCircle className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
               <h2 className="text-xl font-semibold mb-1">Nenhum dado encontrado</h2>
               <p className="text-muted-foreground max-w-xs">Não foi possível carregar as informações desta instância.</p>
             </div>
           )}
         </TabsContent>
 
         <TabsContent value="catalogo" className="space-y-6">
           <div className="flex items-center justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  {isExternalCatalog ? "Catálogo Externo" : "Seu Catálogo"} ({products.length})
                </h2>
                {isExternalCatalog && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Visualizando produtos do número: {searchPhone}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-muted/50 rounded-lg px-2 py-1 border border-border/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
                  <Input 
                    placeholder="Buscar por telefone..." 
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value.replace(/\D/g, ''))}
                    className="border-0 bg-transparent h-8 w-40 focus-visible:ring-0 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchPhone) fetchProducts(selectedInstanceId, searchPhone);
                    }}
                  />
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 px-2 text-xs"
                    onClick={() => fetchProducts(selectedInstanceId, searchPhone)}
                    disabled={!searchPhone || loadingProducts}
                  >
                    Buscar
                  </Button>
                </div>

                {!isExternalCatalog && (
                  <Button onClick={() => {
                    setEditingProduct({ currency: 'BRL', isHidden: false });
                    setIsDialogOpen(true);
                  }} className="gap-2 h-9 text-xs">
                    <Plus className="w-4 h-4" />
                    Novo Produto
                  </Button>
                )}
              </div>
            </div>
           </div>
 
           {loadingProducts ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {[1, 2, 3, 4].map((i) => (
                 <Skeleton key={i} className="h-64 w-full rounded-xl" />
               ))}
             </div>
           ) : products.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
               {products.map((product) => (
                 <Card key={product.id} className="overflow-hidden border-border/50 bg-card/40 backdrop-blur-sm flex flex-col group hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 transition-all duration-500">
                   <div className="aspect-square bg-muted relative overflow-hidden">
                     {product.imageUrls?.thumbnail ? (
                       <img 
                         src={product.imageUrls.thumbnail} 
                         alt={product.name}
                         className="w-full h-full object-cover transition-transform group-hover:scale-105"
                       />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                         <ShoppingBag className="w-12 h-12 opacity-20" />
                       </div>
                     )}
                     {product.isHidden && (
                       <Badge variant="secondary" className="absolute top-2 right-2 gap-1 backdrop-blur-md bg-background/50">
                         <EyeOff className="w-3 h-3" />
                         Oculto
                       </Badge>
                     )}
                   </div>
                   <CardContent className="p-4 flex-grow space-y-2">
                     <div className="flex items-start justify-between gap-2">
                       <h3 className="font-semibold text-sm line-clamp-2 leading-tight">{product.name}</h3>
                       <Badge variant="secondary" className="shrink-0 font-mono bg-primary/10 text-primary border-primary/20">
                         {product.currency} {product.price}
                       </Badge>
                     </div>
                     <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                       {product.description || "Sem descrição"}
                     </p>
                   </CardContent>
                    <div className="p-4 pt-0 flex items-center justify-between gap-2 mt-auto">
                      {!isExternalCatalog ? (
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-8 h-8"
                            onClick={() => {
                              setEditingProduct(product);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-8 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-grow" />
                      )}
                     {product.url && (
                       <Button variant="outline" size="sm" asChild className="h-8 text-[10px]">
                         <a href={product.url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                           <ExternalLink className="w-3 h-3" />
                           Ver Site
                         </a>
                       </Button>
                     )}
                   </div>
                 </Card>
               ))}
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-xl">
               <ShoppingBag className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
               <h3 className="text-lg font-semibold mb-1">Nenhum produto</h3>
               <p className="text-muted-foreground max-w-xs mb-6">
                 Você ainda não tem produtos cadastrados no seu catálogo do WhatsApp.
               </p>
               <Button onClick={() => {
                 setEditingProduct({ currency: 'BRL', isHidden: false });
                 setIsDialogOpen(true);
               }} variant="outline">
                 Criar Primeiro Produto
               </Button>
             </div>
           )}
         </TabsContent>
       </Tabs>
 
       {/* Dialog para Criar/Editar Produto */}
       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
         <DialogContent className="sm:max-w-[500px]">
           <DialogHeader>
             <DialogTitle>{editingProduct?.id ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
             <DialogDescription>
               Preencha os dados do produto para o catálogo do WhatsApp.
             </DialogDescription>
           </DialogHeader>
           
           <div className="grid gap-4 py-4">
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="name" className="text-right">Nome*</Label>
               <Input 
                 id="name" 
                 value={editingProduct?.name || ''} 
                 onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                 className="col-span-3" 
               />
             </div>
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="price" className="text-right">Preço*</Label>
               <div className="flex items-center gap-2 col-span-3">
                 <Input 
                   id="currency" 
                   value={editingProduct?.currency || 'BRL'} 
                   onChange={(e) => setEditingProduct(prev => ({ ...prev, currency: e.target.value }))}
                   className="w-20" 
                   placeholder="BRL"
                 />
                 <Input 
                   id="price" 
                   type="number"
                   value={editingProduct?.price || ''} 
                   onChange={(e) => setEditingProduct(prev => ({ ...prev, price: Number(e.target.value) }))}
                   className="flex-grow" 
                 />
               </div>
             </div>
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="salePrice" className="text-right">Promocional</Label>
               <Input 
                 id="salePrice" 
                 type="number"
                 value={editingProduct?.salePrice || ''} 
                 onChange={(e) => setEditingProduct(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
                 className="col-span-3" 
                 placeholder="Opcional"
               />
             </div>
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="description" className="text-right">Descrição</Label>
               <Textarea 
                 id="description" 
                 value={editingProduct?.description || ''} 
                 onChange={(e) => setEditingProduct(prev => ({ ...prev, description: e.target.value }))}
                 className="col-span-3" 
               />
             </div>
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="imageUrl" className="text-right">Imagem (URL)</Label>
               <Input 
                 id="imageUrl" 
                 value={typeof editingProduct?.imageUrls === 'string' ? editingProduct.imageUrls : (editingProduct?.imageUrls as any)?.requested || ''} 
                 onChange={(e) => setEditingProduct(prev => ({ ...prev, imageUrls: e.target.value as any }))}
                 className="col-span-3" 
                 placeholder="https://exemplo.com/foto.jpg"
               />
             </div>
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="retailerId" className="text-right">SKU/ID</Label>
               <Input 
                 id="retailerId" 
                 value={editingProduct?.retailerId || ''} 
                 onChange={(e) => setEditingProduct(prev => ({ ...prev, retailerId: e.target.value }))}
                 className="col-span-3" 
                 placeholder="Ex: PROD-001"
               />
             </div>
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="url" className="text-right">Link Externo</Label>
               <Input 
                 id="url" 
                 value={editingProduct?.url || ''} 
                 onChange={(e) => setEditingProduct(prev => ({ ...prev, url: e.target.value }))}
                 className="col-span-3" 
                 placeholder="https://sualoja.com/produto"
               />
             </div>
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="isHidden" className="text-right">Oculto</Label>
               <div className="col-span-3 flex items-center gap-2">
                 <Switch 
                   id="isHidden" 
                   checked={editingProduct?.isHidden || false}
                   onCheckedChange={(checked) => setEditingProduct(prev => ({ ...prev, isHidden: checked }))}
                 />
                 <span className="text-xs text-muted-foreground">Ocultar produto no catálogo</span>
               </div>
             </div>
           </div>
 
           <DialogFooter>
             <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
               Cancelar
             </Button>
             <Button onClick={handleSaveProduct} disabled={isSaving} className="gap-2">
               {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
               Salvar Alterações
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 };
 
 export default PerfilEmpresa;