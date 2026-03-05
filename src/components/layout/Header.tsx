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
      <header className="bg-card/80 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-end gap-1">
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs h-7 px-2"
          onClick={() => setRenewOpen(true)}
        >
          Renovar
        </Button>

        <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => setNotificationsOpen(true)}>
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-destructive rounded-full" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSettingsOpen(true)}>
          <Settings className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigate?.("perfil")}>
          <User className="w-4 h-4" />
        </Button>
      </header>

      <NotificationsDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <RenewDialog open={renewOpen} onOpenChange={setRenewOpen} />
    </>
  );
}
