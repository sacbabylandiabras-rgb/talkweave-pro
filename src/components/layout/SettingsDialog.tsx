import { useState, useEffect } from "react";
import { Settings, Moon, Sun, Globe, Bell, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "@/i18n";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t, i18n } = useTranslation();
  const { theme: currentTheme, setTheme: setAppTheme } = useTheme();
  const [theme, setTheme] = useState(currentTheme || "light");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [campaignAlerts, setCampaignAlerts] = useState(true);
  const [language, setLanguage] = useState(
    i18n.language?.startsWith("en") ? "en" : "pt-br",
  );
  const [twoFactor, setTwoFactor] = useState(false);
  const [activityLog, setActivityLog] = useState(true);

  useEffect(() => {
    if (currentTheme) {
      setTheme(currentTheme);
    }
  }, [currentTheme]);

  const handleSaveSettings = () => {
    setAppTheme(theme);
    setAppLanguage(language);
    toast({
      title: t("Configurações salvas"),
      description: t("Suas preferências foram atualizadas com sucesso."),
    });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t("Configurações")}
          </DialogTitle>
          <DialogDescription>
            {t("Personalize as preferências do seu sistema")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Tema removido - apenas modo escuro */}

          {/* Notificações */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">{t("Notificações")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-email" className="text-sm">{t("Notificações por email")}</Label>
                <Switch 
                  id="notifications-email" 
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-push" className="text-sm">{t("Notificações push")}</Label>
                <Switch 
                  id="notifications-push" 
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-campaign" className="text-sm">{t("Alertas de campanha")}</Label>
                <Switch 
                  id="notifications-campaign" 
                  checked={campaignAlerts}
                  onCheckedChange={setCampaignAlerts}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Idioma */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">{t("Idioma")}</h3>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="language" className="text-sm">{t("Idioma do sistema")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-br">{t("Português (BR)")}</SelectItem>
                  <SelectItem value="en">{t("English")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Privacidade */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium">{t("Privacidade e Segurança")}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="two-factor" className="text-sm">{t("Autenticação de dois fatores")}</Label>
                <Switch 
                  id="two-factor" 
                  checked={twoFactor}
                  onCheckedChange={setTwoFactor}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="activity-log" className="text-sm">{t("Log de atividades")}</Label>
                <Switch 
                  id="activity-log" 
                  checked={activityLog}
                  onCheckedChange={setActivityLog}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancelar")}
          </Button>
          <Button onClick={handleSaveSettings}>
            {t("Salvar Alterações")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
