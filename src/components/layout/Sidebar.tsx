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
  Activity,
  Wallet,
  Receipt,
  Instagram,
  Flame
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LogoImage } from "./LogoImage";
import logoPayImage from "@/assets/logo-pay.png";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useDeviceType } from "@/hooks/useDeviceType";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
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
  { id: "criar-grupos", label: "Meus Grupos", icon: Link2, path: "/criar-grupos" },
  { id: "gateway", label: "Integração", icon: Webhook, path: "/gateway" },
  { id: "agente-ia", label: "Agente IA", icon: Bot, path: "/agente-ia" },
  { id: "aquecimento", label: "Aquecimento de Número", icon: Flame, path: "/aquecimento" },
];

const instagramMenuItems = [
  { id: "ig-dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/instagram/dashboard" },
  { id: "ig-campanhas", label: "Campanhas", icon: Megaphone, path: "/instagram/campanhas" },
  { id: "ig-automacao", label: "Automação", icon: Workflow, path: "/instagram/automacao" },
  { id: "ig-contatos", label: "Contatos", icon: Users, path: "/instagram/contatos" },
  { id: "ig-configuracao", label: "Configuração", icon: Settings, path: "/instagram/configuracao" },
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
  { id: "painel-gateway", label: "Dashboard", icon: LayoutDashboard, path: "/gateway-checkout/dashboard" },
  { id: "pay-products", label: "Produtos", icon: FileText, path: "/gateway-checkout/products" },
  { id: "pay-checkouts", label: "Checkouts", icon: CreditCard, path: "/gateway-checkout/checkouts" },
  { id: "pay-reports", label: "Relatórios", icon: BarChart3, path: "/gateway-checkout/reports" },
  { id: "pay-cart-recovery", label: "Recuperação de Carrinhos", icon: ShoppingCart, path: "/gateway-checkout/cart-recovery" },
  { id: "pay-fees", label: "Taxas", icon: Receipt, path: "/gateway-checkout/fees" },
  { id: "pay-pixels", label: "Pixels", icon: Activity, path: "/gateway-checkout/pixels" },
  { id: "pay-integrations", label: "Integrações", icon: PlugZap, path: "/gateway-checkout/integrations" },
  { id: "pay-withdrawals", label: "Saques", icon: Wallet, path: "/gateway-checkout/withdrawals" },
  { id: "pay-settings", label: "Configurações", icon: Settings, path: "/gateway-checkout/settings" },
];

const zapiBottomItems = [
  { id: "perfil", label: "Perfil", icon: UserCircle, path: "/perfil", adminOnly: false },
  { id: "admin", label: "Admin", icon: ShieldCheck, path: "/admin", adminOnly: true },
];

const metaBottomItems = [
  { id: "perfil", label: "Perfil", icon: UserCircle, path: "/perfil", adminOnly: false },
  { id: "admin", label: "Admin", icon: ShieldCheck, path: "/admin", adminOnly: true },
  { id: "configuracao-meta", label: "Configuração", icon: Globe, path: "/meta/configuracao", adminOnly: false },
];

const gatewayBottomItems = [
  { id: "perfil", label: "Perfil", icon: UserCircle, path: "/perfil", adminOnly: false },
  { id: "admin", label: "Admin", icon: ShieldCheck, path: "/admin", adminOnly: true },
  { id: "pay-docs", label: "Documentação", icon: FileText, path: "/gateway-checkout/docs", adminOnly: false },
];

export function Sidebar({ activeItem = "painel", userId }: SidebarProps) {
  const { isAdmin, loading } = useUserRole(userId);
  const { activeWorkspace, workspaceLabel } = useWorkspace();
  const { isNative } = useDeviceType();
  const { isPaid } = useSubscriptionStatus();
  const [collapsed, setCollapsed] = useState(false);

  const dashboardIds = ["painel", "painel-meta", "painel-gateway"];

  const allMenuItems = activeWorkspace === "gateway" ? gatewayMenuItems : activeWorkspace === "meta" ? metaMenuItems : zapiMenuItems;
  const allBottomItems = activeWorkspace === "gateway" ? gatewayBottomItems : activeWorkspace === "meta" ? metaBottomItems : zapiBottomItems;

  const menuItems = isNative ? allMenuItems.filter(i => dashboardIds.includes(i.id)) : allMenuItems;
  const bottomItems = isNative ? [] : allBottomItems;
  const brandLabel = activeWorkspace === "gateway" ? "ZaplynxPay" : activeWorkspace === "meta" ? "Meta API" : "ZapLynx";

  const renderItem = (item: { id: string; label: string; icon: any; path: string; adminOnly?: boolean; external?: boolean }) => {
    if (item.adminOnly && !loading && !isAdmin) return null;

    const Icon = item.icon;
    const isActive = activeItem === item.id;

    const linkContent = (
      <>
        <Icon className={cn(
          "shrink-0 transition-colors duration-200",
          collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )} />
        {!collapsed && (
          <span className="truncate">{item.label}</span>
        )}
      </>
    );

    const className = cn(
      "group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 sidebar-item",
      collapsed && "justify-center px-2",
      isActive
        ? "sidebar-item-active"
        : "border border-transparent"
    );

    return (
      <li key={item.id}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {item.external ? (
              <a href={item.path} target="_blank" rel="noopener noreferrer" className={className}>
                {linkContent}
              </a>
            ) : (
              <Link to={item.path} className={className}>
                {linkContent}
              </Link>
            )}
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
      "glass-sidebar h-screen flex flex-col transition-all duration-300 ease-in-out relative z-10",
      collapsed ? "w-[60px]" : "w-[180px]"
    )}>
      {/* Logo + Brand */}
      <div className={cn(
        "flex items-center gap-2.5 px-4 py-4 border-b border-white/10",
        collapsed && "justify-center px-2"
      )}>
        {activeWorkspace === "gateway" ? (
          <div className="w-8 h-8 rounded-lg bg-[rgba(167,139,250,0.18)] flex items-center justify-center shrink-0">
            <CreditCard className="w-4.5 h-4.5 text-[#c4b5fd]" />
          </div>
        ) : activeWorkspace === "meta" ? (
          <div className="w-8 h-8 rounded-lg bg-[#0668E1]/10 flex items-center justify-center shrink-0">
            <Globe className="w-4.5 h-4.5 text-[#0668E1]" />
          </div>
        ) : (
          <LogoImage className="h-16 object-contain shrink-0" />
        )}
        {!collapsed && activeWorkspace !== "zapi" && (
          <span className="font-bebas text-[22px] text-white leading-none">
            {brandLabel === "ZaplynxPay" ? (
              <>Zaplynx<span className="bg-gradient-to-r from-[#a78bfa] to-[#f472b6] bg-clip-text text-transparent">Pay</span></>
            ) : (
              <>Meta<span className="bg-gradient-to-r from-[#a78bfa] to-[#f472b6] bg-clip-text text-transparent"> API</span></>
            )}
          </span>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[52px] z-10 w-6 h-6 rounded-full border border-white/15 bg-[#1a1040] shadow-md flex items-center justify-center hover:bg-[#24243e] transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-white/60" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-white/60" />
        )}
      </button>

      {/* Section label */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-1">
          <span className="sidebar-section-label">Menu</span>
        </div>
      )}

      {/* Main Menu */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <ul className="space-y-0.5">
          {menuItems.map(renderItem)}
        </ul>

        {/* Instagram section - only for admins */}
        {activeWorkspace === "zapi" && isAdmin && (
          <>
            {!collapsed && (
              <div className="px-2 pt-3 pb-1">
                <span className="sidebar-section-label">Instagram</span>
              </div>
            )}
            <ul className="space-y-0.5">
              {instagramMenuItems.map(renderItem)}
            </ul>
          </>
        )}
      </nav>

      {/* Bottom */}
      {!collapsed && (
        <div className="px-4 pb-1">
          <span className="sidebar-section-label">Sistema</span>
        </div>
      )}
      <div className="px-2 pb-3 border-t border-white/10 pt-2">
        <ul className="space-y-0.5">
          {bottomItems.map(renderItem)}
        </ul>
      </div>
    </div>
  );
}
