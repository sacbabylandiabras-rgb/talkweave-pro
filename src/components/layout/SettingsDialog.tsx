import { Settings, Moon, Sun, Globe, Bell, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações
          </DialogTitle>
          <DialogDescription>
            Personalize as preferências do seu sistema
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Tema */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">Aparência</h3>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="theme" className="text-sm">Tema do sistema</Label>
              <Select defaultValue="light">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Notificações */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">Notificações</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-email" className="text-sm">Notificações por email</Label>
                <Switch id="notifications-email" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-push" className="text-sm">Notificações push</Label>
                <Switch id="notifications-push" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-campaign" className="text-sm">Alertas de campanha</Label>
                <Switch id="notifications-campaign" defaultChecked />
              </div>
            </div>
          </div>

          <Separator />

          {/* Idioma */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">Idioma</h3>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="language" className="text-sm">Idioma do sistema</Label>
              <Select defaultValue="pt-br">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-br">Português (BR)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Privacidade */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">Privacidade e Segurança</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="two-factor" className="text-sm">Autenticação de dois fatores</Label>
                <Switch id="two-factor" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="activity-log" className="text-sm">Log de atividades</Label>
                <Switch id="activity-log" defaultChecked />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
