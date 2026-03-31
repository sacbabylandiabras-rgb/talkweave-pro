import { useState, useEffect } from "react";
import { Copy, Eye, EyeOff, RefreshCw, Plus, Shield, Bell, Building2, Key, Webhook, Loader2, AlertTriangle, Globe, CheckCircle2, XCircle, ExternalLink, Trash2 } from "lucide-react";
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
  const [domainDeleting, setDomainDeleting] = useState(false);
  const [domainStatus, setDomainStatus] = useState<"none" | "pending" | "active" | "error">("none");
  const [domainSslStatus, setDomainSslStatus] = useState<string>("");
  const [domainVerification, setDomainVerification] = useState<any>(null);
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
    fetchDomainStatus();
  }, []);

  const fetchDomainStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("custom_domain").eq("id", user.id).single();
    const domain = (prof as any)?.custom_domain;
    if (!domain) return;
    setCustomDomain(domain);
    setDomainStatus("pending");
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "status", hostname: domain },
      });
      if (error) throw error;
      if (data?.status === "active") {
        setDomainStatus("active");
      } else if (data?.status === "not_found") {
        setDomainStatus("none");
      } else {
        setDomainStatus("pending");
      }
      setDomainSslStatus(data?.ssl_status || "");
      setDomainVerification(data?.ownership_verification || null);
    } catch (err) {
      console.error("Error checking domain status:", err);
      setDomainStatus("pending");
    }
  };

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

  const handleSaveDomain = async () => {
    const domain = customDomain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!domain) {
      handleDeleteDomain();
      return;
    }
    setDomainSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "create", hostname: domain },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCustomDomain(data.hostname || domain);
      setDomainStatus("pending");
      setDomainSslStatus(data.ssl_status || "");
      setDomainVerification(data.ownership_verification || null);
      toast.success("Domínio registrado no Cloudflare! SSL sendo provisionado automaticamente.");
    } catch (err: any) {
      console.error("Domain error:", err);
      toast.error("Erro: " + (err.message || "Falha ao registrar domínio"));
      setDomainStatus("error");
    }
    setDomainSaving(false);
  };

  const handleDeleteDomain = async () => {
    setDomainDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "delete", hostname: customDomain },
      });
      if (error) throw error;
      setCustomDomain("");
      setDomainStatus("none");
      setDomainVerification(null);
      toast.success("Domínio removido");
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
    setDomainDeleting(false);
  };

  const handleRefreshDomainStatus = async () => {
    await fetchDomainStatus();
    toast.success("Status atualizado!");
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

        <TabsContent value="dominio" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#FF4D2E]" />
                Domínio Personalizado
              </CardTitle>
              <CardDescription className="text-xs">
                Use seu próprio domínio para os links de checkout (ex: pay.seusite.com)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Domínio do Checkout</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    placeholder="pay.seusite.com"
                    className="font-mono text-xs"
                  />
                  <Button
                    className="bg-[#FF4D2E] hover:bg-[#E63D20] text-white rounded-full px-5 text-xs"
                    onClick={handleSaveDomain}
                    disabled={domainSaving}
                  >
                    {domainSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    Salvar
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Insira sem http:// ou https://. Ex: pay.meudominio.com
                </p>
              </div>

              {domainStatus !== "none" && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-[#2A2A2A] bg-muted/30">
                  {domainStatus === "active" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                  )}
                  <div>
                    <p className="text-xs font-medium">
                      {domainStatus === "active" ? "Domínio configurado" : "Verificando DNS..."}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {customDomain} → seus checkouts usarão este domínio
                    </p>
                  </div>
                  <Badge variant="outline" className={`ml-auto text-[10px] ${domainStatus === "active" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"}`}>
                    {domainStatus === "active" ? "Ativo" : "Pendente"}
                  </Badge>
                </div>
              )}

              <Card className="border-[#2A2A2A] bg-muted/20">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <p className="text-xs font-medium text-foreground">📋 Como configurar seu domínio:</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#FF4D2E]/10 text-[#FF4D2E] text-[10px] font-bold shrink-0">1</span>
                      <p className="text-[11px] text-muted-foreground">Acesse o painel DNS do seu provedor de domínio (Cloudflare, GoDaddy, Namecheap, etc.)</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#FF4D2E]/10 text-[#FF4D2E] text-[10px] font-bold shrink-0">2</span>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Adicione um registro <strong>A</strong> apontando para:</p>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[11px] bg-background border border-[#2A2A2A] rounded px-2 py-0.5 font-mono">185.158.133.1</code>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard("185.158.133.1")}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#FF4D2E]/10 text-[#FF4D2E] text-[10px] font-bold shrink-0">3</span>
                      <p className="text-[11px] text-muted-foreground">Se usar subdomínio (ex: pay.seusite.com), o <strong>Name</strong> deve ser <code className="bg-background border border-[#2A2A2A] rounded px-1 font-mono">pay</code></p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#FF4D2E]/10 text-[#FF4D2E] text-[10px] font-bold shrink-0">4</span>
                      <p className="text-[11px] text-muted-foreground">Aguarde a propagação DNS (pode levar até 72h) e publique o projeto</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-400">Importante</p>
                    <p className="text-[10px] text-muted-foreground">
                      Após configurar o DNS, é necessário adicionar o domínio também nas configurações do projeto Lovable (Publish → Domains) e republicar para que o SSL seja ativado.
                    </p>
                  </div>
                </div>
              </div>

              {customDomain && (
                <div>
                  <Label className="text-xs">Link de exemplo</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      readOnly
                      value={`https://${customDomain}/pay/seu-checkout`}
                      className="font-mono text-xs opacity-70"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(`https://${customDomain}/pay/seu-checkout`)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
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
