import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  MessageSquare,
  Users,
  Activity,
  CheckCircle2,
  PauseCircle,
  ArrowRight,
  Plus,
  Clock,
  Unplug,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BotRow {
  id: string;
  username: string | null;
  first_name: string | null;
  active: boolean;
  last_validated_at: string | null;
  created_at: string;
}

interface MsgRow {
  id: string;
  bot_id: string;
  chat_id: number;
  from_username: string | null;
  from_first_name: string | null;
  text: string | null;
  created_at: string;
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  return `há ${days}d`;
}

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function TelegramDashboard() {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [recentMessages, setRecentMessages] = useState<MsgRow[]>([]);
  const [allMessages, setAllMessages] = useState<MsgRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, today: 0, uniqueChats: 0 });
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = supabase as any;

    const [{ data: botsData }, { data: msgsData }] = await Promise.all([
      sb
        .from("telegram_bots")
        .select("id, username, first_name, active, last_validated_at, created_at")
        .order("created_at", { ascending: false }),
      sb
        .from("telegram_messages")
        .select("id, bot_id, chat_id, from_username, from_first_name, text, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    const botList = (botsData ?? []) as BotRow[];
    const msgList = (msgsData ?? []) as MsgRow[];
    setBots(botList);
    setAllMessages(msgList);
    setRecentMessages(msgList.slice(0, 8));

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = msgList.filter((m) => new Date(m.created_at) >= startOfDay).length;
    const uniqueChats = new Set(msgList.map((m) => m.chat_id)).size;

    setCounts({ total: msgList.length, today: todayCount, uniqueChats });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function disconnect(bot: BotRow) {
    if (!confirm(`Desconectar o bot @${bot.username}?\n\nEle será removido junto com mensagens e estado de polling.`)) return;
    setDisconnecting(bot.id);
    const { error } = await (supabase as any).from("telegram_bots").delete().eq("id", bot.id);
    setDisconnecting(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Bot desconectado");
      load();
    }
  }

  const activeCount = bots.filter((b) => b.active).length;

  // Build chart data: messages per day for the last 14 days
  const chartData = useMemo(() => {
    const days = 14;
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      buckets[toLocalDateStr(d)] = 0;
    }
    for (const m of allMessages) {
      const key = toLocalDateStr(new Date(m.created_at));
      if (key in buckets) buckets[key]++;
    }
    return Object.keys(buckets).map((key) => {
      const [y, mo, da] = key.split("-").map(Number);
      const localDate = new Date(y, mo - 1, da);
      return {
        date: format(localDate, "dd/MM", { locale: ptBR }),
        mensagens: buckets[key],
      };
    });
  }, [allMessages]);

  const formatYAxis = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString());

  return (
    <div className="space-y-6 w-full">
      {/* Header (estilo do Dashboard principal) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-bebas text-[26px] text-white tracking-[2px] leading-none">
            PAINEL TELEGRAM
          </h1>
          <p className="font-nunito text-[12px] text-white/40 mt-1">
            Visão geral dos seus bots e mensagens recebidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="plan-badge">Telegram Bots</span>
          <Link to="/telegram/criar-bot">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Novo Bot
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Bots conectados"
              value={bots.length}
              subtitle={`${activeCount} ativo${activeCount === 1 ? "" : "s"}`}
              icon={Bot}
              variant="info"
            />
            <MetricCard
              title="Mensagens hoje"
              value={counts.today}
              subtitle={`${counts.total} no histórico`}
              icon={MessageSquare}
              variant="success"
            />
            <MetricCard
              title="Conversas únicas"
              value={counts.uniqueChats}
              subtitle="chats distintos"
              icon={Users}
              variant="warning"
            />
            <MetricCard
              title="Status do polling"
              value={activeCount > 0 ? "ON" : "OFF"}
              subtitle={activeCount > 0 ? "polling a cada 1 min" : "nenhum bot ativo"}
              icon={Activity}
              variant={activeCount > 0 ? "success" : "default"}
            />
          </div>

          {/* Volume chart */}
          <div className="glass-chart p-5 transition-all duration-300">
            <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[rgba(167,139,250,0.16)]">
                  <TrendingUp className="w-4 h-4 text-[#a78bfa]" />
                </div>
                <div>
                  <span className="font-bebas text-[18px] text-white tracking-wider">
                    VOLUME DE MENSAGENS
                  </span>
                  <p className="font-nunito text-[11px] text-white/30">Últimos 14 dias</p>
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTelegram" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)", fontFamily: "Nunito" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.30)", fontFamily: "Nunito" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(26,16,64,0.92)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: "10px",
                    fontSize: "12px",
                    color: "#ffffff",
                    backdropFilter: "blur(14px)",
                    padding: "10px 14px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: "#ffffff" }}
                />
                <Area
                  type="monotone"
                  dataKey="mensagens"
                  stroke="#60a5fa"
                  strokeWidth={2.5}
                  fill="url(#gTelegram)"
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: "#1a1040" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bots + Recent messages */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card rounded-2xl p-6 lg:col-span-2 bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Seus bots</h2>
                <Link
                  to="/telegram/criar-bot"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Gerenciar <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {bots.length === 0 ? (
                <div className="text-center py-10">
                  <Bot className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm mb-4">Você ainda não conectou nenhum bot.</p>
                  <Link to="/telegram/criar-bot">
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" /> Conectar primeiro bot
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {bots.slice(0, 6).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground text-sm font-medium truncate">
                              {b.first_name || "(sem nome)"}
                            </span>
                            {b.active ? (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> ativo
                              </span>
                            ) : (
                              <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <PauseCircle className="w-3 h-3" /> pausado
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span>@{b.username}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatRelative(b.last_validated_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link to={`/telegram/atualizar-bot?bot=${b.id}`}>
                          <Button size="sm" variant="ghost">
                            Editar
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => disconnect(b)}
                          disabled={disconnecting === b.id}
                          title="Desconectar bot"
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Unplug className="w-4 h-4 mr-1" />
                          {disconnecting === b.id ? "..." : "Desconectar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card rounded-2xl p-6 bg-card border border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4">Mensagens recentes</h2>
              {recentMessages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-9 h-9 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground text-xs">
                    Nenhuma mensagem recebida ainda. O polling roda a cada minuto.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentMessages.map((m) => (
                    <div key={m.id} className="p-3 rounded-lg bg-muted/40 border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-foreground font-medium truncate">
                          {m.from_first_name || m.from_username || `chat ${m.chat_id}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {formatRelative(m.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {m.text || <span className="italic text-white/40">(sem texto)</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}