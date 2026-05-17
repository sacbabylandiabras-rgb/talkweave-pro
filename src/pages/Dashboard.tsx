import { useState } from "react";
import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { RevenueMetrics } from "@/components/dashboard/RevenueMetrics";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const handleSelectFrom = (selected?: Date) => {
    setDateFrom(selected);
    if (!selected) { setDateTo(undefined); return; }
    if (!dateTo || selected > dateTo) setDateTo(selected);
  };

  const handleSelectTo = (selected?: Date) => {
    setDateTo(selected);
    if (!selected) return;
    if (!dateFrom || selected < dateFrom) setDateFrom(selected);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
            <h1 className="font-bebas text-[26px] text-white tracking-[2px] leading-none [[data-theme='white']_&]:text-[#111827]">Painel</h1>
           <p className="font-nunito text-[12px] text-white/40 mt-1 [[data-theme='white']_&]:text-[#6B7280]">Visão geral das suas métricas e campanhas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-xs h-8 rounded border-border/60", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={handleSelectFrom} disabled={(date) => (dateTo ? date > dateTo : date > new Date())} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-[11px] text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-xs h-8 rounded border-border/60", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateTo} onSelect={handleSelectTo} disabled={(date) => (dateFrom ? date < dateFrom : false) || date > new Date()} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              Limpar
            </Button>
          )}
          <span className="plan-badge">ZapLynx Pro</span>
        </div>
      </div>
      <TopMetrics dateFrom={dateFrom} dateTo={dateTo} />
      <RevenueMetrics dateFrom={dateFrom} dateTo={dateTo} />
      <StatsGrid dateFrom={dateFrom} dateTo={dateTo} />
      <VolumeChart />
    </div>
  );
};

export default Dashboard;
