import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, MessageSquare, Users, Activity, CheckCircle2, PauseCircle, ArrowRight, Plus, Clock, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function TelegramDashboard() {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, today: 0, uniqueChats: 0 });
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

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

  async function load() {
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
        .limit(500),
    ]);

    const botList = (botsData ?? []) as BotRow[];
    const msgList = (msgsData ?? []) as MsgRow[];
    setBots(botList);
    setMessages(msgList.slice(0, 8));

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = msgList.filter((m) => new Date(m.created_at) >= startOfDay).length;
    const uniqueChats = new Set(msgList.map((m) => m.chat_id)).size;

    setCounts({ total: msgList.length, today: todayCount, uniqueChats });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const activeCount = bots.filter((b) => b.active).length;

  const stats = [
    {
      label: "Bots conectados",
      value: bots.length,
      sub: `${activeCount} ativo${activeCount === 1 ? "" : "s"}`,
      icon: Bot,
      color: "text-[#60a5fa]",
      bg: "bg-[rgba(96,165,250,0.15)]",
      border: "border-[rgba(96,165,250,0.3)]",
    },
    {
      label: "Mensagens hoje",
      value: counts.today,
      sub: `${counts.total} nos últimos registros`,
      icon: MessageSquare,
      color: "text-emerald-300",
      bg: "bg-emerald-500/15",
      border: "border-emerald-500/30",
    },
    {
      label: "Conversas únicas",
      value: counts.uniqueChats,
      sub: "chats distintos",
      icon: Users,
      color: "text-purple-300",
      bg: "bg-purple-500/15",
      border: "border-purple-500/30",
    },
    {
      label: "Status do polling",
      value: activeCount > 0 ? "ON" : "OFF",
      sub: activeCount > 0 ? "polling a cada 1 min" : "nenhum bot ativo",
      icon: Activity,
      color: activeCount > 0 ? "text-emerald-300" : "text-white/40",
      bg: activeCount > 0 ? "bg-emerald-500/15" : "bg-white/5",
      border: activeCount > 0 ? "border-emerald-500/30" : "border-white/10",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[rgba(96,165,250,0.18)] border border-[rgba(96,165,250,0.30)] flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#60a5fa]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Dashboard Telegram</h1>
            <p className="text-sm text-white/60">Visão geral dos seus bots e mensagens recebidas.</p>
          </div>
        </div>
        <Link to="/telegram/criar-bot">
          <Button>
            <Plus className="w-4 h-4 mr-1" /> Novo Bot
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
              <div className="text-2xl font-semibold text-white">{loading ? "—" : s.value}</div>
              <div className="text-xs text-white/60 mt-1">{s.label}</div>
              <div className="text-[11px] text-white/40 mt-2">{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bots list */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Seus bots</h2>
            <Link to="/telegram/criar-bot" className="text-xs text-[#60a5fa] hover:underline inline-flex items-center gap-1">
              Gerenciar <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <p className="text-white/50 text-sm">Carregando...</p>
          ) : bots.length === 0 ? (
            <div className="text-center py-10">
              <Bot className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/60 text-sm mb-4">Você ainda não conectou nenhum bot.</p>
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
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[rgba(96,165,250,0.2)] flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-[#60a5fa]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate">
                          {b.first_name || "(sem nome)"}
                        </span>
                        {b.active ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> ativo
                          </span>
                        ) : (
                          <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <PauseCircle className="w-3 h-3" /> pausado
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/50 flex items-center gap-2">
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
                      className="text-red-300 hover:text-red-200 hover:bg-red-500/10"
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

        {/* Recent messages */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Mensagens recentes</h2>
          {loading ? (
            <p className="text-white/50 text-sm">Carregando...</p>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-9 h-9 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-xs">
                Nenhuma mensagem recebida ainda. O polling roda a cada minuto.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => (
                <div key={m.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white font-medium truncate">
                      {m.from_first_name || m.from_username || `chat ${m.chat_id}`}
                    </span>
                    <span className="text-[10px] text-white/40 shrink-0 ml-2">
                      {formatRelative(m.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-white/70 line-clamp-2">
                    {m.text || <span className="italic text-white/40">(sem texto)</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}