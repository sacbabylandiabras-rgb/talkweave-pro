 import { MessageCircle, ArrowRightLeft, Users, TrendingUp, Heart, Eye, Instagram, Share2, PlayCircle, Star, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useInstagramEvents } from "@/hooks/useInstagramEvents";
import { useInstagramContacts } from "@/hooks/useInstagramContacts";
import { useInstagramAutomations } from "@/hooks/useInstagramAutomations";
import { useMemo } from "react";
import { format, subDays, startOfDay } from "date-fns";

export default function DashboardInstagram() {
  const { events } = useInstagramEvents();
  const { contacts } = useInstagramContacts();
  const { automations } = useInstagramAutomations();

  const commentEvents = useMemo(() => events.filter(e => e.event_type === "comment"), [events]);
  const dmEvents = useMemo(() => events.filter(e => e.event_type === "dm_sent"), [events]);
  const activeFlows = automations.filter(a => a.active).length;

  const conversionRate = commentEvents.length > 0
    ? ((dmEvents.length / commentEvents.length) * 100).toFixed(1)
    : "0";

   const storyEvents = useMemo(() => events.filter(e => e.event_type === "story_reply"), [events]);
   const shareEvents = useMemo(() => events.filter(e => e.event_type === "share"), [events]);
 
   const metrics = [
     { label: "Comentários", value: String(commentEvents.length), icon: MessageCircle, color: "text-pink-400" },
     { label: "Story Replies", value: String(storyEvents.length), icon: Share2, color: "text-orange-400" },
     { label: "Contatos", value: String(contacts.length), icon: Users, color: "text-blue-400" },
     { label: "Conversão", value: `${conversionRate}%`, icon: ArrowRightLeft, color: "text-emerald-400" },
     { label: "DMs Enviados", value: String(dmEvents.length), icon: Heart, color: "text-red-400" },
     { label: "Compartilhados", value: String(shareEvents.length), icon: Zap, color: "text-purple-400" },
   ];

  const chartData = useMemo(() => {
    const days: { date: string; comments: number; dms: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const dayStr = format(day, "yyyy-MM-dd");
      const label = format(day, "dd/MM");
      days.push({
        date: label,
        comments: commentEvents.filter(e => format(new Date(e.created_at), "yyyy-MM-dd") === dayStr).length,
        dms: dmEvents.filter(e => format(new Date(e.created_at), "yyyy-MM-dd") === dayStr).length,
      });
    }
    return days;
  }, [commentEvents, dmEvents]);

  const hasChartData = chartData.some(d => d.comments > 0 || d.dms > 0);

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
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="comments" name="Comentários" stroke="#ec4899" fill="#ec489933" />
                  <Area type="monotone" dataKey="dms" name="DMs" stroke="#3b82f6" fill="#3b82f633" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                <Instagram className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Sem dados ainda</p>
                <p className="text-xs mt-1">Os dados aparecerão quando os fluxos estiverem ativos</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-sm">Últimos Eventos</CardTitle></CardHeader>
          <CardContent>
            {events.length > 0 ? (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {events.slice(0, 10).map(evt => (
                  <div key={evt.id} className="flex items-center justify-between text-xs border-b border-border pb-2">
                    <div className="flex items-center gap-2">
                      <span className={evt.event_type === "comment" ? "text-pink-400" : "text-blue-400"}>
                        {evt.event_type === "comment" ? "💬" : "✉️"}
                      </span>
                      <span className="font-medium">@{evt.username}</span>
                      <span className="text-muted-foreground truncate max-w-[200px]">{evt.comment_text}</span>
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(evt.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                <Instagram className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Sem dados ainda</p>
                <p className="text-xs mt-1">Crie um fluxo de automação para começar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
