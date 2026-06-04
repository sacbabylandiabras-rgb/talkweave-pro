import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, Link as LinkIcon, Loader2, Check, Send, Search, Package, LogIn, KeyRound, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Source = "ml" | "shopee" | "amazon";

interface AffiliateProduct {
  id: string | number;
  name: string;
  price: string;
  source: Source;
  link: string;
  thumbnail?: string | null;
  originalPrice?: string | null;
  discount?: number | null;
}

const MOCK_PRODUCTS: AffiliateProduct[] = [
  { id: 1, name: "Fone Bluetooth JBL Tune 510BT", price: "R$ 189,90", source: "ml", link: "https://mercadolivre.com.br/p/MLB1234" },
  { id: 2, name: "Tênis Nike Air Max 270 Masculino", price: "R$ 479,99", source: "shopee", link: "https://shopee.com.br/p/5678" },
  { id: 3, name: "Câmera de Segurança TP-Link Tapo", price: "R$ 219,00", source: "amazon", link: "https://amzn.to/3abc" },
  { id: 4, name: "Smartwatch Samsung Galaxy Watch 6", price: "R$ 1.299,00", source: "ml", link: "https://mercadolivre.com.br/p/MLB9999" },
  { id: 5, name: "Carregador Turbo 65W USB-C GaN", price: "R$ 89,90", source: "shopee", link: "https://shopee.com.br/p/1122" },
  { id: 6, name: "Livro: O Poder do Hábito", price: "R$ 34,90", source: "amazon", link: "https://amzn.to/4def" },
];

const SOURCE_META: Record<Source, { label: string; className: string }> = {
  ml: { label: "ML", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  shopee: { label: "Shopee", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  amazon: { label: "Amazon", className: "bg-zinc-200 text-zinc-800 hover:bg-zinc-200" },
};

interface MlCreds { clientId: string; clientSecret: string }
interface ShopeeCreds { appId: string; secretKey: string; affiliateId: string }
interface AmazonCreds { accessKey: string; secretKey: string; associateTag: string; locale: string }

export default function Afiliados() {
  const [mlCreds, setMlCreds] = useState<MlCreds>({ clientId: "", clientSecret: "" });
  const [shopeeCreds, setShopeeCreds] = useState<ShopeeCreds>({ appId: "", secretKey: "", affiliateId: "" });
  const [amazonCreds, setAmazonCreds] = useState<AmazonCreds>({ accessKey: "", secretKey: "", associateTag: "", locale: "BR" });

  const [connected, setConnected] = useState<Record<Source, boolean>>({ ml: false, shopee: false, amazon: false });
  const [connecting, setConnecting] = useState<Source | null>(null);
  const [authMode, setAuthMode] = useState<Record<Source, "oauth" | "manual">>({
    ml: "oauth",
    shopee: "oauth",
    amazon: "oauth",
  });
  const [connectedAccount, setConnectedAccount] = useState<Record<Source, string | null>>({
    ml: null,
    shopee: null,
    amazon: null,
  });

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);

  const [destination, setDestination] = useState("");
  const [sending, setSending] = useState(false);
  const [availableInstances, setAvailableInstances] = useState<any[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");

  // Carrega conexões do usuário
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      // Carrega status do Mercado Livre
      try {
        const { data: mlStatus, error: mlError } = await supabase.functions.invoke("mercadolivre-connection-status", {
          body: {},
        });
        
        if (mlError) {
          console.error("Error checking ML connection:", mlError);
        } else if ((mlStatus as any)?.connected) {
          setConnected((prev) => ({ ...prev, ml: true }));
          setConnectedAccount((prev) => ({
            ...prev,
            ml: (mlStatus as any).nickname || (mlStatus as any).accountId || "Conta conectada",
          }));
          
          // Only auto-load if we don't have products yet
          loadDeals();
        }
      } catch (err) {
        console.error("Caught error checking ML connection:", err);
      }

      // Carrega instâncias Z-API
      const { data: instances } = await supabase
        .from('zapi_instances')
        .select('zapi_instance_id, instance_name, is_default, api_provider')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .eq('api_provider', 'zapi');
      
      if (instances && instances.length > 0) {
        setAvailableInstances(instances);
        const defaultInst = instances.find(i => i.is_default) || instances[0];
        setSelectedInstanceId(defaultInst.zapi_instance_id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDeals = async (categoryId?: string | null, isLoadMore = false) => {
    const nextCategory = categoryId !== undefined ? categoryId : selectedNiche;
    const finalCategory = nextCategory || null;
    const nextOffset = isLoadMore ? offset + (products.length > 0 ? products.length : 0) : 0;
    
    setLoadingProducts(true);
    if (categoryId !== undefined) setSelectedNiche(categoryId);
    
    try {
      const { data, error } = await supabase.functions.invoke("mercadolivre-search-products", {
        body: { 
          mode: "deals", 
          limit: 50, 
          offset: nextOffset, 
          category: finalCategory,
          q: finalCategory ? undefined : "ofertas"
        },
      });
      if (error) throw error;
      
      const list = (data?.products || []) as AffiliateProduct[];
      if (isLoadMore) {
        setProducts(prev => {
          const ids = new Set(prev.map(p => p.id));
          return [...prev, ...list.filter(p => !ids.has(p.id))];
        });
        setOffset(nextOffset);
      } else {
        setProducts(list);
        setOffset(0);
        setSelectedIds(new Set());
      }
      setTotalProducts(data?.total || null);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar promoções.");
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleConnect = async (source: Source) => {
    const valid =
      source === "ml" ? mlCreds.clientId && mlCreds.clientSecret :
      source === "shopee" ? shopeeCreds.appId && shopeeCreds.secretKey && shopeeCreds.affiliateId :
      amazonCreds.accessKey && amazonCreds.secretKey && amazonCreds.associateTag && amazonCreds.locale;

    if (!valid) {
      toast.error("Preencha todas as credenciais antes de conectar.");
      return;
    }

    setConnecting(source);
    await new Promise((r) => setTimeout(r, 1500));
    setConnected((prev) => ({ ...prev, [source]: true }));
    setConnecting(null);
    toast.success(`Marketplace conectado com sucesso!`);
  };

  const handleOAuthConnect = async (source: Source) => {
    setConnecting(source);

    // Mercado Livre: OAuth real via edge function
    if (source === "ml") {
      try {
        const { data, error } = await supabase.functions.invoke("mercadolivre-oauth-start", {
          body: {},
        });
        if (error || (data as any)?.error || !(data as any)?.authUrl) {
          throw new Error((data as any)?.error || error?.message || "Falha ao iniciar conexão");
        }
        // Redireciona para o login do Mercado Livre
        window.location.href = (data as any).authUrl;
        return;
      } catch (e) {
        setConnecting(null);
        toast.error(e instanceof Error ? e.message : "Erro ao conectar.");
        return;
      }
    }

    // Demais marketplaces: ainda em mock (simulação)
    await new Promise((r) => setTimeout(r, 1800));
    const fakeAccounts: Record<Source, string> = {
      ml: "minha-conta@mercadolivre",
      shopee: "afiliado_shopee_123",
      amazon: "associate-br-001",
    };
    setConnected((prev) => ({ ...prev, [source]: true }));
    setConnectedAccount((prev) => ({ ...prev, [source]: fakeAccounts[source] }));
    setConnecting(null);
    toast.success(`Conta conectada com sucesso!`);
  };

  const handleDisconnect = async (source: Source) => {
    if (source === "ml") {
      await supabase.functions.invoke("mercadolivre-disconnect", { body: {} });
    }
    setConnected((prev) => ({ ...prev, [source]: false }));
    setConnectedAccount((prev) => ({ ...prev, [source]: null }));
    toast.success("Conta desconectada.");
  };

  const AuthModeSwitch = ({ source }: { source: Source }) => (
    <div className="inline-flex p-1 rounded-xl bg-muted gap-1">
      <button
        type="button"
        onClick={() => setAuthMode((p) => ({ ...p, [source]: "oauth" }))}
        className={cn(
          "px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all",
          authMode[source] === "oauth" ? "bg-background shadow-sm" : "text-muted-foreground",
        )}
      >
        <LogIn className="w-3.5 h-3.5" /> Login com a conta
      </button>
      <button
        type="button"
        onClick={() => setAuthMode((p) => ({ ...p, [source]: "manual" }))}
        className={cn(
          "px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all",
          authMode[source] === "manual" ? "bg-background shadow-sm" : "text-muted-foreground",
        )}
      >
        <KeyRound className="w-3.5 h-3.5" /> Credenciais
      </button>
    </div>
  );

  const ConnectedBanner = ({ source }: { source: Source }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-green-200 bg-green-50">
      <div className="flex items-center gap-2 text-sm">
        <Check className="w-4 h-4 text-green-600" />
        <span className="text-green-800">
          Conectado{connectedAccount[source] ? ` como ` : ""}
          {connectedAccount[source] && <strong>{connectedAccount[source]}</strong>}
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={() => handleDisconnect(source)}>
        Desconectar
      </Button>
    </div>
  );

  const OAuthButton = ({ source, label }: { source: Source; label: string }) => (
    <Button onClick={() => handleOAuthConnect(source)} disabled={connecting === source} size="lg" className="w-full md:w-auto">
      {connecting === source ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
      {label}
    </Button>
  );

  const fetchProducts = async (isLoadMore = false) => {
    if (!connected.ml) {
      toast.error("Conecte ao menos um marketplace primeiro.");
      return;
    }

    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      toast.error("Digite o que você quer buscar.");
      return;
    }
    
    const nextOffset = isLoadMore ? offset + 50 : 0;
    setLoadingProducts(true);
    
    try {
      console.log("Buscando por:", trimmedQuery, "offset:", nextOffset);

      const { data, error } = await supabase.functions.invoke("mercadolivre-search-products", {
        body: { 
          q: trimmedQuery,
          query: trimmedQuery, 
          mode: "search",
          limit: 50, 
          offset: nextOffset,
          site: "MLB"
        },
      });

      if (error) throw new Error(error.message);
      
      console.log("Resposta da edge function:", data);

      if ((data as any)?.error && !(data as any)?.products) {
        toast.error((data as any).error);
        return;
      }

      const list = ((data as any)?.products || []) as AffiliateProduct[];
      
      if (isLoadMore) {
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          return [...prev, ...list.filter(p => !existingIds.has(p.id))];
        });
        setOffset(nextOffset);
      } else {
        setProducts(list);
        setOffset(0);
        setSelectedIds(new Set());
      }

      setTotalProducts((data as any)?.total || null);
      
      console.log("Produtos formatados:", list);

      if (list.length === 0) {
        toast.info(isLoadMore ? "Não há mais produtos." : "Nenhum produto encontrado.");
      } else if (!isLoadMore) {
        toast.success(`${list.length} produtos encontrados.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar produtos.");
      console.error(e);
    } finally {
      setLoadingProducts(false);
    }
  };

  const toggleSelect = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const idStr = String(id);
      
      // Verifica se o ID já está selecionado comparando como string
      let existingItem: string | number | null = null;
      for (const item of next) {
        if (String(item) === idStr) {
          existingItem = item;
          break;
        }
      }

      if (existingItem !== null) {
        next.delete(existingItem);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedProducts = useMemo(
    () => products.filter((p) => {
      const idStr = String(p.id);
      for (const selectedId of selectedIds) {
        if (String(selectedId) === idStr) return true;
      }
      return false;
    }),
    [products, selectedIds],
  );

  const previewMessage = useMemo(() => {
    if (selectedProducts.length === 0) return "Selecione ao menos um produto para gerar a mensagem.";
    
    // Para 1 produto
    if (selectedProducts.length === 1) {
      const p = selectedProducts[0];
      return `🛍️ *${p.name}*\n💰 ${p.price}\n\n[Botão: Ver Oferta 🚀]`;
    }

    // Para 2 a 3 produtos
    if (selectedProducts.length > 1 && selectedProducts.length <= 3) {
      const items = selectedProducts
        .map((p, idx) => `🛍️ *${p.name}*\n💰 ${p.price}\n[Botão: Comprar Item ${idx + 1} 🛒]`)
        .join("\n\n");
      return `✨ *Ofertas selecionadas para você!*\n\n${items}`;
    }

    // Para mais de 3 produtos (limite de botões do WhatsApp)
    const items = selectedProducts
      .map((p) => `🛍️ *${p.name}*\n💰 ${p.price}\n🔗 ${p.link}`)
      .join("\n\n");
    return `✨ *Ofertas selecionadas para você!*\n\n${items}`;
  }, [selectedProducts]);

  const handleSend = async () => {
    if (selectedProducts.length === 0) {
      toast.error("Selecione ao menos um produto.");
      return;
    }
    if (!destination.trim()) {
      toast.error("Informe o número ou grupo do WhatsApp.");
      return;
    }

    setSending(true);
    try {
      // Se tiver apenas um produto, envia como imagem com legenda e BOTÃO
      if (selectedProducts.length === 1) {
        const product = selectedProducts[0];
        const caption = `🛍️ *${product.name}*\n💰 ${product.price}`;
        
        const { data, error } = await supabase.functions.invoke("send-message", {
          body: {
            phone: destination.trim(),
            message: caption,
            mediaUrl: product.thumbnail || undefined,
            mediaType: product.thumbnail ? "image" : undefined,
            instanceId: selectedInstanceId || undefined,
            buttonActions: [
              {
                id: "1",
                type: "URL",
                label: "Ver Oferta 🚀",
                url: product.link
              }
            ]
          },
        });

        if (error) throw new Error(error.message);
        toast.success(`Oferta enviada com sucesso para ${destination}!`);
      } else if (selectedProducts.length > 1 && selectedProducts.length <= 3) {
        // Se tiver entre 2 e 3, envia com botões para cada produto
        const buttons = selectedProducts.map((p, idx) => ({
          id: String(idx + 1),
          type: "URL" as const,
          label: `Comprar Item ${idx + 1} 🛒`,
          url: p.link
        }));

        const cleanMessage = previewMessage.replace(/\[Botão: .*?\]/g, "").trim();

        const { data, error } = await supabase.functions.invoke("send-message", {
          body: {
            phone: destination.trim(),
            message: cleanMessage,
            instanceId: selectedInstanceId || undefined,
            buttonActions: buttons
          },
        });

        if (error) throw new Error(error.message);
        toast.success(`Mensagem com botões enviada para ${destination}!`);
      } else {
        // Se tiver mais de 3, envia a mensagem de texto com links normalmente (limite do WhatsApp para botões nativos)
        const { data, error } = await supabase.functions.invoke("send-message", {
          body: {
            phone: destination.trim(),
            message: previewMessage,
            instanceId: selectedInstanceId || undefined,
          },
        });

        if (error) {
          if (error.message?.includes("whatsapp is disconnected") || (data as any)?.error?.includes("disconnected")) {
            throw new Error("O WhatsApp desta instância está desconectado. Por favor, conecte o celular em Dispositivos.");
          }
          throw new Error(error.message);
        }
        
        toast.success(`Mensagem enviada com sucesso para ${destination}!`);
      }
    } catch (e) {
      console.error("Erro ao enviar mensagem:", e);
      toast.error(e instanceof Error ? e.message : "Erro ao enviar mensagem via WhatsApp.");
    } finally {
      setSending(false);
    }
  };

  const StatusDot = ({ active }: { active: boolean }) => (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full",
        active ? "bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]" : "bg-red-500",
      )}
    />
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Afiliados
          </h1>
          <p className="text-muted-foreground">
            Conecte marketplaces, busque produtos e envie ofertas pelo ZapLynx.
          </p>
        </div>
        
        {connected.ml && (
          <Badge variant="outline" className="py-1.5 px-3 flex items-center gap-2 bg-green-50 text-green-700 border-green-200 w-fit">
            <Check className="w-3.5 h-3.5" />
            {connectedAccount.ml || "Mercado Livre Conectado"}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conexões com marketplaces</CardTitle>
          <CardDescription>Configure suas credenciais de afiliado.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ml">
            <TabsList className="grid grid-cols-3 w-full md:w-auto">
              <TabsTrigger value="ml" className="gap-2">
                <StatusDot active={connected.ml} /> Mercado Livre
              </TabsTrigger>
              <TabsTrigger value="shopee" className="gap-2">
                <StatusDot active={connected.shopee} /> Shopee
              </TabsTrigger>
              <TabsTrigger value="amazon" className="gap-2">
                <StatusDot active={connected.amazon} /> Amazon
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ml" className="space-y-4 pt-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <AuthModeSwitch source="ml" />
              </div>
              {connected.ml && <ConnectedBanner source="ml" />}
              {!connected.ml && authMode.ml === "oauth" && (
                <div className="rounded-xl border border-dashed p-6 text-center space-y-3 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta do Mercado Livre via login seguro — sem precisar copiar chaves.
                  </p>
                  <OAuthButton source="ml" label="Entrar com Mercado Livre" />
                </div>
              )}
              {!connected.ml && authMode.ml === "manual" && (
                <>
                <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client ID</Label>
                  <Input value={mlCreds.clientId} onChange={(e) => setMlCreds({ ...mlCreds, clientId: e.target.value })} placeholder="Seu Client ID" />
                </div>
                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <Input type="password" value={mlCreds.clientSecret} onChange={(e) => setMlCreds({ ...mlCreds, clientSecret: e.target.value })} placeholder="Seu Client Secret" />
                </div>
                </div>
                <Button onClick={() => handleConnect("ml")} disabled={connecting === "ml"}>
                  {connecting === "ml" ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                  Conectar
                </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="shopee" className="space-y-4 pt-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <AuthModeSwitch source="shopee" />
              </div>
              {connected.shopee && <ConnectedBanner source="shopee" />}
              {!connected.shopee && authMode.shopee === "oauth" && (
                <div className="rounded-xl border border-dashed p-6 text-center space-y-3 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta Shopee Afiliados via login seguro.
                  </p>
                  <OAuthButton source="shopee" label="Entrar com Shopee" />
                </div>
              )}
              {!connected.shopee && authMode.shopee === "manual" && (
                <>
                <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>App ID</Label>
                  <Input value={shopeeCreds.appId} onChange={(e) => setShopeeCreds({ ...shopeeCreds, appId: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <Input type="password" value={shopeeCreds.secretKey} onChange={(e) => setShopeeCreds({ ...shopeeCreds, secretKey: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Affiliate ID</Label>
                  <Input value={shopeeCreds.affiliateId} onChange={(e) => setShopeeCreds({ ...shopeeCreds, affiliateId: e.target.value })} />
                </div>
                </div>
                <Button onClick={() => handleConnect("shopee")} disabled={connecting === "shopee"}>
                  {connecting === "shopee" ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                  Conectar
                </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="amazon" className="space-y-4 pt-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <AuthModeSwitch source="amazon" />
              </div>
              {connected.amazon && <ConnectedBanner source="amazon" />}
              {!connected.amazon && authMode.amazon === "oauth" && (
                <div className="rounded-xl border border-dashed p-6 text-center space-y-3 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta Amazon Associates via login seguro.
                  </p>
                  <OAuthButton source="amazon" label="Entrar com Amazon" />
                </div>
              )}
              {!connected.amazon && authMode.amazon === "manual" && (
                <>
                <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Access Key</Label>
                  <Input value={amazonCreds.accessKey} onChange={(e) => setAmazonCreds({ ...amazonCreds, accessKey: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <Input type="password" value={amazonCreds.secretKey} onChange={(e) => setAmazonCreds({ ...amazonCreds, secretKey: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Associate Tag</Label>
                  <Input value={amazonCreds.associateTag} onChange={(e) => setAmazonCreds({ ...amazonCreds, associateTag: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Locale</Label>
                  <Input value={amazonCreds.locale} onChange={(e) => setAmazonCreds({ ...amazonCreds, locale: e.target.value })} />
                </div>
                </div>
                <Button onClick={() => handleConnect("amazon")} disabled={connecting === "amazon"}>
                  {connecting === "amazon" ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                  Conectar
                </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg">🔥 Melhores promoções</CardTitle>
            <CardDescription>
              {selectedIds.size > 0
                ? `${selectedIds.size} produto(s) selecionado(s)`
                : "Ofertas com desconto puxadas da sua conta conectada (links já com seu rastreio de afiliado)."}
            </CardDescription>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Input
              placeholder="Buscar por palavra-chave..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") fetchProducts(false); }}
              className="md:w-72"
            />
            <Button onClick={() => fetchProducts(false)} disabled={loadingProducts}>
              {loadingProducts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </Button>
            <Button variant="outline" onClick={() => loadDeals(null, false)} disabled={loadingProducts || !connected.ml}>
              🔥 Promoções
            </Button>
            <Button
              variant="outline"
              onClick={() => searchQuery.trim() ? fetchProducts(false) : loadDeals(selectedNiche, false)}
              disabled={loadingProducts || !connected.ml}
              title={selectedNiche ? "Atualizar produtos do nicho" : "Atualizar promoções"}
            >
              {loadingProducts ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { id: null, label: "Todos" },
              { id: "MLB1574", label: "🛋️ Móveis" },
              { id: "MLB1499", label: "🏗️ Materiais" },
              { id: "MLB1430", label: "👕 Roupas" },
              { id: "MLB1132", label: "🧸 Brinquedos" },
              { id: "MLB1051", label: "📱 Celulares" },
              { id: "MLB1648", label: "💻 Informática" },
              { id: "MLB1574", label: "🛋️ Casa & Decoração" },
              { id: "MLB5726", label: "🔌 Eletrodomésticos" },
              { id: "MLB1276", label: "⚽ Esportes" },
              { id: "MLB1246", label: "💄 Beleza" },
              { id: "MLB1196", label: "📚 Livros" },
              { id: "MLB1743", label: "🚗 Veículos" },
              { id: "MLB1071", label: "🐶 Pets" },
              { id: "MLB1953", label: "✨ Outros" },
            ].map((n) => (
              <button
                key={n.label}
                type="button"
                onClick={() => loadDeals(n.id, false)}
                disabled={loadingProducts || !connected.ml}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                  selectedNiche === n.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border text-foreground",
                  (loadingProducts || !connected.ml) && "opacity-50 cursor-not-allowed",
                )}
              >
                {n.label}
              </button>
            ))}
          </div>
          {loadingProducts ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              Buscando produtos...
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Package className="w-10 h-10 opacity-40" />
              {connected.ml ? "Clique em 🔥 Promoções para carregar as melhores ofertas." : "Conecte sua conta primeiro."}
            </div>
          ) : (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
            >
              {products.map((p) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSelect(p.id);
                    }}
                    className={cn(
                      "relative text-left rounded-2xl border bg-card p-3 flex flex-col gap-2 transition-all hover:shadow-md cursor-pointer",
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-primary/15 hover:border-primary/40",
                    )}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center shadow">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                    <div className="aspect-square w-full rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                      {p.thumbnail ? (
                        <img 
                          src={p.thumbnail} 
                          alt={p.name} 
                          className="w-full h-full object-contain" 
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://placehold.co/400x400/f3f4f6/94a3b8?text=Imagem+Indispon%C3%ADvel";
                          }}
                        />
                      ) : (
                        <Package className="w-10 h-10 text-muted-foreground/50" />
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem]">
                      {p.name}
                    </p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-primary text-sm">{p.price}</span>
                        {p.discount ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px]">
                            -{p.discount}%
                          </Badge>
                        ) : (
                          <Badge className={cn("text-[10px]", SOURCE_META[p.source].className)} variant="secondary">
                            {SOURCE_META[p.source].label}
                          </Badge>
                        )}
                      </div>
                      {p.originalPrice && (
                        <span className="text-[11px] text-muted-foreground line-through">{p.originalPrice}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {products.length > 0 && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => searchQuery.trim() ? fetchProducts(true) : loadDeals(undefined, true)}
                disabled={loadingProducts}
                className="gap-2"
              >
                {loadingProducts ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Carregar mais produtos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Enviar via ZapLynx
          </CardTitle>
          <CardDescription>Prévia da mensagem que será enviada no WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={previewMessage}
            readOnly
            className="min-h-[200px] font-mono text-xs bg-muted/40"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Instância do WhatsApp</Label>
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {availableInstances.length === 0 ? (
                  <option value="">Nenhuma instância encontrada</option>
                ) : (
                  availableInstances.map((inst) => (
                    <option key={inst.zapi_instance_id} value={inst.zapi_instance_id}>
                      {inst.instance_name || inst.zapi_instance_id}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Número ou grupo do WhatsApp</Label>
              <Input
                placeholder="5511999999999"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSend} disabled={sending || !selectedInstanceId} className="w-full">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar via ZapLynx
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}