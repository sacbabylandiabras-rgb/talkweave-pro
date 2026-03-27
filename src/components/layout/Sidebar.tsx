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
  MessageCircle,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Bot,
  Link2,
  FileCheck,
  CloudUpload,
  Globe,
  ShoppingCart,
  CreditCard,
  PlugZap,
  Activity
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LogoImage } from "./LogoImage";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";

interface SidebarProps {
  activeItem?: string;
  userId?: string;
}

const zapiMenuItems = [
  { id: "painel", label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
  { id: "dispositivos", label: "Dispositivos", icon: Smartphone, path: "/dispositivos" },
  { id: "mensagens", label: "Mensagens", icon: MessageCircle, path: "/mensagens" },
  { id: "modelos", label: "Modelos", icon: FileText, path: "/modelos" },
  { id: "fluxo-visual", label: "Fluxo Visual", icon: Workflow, path: "/fluxo-visual" },
  { id: "campanhas", label: "Campanhas", icon: Megaphone, path: "/campanhas" },
  { id: "enviar-mensagem", label: "Enviar", icon: Send, path: "/enviar-mensagem" },
  { id: "contatos", label: "Contatos", icon: Users, path: "/contatos" },
  { id: "relatorio", label: "Relatório", icon: BarChart3, path: "/relatorio" },
  { id: "apanhador-grupos", label: "Grupos", icon: UserPlus, path: "/apanhador-grupos" },
  { id: "criar-grupos", label: "Criar Grupos", icon: Link2, path: "/criar-grupos" },
  { id: "gateway", label: "Integração", icon: Webhook, path: "/gateway" },
  { id: "agente-ia", label: "Agente IA", icon: Bot, path: "/agente-ia" },
];

const metaMenuItems = [
  { id: "painel-meta", label: "Painel", icon: LayoutDashboard, path: "/meta/dashboard" },
  { id: "templates-aprovados", label: "Templates", icon: FileCheck, path: "/meta/templates" },
  { id: "envio-meta", label: "Enviar", icon: Send, path: "/meta/enviar" },
  { id: "fluxo-visual", label: "Fluxo Visual", icon: Workflow, path: "/fluxo-visual" },
  { id: "campanhas", label: "Campanhas", icon: Megaphone, path: "/campanhas" },
  { id: "contatos", label: "Contatos", icon: Users, path: "/contatos" },
  { id: "relatorio", label: "Relatório", icon: BarChart3, path: "/relatorio" },
  { id: "gateway", label: "Integração", icon: Webhook, path: "/gateway" },
];

const gatewayMenuItems = [
  { id: "painel-gateway", label: "Painel", icon: LayoutDashboard, path: "/gateway-checkout/dashboard" },
  { id: "integracoes", label: "Integrações", icon: PlugZap, path: "/gateway-checkout/integracoes" },
  { id: "checkout", label: "Checkout", icon: CreditCard, path: "/gateway-checkout/checkout" },
  { id: "webhooks", label: "Webhooks", icon: Webhook, path: "/gateway-checkout/webhooks" },
  { id: "logs-gateway", label: "Logs", icon: Activity, path: "/gateway-checkout/logs" },
  { id: "contatos", label: "Contatos", icon: Users, path: "/contatos" },
];

const zapiBottomItems = [
  { id: "perfil", label: "Perfil", icon: UserCircle, path: "/perfil", adminOnly: false },
  { id: "admin", label: "Admin", icon: ShieldCheck, path: "/admin", adminOnly: true },
  { id: "configuracao-zapi", label: "Configuração", icon: Settings, path: "/configuracao-zapi", adminOnly: true },
];

const metaBottomItems = [
  { id: "perfil", label: "Perfil", icon: UserCircle, path: "/perfil", adminOnly: false },
  { id: "admin", label: "Admin", icon: ShieldCheck, path: "/admin", adminOnly: true },
  { id: "configuracao-meta", label: "Configuração", icon: Globe, path: "/meta/configuracao", adminOnly: false },
];

const gatewayBottomItems = [
  { id: "perfil", label: "Perfil", icon: UserCircle, path: "/perfil", adminOnly: false },
  { id: "admin", label: "Admin", icon: ShieldCheck, path: "/admin", adminOnly: true },
];

export function Sidebar({ activeItem = "painel", userId }: SidebarProps) {
  const { isAdmin, loading } = useUserRole(userId);
  const { activeWorkspace, workspaceLabel } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = activeWorkspace === "gateway" ? gatewayMenuItems : activeWorkspace === "meta" ? metaMenuItems : zapiMenuItems;
  const bottomItems = activeWorkspace === "gateway" ? gatewayBottomItems : activeWorkspace === "meta" ? metaBottomItems : zapiBottomItems;
  const brandLabel = activeWorkspace === "gateway" ? "Gateway" : activeWorkspace === "meta" ? "Meta API" : "ZapLynx";

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
                "group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
              )}
            >
              <Icon className={cn(
                "shrink-0 transition-colors duration-200",
                collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
              )} />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="font-medium text-xs">
              {item.label}
            </TooltipContent>
          )}
        </Tooltip>
      </li>
    );
  };

  return (
    <div className={cn(
      "bg-card border-r border-border h-screen flex flex-col transition-all duration-300 ease-in-out relative",
      collapsed ? "w-[60px]" : "w-[220px]"
    )}>
      {/* Logo + Brand */}
      <div className={cn(
        "flex items-center gap-2.5 px-4 py-4 border-b border-border",
        collapsed && "justify-center px-2"
      )}>
        {activeWorkspace === "meta" ? (
          <div className="w-8 h-8 rounded-lg bg-[#0668E1]/10 flex items-center justify-center shrink-0">
            <Globe className="w-4.5 h-4.5 text-[#0668E1]" />
          </div>
        ) : (
          <LogoImage className="w-8 h-8 object-contain shrink-0" />
        )}
        {!collapsed && (
          <span className="text-sm font-bold text-foreground tracking-tight">{brandLabel}</span>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[52px] z-10 w-6 h-6 rounded-full border border-border bg-card shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Section label */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Menu</span>
        </div>
      )}

      {/* Main Menu */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <ul className="space-y-0.5">
          {menuItems.map(renderItem)}
        </ul>
      </nav>

      {/* Bottom */}
      {!collapsed && (
        <div className="px-4 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Sistema</span>
        </div>
      )}
      <div className="px-2 pb-3 border-t border-border pt-2">
        <ul className="space-y-0.5">
          {bottomItems.map(renderItem)}
        </ul>
      </div>
    </div>
  );
}
