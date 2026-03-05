import { 
  LayoutDashboard, 
  Smartphone, 
  Send, 
  FileText, 
  Users, 
  BarChart3, 
  Settings,
  UserCircle,
  Megaphone,
  ShieldCheck,
  Workflow,
  Webhook
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LogoImage } from "./LogoImage";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  activeItem?: string;
  userId?: string;
}

const menuItems = [
  { id: "painel", label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
  { id: "dispositivos", label: "Dispositivos", icon: Smartphone, path: "/dispositivos" },
  { id: "enviar-mensagem", label: "Enviar", icon: Send, path: "/enviar-mensagem" },
  { id: "modelos", label: "Modelos", icon: FileText, path: "/modelos" },
  { id: "fluxo-visual", label: "Fluxo", icon: Workflow, path: "/fluxo-visual" },
  { id: "campanhas", label: "Campanhas", icon: Megaphone, path: "/campanhas" },
  { id: "contatos", label: "Contatos", icon: Users, path: "/contatos" },
  { id: "relatorio", label: "Relatório", icon: BarChart3, path: "/relatorio" },
  { id: "gateway", label: "Integração", icon: Webhook, path: "/gateway" },
];

const bottomItems = [
  { id: "perfil", label: "Perfil", icon: UserCircle, path: "/perfil", adminOnly: false },
  { id: "admin", label: "Admin", icon: ShieldCheck, path: "/admin", adminOnly: true },
  { id: "configuracao-zapi", label: "Config", icon: Settings, path: "/configuracao-zapi", adminOnly: true },
];

export function Sidebar({ activeItem = "painel", userId }: SidebarProps) {
  const { isAdmin, loading } = useUserRole(userId);

  const renderItem = (item: { id: string; label: string; icon: any; path: string; adminOnly?: boolean }) => {
    if (item.adminOnly && !loading && !isAdmin) return null;

    const Icon = item.icon;
    const isActive = activeItem === item.id;

    return (
      <li key={item.id}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-[10px] font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="leading-none">{item.label}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  };

  return (
    <div className="w-[72px] bg-card border-r border-border h-screen flex flex-col items-center py-3 gap-1">
      {/* Logo */}
      <div className="mb-3">
        <LogoImage className="w-9 h-9 object-contain" />
      </div>

      {/* Main Menu */}
      <nav className="flex-1 overflow-y-auto w-full px-1.5">
        <ul className="space-y-0.5">
          {menuItems.map(renderItem)}
        </ul>
      </nav>

      {/* Bottom */}
      <div className="w-full px-1.5 pt-2 border-t border-border">
        <ul className="space-y-0.5">
          {bottomItems.map(renderItem)}
        </ul>
      </div>
    </div>
  );
}
