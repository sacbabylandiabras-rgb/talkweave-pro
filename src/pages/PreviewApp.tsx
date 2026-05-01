import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { LogOut, TrendingUp, Wifi, BatteryFull, Signal, LayoutDashboard, Send, CreditCard } from "lucide-react";

/**
 * Preview do app mobile (ZapLynx). Layout 100% espelhando o app Expo real:
 * header ZAP LYNX/PRO, cards com barra colorida, CPA destacado, contadores
 * coloridos e gráfico de Volume de Mensagens (todos dados reais).
 */

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

type Tab = "painel" | "telegram" | "pagamentos";

export default function PreviewApp() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("painel");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = async () => {
    setAuthErr(null);
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setAuthErr(error.message);
    setAuthLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6">
      <div className="text-center text-white/90">
        <h1 className="text-2xl font-bold">Preview do App Mobile</h1>
        <p className="text-xs text-white/60">Réplica fiel do app iOS/Android · dados reais do Supabase</p>
      </div>

      <PhoneFrame>
        {!session ? (
          <Login email={email} pw={pw} setEmail={setEmail} setPw={setPw} login={login} err={authErr} loading={authLoading} />
        ) : (
          <AppShell tab={tab} setTab={setTab} session={session} />
        )}
      </PhoneFrame>

      {session && (
        <button onClick={() => supabase.auth.signOut()} className="text-xs text-white/60 hover:text-white underline">
          Sair do preview
        </button>
      )}
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 390, height: 800, borderRadius: 52, background: "#000", padding: 10, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", background: "#0a0612", position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

function StatusBar() {
  const now = new Date();
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1 text-white text-[13px] font-semibold">
      <span>{`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`}</span>
      <div className="flex items-center gap-1.5">
        <Signal className="w-3.5 h-3.5" />
        <Wifi className="w-3.5 h-3.5" />
        <BatteryFull className="w-4 h-4" />
      </div>
    </div>
  );
}

function Login({ email, pw, setEmail, setPw, login, err, loading }: any) {
  return (
    <div className="h-full w-full flex flex-col text-white" style={{ background: "radial-gradient(circle at top, #2a1245 0%, #0a0612 60%)" }}>
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center font-black text-2xl"
          style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }}>
          Z
        </div>
        <h2 className="text-xl font-bold mb-1">ZAP LYNX</h2>
        <p className="text-xs text-white/50 mb-8">Use o login do painel</p>
        <input className="w-full mb-3 rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-sm outline-none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full mb-4 rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-sm outline-none" placeholder="Senha" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-xs text-red-400 mb-3">{err}</p>}
        <button onClick={login} disabled={loading}
          className="w-full rounded-xl py-3 font-semibold text-sm disabled:opacity-50 text-white"
          style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

function AppShell({ tab, setTab, session }: { tab: Tab; setTab: (t: Tab) => void; session: any }) {
  const titles = { painel: "Painel", telegram: "Telegram", pagamentos: "Pagamentos" };
  const subtitles = {
    painel: "Visão geral das suas métricas",
    telegram: "Bots e vendas",
    pagamentos: "Saldo e movimentações",
  };
  return (
    <div className="h-full w-full flex flex-col text-white" style={{ background: "radial-gradient(circle at top, #2a1245 0%, #0a0612 50%)" }}>
      <StatusBar />
      {/* Header brand */}
      <div className="px-5 pt-2 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }}>
            <span className="text-[11px] font-black">Z</span>
          </div>
          <span className="text-[11px] tracking-[0.25em] text-white/80 font-semibold">ZAP LYNX</span>
          <span className="w-1 h-1 rounded-full bg-emerald-400" />
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-white/60 hover:text-white">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      {/* Page title */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">{titles[tab]}</h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white" style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }}>PRO</span>
        </div>
        <p className="text-xs text-white/50">{subtitles[tab]}</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {tab === "painel" && <Painel />}
        {tab === "telegram" && <Telegram />}
        {tab === "pagamentos" && <Pagamentos />}
      </div>

      {/* Bottom tab bar */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/60 backdrop-blur grid grid-cols-3">
        {([
          { k: "painel", label: "Painel", Icon: LayoutDashboard },
          { k: "telegram", label: "Telegram", Icon: Send },
          { k: "pagamentos", label: "Pagamentos", Icon: CreditCard },
        ] as const).map(({ k, label, Icon }) => {
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} className="py-2.5 flex flex-col items-center gap-0.5">
              <Icon className={`w-5 h-5 ${active ? "text-purple-400" : "text-white/40"}`} />
              <span className={`text-[10px] ${active ? "text-purple-400 font-semibold" : "text-white/40"}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ PAINEL ============================ */
function Painel() {
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const since30 = new Date(Date.now() - 30 * 86400000);

      const [c, t, total, sent, delivered, failed, phones, txs, sendsByDay] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
        supabase.from("message_templates").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }).in("status", ["sent", "delivered"]),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }).eq("status", "delivered"),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("campaign_sends").select("phone").limit(1000),
        supabase.from("gateway_transactions").select("amount,status").limit(1000),
        supabase.from("campaign_sends").select("status,created_at").gte("created_at", since30.toISOString()).limit(5000),
      ]);

      const pixGerado = (txs.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const aprov = (txs.data || []).filter((r: any) => ["approved", "paid", "completed"].includes(r.status));
      const vendaAprovada = aprov.reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const totalSends = total.count || 0;
      const cpa = aprov.length > 0 ? totalSends / aprov.length : 0;

      // Build chart series — last 30 days
      const buckets: Record<string, { day: string; enviadas: number; entregues: number; erros: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const dt = new Date(Date.now() - i * 86400000);
        const k = dayKey(dt.toISOString());
        buckets[k] = { day: k, enviadas: 0, entregues: 0, erros: 0 };
      }
      (sendsByDay.data || []).forEach((r: any) => {
        const k = dayKey(r.created_at);
        if (!buckets[k]) return;
        if (r.status === "sent" || r.status === "delivered") buckets[k].enviadas++;
        if (r.status === "delivered") buckets[k].entregues++;
        if (r.status === "failed") buckets[k].erros++;
      });
      const chart = Object.values(buckets);

      setD({
        campaigns: c.count || 0,
        templates: t.count || 0,
        contacts: new Set((phones.data || []).map((p: any) => p.phone)).size,
        total: totalSends,
        sent: sent.count || 0,
        delivered: delivered.count || 0,
        failed: failed.count || 0,
        pixGerado,
        vendaAprovada,
        cpa,
        chart,
      });
    })();
  }, []);

  if (!d) return <Loading />;

  return (
    <div className="px-4 space-y-3">
      {/* Top 3 cards: Campanhas / Modelos / Contatos */}
      <div className="grid grid-cols-3 gap-2">
        <BarCard color="#a855f7" label="CAMPANHAS" value={d.campaigns} sub="Criadas" />
        <BarCard color="#3b82f6" label="MODELOS" value={d.templates} sub="Templates" />
        <BarCard color="#f97316" label="CONTATOS" value={d.contacts} sub="Alcançados" />
      </div>

      {/* Pix gerado / Venda aprovada */}
      <div className="grid grid-cols-2 gap-2">
        <MoneyCard color="#10b981" label="PIX GERADO" value={fmtBRL(d.pixGerado)} sub="neste período" />
        <MoneyCard color="#22c55e" label="VENDA APROVADA" value={fmtBRL(d.vendaAprovada)} sub="neste período" />
      </div>

      {/* CPA card big */}
      <div className="rounded-2xl p-4 border border-white/5" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] tracking-wider text-white/50 font-semibold">CPA — CUSTO POR AQUISIÇÃO</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{d.cpa.toFixed(4)}</p>
            <p className="text-[10px] text-white/40 -mt-0.5">venda / msg</p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(59, 130, 246, 0.15)" }}>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Counters: Total / Enviadas / Entregues / Falhas */}
      <div className="grid grid-cols-4 gap-2">
        <Counter color="#3b82f6" value={d.total} label="TOTAL" />
        <Counter color="#10b981" value={d.sent} label="ENVIADAS" />
        <Counter color="#22c55e" value={d.delivered} label="ENTREGUES" />
        <Counter color="#ef4444" value={d.failed} label="FALHAS" />
      </div>

      {/* Chart */}
      <div className="rounded-2xl p-3 border border-white/5" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[10px] tracking-wider text-white/60 font-semibold">VOLUME DE MENSAGENS</p>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="px-2 py-0.5 rounded-md bg-white/5 text-white/40">7d</span>
            <span className="px-2 py-0.5 rounded-md text-white" style={{ background: "rgba(168, 85, 247, 0.3)" }}>30d</span>
            <span className="px-2 py-0.5 rounded-md bg-white/5 text-white/40">90d</span>
          </div>
        </div>
        <div style={{ width: "100%", height: 140 }}>
          <ResponsiveContainer>
            <LineChart data={d.chart} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }} interval={6} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: "#1a0f2e", border: "1px solid rgba(168, 85, 247, 0.3)", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="enviadas" stroke="#a855f7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="entregues" stroke="#22c55e" strokeWidth={2} strokeDasharray="3 3" dot={false} />
              <Line type="monotone" dataKey="erros" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-3 text-[10px] pt-1">
          <Legend color="#a855f7" label="Enviadas" />
          <Legend color="#22c55e" label="Entregues" />
          <Legend color="#ef4444" label="Erros" />
        </div>
      </div>
    </div>
  );
}

/* ========================== PAGAMENTOS ========================== */
function Pagamentos() {
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [txRes, wdRes] = await Promise.all([
        supabase.from("gateway_transactions")
          .select("id,amount,fee,net,status,customer_name,created_at")
          .order("created_at", { ascending: false }).limit(500),
        supabase.from("gateway_withdrawals")
          .select("id,amount,status,created_at")
          .order("created_at", { ascending: false }).limit(100),
      ]);
      const txs = txRes.data || [];
      const wds = wdRes.data || [];
      const isApp = (s: string) => ["approved", "paid", "completed"].includes(s);
      const txs30 = txs.filter((t: any) => t.created_at >= since);
      const aprov30 = txs30.filter((t: any) => isApp(t.status));
      const volume = aprov30.reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const taxa = txs30.length ? (aprov30.length / txs30.length) * 100 : 0;
      const ticket = aprov30.length ? volume / aprov30.length : 0;
      const liquido = txs.filter((t: any) => isApp(t.status))
        .reduce((s: number, t: any) => s + (t.net || (t.amount - (t.fee || 0))), 0);
      const sacado = wds.filter((w: any) => isApp(w.status)).reduce((s: number, w: any) => s + (w.amount || 0), 0);
      const pend = wds.filter((w: any) => w.status === "pending").reduce((s: number, w: any) => s + (w.amount || 0), 0);
      const saldo = Math.max(0, liquido - sacado - pend);
      const extrato = [
        ...wds.map((w: any) => ({ id: "w" + w.id, type: "out", name: "Saque PIX", date: w.created_at, amount: w.amount, status: w.status })),
        ...txs.map((t: any) => ({ id: "t" + t.id, type: "in", name: t.customer_name || "Cliente", date: t.created_at, amount: t.amount, status: t.status })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
      setD({ saldo, vendas: aprov30.length, volume, taxa, ticket, extrato });
    })();
  }, []);

  if (!d) return <Loading />;

  return (
    <div className="px-4 space-y-3">
      {/* Saldo card */}
      <div className="rounded-2xl p-5 border" style={{ background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.1))", borderColor: "rgba(34, 197, 94, 0.3)" }}>
        <p className="text-[10px] tracking-wider text-white/60 font-semibold">SALDO DISPONÍVEL</p>
        <p className="text-3xl font-bold text-emerald-300 mt-1">R$ {fmtBRL(d.saldo)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BarCard color="#3b82f6" label="VENDAS" value={d.vendas} sub="últimos 30 dias" />
        <BarCard color="#22c55e" label="VOLUME" value={`R$ ${fmtBRL(d.volume)}`} sub="aprovado" />
        <BarCard color="#f97316" label="APROVAÇÃO" value={`${d.taxa.toFixed(1)}%`} sub="taxa" />
        <BarCard color="#a855f7" label="TICKET MÉDIO" value={`R$ ${fmtBRL(d.ticket)}`} sub="por venda" />
      </div>

      <p className="text-[10px] tracking-wider text-white/50 font-semibold pt-2">EXTRATO</p>
      <div className="space-y-1.5">
        {d.extrato.length === 0 && <p className="text-xs text-white/40 text-center py-6">Sem movimentações</p>}
        {d.extrato.map((e: any) => (
          <div key={e.id} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${e.type === "in" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                {e.type === "in" ? "↓" : "↑"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{e.name}</p>
                <p className="text-[10px] text-white/40">{fmtDate(e.date)}</p>
              </div>
            </div>
            <p className={`text-xs font-semibold ${e.type === "in" ? "text-emerald-300" : "text-red-300"}`}>
              {e.type === "in" ? "+" : "-"}R$ {fmtBRL(e.amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ TELEGRAM ============================ */
function Telegram() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0);
      const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
      let bots = 0, msgsHoje = 0, conversas = 0;
      try {
        const r = await (supabase as any).from("telegram_bots").select("id", { count: "exact", head: true });
        bots = r.count || 0;
      } catch {}
      try {
        const r = await (supabase as any).from("telegram_messages")
          .select("chat_id", { count: "exact" })
          .gte("created_at", startToday.toISOString());
        msgsHoje = r.count || 0;
        conversas = new Set((r.data || []).map((x: any) => x.chat_id)).size;
      } catch {}
      const txs = await supabase.from("gateway_transactions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startMonth.toISOString())
        .in("status", ["approved", "paid", "completed"]);
      setD({ bots, msgsHoje, conversas, vendasMes: txs.count || 0 });
    })();
  }, []);
  if (!d) return <Loading />;
  return (
    <div className="px-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <BarCard color="#3b82f6" label="BOTS" value={d.bots} sub="ativos" />
        <BarCard color="#a855f7" label="MENSAGENS" value={d.msgsHoje} sub="hoje" />
        <BarCard color="#f97316" label="CONVERSAS" value={d.conversas} sub="hoje" />
        <BarCard color="#22c55e" label="VENDAS APROVADAS" value={d.vendasMes} sub="mês" />
      </div>
      {d.bots === 0 && (
        <p className="text-[11px] text-white/40 text-center pt-4">Nenhum bot configurado ainda.</p>
      )}
    </div>
  );
}

/* ============================ UI bits ============================ */
function BarCard({ color, label, value, sub }: { color: string; label: string; value: any; sub?: string }) {
  return (
    <div className="relative rounded-2xl p-3 border border-white/5 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: color }} />
      <p className="text-[9px] tracking-wider text-white/50 font-semibold">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[9px] text-white/40 -mt-0.5">{sub}</p>}
    </div>
  );
}

function MoneyCard({ color, label, value, sub }: { color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="relative rounded-2xl p-3 border border-white/5 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <p className="text-[9px] tracking-wider text-white/50 font-semibold">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>R$ {value.split(",")[0]}<span className="text-sm">,{value.split(",")[1] || "00"}</span></p>
      {sub && <p className="text-[9px] text-white/40">{sub}</p>}
    </div>
  );
}

function Counter({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <div className="rounded-xl p-2 border text-center" style={{ background: `${color}14`, borderColor: `${color}30` }}>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[9px] tracking-wider text-white/50 font-semibold">{label}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-white/50">{label}</span>
    </div>
  );
}

function Loading() {
  return <div className="p-8 text-center text-xs text-white/40">Carregando…</div>;
}