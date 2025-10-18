import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VolumeChart } from "@/components/dashboard/VolumeChart";

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <TopMetrics />
      <StatsGrid />
      <VolumeChart />
    </div>
  );
};

export default Dashboard;
