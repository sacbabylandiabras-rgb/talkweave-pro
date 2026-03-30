import { useState, useEffect } from "react";
import { Copy, Eye, EyeOff, RefreshCw, Plus, Shield, Bell, Building2, Key, Webhook, Loader2, AlertTriangle, Globe, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PaySettings() {
  const [showSecret, setShowSecret] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    whatsapp: "",
  });

  // API Keys state
  const [apiKeys, setApiKeys] = useState<{ public_key: string; secret_key: string } | null>(null);
  const [keysLoading, setKeysLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainStatus, setDomainStatus] = useState<"none" | "pending" | "active">("none");
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || "",
          email: data.email || "",
          whatsapp: data.whatsapp || "",
        });
      }
      setLoading(false);
    };
    fetchProfile();
    fetchApiKeys();
    // Load saved domain from localStorage
    const savedDomain = localStorage.getItem("checkout_custom_domain");
    if (savedDomain) {
      setCustomDomain(savedDomain);
      setDomainStatus("active");
    }
  }, []);

  const fetchApiKeys = async () => {
    setKeysLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "get" },
      });
      if (error) throw error;
      if (data) setApiKeys(data);
    } catch (err: any) {
      console.error("Erro ao buscar API keys:", err);
    }
    setKeysLoading(false);
  };

  const handleRegenerateKeys = async () => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-api-keys", {
        body: { action: "regenerate" },
      });
      if (error) throw error;
      if (data) {
        setApiKeys(data);
        toast.success("Chaves regeneradas com sucesso!");
      }
    } catch (err: any) {
      toast.error("Erro ao regenerar chaves: " + err.message);
    }
    setRegenerating(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: formData.full_name,
      whatsapp: formData.whatsapp,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Dados salvos com sucesso!");
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copiado!");
  };

  const handleSaveDomain = () => {
    const domain = customDomain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!domain) {
      localStorage.removeItem("checkout_custom_domain");
      setDomainStatus("none");
      setCustomDomain("");
      toast.success("Domínio removido");
      return;
    }
    setDomainSaving(true);
    localStorage.setItem("checkout_custom_domain", domain);
    setCustomDomain(domain);
    setDomainStatus("pending");
    setTimeout(() => {
      setDomainSaving(false);
      setDomainStatus("active");
      toast.success("Domínio salvo! Configure o DNS conforme as instruções.");
    }, 1000);
  };

  const publicKey = apiKeys?.public_key || "—";
  const secretKey = apiKeys?.secret_key || "—";

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
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie as configurações da sua conta</p>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="empresa"><Building2 className="w-3.5 h-3.5 mr-1.5" />Conta</TabsTrigger>
          <TabsTrigger value="dominio"><Globe className="w-3.5 h-3.5 mr-1.5" />Domínio</TabsTrigger>
          <TabsTrigger value="api"><Key className="w-3.5 h-3.5 mr-1.5" />API Keys</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="w-3.5 h-3.5 mr-1.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="notificacoes"><Bell className="w-3.5 h-3.5 mr-1.5" />Notificações</TabsTrigger>
          <TabsTrigger value="seguranca"><Shield className="w-3.5 h-3.5 mr-1.5" />Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Dados da Conta</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome Completo</Label>
                  <Input value={formData.full_name} onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={formData.email} disabled className="opacity-60" />
                </div>
                <div>
                  <Label>WhatsApp</Label>
                  <Input value={formData.whatsapp} onChange={e => setFormData(p => ({ ...p, whatsapp: e.target.value }))} placeholder="5511999999999" />
                </div>
                <div>
                  <Label>Status da Assinatura</Label>
                  <Input value={profile?.subscription_status === "active" ? "Ativa" : profile?.subscription_status || "Pendente"} disabled className="opacity-60" />
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Conta criada em: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"}</span>
                {profile?.subscription_expires_at && (
                  <span>• Expira em: {new Date(profile.subscription_expires_at).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
              <Button className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Chaves de API</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {keysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div>
                    <Label>Chave Pública (Publishable Key)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={publicKey} readOnly className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(publicKey)} disabled={!apiKeys}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Chave Secreta (Secret Key)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input type={showSecret ? "text" : "password"} value={secretKey} readOnly className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(secretKey)} disabled={!apiKeys}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-red-400 mt-1">⚠️ Nunca exponha esta chave em código frontend</p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="rounded-full text-xs" disabled={regenerating}>
                        {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                        Regenerar Chaves
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                          Regenerar chaves de API?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          As chaves atuais serão invalidadas imediatamente. Qualquer integração usando as chaves antigas deixará de funcionar. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerateKeys} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Regenerar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Endpoints de Webhook</CardTitle>
              <Button size="sm" className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Adicionar</Button>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Nenhum webhook configurado.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notificacoes" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Notificações por E-mail</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {["Transação aprovada", "Transação recusada", "Estorno realizado", "Chargeback recebido", "Relatório semanal"].map(n => (
                <div key={n} className="flex items-center justify-between">
                  <span className="text-sm">{n}</span>
                  <Switch defaultChecked={n.includes("Chargeback") || n.includes("Estorno")} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguranca" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Segurança</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Autenticação 2FA</p>
                  <p className="text-xs text-muted-foreground">Proteja sua conta com verificação em duas etapas</p>
                </div>
                <Switch />
              </div>
              <div>
                <Label>IPs Permitidos</Label>
                <Input placeholder="Ex: 192.168.1.1, 10.0.0.1" className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para permitir qualquer IP</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
