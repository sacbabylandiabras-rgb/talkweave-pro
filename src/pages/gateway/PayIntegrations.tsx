import { useState, useEffect } from "react";
import { Link2, CheckCircle, XCircle, Loader2, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import utmifyLogo from "@/assets/utmify-logo.png";
import { ShopifyCard } from "@/components/gateway/ShopifyIntegrationCard";

function UtmifyCard() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("gateway_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("name", "UTMify")
        .maybeSingle();
      if (data) {
        setToken(data.auth_token || "");
        setActive(data.active);
        setExistingId(data.id);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error("Informe o token da UTMify");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      user_id: user.id,
      name: "UTMify",
      webhook_url: "https://api.utmify.com.br/api-credentials/orders",
      method: "POST",
      auth_type: "x-api-token",
      auth_token: token,
      active,
    };

    if (existingId) {
      const { error } = await supabase.from("gateway_integrations").update(payload).eq("id", existingId);
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("gateway_integrations").insert(payload).select("id").single();
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
      setExistingId(data.id);
    }
    toast.success("UTMify configurada com sucesso!");
    setSaving(false);
  };

  if (loading) return null;

  return (
    <>
      <Card
        className="border-[#2A2A2A] hover:border-[#a78bfa]/30 transition-colors cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <img src={utmifyLogo} alt="UTMify" className="w-12 h-12 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">UTMify</h3>
              {existingId && (
                <Badge className={active ? "bg-emerald-500/10 text-emerald-400 border-0 text-[10px]" : "bg-muted text-muted-foreground border-0 text-[10px]"}>
                  {active ? "Ativo" : "Inativo"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Rastreamento de vendas e UTMs</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <img src={utmifyLogo} alt="UTMify" className="w-10 h-10 rounded-lg object-cover" />
              <div>
                <DialogTitle>UTMify</DialogTitle>
                <DialogDescription>Envia dados de cada venda aprovada para a UTMify</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Integração ativa</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <div>
              <Label className="text-xs">API Token</Label>
              <div className="relative mt-1">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder="Seu token da UTMify"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Encontre em: UTMify → Configurações → Integrações → API Token
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-xs">Dados enviados por transação:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Nome, e-mail e telefone do comprador</li>
                <li>Valor, status e método de pagamento</li>
                <li>Produto e checkout de origem</li>
                <li>Parâmetros UTM capturados no checkout</li>
              </ul>
            </div>

            <Button
              className="w-full bg-[#a78bfa] hover:bg-[#8b5cf6] text-white"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Configuração
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PayIntegrations() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    const { data, error } = await supabase.from("gateway_integrations").select("*").not("name", "in", '("UTMify","Shopify")').order("created_at", { ascending: false });
    if (!error && data) setIntegrations(data);
    setLoading(false);
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("gateway_integrations").update({ active: !active }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(active ? "Integração desativada" : "Integração ativada");
    fetchIntegrations();
  };

  const deleteIntegration = async (id: string) => {
    const { error } = await supabase.from("gateway_integrations").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Integração removida");
    fetchIntegrations();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-sm text-muted-foreground">Configure integrações externas do gateway</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Plataformas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <UtmifyCard />
          <ShopifyCard />
        </div>
      </div>

      <div>
        <Separator className="bg-[#2A2A2A] mb-4" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Webhooks Customizados</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map(int => (
            <Card key={int.id} className="border-[#2A2A2A] hover:border-[#a78bfa]/30 transition-colors">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{int.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">{int.method} • {int.webhook_url.slice(0, 30)}...</p>
                    </div>
                  </div>
                  {int.active ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-0 text-[10px]"><CheckCircle className="w-3 h-3 mr-1" /> Ativo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px]"><XCircle className="w-3 h-3 mr-1" /> Inativo</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {int.last_tested_at ? `Testado: ${new Date(int.last_tested_at).toLocaleDateString("pt-BR")}` : "Nunca testado"}
                  {int.last_test_status && ` — ${int.last_test_status}`}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => toggleActive(int.id, int.active)}>
                    {int.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => deleteIntegration(int.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
