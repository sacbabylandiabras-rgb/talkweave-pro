import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Preview do App Mobile ZapLynx — réplica fiel do app nativo (Expo).
 * Dados reais do Supabase (login do painel).
 */

const Colors = {
  bg: "#0f1117",
  card: "#161820",
  card2: "#1e2130",
  border: "rgba(255,255,255,0.06)",
  purple: "#c084fc",
  green: "#34d399",
  blue: "#60a5fa",
  amber: "#fbbf24",
  red: "#f87171",
  teal: "#38bdf8",
  white: "#ffffff",
  muted: "#555b70",
  subtext: "#888fa0",
};

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

type Tab = "painel" | "telegram" | "saques" | "notif";

const fmtBRL = (cents: number) =>
  "R$ " + (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        background: "radial-gradient(circle at 30% 20%, #1a0f2e 0%, #050309 70%)",
        fontFamily: FONT,
      }}
    >
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.8)" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Preview do App Mobile</h1>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Réplica fiel do app · dados reais</p>
      </div>

      <PhoneFrame>
        {!session ? (
          <Login email={email} pw={pw} setEmail={setEmail} setPw={setPw} login={login} err={authErr} loading={authLoading} />
        ) : (
          <AppShell tab={tab} setTab={setTab} session={session} />
        )}
      </PhoneFrame>

      {session && (
        <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textDecoration: "underline" }}>
          Sair do preview
        </button>
      )}
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 390, height: 800, borderRadius: 52, background: "#000", padding: 10, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 44, overflow: "hidden", background: Colors.bg, position: "relative" }}>
        {children}
      </div>
    </div>
  );
}

function LogoText({ size = 22 }: { size?: number }) {
  return (
    <div style={{ fontSize: size, fontWeight: 800, letterSpacing: 0.5, fontFamily: FONT }}>
      <span style={{ color: Colors.white }}>ZAP</span>
      <span style={{ color: Colors.purple }}>LYNX</span>
    </div>
  );
}

function Login({ email, pw, setEmail, setPw, login, err, loading }: any) {
  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", color: "#fff", background: Colors.bg, position: "relative" }}>
      <div style={{ position: "absolute", top: -120, left: -100, width: 420, height: 420, borderRadius: 210, background: "rgba(192,132,252,0.12)" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", position: "relative", zIndex: 1 }}>
        <LogoText size={32} />
        <p style={{ fontSize: 11, color: Colors.muted, marginTop: 24, marginBottom: 24 }}>Entre com seu login do painel</p>
        <input
          style={{ width: "100%", marginBottom: 12, borderRadius: 10, padding: "12px 16px", fontSize: 14, background: Colors.card, border: `1px solid ${Colors.border}`, color: "#fff", outline: "none", fontFamily: FONT }}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={{ width: "100%", marginBottom: 16, borderRadius: 10, padding: "12px 16px", fontSize: 14, background: Colors.card, border: `1px solid ${Colors.border}`, color: "#fff", outline: "none", fontFamily: FONT }}
          placeholder="Senha"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        {err && <p style={{ fontSize: 11, color: Colors.red, marginBottom: 12, alignSelf: "flex-start" }}>{err}</p>}
        <button
          onClick={login}
          disabled={loading}
          style={{ width: "100%", borderRadius: 10, padding: "12px 0", fontWeight: 700, fontSize: 14, color: "#fff", background: Colors.purple, opacity: loading ? 0.5 : 1, border: "none", cursor: "pointer" }}
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </div>
  );
}

function AppShell({ tab, setTab, session }: { tab: Tab; setTab: (t: Tab) => void; session: any }) {
  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", color: "#fff", background: Colors.bg, position: "relative" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
        {tab === "painel" && <Painel />}
        {tab === "telegram" && <Telegram />}
        {tab === "saques" && <Saques />}
        {tab === "notif" && <Notificacoes />}
      </div>

      {/* TAB BAR */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          background: Colors.bg,
          borderTop: `1px solid ${Colors.border}`,
          paddingBottom: 8,
          paddingTop: 8,
          height: 62,
        }}
      >
        {([
          { k: "painel", label: "Painel", icon: "▦" },
          { k: "telegram", label: "Telegram", icon: "✈" },
          { k: "saques", label: "Saques", icon: "₿" },
          { k: "notif", label: "Alertas", icon: "🔔" },
        ] as const).map(({ k, label, icon }) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 18, color: active ? Colors.purple : Colors.muted }}>{icon}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: active ? Colors.purple : Colors.muted }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TopBar({ showPro = false }: { showPro?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <LogoText />
      {showPro && (
        <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 8, background: "rgba(192,132,252,0.18)" }}>
          <span style={{ color: Colors.purple, fontSize: 12, fontWeight: 700 }}>ZapLynx Pro</span>
        </div>
      )}
    </div>
  );
}

function PageHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: Colors.white, marginBottom: 4 }}>{title}</h1>
      <p style={{ fontSize: 13, color: Colors.muted, marginBottom: 18 }}>{sub}</p>
    </>
  );
}

/* ============== PAINEL ============== */
function Painel() {
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [c, t, total, sent, delivered, failed, phones, txs] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
        supabase.from("message_templates").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }).in("status", ["sent", "delivered"]),
        supabase.from("campaign_sends").select("id", { count: "exact", head: true }).eq("status", "delivered"),
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
        delivered: delivered.count || 0,
        failed: failed.count || 0,
        pixGerado,
        vendaAprovada,
        cpa,
      });
    })();
  }, []);

  if (!d) return <Loading />;

  const stats: Array<[string, string, string]> = [
    ["TOTAL", String(d.total), Colors.blue],
    ["ENVIADAS", String(d.sent), Colors.purple],
    ["ENTREGUES", String(d.delivered), Colors.green],
    ["FALHAS", String(d.failed), Colors.red],
  ];

  return (
    <div style={{ padding: 20 }}>
      <TopBar showPro />
      <PageHeader title="Painel" sub="Visão geral das suas métricas" />

      {/* 2x2 Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <StatCard label="CAMPANHAS" value={String(d.campaigns)} sub="Criadas" color={Colors.purple} />
        <StatCard label="MODELOS" value={String(d.templates)} sub="Templates" color={Colors.blue} />
        <StatCard label="CONTATOS" value={String(d.contacts)} sub="Alcançados" color={Colors.green} />
        <StatCard label="PIX GERADO" value={fmtBRL(d.pixGerado)} sub="Total" color={Colors.green} />
      </div>

      {/* Venda aprovada */}
      <div style={{ ...cardStyle, borderColor: "rgba(96,165,250,0.25)" }}>
        <p style={cardLabelStyle}>VENDA APROVADA</p>
        <p style={{ ...cardBigVal, color: Colors.blue }}>{fmtBRL(d.vendaAprovada)}</p>
      </div>

      {/* CPA */}
      <div style={cardStyle}>
        <p style={cardLabelStyle}>CPA</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <p style={{ ...cardBigVal, color: Colors.white }}>{d.cpa.toFixed(2).replace(".", ",")}</p>
          <p style={{ color: Colors.muted, fontSize: 14 }}>venda / msg</p>
        </div>
      </div>

      {/* 4-stat row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {stats.map(([l, v, c]) => (
          <div key={l} style={miniStat}>
            <p style={miniLabelStyle}>{l}</p>
            <p style={{ ...miniValStyle, color: c }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Volume placeholder */}
      <div style={cardStyle}>
        <p style={cardLabelStyle}>VOLUME DE MENSAGENS</p>
        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10, background: Colors.card2, borderRadius: 10 }}>
          <span style={{ color: Colors.muted, fontSize: 13 }}>Gráfico: Enviadas · Entregues · Erros</span>
        </div>
      </div>
    </div>
  );
}

/* ============== TELEGRAM ============== */
function Telegram() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);
      let bots = 0,
        msgsHoje = 0,
        conversas = 0;
      try {
        const r = await (supabase as any).from("telegram_bots").select("id", { count: "exact", head: true });
        bots = r.count || 0;
      } catch {}
      try {
        const r = await (supabase as any).from("telegram_messages").select("chat_id", { count: "exact" }).gte("created_at", startToday.toISOString());
        msgsHoje = r.count || 0;
        conversas = new Set((r.data || []).map((x: any) => x.chat_id)).size;
      } catch {}
      let bot: any = null;
      try {
        const r = await (supabase as any).from("telegram_bots").select("name,username,is_active").limit(1).maybeSingle();
        bot = r.data;
      } catch {}
      setD({ bots, msgsHoje, conversas, bot });
    })();
  }, []);
  if (!d) return <Loading />;

  return (
    <div style={{ padding: 20 }}>
      <TopBar />
      <PageHeader title="Telegram" sub="Bots e mensagens recebidas" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <StatCard label="BOTS" value={String(d.bots)} sub="Conectados" color={Colors.purple} />
        <StatCard label="MSGS HOJE" value={String(d.msgsHoje)} sub="Recebidas" color={Colors.blue} />
        <StatCard label="CONVERSAS" value={String(d.conversas)} sub="Únicas" color={Colors.teal} />
        <StatCard label="STATUS" value={d.bot?.is_active ? "ATIVO" : "—"} sub="Polling" color={Colors.green} />
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: Colors.white, marginTop: 8, marginBottom: 10 }}>Seus bots</h2>
      {d.bot ? (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: Colors.purple, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{(d.bot.name || "B")[0].toUpperCase()}</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{d.bot.name || "bot"}</p>
            <p style={{ color: Colors.muted, fontSize: 12, marginTop: 2 }}>@{d.bot.username || "—"}</p>
          </div>
          <div style={{ background: "rgba(52,211,153,0.15)", borderRadius: 6, padding: "3px 10px" }}>
            <span style={{ color: Colors.green, fontSize: 11, fontWeight: 600 }}>{d.bot.is_active === false ? "inativo" : "ativo"}</span>
          </div>
        </div>
      ) : (
        <p style={{ color: Colors.muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>Nenhum bot configurado.</p>
      )}
    </div>
  );
}

/* ============== SAQUES ============== */
function Saques() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const [txRes, wdRes] = await Promise.all([
        supabase.from("gateway_transactions").select("id,amount,fee,net,status,created_at").limit(500),
        supabase.from("gateway_withdrawals").select("id,amount,status,created_at").order("created_at", { ascending: false }).limit(50),
      ]);
      const txs = txRes.data || [];
      const wds = wdRes.data || [];
      const isApp = (s: string) => ["approved", "paid", "completed"].includes(s);
      const liquido = txs.filter((t: any) => isApp(t.status)).reduce((s: number, t: any) => s + (t.net || (t.amount - (t.fee || 0))), 0);
      const sacado = wds.filter((w: any) => isApp(w.status)).reduce((s: number, w: any) => s + (w.amount || 0), 0);
      const pend = wds.filter((w: any) => w.status === "pending").reduce((s: number, w: any) => s + (w.amount || 0), 0);
      const saldo = Math.max(0, liquido - sacado - pend);
      setD({ saldo, sacado, pend, totalSaques: wds.length, hist: wds });
    })();
  }, []);
  if (!d) return <Loading />;

  const cards = [
    { label: "Saldo Disponível", value: fmtBRL(d.saldo), color: Colors.green },
    { label: "Total Sacado", value: fmtBRL(d.sacado), color: Colors.blue },
    { label: "Pendente", value: fmtBRL(d.pend), color: Colors.amber },
    { label: "Total de Saques", value: String(d.totalSaques), color: Colors.purple },
  ];

  return (
    <div style={{ padding: 20 }}>
      <TopBar />
      <PageHeader title="Saques" sub="Solicite a transferência do seu saldo via PIX" />

      <button style={{ width: "100%", background: Colors.purple, color: "#fff", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", marginBottom: 16, cursor: "pointer" }}>
        + Solicitar Saque
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ ...cardStyle, marginBottom: 0 }}>
            <p style={{ ...cardLabelStyle, color: Colors.subtext }}>{c.label}</p>
            <p style={{ ...cardBigVal, color: c.color, fontSize: 22 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: Colors.white, marginBottom: 10 }}>Histórico de Saques</h2>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        {d.hist.length === 0 && <p style={{ color: Colors.muted, fontSize: 12, textAlign: "center", padding: 20 }}>Sem saques ainda.</p>}
        {d.hist.map((h: any, i: number) => {
          const ok = ["approved", "paid", "completed"].includes(h.status);
          return (
            <div key={h.id} style={{ display: "flex", alignItems: "center", padding: 14, borderTop: i > 0 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, color: Colors.muted }}>{fmtDateTime(h.created_at)}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginTop: 2 }}>{fmtBRL(h.amount)}</p>
              </div>
              <div style={{ background: ok ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", borderRadius: 6, padding: "4px 10px" }}>
                <span style={{ color: ok ? Colors.green : Colors.red, fontSize: 11, fontWeight: 600 }}>{ok ? "Aprovado" : "Pendente"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============== NOTIFICAÇÕES ============== */
const SLOT_HOURS_BRT = [0, 8, 12, 18];
function brtSlotRange(slotHourBrt: number, dayOffset = 0) {
  const widths: Record<number, number> = { 0: 6, 8: 8, 12: 4, 18: 6 };
  const width = widths[slotHourBrt] ?? 6;
  const nowUtc = new Date(Date.now() - dayOffset * 86400000);
  const brtNow = new Date(nowUtc.getTime() - 3 * 3600000);
  const y = brtNow.getUTCFullYear();
  const m = brtNow.getUTCMonth();
  const d = brtNow.getUTCDate();
  const endBrt = new Date(Date.UTC(y, m, d, slotHourBrt, 0, 0));
  const startBrt = new Date(endBrt.getTime() - width * 3600000);
  const startUtc = new Date(startBrt.getTime() + 3 * 3600000);
  const endUtc = new Date(endBrt.getTime() + 3 * 3600000);
  const labelHour = `${String(slotHourBrt).padStart(2, "0")}:00`;
  const labelDate = `${String(endBrt.getUTCDate()).padStart(2, "0")}/${String(endBrt.getUTCMonth() + 1).padStart(2, "0")}`;
  return { startUtc, endUtc, labelHour, labelDate };
}

function Notificacoes() {
  const [items, setItems] = useState<Array<{ key: string; labelHour: string; labelDate: string; msgs: number; sales: number; amount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    geral: true, cartao: true, boleto: true, pix: true, pixRec: true, apple: true, emitido: false,
  });

  const TOGGLES = [
    { label: "Notificações gerais", key: "geral" },
    { label: "Notificar cartão de crédito", key: "cartao" },
    { label: "Notificar boleto pago", key: "boleto" },
    { label: "Notificar pix pago", key: "pix" },
    { label: "Notificar pix recorrente", key: "pixRec" },
    { label: "Notificar Apple Pay", key: "apple" },
    { label: "Notificar pix/boleto emitido", key: "emitido" },
  ];

  const getVapidPublicKey = async () => {
    const { data, error } = await supabase.functions.invoke("web-push-send", { body: { action: "public-key" } });
    if (error || !(data as any)?.publicKey) throw error || new Error("Push não configurado.");
    return (data as any).publicKey as string;
  };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  const savePushSubscription = async (sub: PushSubscription) => {
    const json = sub.toJSON() as any;
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) throw new Error("Faça login");
    await (supabase as any).from("web_push_subscriptions").upsert(
      {
        user_id: u.user.id,
        endpoint: json.endpoint || sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
  };

  const enablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Seu navegador não suporta push.");
      return;
    }
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const vapidPublicKey = await getVapidPublicKey();
      const reg = await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      await savePushSubscription(sub);
      setPushEnabled(true);
      new Notification("ZapLynx", { body: "Notificações ativadas!" });
    } catch (e: any) {
      alert("Erro: " + (e?.message || e));
    } finally {
      setPushBusy(false);
    }
  };

  const sendTest = async () => {
    setTestBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      await supabase.functions.invoke("web-push-send", {
        body: { user_id: u.user.id, title: "💰 Resumo de teste", body: "Sistema funcionando!", tag: "teste", url: "/preview-app" },
      });
    } finally {
      setTestBusy(false);
    }
  };

  useEffect(() => {
    (async () => {
      const nowUtc = Date.now();
      const slots: Array<ReturnType<typeof brtSlotRange> & { key: string; isFuture: boolean }> = [];
      for (let day = 0; day <= 1; day++) {
        for (const h of SLOT_HOURS_BRT) {
          const r = brtSlotRange(h, day);
          slots.push({ ...r, key: `${day}-${h}`, isFuture: r.endUtc.getTime() > nowUtc });
        }
      }
      slots.sort((a, b) => b.endUtc.getTime() - a.endUtc.getTime());
      const recent = slots.filter((s) => !s.isFuture).slice(0, 4);
      const results = await Promise.all(
        recent.map(async (s) => {
          const [{ count: msgs }, txs] = await Promise.all([
            supabase.from("campaign_sends").select("id", { count: "exact", head: true }).in("status", ["sent", "delivered"]).gte("created_at", s.startUtc.toISOString()).lt("created_at", s.endUtc.toISOString()),
            supabase.from("gateway_transactions").select("amount,status").eq("status", "paid").gte("created_at", s.startUtc.toISOString()).lt("created_at", s.endUtc.toISOString()).limit(1000),
          ]);
          const sales = (txs.data || []).length;
          const amount = (txs.data || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
          return { key: s.key, labelHour: s.labelHour, labelDate: s.labelDate, msgs: msgs || 0, sales, amount };
        })
      );
      setItems(results);
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <TopBar />
      <PageHeader title="Notificações" sub="Resumos às 00h · 08h · 12h · 18h" />

      {/* Hero */}
      <div style={{ background: "#2d1b69", borderRadius: 18, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: Colors.purple, letterSpacing: 1, marginBottom: 6 }}>ATIVAR ALERTAS</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5, marginBottom: 14 }}>
          Receba notificações automáticas a cada janela de resumo (00h, 08h, 12h, 18h — BRT).
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button
            onClick={enablePush}
            disabled={pushBusy}
            style={{ background: Colors.purple, borderRadius: 10, padding: "10px 18px", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", flex: 1 }}
          >
            {pushBusy ? "..." : pushEnabled ? "Push ativo ✓" : "Ativar push"}
          </button>
          <button style={{ background: "rgba(56,189,248,0.15)", borderRadius: 10, padding: "10px 18px", color: Colors.teal, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", flex: 1 }}>
            Telegram
          </button>
        </div>
        <button
          onClick={sendTest}
          disabled={testBusy}
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 10, color: Colors.subtext, fontSize: 13, border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
        >
          {testBusy ? "Enviando..." : "Enviar resumo de teste agora"}
        </button>
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: Colors.white, marginBottom: 10 }}>Configurações</h2>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden", marginBottom: 20 }}>
        {TOGGLES.map((t, i) => (
          <div key={t.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <span style={{ fontSize: 14, color: "#fff" }}>{t.label}</span>
            <Toggle on={toggles[t.key]} onChange={() => setToggles((p) => ({ ...p, [t.key]: !p[t.key] }))} />
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 700, color: Colors.white, marginBottom: 10 }}>Resumos recentes</h2>
      {loading && <p style={{ color: Colors.muted, fontSize: 12, textAlign: "center", padding: 20 }}>Carregando…</p>}
      {!loading && items.length === 0 && <p style={{ color: Colors.muted, fontSize: 12, textAlign: "center", padding: 20 }}>Sem resumos.</p>}
      {!loading &&
        items.map((it) => (
          <div key={it.key} style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Resumo das {it.labelHour}</span>
              <span style={{ fontSize: 12, color: Colors.muted }}>{it.labelDate}</span>
            </div>
            <div style={{ display: "flex", gap: 36 }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: Colors.muted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>MSGS</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{it.msgs}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: Colors.muted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>VENDAS</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: Colors.green }}>{it.sales}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, color: Colors.muted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>PIX</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: Colors.blue }}>{fmtBRL(it.amount)}</p>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

/* ============== HELPERS ============== */
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: Colors.card, borderRadius: 16, border: `1px solid ${Colors.border}`, padding: 16 }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: Colors.muted, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: value.length > 8 ? 20 : 26, fontWeight: 700, color, marginBottom: 2 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: Colors.muted }}>{sub}</p>}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: Colors.card,
  borderRadius: 16,
  border: `1px solid ${Colors.border}`,
  padding: 16,
  marginBottom: 12,
};
const cardLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: Colors.muted,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  marginBottom: 8,
};
const cardBigVal: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
};
const miniStat: React.CSSProperties = {
  flex: 1,
  background: Colors.card,
  borderRadius: 12,
  border: `1px solid ${Colors.border}`,
  padding: 10,
};
const miniLabelStyle: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 700,
  color: Colors.muted,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  marginBottom: 4,
};
const miniValStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
};

function Loading() {
  return <div style={{ padding: 40, textAlign: "center", color: Colors.muted, fontSize: 13 }}>Carregando…</div>;
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        background: on ? Colors.purple : Colors.card2,
        border: "none",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.18s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.18s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}
