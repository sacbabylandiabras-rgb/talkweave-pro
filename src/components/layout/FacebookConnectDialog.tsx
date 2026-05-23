import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, CheckCircle2, Loader2, MessageSquare, Users, BarChart3, LogOut, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMetaCredentials } from "@/hooks/useMetaCredentials";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNavigate } from "react-router-dom";
import {
  buildLegacyFacebookOAuthUrl,
  createMetaOAuthState,
  loadMetaSdk,
  META_EMBEDDED_SIGNUP_CONFIG_ID,
  requestWhatsAppEmbeddedSignupCode,
} from "@/lib/meta-sdk";

interface FacebookConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

  const META_APP_ID = "26985190684454065";

export function FacebookConnectDialog({ open, onOpenChange }: FacebookConnectDialogProps) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const queryClient = useQueryClient();
   const { data: metaCreds, isLoading: loadingCreds, isFetching } = useMetaCredentials(META_APP_ID);
  const { setActiveWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const isConnected = metaCreds?.connected === true;

  useEffect(() => {
    if (!open || isConnected || !META_EMBEDDED_SIGNUP_CONFIG_ID) return;

    void loadMetaSdk().catch((error) => {
      console.warn("Meta SDK preload failed:", error);
    });
  }, [open, isConnected]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "META_OAUTH_SUCCESS") {
        setConnecting(false);
        toast.success("Conta Facebook Business conectada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["meta-credentials"] });
        onOpenChange(false);
        setActiveWorkspace("meta");
        setTimeout(() => navigate("/meta/dashboard"), 300);
        return;
      }

      if (event.data?.type === "META_OAUTH_ERROR") {
        setConnecting(false);
        toast.error(event.data?.message || "Não foi possível concluir a conexão com a Meta.");
      }
    };
    window.addEventListener("message", handler);

    const focusHandler = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connected") === "1") {
        setConnecting(false);
        toast.success("Conta conectada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["meta-credentials"] });
        const url = new URL(window.location.href);
        url.searchParams.delete("connected");
        window.history.replaceState({}, "", url.pathname);
        onOpenChange(false);
        setActiveWorkspace("meta");
        setTimeout(() => navigate("/meta/dashboard"), 300);
      }
    };
    window.addEventListener("focus", focusHandler);

    // Cross-tab fallback channels
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("meta-oauth");
      bc.onmessage = (event) => {
        if (event.data?.type === "META_OAUTH_SUCCESS") {
          setConnecting(false);
          toast.success("Conta Facebook Business conectada com sucesso!");
          queryClient.invalidateQueries({ queryKey: ["meta-credentials"] });
          onOpenChange(false);
          setActiveWorkspace("meta");
          setTimeout(() => navigate("/meta/dashboard"), 300);
        }
      };
    } catch {}

    const storageHandler = (event: StorageEvent) => {
      if (event.key === "meta_oauth_event" && event.newValue?.startsWith("success:")) {
        setConnecting(false);
        toast.success("Conta Facebook Business conectada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["meta-credentials"] });
        onOpenChange(false);
        setActiveWorkspace("meta");
        setTimeout(() => navigate("/meta/dashboard"), 300);
      }
    };
    window.addEventListener("storage", storageHandler);

    return () => {
      window.removeEventListener("message", handler);
      window.removeEventListener("focus", focusHandler);
      window.removeEventListener("storage", storageHandler);
      if (bc) bc.close();
    };
  }, [queryClient]);

  const getPopupFeatures = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    return `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`;
  };

  const openLegacyFacebookPopup = async () => {
    const popup = window.open("", "facebook_connect", getPopupFeatures());

    if (!popup) {
      throw new Error("Libere pop-ups do navegador para continuar.");
    }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      popup.close();
      throw new Error("Você precisa estar logado");
    }

    const statePayload = createMetaOAuthState({
      userId: user.id,
      origin: window.location.origin,
    });

    popup.location.href = buildLegacyFacebookOAuthUrl(statePayload);

    const checkPopup = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(checkPopup);
        window.setTimeout(() => setConnecting(false), 1500);
      }
    }, 500);
  };

  const handleFacebookConnect = async () => {
    setConnecting(true);

    try {
      if (!META_EMBEDDED_SIGNUP_CONFIG_ID) {
        await openLegacyFacebookPopup();
        return;
      }

      const statePayload = createMetaOAuthState({
        origin: window.location.origin,
      });

      if (META_EMBEDDED_SIGNUP_CONFIG_ID) {
        const code = await requestWhatsAppEmbeddedSignupCode();
        const { data, error } = await supabase.functions.invoke("meta-oauth-callback", {
          body: {
            code,
            origin: window.location.origin,
            state: statePayload,
            redirectUri: `https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/meta-oauth-callback`,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("Conta Facebook Business conectada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ["meta-credentials"] });
        onOpenChange(false);
        setActiveWorkspace("meta");
        setTimeout(() => navigate("/meta/dashboard"), 300);
      } else {
        await openLegacyFacebookPopup();
      }
    } catch (err) {
      console.error("Meta embedded signup error:", err);
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir a conexão com a Meta.");
    } finally {
      setConnecting(false);
    }
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
        .eq("user_id", user.id)
        .eq("app_id", META_APP_ID);

      if (error) throw error;

      toast.success("Conta desconectada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["meta-credentials"] });
      setShowDisconnectConfirm(false);
    } catch (err) {
      console.error("Disconnect error:", err);
      toast.error("Erro ao desconectar conta");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#1877F2]/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#1877F2]" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <div>
              <DialogTitle className="text-base">
                {isConnected ? "Conta Facebook Conectada" : "Conectar com Facebook"}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {isConnected
                  ? `Conectado como ${metaCreds?.fb_user_name || "Conta Business"}`
                  : "Vincule sua conta Business para usar a API oficial"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

         {(loadingCreds) ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isConnected && !showDisconnectConfirm ? (
          <div className="space-y-4">
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {metaCreds?.fb_user_name || "Conta conectada"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sua conta Facebook Business está vinculada e ativa.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Status</span>
                <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">
                  Conectado
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">WABA ID</span>
                <span className="text-[11px] font-mono text-foreground">
                  {metaCreds?.waba_id || "—"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">API Version</span>
                <span className="text-[11px] font-mono text-foreground">v21.0</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                onClick={() => setShowDisconnectConfirm(true)}
              >
                <LogOut className="w-3.5 h-3.5" />
                Desconectar
              </Button>
            </div>
          </div>
        ) : isConnected && showDisconnectConfirm ? (
          <div className="space-y-4">
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Desconectar conta?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Isso removerá o acesso à API oficial do WhatsApp. Você poderá reconectar a qualquer momento.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDisconnectConfirm(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-1.5"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                {disconnecting ? "Desconectando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">Permissões solicitadas:</p>
              <div className="space-y-2">
                {[
                  { icon: MessageSquare, label: "WhatsApp Business Messaging", desc: "Enviar e receber mensagens" },
                  { icon: Users, label: "Business Management", desc: "Gerenciar conta Business" },
                  { icon: BarChart3, label: "WhatsApp Business Management", desc: "Templates e configurações" },
                ].map((perm) => (
                  <div key={perm.label} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-background flex items-center justify-center flex-shrink-0 mt-0.5">
                      <perm.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-foreground">{perm.label}</p>
                      <p className="text-[10px] text-muted-foreground">{perm.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
              <Shield className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-[10px] text-muted-foreground">
                Conexão segura via OAuth. Não armazenamos sua senha do Facebook.
              </p>
            </div>

            <Button
              className="w-full gap-2.5 h-11 bg-[#1877F2] hover:bg-[#166FE5] text-white"
              onClick={handleFacebookConnect}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              )}
              {connecting ? "Conectando..." : "Continuar com Facebook"}
            </Button>

            <p className="text-[10px] text-muted-foreground text-center">
              Ao continuar, você autoriza o ZapLynx a acessar sua conta WhatsApp Business via API oficial da Meta.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}