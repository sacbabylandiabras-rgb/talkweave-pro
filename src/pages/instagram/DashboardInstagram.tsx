import { MessageCircle, ArrowRightLeft, Users, TrendingUp, Heart, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const metrics = [
  { label: "Comentários Detectados", value: "1.284", icon: MessageCircle, color: "text-pink-400" },
  { label: "Conversão → DM", value: "68%", icon: ArrowRightLeft, color: "text-emerald-400" },
  { label: "Ativos no Funil", value: "47", icon: Users, color: "text-blue-400" },
  { label: "Engajamento", value: "12,4%", icon: Heart, color: "text-red-400" },
  { label: "Alcance Semanal", value: "8.932", icon: Eye, color: "text-purple-400" },
  { label: "Crescimento", value: "+3,2%", icon: TrendingUp, color: "text-emerald-400" },
];

const chartData = [
  { date: "01/03", comentarios: 42, dms: 28 },
  { date: "05/03", comentarios: 58, dms: 39 },
  { date: "10/03", comentarios: 71, dms: 52 },
  { date: "15/03", comentarios: 63, dms: 44 },
  { date: "20/03", comentarios: 89, dms: 61 },
  { date: "25/03", comentarios: 95, dms: 68 },
  { date: "30/03", comentarios: 112, dms: 78 },
];

const topPosts = [
  { post: "Promoção Black Friday", comentarios: 342, dms: 231 },
  { post: "Novo Produto Launch", comentarios: 287, dms: 195 },
  { post: "Sorteio Seguidores", comentarios: 256, dms: 174 },
  { post: "Tutorial Dicas", comentarios: 198, dms: 112 },
  { post: "Bastidores da Marca", comentarios: 145, dms: 89 },
];

export default function DashboardInstagram() {
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
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gComments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDMs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Area type="monotone" dataKey="comentarios" stroke="#ec4899" fill="url(#gComments)" strokeWidth={2} name="Comentários" />
                <Area type="monotone" dataKey="dms" stroke="#10b981" fill="url(#gDMs)" strokeWidth={2} name="DMs Enviadas" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm">Top Posts — Conversão</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topPosts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis dataKey="post" type="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={120} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="dms" fill="#ec4899" radius={[0, 4, 4, 0]} name="DMs" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
