import { useState } from "react";
import { Bell, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <>
      <header className="bg-card border-b border-border px-6 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setRenewOpen(true)}
          >
            Renovar
          </Button>

          <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => setNotificationsOpen(true)}>
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSettingsOpen(true)}>
            <Settings className="w-4 h-4" />
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onNavigate?.("perfil")}>
            <User className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <NotificationsDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RenewDialog open={renewOpen} onOpenChange={setRenewOpen} />
    </>
  );
}
