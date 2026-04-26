import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VolumeChart } from "@/components/dashboard/VolumeChart";

const Dashboard = () => {
  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-bebas text-[26px] text-white tracking-[2px] leading-none">PAINEL</h1>
          <p className="font-nunito text-[12px] text-white/40 mt-1">Visão geral das suas métricas e campanhas</p>
        </div>
        <span className="plan-badge">ZapLynx Pro</span>
      </div>
      <TopMetrics />
      <StatsGrid />
      <VolumeChart />
    </div>
  );
};

export default Dashboard;
