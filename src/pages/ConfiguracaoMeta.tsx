import { useState } from "react";
import { Globe, CheckCircle2, AlertCircle, Copy, Loader2, LogOut, RefreshCw, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";
import { FacebookConnectDialog } from "@/components/layout/FacebookConnectDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function ConfiguracaoMeta() {
  const { data: creds, isLoading } = useMetaCredentials();
  const [fbDialogOpen, setFbDialogOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const queryClient = useQueryClient();

  const isConnected = creds?.connected === true;

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://yodgjxdekuraxquxkxhx.supabase.co"}/functions/v1/webhook-meta`;

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
        .from("meta_credentials")
        .update({
          connected: false,
          access_token: null,
          phone_number_id: null,
          business_account_id: null,
          waba_id: null,
          fb_user_id: null,
          fb_user_name: null,
        } as any)
        .eq("user_id", user.id);

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

  const maskedToken = creds?.access_token
    ? `${(creds.access_token as string).slice(0, 12)}...${(creds.access_token as string).slice(-6)}`
    : "—";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração Meta API</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure suas credenciais da API oficial do WhatsApp Business
        </p>
      </div>

      {/* Status card */}
      {isConnected ? (
        <Card className="p-4 flex items-center gap-3 border-primary/20 bg-primary/5">
          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">
              Conectado como {creds?.fb_user_name || "Conta Business"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Credenciais configuradas automaticamente via Facebook Login
            </p>
          </div>
          <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">
            Ativo
          </Badge>
        </Card>
      ) : (
        <Card className="p-4 flex items-center gap-3 border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">Nenhuma conta conectada</p>
            <p className="text-[10px] text-muted-foreground">
              Conecte sua conta Facebook Business para ativar a API oficial
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
            Pendente
          </Badge>
        </Card>
      )}

      {/* Connect / Reconnect */}
      {!isConnected ? (
        <Card className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-xl bg-[#1877F2]/10 flex items-center justify-center mx-auto">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#1877F2]" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-foreground">Conecte com um clique</p>
            <p className="text-xs text-muted-foreground">
              Todas as credenciais serão preenchidas automaticamente via OAuth
            </p>
          </div>
          <Button
            className="w-full gap-2.5 h-11 bg-[#1877F2] hover:bg-[#166FE5] text-white"
            onClick={() => setFbDialogOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Conectar com Facebook
          </Button>
        </Card>
      ) : (
        <>
          {/* Credentials display (read-only) */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Credenciais da API</p>
              <Badge variant="outline" className="text-[9px]">Preenchido via OAuth</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">App ID</Label>
                <Input value={creds?.app_id || "—"} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Facebook User ID</Label>
                <Input value={creds?.fb_user_id || "—"} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Access Token</Label>
              <Input value={maskedToken} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
                <Input value={creds?.phone_number_id || "Não detectado"} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Business Account ID</Label>
                <Input value={creds?.business_account_id || "Não detectado"} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">WABA ID</Label>
              <Input value={creds?.waba_id || "Não detectado"} readOnly className="h-9 text-xs bg-muted/50 font-mono" />
            </div>

            <Separator />

            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Versão da API: v21.0</span>
              <span>Atualizado em: {creds?.updated_at ? new Date(creds.updated_at as string).toLocaleString("pt-BR") : "—"}</span>
            </div>
          </Card>

          {/* Webhook URL */}
          <Card className="p-4 space-y-2">
            <Label className="text-xs font-medium flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Webhook URL (configure na Meta)
            </Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="h-9 text-xs font-mono bg-muted/50" />
              <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => copyToClipboard(webhookUrl)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Cole esta URL no campo "Callback URL" na configuração de Webhooks do seu App Meta.
            </p>
          </Card>

          {/* Actions */}
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