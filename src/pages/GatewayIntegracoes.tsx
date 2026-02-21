import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Webhook, Plus, Trash2, RefreshCw, Check, X, Pencil, Send, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GatewayIntegration {
  id: string;
  name: string;
  webhook_url: string;
  method: string;
  headers: Record<string, string>;
  auth_type: string;
  auth_token: string | null;
  active: boolean;
  last_tested_at: string | null;
  last_test_status: string | null;
  created_at: string;
}

const GatewayIntegracoes = () => {
  const [integrations, setIntegrations] = useState<GatewayIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; status: string; body: string } | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [method, setMethod] = useState("POST");
  const [headersStr, setHeadersStr] = useState("{}");
  const [authType, setAuthType] = useState("none");
  const [authToken, setAuthToken] = useState("");
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from("gateway_integrations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIntegrations((data as unknown as GatewayIntegration[]) || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar integrações", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setWebhookUrl("");
    setMethod("POST");
    setHeadersStr("{}");
    setAuthType("none");
    setAuthToken("");
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (item: GatewayIntegration) => {
    setName(item.name);
    setWebhookUrl(item.webhook_url);
    setMethod(item.method);
    setHeadersStr(JSON.stringify(item.headers || {}, null, 2));
    setAuthType(item.auth_type || "none");
    setAuthToken(item.auth_token || "");
    setEditingId(item.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || !webhookUrl) {
      toast({ title: "Preencha nome e URL", variant: "destructive" });
      return;
    }

    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = JSON.parse(headersStr);
    } catch {
      toast({ title: "Headers inválidos", description: "Use formato JSON válido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const payload = {
        name,
        webhook_url: webhookUrl,
        method,
        headers: parsedHeaders,
        auth_type: authType,
        auth_token: authToken || null,
        user_id: user.id,
        active: true,
      };

      if (editingId) {
        const { error } = await supabase
          .from("gateway_integrations")
          .update(payload as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("gateway_integrations")
          .insert(payload as any);
        if (error) throw error;
      }

      toast({ title: editingId ? "Integração atualizada!" : "Integração criada!" });
      setDialogOpen(false);
      resetForm();
      loadIntegrations();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("gateway_integrations").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Integração removida" });
      loadIntegrations();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from("gateway_integrations")
        .update({ active } as any)
        .eq("id", id);
      if (error) throw error;
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, active } : i));
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleTest = async (item: GatewayIntegration) => {
    setTesting(item.id);
    setTestResult(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(item.headers || {}),
      };

      if (item.auth_type === "bearer" && item.auth_token) {
        headers["Authorization"] = `Bearer ${item.auth_token}`;
      } else if (item.auth_type === "api_key" && item.auth_token) {
        headers["X-API-Key"] = item.auth_token;
      }

      const fetchOpts: RequestInit = {
        method: item.method,
        headers,
      };

      if (item.method !== "GET") {
        fetchOpts.body = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
      }

      const response = await fetch(item.webhook_url, fetchOpts);
      const text = await response.text();
      const status = response.ok ? "success" : "error";

      setTestResult({ id: item.id, status, body: text.substring(0, 500) });

      await supabase
        .from("gateway_integrations")
        .update({ last_tested_at: new Date().toISOString(), last_test_status: status } as any)
        .eq("id", item.id);

      toast({
        title: response.ok ? "✅ Webhook respondeu com sucesso!" : `❌ Erro ${response.status}`,
        description: response.ok ? `Status: ${response.status}` : text.substring(0, 100),
        variant: response.ok ? "default" : "destructive",
      });

      loadIntegrations();
    } catch (error: any) {
      setTestResult({ id: item.id, status: "error", body: error.message });
      toast({ title: "❌ Falha no teste", description: error.message, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações Gateway</h1>
          <p className="text-muted-foreground">Configure webhooks genéricos para integrar com qualquer serviço externo</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Integração
        </Button>
      </div>

      {integrations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Webhook className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma integração configurada</h3>
            <p className="text-muted-foreground mb-4">Crie sua primeira integração webhook para conectar serviços externos.</p>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Integração
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {integrations.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Webhook className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5 font-mono">Destino: {item.webhook_url}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{item.method}</Badge>
                    {item.auth_type !== "none" && (
                      <Badge variant="secondary" className="text-xs capitalize">{item.auth_type}</Badge>
                    )}
                    {item.last_test_status && (
                      <Badge variant={item.last_test_status === "success" ? "default" : "destructive"} className="text-xs">
                        {item.last_test_status === "success" ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                        {item.last_test_status === "success" ? "OK" : "Erro"}
                      </Badge>
                    )}
                    <Switch
                      checked={item.active}
                      onCheckedChange={(v) => handleToggle(item.id, v)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Sua URL de recebimento (cole no serviço externo):</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-gateway?id=${item.id}`}
                      className="font-mono text-xs h-8"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-gateway?id=${item.id}`);
                        toast({ title: "URL copiada!" });
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleTest(item)} disabled={testing === item.id}>
                    {testing === item.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                    Testar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                    <Pencil className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    Excluir
                  </Button>
                </div>
                {testResult && testResult.id === item.id && (
                  <pre className="mt-3 text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                    {testResult.body}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Integração" : "Nova Integração"}</DialogTitle>
            <DialogDescription>Configure a URL e autenticação do webhook</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Meu serviço externo" />
            </div>
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Método HTTP</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Autenticação</Label>
                <Select value={authType} onValueChange={setAuthType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {authType !== "none" && (
              <div className="space-y-2">
                <Label>{authType === "bearer" ? "Bearer Token" : "API Key"}</Label>
                <Input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder={authType === "bearer" ? "Token de autenticação" : "Chave da API"}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Headers personalizados (JSON)</Label>
              <Textarea
                value={headersStr}
                onChange={(e) => setHeadersStr(e.target.value)}
                placeholder='{"X-Custom-Header": "valor"}'
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GatewayIntegracoes;
