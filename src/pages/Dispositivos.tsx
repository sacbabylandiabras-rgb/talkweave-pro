const BulkCreateProduct = ({ instances, open, onOpenChange }: { instances: ZapiInstance[]; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Product data
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [sku, setSku] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) setSelectedIds(instances.map((i) => i.id));
  }, [open, instances]);

  const allSelected = selectedIds.length === instances.length && instances.length > 0;
  const toggleAll = () => setSelectedIds(allSelected ? [] : instances.map((i) => i.id));
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async () => {
    if (!productName.trim() || !mediaUrl.trim()) {
      toast({ title: "Nome e URL da Imagem são obrigatórios", variant: "destructive" });
      return;
    }

    const targets = instances.filter((i) => selectedIds.includes(i.id));
    if (targets.length === 0) {
      toast({ title: "Selecione ao menos uma instância", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const inst of targets) {
      try {
        const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
          body: {
            action: "create-product-v2",
            instanceDbId: inst.id,
            payload: {
              name: productName.trim(),
              price: Number(price) || 0,
              description: description.trim(),
              mediaUrl: mediaUrl.trim(),
              sku: sku.trim(),
              currency,
              isHidden: false
            },
          },
        });

        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error?.message || (data as any).error);
        success++;
      } catch (err: any) {
        failed++;
        errors.push(`${inst.instance_name || inst.zapi_instance_id}: ${err.message || "Erro"}`);
      }
    }

    setSubmitting(false);
    toast({
      title: success > 0 ? "✅ Produto criado" : "❌ Erro",
      description: failed > 0
        ? `${success} de ${targets.length} criado(s). Erros:\n${errors.slice(0, 3).join("\n")}`
        : `Produto criado em ${success} instância(s)`,
      variant: failed === targets.length ? "destructive" : "default",
    });

    if (success > 0) {
      onOpenChange(false);
      setProductName("");
      setPrice("");
      setDescription("");
      setMediaUrl("");
      setSku("");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setMediaUrl(publicUrl);
      toast({ title: "Imagem enviada com sucesso!" });
    } catch (error: any) {
      toast({ 
        title: "Erro no upload", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" /> Criar Produto em Massa
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Adicione um novo produto ao catálogo das instâncias selecionadas.</p>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Instâncias ({selectedIds.length}/{instances.length})</Label>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll} disabled={submitting}>
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1 bg-muted/20">
              {instances.map((inst) => (
                <label key={inst.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedIds.includes(inst.id)} onChange={() => toggleOne(inst.id)} disabled={submitting} className="accent-primary" />
                  <span className="flex-1 truncate">{inst.instance_name || inst.zapi_instance_id}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Produto</Label>
              <Input placeholder="Ex: Camiseta Branca" value={productName} onChange={(e) => setProductName(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <Label>Preço</Label>
              <Input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} disabled={submitting} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea placeholder="Detalhes do produto..." value={description} onChange={(e) => setDescription(e.target.value)} disabled={submitting} rows={3} />
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Imagem do Produto
            </Label>
            <div className="flex gap-2">
              <Input 
                placeholder="https://exemplo.com/imagem.jpg" 
                value={mediaUrl} 
                onChange={(e) => setMediaUrl(e.target.value)} 
                disabled={submitting || uploading} 
                className="flex-1"
              />
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={submitting || uploading}
                  className="hidden"
                  id="product-image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting || uploading}
                  onClick={() => document.getElementById('product-image-upload')?.click()}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {uploading ? "Enviando..." : "Upload"}
                </Button>
              </div>
            </div>
            {mediaUrl && (
              <div className="mt-2 relative w-20 h-20 border rounded-md overflow-hidden bg-muted">
                <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setMediaUrl("")}
                  className="absolute top-0 right-0 bg-destructive text-white p-0.5 rounded-bl-md hover:bg-destructive/80"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">Insira uma URL ou faça o upload de uma imagem.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SKU (Opcional)</Label>
              <Input placeholder="REF-001" value={sku} onChange={(e) => setSku(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Real (BRL)</SelectItem>
                  <SelectItem value="USD">Dólar (USD)</SelectItem>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submitting || selectedIds.length === 0} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
            Criar Produto nas {selectedIds.length} instância(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


import { useEffect, useState, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import { Smartphone, Wifi, WifiOff, RefreshCw, QrCode, PowerOff, RotateCcw, Edit2, Check, X, Phone, Send, Plus, Loader2, Search, Trash2, User, Upload, Image as ImageIcon, Globe, LayoutGrid, Package, PlusCircle, MinusCircle, Building2, Mail, MapPin, Clock, AlertCircle, KeyRound, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useZapi, setZapiInstanceOverride } from "@/hooks/useZapi";
import { isMobileZapiInstance, useZapiInstances, ZapiInstance } from "@/hooks/useZapiInstances";
import { useToast } from "@/hooks/use-toast";
import QRCodeLib from 'qrcode';
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FunctionsHttpError } from "@supabase/supabase-js";

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
    .replace(/z-api|uazapi|meta cloud|woovi|hubpague|cartwave/gi, 'provedor de conexão')
    .replace(/client-token\s+[\w-]+/gi, 'token de segurança');
};

const getConnectionIssueMessage = (issue?: string | null) => {
  if (issue === 'credentials_invalid') {
    return 'Credenciais da conexão inválidas no Z-API. Verifique se você está usando o "Security Token" (Token de Segurança da Conta) correto em Minha Conta -> Segurança no painel da Z-API.';
  }
  if (issue === 'whatsapp_unavailable') {
    return 'WhatsApp não respondeu agora. Aguarde alguns instantes e tente gerar novamente.';
  }
  return 'Tente reiniciar a instância e gerar o QR Code novamente.';
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

const normalizeQrImageValue = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image")) return trimmed;
  if (trimmed.startsWith("iVBOR")) return `data:image/png;base64,${trimmed}`;
  if (trimmed.startsWith("/9j/")) return `data:image/jpeg;base64,${trimmed}`;
  if (trimmed.startsWith("R0lGOD")) return `data:image/gif;base64,${trimmed}`;
  if (trimmed.startsWith("UklGR")) return `data:image/webp;base64,${trimmed}`;
  if (trimmed.startsWith("PHN2Zy")) return `data:image/svg+xml;base64,${trimmed}`;
  return trimmed;
};

const normalizeDeviceStatusPayload = (payload: any) => {
  const status = String(payload?.status || payload?.device?.status || '').toLowerCase();
  const connected = payload?.connected === true ||
    payload?.session === true ||
    payload?.smartphoneConnected === true ||
    payload?.device?.connected === true ||
    ['connected', 'open', 'online'].includes(status);

  return {
    ...payload,
    connected,
    session: connected,
    smartphoneConnected: connected,
    status,
  };
};

type CollectionItem = {
  id?: string | number;
  name?: string;
  status?: string;
  [key: string]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getNestedValue = (source: unknown, path: string[]) =>
  path.reduce<unknown>((current, key) => isRecord(current) ? current[key] : undefined, source);

const normalizeCollectionsPayload = (payload: unknown): CollectionItem[] => {
  const candidates = [
    payload,
    getNestedValue(payload, ['data']),
    getNestedValue(payload, ['data', 'value']),
    getNestedValue(payload, ['data', 'collections']),
    getNestedValue(payload, ['data', 'value', 'collections']),
    getNestedValue(payload, ['data', 'items']),
    getNestedValue(payload, ['data', 'value', 'items']),
    getNestedValue(payload, ['collections']),
    getNestedValue(payload, ['value']),
    getNestedValue(payload, ['value', 'collections']),
    getNestedValue(payload, ['items']),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as CollectionItem[];
  }

  return [];
};

const DeviceCard = ({ instance, onDeleted }: { instance: ZapiInstance; onDeleted?: () => void }) => {
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState(instance.instance_name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [tempName, setTempName] = useState(instance.instance_name);

  // Connection settings
  const [showSettings, setShowSettings] = useState(false);
  const [editForm, setEditForm] = useState({
    zapi_instance_id: instance.zapi_instance_id || "",
    zapi_token: instance.zapi_token || "",
    zapi_client_token: instance.zapi_client_token || "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('zapi_instances')
        .update({ instance_name: tempName.trim() })
        .eq('id', instance.id);
      
      if (error) throw error;
      setInstanceName(tempName.trim());
      setIsEditingName(false);
      toast({ title: "✅ Nome atualizado" });
    } catch (err: any) {
      toast({ title: "❌ Erro ao salvar nome", description: err.message, variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handleUpdateSettings = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('zapi_instances')
        .update({
          zapi_instance_id: editForm.zapi_instance_id.trim(),
          zapi_token: editForm.zapi_token.trim(),
          zapi_client_token: editForm.zapi_client_token.trim(),
        })
        .eq('id', instance.id);

      if (error) throw error;
      
      setShowSettings(false);
      toast({ title: "✅ Conexão atualizada", description: "O sistema tentará reconectar em instantes." });
      
      // Force status update
      setTimeout(fetchDeviceStatus, 1500);
    } catch (err: any) {
      toast({ title: "❌ Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
   const [healthBlock, setHealthBlock] = useState<{ blocked_until: string | null, block_type?: string, detail?: any } | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [connectionTab, setConnectionTab] = useState("qr-code");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
   const [showConnect, setShowConnect] = useState(false);
    const [showCollections, setShowCollections] = useState(false);
    const [collections, setCollections] = useState<CollectionItem[]>([]);
    const [collectionsLoading, setCollectionsLoading] = useState(false);
    const [deletingCollectionId, setDeletingCollectionId] = useState<string | number | null>(null);
    const [editingCollection, setEditingCollection] = useState<{ id: string | number; name: string } | null>(null);
    const [editName, setEditName] = useState("");
    const [editingLoading, setEditingLoading] = useState(false);
    const [viewingProductsId, setViewingProductsId] = useState<string | number | null>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [addingProductId, setAddingProductId] = useState("");
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [removingProductId, setRemovingProductId] = useState<string | number | null>(null);
    const [showPrivacy, setShowPrivacy] = useState(false);
   const [privacyLoading, setPrivacyLoading] = useState(false);
   const [privacySettings, setPrivacySettings] = useState<any>({});
   const fetchCollections = async () => {
     setCollectionsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
         body: { 
           action: 'list-collections', 
           instanceDbId: instance.id,
           phone: connectedPhone 
         },
       });
       if (error) throw error;
        if (data?.error) throw new Error(data.error?.message || data.error);
        setCollections(normalizeCollectionsPayload(data));
     } catch (err: any) {
        setCollections([]);
       const message = await getInvokeErrorMessage(err, 'Erro ao buscar coleções');
       toast({ title: "❌ Erro ao buscar coleções", description: message, variant: "destructive" });
     } finally {
       setCollectionsLoading(false);
     }
   };

   const deleteCollection = async (collectionId: string | number) => {
     setDeletingCollectionId(collectionId);
     try {
       const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
         body: { 
           action: 'delete-collection', 
           instanceDbId: instance.id,
           payload: { collectionId }
         },
       });
       if (error) throw error;
       if (data?.error) throw new Error(data.error?.message || data.error);
       toast({ title: "✅ Coleção excluída" });
       // Refresh list
       fetchCollections();
     } catch (err: any) {
       const message = await getInvokeErrorMessage(err, 'Erro ao excluir coleção');
       toast({ title: "❌ Erro ao excluir", description: message, variant: "destructive" });
     } finally {
       setDeletingCollectionId(null);
     }
   };

   const handleEditCollection = async () => {
     if (!editingCollection || !editName.trim()) return;
     setEditingLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
         body: { 
           action: 'edit-collection', 
           instanceDbId: instance.id,
           payload: { collectionId: editingCollection.id, name: editName.trim() }
         },
       });
       if (error) throw error;
       if (data?.error) throw new Error(data.error?.message || data.error);
       toast({ title: "✅ Coleção atualizada" });
       setEditingCollection(null);
       fetchCollections();
     } catch (err: any) {
       const message = await getInvokeErrorMessage(err, 'Erro ao editar coleção');
       toast({ title: "❌ Erro ao editar", description: message, variant: "destructive" });
     } finally {
       setEditingLoading(false);
     }
   };

   const fetchCollectionProducts = async (collectionId: string | number) => {
     setViewingProductsId(collectionId);
     setProductsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
         body: { 
           action: 'list-collection-products', 
           instanceDbId: instance.id,
           phone: connectedPhone,
           payload: { collectionId }
         },
       });
       if (error) throw error;
       if (data?.error) throw new Error(data.error?.message || data.error);
       setProducts(data?.data?.value || data?.data?.items || data?.data?.products || []);
     } catch (err: any) {
       const message = await getInvokeErrorMessage(err, 'Erro ao buscar produtos');
       toast({ title: "❌ Erro ao buscar produtos", description: message, variant: "destructive" });
       setViewingProductsId(null);
     } finally {
       setProductsLoading(false);
     }
   };

   const addProductToCollection = async (collectionId: string | number) => {
     if (!addingProductId.trim()) return;
     setIsAddingProduct(true);
     try {
       const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
         body: { 
           action: 'add-products-to-collection', 
           instanceDbId: instance.id,
           payload: { 
             collectionId, 
             products: [{ id: addingProductId.trim() }] 
           }
         },
       });
       if (error) throw error;
       if (data?.error) throw new Error(data.error?.message || data.error);
       toast({ title: "✅ Produto adicionado" });
       setAddingProductId("");
       fetchCollectionProducts(collectionId);
     } catch (err: any) {
       const message = await getInvokeErrorMessage(err, 'Erro ao adicionar produto');
       toast({ title: "❌ Erro ao adicionar", description: message, variant: "destructive" });
     } finally {
       setIsAddingProduct(false);
     }
   };

   const removeProductFromCollection = async (collectionId: string | number, productId: string | number) => {
     setRemovingProductId(productId);
     try {
       const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
         body: { 
           action: 'remove-products-from-collection', 
           instanceDbId: instance.id,
           payload: { 
             collectionId, 
             products: [{ id: productId }] 
           }
         },
       });
       if (error) throw error;
       if (data?.error) throw new Error(data.error?.message || data.error);
       toast({ title: "✅ Produto removido" });
       fetchCollectionProducts(collectionId);
     } catch (err: any) {
       const message = await getInvokeErrorMessage(err, 'Erro ao remover produto');
       toast({ title: "❌ Erro ao remover", description: message, variant: "destructive" });
     } finally {
       setRemovingProductId(null);
     }
   };

    const updatePrivacy = async (action: string, payload: any) => {
      setPrivacyLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
          body: { action, instanceDbId: instance.id, payload },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error?.message || data.error);
        toast({ title: "✅ Configuração atualizada" });
      } catch (err: any) {
        const message = await getInvokeErrorMessage(err, 'Erro ao atualizar privacidade');
        toast({ title: "❌ Erro ao atualizar", description: message, variant: "destructive" });
      } finally {
        setPrivacyLoading(false);
      }
    };

   const fetchBlacklist = async () => {
     setPrivacyLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('zapi-chat-actions', {
         body: { action: 'get-disallowed-contacts', instanceDbId: instance.id },
       });
       if (error) throw error;
       const list = data?.data?.value || data?.data || [];
       if (list.length === 0) {
         toast({ title: "ℹ️ Lista vazia", description: "Nenhum contato na lista de bloqueados." });
       } else {
         toast({ title: "🚫 Lista de bloqueados", description: list.map((c: any) => c.phone || c).join(', ') });
       }
     } catch (err: any) {
       const message = await getInvokeErrorMessage(err, 'Erro ao buscar blacklist');
       toast({ title: "❌ Erro ao buscar blacklist", description: message, variant: "destructive" });
     } finally {
       setPrivacyLoading(false);
     }
   };

  const [hasSynced, setHasSynced] = useState(false);
  const [prevConnected, setPrevConnected] = useState<boolean | null>(null);
  const { disconnectDevice, loading } = useZapi();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Set instance override only for operations that still use the shared hook state
  const withInstance = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setZapiInstanceOverride(instance);
    try {
      return await fn();
    } finally {
      setZapiInstanceOverride(null);
    }
  };

  const statusErrorShownRef = useRef(false);

  useEffect(() => {
    const handleProfilePictureUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ value?: string; instanceIds?: string[] }>;
      const updatedIds = customEvent.detail?.instanceIds || [];
      const nextValue = customEvent.detail?.value;

      if (nextValue && updatedIds.includes(instance.id)) {
        setProfilePicUrl(nextValue);
      }
    };

    window.addEventListener(DEVICE_PROFILE_PICTURE_UPDATED_EVENT, handleProfilePictureUpdated as EventListener);
    return () => {
      window.removeEventListener(DEVICE_PROFILE_PICTURE_UPDATED_EVENT, handleProfilePictureUpdated as EventListener);
    };
  }, [instance.id]);

  const fetchDeviceStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-device-status', {
        body: { instanceId: instance.id },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data?.message || data?.error || 'Erro ao buscar status do dispositivo');
      }

      setDeviceStatus(data?.data ? normalizeDeviceStatusPayload(data.data) : null);
      fetchHealth(); // Atualiza também o status de shadowban/saúde
      statusErrorShownRef.current = false;
    } catch (error) {
      const message = await getInvokeErrorMessage(error, 'Erro ao buscar status do dispositivo');
      console.error('Erro ao buscar status:', message);
      // Mantém o último status conhecido para não exibir offline por falha momentânea.
      // Only show toast once per error streak
      if (!statusErrorShownRef.current) {
        statusErrorShownRef.current = true;
        toast({
          title: 'Erro ao buscar status',
          description: message,
          variant: 'destructive',
        });
      }
    }
  };

   // Fetch connected phone number separately
   const fetchConnectedPhone = async () => {
     if (connectedPhone) return;
     let foundPhone: string | null = null;
 
     // Z-API
     const baseUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`;
     const hdrs: Record<string, string> = { "Client-Token": instance.zapi_client_token, "Content-Type": "application/json" };
 
     try {
       const res = await fetch(`${baseUrl}/device`, { headers: hdrs });
       if (res.ok) {
         const d = await res.json();
         const num = d?.phone || d?.phoneNumber || d?.wid?.user || d?.me?.user || null;
         if (num) foundPhone = num;
         const pic = d?.imgUrl || d?.profilePictureUrl || d?.picture || null;
         if (pic) setProfilePicUrl(pic);
       }
     } catch {}
 
     if (!foundPhone) {
       try {
         const res = await fetch(`${baseUrl}/host-device`, { headers: hdrs });
         if (res.ok) {
           const d = await res.json();
           const num = d?.phone || d?.phoneNumber || d?.wid?.user || d?.id?.replace?.("@c.us", "") || null;
           if (num) foundPhone = num;
         }
       } catch {}
     }
 
     if (foundPhone) {
       setConnectedPhone(foundPhone);
     }
   };

  const fetchQRCode = async () => {
    try {
      setQrCode(null);
      setQrCodeImage(null);

      const { data, error } = await supabase.functions.invoke('get-qr-code', {
        body: { instanceId: instance.id },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data?.message || data?.error || 'Erro ao buscar QR Code');
      }

      const rawQrValue = data?.data?.value ?? data?.data?.qrCode ?? data?.data?.qrcode ?? data?.data?.raw?.qrCode ?? data?.data?.raw?.qrcode ?? null;
      const qrValue = normalizeQrImageValue(rawQrValue);

      if (typeof qrValue === 'string' && qrValue.startsWith('data:image')) {
        setQrCodeImage(qrValue);
        setQrCode(qrValue);
        toast({ title: "✅ QR Code gerado", description: "Escaneie para conectar" });
        return;
      }

      if (typeof qrValue === 'string' && qrValue.length > 50) {
        setQrCode(qrValue);

        try {
          const qrImageDataURL = await QRCodeLib.toDataURL(qrValue, {
            width: 256,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          setQrCodeImage(qrImageDataURL);
          toast({ title: "✅ QR Code gerado", description: "Escaneie para conectar" });
        } catch {
          toast({ title: "❌ Erro ao gerar imagem", variant: "destructive" });
        }
        return;
      }

      if (data?.data?.connected === true) {
        toast({ title: "⚠️ Dispositivo já conectado", variant: "destructive" });
      } else if (data?.data?.issue) {
        toast({ title: "QR Code indisponível", description: getConnectionIssueMessage(data.data.issue), variant: "destructive" });
      } else {
        toast({ title: "❌ QR Code indisponível", description: "Tente reiniciar a instância.", variant: "destructive" });
      }
    } catch (error) {
      const message = await getInvokeErrorMessage(error, 'Erro ao buscar QR Code');
      toast({ title: "❌ Erro de conexão", description: message, variant: "destructive" });
    }
  };

  const fetchPairingCode = async () => {
    if (!phoneNumber) {
      toast({ title: "❌ Número obrigatório", variant: "destructive" });
      return;
    }
    try {
      setPairingCode(null);

      let cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

      const { data, error } = await supabase.functions.invoke('get-pairing-code', {
        body: {
          phoneNumber: cleanPhone,
          instanceId: instance.id,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.data) {
        throw new Error(data?.message || data?.error || 'Falha ao gerar código de conexão');
      }

      if (data.data.pairingCode) {
        setPairingCode(data.data.pairingCode);
      } else if (data.data.qrCode) {
        const qr = data.data.qrCode;
        const isBase64Image = typeof qr === 'string' && qr.startsWith('data:image');
        setPairingCode(isBase64Image ? qr : data.data.code || null);
        toast({ title: "ℹ️ Código visual disponível", description: "Use o QR Code abaixo para concluir a conexão." });
      } else if (data.data.code) {
        setPairingCode(data.data.code);
      }
    } catch (error) {
      const message = await getInvokeErrorMessage(error, 'Erro ao solicitar código');
      toast({ title: "❌ Erro ao solicitar código", description: message, variant: "destructive" });
    }
  };

  const pauseActiveCampaigns = async () => {
    try {
      const { data: activeCampaigns, error } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('status', 'active');
      if (error) throw error;
      if (activeCampaigns && activeCampaigns.length > 0) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            await supabase.functions.invoke('clear-zapi-queue', {
              headers: { Authorization: `Bearer ${token}` },
              body: { clearAllActive: true },
            });
          }
        } catch {}
        await supabase.from('campaigns').update({ status: 'paused' }).eq('status', 'active');
        toast({
          title: "⏸️ Campanhas Pausadas",
          description: `${activeCampaigns.length} campanha(s) pausada(s) automaticamente para preservar os números pendentes.`,
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (error) {
      console.error('Erro ao pausar campanhas:', error);
    }
  };

   const handleDisconnect = async () => {
     try {
       await disconnectDevice(instance.id);
       localStorage.removeItem('readConversations');
       setConnectedPhone(null);
       setProfilePicUrl(null);
       setQrCode(null);
       setQrCodeImage(null);
       setTimeout(fetchDeviceStatus, 1000);
     } catch (err) {
       // Silent catch
     }
   };

  useEffect(() => {
    fetchDeviceStatus();
    // Poll faster when connect dialog is open
    const interval = showConnect ? 3000 : 10000;
    const statusInterval = setInterval(fetchDeviceStatus, interval);
    return () => clearInterval(statusInterval);
  }, [instance.id, showConnect]);

  // Fetch phone when connected
  useEffect(() => {
    if (deviceStatus?.connected === true && !connectedPhone) {
      fetchConnectedPhone();
    }
  }, [deviceStatus?.connected]);

  // Auto-sync history when device transitions from disconnected to connected
  useEffect(() => {
    const isConnectedNow = deviceStatus?.connected === true;
    
    if (prevConnected === false && isConnectedNow && !hasSynced) {
      setHasSynced(true);
      // Auto-close connect dialog
      if (showConnect) {
        setShowConnect(false);
        toast({ title: "✅ WhatsApp conectado!" });
      }
      
      // Delay sync slightly to ensure session is fully initialized at Z-API
      const syncTimeout = setTimeout(() => {
        toast({ title: "📥 Sincronizando contatos...", description: "Importando conversas desta instância." });
        supabase.functions.invoke('sync-zapi-history', {
          body: { instanceId: instance.id, maxChats: 100 }
        }).then(({ data, error }) => {
          if (error) {
            console.error('Erro ao sincronizar:', error);
            // If it's a transient error, we'll allow retrying later or not show a scary toast
            // unless it's a hard failure.
            toast({ 
              title: "⚠️ Sincronização parcial", 
              description: "Não foi possível importar todos os contatos agora. O sistema tentará novamente em breve.",
              variant: "default" 
            });
          } else if (data?.error === 'disconnected') {
            toast({ title: "⚠️ Sessão indisponível", description: "Não foi possível importar o histórico agora. Tente novamente em instantes." });
            setHasSynced(false); // Permite tentar novamente na próxima conexão
          } else {
            toast({ 
              title: "✅ Contatos importados!", 
              description: `${data?.importedContacts || 0} contatos e ${data?.importedChats || 0} conversas importadas.`,
              duration: 6000,
            });
          }
        });
      }, 5000); // Aumentado para 5s para dar tempo da Z-API estabilizar a sessão

      return () => clearTimeout(syncTimeout);
    }
    
    if (prevConnected === true && deviceStatus?.connected === false && deviceStatus?.smartphoneConnected === false) {
      // Confirma a desconexão com uma segunda checagem após 15s para evitar
      // pausar campanhas por causa de uma oscilação momentânea da API de status.
      // 15s é o tempo aproximado de um ciclo de refresh da Z-API.
      const pauseTimeout = setTimeout(async () => {
        try {
          const { data } = await supabase.functions.invoke('get-device-status', {
            body: { instanceId: instance.id },
          });
          const stillDown = data?.connected === false && data?.smartphoneConnected === false;
          if (stillDown) {
            console.log('⚠️ Dispositivo permanece desconectado após 15s. Pausando campanhas...');
            pauseActiveCampaigns();
          } else {
            console.log('🔄 Falsa desconexão detectada, campanhas mantidas ativas.');
          }
        } catch (e) {
          console.warn('Re-checagem de desconexão falhou, ignorando pausa:', e);
        }
      }, 15000);

      return () => clearTimeout(pauseTimeout);
    }
    if (deviceStatus?.connected === false && !deviceStatus?.issue) {
      fetchQRCode();
    }
    
    setPrevConnected(deviceStatus?.connected ?? null);
  }, [deviceStatus?.connected, deviceStatus?.smartphoneConnected]);

  const isOnline = deviceStatus?.connected === true && deviceStatus?.session === true;
  const isConnected = deviceStatus?.connected === true;

  // Busca status de saúde (bloqueios de envio detectados pelo aquecimento)
  const fetchHealth = async () => {
    try {
      const phoneDigits = (connectedPhone || "").replace(/\D/g, "");
      const filters: string[] = [`instance_ref.eq.${instance.id}`];
      if (phoneDigits) {
        filters.push(`phone.eq.${phoneDigits}`);
        // For security, if phone has 8/9 digits mismatch (common in BR), try both
        if (phoneDigits.length === 11) { // 55 + DDD + 9 digits
          const withoutNine = phoneDigits.substring(0, 4) + phoneDigits.substring(5);
          filters.push(`phone.eq.${withoutNine}`);
        } else if (phoneDigits.length === 10) { // 55 + DDD + 8 digits
          const withNine = phoneDigits.substring(0, 4) + '9' + phoneDigits.substring(4);
          filters.push(`phone.eq.${withNine}`);
        }
      }
      const { data } = await (supabase as any)
        .from("warmup_instance_health")
        .select("blocked_until, last_detected_at, block_type, detail")
        .or(filters.join(","))
        .order("last_detected_at", { ascending: false })
        .limit(5);

       // Prioritize active blocks that have not expired yet
       const activeBlock = data?.find((b: any) => {
         const isDisconnected = b.block_type === 'disconnected';
         const isPermanentShadowban = b.block_type === 'shadowban' && !b.blocked_until;
         const isActiveTemporaryBlock = b.blocked_until && new Date(b.blocked_until) > new Date();
         return isDisconnected || isPermanentShadowban || isActiveTemporaryBlock;
       }) || null;

       setHealthBlock(activeBlock || null);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchHealth();
    const t = setInterval(fetchHealth, 60_000);
    return () => clearInterval(t);
  }, [instance.id, connectedPhone]);

  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-primary/30 transition-all min-h-[280px]">
        {/* Profile picture + name */}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {profilePicUrl ? (
              <img
                src={profilePicUrl}
                alt="Perfil"
                className="w-14 h-14 rounded-full object-cover border-2 border-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                <Smartphone className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-red-500'}`} />
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="h-7 text-sm w-28"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') { setTempName(instanceName); setIsEditingName(false); }
                    }}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveName} disabled={savingName}>
                    {savingName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setTempName(instanceName); setIsEditingName(false); }} disabled={savingName}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <span className="font-semibold text-sm truncate">{instanceName}</span>
              )}
              {instance.is_default && <Badge variant="default" className="text-[10px] px-1.5 py-0">Padrão</Badge>}
              {!isEditingName && (
                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => { setIsEditingName(true); setTempName(instanceName); }}>
                  <Edit2 className="w-2.5 h-2.5" />
                </Button>
              )}
            </div>
            {connectedPhone && (
              <div className="flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">+{connectedPhone}</span>
              </div>
            )}
            {healthBlock && (() => {
              const until = healthBlock.blocked_until ? new Date(healthBlock.blocked_until) : null;
              const isShadowBan = healthBlock.block_type === 'shadowban' || 
                                 (healthBlock.detail && String(healthBlock.detail).toLowerCase().includes('shadow ban'));
              
              // Only show if the device is ONLINE/CONNECTED and it's a Shadowban
              if (!isOnline || !isShadowBan) {
                return null;
              }

              let label = "";
              let icon = <AlertCircle className="w-3 h-3 mr-1 inline" />;
              
              if (isShadowBan) {
                label = "⚠️ Número com restrição detectada pelo WhatsApp (Shadowban)";
                if (until) {
                  label += ` · expira em ${until.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
                }
                icon = <AlertCircle className="w-3 h-3 mr-1 inline text-orange-600" />;
              } else {
                label = until
                  ? `Limite de novas conversas atingido · libera em ${until.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
                  : "Limite de novas conversas atingido";
              }

              return (
                <div className="mt-1.5">
                  <Badge 
                    variant="destructive" 
                    className={`text-[10px] leading-tight whitespace-normal text-left ${isShadowBan ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                  >
                    {icon}
                    {label}
                  </Badge>
                </div>
              );
            })()}
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground font-mono truncate" title={instance.zapi_instance_id}>
                ID: {instance.zapi_instance_id}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant={isOnline ? 'default' : 'secondary'} className="text-[10px]">
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setShowSettings(true)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Status dots */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${deviceStatus?.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            Conectado
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${deviceStatus?.session ? 'bg-emerald-500' : 'bg-red-500'}`} />
            Sessão
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${deviceStatus?.smartphoneConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            Celular
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button variant="outline" size="sm" onClick={fetchDeviceStatus} disabled={loading} className="h-7 text-[11px] px-2">
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Status
          </Button>
          <Button variant="outline" size="sm" disabled={loading} className="h-7 text-[11px] px-2" onClick={handleDisconnect}>
            <PowerOff className="w-3 h-3 mr-1" /> Desconectar
          </Button>
          <Button variant="outline" size="sm" disabled={loading} className="h-7 text-[11px] px-2"
            onClick={async () => {
              try {
                toast({ title: "🔄 Reiniciando...", description: "Aguarde alguns segundos." });
                const { data, error } = await supabase.functions.invoke('restart-instance', {
                  body: { instanceId: instance.id },
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.message || data.error);
                toast({ title: "✅ Instância reiniciada", description: data?.message || "Escaneie o QR Code para conectar." });
                setQrCode(null);
                setQrCodeImage(null);
                setTimeout(fetchDeviceStatus, 3000);
              } catch (err) {
                const message = await getInvokeErrorMessage(err, 'Erro ao reiniciar');
                toast({ title: "❌ Erro ao reiniciar", description: message, variant: "destructive" });
              }
            }}>
            <RotateCcw className="w-3 h-3 mr-1" /> Reiniciar
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => navigate('/enviar-mensagem')}>
            <Send className="w-3 h-3 mr-1" /> Enviar
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            className="h-7 text-[11px] px-2"
            onClick={async () => {
              try {
                toast({ title: "🧹 Limpando fila...", description: "Aguarde alguns segundos." });
                const { data, error } = await supabase.functions.invoke('clear-zapi-queue', {
                  body: { instanceId: instance.id },
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.message || data.error);
                toast({ title: "✅ Fila limpa", description: "As mensagens pendentes foram removidas." });
              } catch (err) {
                const message = await getInvokeErrorMessage(err, 'Erro ao limpar fila');
                toast({ title: "❌ Erro ao limpar fila", description: message, variant: "destructive" });
              }
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Limpar fila
          </Button>

           {!isConnected && (
             <Button size="sm" className="h-7 text-[11px] px-2" onClick={() => setShowConnect(!showConnect)}>
               <Wifi className="w-3 h-3 mr-1" /> Conectar
             </Button>
           )}
            {isConnected && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2" onClick={() => setShowPrivacy(true)}>
                  <Globe className="w-3 h-3 mr-1" /> Privacidade
                </Button>
                 <Button 
                   variant="outline" 
                   size="sm" 
                   className="h-7 text-[11px] px-2" 
                   onClick={() => {
                     setShowCollections(true);
                     fetchCollections();
                   }}
                 >
                   <LayoutGrid className="w-3 h-3 mr-1" /> Coleções
                 </Button>
               </div>
             )}
 
        {/* Collections Dialog */}
        <Dialog open={showCollections} onOpenChange={setShowCollections}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5" /> Coleções do Catálogo
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {collectionsLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Buscando coleções...</p>
                </div>
              ) : collections.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nenhuma coleção encontrada.</p>
                  <Button variant="outline" size="sm" onClick={fetchCollections}>
                    <RefreshCw className="w-3 h-3 mr-2" /> Tentar novamente
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{collections.length} coleções encontradas</span>
                    <Button variant="ghost" size="sm" onClick={fetchCollections}>
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                    {collections.map((col: any, idx: number) => (
                      <div key={col.id || idx} className="p-3 border rounded-lg bg-muted/20 space-y-1">
                        <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-sm truncate">{col.name}</p>
                                <Badge variant="outline" className="text-[10px] shrink-0">{col.id}</Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground italic">
                                Status: {col.status || 'N/A'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                                onClick={() => col.id && fetchCollectionProducts(col.id)}
                                title="Ver Produtos"
                              >
                                <Package className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                                onClick={() => {
                                  setEditingCollection({ id: col.id, name: col.name || '' });
                                  setEditName(col.name || '');
                                }}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                onClick={() => col.id && deleteCollection(col.id)}
                                disabled={deletingCollectionId === col.id}
                              >
                                {deletingCollectionId === col.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Collection Products Dialog */}
        <Dialog open={!!viewingProductsId} onOpenChange={(open) => !open && setViewingProductsId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" /> Produtos da Coleção
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="flex gap-2 items-end border-b pb-4 mb-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Adicionar Produto (ID)</Label>
                  <Input 
                    placeholder="Ex: prod_123" 
                    value={addingProductId}
                    onChange={(e) => setAddingProductId(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <Button 
                  size="sm" 
                  className="h-8" 
                  onClick={() => viewingProductsId && addProductToCollection(viewingProductsId)}
                  disabled={isAddingProduct || !addingProductId.trim()}
                >
                  {isAddingProduct ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3 mr-1" />}
                  Add
                </Button>
              </div>

              {productsLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Buscando produtos...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nenhum produto nesta coleção.</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                  {products.map((prod: any, idx: number) => (
                    <div key={prod.id || idx} className="p-3 border rounded-lg bg-muted/20 flex gap-3 items-center">
                      {prod.image_url || prod.url ? (
                        <img src={prod.image_url || prod.url} alt={prod.name} className="w-12 h-12 rounded object-cover border" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center border">
                          <Package className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm truncate">{prod.name || prod.title}</p>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => viewingProductsId && removeProductFromCollection(viewingProductsId, prod.id || prod.retailer_id)}
                            disabled={removingProductId === (prod.id || prod.retailer_id)}
                          >
                            {removingProductId === (prod.id || prod.retailer_id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <MinusCircle className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-primary font-medium">
                            {prod.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: prod.currency || 'BRL' }).format(prod.price / 1000) : 'Preço não inf.'}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{prod.id || prod.retailer_id}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Collection Dialog */}
        <Dialog open={!!editingCollection} onOpenChange={(open) => !open && setEditingCollection(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="w-5 h-5" /> Editar Coleção
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Novo nome da coleção</Label>
                <Input 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Digite o novo nome..."
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setEditingCollection(null)}
                  disabled={editingLoading}
                >
                  Cancelar
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleEditCollection}
                  disabled={editingLoading || !editName.trim()}
                >
                  {editingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

       {/* Privacy Dialog */}
       <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">Privacidade do WhatsApp</DialogTitle>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div className="grid grid-cols-1 gap-4">
               <div className="space-y-2">
                 <Label>Visto por Último</Label>
                 <Select onValueChange={(v) => updatePrivacy('set-last-seen', { visualizationType: v })} disabled={privacyLoading}>
                   <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="ALL">Todos</SelectItem>
                     <SelectItem value="CONTACTS">Contatos</SelectItem>
                     <SelectItem value="CONTACT_BLACKLIST">Contatos, exceto...</SelectItem>
                     <SelectItem value="NONE">Ninguém</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Foto do Perfil</Label>
                 <Select onValueChange={(v) => updatePrivacy('set-photo-visualization', { visualizationType: v })} disabled={privacyLoading}>
                   <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="ALL">Todos</SelectItem>
                     <SelectItem value="CONTACTS">Contatos</SelectItem>
                     <SelectItem value="CONTACT_BLACKLIST">Contatos, exceto...</SelectItem>
                     <SelectItem value="NONE">Ninguém</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Recado (About)</Label>
                 <Select onValueChange={(v) => updatePrivacy('set-privacy-description', { visualizationType: v })} disabled={privacyLoading}>
                   <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="ALL">Todos</SelectItem>
                     <SelectItem value="CONTACTS">Contatos</SelectItem>
                     <SelectItem value="CONTACT_BLACKLIST">Contatos, exceto...</SelectItem>
                     <SelectItem value="NONE">Ninguém</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Quem pode me adicionar a grupos</Label>
                 <Select onValueChange={(v) => updatePrivacy('set-group-add-permission', { visualizationType: v })} disabled={privacyLoading}>
                   <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="ALL">Todos</SelectItem>
                     <SelectItem value="CONTACTS">Contatos</SelectItem>
                     <SelectItem value="CONTACT_BLACKLIST">Contatos, exceto...</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Online</Label>
                 <Select onValueChange={(v) => updatePrivacy('set-privacy-online', { visualizationType: v })} disabled={privacyLoading}>
                   <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="ALL">Todos</SelectItem>
                     <SelectItem value="MATCH_LAST_SEEN">Mesmo que "Visto por Último"</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Confirmações de Leitura</Label>
                 <Select onValueChange={(v) => updatePrivacy('set-read-receipts', { active: v === 'true' })} disabled={privacyLoading}>
                   <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="true">Ativado</SelectItem>
                     <SelectItem value="false">Desativado</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Duração Padrão das Mensagens</Label>
                 <Select onValueChange={(v) => updatePrivacy('set-messages-duration', { duration: parseInt(v) })} disabled={privacyLoading}>
                   <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="0">Desativado</SelectItem>
                     <SelectItem value="86400">24 horas</SelectItem>
                     <SelectItem value="604800">7 dias</SelectItem>
                     <SelectItem value="7776000">90 dias</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
             </div>
             <Button variant="secondary" className="w-full" onClick={fetchBlacklist} disabled={privacyLoading}>
               <Search className="w-4 h-4 mr-2" /> Ver Lista de Bloqueados
             </Button>
           </div>
         </DialogContent>
       </Dialog>

          <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 ml-auto" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Ocultar' : 'Detalhes'}
          </Button>
        </div>

        {/* Expandable details */}
        {showDetails && deviceStatus && (
          <div className="border-t border-border pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Smartphone:</span>
                <Badge variant={deviceStatus?.smartphoneConnected ? 'default' : 'secondary'} className="text-[10px]">
                  {deviceStatus?.smartphoneConnected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado:</span>
                <span>{deviceStatus?.created ? new Date(deviceStatus.created).toLocaleString('pt-BR') : 'N/A'}</span>
              </div>
            </div>
            <details className="text-[10px]">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">🔧 Debug</summary>
              <pre className="mt-1 p-2 bg-muted rounded overflow-auto max-h-32">{JSON.stringify(deviceStatus, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>

      {/* Connection Dialog */}
      <Dialog open={!isConnected && showConnect} onOpenChange={setShowConnect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">🔗 Conectar dispositivo</DialogTitle>
          </DialogHeader>
          <Tabs value={connectionTab} onValueChange={setConnectionTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="qr-code" className="flex items-center gap-2"><QrCode className="w-4 h-4" /> QR Code</TabsTrigger>
              <TabsTrigger value="phone-number" className="flex items-center gap-2"><Phone className="w-4 h-4" /> Com Número</TabsTrigger>
            </TabsList>
            <TabsContent value="qr-code" className="space-y-4">
              <div className="text-center space-y-4">
                {!qrCodeImage ? (
                  <div>
                    <Button onClick={fetchQRCode} disabled={loading} size="lg">
                      <QrCode className="w-4 h-4 mr-2" /> Gerar QR Code
                    </Button>
                    <p className="text-sm text-muted-foreground mt-2">Clique para gerar o QR Code</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-center mb-4">
                      <img src={qrCodeImage} alt="QR Code" className="w-64 h-64 border rounded-lg" />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>1. Abra o WhatsApp</p>
                      <p>2. Vá em ⋮ → <strong>Aparelhos conectados</strong></p>
                      <p>3. Toque em <strong>"Conectar um aparelho"</strong></p>
                      <p>4. Escaneie este código</p>
                    </div>
                    <div className="flex justify-center mt-4 w-full">
                      <Button variant="outline" size="sm" onClick={fetchQRCode} disabled={loading}>
                        🔄 Renovar QR Code
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="phone-number" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Número do WhatsApp</label>
                  <Input type="tel" placeholder="Ex: 5511999999999" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="text-center" />
                </div>
                <Button className="w-full" disabled={!phoneNumber || loading} onClick={fetchPairingCode}>
                  <Phone className="w-4 h-4 mr-2" /> Gerar Código de Pareamento
                </Button>
                {pairingCode && (
                  <div className="text-center space-y-3 mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    {pairingCode.startsWith('data:image') ? (
                      <>
                        <p className="text-sm text-muted-foreground mb-2">
                          Use o QR Code abaixo para concluir a conexão:
                        </p>
                        <div className="flex justify-center">
                          <img src={pairingCode} alt="QR Code" className="w-64 h-64 rounded-lg" />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-2">Seu código de pareamento:</p>
                        <div className="text-3xl font-mono font-bold tracking-wider bg-background border-2 border-primary rounded-lg py-4 px-6 text-primary">
                          {pairingCode}
                        </div>
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchPairingCode} disabled={loading}>🔄 Gerar Novo Código</Button>
                  </div>
                    <div className="flex justify-center mt-2">
                      <Button variant="outline" size="sm" onClick={fetchPairingCode} disabled={loading}>🔄 Gerar Novo Código</Button>
                    </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Configurações de Conexão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold">Instance ID</Label>
              <Input 
                value={editForm.zapi_instance_id} 
                onChange={(e) => setEditForm({...editForm, zapi_instance_id: e.target.value})}
                placeholder="Ex: 3F32C5..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold">Instance Token</Label>
              <Input 
                value={editForm.zapi_token} 
                onChange={(e) => setEditForm({...editForm, zapi_token: e.target.value})}
                placeholder="Ex: EA393E..."
                type="password"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground font-semibold">Security Token (Client Token)</Label>
              <Input 
                value={editForm.zapi_client_token} 
                onChange={(e) => setEditForm({...editForm, zapi_client_token: e.target.value})}
                placeholder="Minha Conta -> Segurança no Z-API"
                type="password"
              />
              <p className="text-[10px] text-muted-foreground">
                Este token é encontrado na aba "Segurança" dentro do painel Z-API. É o "Account Security Token".
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancelar</Button>
              <Button onClick={handleUpdateSettings} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};


const BulkProfileUpdate = ({ instances, open, onOpenChange }: { instances: ZapiInstance[]; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { toast } = useToast();
  const [profileName, setProfileName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [updating, setUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pré-seleciona todas as instâncias quando abrir / quando a lista mudar
  useEffect(() => {
    if (open) {
      setSelectedIds(instances.map((i) => i.id));
    }
  }, [open, instances]);

  const targetInstances = instances.filter((i) => selectedIds.includes(i.id));
  const allSelected = selectedIds.length === instances.length && instances.length > 0;
  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : instances.map((i) => i.id));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

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
            apiUrl: (inst as any).evolution_api_url,
            apiKey: (inst as any).evolution_api_key,
          },
        });
        if (error) {
          // Tenta extrair mensagem de erro do contexto
          const ctxMsg = (error as any)?.context?.body
            ? (() => { try { return JSON.parse((error as any).context.body)?.error; } catch { return null; } })()
            : null;
          throw new Error(ctxMsg || (error as any)?.message || 'Falha ao invocar atualização');
        }
        if (data?.error) throw new Error(data.error);
        success++;
        updatedInstanceIds.push(inst.id);
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        errors.push(`${inst.instance_name || inst.zapi_instance_id}: ${msg}`);
        console.error(`[BulkProfileUpdate] Falha em ${inst.instance_name}:`, err);
      }
    }

    setUpdating(false);
    const description = failed > 0
      ? `${success} de ${targetInstances.length} atualizada(s), ${failed} com erro:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n+${errors.length - 3} outros` : ''}`
      : `${success} instância(s) atualizada(s)`;
    toast({
      title: success > 0 ? "✅ Perfil atualizado" : "❌ Erro",
      description,
      variant: failed === targetInstances.length ? "destructive" : "default",
      duration: failed > 0 ? 8000 : 3000,
    });

    if (type === "picture" && success > 0) {
      window.dispatchEvent(
        new CustomEvent(DEVICE_PROFILE_PICTURE_UPDATED_EVENT, {
          detail: {
            value,
            instanceIds: updatedInstanceIds,
          },
        })
      );
    }
  };

  const handleUpdateName = () => {
    if (!profileName.trim()) return;
    updateAllInstances("name", profileName.trim()).then(() => setProfileName(""));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato inválido", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (máx 5MB)", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpdatePictureFile = async () => {
    if (!imageFile) return;
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ext = imageFile.name.split(".").pop() || "jpg";
      const filePath = `profile-pictures/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("template-media").upload(filePath, imageFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("template-media").getPublicUrl(filePath);
      await updateAllInstances("picture", pub.publicUrl);
      setImageFile(null);
      setPreviewUrl("");
    } catch (err) {
      toast({ title: "Erro no upload", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePictureUrl = () => {
    if (!imageUrl.trim()) return;
    updateAllInstances("picture", imageUrl.trim()).then(() => setImageUrl(""));
  };

  if (instances.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Perfil do WhatsApp</DialogTitle>
          <p className="text-sm text-muted-foreground">Altere o nome e a foto de perfil das instâncias selecionadas</p>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          {/* Seletor de instâncias */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Instâncias ({selectedIds.length}/{instances.length})</Label>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll} disabled={updating}>
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1 bg-muted/20">
              {instances.map((inst) => {
                const checked = selectedIds.includes(inst.id);
                return (
                  <label
                    key={inst.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(inst.id)}
                      disabled={updating}
                      className="accent-primary"
                    />
                    <span className="flex-1 truncate">{inst.instance_name || inst.zapi_instance_id}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Nome do Perfil</Label>
            <div className="flex gap-2">
              <Input placeholder="Novo nome para as instâncias selecionadas" value={profileName} onChange={(e) => setProfileName(e.target.value)} disabled={updating} />
              <Button onClick={handleUpdateName} disabled={updating || !profileName.trim() || selectedIds.length === 0} className="shrink-0">
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>

          {/* Photo upload */}
          <div className="space-y-2">
            <Label>Foto de Perfil (Upload)</Label>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Input type="file" accept="image/*" onChange={handleFileChange} disabled={updating} className="cursor-pointer" />
                <p className="text-xs text-muted-foreground">JPG, PNG, GIF (máx. 5MB)</p>
              </div>
              {previewUrl && <img src={previewUrl} alt="Prévia" className="w-12 h-12 rounded-full object-cover border" />}
            </div>
            {imageFile && (
              <Button onClick={handleUpdatePictureFile} disabled={updating || selectedIds.length === 0} size="sm">
                {updating ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Enviando...</> : <><Upload className="w-3 h-3 mr-1" /> Aplicar foto às selecionadas</>}
              </Button>
            )}
          </div>

          {/* Photo URL */}
          <div className="space-y-2">
            <Label>Foto de Perfil (URL)</Label>
            <div className="flex gap-2">
              <Input type="url" placeholder="https://exemplo.com/foto.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={updating} />
              <Button onClick={handleUpdatePictureUrl} disabled={updating || !imageUrl.trim() || selectedIds.length === 0} className="shrink-0">
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ImageIcon className="w-4 h-4 mr-1" /> Aplicar</>}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


const BulkCreateCollection = ({ instances, open, onOpenChange }: { instances: ZapiInstance[]; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const initialIds = instances.map((i) => i.id);
      setSelectedIds(initialIds);
      fetchAvailableProducts(initialIds);
    }
  }, [open, instances]);

  const fetchAvailableProducts = async (ids: string[]) => {
    if (ids.length === 0) {
      setAvailableProducts([]);
      return;
    }
    setLoadingProducts(true);
    try {
      // Tenta buscar da primeira instância selecionada
      const targetId = ids[0];
      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action: "list-products", instanceDbId: targetId },
      });
      if (error) throw error;
      let products = data?.data?.products || data?.data?.value || [];
      if (!Array.isArray(products)) products = [];
      setAvailableProducts(products);
    } catch (err) {
      console.error("Erro ao buscar produtos para coleção:", err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const allSelected = selectedIds.length === instances.length && instances.length > 0;
  const toggleAll = () => setSelectedIds(allSelected ? [] : instances.map((i) => i.id));
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async () => {
    const collectionName = name.trim();
    const productIds = selectedProductIds;

    if (!collectionName) {
      toast({ title: "Informe o nome da coleção", variant: "destructive" });
      return;
    }
    if (productIds.length === 0) {
      toast({ title: "Adicione ao menos um ID de produto", variant: "destructive" });
      return;
    }
    const targets = instances.filter((i) => selectedIds.includes(i.id));
    if (targets.length === 0) {
      toast({ title: "Selecione ao menos uma instância", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const inst of targets) {
      try {
        const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
          body: {
            action: "create-collection",
            instanceDbId: inst.id,
            payload: {
              name: collectionName,
              products: productIds.map((id) => ({ id })),
            },
          },
        });
        if (error) {
          const msg = await getInvokeErrorMessage(error, "Falha ao criar coleção");
          throw new Error(msg);
        }
        if ((data as any)?.error) throw new Error((data as any).error);
        success++;
      } catch (err) {
        failed++;
        errors.push(`${inst.instance_name || inst.zapi_instance_id}: ${err instanceof Error ? err.message : "Erro"}`);
      }
    }

    setSubmitting(false);
    toast({
      title: success > 0 ? "✅ Coleção criada" : "❌ Erro",
      description:
        failed > 0
          ? `${success} de ${targets.length} criada(s). Erros:\n${errors.slice(0, 3).join("\n")}${errors.length > 3 ? `\n+${errors.length - 3} outros` : ""}`
          : `Coleção criada em ${success} instância(s)`,
      variant: failed === targets.length ? "destructive" : "default",
      duration: failed > 0 ? 8000 : 3000,
    });

    if (success > 0) {
      setName("");
      setSelectedProductIds([]);
    }
  };

  if (instances.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" /> Criar Coleção do Catálogo
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Crie uma coleção a partir de produtos do catálogo do WhatsApp Business nas instâncias selecionadas.
          </p>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Instâncias ({selectedIds.length}/{instances.length})</Label>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll} disabled={submitting}>
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1 bg-muted/20">
              {instances.map((inst) => (
                <label
                  key={inst.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(inst.id)}
                    onChange={() => toggleOne(inst.id)}
                    disabled={submitting}
                    className="accent-primary"
                  />
                  <span className="flex-1 truncate">{inst.instance_name || inst.zapi_instance_id}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome da Coleção</Label>
            <Input
              placeholder="Ex.: Lançamentos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-3">
            <Label className="flex items-center justify-between">
              <span>Produtos ({selectedProductIds.length})</span>
              {loadingProducts && <Loader2 className="w-3 h-3 animate-spin" />}
            </Label>
            
            <div className="border border-border rounded-xl p-3 bg-muted/10 space-y-3">
              <div className="flex flex-wrap gap-2 min-h-[40px] empty:after:content-['Selecione_produtos_abaixo'] empty:after:text-[10px] empty:after:text-muted-foreground empty:after:italic">
                {selectedProductIds.map(id => {
                  const product = availableProducts.find(p => p.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="gap-1.5 py-1 px-2.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors group">
                      <span className="text-[11px] font-medium">{product?.name || id}</span>
                      <button 
                        onClick={() => setSelectedProductIds(prev => prev.filter(x => x !== id))}
                        className="text-primary/40 hover:text-destructive transition-colors"
                        disabled={submitting}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>

              <div className="relative">
                <Select 
                  onValueChange={(val) => {
                    if (val && !selectedProductIds.includes(val)) {
                      setSelectedProductIds(prev => [...prev, val]);
                    }
                  }}
                  disabled={submitting || loadingProducts || availableProducts.length === 0}
                >
                  <SelectTrigger className="w-full bg-background border-primary/10 hover:border-primary/30 transition-all">
                    <SelectValue placeholder={availableProducts.length === 0 ? "Nenhum produto encontrado" : "Adicionar produto..."} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {availableProducts
                      .filter(p => !selectedProductIds.includes(p.id))
                      .map(product => (
                        <SelectItem key={product.id || Math.random().toString()} value={String(product.id || '')} className="cursor-pointer">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{product.name}</span>
                            <span className="text-[10px] text-muted-foreground opacity-70 font-mono">ID: {product.id}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5 px-1">
              <AlertCircle className="w-3 h-3" /> Selecione os produtos do catálogo para criar a coleção
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || selectedProductIds.length === 0 || selectedIds.length === 0}
            className="w-full shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Criando...</>
            ) : (
              <><LayoutGrid className="w-4 h-4 mr-2" /> Criar nas {selectedIds.length} instância(s)</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BusinessProfilePreview = ({
  description,
  email,
  address,
  websites,
  categories,
  businessHoursType,
  days,
}: {
  description: string;
  email: string;
  address: string;
  websites: string[];
  categories: string[];
  businessHoursType: string;
  days: any;
}) => {
  const dayLabels: Record<string, string> = {
    monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua', thursday: 'Qui',
    friday: 'Sex', saturday: 'Sáb', sunday: 'Dom',
  };
  const hoursLabel =
    businessHoursType === 'open_24h' ? 'Aberto 24 horas' :
    businessHoursType === 'appointment_only' ? 'Apenas com hora marcada' : null;

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-[#0b141a] shadow-xl">
      {/* Header */}
      <div className="bg-[#202c33] px-3 py-2.5 flex items-center gap-2">
        <span className="text-[#aebac1] text-sm">←</span>
        <p className="text-[13px] font-medium text-[#e9edef]">Perfil comercial</p>
      </div>

      {/* Avatar + nome */}
      <div className="bg-[#202c33] flex flex-col items-center pt-5 pb-4 px-4 border-b border-[#0b141a]">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00a884] to-[#005c4b] flex items-center justify-center mb-2.5">
          <Building2 className="w-9 h-9 text-white/90" />
        </div>
        <p className="text-[14px] font-semibold text-[#e9edef]">Sua Empresa</p>
        <p className="text-[10px] text-[#8696a0] mt-0.5">Conta comercial</p>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mt-2">
            {categories.map((c, i) => (
              <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Descrição */}
      <div className="bg-[#202c33] px-4 py-3 mt-1.5">
        <p className="text-[10px] text-[#8696a0] mb-1">Sobre</p>
        <p className="text-[11.5px] text-[#e9edef] leading-snug whitespace-pre-wrap break-words min-h-[16px]">
          {description || <span className="text-[#8696a0] italic">Adicione uma descrição</span>}
        </p>
      </div>

      {/* Endereço */}
      <div className="bg-[#202c33] px-4 py-3 mt-1.5">
        <p className="text-[10px] text-[#8696a0] mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Endereço</p>
        <p className="text-[11.5px] text-[#e9edef] break-words min-h-[16px]">
          {address || <span className="text-[#8696a0] italic">—</span>}
        </p>
      </div>

      {/* Horário */}
      <div className="bg-[#202c33] px-4 py-3 mt-1.5">
        <p className="text-[10px] text-[#8696a0] mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Horário</p>
        {hoursLabel ? (
          <p className="text-[11.5px] text-[#00a884]">{hoursLabel}</p>
        ) : (
          <div className="space-y-0.5">
            {Object.entries(days).map(([d, cfg]: [string, any]) => (
              <div key={d} className="flex justify-between text-[11px]">
                <span className="text-[#aebac1]">{dayLabels[d]}</span>
                <span className={cfg.open ? 'text-[#e9edef]' : 'text-[#8696a0]'}>
                  {cfg.open ? `${cfg.start} – ${cfg.end}` : 'Fechado'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email */}
      <div className="bg-[#202c33] px-4 py-3 mt-1.5">
        <p className="text-[10px] text-[#8696a0] mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> E-mail</p>
        <p className="text-[11.5px] text-[#e9edef] break-all min-h-[16px]">
          {email || <span className="text-[#8696a0] italic">—</span>}
        </p>
      </div>

      {/* Websites */}
      <div className="bg-[#202c33] px-4 py-3 mt-1.5 mb-1.5">
        <p className="text-[10px] text-[#8696a0] mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Websites</p>
        {websites.length === 0 ? (
          <p className="text-[11.5px] text-[#8696a0] italic">—</p>
        ) : (
          <div className="space-y-0.5">
            {websites.map((w, i) => (
              <p key={i} className="text-[11.5px] text-[#53bdeb] break-all">{w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const BulkBusinessInfo = ({ instances, open, onOpenChange }: { instances: ZapiInstance[]; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [websites, setWebsites] = useState("");
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
   const [businessHoursType, setBusinessHoursType] = useState<string>("open_24h");
   const [days, setDays] = useState<any>({
     monday: { open: false, start: "08:00", end: "18:00" },
     tuesday: { open: false, start: "08:00", end: "18:00" },
     wednesday: { open: false, start: "08:00", end: "18:00" },
     thursday: { open: false, start: "08:00", end: "18:00" },
     friday: { open: false, start: "08:00", end: "18:00" },
     saturday: { open: false, start: "08:00", end: "18:00" },
     sunday: { open: false, start: "08:00", end: "18:00" }
   });
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedIds(instances.map((i) => i.id));
  }, [open, instances]);

  useEffect(() => {
    if (open && availableCategories.length === 0 && !loadingCategories) {
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      // Use the first selected instance or the first available instance to fetch categories
      const targetInstance = instances.find(i => selectedIds.includes(i.id)) || instances[0];
      if (!targetInstance) return;

      const { data, error } = await supabase.functions.invoke("zapi-chat-actions", {
        body: { action: 'available-categories', instanceDbId: targetInstance.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error?.message || data.error);
      
      const categories = data?.data || [];
      setAvailableCategories(Array.isArray(categories) ? categories : []);
    } catch (err: any) {
      console.error("Erro ao buscar categorias:", err);
      toast({ title: "Erro ao buscar categorias", description: err.message, variant: "destructive" });
    } finally {
      setLoadingCategories(false);
    }
  };

  const allSelected = selectedIds.length === instances.length && instances.length > 0;
  const toggleAll = () => setSelectedIds(allSelected ? [] : instances.map((i) => i.id));
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
        if (error) {
          const msg = await getInvokeErrorMessage(error, "Falha");
          throw new Error(msg);
        }
        if ((data as any)?.error) throw new Error((data as any).error?.message || (data as any).error);
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

  if (instances.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> Perfil da Empresa</DialogTitle>
          <p className="text-sm text-muted-foreground">Atualize as informações comerciais nas instâncias selecionadas.</p>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 pt-2">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Instâncias ({selectedIds.length}/{instances.length})</Label>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll} disabled={!!submitting}>
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>
            <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1 bg-muted/20">
              {instances.map((inst) => (
                <label key={inst.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedIds.includes(inst.id)} onChange={() => toggleOne(inst.id)} disabled={!!submitting} className="accent-primary" />
                  <span className="flex-1 truncate">{inst.instance_name || inst.zapi_instance_id}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Edit2 className="w-3 h-3" /> Descrição</Label>
            <div className="flex gap-2">
              <Input placeholder="Ex: Venda de eletrônicos..." value={description} onChange={(e) => setDescription(e.target.value)} disabled={!!submitting} />
              <Button size="sm" onClick={() => applyToAll('company-description', { description }, 'Descrição')} disabled={!!submitting || !description.trim() || selectedIds.length === 0}>
                {submitting === 'company-description' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Mail className="w-3 h-3" /> E-mail</Label>
            <div className="flex gap-2">
              <Input type="email" placeholder="contato@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!submitting} />
              <Button size="sm" onClick={() => applyToAll('company-email', { email }, 'E-mail')} disabled={!!submitting || !email.trim() || selectedIds.length === 0}>
                {submitting === 'company-email' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Endereço</Label>
            <div className="flex gap-2">
              <Input placeholder="Rua Exemplo, 123..." value={address} onChange={(e) => setAddress(e.target.value)} disabled={!!submitting} />
              <Button size="sm" onClick={() => applyToAll('company-address', { address }, 'Endereço')} disabled={!!submitting || !address.trim() || selectedIds.length === 0}>
                {submitting === 'company-address' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="w-3 h-3" /> Websites (um por linha, máx. 2)
            </Label>
            <div className="flex gap-2 items-start">
               <Textarea 
                 placeholder="Ex:&#10;https://loja.com&#10;https://instagram.com/loja" 
                 value={websites} 
                 onChange={(e) => setWebsites(e.target.value)} 
                 disabled={!!submitting} 
                 rows={3} 
               />
                <Button 
                  size="sm" 
                  onClick={() => {
                    const urls = websites.split('\n')
                      .map(s => s.trim())
                      .filter(Boolean)
                      .slice(0, 2);
                    applyToAll('company-websites', { websites: urls }, 'Websites');
                  }} 
                  disabled={!!submitting || !websites.trim() || selectedIds.length === 0}
                >
                 {submitting === 'company-websites' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
               </Button>
             </div>
           </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <LayoutGrid className="w-3 h-3" /> Categorias (máx. 3)
            </Label>
            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <Select 
                  value="" 
                  onValueChange={(val) => {
                    if (val && !selectedCategories.includes(val) && selectedCategories.length < 3) {
                      setSelectedCategories(prev => [...prev, val]);
                    }
                  }} 
                  disabled={!!submitting || loadingCategories || selectedCategories.length >= 3}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingCategories ? "Carregando..." : (selectedCategories.length >= 3 ? "Limite atingido" : "Adicionar categoria")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories
                      .filter(cat => !selectedCategories.includes(cat.id))
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.displayName || cat.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                
                {selectedCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedCategories.map(catId => {
                      const cat = availableCategories.find(c => c.id === catId);
                      return (
                        <div key={catId} className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-primary/20">
                          {cat?.displayName || cat?.label || catId}
                          <button onClick={() => setSelectedCategories(prev => prev.filter(id => id !== catId))} className="hover:text-destructive ml-1 font-bold">
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button 
                  size="sm" 
                  onClick={() => applyToAll('company-categories', { categories: selectedCategories }, 'Categorias')} 
                  disabled={!!submitting || selectedCategories.length === 0 || selectedIds.length === 0}
                >
                  {submitting === 'company-categories' ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                </Button>
                {selectedCategories.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCategories([])} className="h-7 text-[10px] text-muted-foreground">
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </div>
 
            <div className="space-y-4 border-t pt-4">
             <Label className="flex items-center gap-2"><Clock className="w-4 h-4" /> Horário de Funcionamento</Label>
             
             <div className="space-y-3">
               <Select value={businessHoursType} onValueChange={setBusinessHoursType} disabled={!!submitting}>
                 <SelectTrigger>
                   <SelectValue placeholder="Tipo de horário" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="open_24h">Aberto 24 horas</SelectItem>
                   <SelectItem value="appointment_only">Apenas com hora marcada</SelectItem>
                   <SelectItem value="specific_hours">Horários específicos</SelectItem>
                 </SelectContent>
               </Select>
 
               {businessHoursType === 'specific_hours' && (
                 <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-border/50">
                   {Object.entries(days).map(([day, config]: [string, any]) => (
                     <div key={day} className="flex items-center justify-between gap-2 py-1 border-b last:border-0 border-border/30">
                       <div className="flex items-center gap-2 min-w-[100px]">
                         <input 
                           type="checkbox" 
                           checked={config.open} 
                           onChange={(e) => setDays({...days, [day]: { ...config, open: e.target.checked }})}
                           className="accent-primary"
                         />
                         <span className="text-sm capitalize">
                           {day === 'monday' ? 'Segunda' : 
                            day === 'tuesday' ? 'Terça' : 
                            day === 'wednesday' ? 'Quarta' : 
                            day === 'thursday' ? 'Quinta' : 
                            day === 'friday' ? 'Sexta' : 
                            day === 'saturday' ? 'Sábado' : 'Domingo'}
                         </span>
                       </div>
                       
                       <div className="flex items-center gap-1">
                         <Input 
                           type="time" 
                           className="h-8 w-24 text-xs px-2" 
                           value={config.start} 
                           disabled={!config.open}
                           onChange={(e) => setDays({...days, [day]: { ...config, start: e.target.value }})}
                         />
                         <span className="text-xs">às</span>
                         <Input 
                           type="time" 
                           className="h-8 w-24 text-xs px-2" 
                           value={config.end} 
                           disabled={!config.open}
                           onChange={(e) => setDays({...days, [day]: { ...config, end: e.target.value }})}
                         />
                       </div>
                     </div>
                   ))}
                 </div>
               )}
 
                <Button 
                  className="w-full" 
                  onClick={() => {
                    const modeMap: Record<string, string> = {
                      open_24h: 'open24h',
                      appointment_only: 'appointmentOnly',
                      specific_hours: 'specificHours',
                    };
                    const payload: any = {
                      timezone: "America/Sao_Paulo",
                      mode: modeMap[businessHoursType] || 'open24h',
                    };
                    if (businessHoursType === 'specific_hours') {
                      payload.days = Object.entries(days)
                        .filter(([, cfg]: [string, any]) => cfg.open)
                        .map(([day, cfg]: [string, any]) => ({
                          dayOfWeek: day.toUpperCase(),
                          openTime: cfg.start,
                          closeTime: cfg.end,
                        }));
                    }
                    applyToAll('business-hours', payload, 'Horário de Funcionamento');
                  }} 
                  disabled={!!submitting || selectedIds.length === 0}
                >
                 {submitting === 'business-hours' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                 Aplicar Horário às Selecionadas
               </Button>
             </div>
           </div>
        </div>

        {/* Preview do Perfil */}
        <div className="hidden md:block">
          <div className="sticky top-0">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Building2 className="w-3 h-3" /> Pré-visualização
            </p>
            <BusinessProfilePreview
              description={description}
              email={email}
              address={address}
              websites={websites.split('\n').map(s => s.trim()).filter(Boolean)}
              categories={selectedCategories
                .map((id) => availableCategories.find((c) => c.id === id))
                .filter(Boolean)
                .map((c: any) => c.displayName || c.label || '')}
              businessHoursType={businessHoursType}
              days={days}
            />
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Dispositivos = () => {
  const { instances: allInstances, loading, refetch } = useZapiInstances({ provider: 'zapi' });
    // Exibir apenas instâncias de uso (Z-API Web), ocultando legados Mobile e instâncias UAZAPI (Apanhador)
    const instances = useMemo(() => {
      return allInstances.filter(
         (i) => (i.api_provider || 'zapi') === 'zapi' && !isMobileZapiInstance(i) && !(i.api_provider || '').includes('uazapi')
      );
    }, [allInstances]);

  const { toast } = useToast();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [businessDialogOpen, setBusinessDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Dispositivos ({instances.length})</h1>
        <div className="flex items-center gap-2">
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setProfileDialogOpen(true)}>
              <User className="w-4 h-4 mr-1" />
              Perfil WhatsApp
            </Button>
          )}
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setCollectionDialogOpen(true)}>
              <LayoutGrid className="w-4 h-4 mr-1" />
              Criar Coleção
            </Button>
          )}
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setProductDialogOpen(true)}>
              <Package className="w-4 h-4 mr-1" />
              Criar Produto
            </Button>
          )}
          {instances.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setBusinessDialogOpen(true)}>
              <Building2 className="w-4 h-4 mr-1" />
              Perfil da Empresa
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {instances.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma instância configurada</h3>
            <p className="text-muted-foreground mb-4">
              Crie sua primeira instância para começar a enviar mensagens.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {instances.map((instance) => (
          <DeviceCard key={instance.id} instance={instance} onDeleted={refetch} />
        ))}
      </div>

      {/* Bulk Profile Update Dialog */}
      <BulkProfileUpdate instances={instances} open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />

      {/* Bulk Create Collection Dialog */}
      <BulkCreateCollection instances={instances} open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen} />

      {/* Bulk Create Product Dialog */}
      <BulkCreateProduct instances={instances} open={productDialogOpen} onOpenChange={setProductDialogOpen} />

      {/* Bulk Business Info Dialog */}
      <BulkBusinessInfo instances={instances} open={businessDialogOpen} onOpenChange={setBusinessDialogOpen} />

      {/* Planos */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">📋 Planos e Assinaturas</CardTitle>
          <CardDescription>Escolha o plano ideal para suas necessidades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Plano Start", price: "R$100/mês", features: ["Mensagens ilimitadas", "1 instância", "Suporte básico"], link: "https://pay.zaplynxpro.online/pay/plano-start-704549" },
              { name: "Plano Pro", price: "R$349/mês", features: ["Mensagens ilimitadas", "5 instâncias", "Suporte prioritário"], link: "https://pay.zaplynxpro.online/pay/plano-pro-716484", popular: true },
              { name: "Plano Scale", price: "R$897/mês", features: ["Mensagens ilimitadas", "10 instâncias", "Suporte VIP"], link: "https://pay.zaplynxpro.online/pay/plano-scale-731140" },
            ].map((plan, i) => (
              <a
                key={i}
                href={plan.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col p-5 rounded-xl border transition-all hover:-translate-y-1 hover:shadow-lg ${
                  plan.popular
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-foreground">{plan.name}</p>
                  {plan.popular && (
                    <Badge className="text-[10px] bg-primary text-primary-foreground">POPULAR</Badge>
                  )}
                </div>
                <p className="text-2xl font-bold text-primary mb-3">{plan.price}</p>
                <ul className="text-xs text-muted-foreground space-y-1.5 mb-4 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-1.5">
                      <span className="text-primary">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.popular ? "default" : "outline"} size="sm" className="w-full">
                  Assinar →
                </Button>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dispositivos;
