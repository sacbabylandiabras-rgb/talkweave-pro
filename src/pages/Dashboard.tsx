import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VolumeChart } from "@/components/dashboard/VolumeChart";

const Dashboard = () => {
  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-foreground">Painel</h1>
      <TopMetrics />
      <StatsGrid />
      <VolumeChart />
    </div>
  );
};

export default Dashboard;
