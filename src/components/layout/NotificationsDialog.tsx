import { Bell, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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
  const getTypeColor = (type: string) => {
    switch (type) {
      case "success": return "bg-green-500";
      case "warning": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-blue-500";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {mockNotifications.map((notification) => (
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
                        <Badge variant="secondary" className="text-xs">Nova</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">{notification.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" className="flex-1">
            <Check className="w-4 h-4 mr-2" />
            Marcar todas como lidas
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <X className="w-4 h-4 mr-2" />
            Limpar todas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
