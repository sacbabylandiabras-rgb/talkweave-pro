import { useState } from "react";
import { Bell, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsDialog } from "./NotificationsDialog";
import { SettingsDialog } from "./SettingsDialog";
import { RenewDialog } from "./RenewDialog";
import { WorkspaceSelector } from "./WorkspaceSelector";

interface HeaderProps {
  onNavigate?: (page: string) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);

  return (
    <>
      <header className="bg-card/60 backdrop-blur-xl border-b border-border/60 px-5 py-2.5 flex items-center justify-between gap-1.5">
        <WorkspaceSelector />

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/20 hover:bg-destructive/5 text-xs h-8 px-3 rounded-lg font-medium"
            onClick={() => setRenewOpen(true)}
          >
            Renovar
          </Button>

          <div className="w-px h-5 bg-border/60 mx-1" />

          <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-lg hover:bg-muted/60" onClick={() => setNotificationsOpen(true)}>
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full ring-2 ring-card" />
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/60" onClick={() => setSettingsOpen(true)}>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/60" onClick={() => onNavigate?.("perfil")}>
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
          </Button>
        </div>
      </header>

      <NotificationsDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RenewDialog open={renewOpen} onOpenChange={setRenewOpen} />
    </>
  );
}
