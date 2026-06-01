import { useState, useEffect } from "react";
import { Bell, Check, X, Shield, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useWebPush } from "@/hooks/useWebPush";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "success" | "warning" | "error";
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    title: "Campanha concluída",
    message: "A campanha 'Promoção de Verão' foi enviada para 150 contatos",
    time: "há 5 minutos",
    read: false,
    type: "success"
  },
  {
    id: "2",
    title: "Dispositivo desconectado",
    message: "Seu dispositivo WhatsApp foi desconectado. Reconecte para continuar enviando mensagens.",
    time: "há 1 hora",
    read: false,
    type: "warning"
  },
  {
    id: "3",
    title: "Novo contato adicionado",
    message: "Um novo contato foi adicionado à sua lista",
    time: "há 2 horas",
    read: true,
    type: "info"
  },
];

interface NotificationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsDialog({ open, onOpenChange }: NotificationsDialogProps) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState(mockNotifications);
  const { pushEnabled, pushBusy, permissionStatus, enablePush } = useWebPush();
  const { toast } = useToast();
  const [isIOS, setIsIOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsPWA(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success": return "bg-green-500";
      case "warning": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-blue-500";
    }
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    toast({
      title: t("Notificações marcadas como lidas"),
      description: t("Todas as notificações foram marcadas como lidas."),
    });
  };

  const clearAll = () => {
    setNotifications([]);
    toast({
      title: t("Notificações limpas"),
      description: t("Todas as notificações foram removidas."),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {t("Notificações")}
          </DialogTitle>
          <DialogDescription>
            {t("Visualize e gerencie suas notificações recentes")}
          </DialogDescription>
        </DialogHeader>
        
        {permissionStatus !== "granted" && (
          <Alert className="mb-4 bg-primary/10 border-primary/20">
            <Shield className="w-4 h-4 text-primary" />
            <AlertTitle className="text-sm font-semibold">{t("Notificações Desativadas")}</AlertTitle>
            <AlertDescription className="text-xs">
              {t("Ative as notificações para receber alertas de vendas e PIX em tempo real.")}
              {isIOS && !isPWA && (
                <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500 font-medium">
                  <Smartphone className="w-3 h-3 inline mr-1" /> {t('No iOS, você precisa clicar em "Compartilhar" e "Adicionar à Tela de Início" primeiro.')}
                </div>
              )}
            </AlertDescription>
            <Button
              className="w-full mt-3 h-8 text-xs bg-primary hover:bg-primary/90"
              disabled={pushBusy || (isIOS && !isPWA)}
              onClick={() => {
                enablePush().then(() => {
                  toast({ title: t("Notificações ativadas!"), description: t("Você receberá alertas em tempo real agora.") });
                }).catch(e => {
                  toast({ title: t("Erro ao ativar"), description: e.message, variant: "destructive" });
                });
              }}
            >
              {pushBusy ? t("Ativando...") : t("Ativar Notificações")}
            </Button>
          </Alert>
        )}

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t("Nenhuma notificação")}</p>
              </div>
            ) : (
              notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border ${
                  notification.read ? "bg-muted/30" : "bg-card"
                } hover:bg-muted/50 transition-colors`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${getTypeColor(notification.type)}`} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm">{notification.title}</h4>
                      {!notification.read && (
                        <Badge variant="secondary" className="text-xs">{t("Nova")}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">{notification.time}</p>
                  </div>
                </div>
              </div>
            ))
            )}
          </div>
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" className="flex-1" onClick={markAllAsRead}>
              <Check className="w-4 h-4 mr-2" />
              {t("Marcar todas como lidas")}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={clearAll}>
              <X className="w-4 h-4 mr-2" />
              {t("Limpar todas")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
