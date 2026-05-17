import { useState } from "react";
import { Bell, Settings, User, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const { setTheme } = useTheme();

   const toggleTheme = (newTheme: string) => {
     setTheme(newTheme);
     if (newTheme === "blue") {
       document.documentElement.setAttribute("data-theme", "blue");
       document.body.setAttribute("data-theme", "blue");
     } else {
       document.documentElement.removeAttribute("data-theme");
       document.body.removeAttribute("data-theme");
     }
   };

  return (
    <>
      <header className="glass-topbar px-5 py-2.5 flex items-center justify-between gap-1.5 z-10">
        <WorkspaceSelector />

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/10">
                <Palette className="w-4 h-4 text-foreground/60 [[data-theme='blue']_&]:text-[#111827]" />
            </Button>
          </DropdownMenuTrigger>
           <DropdownMenuContent align="end" className="w-32 rounded-xl bg-popover border-border">
             <DropdownMenuItem onClick={() => toggleTheme("dark")} className="flex items-center gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground">
               <div className="w-3 h-3 rounded-full bg-[#7c3aed]" />
               <span className="text-foreground">Roxo</span>
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => toggleTheme("blue")} className="flex items-center gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground">
               <div className="w-3 h-3 rounded-full bg-[#2563EB]" />
               <span className="text-foreground">Azul</span>
             </DropdownMenuItem>
           </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="btn-glass-renew text-xs h-8 px-3 rounded-full"
            onClick={() => setRenewOpen(true)}
          >
            Renovar
          </Button>

          <div className="w-px h-5 bg-white/10 mx-1" />

           <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-lg hover:bg-foreground/10" onClick={() => setNotificationsOpen(true)}>
              <Bell className="w-4 h-4 text-foreground/60 [[data-theme='blue']_&]:text-[#111827]" />
             <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#f472b6] rounded-full ring-2 ring-background" />
          </Button>

           <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-foreground/10" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4 text-foreground/60 [[data-theme='blue']_&]:text-[#111827]" />
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white/10" onClick={() => onNavigate?.("perfil")}>
            <div className="w-7 h-7 rounded-full bg-[rgba(167,139,250,0.18)] border border-[rgba(167,139,250,0.30)] flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-[#c4b5fd]" />
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
