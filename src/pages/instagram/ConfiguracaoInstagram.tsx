import { useState } from "react";
import { CheckCircle2, Loader2, Copy, Instagram } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || "";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://yodgjxdekuraxquxkxhx.supabase.co";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/meta-oauth-callback`;

export default function ConfiguracaoInstagram() {
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [accountName, setAccountName] = useState("");

  const webhookUrl = `https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/webhook-instagram`;

  const handleLoginInstagram = async () => {
    if (!FACEBOOK_APP_ID) {
      toast.error("Facebook App ID não configurado. Configure VITE_FACEBOOK_APP_ID no projeto.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado para conectar o Instagram.");
      return;
    }

    setConnecting(true);

    const scopes = [
      "instagram_business_basic",
      "instagram_business_manage_comments",
      "instagram_business_manage_messages",
      "pages_show_list",
      "pages_read_engagement",
    ].join(",");
    const statePayload = encodeURIComponent(
      btoa(JSON.stringify({ userId: user.id, origin: window.location.origin }))
    );

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}&state=${statePayload}&response_type=code`;

    const popup = window.open(authUrl, "instagram_login", "width=600,height=700,scrollbars=yes");

    if (!popup) {
      setConnecting(false);
      toast.error("Libere pop-ups do navegador para continuar.");
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "META_OAUTH_SUCCESS") {
        setIsConnected(true);
        setAccountName("@sua_conta");
        setConnecting(false);
        toast.success("Instagram conectado com sucesso!");
        window.removeEventListener("message", handleMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        setConnecting(false);
        window.removeEventListener("message", handleMessage);
      }
    }, 1000);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setAccountName("");
    toast.info("Instagram desconectado");
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  return (
    <div className="space-y-6 w-full max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Configuração Instagram</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Conecte sua conta do Instagram para ativar automações</p>
      </div>

      {/* Status Card */}
      <Card className="border-border">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isConnected ? "bg-[#00ff88]/10" : "bg-muted/30"}`}>
              {isConnected ? (
                <CheckCircle2 className="w-8 h-8 text-[#00ff88]" />
              ) : (
                <Instagram className="w-8 h-8 text-muted-foreground" />
              )}
            </div>

            {isConnected ? (
              <>
                <div>
                  <Badge className="bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30 mb-2">Conectado</Badge>
                  <p className="text-sm font-medium">{accountName}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sua conta está pronta para automações</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  Desconectar
                </Button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium">Nenhuma conta conectada</p>
                  <p className="text-xs text-muted-foreground mt-1">Faça login com o Instagram para começar</p>
                </div>
                <Button
                  onClick={handleLoginInstagram}
                  disabled={connecting}
                  className="gap-2 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 text-white border-0 px-6"
                  size="lg"
                >
                  {connecting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Instagram className="w-5 h-5" />
                  )}
                  {connecting ? "Conectando..." : "Entrar com Instagram"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">Webhook (automático)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Esta URL é configurada automaticamente ao conectar sua conta
          </p>
        </CardContent>
      </Card>

      {/* Help */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">Permissões solicitadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          <p>• <strong>instagram_business_basic</strong> — Acesso ao perfil da conta profissional</p>
          <p>• <strong>instagram_business_manage_comments</strong> — Ler e responder comentários</p>
          <p>• <strong>instagram_business_manage_messages</strong> — Enviar e ler Direct Messages</p>
          <p>• <strong>pages_show_list</strong> — Listar páginas conectadas</p>
          <p>• <strong>pages_read_engagement</strong> — Métricas de engajamento</p>
        </CardContent>
      </Card>
    </div>
  );
}
