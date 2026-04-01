import { useState, useEffect } from "react";
import { Loader2, Save, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import shopifyLogo from "@/assets/shopify-logo.png";

export function ShopifyCard() {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [skipCart, setSkipCart] = useState(false);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("gateway_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("name", "Shopify")
        .maybeSingle();
      if (data) {
        const headers = (data.headers as Record<string, string>) || {};
        setDomain(headers.domain || "");
        setAccessToken(data.auth_token || "");
        setApiKey(headers.api_key || "");
        setApiSecret(headers.api_secret || "");
        setSkipCart(headers.skip_cart === "true");
        setActive(data.active);
        setExistingId(data.id);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    if (!domain.trim()) {
      toast.error("Informe o domínio MyShopify");
      return;
    }
    if (!accessToken.trim()) {
      toast.error("Informe o token de acesso");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");

    const payload = {
      user_id: user.id,
      name: "Shopify",
      webhook_url: `https://${cleanDomain}/admin/api/2024-01`,
      method: "POST",
      auth_type: "X-Shopify-Access-Token",
      auth_token: accessToken,
      active,
      headers: {
        domain: cleanDomain,
        api_key: apiKey,
        api_secret: apiSecret,
        skip_cart: skipCart ? "true" : "false",
      },
    };

    if (existingId) {
      const { error } = await supabase.from("gateway_integrations").update(payload).eq("id", existingId);
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("gateway_integrations").insert(payload).select("id").single();
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
      setExistingId(data.id);
    }
    toast.success("Shopify configurada com sucesso!");
    setSaving(false);
  };

  if (loading) return null;

  return (
    <>
      <Card
        className="border-[#2A2A2A] hover:border-emerald-500/30 transition-colors cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <img src={shopifyLogo} alt="Shopify" className="w-12 h-12 rounded-lg object-contain" loading="lazy" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Shopify</h3>
              {existingId && (
                <Badge className={active ? "bg-emerald-500/10 text-emerald-400 border-0 text-[10px]" : "bg-muted text-muted-foreground border-0 text-[10px]"}>
                  {active ? "Conectado" : "Desconectado"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Plataforma global de e-commerce</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <img src={shopifyLogo} alt="Shopify" className="w-10 h-10 rounded-lg object-contain" />
              <div>
                <DialogTitle>Shopify</DialogTitle>
                <DialogDescription>Conecte sua loja Shopify ao gateway de pagamento</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Integração ativa</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <div>
              <Label className="text-xs">Domínio MyShopify</Label>
              <div className="relative mt-1">
                <Input
                  placeholder="sua-loja"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="pr-28"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">.myshopify.com</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                A URL não pode conter: www., https://, http://, /, .b
              </p>
            </div>

            <div>
              <Label className="text-xs">Token de acesso api admin</Label>
              <div className="relative mt-1">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder="shpat_xxxxxxxxxxxxx"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Chave de API</Label>
              <div className="relative mt-1">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder="Chave de API do app"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Chave secreta da api</Label>
              <div className="relative mt-1">
                <Input
                  type={showSecret ? "text" : "password"}
                  placeholder="Chave secreta"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label className="text-sm">Pular carrinho</Label>
              <Switch checked={skipCart} onCheckedChange={setSkipCart} />
            </div>

            <Button
              className="w-full bg-[#95BF47] hover:bg-[#7EA83D] text-white"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
