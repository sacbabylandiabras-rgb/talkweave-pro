import { 
  LayoutDashboard, 
  Smartphone, 
  Send, 
  MessageSquareHeart, 
  MessageSquareText, 
  FileText, 
  Users, 
  UserX, 
  Filter, 
  UserPlus, 
  BarChart3, 
  MessageSquareReply,
  MessageCircle,
  Settings,
  UserCircle,
  Megaphone,
  ShieldCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LogoImage } from "./LogoImage";
import { useUserRole } from "@/hooks/useUserRole";

interface SidebarProps {
  activeItem?: string;
  userId?: string;
}

const menuItems = [
  { id: "painel", label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
  { id: "dispositivos", label: "Dispositivos", icon: Smartphone, path: "/dispositivos" },
  { id: "perfil", label: "Perfil", icon: UserCircle, path: "/perfil" },
  { id: "enviar-mensagem", label: "Enviar mensagem", icon: Send, path: "/enviar-mensagem" },
  { id: "modelos", label: "Modelos", icon: FileText, path: "/modelos" },
  { id: "campanhas", label: "Campanhas", icon: Megaphone, path: "/campanhas" },
  { id: "contatos", label: "Contatos", icon: Users, path: "/contatos" },
  { id: "relatorio", label: "Relatório", icon: BarChart3, path: "/relatorio" },
  { id: "admin", label: "Administração", icon: ShieldCheck, path: "/admin" },
  { id: "configuracao-zapi", label: "Config Z-API", icon: Settings, path: "/configuracao-zapi" },
];

export function Sidebar({ activeItem = "painel", userId }: SidebarProps) {
  const { isAdmin, loading } = useUserRole(userId);

  return (
    <div className="w-64 bg-card/95 backdrop-blur-sm border-r border-border h-screen flex flex-col shadow-lg">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <LogoImage className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-bold text-lg text-foreground">ZapLynx</h1>
            <p className="text-xs text-muted-foreground">v5.0.6</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {menuItems.map((item) => {
            // Ocultar item de admin para não-admins
            if (item.id === "admin" && !loading && !isAdmin) {
              return null;
            }

            const Icon = item.icon;
            const isActive = activeItem === item.id;
            
            return (
              <li key={item.id}>
                <Link
                  to={item.path}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    "hover:bg-muted/50",
                    isActive
                      ? "bg-primary/10 text-primary border-l-4 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          © 2025 ZapLynx
        </p>
      </div>
    </div>
  );
}