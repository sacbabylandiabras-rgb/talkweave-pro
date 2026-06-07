import { useEffect, useState, useMemo } from "react";
import { useZapiInstances, isMobileZapiInstance, type ZapiInstance } from "@/hooks/useZapiInstances";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Mail, MapPin, Globe, Clock, LayoutGrid, RefreshCw, AlertCircle, ShoppingBag, Plus, Pencil, Trash2, ExternalLink, EyeOff, Search, AlertTriangle, Tag, Palette, MessageSquare, Workflow, Check, Settings, Save, User, Package, PlusCircle, Smartphone, Edit2, Loader2, Upload, Image as ImageIcon, RotateCcw, PowerOff, Send } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface WhatsappTag {
  id: string;
  name: string;
  color: number;
}

interface TagColor {
  id: number;
  hex: string;
  label: string;
}

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
  imageUrls?: string | {
    requested: string;
    original: string;
    thumbnail: string;
  };
  images?: Array<string | { url?: string; requested?: string; original?: string; thumbnail?: string }>;
}

interface BusinessProfile {
  description?: string;
  address?: string;
  email?: string;
  websites?: string[];
  categories?: { id: string; label: string }[];
  businessHours?: any;
  catalogConfig?: {
    isCartEnabled: boolean;
    isCatalogVisible: boolean;
    catalogId?: string;
  };
  catalogId?: string;
  profileName?: string | null;
  profilePicUrl?: string | null;
  owner?: string | null;
  status?: string | null;
  isBusiness?: boolean | null;
}

const formatErrorMessage = (value: unknown, fallback = "Não foi possível concluir a operação."): string => {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message || fallback;
  if (Array.isArray(value)) return value.map((item) => formatErrorMessage(item, "")).filter(Boolean).join(" | ") || fallback;

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nested = obj.message || obj.error || obj.details || obj.description;
    if (nested && nested !== value) return formatErrorMessage(nested, fallback);

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  return String(value);
};

const getProductImageUrl = (product?: Partial<Product> | null): string => {
  if (!product) return "";
  if (typeof product.imageUrls === "string") return product.imageUrls;
  const imageUrls = product.imageUrls;
  const firstImage = Array.isArray(product.images) ? product.images[0] : undefined;

  if (typeof firstImage === "string") return firstImage;
  if (firstImage && typeof firstImage === "object") {
    return firstImage.thumbnail || firstImage.url || firstImage.requested || firstImage.original || "";
  }

  return typeof imageUrls === "object" ? imageUrls.thumbnail || imageUrls.requested || imageUrls.original || "" : "";
};

 const PerfilEmpresa = () => {
   const { instances: allInstances, loading: loadingInstances } = useZapiInstances();
   
   const instances = useMemo(() => {
     return allInstances.filter((i: any) => {
       const provider = String(i.api_provider || 'zapi').toLowerCase();
       if (provider === 'meta') return false;
       if (provider.includes('warmup')) return false;
       return !isMobileZapiInstance(i);
     });
   }, [allInstances]);
 
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get("tab") || "perfil";
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [isExternalCatalog, setIsExternalCatalog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [catalogConfig, setCatalogConfig] = useState({ isCartEnabled: true, isCatalogVisible: true });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Added dialog states moved from Dispositivos
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [businessDialogOpen, setBusinessDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);

  const { toast } = useToast();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user?.id || 'anon'}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      
      // Also get base64 for Z-API because it's more reliable than Supabase public URLs for their crawler
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImageBase64(base64);
        setEditingProduct(prev => ({ ...prev, imageUrls: base64 }));
      };
      reader.readAsDataURL(file);

      toast({ title: "Imagem enviada", description: "A imagem foi carregada com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err?.message || "Não foi possível enviar a imagem.", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

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


  const fetchProducts = async (instanceId: string, phone?: string, cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoadingProducts(true);

    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { 
          action: "list-products", 
          instanceDbId: instanceId,
          payload: phone ? { phone } : { nextCursor: cursor }
        },
      });

      if (error) throw error;
      if (data?.error) {
        const msg = typeof data.error === 'string'
          ? data.error
          : (data.error?.message || data.error?.error || JSON.stringify(data.error));
        throw new Error(msg);
      }
      
      if (cursor) {
        setProducts(prev => [...prev, ...(data?.data?.products || [])]);
      } else {
        setProducts(data?.data?.products || []);
      }
      
      setNextCursor(data?.data?.nextCursor || null);
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
      setLoadingMore(false);
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
      const { imageUrls: _, images: __, ...rest } = editingProduct as any;
      
      const payload: any = {
        ...rest,
        // Reverting to raw price as user reported "100" gives wrong value with *1000
        price: Number(editingProduct.price || 0),
      };

      // Handle images: prioritize new base64 upload, then fallback to existing URL
      if (imageBase64) {
        payload.images = [imageBase64];
      } else {
        const currentUrl = getProductImageUrl(editingProduct as Product);
        if (currentUrl && (currentUrl.startsWith('http') || currentUrl.startsWith('data:image'))) {
          payload.images = [currentUrl];
        }
      }

      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action, instanceDbId: selectedInstanceId, payload },
      });

      if (error) throw new Error(formatErrorMessage(error));
      if (data?.error) throw new Error(formatErrorMessage(data.error));

      toast({
        title: editingProduct.id ? "Produto atualizado" : "Produto criado",
        description: "As alterações foram salvas com sucesso.",
      });

      setIsDialogOpen(false);
      setImageBase64(null);
      fetchProducts(selectedInstanceId);
    } catch (err: any) {
      console.error("Erro ao salvar produto:", err);
      toast({
        title: "Erro ao salvar",
        description: formatErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName?: string) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${productName || 'este produto'}"?`)) return;
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
        title: "Produto excluído",
        description: "O produto foi removido do catálogo.",
      });

      fetchProducts(selectedInstanceId, isExternalCatalog ? searchPhone : undefined);
    } catch (err: any) {
      console.error("Erro ao excluir produto:", err);
      toast({
        title: "Erro ao excluir",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
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
      
      const profileData = data?.data || null;
      setProfile(profileData);
      
      if (profileData?.catalogConfig) {
        setCatalogConfig({
          isCartEnabled: profileData.catalogConfig.isCartEnabled ?? true,
          isCatalogVisible: profileData.catalogConfig.isCatalogVisible ?? true
        });
      }
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

  const handleSaveCatalogConfig = async () => {
    if (!selectedInstanceId) return;
    
    setIsSavingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { 
          action: "save-catalog-config", 
          instanceDbId: selectedInstanceId,
          payload: catalogConfig 
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(formatErrorMessage(data.error));

      toast({
        title: "Configuração salva",
        description: "As configurações do catálogo foram atualizadas com sucesso.",
      });
    } catch (err: any) {
      console.error("Erro ao salvar configuração do catálogo:", err);
      toast({
        title: "Erro ao salvar",
        description: formatErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  if (loadingInstances) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="container mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão Comercial</h1>
          <p className="text-muted-foreground">Gerencie o perfil e o catálogo de produtos no WhatsApp.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setProfileDialogOpen(true)} className="h-9 text-xs">
              <User className="w-4 h-4 mr-1" />
              Perfil WhatsApp
            </Button>
          )}
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setCollectionDialogOpen(true)} className="h-9 text-xs">
              <LayoutGrid className="w-4 h-4 mr-1" />
              Criar Coleção
            </Button>
          )}
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setProductDialogOpen(true)} className="h-9 text-xs">
              <Package className="w-4 h-4 mr-1" />
              Criar Produto
            </Button>
          )}
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setBusinessDialogOpen(true)} className="h-9 text-xs">
              <Building2 className="w-4 h-4 mr-1" />
              Perfil da Empresa
            </Button>
          )}
          
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

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          if (v === "perfil") next.delete("tab"); else next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="perfil" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Perfil de Negócios
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Catálogo de Produtos
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="remover" className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Remover Produtos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : profile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-border/50 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    Sobre a Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(profile.profilePicUrl || profile.profileName || profile.owner) && (
                    <div className="flex items-center gap-3 pb-3 border-b border-border/40">
                      {profile.profilePicUrl ? (
                        <img
                          src={profile.profilePicUrl}
                          alt={profile.profileName || 'Perfil'}
                          className="w-14 h-14 rounded-full object-cover border border-border/50"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border border-border/50">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{profile.profileName || 'Conexão ativa'}</p>
                        {profile.owner && (
                          <p className="text-xs text-muted-foreground font-mono">+{String(profile.owner).replace(/\D/g, '')}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Descrição</Label>
                      <p className="text-sm leading-relaxed">{profile.description || "Sem descrição definida"}</p>
                    </div>
                    
                    {(profile.catalogId || profile.catalogConfig?.catalogId) && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">ID do Catálogo</Label>
                        <code className="text-xs bg-muted/50 px-2 py-1 rounded block select-all w-fit">
                          {profile.catalogId || profile.catalogConfig?.catalogId}
                        </code>
                      </div>
                    )}
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
                            <a key={idx} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block break-all">
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalogo" className="space-y-6">
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

          {loadingProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64 w-full rounded-xl" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <Card key={product.id} className="overflow-hidden border-border/50 bg-card/40 backdrop-blur-sm flex flex-col group hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 transition-all duration-500">
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {getProductImageUrl(product) ? (
                        <img 
                          src={getProductImageUrl(product)} 
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
                          {product.currency} {(() => {
                            const price = Number(product.price || 0);
                            // Standard Z-API response uses 1/1000 format
                            return (price > 10000 ? price / 1000 : price).toLocaleString('pt-BR', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            });
                          })()}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {product.description || "Sem descrição"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono bg-muted/30 px-1.5 py-0.5 rounded w-fit select-all hover:bg-muted/50 transition-colors">
                          ID: {product.id}
                        </p>
                      </div>
            {editingProduct?.id && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">ID</Label>
                <div className="col-span-3">
                  <code className="text-xs bg-muted p-2 rounded block select-all">{editingProduct.id}</code>
                </div>
              </div>
            )}
                    </CardContent>
                    <div className="p-4 pt-0 flex items-center justify-between gap-2 mt-auto">
                      {!isExternalCatalog ? (
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-8 h-8"
                            onClick={() => {
                              const rawPrice = Number(product.price || 0);
                              // If price looks like it's in 1/1000 format (e.g. 100000 for 100.00), normalize it
                              const price = rawPrice > 10000 ? rawPrice / 1000 : rawPrice;
                              setEditingProduct({ ...product, price });
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
                      ) : <div />}
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
              {nextCursor && (
                <div className="flex justify-center pt-8">
                  <Button variant="outline" onClick={() => fetchProducts(selectedInstanceId, isExternalCatalog ? searchPhone : undefined, nextCursor)} disabled={loadingMore}>
                    {loadingMore ? <RefreshCw className="animate-spin mr-2" /> : <Plus className="mr-2" />}
                    Carregar mais
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-xl">
              <ShoppingBag className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-semibold mb-1">Nenhum produto</h3>
            </div>
          )}
        </TabsContent>

        <TabsContent value="configuracao" className="space-y-6">
          <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Configurações do Catálogo
              </CardTitle>
              <CardDescription>
                Controle a visibilidade do seu catálogo e a funcionalidade do carrinho.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Carrinho de Compras</Label>
                  <p className="text-xs text-muted-foreground">
                    Permite que os clientes adicionem múltiplos itens ao carrinho antes de enviar o pedido.
                  </p>
                </div>
                <Switch 
                  checked={catalogConfig.isCartEnabled} 
                  onCheckedChange={(checked) => setCatalogConfig(prev => ({ ...prev, isCartEnabled: checked }))} 
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-background/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Visibilidade do Catálogo</Label>
                  <p className="text-xs text-muted-foreground">
                    Define se o catálogo estará visível para os seus contatos no WhatsApp.
                  </p>
                </div>
                <Switch 
                  checked={catalogConfig.isCatalogVisible} 
                  onCheckedChange={(checked) => setCatalogConfig(prev => ({ ...prev, isCatalogVisible: checked }))} 
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  onClick={handleSaveCatalogConfig} 
                  disabled={isSavingConfig || !selectedInstanceId}
                  className="gap-2"
                >
                  {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remover" className="space-y-6">
          <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" />
                Remover Produtos em Massa
              </CardTitle>
              <CardDescription>
                Busque e remova produtos rapidamente do catálogo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Filtrar produtos carregados por nome ou ID..." 
                  className="pl-10"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {loadingProducts ? (
                  <div className="py-12 text-center text-muted-foreground">Carregando produtos...</div>
                ) : products.length > 0 ? (
                  products
                    .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.id.includes(productSearchTerm))
                    .map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30 hover:bg-background/50 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{product.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {product.id}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteProduct(product.id, product.name)}
                          disabled={deletingId === product.id}
                        >
                          {deletingId === product.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    ))
                ) : (
                  <div className="py-8 text-center border-2 border-dashed border-border/50 rounded-lg">
                    <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-muted-foreground">Nenhum produto carregado.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setImageBase64(null);
            setEditingProduct(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingProduct?.id ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Nome*</Label>
              <Input id="name" value={editingProduct?.name || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">Preço*</Label>
              <div className="flex items-center gap-2 col-span-3">
                <Input value={editingProduct?.currency || 'BRL'} onChange={(e) => setEditingProduct(prev => ({ ...prev, currency: e.target.value }))} className="w-20" />
                <Input type="number" value={editingProduct?.price || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev, price: Number(e.target.value) }))} className="flex-grow" />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Descrição</Label>
              <Textarea id="description" value={editingProduct?.description || ''} onChange={(e) => setEditingProduct(prev => ({ ...prev, description: e.target.value }))} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imageUrl" className="text-right">Imagem URL</Label>
              <div className="col-span-3 flex flex-col gap-2">
                <Input
                  value={getProductImageUrl(editingProduct)}
                  onChange={(e) => setEditingProduct(prev => ({ ...prev, imageUrls: e.target.value as any }))}
                  placeholder="https://..."
                />
                <div className="flex items-center gap-2">
                  <Input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    disabled={isUploadingImage}
                    onChange={handleImageUpload}
                    className="flex-grow"
                  />
                  {isUploadingImage && <span className="text-xs text-muted-foreground">Enviando...</span>}
                </div>
                {getProductImageUrl(editingProduct) && (
                  <img
                    src={getProductImageUrl(editingProduct)}
                    alt="Pré-visualização"
                    className="h-20 w-20 rounded-md object-cover border border-border"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isHidden" className="text-right">Oculto</Label>
              <Switch checked={editingProduct?.isHidden || false} onCheckedChange={(checked) => setEditingProduct(prev => ({ ...prev, isHidden: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSaveProduct} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      <BulkProfileUpdate instances={instances} open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
      <BulkCreateCollection instances={instances} open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen} />
      <BulkCreateProduct instances={instances} open={productDialogOpen} onOpenChange={setProductDialogOpen} />
      <BulkBusinessInfo instances={instances} open={businessDialogOpen} onOpenChange={setBusinessDialogOpen} />
    </>
  );
};

// Moving helper components and bulk update components from Dispositivos to PerfilEmpresa

const sanitizeConnectionMessage = (message: unknown, fallback: string) => {
  const text = typeof message === 'string' && message.trim() ? message.trim() : fallback;
  const lower = text.toLowerCase();

  if (lower.includes('client-token') || lower.includes('not allowed') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return 'Credenciais da conexão inválidas. Atualize o ID da instância, token e token de segurança em Dispositivos.';
  }

  if (lower.includes('whatsapp is not responding') || lower.includes('not responding')) {
    return 'WhatsApp não respondeu agora. Aguarde alguns instantes e tente gerar novamente.';
  }

  return text
    .replace(/z-api|meta cloud|woovi|hubpague|cartwave/gi, 'provedor de conexão')
    .replace(/client-token\s+[\w-]+/gi, 'token de segurança');
};

const getInvokeErrorMessage = async (error: unknown, fallback: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      return sanitizeConnectionMessage(payload?.details?.error || payload?.message || payload?.error, fallback);
    } catch {
      return fallback;
    }
  }

  if (error instanceof Error) {
    return sanitizeConnectionMessage(error.message, fallback);
  }

  return fallback;
};

const DEVICE_PROFILE_PICTURE_UPDATED_EVENT = "device-profile-picture-updated";

const BulkProfileUpdate = ({ instances, open, onOpenChange }: { instances: ZapiInstance[]; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { toast } = useToast();
  const [profileName, setProfileName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [updating, setUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCheckingStatus(true);
    setStatusMap({});
    setSelectedIds(instances.map((i) => i.id));

    (async () => {
      const entries = await Promise.all(
        instances.map(async (inst) => {
          try {
            const { data } = await supabase.functions.invoke('get-device-status', {
              body: { instanceId: inst.id },
            });
            const connected = Boolean(data?.data?.connected ?? data?.connected);
            return [inst.id, connected] as const;
          } catch {
            return [inst.id, false] as const;
          }
        }),
      );
      if (cancelled) return;
      const map = Object.fromEntries(entries);
      setStatusMap(map);
      const connectedIds = instances.filter((i) => map[i.id]).map((i) => i.id);
      if (connectedIds.length > 0) {
        setSelectedIds(connectedIds);
      }
      setCheckingStatus(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, instances]);

  const targetInstances = instances.filter((i) => selectedIds.includes(i.id));
  const allSelected = selectedIds.length === instances.length && instances.length > 0;
  const toggleAll = () => setSelectedIds(allSelected ? [] : instances.map((i) => i.id));
  const toggleOne = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const updateAllInstances = async (type: "name" | "picture", value: string) => {
    if (targetInstances.length === 0) {
      toast({ title: "Selecione ao menos uma instância", variant: "destructive" });
      return;
    }
    setUpdating(true);
    let success = 0;
    let failed = 0;
    const updatedInstanceIds: string[] = [];
    const errors: string[] = [];

    for (const inst of targetInstances) {
      try {
        const { data, error } = await supabase.functions.invoke("update-profile", {
          body: {
            type,
            value,
            instanceId: inst.zapi_instance_id,
            token: inst.zapi_token,
            clientToken: inst.zapi_client_token,
            provider: inst.api_provider,
            apiUrl: inst.evolution_api_url,
            apiKey: inst.evolution_api_key,
          },
        });
        if (error) {
          failed++;
          continue;
        }
        if (data?.skipped || data?.fallback || data?.error) {
          failed++;
          continue;
        }
        success++;
        updatedInstanceIds.push(inst.id);
      } catch (err) {
        failed++;
      }
    }

    setUpdating(false);
    toast({ title: success > 0 ? "✅ Perfil atualizado" : "❌ Erro", description: `${success} atualizadas, ${failed} falharam.` });

    if (type === "picture" && success > 0) {
      window.dispatchEvent(new CustomEvent(DEVICE_PROFILE_PICTURE_UPDATED_EVENT, { detail: { value, instanceIds: updatedInstanceIds } }));
    }
  };

  const handleUpdateName = () => {
    if (!profileName.trim()) return;
    updateAllInstances("name", profileName.trim()).then(() => setProfileName(""));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdatePicture = async () => {
    if (previewUrl) {
      await updateAllInstances("picture", previewUrl);
      setImageFile(null);
      setPreviewUrl("");
      setImageUrl("");
    } else if (imageUrl.trim()) {
      await updateAllInstances("picture", imageUrl.trim());
      setImageUrl("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Atualizar Perfil WhatsApp em Massa</DialogTitle>
          <DialogDescription>Mude o nome ou foto de perfil de todas as instâncias selecionadas de uma vez.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Instâncias ({selectedIds.length}/{instances.length})</Label>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll} disabled={updating}>
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted/20">
              {instances.map((inst) => (
                <label key={inst.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedIds.includes(inst.id)} onChange={() => toggleOne(inst.id)} disabled={updating} className="accent-primary" />
                  <span className="flex-1 truncate">{inst.instance_name || inst.zapi_instance_id}</span>
                  {!statusMap[inst.id] && checkingStatus && <Loader2 className="w-3 h-3 animate-spin" />}
                  {statusMap[inst.id] === true && <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[9px] h-4">Online</Badge>}
                  {statusMap[inst.id] === false && <Badge variant="secondary" className="text-[9px] h-4">Offline</Badge>}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label>Nome de Exibição</Label>
            <div className="flex gap-2">
              <Input placeholder="Novo nome..." value={profileName} onChange={(e) => setProfileName(e.target.value)} disabled={updating} />
              <Button onClick={handleUpdateName} disabled={updating || !profileName.trim() || selectedIds.length === 0}>
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar Nome"}
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <Label>Foto de Perfil</Label>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {previewUrl ? (
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => { setPreviewUrl(""); setImageFile(null); }}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-5 h-5 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
                    <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="hidden" 
                      id="bulk-profile-pic"
                      disabled={updating}
                    />
                    <Button 
                      asChild 
                      variant="outline" 
                      className="flex-1 cursor-pointer"
                      disabled={updating}
                    >
                      <label htmlFor="bulk-profile-pic">
                        <Upload className="w-4 h-4 mr-2" />
                        Upar Foto
                      </label>
                    </Button>
                    <Button 
                      onClick={handleUpdatePicture} 
                      disabled={updating || (!previewUrl && !imageUrl.trim()) || selectedIds.length === 0}
                      className="flex-1"
                    >
                      {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      {previewUrl ? "Salvar Foto" : "Aplicar"}
                    </Button>
                  </div>
                  {!previewUrl && (
                    <div className="flex gap-2">
                      <Input 
                        type="url" 
                        placeholder="Ou cole a URL da imagem aqui..." 
                        value={imageUrl} 
                        onChange={(e) => setImageUrl(e.target.value)} 
                        disabled={updating} 
                        className="text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

  );
};

const BulkCreateProduct = ({ instances, open, onOpenChange }: { instances: ZapiInstance[]; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");


  useEffect(() => {
    if (open) setSelectedIds(instances.map((i) => i.id));
  }, [open, instances]);

  const allSelected = selectedIds.length === instances.length && instances.length > 0;
  const toggleAll = () => setSelectedIds(allSelected ? [] : instances.map((i) => i.id));
  const toggleOne = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!productName.trim() || !mediaUrl.trim()) {
      toast({ title: "Nome e URL da Imagem são obrigatórios", variant: "destructive" });
      return;
    }
    const targets = instances.filter((i) => selectedIds.includes(i.id));
    setSubmitting(true);
    let success = 0;
    for (const inst of targets) {
      try {
        const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
          body: {
            action: "create-product-v2",
            instanceDbId: inst.id,
            payload: { name: productName.trim(), price: Number(price) || 0, description: description.trim(), mediaUrl: mediaUrl.trim(), currency: "BRL" },
          },
        });
        if (!error && !(data as any)?.error) success++;
      } catch (err) {}
    }
    setSubmitting(false);
    toast({ title: success > 0 ? "✅ Produto criado" : "❌ Erro", description: `Produto criado em ${success} instância(s)` });
    if (success > 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Criar Produto em Massa</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Instâncias ({selectedIds.length}/{instances.length})</Label>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1 bg-muted/20">
              {instances.map((inst) => (
                <label key={inst.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedIds.includes(inst.id)} onChange={() => toggleOne(inst.id)} className="accent-primary" />
                  <span>{inst.instance_name || inst.zapi_instance_id}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input placeholder="Nome do Produto" value={productName} onChange={(e) => setProductName(e.target.value)} />
            <Input type="number" placeholder="Preço" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <Textarea placeholder="Descrição..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <Input placeholder="URL da Imagem" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
          <Button onClick={handleSubmit} disabled={submitting || selectedIds.length === 0} className="w-full">
            {submitting ? <Loader2 className="animate-spin" /> : "Criar Produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BulkCreateCollection = ({ instances, open, onOpenChange }: { instances: ZapiInstance[]; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setSelectedIds(instances.map((i) => i.id));
  }, [open, instances]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    let success = 0;
    const targets = instances.filter((i) => selectedIds.includes(i.id));
    for (const inst of targets) {
      try {
        const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
          body: { action: "create-collection", instanceDbId: inst.id, payload: { name: name.trim(), products: [] } },
        });
        if (!error && !(data as any)?.error) success++;
      } catch (err) {}
    }
    setSubmitting(false);
    toast({ title: success > 0 ? "✅ Coleção criada" : "❌ Erro", description: `Coleção criada em ${success} instâncias` });
    if (success > 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Coleção em Massa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input placeholder="Nome da Coleção" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={handleSubmit} disabled={submitting || !name.trim() || selectedIds.length === 0} className="w-full">
            {submitting ? <Loader2 className="animate-spin" /> : "Criar Coleção"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BulkBusinessInfo = ({ instances, open, onOpenChange }: { instances: ZapiInstance[]; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedIds(instances.map((i) => i.id));
  }, [open, instances]);

  const applyToAll = async (action: string, payload: any, label: string) => {
    const targets = instances.filter((i) => selectedIds.includes(i.id));
    if (targets.length === 0) {
      toast({ title: "Selecione ao menos uma instância", variant: "destructive" });
      return;
    }
    setSubmitting(action);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const inst of targets) {
      try {
        const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
          body: { action, instanceDbId: inst.id, payload },
        });
        if (error) throw new Error(await getInvokeErrorMessage(error, "Falha ao atualizar"));
        if ((data as any)?.error) throw new Error(formatErrorMessage((data as any).error));
        success++;
      } catch (err) {
        failed++;
        errors.push(`${inst.instance_name || inst.zapi_instance_id}: ${err instanceof Error ? err.message : "Erro"}`);
      }
    }
    setSubmitting(null);
    toast({
      title: success > 0 ? `✅ ${label} atualizado` : "❌ Erro",
      description: failed > 0
        ? `${success} de ${targets.length} atualizada(s). Erros:\n${errors.slice(0, 3).join("\n")}${errors.length > 3 ? `\n+${errors.length - 3} outros` : ""}`
        : `Aplicado em ${success} instância(s)`,
      variant: failed === targets.length ? "destructive" : "default",
      duration: failed > 0 ? 8000 : 3000,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Perfil da Empresa em Massa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <div className="flex gap-2">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              <Button onClick={() => applyToAll('company-description', { description }, 'Descrição')} disabled={!!submitting || !description.trim() || selectedIds.length === 0}>
                {submitting === 'company-description' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <div className="flex gap-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button onClick={() => applyToAll('company-email', { email }, 'E-mail')} disabled={!!submitting || !email.trim() || selectedIds.length === 0}>
                {submitting === 'company-email' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <div className="flex gap-2">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              <Button onClick={() => applyToAll('company-address', { address }, 'Endereço')} disabled={!!submitting || !address.trim() || selectedIds.length === 0}>
                {submitting === 'company-address' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


export default PerfilEmpresa;
