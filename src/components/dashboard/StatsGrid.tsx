import { MetricCard } from "./MetricCard";
import { 
  MessageSquare, 
  Clock, 
  MessageSquareText, 
  MessageSquareHeart,
  Send,
  Pause,
  AlertCircle,
  PhoneOff,
  X,
  WifiOff,
  Search,
  UserX,
  Ban
} from "lucide-react";

const statsData = [
  {
    title: "Total Mensagens",
    value: "19208",
    subtitle: "",
    icon: MessageSquare,
    variant: "info" as const
  },
  {
    title: "Mensagens pendentes", 
    value: "0",
    subtitle: "",
    icon: Clock,
    variant: "default" as const
  },
  {
    title: "Resposta Automática Mensagens",
    value: "0", 
    subtitle: "",
    icon: MessageSquareText,
    variant: "default" as const
  },
  {
    title: "Mensagem de boas-vindas",
    value: "0",
    subtitle: "",
    icon: MessageSquareHeart,
    variant: "default" as const
  },
  {
    title: "Mensagem Enviada",
    value: "3267",
    subtitle: "",
    icon: Send,
    variant: "success" as const
  },
  {
    title: "Mensagens pausadas", 
    value: "7167",
    subtitle: "",
    icon: Pause,
    variant: "warning" as const
  },
  {
    title: "Erro Ao enviar",
    value: "0",
    subtitle: "",
    icon: AlertCircle,
    variant: "default" as const
  },
  {
    title: "Número inválido",
    value: "11", 
    subtitle: "",
    icon: PhoneOff,
    variant: "error" as const
  },
  {
    title: "Mensagens canceladas",
    value: "0",
    subtitle: "",
    icon: X,
    variant: "default" as const
  },
  {
    title: "Instância desconectada durante o envio",
    value: "8763",
    subtitle: "",
    icon: WifiOff,
    variant: "error" as const
  },
  {
    title: "Instância não encontrada durante o envio", 
    value: "0",
    subtitle: "",
    icon: Search,
    variant: "default" as const
  },
  {
    title: "Não é um número do WhatsApp",
    value: "0",
    subtitle: "",
    icon: UserX,
    variant: "default" as const
  },
  {
    title: "Mensagem não enviada para cancelar inscrição",
    value: "0",
    subtitle: "",
    icon: Ban,
    variant: "default" as const
  }
];

export function StatsGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {statsData.map((stat, index) => (
        <MetricCard
          key={index}
          title={stat.title}
          value={stat.value}
          subtitle={stat.subtitle}
          icon={stat.icon}
          variant={stat.variant}
        />
      ))}
    </div>
  );
}