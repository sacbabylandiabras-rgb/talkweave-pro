import { useState, useEffect, useCallback } from "react";
import { useWebPush } from "@/hooks/useWebPush";
import { supabase } from "@/integrations/supabase/client";
 import { 
   Bell, 
   TrendingUp, 
   Zap, 
   Loader2, 
   Send, 
   LayoutDashboard, 
   PieChart,
   Wallet,
   Bot,
   Settings,
   Eye,
   EyeOff,
   Mail,
   Lock,
   User,
   Smartphone,
   ChevronRight,
   CheckCircle2,
   MessageSquare,
   Clock,
   DollarSign,
   ChevronDown
 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

 export default function CustomInputPage() {
   const SLOTS = [0, 8, 12, 16.5, 18];
 
   function formatBRL(cents: number) {
     return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
   }
 
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
   const [activeTab, setActiveTab] = useState("painel");
   const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("hoje");
  const { enablePush, pushEnabled, permissionStatus, pushBusy } = useWebPush();
  const navigate = useNavigate();

  // Auth state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

   const [stats, setStats] = useState({
     campaigns: 0,
     templates: 0,
     contacts: 0,
     totalRevenue: 0,
     approvedSale: 0,
     cpa: 0
   });
   const [summaries, setSummaries] = useState<{ slot: number; total: number; count: number; messages: number; date: string }[]>([]);
   const [prefs, setPrefs] = useState({
     enabled: true,
     notify_credit_card: true,
     notify_boleto_paid: true,
     notify_pix_paid: true,
     notify_pix_recurring: true,
     notify_apple_pay: true,
     notify_pix_or_boleto_issued: true,
   });
   const [savingPrefs, setSavingPrefs] = useState(false);

   const fetchStats = useCallback(async (userId: string, periodArg: "hoje" | "semana" | "mes" = "hoje") => {
     try {
       const start = new Date();
       start.setHours(0, 0, 0, 0);
       if (periodArg === "semana") {
         start.setDate(start.getDate() - 7);
       } else if (periodArg === "mes") {
         start.setDate(start.getDate() - 30);
       }
      const startIso = start.toISOString();

      // Campanhas, Modelos (ativos), Preferências
      const [campRes, tempRes, prefsRes] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startIso),
        supabase.from("message_templates").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("active", true),
        (supabase as any).from("notification_preferences").select("*").eq("user_id", userId).is("checkout_id", null).maybeSingle(),
      ]);

      // Contatos: telefones únicos de campaign_sends (paginado)
      let allPhones: string[] = [];
      let cFrom = 0;
      const cPage = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("campaign_sends")
          .select("phone")
          .eq("user_id", userId)
          .gte("created_at", startIso)
          .range(cFrom, cFrom + cPage - 1);
        if (error || !data || data.length === 0) break;
        allPhones = allPhones.concat(data.map((s: any) => s.phone).filter(Boolean));
        if (data.length < cPage) break;
        cFrom += cPage;
      }
      const contactsCount = new Set(allPhones).size;

      // Receita: gateway_transactions + external_gateway_events (paginado)
      let pixGenerated = 0;
      let approved = 0;
      let approvedCount = 0;
      let gFrom = 0;
      while (true) {
        const { data, error } = await supabase
          .from("gateway_transactions")
          .select("amount, status, created_at")
          .eq("user_id", userId)
          .gte("created_at", startIso)
          .range(gFrom, gFrom + cPage - 1);
        if (error || !data || data.length === 0) break;
        for (const t of data as any[]) {
          pixGenerated += t.amount || 0;
          if (["approved", "paid", "completed"].includes(t.status)) {
            approved += t.amount || 0;
            approvedCount += 1;
          }
        }
        if (data.length < cPage) break;
        gFrom += cPage;
      }
      let eFrom = 0;
      while (true) {
        const { data, error } = await (supabase as any)
          .from("external_gateway_events")
          .select("amount, status, created_at")
          .eq("user_id", userId)
          .gte("created_at", startIso)
          .range(eFrom, eFrom + cPage - 1);
        if (error || !data || data.length === 0) break;
        for (const t of data as any[]) {
          pixGenerated += t.amount || 0;
          if (["approved", "paid", "completed"].includes(t.status)) {
            approved += t.amount || 0;
            approvedCount += 1;
          }
        }
        if (data.length < cPage) break;
        eFrom += cPage;
      }

      // Mensagens enviadas para CPA
      const { count: msgCount } = await supabase
        .from("campaign_sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("status", ["sent", "delivered", "read"])
        .gte("created_at", startIso);

      const cpaRatio = approvedCount && approvedCount > 0 ? msgCount / approvedCount : 0;

      setStats({
        campaigns: campRes.count || 0,
        templates: tempRes.count || 0,
        contacts: contactsCount,
        totalRevenue: pixGenerated / 100,
        approvedSale: approved / 100,
        cpa: cpaRatio,
      });
 
      const data: any = prefsRes.data;
      if (data) {
        setPrefs({
          enabled: !!data.enabled,
          notify_credit_card: !!data.notify_credit_card,
          notify_boleto_paid: !!data.notify_boleto_paid,
          notify_pix_paid: !!data.notify_pix_paid,
          notify_pix_recurring: !!data.notify_pix_recurring,
          notify_apple_pay: !!data.notify_apple_pay,
          notify_pix_or_boleto_issued: !!data.notify_pix_or_boleto_issued,
        });
      }

      // Carrega resumos por slot baseados em transações + mensagens do período
      const { data: txData } = await supabase
        .from("gateway_transactions")
        .select("amount, created_at, status")
        .eq("user_id", userId)
        .in("status", ["paid", "approved", "completed"])
        .gte("created_at", startIso);
      const { data: msgData } = await supabase
        .from("campaign_sends")
        .select("sent_at")
        .eq("user_id", userId)
        .gte("sent_at", startIso);
      const tx = txData || [];
      const msgs = msgData || [];
       const todayStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
       const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
 
       const list = SLOTS.filter(s => s <= currentHour).reverse().map(s => {
         const sortedSlots = [...SLOTS].sort((a, b) => a - b);
         const idx = sortedSlots.indexOf(s);
         const prevS = idx > 0 ? sortedSlots[idx - 1] : -1;
         
         const slotMsgs = msgs.filter((m: any) => {
           const date = new Date(m.sent_at);
           const h = date.getHours() + date.getMinutes() / 60;
           return h >= prevS && h < s;
         }).length;
 
         const slotSales = tx.filter((t: any) => {
           const date = new Date(t.created_at);
           const h = date.getHours() + date.getMinutes() / 60;
           return h < s;
         });
 
         const total = slotSales.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
 
         return {
           slot: s,
           total: total,
           count: slotSales.length,
           messages: slotMsgs,
           date: todayStr,
         };
       });
       setSummaries(list);
     } catch (error) {
       console.error("Error fetching stats:", error);
     }
    }, []);

   useEffect(() => {
     if (session?.user?.id) fetchStats(session.user.id, period);
   }, [period, session?.user?.id, fetchStats]);
  const togglePref = async (key: keyof typeof prefs, value: boolean) => {
    if (!session?.user?.id) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSavingPrefs(true);
    
    try {
      // First try to find if it exists
      const { data: existing } = await supabase
        .from("notification_preferences")
        .select("id")
        .eq("user_id", session.user.id)
        .is("checkout_id", null)
        .maybeSingle();

      let error;
      if (existing) {
        const { error: updateError } = await supabase
          .from("notification_preferences")
          .update({ ...next, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: session.user.id, checkout_id: null, ...next });
        error = insertError;
      }

      if (error) throw error;
      toast.success("Preferências salvas!");
    } catch (error: any) {
      console.error("Error saving prefs:", error);
      toast.error("Erro ao salvar: " + error.message);
      // Revert local state on error
      setPrefs(prefs);
    } finally {
      setSavingPrefs(false);
    }
  };
 

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) fetchStats(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [fetchStats]);

  useEffect(() => {
    const manifestId = "zaplynx-app-manifest";
    document.querySelector(`link#${manifestId}`)?.remove();

    if (!session?.user?.id) return;

    const manifest = document.createElement("link");
    manifest.id = manifestId;
    manifest.rel = "manifest";
    manifest.href = "/manifest.json";
    document.head.appendChild(manifest);

    return () => manifest.remove();
  }, [session?.user?.id]);

   const handleLogin = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!email.trim() || !password) {
       toast.error("Preencha todos os campos");
       return;
     }
     
     setAuthLoading(true);
     try {
       const { data, error } = await supabase.auth.signInWithPassword({ 
         email: email.trim(), 
         password 
       });

       if (error) {
         console.error("Login error:", error);
         toast.error(error.message.includes("Invalid login credentials") ? "E-mail ou senha incorretos" : error.message);
         return;
       }

       if (data.user) {
         const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).single();
         if (profile && !profile.is_active) {
           await supabase.auth.signOut();
           toast.error("Sua conta está desativada. Entre em contato com o suporte.");
           return;
         }
       }

       toast.success("Bem-vindo de volta!");
     } catch (err: any) {
       console.error("Auth exception:", err);
       toast.error("Erro ao fazer login: " + (err.message || "tente novamente"));
     } finally {
       setAuthLoading(false);
     }
   };

  const handleEnablePush = async () => {
    try {
      await enablePush();
      toast.success("Notificações ativadas!");
    } catch (err: any) {
      console.error("Erro ao ativar push:", err);
      toast.error(err.message || "Erro ao ativar notificações");
    }
  };

  const testNotif = async (title: string, body: string) => {
    if (!session?.user?.id) return;
    toast.info(`Enviando teste: ${title}`);
    try {
      const { error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_id: session.user.id,
          title,
          body,
          url: window.location.origin + "/aplicativo",
          event_type: "test"
        }
      });
      if (error) throw error;
      toast.success("Notificação enviada!");
    } catch (e: any) {
      toast.error("Erro ao enviar notificação: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0f1117] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="fixed inset-0 bg-[#0f1117] flex flex-col items-center justify-center px-8">
        <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="mb-10 text-center">
          <img src="/images/auth-logo.png" alt="ZapLynx" className="h-10 w-auto object-contain mx-auto mb-6" />
            <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Bem-vindo de volta</h1>
           <p className="text-slate-500 text-sm text-center">Acesse sua conta para gerenciar<br/>campanhas, bots e saques.</p>
        </div>

        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="email" 
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#161820] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 outline-none focus:border-purple-500/50 transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#161820] border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-slate-600 outline-none focus:border-purple-500/50 transition-colors"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button 
            disabled={authLoading}
            className="w-full bg-gradient-to-br from-purple-500 to-purple-700 text-white font-bold py-4 rounded-2xl shadow-[0_8px_32px_rgba(168,85,247,0.3)] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar na conta"}
          </button>

          <div className="flex items-center gap-4 py-2">
            <div className="h-[1px] flex-1 bg-white/5" />
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">ou</span>
            <div className="h-[1px] flex-1 bg-white/5" />
          </div>

           <div className="flex flex-col gap-4 text-center">
             <p className="text-purple-400 text-xs font-semibold cursor-pointer hover:underline">Esqueci minha senha</p>
             <p className="text-slate-400 text-xs font-medium">
               Não tem uma conta?{" "}
               <span 
                 onClick={() => navigate("/auth?signup=true")}
                 className="text-purple-400 cursor-pointer hover:underline font-bold"
               >
                 Crie uma conta aqui
               </span>
             </p>
             <p className="text-slate-500 text-[10px] mt-2">
               Problemas com o login?{" "}
               <span 
                 onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
                 className="text-purple-400 cursor-pointer hover:underline font-bold"
               >
                 Fale com o suporte
               </span>
             </p>
           </div>
        </form>

        <p className="mt-12 text-slate-600 text-[11px] text-center leading-relaxed">
          Ao entrar, você concorda com nossos <br />
          <span className="text-purple-400 cursor-pointer">Termos de Serviço</span> e <span className="text-purple-400 cursor-pointer">Política de Privacidade</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0f1117] flex flex-col max-w-[430px] mx-auto overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24 scrollbar-hide">
        
        {/* Topbar */}
        <div className="flex items-center justify-between mb-8">
          <img src="/images/auth-logo.png" alt="ZapLynx" className="h-6" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("avisos")}
              className="w-8 h-8 rounded-lg bg-[#1e2130] flex items-center justify-center active:scale-95 transition-transform"
            >
              <Bell className="w-4 h-4 text-slate-500" />
            </button>
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
              {session.user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {activeTab === "painel" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex gap-1.5 mb-4">
              <button
                onClick={() => setPeriod("hoje")}
                className={`text-[11px] px-3 py-1 rounded-lg font-bold transition-colors ${period === "hoje" ? "bg-purple-500/15 text-purple-400" : "bg-[#1e2130] text-slate-500"}`}
              >
                Hoje
              </button>
              <button
                onClick={() => setPeriod("semana")}
                className={`text-[11px] px-3 py-1 rounded-lg font-bold transition-colors ${period === "semana" ? "bg-purple-500/15 text-purple-400" : "bg-[#1e2130] text-slate-500"}`}
              >
                Semana
              </button>
              <button
                onClick={() => setPeriod("mes")}
                className={`text-[11px] px-3 py-1 rounded-lg font-bold transition-colors ${period === "mes" ? "bg-purple-500/15 text-purple-400" : "bg-[#1e2130] text-slate-500"}`}
              >
                Mês
              </button>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Painel</h2>
              <p className="text-xs text-slate-500 mt-0.5">Visão geral das suas métricas</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-left bg-[#161820] border border-white/5 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Campanhas</p>
                <p className="text-3xl font-black text-purple-400">{stats.campaigns}</p>
                <p className="text-[10px] text-slate-600 mt-1">Criadas</p>
              </div>
              <div className="text-left bg-[#161820] border border-white/5 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Modelos</p>
                <p className="text-3xl font-black text-blue-400">{stats.templates}</p>
                <p className="text-[10px] text-slate-600 mt-1">Templates</p>
              </div>
              <div className="text-left bg-[#161820] border border-white/5 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contatos</p>
                <p className="text-3xl font-black text-emerald-400">{stats.contacts}</p>
                <p className="text-[10px] text-slate-600 mt-1">Alcançados</p>
              </div>
              <div className="text-left bg-[#161820] border border-white/5 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Pix Gerado</p>
                <p className="text-lg font-black text-emerald-400 mt-1">R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-slate-600 mt-1">Total gerado</p>
              </div>
            </div>

            <div className="w-full text-left bg-[#161820] border border-blue-500/20 rounded-2xl p-4">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Venda aprovada</p>
              <p className="text-3xl font-black text-blue-400">R$ {stats.approvedSale.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="w-full bg-[#161820] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">CPA</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">{stats.cpa.toFixed(2).replace('.', ',')}</span>
                  <span className="text-[11px] text-slate-600 font-medium">msg / venda</span>
                </div>
              </div>
            </div>

            {/* Push Status / Action */}
            <div className="bg-gradient-to-br from-[#2d1b69] to-[#1a1040] border border-purple-500/20 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Bell className="w-16 h-16 text-purple-400" />
              </div>
              <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-1.5">Ações Rápidas</p>
              <p className="text-xs text-white/70 leading-relaxed mb-4">
                {pushEnabled ? "Sistema de notificações ativo no seu dispositivo!" : "Teste o sistema de notificações enviando alertas de demonstração."}
              </p>
              
              <div className="flex flex-col gap-2">
                {!pushEnabled ? (
                  <button 
                    onClick={handleEnablePush}
                    disabled={pushBusy}
                    className="w-full bg-purple-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-all"
                  >
                    {pushBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                    Ativar Notificações Realtime
                  </button>
                ) : (
                  <button
                    onClick={() => testNotif("Relatório Atualizado ✅", `Vendas: ${formatBRL(stats.totalRevenue * 100)} (Vendas hoje)\nEnviadas: ${stats.campaigns.toLocaleString("pt-BR")}`)}
                    className="w-full bg-purple-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all"
                  >
                    <Send className="w-4 h-4" /> Enviar Relatório de Teste
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

         {activeTab === "avisos" && (
           <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
             <button
               onClick={handleEnablePush}
               disabled={pushBusy || pushEnabled}
               className="w-full rounded-2xl py-4 px-5 flex items-center justify-center gap-3 font-semibold text-white shadow-lg transition-opacity disabled:opacity-70"
               style={{ background: "linear-gradient(135deg, hsl(270 95% 65%), hsl(270 95% 45%))" }}
             >
               {pushBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
               {pushEnabled ? "Notificações Ativadas" : "Ativar Notificações Reais"}
             </button>

              <div className="space-y-2">
                <button
                  onClick={() => testNotif("Relatório Atualizado ✅", `Vendas: ${formatBRL(stats.totalRevenue * 100)} (Vendas hoje)\nEnviadas: ${stats.campaigns.toLocaleString("pt-BR")}`)}
                  disabled={!session?.user?.id}
                  className="w-full rounded-2xl py-4 px-5 flex items-center justify-center gap-3 font-semibold text-purple-400 border border-purple-500/30 bg-purple-500/5 active:bg-purple-500/10 transition-colors disabled:opacity-50"
                >
                  <Send className="w-5 h-5" /> Enviar Notificação de Teste
                </button>
                <p className="text-[10px] text-center text-slate-500 font-medium px-4">
                  Clique acima para testar o novo modelo de relatório
                </p>
              </div>

             <div className="bg-[#161820] border border-white/5 rounded-2xl overflow-hidden">
               <div className="flex items-center justify-between px-5 py-4">
                 <span className="font-bold text-white text-base">Notificações</span>
                 <div
                   onClick={() => togglePref("enabled", !prefs.enabled)}
                   className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${prefs.enabled ? 'bg-purple-500' : 'bg-slate-700'} ${savingPrefs ? 'opacity-50 pointer-events-none' : ''}`}
                 >
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${prefs.enabled ? 'left-6' : 'left-1'}`} />
                 </div>
               </div>

               <div className="px-5 py-3 flex items-center gap-1 text-slate-500 text-sm border-t border-white/5">
                 Todos os checkouts (padrão) <ChevronDown className="w-3 h-3" />
               </div>

               {[
                 { key: "notify_credit_card", label: "Notificar cartão de crédito" },
                 { key: "notify_boleto_paid", label: "Notificar boleto pago" },
                 { key: "notify_pix_paid", label: "Notificar pix pago" },
                 { key: "notify_pix_recurring", label: "Notificar pix recorrente" },
                 { key: "notify_apple_pay", label: "Notificar Apple Pay" },
                 { key: "notify_pix_or_boleto_issued", label: "Notificar pix ou boleto emitido" },
               ].map((item) => (
                 <div key={item.key} className="flex items-center justify-between px-5 py-4 border-t border-white/5">
                   <span className={`text-sm ${!prefs.enabled ? "text-slate-600" : "text-white/90"}`}>{item.label}</span>
                   <div
                     onClick={() => prefs.enabled && togglePref(item.key as any, !prefs[item.key as keyof typeof prefs])}
                     className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${prefs[item.key as keyof typeof prefs] && prefs.enabled ? 'bg-purple-500' : 'bg-slate-700'} ${!prefs.enabled || savingPrefs ? 'opacity-40 cursor-not-allowed' : ''}`}
                   >
                     <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${prefs[item.key as keyof typeof prefs] && prefs.enabled ? 'left-6' : 'left-1'}`} />
                   </div>
                 </div>
               ))}
             </div>

             <div>
               <h3 className="font-bold text-white text-lg mb-2">Como funciona</h3>
               <div className="rounded-2xl border border-white/5 bg-[#161820] p-4">
                 <p className="text-slate-400 text-sm leading-relaxed">
                   Você recebe um relatório automático com o resumo de mensagens enviadas e vendas
                   hoje via push e Telegram nos horários: 08:00, 12:00, 16:30, 18:00 e 00:00.
                 </p>
               </div>
             </div>

             <div>
               <h3 className="font-bold text-white text-lg mb-2">Resumos recentes</h3>
               {summaries.length === 0 ? (
                 <div className="rounded-2xl border border-white/5 bg-[#161820] p-6 text-center text-slate-600 text-sm">
                   Os resumos aparecerão aqui ao longo do dia.
                 </div>
               ) : (
                 <div className="space-y-2">
                   {summaries.map(s => (
                     <div key={s.slot} className="rounded-2xl border border-white/5 bg-[#161820] px-4 py-3 flex items-center gap-3">
                       <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-white text-sm font-semibold">
                              Relatório das {s.slot === 16.5 ? "16:30" : `${String(Math.floor(s.slot)).padStart(2, "0")}:00`}
                            </p>
                            <span className="text-emerald-400 text-[10px] font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              Enviado
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3 text-emerald-400" />
                              <p className="text-slate-300 text-xs font-medium">
                                Vendas: <span className="text-white">{formatBRL(s.total)}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-blue-400" />
                              <p className="text-slate-300 text-xs font-medium">
                                Enviadas: <span className="text-white">{s.messages.toLocaleString("pt-BR")}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                       <span className="text-slate-600 text-xs shrink-0">{s.date}</span>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             <div
               onClick={() => supabase.auth.signOut()}
               className="bg-[#161820] border border-white/5 rounded-2xl p-4 flex items-center justify-between active:bg-white/5 transition-colors cursor-pointer mt-4"
             >
               <p className="text-sm font-bold text-red-400">Sair da Conta</p>
               <ChevronRight className="w-4 h-4 text-slate-700" />
             </div>
           </div>
         )}

        {activeTab === "bot" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-black text-white tracking-tight">Telegram</h2>
            <p className="text-xs text-slate-500 mt-0.5">Conecte seu bot de notificações</p>
            
            <div className="bg-[#161820] border border-white/5 rounded-2xl p-5 text-center">
              <div className="w-12 h-12 bg-sky-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot className="w-6 h-6 text-sky-400" />
              </div>
              <p className="text-sm font-bold text-white mb-2">Bot não configurado</p>
              <p className="text-xs text-slate-500 mb-4 px-4">Conecte seu bot para receber alertas também no Telegram.</p>
              <button onClick={() => navigate("/telegram/criar-bot")} className="bg-sky-500/20 text-sky-400 text-xs font-bold py-2.5 px-6 rounded-xl active:scale-[0.98] transition-all">
                Configurar Bot
              </button>
            </div>
          </div>
        )}

        {activeTab === "wallet" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-black text-white tracking-tight">Financeiro</h2>
            <button onClick={() => navigate("/gateway-checkout/withdrawals")} className="w-full bg-purple-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-all mb-6">
              <DollarSign className="w-4 h-4" /> Solicitar Saque
            </button>

            <h3 className="text-base font-bold text-white mb-2">Últimas Movimentações</h3>
            <div className="rounded-2xl border border-white/5 bg-[#161820] p-6 text-center text-slate-600 text-sm">
              Suas movimentações de saque aparecerão aqui.
            </div>
          </div>
        )}

      </div>

       {/* Navigation */}
       <div className="h-20 bg-[#0f1117] border-t border-white/5 flex items-center justify-around px-2 relative z-50">
         {[
           { id: "painel", icon: LayoutDashboard, label: "Painel" },
           { id: "bot", icon: Send, label: "Telegram" },
           { id: "wallet", icon: Wallet, label: "Saques" },
           { id: "avisos", icon: Bell, label: "Avisos" },
         ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
              activeTab === item.id ? "text-purple-500" : "text-slate-600"
            }`}
          >
            <item.icon className={`w-5 h-5 ${activeTab === item.id ? "stroke-[2.5px]" : "stroke-[2px]"}`} />
            <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
            {activeTab === item.id && <div className="w-1 h-1 bg-purple-500 rounded-full mt-0.5 animate-in zoom-in" />}
          </button>
        ))}
      </div>
    </div>
  );
}
