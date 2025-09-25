import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";

const Index = () => {
  const [activeItem, setActiveItem] = useState("painel");

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Sidebar */}
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header />
        
        {/* Dashboard Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Top Metrics */}
          <TopMetrics />
          
          {/* Detailed Stats */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Estatísticas Detalhadas
            </h2>
            <StatsGrid />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
