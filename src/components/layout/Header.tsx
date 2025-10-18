import { useState } from "react";
import { Bell, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationsDialog } from "./NotificationsDialog";
import { SettingsDialog } from "./SettingsDialog";
import { RenewDialog } from "./RenewDialog";

interface HeaderProps {
  onNavigate?: (page: string) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <>
      <header className="bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel</h1>
            <p className="text-muted-foreground">Visão geral do seu ZapLynx SaaS</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Date Badge */}
            <Badge variant="outline" className="text-sm">
              {currentDate}
            </Badge>
            
            {/* Renew Button */}
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setRenewOpen(true)}
            >
              Renovar
            </Button>
            
            {/* Notifications */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full"></span>
            </Button>
            
            {/* Settings */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="w-5 h-5" />
            </Button>
            
            {/* User */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onNavigate?.("perfil")}
            >
              <User className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <NotificationsDialog 
        open={notificationsOpen} 
        onOpenChange={setNotificationsOpen} 
      />
      <SettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
      />
      <RenewDialog 
        open={renewOpen} 
        onOpenChange={setRenewOpen} 
      />
    </>
  );
}