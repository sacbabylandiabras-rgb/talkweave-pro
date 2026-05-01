import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Preview web do app mobile (Expo zaplynx-app).
 * Renderiza as MESMAS queries que o app fará, dentro de um frame de iPhone,
 * para validar dados antes de subir para a App Store.
 */

const FEE_PCT = 0.0699;
const FEE_FIXED = 199;

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} · ${hh}:${mi}`;
};

type Tab = "painel" | "pagamentos" | "telegram";

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
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6">
      <div className="text-center text-white/90">
        <h1 className="text-2xl font-bold">Preview do App Mobile</h1>
        <p className="text-sm text-white/60">
          Mesmos dados que o app vai puxar do Supabase. Use seu login do painel.
        </p>
      </div>

      <PhoneFrame>
        {!session ? (
          <Login
            email={email}
            pw={pw}
            setEmail={setEmail}
            setPw={setPw}
            login={login}
            err={authErr}
            loading={authLoading}
          />
        ) : (
          <AppShell tab={tab} setTab={setTab} session={session} />
        )}
      </PhoneFrame>

      {session && (
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-white/60 hover:text-white underline"
        >
          Sair do preview
        </button>
      )}
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 390,
        height: 780,
        borderRadius: 48,
        background: "#000",
        padding: 12,
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 36,
          overflow: "hidden",
          background: "#0b1220",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Login({
  email, pw, setEmail, setPw, login, err, loading,
}: any) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 text-white">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-6 text-2xl font-black">
        Z
      </div>
      <h2 className="text-xl font-bold mb-1">Entrar</h2>
      <p className="text-xs text-white/50 mb-6">Use o mesmo login do painel</p>
      <input
        className="w-full mb-3 rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-sm outline-none"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full mb-4 rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-sm outline-none"
        placeholder="Senha"
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      {err && <p className="text-xs text-red-400 mb-3">{err}</p>}
      <button
        onClick={login}
        disabled={loading}
        className="w-full rounded-xl py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm disabled:opacity-50"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </div>
  );
}

function AppShell({ tab, setTab, session }: { tab: Tab; setTab: (t: Tab) => void; session: any }) {
  return (
    <div className="h-full w-full flex flex-col text-white">
      <div className="px-5 pt-12 pb-3 border-b border-white/5">
        <p className="text-[11px] text-white/50">Olá,</p>
        <p className="text-sm font-semibold truncate">{session.user.email}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === "painel" && <Painel />}
        {tab === "pagamentos" && <Pagamentos />}
        {tab === "telegram" && <Telegram />}
      </div>
      <div className="border-t border-white/10 bg-black/40 backdrop-blur grid grid-cols-3 text-[11px]">
        {(["painel", "pagamentos", "telegram"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 ${tab === t ? "text-emerald-400" : "text-white/50"}`}
          >
            {t === "painel" ? "Painel" : t === "pagamentos" ? "Pagamentos" : "Telegram"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================ PAINEL ============================ */
function Painel() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const [c, t, total, sent, failed, phones, txs] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
        supabase.from("message_templates").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }).in("status", ["sent", "delivered"]),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("campaign_sends").select("phone").limit(1000),
        supabase.from("gateway_transactions").select("amount,status").limit(1000),
      ]);
      const pixGerado = (txs.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const aprov = (txs.data || []).filter((r: any) => ["approved", "paid", "completed"].includes(r.status));
      const vendaAprovada = aprov.reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const totalSends = total.count || 0;
      const cpa = aprov.length > 0 ? totalSends / aprov.length : 0;
      setD({
        campaigns: c.count || 0,
        templates: t.count || 0,
        contacts: new Set((phones.data || []).map((p: any) => p.phone)).size,
        total: totalSends,
        sent: sent.count || 0,
        delivered: sent.count || 0,
        failed: failed.count || 0,
        pixGerado, vendaAprovada, cpa,
      });
    })();
  }, []);
  if (!d) return <Loading />;
  return (
    <div className="p-4 space-y-3">
      <SectionTitle>Resumo</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Campanhas" value={d.campaigns} />
        <Kpi label="Modelos" value={d.templates} />
        <Kpi label="Contatos" value={d.contacts} />
        <Kpi label="Mensagens" value={d.total} />
      </div>
      <SectionTitle>Entregas</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Enviadas" value={d.sent} accent="emerald" />
        <Kpi label="Entregues" value={d.delivered} accent="emerald" />
        <Kpi label="Falhas" value={d.failed} accent="red" />
      </div>
      <SectionTitle>Faturamento</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Pix gerado" value={`R$ ${fmtBRL(d.pixGerado)}`} />
        <Kpi label="Venda aprovada" value={`R$ ${fmtBRL(d.vendaAprovada)}`} accent="emerald" />
        <Kpi label="CPA (msg/venda)" value={d.cpa.toFixed(1)} />
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
    <div className="p-4 space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-400/30 p-4">
        <p className="text-xs text-white/60">Saldo disponível</p>
        <p className="text-3xl font-bold text-emerald-300 mt-1">R$ {fmtBRL(d.saldo)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Vendas (30d)" value={d.vendas} />
        <Kpi label="Volume" value={`R$ ${fmtBRL(d.volume)}`} accent="emerald" />
        <Kpi label="Aprovação" value={`${d.taxa.toFixed(1)}%`} />
        <Kpi label="Ticket médio" value={`R$ ${fmtBRL(d.ticket)}`} />
      </div>
      <SectionTitle>Extrato</SectionTitle>
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
    <div className="p-4 space-y-3">
      <SectionTitle>Telegram</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Bots" value={d.bots} />
        <Kpi label="Mensagens hoje" value={d.msgsHoje} />
        <Kpi label="Conversas" value={d.conversas} />
        <Kpi label="Vendas (mês)" value={d.vendasMes} accent="emerald" />
      </div>
      {d.bots === 0 && (
        <p className="text-xs text-white/40 text-center pt-4">
          Nenhum bot configurado ainda.
        </p>
      )}
    </div>
  );
}

/* ============================ UI bits ============================ */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] uppercase tracking-wider text-white/40 mt-2">{children}</h3>;
}

function Kpi({ label, value, accent }: { label: string; value: any; accent?: "emerald" | "red" }) {
  const color = accent === "emerald" ? "text-emerald-300" : accent === "red" ? "text-red-300" : "text-white";
  return (
    <div className="rounded-xl bg-white/5 border border-white/5 p-3">
      <p className="text-[10px] text-white/50">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function Loading() {
  return <div className="p-8 text-center text-xs text-white/40">Carregando…</div>;
}