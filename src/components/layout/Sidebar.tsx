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
  MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
}

const menuItems = [
  { id: "painel", label: "Painel", icon: LayoutDashboard },
  { id: "dispositivos", label: "Dispositivos", icon: Smartphone },
  { id: "enviar-mensagem", label: "Enviar mensagem", icon: Send },
  { id: "mensagem-boas-vindas", label: "Mensagem de boas-vindas", icon: MessageSquareHeart },
  { id: "resposta-automatica", label: "Resposta automática", icon: MessageSquareText },
  { id: "modelos", label: "Modelos", icon: FileText },
  { id: "contatos", label: "Contatos", icon: Users },
  { id: "cancelar-assinaturas", label: "Cancelar assinaturas", icon: UserX },
  { id: "filtro-numero", label: "Filtro de Número", icon: Filter },
  { id: "apanhador-grupos", label: "Apanhador de Grupos", icon: UserPlus },
  { id: "relatorio", label: "Relatório", icon: BarChart3 },
  { id: "mensagens-recebidas", label: "Mensagens recebidas", icon: MessageSquareReply },
  { id: "contexto", label: "Contexto", icon: MessageCircle },
];

export function Sidebar({ activeItem = "painel", onItemClick }: SidebarProps) {
  return (
    <div className="w-64 bg-card border-r border-border h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">WhatsApp SaaS</h1>
            <p className="text-xs text-muted-foreground">v5.0.6</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {menuItems.map((item) => {
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