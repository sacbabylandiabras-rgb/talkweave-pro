import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Preview do app mobile (ZapLynx) — réplica fiel do app Expo (zaplynx-app v2).
 * Todos os dados são reais do Supabase.
 */

const C = {
  bg: "#0a0814",
  card: "rgba(255,255,255,0.05)",
  cardBorder: "rgba(255,255,255,0.08)",
  purple: "#9d7bfa",
  purpleDark: "#6c4af2",
  green: "#34c759",
  blue: "#38bdf8",
  orange: "#fb923c",
  yellow: "#ffcc00",
  red: "#ff453a",
  textMuted: "rgba(255,255,255,0.35)",
  textDim: "rgba(255,255,255,0.2)",
};
const MONO = "'Courier New', ui-monospace, monospace";

type Tab = "painel" | "telegram" | "pagamentos" | "notif";

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

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
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 p-6"
         style={{ background: "radial-gradient(circle at 30% 20%, #1a0f2e 0%, #050309 70%)" }}>
      <div className="text-center text-white/80">
        <h1 className="text-xl font-semibold">Preview do App Mobile</h1>
        <p className="text-[11px] text-white/40">Réplica fiel do app · dados reais</p>
      </div>

      <PhoneFrame>
        {!session ? (
          <Login email={email} pw={pw} setEmail={setEmail} setPw={setPw} login={login} err={authErr} loading={authLoading} />
        ) : (
          <AppShell tab={tab} setTab={setTab} session={session} />
        )}
      </PhoneFrame>

      {session && (
        <button onClick={() => supabase.auth.signOut()} className="text-[11px] text-white/50 hover:text-white underline">
          Sair do preview
        </button>
      )}
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 390, height: 800, borderRadius: 52, background: "#000", padding: 10, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", background: C.bg, position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

/* ===== Logo (mesmo SVG bolt do app) ===== */
function Logo() {
  return (
    <div className="flex items-center" style={{ gap: 8 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7, background: "#1e1a35",
        border: "0.5px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <svg width={14} height={14} viewBox="0 0 38 38">
          <defs>
            <linearGradient id="boltGrad" x1="22" y1="2" x2="14" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f0abfc" />
              <stop offset="50%" stopColor="#d946ef" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <path d="M22 4L10 21h9l-3 13 12-17h-9l3-13z" fill="url(#boltGrad)" />
        </svg>
      </div>
      <div className="flex">
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, letterSpacing: -0.3 }}>ZAP</span>
        <span style={{ color: "#c084fc", fontWeight: 700, fontSize: 16, letterSpacing: -0.3 }}>LYNX</span>
      </div>
    </div>
  );
}

/* ===== Login ===== */
function Login({ email, pw, setEmail, setPw, login, err, loading }: any) {
  return (
    <div className="h-full w-full flex flex-col text-white" style={{ background: C.bg }}>
      <div style={{ position: "absolute", top: -120, left: -100, width: 420, height: 420, borderRadius: 210, background: "rgba(200,80,220,0.15)" }} />
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        <Logo />
        <p className="text-[11px] text-white/40 mt-6 mb-6">Entre com seu login do painel</p>
        <input className="w-full mb-3 rounded-lg px-4 py-3 text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: MONO }}
          placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full mb-4 rounded-lg px-4 py-3 text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: MONO }}
          placeholder="Senha" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-[11px] text-red-400 mb-3 self-start">{err}</p>}
        <button onClick={login} disabled={loading}
          className="w-full rounded-lg py-3 font-semibold text-sm disabled:opacity-50 text-white"
          style={{ background: "linear-gradient(90deg, #9333ea, #c026d3, #db2777)" }}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

/* ===== Shell ===== */
function AppShell({ tab, setTab, session }: { tab: Tab; setTab: (t: Tab) => void; session: any }) {
  const titles = { painel: "Painel", telegram: "Telegram", pagamentos: "Pagamentos", notif: "Notificações" } as const;
  const subs = {
    painel: "Visão geral das suas métricas",
    telegram: "Bots e mensagens recebidas",
    pagamentos: session?.user?.email || "",
    notif: "Resumos às 08h · 12h · 18h · 00h",
  } as const;
  return (
    <div className="h-full w-full flex flex-col text-white relative" style={{ background: C.bg }}>
      <div style={{ position: "absolute", top: -120, left: -100, width: 420, height: 420, borderRadius: 210, background: "rgba(200,80,220,0.15)", pointerEvents: "none" }} />
      {/* NAV */}
      <div className="flex items-center justify-between relative z-10" style={{ padding: "12px 18px 10px" }}>
        <Logo />
        <div className="flex items-center" style={{ gap: 8 }}>
          {tab === "painel" && (
            <div style={{ background: "rgba(124,92,252,0.25)", border: "0.5px solid rgba(124,92,252,0.45)", borderRadius: 4, padding: "2px 8px" }}>
              <span style={{ color: "#b09afa", fontSize: 10, fontWeight: 500, letterSpacing: 0.5 }}>PRO</span>
            </div>
          )}
          {tab === "telegram" && (
            <div style={{ background: "rgba(52,199,89,0.1)", border: "0.5px solid rgba(52,199,89,0.25)", borderRadius: 4, padding: "4px 10px" }}>
              <span style={{ color: C.green, fontSize: 11, fontWeight: 500, letterSpacing: 0.3 }}>POLLING ON</span>
            </div>
          )}
          <button onClick={() => supabase.auth.signOut()}
            style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(255,255,255,0.08)", border: "0.5px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
            ⎋
          </button>
        </div>
      </div>
      {/* HEADER */}
      <div className="relative z-10" style={{ padding: "0 18px 12px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>{titles[tab]}</h1>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 3 }}>{subs[tab]}</p>
      </div>

      <div className="flex-1 overflow-y-auto relative z-10" style={{ padding: "0 14px 80px" }}>
        {tab === "painel" && <Painel />}
        {tab === "telegram" && <Telegram />}
        {tab === "pagamentos" && <Pagamentos email={session?.user?.email} />}
        {tab === "notif" && <Notificacoes />}
      </div>

      {/* TAB BAR */}
      <div className="absolute bottom-0 left-0 right-0 grid grid-cols-4 z-20"
        style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", background: "rgba(10,8,20,0.85)", backdropFilter: "blur(12px)" }}>
        {([
          { k: "painel", label: "Painel", icon: "▦" },
          { k: "telegram", label: "Telegram", icon: "✈" },
          { k: "pagamentos", label: "Pagamentos", icon: "₿" },
          { k: "notif", label: "Alertas", icon: "🔔" },
        ] as const).map(({ k, label, icon }) => {
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} className="py-2.5 flex flex-col items-center" style={{ gap: 2 }}>
              <span style={{ fontSize: 16, color: active ? C.purple : "rgba(255,255,255,0.35)" }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? C.purple : "rgba(255,255,255,0.35)" }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== PAINEL ===================== */
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

      const buckets: Record<string, { day: string; enviadas: number; entregues: number; erros: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const k = dayKey(new Date(Date.now() - i * 86400000).toISOString());
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
        total: totalSends, sent: sent.count || 0, delivered: delivered.count || 0, failed: failed.count || 0,
        pixGerado, vendaAprovada, cpa, chart,
      });
    })();
  }, []);

  if (!d) return <Loading />;

  // build SVG line paths from chart
  const W = 340, H = 96, padX = 16, padY = 4;
  const maxY = Math.max(1, ...d.chart.map((p: any) => Math.max(p.enviadas, p.entregues, p.erros)));
  const xAt = (i: number) => padX + (i * (W - padX * 2)) / Math.max(1, d.chart.length - 1);
  const yAt = (v: number) => H - padY - (v / maxY) * (H - padY * 2 - 8);
  const buildPath = (key: string) => d.chart.map((p: any, i: number) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p[key]).toFixed(1)}`).join(" ");
  const buildArea = (key: string) => `${buildPath(key)} L${xAt(d.chart.length - 1).toFixed(1)},${H} L${xAt(0).toFixed(1)},${H} Z`;
  const axisDays = [0, 7, 14, 21, 29].map(i => d.chart[i]?.day).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* KPIs row3 */}
      <div style={{ display: "flex", gap: 6 }}>
        <KpiCardBar color={C.purple} label="Campanhas" value={String(d.campaigns)} sub="Criadas" />
        <KpiCardBar color={C.blue} label="Modelos" value={String(d.templates)} sub="Templates" />
        <KpiCardBar color={C.orange} label="Contatos" value={String(d.contacts)} sub="Alcançados" />
      </div>

      {/* Financeiro */}
      <div style={{ display: "flex", gap: 6 }}>
        <FinCard label="Pix gerado" value={fmtBRL(d.pixGerado)} valColor={C.green} />
        <FinCard label="Venda aprovada" value={fmtBRL(d.vendaAprovada)} valColor={C.purple} />
      </div>

      {/* CPA */}
      <div style={{ background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: C.textMuted, fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>CPA — Custo por aquisição</p>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
            <span style={{ color: C.blue, fontSize: 20, fontWeight: 700, fontFamily: MONO, letterSpacing: -0.3 }}>{d.cpa.toFixed(4)}</span>
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginLeft: 4 }}>venda / msg</span>
          </div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(56,189,248,0.1)", border: "0.5px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: C.blue, fontSize: 22 }}>↗</span>
        </div>
      </div>

      {/* Mensagens row4 */}
      <div style={{ display: "flex", gap: 6 }}>
        {[
          { v: d.total, l: "Total", c: "#fff", bar: "rgba(255,255,255,0.2)" },
          { v: d.sent, l: "Enviadas", c: C.blue, bar: C.blue },
          { v: d.delivered, l: "Entregues", c: C.green, bar: C.green },
          { v: d.failed, l: "Falhas", c: C.red, bar: C.red },
        ].map(item => (
          <div key={item.l} style={{ flex: 1, background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 10, position: "relative", overflow: "hidden", textAlign: "center" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: item.bar }} />
            <p style={{ color: item.c, fontSize: 19, fontWeight: 700, fontFamily: MONO, marginTop: 4 }}>{item.v}</p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 5 }}>{item.l}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: C.card, border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.6 }}>Volume de mensagens</p>
          <div style={{ display: "flex", gap: 4 }}>
            {["7d", "30d", "90d"].map(p => (
              <span key={p} style={{
                padding: "3px 7px", borderRadius: 4, fontSize: 10,
                background: p === "30d" ? "rgba(124,92,252,0.2)" : "transparent",
                border: p === "30d" ? "0.5px solid rgba(124,92,252,0.3)" : "none",
                color: p === "30d" ? "#b09afa" : "rgba(255,255,255,0.25)"
              }}>{p}</span>
            ))}
          </div>
        </div>
        <svg width="100%" height={96} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c5cfc" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#7c5cfc" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34c759" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#34c759" stopOpacity={0} />
            </linearGradient>
          </defs>
          <line x1={0} y1={16} x2={W} y2={16} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          <line x1={0} y1={48} x2={W} y2={48} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          <line x1={0} y1={80} x2={W} y2={80} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          <path d={buildArea("enviadas")} fill="url(#ga)" />
          <path d={buildPath("enviadas")} fill="none" stroke="#9d7bfa" strokeWidth={1.8} />
          <path d={buildArea("entregues")} fill="url(#gb)" />
          <path d={buildPath("entregues")} fill="none" stroke="#34c759" strokeWidth={1.2} strokeDasharray="4,3" />
          <path d={buildPath("erros")} fill="none" stroke="#ff453a" strokeWidth={1} />
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          {axisDays.map(d => <span key={d} style={{ color: C.textDim, fontSize: 9, fontFamily: MONO }}>{d}</span>)}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, paddingTop: 10, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          {[{ c: "#9d7bfa", l: "Enviadas" }, { c: "#34c759", l: "Entregues" }, { c: "#ff453a", l: "Erros" }].map(i => (
            <div key={i.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 16, height: 2, background: i.c, borderRadius: 1 }} />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{i.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================== TELEGRAM ===================== */
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
      let bot: any = null;
      try {
        const r = await (supabase as any).from("telegram_bots").select("name,username,created_at,is_active").limit(1).maybeSingle();
        bot = r.data;
      } catch {}
      setD({ bots, msgsHoje, conversas, vendasMes: txs.count || 0, bot });
    })();
  }, []);
  if (!d) return <Loading />;

  const kpis = [
    { label: "Bots", value: d.bots, sub: "Conectados", bar: C.purple, valColor: "#fff" },
    { label: "Msgs hoje", value: d.msgsHoje, sub: "Recebidas", bar: C.blue, valColor: "#fff" },
    { label: "Conversas", value: d.conversas, sub: "Únicas", bar: "#64748b", valColor: "#fff" },
    { label: "Vnd. Aprov.", value: d.vendasMes, sub: "Este mês", bar: C.green, valColor: C.green },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ flex: 1, background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 10, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: k.bar }} />
            <p style={{ color: C.textMuted, fontSize: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4, marginBottom: 5 }}>{k.label}</p>
            <p style={{ color: k.valColor, fontSize: 18, fontWeight: 700, fontFamily: MONO }}>{k.value}</p>
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, marginTop: 3 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: 14 }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Volume — últimos 14 dias</p>
        <svg width="100%" height={70} viewBox="0 0 340 70">
          <line x1={0} y1={18} x2={340} y2={18} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          <line x1={0} y1={45} x2={340} y2={45} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          <line x1={0} y1={64} x2={340} y2={64} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <circle cx={170} cy={64} r={3} fill="#9d7bfa" />
        </svg>
      </div>

      <p style={{ color: C.textMuted, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 }}>Seus bots</p>
      {d.bot ? (
        <div style={{ background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 13, display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, background: C.purpleDark, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{(d.bot.name || "B")[0].toUpperCase()}</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{d.bot.name || "bot"}</p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: MONO, marginTop: 2 }}>@{d.bot.username || "—"}</p>
          </div>
          <div style={{ background: "rgba(52,199,89,0.1)", border: "0.5px solid rgba(52,199,89,0.2)", borderRadius: 3, padding: "2px 7px" }}>
            <span style={{ color: C.green, fontSize: 10, fontWeight: 500 }}>{d.bot.is_active === false ? "inativo" : "ativo"}</span>
          </div>
        </div>
      ) : (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textAlign: "center", padding: "16px 0" }}>Nenhum bot configurado.</p>
      )}
    </div>
  );
}

/* ===================== PAGAMENTOS ===================== */
function Pagamentos({ email }: { email?: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [txRes, wdRes] = await Promise.all([
        supabase.from("gateway_transactions").select("id,amount,fee,net,status,customer_name,created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("gateway_withdrawals").select("id,amount,status,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      const txs = txRes.data || [];
      const wds = wdRes.data || [];
      const isApp = (s: string) => ["approved", "paid", "completed"].includes(s);
      const txs30 = txs.filter((t: any) => t.created_at >= since);
      const aprov30 = txs30.filter((t: any) => isApp(t.status));
      const volume = aprov30.reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const taxa = txs30.length ? (aprov30.length / txs30.length) * 100 : 0;
      const ticket = aprov30.length ? volume / aprov30.length : 0;
      const liquido = txs.filter((t: any) => isApp(t.status)).reduce((s: number, t: any) => s + (t.net || (t.amount - (t.fee || 0))), 0);
      const sacado = wds.filter((w: any) => isApp(w.status)).reduce((s: number, w: any) => s + (w.amount || 0), 0);
      const pend = wds.filter((w: any) => w.status === "pending").reduce((s: number, w: any) => s + (w.amount || 0), 0);
      const saldo = Math.max(0, liquido - sacado - pend);
      const extrato = [
        ...wds.map((w: any) => ({ id: "w" + w.id, type: "out", name: "Saque PIX", date: w.created_at, amount: w.amount, status: w.status })),
        ...txs.slice(0, 30).map((t: any) => ({ id: "t" + t.id, type: "in", name: t.customer_name || "Cliente WhatsApp", date: t.created_at, amount: t.amount, status: t.status, ref: t.id.slice(0, 8) })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
      setD({ saldo, liquido, sacado, vendas: aprov30.length, volume, taxa, ticket, extrato });
    })();
  }, []);
  if (!d) return <Loading />;

  const metrics = [
    { label: "Vendas aprovadas", value: String(d.vendas), sub: "últimos 30 dias", color: C.green },
    { label: "Volume aprovado", value: fmtBRL(d.volume), sub: "R$ · 30 dias", color: C.purple },
    { label: "Taxa aprovação", value: `${d.taxa.toFixed(1)}%`, sub: "últimos 30 dias", color: C.blue },
    { label: "Ticket médio", value: fmtBRL(d.ticket), sub: "R$ por venda", color: C.yellow },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Balance */}
      <div style={{ background: "rgba(108,74,242,0.12)", border: "0.5px solid rgba(108,74,242,0.25)", borderRadius: 8, padding: 18 }}>
        <p style={{ color: C.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>Saldo disponível para saque</p>
        <p style={{ color: "#fff", fontSize: 36, fontWeight: 300, fontFamily: MONO, letterSpacing: -1.5 }}>R$ {fmtBRL(d.saldo)}</p>
        <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontFamily: MONO, marginTop: 6 }}>
          Líquido R$ {fmtBRL(d.liquido)} · Sacado R$ {fmtBRL(d.sacado)}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button style={{ flex: 1, borderRadius: 6, padding: "10px 0", color: "#fff", fontSize: 12, fontWeight: 500, background: "linear-gradient(90deg, #6c4af2, #8b68f5)" }}>
            Solicitar saque
          </button>
          <button style={{ flex: 1, borderRadius: 6, padding: "10px 0", background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 500 }}>
            Extrato
          </button>
        </div>
      </div>

      {/* Metrics 2x2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 14 }}>
            <p style={{ color: C.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>● {m.label}</p>
            <p style={{ color: m.color, fontSize: 17, fontWeight: 700, fontFamily: MONO, letterSpacing: -0.3 }}>{m.value}</p>
            <p style={{ color: C.textDim, fontSize: 10, marginTop: 4 }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Extrato */}
      <p style={{ color: C.textMuted, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6, marginBottom: 4 }}>Movimentações recentes</p>
      <div>
        {d.extrato.length === 0 && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textAlign: "center", padding: "16px 0" }}>Sem movimentações</p>}
        {d.extrato.map((e: any) => {
          const ok = ["approved", "paid", "completed"].includes(e.status);
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", padding: "11px 0", gap: 10, borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: ok ? "rgba(52,199,89,0.08)" : "rgba(255,204,0,0.08)" }}>
                <span style={{ color: ok ? C.green : C.yellow, fontSize: 14 }}>{e.type === "in" ? "↑" : "↓"}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: MONO, marginTop: 2 }}>
                  {e.ref ? `${e.ref} · PIX · ` : ""}{fmtDateTime(e.date)}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: e.type === "in" ? (ok ? C.green : "#fff") : C.red, fontSize: 13, fontWeight: 600, fontFamily: MONO }}>
                  {e.type === "in" ? (ok ? "+ " : "") : "- "}R$ {fmtBRL(e.amount)}
                </p>
                <div style={{ marginTop: 4, display: "inline-block", padding: "2px 6px", borderRadius: 3, background: ok ? "rgba(52,199,89,0.12)" : "rgba(255,204,0,0.1)" }}>
                  <span style={{ color: ok ? C.green : C.yellow, fontSize: 9, fontWeight: 500, textTransform: "capitalize" }}>{ok ? "Aprovado" : "Pendente"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== UI ===================== */
function KpiCardBar({ color, label, value, sub }: any) {
  return (
    <div style={{ flex: 1, background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 10, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      <p style={{ color: C.textMuted, fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>{label}</p>
      <p style={{ color: "#fff", fontSize: 19, fontWeight: 700, fontFamily: MONO, marginTop: 4 }}>{value}</p>
      {sub && <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

function FinCard({ label, value, valColor }: { label: string; value: string; valColor: string }) {
  const [int_, dec] = value.split(",");
  return (
    <div style={{ flex: 1, background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 13 }}>
      <p style={{ color: C.textMuted, fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>● {label}</p>
      <p style={{ color: valColor, fontSize: 17, fontWeight: 700, fontFamily: MONO, letterSpacing: -0.3 }}>R$ {int_}</p>
      <p style={{ color: C.textDim, fontSize: 10, marginTop: 3 }}>,{dec || "00"} neste período</p>
    </div>
  );
}

/* ===================== NOTIFICAÇÕES ===================== */
/**
 * Resumos por slot (BRT 08h, 12h, 18h, 00h):
 * - Mensagens enviadas (campaign_sends sent/delivered) no intervalo
 * - Vendas e total em R$ (gateway_transactions paid) no intervalo
 * Os intervalos são calculados em horário de Brasília (UTC-3).
 */
const SLOT_HOURS_BRT = [0, 8, 12, 18];

function brtSlotRange(slotHourBrt: number, dayOffset = 0): { startUtc: Date; endUtc: Date; labelHour: string; labelDate: string } {
  // BRT = UTC-3 fixo. Slot começa em HH:00 BRT e termina em (HH+6):00 BRT (intervalo de 6h entre slots).
  // Para o slot 00h, mostramos do dia anterior 18h-00h. Para 08h: 00h-08h. Para 12h: 08h-12h. Para 18h: 12h-18h.
  const widths: Record<number, number> = { 0: 6, 8: 8, 12: 4, 18: 6 };
  const width = widths[slotHourBrt] ?? 6;
  // "Agora" em BRT
  const nowUtc = new Date(Date.now() - dayOffset * 86400000);
  const brtNow = new Date(nowUtc.getTime() - 3 * 3600000);
  const y = brtNow.getUTCFullYear();
  const m = brtNow.getUTCMonth();
  const d = brtNow.getUTCDate();
  const endBrt = new Date(Date.UTC(y, m, d, slotHourBrt, 0, 0));
  const startBrt = new Date(endBrt.getTime() - width * 3600000);
  // Converte BRT (UTC-3) → UTC somando 3h
  const startUtc = new Date(startBrt.getTime() + 3 * 3600000);
  const endUtc = new Date(endBrt.getTime() + 3 * 3600000);
  const labelHour = `${String(slotHourBrt).padStart(2, "0")}:00`;
  const labelDate = `${String(endBrt.getUTCDate()).padStart(2, "0")}/${String(endBrt.getUTCMonth() + 1).padStart(2, "0")}`;
  return { startUtc, endUtc, labelHour, labelDate };
}

function Notificacoes() {
  const [items, setItems] = useState<Array<{
    key: string; labelHour: string; labelDate: string; msgs: number; sales: number; amount: number; isFuture: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  const VAPID_PUBLIC_KEY = "BK5uD6L7-UuZ-aB1U6OmARv4bWJPgC8cx_XpOVYOjFKDr7iv6_RlFcNxw1BnnVcO9-VVk-Zi1TLIv8Rwjlbh-JU";

  const getPushSubscriptions = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return [] as PushSubscription[];
    const regs = await navigator.serviceWorker.getRegistrations();
    const subs = await Promise.all(regs.map((reg) => reg.pushManager.getSubscription()));
    return subs.filter(Boolean) as PushSubscription[];
  };

  const savePushSubscription = async (sub: PushSubscription) => {
    const json = sub.toJSON() as any;
    const { data: u, error: userError } = await supabase.auth.getUser();
    if (userError || !u?.user) throw new Error("Faça login novamente para ativar o push.");

    const endpoint = json.endpoint || sub.endpoint;
    const p256dh = json.keys?.p256dh;
    const authKey = json.keys?.auth;
    if (!endpoint || !p256dh || !authKey) throw new Error("Inscrição push inválida. Desative e ative novamente.");

    const { error } = await (supabase as any).from("web_push_subscriptions").upsert({
      user_id: u.user.id,
      endpoint,
      p256dh,
      auth: authKey,
      user_agent: navigator.userAgent,
      last_used_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw error;
    return u.user.id;
  };

  const syncPushSubscription = async () => {
    const subs = await getPushSubscriptions();
    if (subs.length === 0) {
      setPushEnabled(false);
      return null;
    }

    let userId: string | null = null;
    for (const sub of subs) userId = await savePushSubscription(sub);
    setPushEnabled(true);
    return { userId, count: subs.length };
  };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  const enablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Seu navegador não suporta notificações push.");
      return;
    }
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushEnabled(false);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await savePushSubscription(sub);
      setPushEnabled(true);
      new Notification("ZapLynx", { body: "Notificações ativadas! Você receberá os resumos automáticos." });
    } catch (e: any) {
      setPushEnabled(false);
      alert("Erro ao ativar push: " + (e?.message || e));
    } finally {
      setPushBusy(false);
    }
  };

  const sendTestSummary = async () => {
    void 0;
    return _sendTestSummary();
  };

  const disablePush = async () => {
    setPushBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const subs = await getPushSubscriptions();
      for (const sub of subs) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await (supabase as any).from("web_push_subscriptions").delete().eq("endpoint", endpoint);
      }
      if (u?.user) await (supabase as any).from("web_push_subscriptions").delete().eq("user_id", u.user.id);
      setPushEnabled(false);
    } catch (e: any) {
      setPushEnabled((await getPushSubscriptions()).length > 0);
      alert("Erro ao desativar: " + (e?.message || e));
    } finally {
      setPushBusy(false);
    }
  };

  const _sendTestSummary = async () => {
    setTestBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const synced = await syncPushSubscription();
      if (!synced) {
        setPushEnabled(false);
        alert("Push desativado neste navegador. Clique em Ativar push primeiro.");
        return;
      }
      // Calcula o último slot fechado (00/08/12/18 BRT)
      const now = new Date();
      const brtNow = new Date(now.getTime() - 3 * 3600000);
      const h = brtNow.getUTCHours();
      const lastSlot = SLOT_HOURS_BRT.filter((s) => s <= h).pop() ?? 18;
      const dayOffset = lastSlot <= h ? 0 : 1;
      const r = brtSlotRange(lastSlot, dayOffset);
      const [{ count: msgs }, txs] = await Promise.all([
        supabase.from("campaign_sends").select("id", { count: "exact", head: true })
          .in("status", ["sent", "delivered"])
          .gte("created_at", r.startUtc.toISOString()).lt("created_at", r.endUtc.toISOString()),
        supabase.from("gateway_transactions").select("amount,status,created_at")
          .eq("status", "paid")
          .gte("created_at", r.startUtc.toISOString()).lt("created_at", r.endUtc.toISOString()).limit(1000),
      ]);
      const sales = (txs.data || []).length;
      const amount = (txs.data || []).reduce((s: number, x: any) => s + (x.amount || 0), 0);
      const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const title = `📊 Resumo das ${r.labelHour}`;
      const body = `${sales} venda${sales === 1 ? "" : "s"} • ${fmt(amount)} • ${msgs || 0} msg`;
      const { data, error } = await supabase.functions.invoke("web-push-send", {
        body: { user_id: u.user.id, title, body, tag: `resumo-${r.labelHour}`, url: "/preview-app" },
      });
      if (error) throw error;
      if ((data as any)?.sent === 0) {
        alert("Nenhuma notificação enviada. Clique em Desativar push, depois Ativar push novamente.");
      }
    } catch (e: any) {
      alert("Erro: " + (e?.message || e));
    } finally {
      setTestBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      const nowUtc = Date.now();
      // Últimos 2 dias × 4 slots = 8 cards (mais que suficiente)
      const slots: Array<ReturnType<typeof brtSlotRange> & { key: string; isFuture: boolean }> = [];
      for (let day = 0; day <= 1; day++) {
        for (const h of SLOT_HOURS_BRT) {
          const r = brtSlotRange(h, day);
          slots.push({ ...r, key: `${day}-${h}`, isFuture: r.endUtc.getTime() > nowUtc });
        }
      }
      // Ordena do mais recente para o mais antigo
      slots.sort((a, b) => b.endUtc.getTime() - a.endUtc.getTime());
      const recent = slots.filter((s) => !s.isFuture).slice(0, 4);

      const results = await Promise.all(
        recent.map(async (s) => {
          const [{ count: msgs }, txs] = await Promise.all([
            supabase
              .from("campaign_sends")
              .select("id", { count: "exact", head: true })
              .in("status", ["sent", "delivered"])
              .gte("created_at", s.startUtc.toISOString())
              .lt("created_at", s.endUtc.toISOString()),
            supabase
              .from("gateway_transactions")
              .select("amount,status,created_at")
              .eq("status", "paid")
              .gte("created_at", s.startUtc.toISOString())
              .lt("created_at", s.endUtc.toISOString())
              .limit(1000),
          ]);
          const sales = (txs.data || []).length;
          const amount = (txs.data || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
          return {
            key: s.key,
            labelHour: s.labelHour,
            labelDate: s.labelDate,
            msgs: msgs || 0,
            sales,
            amount,
            isFuture: false,
          };
        }),
      );
      setItems(results);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await syncPushSubscription();
      } catch {
        setPushEnabled(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-2.5" style={{ paddingTop: 4 }}>
      {/* BOTÕES DE ATIVAÇÃO */}
      <div style={{ background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 12 }}>
        <p style={{ color: C.textMuted, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>● ATIVAR ALERTAS</p>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
          Receba notificações automáticas a cada janela de resumo (00h, 08h, 12h, 18h — BRT).
        </p>
        <div className="grid grid-cols-2" style={{ gap: 8, marginTop: 10 }}>
          <button
            onClick={pushEnabled ? disablePush : enablePush}
            disabled={pushBusy}
            style={{
              background: pushEnabled ? "rgba(248,113,113,0.15)" : C.purple,
              color: pushEnabled ? "#f87171" : "#fff",
              border: pushEnabled ? "0.5px solid #f8717155" : "none",
              borderRadius: 6, padding: "9px 8px", fontSize: 11, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              cursor: pushBusy ? "default" : "pointer", opacity: pushBusy ? 0.6 : 1,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {pushBusy ? "..." : pushEnabled ? "Desativar push" : "Ativar push"}
          </button>
          <button
            onClick={() => alert("Configure seu Telegram na aba Telegram para receber alertas por lá.")}
            style={{
              background: "rgba(96,165,250,0.15)", color: C.blue,
              border: "0.5px solid " + C.blue + "55",
              borderRadius: 6, padding: "9px 8px", fontSize: 11, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
            Telegram
          </button>
        </div>
        <button
          onClick={sendTestSummary}
          disabled={testBusy || !pushEnabled}
          style={{
            marginTop: 8, width: "100%",
            background: pushEnabled ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.05)",
            color: pushEnabled ? C.purple : "rgba(255,255,255,0.4)",
            border: "0.5px solid " + (pushEnabled ? C.purple + "55" : "rgba(255,255,255,0.1)"),
            borderRadius: 6, padding: "9px 8px", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            cursor: testBusy || !pushEnabled ? "not-allowed" : "pointer",
            opacity: testBusy ? 0.6 : 1,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          {testBusy ? "Enviando..." : "Enviar resumo de teste agora"}
        </button>
      </div>

      {/* PREFERÊNCIAS POR MÉTODO DE PAGAMENTO */}
      <NotificationPrefsPanel />

      <div style={{ background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 12 }}>
        <p style={{ color: C.textMuted, fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>● COMO FUNCIONA</p>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
          Você recebe um push automático com o resumo de mensagens enviadas e vendas a cada janela do dia (00h, 08h, 12h, 18h — horário de Brasília).
        </p>
      </div>

      {loading && (
        <div style={{ color: C.textMuted, fontSize: 11, textAlign: "center", padding: 24 }}>Carregando…</div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ color: C.textMuted, fontSize: 11, textAlign: "center", padding: 24 }}>Sem resumos no momento.</div>
      )}

      {!loading && items.map((it) => (
        <div key={it.key} style={{ background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 12 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <div className="flex items-center" style={{ gap: 8 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6,
                background: "rgba(167,139,250,0.15)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: C.purple, flexShrink: 0,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Resumo das {it.labelHour}</span>
            </div>
            <span style={{ color: C.textMuted, fontSize: 10 }}>{it.labelDate}</span>
          </div>
          <div className="grid grid-cols-3" style={{ gap: 8 }}>
            <MiniStat label="Msgs" value={it.msgs.toLocaleString("pt-BR")} color={C.purple} />
            <MiniStat label="Vendas" value={String(it.sales)} color={C.green} />
            <MiniStat label="R$" value={fmtBRL(it.amount)} color={C.blue} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
      <p style={{ color: C.textMuted, fontSize: 8, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</p>
      <p style={{ color, fontSize: 13, fontWeight: 700, fontFamily: MONO, marginTop: 3 }}>{value}</p>
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Carregando…</div>;
}

/* ===================== PREFERÊNCIAS DE NOTIFICAÇÃO ===================== */
type Prefs = {
  enabled: boolean;
  notify_credit_card: boolean;
  notify_boleto_paid: boolean;
  notify_pix_paid: boolean;
  notify_pix_recurring: boolean;
  notify_apple_pay: boolean;
  notify_pix_or_boleto_issued: boolean;
};

const DEFAULT_PREFS: Prefs = {
  enabled: true,
  notify_credit_card: true,
  notify_boleto_paid: true,
  notify_pix_paid: true,
  notify_pix_recurring: true,
  notify_apple_pay: true,
  notify_pix_or_boleto_issued: false,
};

const PREF_ROWS: Array<{ key: keyof Omit<Prefs, "enabled">; label: string }> = [
  { key: "notify_credit_card", label: "Notificar cartão de crédito" },
  { key: "notify_boleto_paid", label: "Notificar boleto pago" },
  { key: "notify_pix_paid", label: "Notificar pix pago" },
  { key: "notify_pix_recurring", label: "Notificar pix recorrente" },
  { key: "notify_apple_pay", label: "Notificar Apple Pay" },
  { key: "notify_pix_or_boleto_issued", label: "Notificar pix ou boleto emitido" },
];

function NotificationPrefsPanel() {
  const [checkouts, setCheckouts] = useState<Array<{ id: string; name: string }>>([]);
  const [selected, setSelected] = useState<string>("__all__");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Carrega checkouts do usuário
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const { data } = await supabase
        .from("gateway_checkouts")
        .select("id, name")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      setCheckouts((data || []) as any);
    })();
  }, []);

  // Carrega preferências do checkout selecionado
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      const checkoutFilter = selected === "__all__" ? null : selected;
      const q = (supabase as any)
        .from("notification_preferences")
        .select("*")
        .eq("user_id", userId);
      const { data } = checkoutFilter
        ? await q.eq("checkout_id", checkoutFilter).maybeSingle()
        : await q.is("checkout_id", null).maybeSingle();
      if (data) setPrefs({
        enabled: data.enabled,
        notify_credit_card: data.notify_credit_card,
        notify_boleto_paid: data.notify_boleto_paid,
        notify_pix_paid: data.notify_pix_paid,
        notify_pix_recurring: data.notify_pix_recurring,
        notify_apple_pay: data.notify_apple_pay,
        notify_pix_or_boleto_issued: data.notify_pix_or_boleto_issued,
      });
      else setPrefs(DEFAULT_PREFS);
      setLoading(false);
    })();
  }, [userId, selected]);

  const updatePref = async (key: keyof Prefs, value: boolean) => {
    if (!userId) return;
    setSavingKey(key as string);
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const checkoutFilter = selected === "__all__" ? null : selected;
    await (supabase as any).from("notification_preferences").upsert({
      user_id: userId,
      checkout_id: checkoutFilter,
      ...next,
    }, { onConflict: "user_id,checkout_id" });
    setSavingKey(null);
  };

  return (
    <div style={{ background: C.card, border: "0.5px solid " + C.cardBorder, borderRadius: 8, padding: 12 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <p style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Notificações</p>
        <Toggle
          on={prefs.enabled}
          onChange={(v) => updatePref("enabled", v)}
          disabled={loading || savingKey === "enabled"}
        />
      </div>

      <div style={{ borderTop: "0.5px solid " + C.cardBorder, paddingTop: 10 }}>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid " + C.cardBorder,
            color: "#fff",
            borderRadius: 6,
            padding: "9px 10px",
            fontSize: 12,
            fontFamily: "inherit",
            outline: "none",
          }}
        >
          <option value="__all__" style={{ background: "#1a1530" }}>Todos os checkouts (padrão)</option>
          {checkouts.map((c) => (
            <option key={c.id} value={c.id} style={{ background: "#1a1530" }}>{c.name}</option>
          ))}
        </select>

        <div style={{ marginTop: 10, opacity: prefs.enabled ? 1 : 0.4, pointerEvents: prefs.enabled ? "auto" : "none" }}>
          {PREF_ROWS.map((row) => (
            <div key={row.key} className="flex items-center justify-between" style={{ padding: "10px 0", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{row.label}</span>
              <Toggle
                on={prefs[row.key]}
                onChange={(v) => updatePref(row.key, v)}
                disabled={loading || savingKey === row.key}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      style={{
        width: 40, height: 22, borderRadius: 999,
        background: on ? C.purple : "rgba(255,255,255,0.12)",
        border: "none", padding: 0, position: "relative",
        cursor: disabled ? "default" : "pointer",
        transition: "background 0.18s ease",
        opacity: disabled ? 0.6 : 1, flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 20 : 2,
        width: 18, height: 18, borderRadius: "50%",
        background: "#fff",
        transition: "left 0.18s ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}
