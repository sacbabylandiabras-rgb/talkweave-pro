import { useState, useEffect } from "react";
import { Copy, Eye, EyeOff, RefreshCw, Plus, Shield, Bell, Building2, Key, Webhook, Loader2, AlertTriangle, Globe, CheckCircle2, XCircle, ExternalLink, Trash2, Lock, ShieldCheck, Clock, Pencil, ShoppingBag, Mail } from "lucide-react";
import CheckoutDefaultsTab from "@/components/gateway/CheckoutDefaultsTab";
import CheckoutDomainSection from "@/components/gateway/CheckoutDomainSection";
import CheckoutEmailSection from "@/components/gateway/CheckoutEmailSection";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useSearchParams } from "react-router-dom";

export default function PaySettings() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "empresa";

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
  // Domain state is handled in CheckoutDomainSection component

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    "Transação aprovada": false,
    "Transação recusada": false,
    "Estorno realizado": true,
    "Chargeback recebido": true,
    "Relatório semanal": false,
  });

  // Webhooks state
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<any>(null);
  const [webhookForm, setWebhookForm] = useState({
    name: "",
    webhook_url: "",
    method: "POST",
    auth_type: "none",
    auth_token: "",
    active: true,
    description: "",
    webhook_type: "transaction",
    events: {
      approved: false,
      pending: false,
      refused: false,
      refunded: false,
      cancelled: false,
      med: false,
    } as Record<string, boolean>,
  });

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
    
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    setWebhooksLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setWebhooksLoading(false); return; }
    const { data, error } = await supabase
      .from("gateway_integrations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setWebhooks(data);
    setWebhooksLoading(false);
  };

  const defaultWebhookForm = {
    name: "", webhook_url: "", method: "POST", auth_type: "none", auth_token: "", active: true,
    description: "", webhook_type: "transaction",
    events: { approved: false, pending: false, refused: false, refunded: false, cancelled: false, med: false },
  };

  const openCreateWebhook = () => {
    setEditingWebhook(null);
    setWebhookForm({ ...defaultWebhookForm });
    setWebhookDialogOpen(true);
  };

  const openEditWebhook = (wh: any) => {
    setEditingWebhook(wh);
    const headers = wh.headers || {};
    setWebhookForm({
      name: wh.name || "",
      webhook_url: wh.webhook_url || "",
      method: wh.method || "POST",
      auth_type: wh.auth_type || "none",
      auth_token: wh.auth_token || "",
      active: wh.active ?? true,
      description: headers.description || "",
      webhook_type: headers.webhook_type || "transaction",
      events: headers.events || { approved: false, pending: false, refused: false, refunded: false, cancelled: false, med: false },
    });
    setWebhookDialogOpen(true);
  };

  const handleSaveWebhook = async () => {
    if (!webhookForm.webhook_url.trim()) {
      toast.error("URL é obrigatória");
      return;
    }
    setWebhookSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setWebhookSaving(false); return; }
    const webhookName = webhookForm.description.trim() || webhookForm.webhook_type === "transaction" ? "Transação" : "Saque";
    const payload = {
      name: webhookForm.description.trim() || webhookName,
      webhook_url: webhookForm.webhook_url.trim(),
      method: webhookForm.method,
      auth_type: webhookForm.auth_type,
      auth_token: webhookForm.auth_type !== "none" ? webhookForm.auth_token : null,
      active: webhookForm.active,
      user_id: user.id,
      headers: {
        description: webhookForm.description,
        webhook_type: webhookForm.webhook_type,
        events: webhookForm.events,
      },
    };
    let error;
    if (editingWebhook) {
      ({ error } = await supabase.from("gateway_integrations").update(payload).eq("id", editingWebhook.id));
    } else {
      ({ error } = await supabase.from("gateway_integrations").insert(payload));
    }
    if (error) {
      toast.error("Erro ao salvar webhook: " + error.message);
    } else {
      toast.success(editingWebhook ? "Webhook atualizado!" : "Webhook criado!");
      setWebhookDialogOpen(false);
      fetchWebhooks();
    }
    setWebhookSaving(false);
  };

  const handleDeleteWebhook = async (id: string) => {
    const { error } = await supabase.from("gateway_integrations").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Webhook removido!");
      fetchWebhooks();
    }
  };

  const handleToggleWebhook = async (id: string, active: boolean) => {
    const { error } = await supabase.from("gateway_integrations").update({ active }).eq("id", id);
    if (!error) fetchWebhooks();
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

  // Domain management is handled via the CheckoutDomainSection component

  const formatSslExpiry = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(typeof dateStr === "number" ? dateStr : dateStr);
      const now = new Date();
      const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        formatted: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
        daysLeft: diffDays,
        isExpiringSoon: diffDays < 30,
        isExpired: diffDays < 0,
      };
    } catch { return null; }
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

      <Tabs defaultValue={defaultTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="empresa"><Building2 className="w-3.5 h-3.5 mr-1.5" />Conta</TabsTrigger>
          <TabsTrigger value="dominio"><Globe className="w-3.5 h-3.5 mr-1.5" />Domínio</TabsTrigger>
          <TabsTrigger value="api"><Key className="w-3.5 h-3.5 mr-1.5" />API Keys</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="w-3.5 h-3.5 mr-1.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="notificacoes"><Bell className="w-3.5 h-3.5 mr-1.5" />Notificações</TabsTrigger>
          <TabsTrigger value="seguranca"><Shield className="w-3.5 h-3.5 mr-1.5" />Segurança</TabsTrigger>
          <TabsTrigger value="checkout"><ShoppingBag className="w-3.5 h-3.5 mr-1.5" />Checkout Padrão</TabsTrigger>
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
              <Button className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dominio" className="mt-4 space-y-4">
          <CheckoutDomainSection />
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
              <Button size="sm" className="bg-[#a78bfa] hover:bg-[#8b5cf6] text-white rounded-full text-xs" onClick={openCreateWebhook}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent>
              {webhooksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : webhooks.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">Nenhum webhook configurado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((wh) => (
                    <div key={wh.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#2A2A2A] bg-muted/20">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{wh.name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {wh.headers?.webhook_type === "withdrawal" ? "Saque" : "Transação"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] shrink-0">{wh.method}</Badge>
                          {wh.auth_type !== "none" && (
                            <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/30 text-amber-400">
                              <Lock className="w-2.5 h-2.5 mr-0.5" />{wh.auth_type}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{wh.webhook_url}</p>
                        {wh.headers?.events && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(wh.headers.events as Record<string, boolean>)
                              .filter(([, v]) => v)
                              .map(([k]) => (
                                <Badge key={k} variant="secondary" className="text-[9px] px-1.5 py-0">
                                  {k === "approved" ? "Aprovada" : k === "pending" ? "Pendente" : k === "refused" ? "Recusada" : k === "refunded" ? "Estornado" : k === "cancelled" ? "Cancelada" : "MED"}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>
                      <Switch checked={wh.active} onCheckedChange={(checked) => handleToggleWebhook(wh.id, checked)} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditWebhook(wh)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
                            <AlertDialogDescription>O endpoint "{wh.name}" será removido permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteWebhook(wh.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-[#a78bfa]" />
                  {editingWebhook ? "Editar Webhook" : "Novo Webhook"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={webhookForm.webhook_type} onValueChange={v => setWebhookForm(p => ({ ...p, webhook_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transaction">Transação</SelectItem>
                      <SelectItem value="withdrawal">Saque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input value={webhookForm.description} onChange={e => setWebhookForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Notificação para meu ERP" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">URL</Label>
                  <Input value={webhookForm.webhook_url} onChange={e => setWebhookForm(p => ({ ...p, webhook_url: e.target.value }))} placeholder="https://meusite.com/webhook" className="mt-1 font-mono text-xs" />
                </div>

                <div>
                  <Label className="text-xs mb-2 block">Eventos</Label>
                  <div className="space-y-2.5">
                    {[
                      { key: "approved", label: "Aprovada" },
                      { key: "pending", label: "Pendente" },
                      { key: "refused", label: "Recusada" },
                      { key: "refunded", label: "Estornado" },
                      { key: "cancelled", label: "Cancelada" },
                      { key: "med", label: "MED" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <Switch
                          checked={webhookForm.events[key] || false}
                          onCheckedChange={checked => setWebhookForm(p => ({
                            ...p,
                            events: { ...p.events, [key]: checked },
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Método HTTP</Label>
                    <Select value={webhookForm.method} onValueChange={v => setWebhookForm(p => ({ ...p, method: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Autenticação</Label>
                    <Select value={webhookForm.auth_type} onValueChange={v => setWebhookForm(p => ({ ...p, auth_type: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="api_key">API Key</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {webhookForm.auth_type !== "none" && (
                  <div>
                    <Label className="text-xs">Token / Credencial</Label>
                    <Input type="password" value={webhookForm.auth_token} onChange={e => setWebhookForm(p => ({ ...p, auth_token: e.target.value }))} placeholder="Insira o token" className="mt-1 font-mono text-xs" />
                  </div>
                )}
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button className="w-full bg-[#a78bfa] hover:bg-[#8b5cf6] text-white" onClick={handleSaveWebhook} disabled={webhookSaving}>
                  {webhookSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  Salvar Webhook
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setWebhookDialogOpen(false)}>Cancelar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="notificacoes" className="mt-4 space-y-4">
          <Card className="border-[#2A2A2A]">
            <CardHeader><CardTitle className="text-sm">Notificações por E-mail</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(notifPrefs).map(n => (
                <div key={n} className="flex items-center justify-between">
                  <span className="text-sm">{n}</span>
                  <Switch
                    checked={notifPrefs[n]}
                    onCheckedChange={(checked) => setNotifPrefs(p => ({ ...p, [n]: checked }))}
                  />
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

        <TabsContent value="checkout" className="mt-4">
          <CheckoutDefaultsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
