import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VolumeChart } from "@/components/dashboard/VolumeChart";

const Dashboard = () => {
  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Painel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão geral das suas métricas e campanhas</p>
      </div>
      <TopMetrics />
      <StatsGrid />
      <VolumeChart />
    </div>
  );
};

export default Dashboard;
