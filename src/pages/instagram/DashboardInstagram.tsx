import { MessageCircle, ArrowRightLeft, Users, TrendingUp, Heart, Eye, Instagram } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardInstagram() {
  // Real data will come from Instagram webhook events stored in the database
  const metrics = [
    { label: "Comentários Detectados", value: "0", icon: MessageCircle, color: "text-pink-400" },
    { label: "Conversão → DM", value: "0%", icon: ArrowRightLeft, color: "text-emerald-400" },
    { label: "Ativos no Funil", value: "0", icon: Users, color: "text-blue-400" },
    { label: "Engajamento", value: "0%", icon: Heart, color: "text-red-400" },
    { label: "Alcance Semanal", value: "0", icon: Eye, color: "text-purple-400" },
    { label: "Crescimento", value: "0%", icon: TrendingUp, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard Instagram</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Métricas e performance da automação Instagram</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map(m => (
          <Card key={m.label} className="border-border">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase">{m.label}</span>
              </div>
              <p className="text-lg font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm">Comentários vs DMs — 30 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
              <Instagram className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Sem dados ainda</p>
              <p className="text-xs mt-1">Os dados aparecerão quando os fluxos estiverem ativos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm">Top Posts — Conversão</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
              <Instagram className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Sem dados ainda</p>
              <p className="text-xs mt-1">Crie um fluxo de automação para começar</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
