import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Copy, Instagram, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const INSTAGRAM_APP_ID = "1629147191696096";
const REDIRECT_URI = "https://talkweave-pro.lovable.app/meta-oauth-callback";

export default function ConfiguracaoInstagram() {
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(true);

  const webhookUrl = `https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/webhook-instagram`;
  const verifyToken = "zaplynx_ig_verify_2024";

  // Check existing connection on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setCheckingStatus(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("meta_credentials")
        .select("*")
        .eq("user_id", user.id)
        .eq("app_id", INSTAGRAM_APP_ID)
        .maybeSingle();

      if (data?.connected && data?.access_token) {
        setIsConnected(true);
        setAccountName(data.fb_user_name ? `@${data.fb_user_name}` : "Instagram conectado");

        // Fetch profile picture from Instagram Graph API
        try {
          const picRes = await fetch(
            `https://graph.instagram.com/v21.0/me?fields=profile_picture_url&access_token=${encodeURIComponent(data.access_token)}`
          );
          const picData = await picRes.json();
          if (picData?.profile_picture_url) {
            setProfilePicUrl(picData.profile_picture_url);
          }
        } catch (e) {
          console.warn("Failed to fetch profile picture:", e);
        }
      }
    } catch (err) {
      console.error("Error checking Instagram connection:", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Handle OAuth redirect in both normal tab and popup flows
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPopup = params.get("popup") === "1";
    const isConnected = params.get("connected") === "1" || params.get("ig_connected") === "1";
    const hasError = params.get("error") === "1";
    const errorMessage = params.get("message");

    if (isPopup && window.opener) {
      if (isConnected) {
        window.opener.postMessage({ type: "META_OAUTH_SUCCESS", provider: "instagram" }, window.location.origin);
      } else if (hasError) {
        window.opener.postMessage({
          type: "META_OAUTH_ERROR",
          provider: "instagram",
          message: errorMessage || "Erro ao conectar Instagram.",
        }, window.location.origin);
      }

      window.close();
      return;
    }

    if (isConnected) {
      checkConnection();
      toast.success("Instagram conectado com sucesso!");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (hasError) {
      toast.error(errorMessage || "Erro ao conectar Instagram.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleLoginInstagram = async () => {
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
    ].join(",");

    const statePayload = encodeURIComponent(
      btoa(JSON.stringify({ userId: user.id, origin: window.location.origin, ig_flow: true }))
    );

    const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_reauth=true&client_id=${INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${statePayload}`;

    const popup = window.open(authUrl, "instagram_login", "width=600,height=700,scrollbars=yes");

    if (!popup) {
      setConnecting(false);
      toast.error("Libere pop-ups do navegador para continuar.");
      return;
    }

    // Listen for postMessage from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "META_OAUTH_SUCCESS") {
        setConnecting(false);
        checkConnection();
        toast.success("Instagram conectado com sucesso!");
        window.removeEventListener("message", handleMessage);
      }

      if (event.data?.type === "META_OAUTH_ERROR") {
        setConnecting(false);
        toast.error(event.data?.message || "Erro ao conectar Instagram.");
        window.removeEventListener("message", handleMessage);
      }
    };
    window.addEventListener("message", handleMessage);

    // Also poll for popup close + check DB
    const checkClosed = setInterval(async () => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        setConnecting(false);
        // Check DB in case postMessage didn't work (cross-origin)
        await checkConnection();
      }
    }, 1500);
  };

  const handleDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("meta_credentials")
        .update({ connected: false, access_token: null })
        .eq("user_id", user.id)
        .eq("app_id", INSTAGRAM_APP_ID);

      setIsConnected(false);
      setAccountName("");
      setProfilePicUrl("");
      toast.info("Instagram desconectado");
    } catch (err) {
      toast.error("Erro ao desconectar");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (checkingStatus) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            <div className={`w-16 h-16 rounded-full flex items-center justify-center overflow-hidden ${isConnected ? "bg-primary/10" : "bg-muted/30"}`}>
              {isConnected && profilePicUrl ? (
                <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover rounded-full" />
              ) : isConnected ? (
                <CheckCircle2 className="w-8 h-8 text-primary" />
              ) : (
                <Instagram className="w-8 h-8 text-muted-foreground" />
              )}
            </div>

            {isConnected ? (
              <>
                <div>
                  <Badge className="bg-primary/10 text-primary border-primary/30 mb-2">Conectado</Badge>
                  <p className="text-sm font-medium">{accountName}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sua conta está pronta para automações</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={checkConnection} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Verificar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    Desconectar
                  </Button>
                </div>
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
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">URL de Callback</p>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl, "URL")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Verificar Token</p>
            <div className="flex gap-2">
              <Input value={verifyToken} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(verifyToken, "Token")}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cole a URL e o token no painel do Meta Developer (Passo 3 — Configurar webhooks)
          </p>
        </CardContent>
      </Card>

      {/* Redirect URI for Developer Console */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">URI de Redirecionamento (para o Meta Developer)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input value={REDIRECT_URI} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(REDIRECT_URI, "URI")}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Adicione esta URL em <strong>Instagram &gt; Configurações Básicas &gt; URIs de Redirecionamento do OAuth válidos</strong> no Meta Developer
          </p>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">Permissões solicitadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs text-muted-foreground">
          <p>• <strong>instagram_business_basic</strong> — Acesso ao perfil da conta profissional</p>
          <p>• <strong>instagram_business_manage_comments</strong> — Ler e responder comentários</p>
          <p>• <strong>instagram_business_manage_messages</strong> — Enviar e ler Direct Messages</p>
        </CardContent>
      </Card>
    </div>
  );
}
