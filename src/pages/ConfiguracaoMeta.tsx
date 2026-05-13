import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Globe, CheckCircle2, AlertCircle, Copy, Loader2, LogOut, RefreshCw, Shield, AlertTriangle, Settings2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";
import { FacebookConnectDialog } from "@/components/layout/FacebookConnectDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface MetaPhoneNumber {
  id?: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  name_status?: string;
  code_verification_status?: string;
}

 const WHATSAPP_META_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || "26985190684454065";

export default function ConfiguracaoMeta() {
   const { data: creds, isLoading, isFetching } = useMetaCredentials(WHATSAPP_META_APP_ID);
  const [fbDialogOpen, setFbDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<MetaPhoneNumber[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [manualToken, setManualToken] = useState("");
  const [manualPhoneId, setManualPhoneId] = useState("");
  const [manualWabaId, setManualWabaId] = useState("");
  const queryClient = useQueryClient();

  const isConnected = creds?.connected === true;

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      toast.success("Conta Meta conectada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["meta-credentials"] });
      setSearchParams({}, { replace: true });
    } else if (searchParams.get("error") === "1") {
      toast.error("Erro ao conectar conta Meta. Tente novamente.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const fetchPhoneNumbers = async (showError = false) => {
    if (!isConnected) {
      setPhoneNumbers([]);
      return;
    }

    setLoadingPhones(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meta-message", {
        body: { action: "get_phone_numbers" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPhoneNumbers(Array.isArray(data?.phone_numbers) ? data.phone_numbers : []);
    } catch (err) {
      console.error("Error fetching Meta phone numbers:", err);
      setPhoneNumbers([]);
      if (showError) {
        toast.error("Erro ao buscar os números da conta conectada");
      }
    } finally {
      setLoadingPhones(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      void fetchPhoneNumbers();
    } else {
      setPhoneNumbers([]);
    }
  }, [isConnected, creds?.access_token, creds?.waba_id]);

    const webhookUrl = `https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/webhook-meta-v2`;
  const verifyToken = "zaplynx_whatsapp_verify_2024";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const handleDisconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("meta_credentials" as any)
        .update({
          connected: false,
          access_token: null,
          phone_number_id: null,
          business_account_id: null,
          waba_id: null,
          fb_user_id: null,
          fb_user_name: null,
        } as any)
        .eq("user_id", user.id)
        .eq("app_id", WHATSAPP_META_APP_ID);

      if (error) throw error;

      toast.success("Conta desconectada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["meta-credentials"] });
      setShowConfirmDisconnect(false);
    } catch {
      toast.error("Erro ao desconectar conta");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleManualSave = async () => {
    if (!manualToken || !manualPhoneId || !manualWabaId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Faça login primeiro");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        access_token: manualToken.trim(),
        phone_number_id: manualPhoneId.trim(),
        waba_id: manualWabaId.trim(),
        app_id: WHATSAPP_META_APP_ID,
        connected: true,
        fb_user_name: "Configuração Manual",
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("meta_credentials" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("app_id", WHATSAPP_META_APP_ID)
        .maybeSingle();

      let error;
      if (existing) {
        ({ error } = await supabase
          .from("meta_credentials" as any)
          .update(payload as any)
          .eq("id", (existing as any).id));
      } else {
        ({ error } = await supabase
          .from("meta_credentials" as any)
          .insert(payload as any));
      }

      if (error) throw error;

      toast.success("Credenciais salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["meta-credentials"] });
      setManualToken("");
      setManualPhoneId("");
      setManualWabaId("");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar credenciais");
    } finally {
      setSaving(false);
    }
  };

  const maskedToken = creds?.access_token
    ? `${(creds.access_token as string).slice(0, 12)}...${(creds.access_token as string).slice(-6)}`
    : "—";

   if (isLoading || isFetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure suas credenciais da API oficial do WhatsApp Business
        </p>
      </div>

      {isConnected ? (
        <Card className="p-4 flex items-center gap-3 border-primary/20 bg-primary/5">
          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">
              Conectado como {creds?.fb_user_name || "Conta Business"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Credenciais configuradas · Phone ID: {creds?.phone_number_id || "—"}
            </p>
          </div>
          <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">
            Ativo
          </Badge>
        </Card>
      ) : (
        <Card className="p-4 flex items-center gap-3 border-border bg-muted/40">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">Nenhuma conta conectada</p>
            <p className="text-[10px] text-muted-foreground">
              Conecte via Facebook ou configure manualmente com o token da Meta
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Pendente
          </Badge>
        </Card>
      )}

      {!isConnected ? (
        <Tabs defaultValue="manual" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="gap-1.5 text-xs">
              <Settings2 className="w-3.5 h-3.5" />
              Configuração Manual
            </TabsTrigger>
            <TabsTrigger value="oauth" className="gap-1.5 text-xs">
              <Globe className="w-3.5 h-3.5" />
              Conectar via Facebook
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <Card className="p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Configuração Manual (Recomendado)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cole os dados do painel{" "}
                  <a
                     href="https://developers.facebook.com/apps/26985190684454065/use_cases/customize/wa-dev-console/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Meta for Developers
                  </a>
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Access Token <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="EAAVHQCpLN7EBRE..."
                    className="h-9 text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Copie o "Token de acesso temporário" ou use um System User Token permanente
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Phone Number ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={manualPhoneId}
                      onChange={(e) => setManualPhoneId(e.target.value)}
                      placeholder="850315024833115"
                      className="h-9 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      "Identificação do número de telefone" na página da API
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      WABA ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={manualWabaId}
                      onChange={(e) => setManualWabaId(e.target.value)}
                      placeholder="1434845678365078"
                      className="h-9 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      "Identificação da conta do WhatsApp Business"
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full gap-2 h-10"
                onClick={handleManualSave}
                disabled={saving || !manualToken || !manualPhoneId || !manualWabaId}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Credenciais
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="oauth">
            <Card className="p-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Globe className="w-7 h-7 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Conecte via OAuth</p>
                <p className="text-xs text-muted-foreground">
                  Preenche automaticamente via Facebook Login
                </p>
              </div>
              <Button className="w-full gap-2.5 h-11" onClick={() => setFbDialogOpen(true)}>
                <Globe className="w-5 h-5" />
                Conectar com Facebook
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Credenciais da API</p>
              <Badge variant="outline" className="text-[9px]">Configurado</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">App ID</Label>
                <Input value={creds?.app_id || WHATSAPP_META_APP_ID} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">WABA ID</Label>
                <Input value={creds?.waba_id || "—"} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Access Token</Label>
              <div className="flex gap-2">
                <Input value={maskedToken} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
                <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => copyToClipboard(creds?.access_token as string)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
                <Input value={creds?.phone_number_id || "Não detectado"} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Método</Label>
                <Input value={creds?.fb_user_name || "—"} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Versão da API: v21.0</span>
              <span>Atualizado: {creds?.updated_at ? new Date(creds.updated_at as string).toLocaleString("pt-BR") : "—"}</span>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Números da conta conectada</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Todos os números vinculados à WABA desta conta
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px]">
                  {phoneNumbers.length} número{phoneNumbers.length === 1 ? "" : "s"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => fetchPhoneNumbers(true)}
                  disabled={loadingPhones}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPhones ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            </div>

            {loadingPhones ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Carregando números da conta...</span>
              </div>
            ) : phoneNumbers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Nenhum número foi encontrado para esta conta conectada.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {phoneNumbers.map((phoneNumber, index) => (
                  <div
                    key={phoneNumber.id || `${phoneNumber.display_phone_number}-${index}`}
                    className="rounded-lg border border-border p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {phoneNumber.display_phone_number || "Número sem identificação"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {phoneNumber.verified_name || "Nome verificado não disponível"}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {phoneNumber.quality_rating && (
                          <Badge variant="secondary" className="text-[9px]">
                            {phoneNumber.quality_rating}
                          </Badge>
                        )}
                        {phoneNumber.name_status && (
                          <Badge variant="outline" className="text-[9px]">
                            {phoneNumber.name_status}
                          </Badge>
                        )}
                        {phoneNumber.code_verification_status && (
                          <Badge variant="outline" className="text-[9px]">
                            {phoneNumber.code_verification_status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <Label className="text-xs font-medium flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Configuração do Webhook (Meta for Developers)
            </Label>

            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Callback URL</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="h-9 text-xs font-mono bg-muted/50" />
                  <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => copyToClipboard(webhookUrl)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Verify Token</Label>
                <div className="flex gap-2">
                  <Input value={verifyToken} readOnly className="h-9 text-xs font-mono bg-muted/50" />
                  <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => copyToClipboard(verifyToken)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-medium text-foreground">Campos para assinar no Webhook:</p>
              <div className="flex flex-wrap gap-1.5">
                {["messages", "message_deliveries", "message_reads"].map((f) => (
                  <Badge key={f} variant="secondary" className="text-[9px] font-mono">{f}</Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setFbDialogOpen(true)}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reconectar
                </Button>
              </div>

              {!showConfirmDisconnect ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                  onClick={() => setShowConfirmDisconnect(true)}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Desconectar
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-destructive" />
                    Tem certeza?
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() => setShowConfirmDisconnect(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-[10px] px-2 gap-1"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting && <Loader2 className="w-3 h-3 animate-spin" />}
                    Confirmar
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <FacebookConnectDialog open={fbDialogOpen} onOpenChange={setFbDialogOpen} />
    </div>
  );
}
