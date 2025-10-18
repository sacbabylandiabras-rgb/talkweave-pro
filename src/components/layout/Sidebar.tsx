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
import { cn } from "@/lib/utils";
import { LogoImage } from "./LogoImage";
import { useUserRole } from "@/hooks/useUserRole";

interface SidebarProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
  userId?: string;
}

const menuItems = [
  { id: "painel", label: "Painel", icon: LayoutDashboard },
  { id: "dispositivos", label: "Dispositivos", icon: Smartphone },
  { id: "perfil", label: "Perfil", icon: UserCircle },
  { id: "enviar-mensagem", label: "Enviar mensagem", icon: Send },
  { id: "modelos", label: "Modelos", icon: FileText },
  { id: "campanhas", label: "Campanhas", icon: Megaphone },
  { id: "contatos", label: "Contatos", icon: Users },
  { id: "relatorio", label: "Relatório", icon: BarChart3 },
  { id: "admin", label: "Administração", icon: ShieldCheck },
  { id: "configuracao-zapi", label: "Config Z-API", icon: Settings },
];

export function Sidebar({ activeItem = "painel", onItemClick, userId }: SidebarProps) {
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
                <button
                  onClick={() => onItemClick?.(item.id)}
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
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          © 2025 Feito com amor<br />
          Por WA
        </p>
      </div>
    </div>
  );
}