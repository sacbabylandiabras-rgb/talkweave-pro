import { useState } from "react";
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
  Webhook,
  ChevronLeft,
  ChevronRight
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
  { id: "enviar-mensagem", label: "Enviar mensagem", icon: Send, path: "/enviar-mensagem" },
  { id: "modelos", label: "Modelos", icon: FileText, path: "/modelos" },
  { id: "fluxo-visual", label: "Fluxo Visual", icon: Workflow, path: "/fluxo-visual" },
  { id: "campanhas", label: "Campanhas", icon: Megaphone, path: "/campanhas" },
  { id: "contatos", label: "Contatos", icon: Users, path: "/contatos" },
  { id: "relatorio", label: "Relatório", icon: BarChart3, path: "/relatorio" },
  { id: "gateway", label: "Integração", icon: Webhook, path: "/gateway" },
];

const bottomItems = [
  { id: "perfil", label: "Perfil", icon: UserCircle, path: "/perfil" },
  { id: "admin", label: "Administração", icon: ShieldCheck, path: "/admin", adminOnly: true },
  { id: "configuracao-zapi", label: "Config Z-API", icon: Settings, path: "/configuracao-zapi", adminOnly: true },
];

export function Sidebar({ activeItem = "painel", userId }: SidebarProps) {
  const { isAdmin, loading } = useUserRole(userId);
  const [collapsed, setCollapsed] = useState(false);

  const renderItem = (item: typeof menuItems[0] & { adminOnly?: boolean }) => {
    if (item.adminOnly && !loading && !isAdmin) return null;

    const Icon = item.icon;
    const isActive = activeItem === item.id;

    const linkContent = (
      <Link
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          "hover:bg-primary/10",
          isActive
            ? "bg-primary/15 text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-primary")} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <li key={item.id}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </li>
      );
    }

    return <li key={item.id}>{linkContent}</li>;
  };

  return (
    <div className={cn(
      "bg-card border-r border-border h-screen flex flex-col transition-all duration-300",
      collapsed ? "w-[68px]" : "w-60"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <LogoImage className="w-8 h-8 object-contain flex-shrink-0" />
          {!collapsed && (
            <span className="font-bold text-foreground whitespace-nowrap">ZapLynx</span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {menuItems.map(renderItem)}
        </ul>
      </nav>

      {/* Bottom Menu */}
      <div className="py-3 border-t border-border">
        <ul className="space-y-0.5 px-2">
          {bottomItems.map(item => renderItem(item as any))}
        </ul>
      </div>
    </div>
  );
}
