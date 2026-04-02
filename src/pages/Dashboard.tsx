import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { MessageCircle, ArrowRightLeft, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const instagramMetrics = [
  { label: "Comentários Detectados", value: "1.284", icon: MessageCircle, color: "text-pink-400" },
  { label: "Conversão → DM", value: "68%", icon: ArrowRightLeft, color: "text-[#00ff88]" },
  { label: "Ativos no Funil", value: "47", icon: Users, color: "text-blue-400" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Painel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão geral das suas métricas e campanhas</p>
      </div>
      <TopMetrics />
      <StatsGrid />

      {/* Instagram Metrics */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Instagram</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {instagramMetrics.map(m => (
            <Card key={m.label} className="border-border">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase">{m.label}</span>
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                </div>
                <p className="text-xl font-bold">{m.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <VolumeChart />
    </div>
  );
};

export default Dashboard;
