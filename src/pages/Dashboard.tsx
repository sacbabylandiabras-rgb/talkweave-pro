import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { Chart3D } from "@/components/dashboard/Chart3D";

const Dashboard = () => {
  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-foreground">Painel</h1>
      <TopMetrics />
      <StatsGrid />
      <VolumeChart />
      <Chart3D />
    </div>
  );
};

export default Dashboard;
