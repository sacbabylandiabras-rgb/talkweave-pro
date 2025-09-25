import { MetricCard } from "./MetricCard";
import { 
  Smartphone, 
  MessageSquareText, 
  MessageSquareHeart, 
  FileText, 
  BarChart3 
} from "lucide-react";

export function TopMetrics() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      <MetricCard
        title="Dispositivos"
        value="3"
        subtitle="Instâncias"
        icon={Smartphone}
        variant="success"
      />
      <MetricCard
        title="Resposta automática"
        value="0"
        subtitle=""
        icon={MessageSquareText}
        variant="default"
      />
      <MetricCard
        title="Mensagem de boas-vindas"
        value="0"
        subtitle=""
        icon={MessageSquareHeart}
        variant="default"
      />
      <MetricCard
        title="Modelos"
        value="2"
        subtitle=""
        icon={FileText}
        variant="info"
      />
      <MetricCard
        title="Total de campanhas"
        value="30"
        subtitle=""
        icon={BarChart3}
        variant="warning"
      />
    </div>
  );
}