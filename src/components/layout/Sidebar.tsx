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
  ChevronDown,
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
  Chrome,
  Flame,
  Send as SendIcon,
  Crown,
  Hash,
  ListChecks,
  Share2,
  Trophy,
  ShoppingBag,
  MessagesSquare,
  Repeat,
  Trash2,
  BellRing,
  TrendingDown,
  Target,
  LinkIcon,
  LayoutTemplate,
  Sparkles,
  Building2,
  Camera,
  Tag,
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
  { id: "perfil-empresa", label: "Perfil Empresa", icon: Building2, path: "/perfil-empresa" },
   { id: "dispositivos", label: "Dispositivos", icon: Smartphone, path: "/dispositivos" },
  { id: "mensagens", label: "Mensagens", icon: MessageCircle, path: "/mensagens" },
  { id: "etiquetas", label: "Etiquetas", icon: Tag, path: "/etiquetas" },
    { id: "modelos", label: "Modelos", icon: FileText, path: "/modelos" },
  { id: "fluxo-visual", label: "Fluxo Visual", icon: Workflow, path: "/fluxo-visual" },
  { id: "campanhas", label: "Campanhas", icon: Megaphone, path: "/campanhas" },
  
  { id: "contatos", label: "Contatos", icon: Users, path: "/contatos" },
  { id: "relatorio", label: "Relatório", icon: BarChart3, path: "/relatorio" },
  { id: "apanhador-grupos", label: "Extrair membros", icon: UserPlus, path: "/apanhador-grupos" },
   { id: "criar-grupos", label: "Links de redirecionamento", icon: Link2, path: "/criar-grupos" },
  { id: "comunidades", label: "Comunidades", icon: Building2, path: "/comunidades" },
  { id: "canais", label: "Canais", icon: Hash, path: "/canais" },
  { id: "campanhas-grupo", label: "Campanhas em Grupo", icon: Megaphone, path: "/campanhas-grupo" },
  { id: "fluxo-grupos", label: "Fluxo Grupos", icon: Workflow, path: "/fluxo-grupos" },
  { id: "gateway", label: "Integração", icon: Webhook, path: "/gateway" },
  { id: "agente-ia", label: "Agente IA", icon: Bot, path: "/agente-ia" },
  { id: "aquecimento", label: "Aquecimento de Número", icon: Flame, path: "/aquecimento" },
 ];

 const instagramMenuItems = [
   { id: "ig-dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/instagram/dashboard" },
    { id: "ig-mensagens", label: "Mensagens", icon: MessageCircle, path: "/instagram/mensagens" },
    { id: "ig-campanhas", label: "Campanhas", icon: Megaphone, path: "/instagram/campanhas" },
   { id: "ig-modelos", label: "Modelos", icon: LayoutTemplate, path: "/instagram/modelos" },
   { id: "ig-automacao", label: "Automação", icon: Workflow, path: "/instagram/automacao" },
   { id: "ig-contatos", label: "Contatos", icon: Users, path: "/instagram/contatos" },
   { id: "ig-configuracao", label: "Configuração", icon: Settings, path: "/instagram/configuracao" },
 ];

const telegramMenuItems = [
  { id: "tg-dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/telegram/dashboard" },
];

const telegramBotSubItems = [
  { id: "tg-criar-bot", label: "Criar novo bot", icon: Bot, path: "/telegram/criar-bot" },
  { id: "tg-atualizar-bot", label: "Atualizar bot", icon: CloudUpload, path: "/telegram/atualizar-bot" },
  { id: "tg-planos", label: "Planos de pagamento", icon: CreditCard, path: "/telegram/planos" },
  { id: "tg-redirect", label: "Botões de redirecionamento", icon: Share2, path: "/telegram/redirecionamento" },
];

const telegramExtrasSubItems = [
  { id: "tg-admins", label: "Administradores", icon: ShieldCheck, path: "/telegram/administradores" },
  { id: "tg-grupos-canais", label: "Grupos e Canais", icon: Hash, path: "/telegram/grupos-canais" },
  { id: "tg-canal-free", label: "Canal Free", icon: Crown, path: "/telegram/canal-free" },
  { id: "tg-referencia", label: "Links de Referência", icon: LinkIcon, path: "/telegram/referencia" },
];

const telegramResultadosSubItems = [
  { id: "tg-contatos", label: "Contatos", icon: Users, path: "/telegram/contatos" },
  { id: "tg-vendas", label: "Gestão de Vendas", icon: ShoppingBag, path: "/telegram/vendas" },
  { id: "tg-chat", label: "Chat ao vivo", icon: MessagesSquare, path: "/telegram/chat" },
];

const telegramRemarketingSubItems = [
  { id: "tg-downsell", label: "Downsell", icon: TrendingDown, path: "/telegram/downsell" },
];

const telegramIntegracoesSubItems = [
  { id: "tg-integracoes", label: "Traqueamento", icon: Target, path: "/telegram/integracoes" },
  { id: "tg-links-traq", label: "Links de Traqueamento", icon: Link2, path: "/telegram/links-traqueamento" },
  { id: "tg-links-utm", label: "Links UTM", icon: LinkIcon, path: "/telegram/links-utm" },
];

const metaMenuItems = [
  { id: "painel-meta", label: "Painel", icon: LayoutDashboard, path: "/meta/dashboard" },
  { id: "mensagens-meta", label: "Mensagens", icon: MessageCircle, path: "/meta/mensagens" },
  { id: "templates-aprovados", label: "Templates", icon: FileCheck, path: "/meta/templates" },
   { id: "envio-meta", label: "Enviar", icon: Send, path: "/meta/enviar" },
   { id: "fluxo-meta", label: "Fluxo Visual", icon: Workflow, path: "/meta/fluxo" },
  { id: "campanhas-meta", label: "Campanhas", icon: Megaphone, path: "/meta/campanhas" },
  { id: "contatos-meta", label: "Contatos", icon: Users, path: "/meta/contatos" },
  { id: "relatorio-meta", label: "Relatório", icon: BarChart3, path: "/meta/relatorio" },
  { id: "gateway-meta", label: "Integração", icon: Webhook, path: "/meta/gateway" },
];

const gatewayMenuItems = [
  { id: "painel-gateway", label: "Dashboard", icon: LayoutDashboard, path: "/gateway-checkout/dashboard" },
  { id: "pay-products", label: "Produtos", icon: FileText, path: "/gateway-checkout/products" },
  { id: "pay-checkouts", label: "Checkouts", icon: CreditCard, path: "/gateway-checkout/checkouts" },
  { id: "pay-landing-pages", label: "Landing Pages", icon: LayoutTemplate, path: "/gateway-checkout/landing-pages" },
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
  { id: "admin-aquecimento", label: "Aquecimento Admin", icon: Flame, path: "/admin/aquecimento", adminOnly: true },
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
  const [botOpen, setBotOpen] = useState(
    ["tg-criar-bot", "tg-atualizar-bot", "tg-planos", "tg-redirect"].includes(activeItem),
  );
  const [extrasOpen, setExtrasOpen] = useState(
    ["tg-admins", "tg-grupos-canais", "tg-canal-free", "tg-referencia"].includes(activeItem),
  );
  const [resultadosOpen, setResultadosOpen] = useState(
    ["tg-contatos", "tg-vendas", "tg-chat"].includes(activeItem),
  );
  const [remarketingOpen, setRemarketingOpen] = useState(
    ["tg-alertas", "tg-downsell"].includes(activeItem),
  );
  const [integracoesOpen, setIntegracoesOpen] = useState(
    ["tg-integracoes", "tg-links-traq", "tg-links-utm"].includes(activeItem),
  );

  const dashboardIds = ["painel", "painel-meta", "painel-gateway"];

  const allMenuItems = activeWorkspace === "gateway" ? gatewayMenuItems : activeWorkspace === "meta" ? metaMenuItems : zapiMenuItems;
  const allBottomItems = activeWorkspace === "gateway" ? gatewayBottomItems : activeWorkspace === "meta" ? metaBottomItems : zapiBottomItems;

  const groupItemIds = ["apanhador-grupos", "criar-grupos"];
  const filteredMenuItems = isPaid
    ? allMenuItems
    : allMenuItems.filter(i => !groupItemIds.includes(i.id));
  const menuItems = isNative ? filteredMenuItems.filter(i => dashboardIds.includes(i.id)) : filteredMenuItems;
  const bottomItems = isNative ? [] : allBottomItems;
  const brandLabel = activeWorkspace === "gateway" ? "ZaplynxPay" : activeWorkspace === "meta" ? "Meta API" : "ZapLynx";

  const renderItem = (item: { id: string; label: string; icon: any; path: string; adminOnly?: boolean; external?: boolean; badge?: string }) => {
    // Hide admin-only items unless the role check has finished AND the user is admin.
    // Showing them while loading would briefly reveal the Admin entry to non-admins.
    if (item.adminOnly && (loading || !isAdmin)) return null;

    const Icon = item.icon;
    const isActive = activeItem === item.id;

    const linkContent = (
      <>
        <Icon className={cn(
          "shrink-0 transition-colors duration-200",
          collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
           isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground [[data-theme='white']_&]:text-[#111827]"
        )} />
        {!collapsed && (
          <>
            <span className="truncate flex-1">{item.label}</span>
            {item.badge && (
              <span className="ml-auto rounded-full bg-primary/20 text-primary text-[9px] font-bold px-1.5 py-0.5 leading-none">
                {item.badge}
              </span>
            )}
          </>
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
      collapsed ? "w-[60px]" : "w-[220px]"
    )}>
      {/* Logo + Brand */}
      <div className={cn(
        "flex items-center px-4 py-4 border-b border-black/10 [[data-theme='white']_&]:border-gray-200",
        collapsed && "justify-center px-0"
      )}>
        <LogoImage className={cn(
          "h-8 object-contain transition-all duration-300 sidebar-logo",
          collapsed ? "w-8" : "w-auto"
        )} />
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
         className="absolute -right-3 top-[52px] z-20 w-6 h-6 rounded-full border border-white/15 bg-[#1a1040] shadow-md flex items-center justify-center hover:bg-[#24243e] transition-colors [[data-theme='white']_&]:bg-white [[data-theme='white']_&]:border-gray-200"
      >
        {collapsed ? (
           <ChevronRight className="w-3.5 h-3.5 text-white/60 [[data-theme='white']_&]:text-[#111827]" />
        ) : (
           <ChevronLeft className="w-3.5 h-3.5 text-white/60 [[data-theme='white']_&]:text-[#111827]" />
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

        {/* Instagram section - paid users or admins */}
        {activeWorkspace === "zapi" && (isPaid || isAdmin) && (
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

        {/* Telegram section - paid users or admins */}
        {activeWorkspace === "zapi" && (isPaid || isAdmin) && (
          <>
            {!collapsed && (
              <div className="px-2 pt-3 pb-1">
                <span className="sidebar-section-label">Telegram</span>
              </div>
            )}
            <ul className="space-y-0.5">
              {/* Dashboard primeiro */}
              {renderItem(telegramMenuItems[0])}

              {/* Grupo expansível "Bot" */}
              <li>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setBotOpen((v) => !v)}
                      className={cn(
                        "group w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 sidebar-item border border-transparent",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Bot
                        className={cn(
                          "shrink-0 transition-colors duration-200",
                          collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
                          botOpen
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-left">Bot</span>
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                              botOpen && "rotate-180",
                            )}
                          />
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="font-medium text-xs">
                      Bot
                    </TooltipContent>
                  )}
                </Tooltip>

                {botOpen && !collapsed && (
                  <ul className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                    {telegramBotSubItems.map(renderItem)}
                  </ul>
                )}
                {botOpen && collapsed && (
                  <ul className="mt-0.5 space-y-0.5">
                    {telegramBotSubItems.map(renderItem)}
                  </ul>
                )}
              </li>

              {/* Grupo expansível "Funções Extras" */}
              <li>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setExtrasOpen((v) => !v)}
                      className={cn(
                        "group w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 sidebar-item border border-transparent",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Sparkles
                        className={cn(
                          "shrink-0 transition-colors duration-200",
                          collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
                          extrasOpen
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-left">Funções Extras</span>
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                              extrasOpen && "rotate-180",
                            )}
                          />
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="font-medium text-xs">
                      Funções Extras
                    </TooltipContent>
                  )}
                </Tooltip>

                {extrasOpen && !collapsed && (
                  <ul className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                    {telegramExtrasSubItems.map(renderItem)}
                  </ul>
                )}
                {extrasOpen && collapsed && (
                  <ul className="mt-0.5 space-y-0.5">
                    {telegramExtrasSubItems.map(renderItem)}
                  </ul>
                )}
              </li>

              {/* Grupo expansível "Resultados" */}
              <li>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setResultadosOpen((v) => !v)}
                      className={cn(
                        "group w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 sidebar-item border border-transparent",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Trophy
                        className={cn(
                          "shrink-0 transition-colors duration-200",
                          collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
                          resultadosOpen
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-left">Resultados</span>
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                              resultadosOpen && "rotate-180",
                            )}
                          />
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="font-medium text-xs">
                      Resultados
                    </TooltipContent>
                  )}
                </Tooltip>

                {resultadosOpen && !collapsed && (
                  <ul className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                    {telegramResultadosSubItems.map(renderItem)}
                  </ul>
                )}
                {resultadosOpen && collapsed && (
                  <ul className="mt-0.5 space-y-0.5">
                    {telegramResultadosSubItems.map(renderItem)}
                  </ul>
                )}
              </li>

              {/* Grupo expansível "Remarketing" */}
              <li>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setRemarketingOpen((v) => !v)}
                      className={cn(
                        "group w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 sidebar-item border border-transparent",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Repeat
                        className={cn(
                          "shrink-0 transition-colors duration-200",
                          collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
                          remarketingOpen
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-left">Remarketing</span>
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                              remarketingOpen && "rotate-180",
                            )}
                          />
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="font-medium text-xs">
                      Remarketing
                    </TooltipContent>
                  )}
                </Tooltip>

                {remarketingOpen && !collapsed && (
                  <ul className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                    {telegramRemarketingSubItems.map(renderItem)}
                  </ul>
                )}
                {remarketingOpen && collapsed && (
                  <ul className="mt-0.5 space-y-0.5">
                    {telegramRemarketingSubItems.map(renderItem)}
                  </ul>
                )}
              </li>

              {/* Grupo expansível "Integrações" */}
              <li>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIntegracoesOpen((v) => !v)}
                      className={cn(
                        "group w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 sidebar-item border border-transparent",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <PlugZap
                        className={cn(
                          "shrink-0 transition-colors duration-200",
                          collapsed ? "w-5 h-5" : "w-[18px] h-[18px]",
                          integracoesOpen
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1 text-left">Integrações</span>
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                              integracoesOpen && "rotate-180",
                            )}
                          />
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="font-medium text-xs">
                      Integrações
                    </TooltipContent>
                  )}
                </Tooltip>

                {integracoesOpen && !collapsed && (
                  <ul className="mt-0.5 ml-4 pl-3 border-l border-white/10 space-y-0.5">
                    {telegramIntegracoesSubItems.map(renderItem)}
                  </ul>
                )}
                {integracoesOpen && collapsed && (
                  <ul className="mt-0.5 space-y-0.5">
                    {telegramIntegracoesSubItems.map(renderItem)}
                  </ul>
                )}
              </li>

              {/* Restante dos itens do Telegram */}
              {telegramMenuItems.slice(1).map(renderItem)}
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
