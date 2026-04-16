import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, ExternalLink, Loader2, RefreshCw, ShoppingBag, Unplug, UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import shopifyLogo from "@/assets/shopify-logo.png";

const SHOPIFY_INTEGRATION_NAME = "Shopify";

interface ShopifyHeaders {
  domain?: string;
  store_name?: string | null;
  store_email?: string | null;
  currency_code?: string | null;
  scope?: string;
}

interface GatewayIntegrationRow {
  id: string;
  active: boolean;
  auth_token: string | null;
  headers: ShopifyHeaders | null;
}

function sanitizeShop(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .replace(/\.myshopify\.com$/, "");
}

export function ShopifyCard() {
  const [open, setOpen] = useState(false);
  const [shop, setShop] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [integration, setIntegration] = useState<GatewayIntegrationRow | null>(null);

  const connected = !!integration?.id;
  const shopDomain = integration?.headers?.domain || (shop ? `${sanitizeShop(shop)}.myshopify.com` : "");
  const storeLabel = integration?.headers?.store_name || shopDomain || "Shopify";

  const statusBadge = useMemo(() => {
    if (!connected) return null;
    return integration?.active
      ? { label: "Conectado", className: "bg-primary/10 text-primary border-primary/20" }
      : { label: "Pausado", className: "bg-secondary text-secondary-foreground border-0" };
  }, [connected, integration?.active]);

  const loadIntegration = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("gateway_integrations")
      .select("id, active, auth_token, headers")
      .eq("user_id", user.id)
      .eq("name", SHOPIFY_INTEGRATION_NAME)
      .maybeSingle();

    if (error) {
      toast.error("Erro ao carregar integração Shopify");
    } else {
      const row = (data as GatewayIntegrationRow | null) ?? null;
      setIntegration(row);
      setActive(row?.active ?? true);
      setShop(row?.headers?.domain?.replace(/\.myshopify\.com$/, "") || "");
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadIntegration();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedFlag = params.get("shopify_connected") === "1";
    const errorFlag = params.get("shopify_error") === "1";
    const message = params.get("message");

    if (!connectedFlag && !errorFlag) return;

    if (connectedFlag) {
      toast.success("Loja Shopify conectada com sucesso!");
      void loadIntegration();
    }

    if (errorFlag) {
      toast.error(message || "Erro ao concluir integração com Shopify.");
    }

    params.delete("shopify_connected");
    params.delete("shopify_error");
    params.delete("message");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
  }, []);

  const handleConnect = async () => {
    const normalizedShop = sanitizeShop(shop);
    if (!normalizedShop) {
      toast.error("Informe o domínio MyShopify da loja.");
      return;
    }

    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-oauth-start", {
        body: {
          shop: normalizedShop,
          origin: window.location.origin,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.installUrl) throw new Error("Não foi possível iniciar a conexão com Shopify.");

      window.location.href = data.installUrl;
    } catch (error) {
      console.error("Shopify OAuth start error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao conectar a Shopify.");
      setConnecting(false);
    }
  };

  const handleToggleActive = async (nextActive: boolean) => {
    if (!integration?.id) return;

    setActive(nextActive);
    const { error } = await supabase
      .from("gateway_integrations")
      .update({ active: nextActive })
      .eq("id", integration.id);

    if (error) {
      setActive(!nextActive);
      toast.error("Erro ao atualizar status da integração.");
      return;
    }

    setIntegration((current) => (current ? { ...current, active: nextActive } : current));
    toast.success(nextActive ? "Shopify ativada." : "Shopify pausada.");
  };

  const handleDisconnect = async () => {
    if (!integration?.id) return;

    setDisconnecting(true);
    const { error } = await supabase.from("gateway_integrations").delete().eq("id", integration.id);
    setDisconnecting(false);

    if (error) {
      toast.error("Erro ao desconectar a Shopify.");
      return;
    }

    setIntegration(null);
    setActive(true);
    setShop("");
    toast.success("Integração Shopify removida.");
  };

  const handleSyncProducts = async () => {
    if (!integration?.id) return;

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-sync-products", {
        body: { integrationId: integration.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const count = Number(data?.importedCount || 0);
      toast.success(count > 0 ? `${count} produto(s) sincronizado(s) da Shopify.` : "Nenhum produto novo para sincronizar.");
    } catch (error) {
      console.error("Shopify sync error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao sincronizar produtos.");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return null;

  return (
    <>
      <Card
        className="cursor-pointer border-border transition-colors hover:border-primary/30"
        onClick={() => setOpen(true)}
      >
        <CardContent className="flex items-center gap-4 p-5">
          <img src={shopifyLogo} alt="Shopify" className="h-12 w-12 rounded-lg object-contain" loading="lazy" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Shopify</h3>
              {statusBadge && <Badge className={statusBadge.className}>{statusBadge.label}</Badge>}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {connected ? `Loja conectada: ${storeLabel}` : "Conecte sua loja com OAuth e sincronize produtos"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <img src={shopifyLogo} alt="Shopify" className="h-10 w-10 rounded-lg object-contain" />
              <div>
                <DialogTitle>Shopify</DialogTitle>
                <DialogDescription>
                  Conecte a loja em 1 clique via OAuth e sincronize produtos com o gateway.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {connected ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <BadgeCheck className="h-4 w-4 text-primary" />
                      {storeLabel}
                    </div>
                    <p className="text-xs text-muted-foreground">{shopDomain}</p>
                    {integration?.headers?.currency_code && (
                      <p className="text-[11px] text-muted-foreground">
                        Moeda da loja: {integration.headers.currency_code}
                      </p>
                    )}
                  </div>
                  <Switch checked={active} onCheckedChange={handleToggleActive} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="shop-domain" className="text-xs">Domínio MyShopify</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="shop-domain"
                    placeholder="sua-loja"
                    value={shop}
                    onChange={(event) => setShop(event.target.value)}
                  />
                  <div className="rounded-md border border-input px-3 py-2 text-xs text-muted-foreground">
                    .myshopify.com
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Exemplo: se sua loja for <span className="font-mono">minhaloja.myshopify.com</span>, digite apenas <span className="font-mono">minhaloja</span>.
                </p>
              </div>
            )}

            <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground sm:grid-cols-3">
              <div className="space-y-1">
                <p className="font-medium text-foreground">1. Conexão</p>
                <p>O usuário autoriza a loja sem colar token manualmente.</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">2. Produtos</p>
                <p>Sincroniza produtos ativos da Shopify para o gateway.</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">3. Pedidos</p>
                <p>Pagamentos aprovados podem virar pedidos na loja automaticamente.</p>
              </div>
            </div>

            <div className={cn("flex flex-col gap-2", connected && "sm:flex-row") }>
              {connected ? (
                <>
                  <Button onClick={handleSyncProducts} disabled={syncing || !active} className="flex-1">
                    {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    Sincronizar produtos
                  </Button>
                  <Button variant="outline" asChild className="flex-1">
                    <a href={`https://${shopDomain}/admin/products`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Abrir Shopify
                    </a>
                  </Button>
                  <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="sm:w-auto">
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Desconectar
                  </Button>
                </>
              ) : (
                <Button onClick={handleConnect} disabled={connecting} className="w-full">
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                  Conectar loja Shopify
                </Button>
              )}
            </div>

            {connected && (
              <Button variant="ghost" onClick={() => void loadIntegration()} className="w-full">
                <RefreshCw className="h-4 w-4" />
                Atualizar status da integração
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
