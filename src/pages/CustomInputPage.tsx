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
  DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function CustomInputPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("painel");
  const { enablePush, pushEnabled, permissionStatus, pushBusy } = useWebPush();
  const navigate = useNavigate();

  // Auth state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Stats data
  const [stats, setStats] = useState({
    campaigns: 3,
    templates: 8,
    contacts: 1,
    totalRevenue: 9927.71,
    approvedSale: 1005.90,
    cpa: 4.67
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        toast.error(error.message.includes("Invalid login credentials") ? "E-mail ou senha incorretos" : error.message);
        return;
      }
      toast.success("Bem-vindo de volta!");
    } catch (err: any) {
      toast.error("Erro ao fazer login");
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
          url: window.location.origin + "/notificacoes-realtime",
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
          <img src="/images/auth-logo.png" alt="ZapLynx" className="h-10 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-white mb-2 tracking-tight">Bem-vindo de volta</h1>
          <p className="text-slate-500 text-sm">Entre na sua conta para gerenciar suas notificações</p>
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

          <p className="text-center text-purple-400 text-xs font-semibold cursor-pointer hover:underline">Esqueci minha senha</p>
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
            <div className="w-8 h-8 rounded-lg bg-[#1e2130] flex items-center justify-center">
              <Bell className="w-4 h-4 text-slate-500" />
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
              {session.user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {activeTab === "painel" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex gap-1.5 mb-4">
              <div className="text-[11px] px-3 py-1 bg-purple-500/15 text-purple-400 rounded-lg font-bold">ZapLynx Pro</div>
              <div className="text-[11px] px-3 py-1 bg-[#1e2130] text-slate-500 rounded-lg font-bold">Semana</div>
              <div className="text-[11px] px-3 py-1 bg-[#1e2130] text-slate-500 rounded-lg font-bold">Mês</div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Painel</h2>
              <p className="text-xs text-slate-500 mt-0.5">Visão geral das suas métricas</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#161820] border border-white/5 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Campanhas</p>
                <p className="text-3xl font-black text-purple-400">{stats.campaigns}</p>
                <p className="text-[10px] text-slate-600 mt-1">Criadas</p>
              </div>
              <div className="bg-[#161820] border border-white/5 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Modelos</p>
                <p className="text-3xl font-black text-blue-400">{stats.templates}</p>
                <p className="text-[10px] text-slate-600 mt-1">Templates</p>
              </div>
              <div className="bg-[#161820] border border-white/5 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contatos</p>
                <p className="text-3xl font-black text-emerald-400">{stats.contacts}</p>
                <p className="text-[10px] text-slate-600 mt-1">Alcançados</p>
              </div>
              <div className="bg-[#161820] border border-white/5 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Pix Gerado</p>
                <p className="text-lg font-black text-emerald-400 mt-1">R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-slate-600 mt-1">Total gerado</p>
              </div>
            </div>

            <div className="bg-[#161820] border border-blue-500/20 rounded-2xl p-4">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Venda aprovada</p>
              <p className="text-3xl font-black text-blue-400">R$ {stats.approvedSale.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>

            <div className="bg-[#161820] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">CPA</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">{stats.cpa.toFixed(2).replace('.', ',')}</span>
                  <span className="text-[11px] text-slate-600 font-medium">venda / msg</span>
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
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => testNotif('Venda Aprovada', 'R$ 297,00')}
                      className="bg-purple-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs active:scale-[0.95] transition-all"
                    >
                      <TrendingUp className="w-3.5 h-3.5" /> Venda
                    </button>
                    <button 
                      onClick={() => testNotif('Nova Mensagem', 'Cliente aguardando link')}
                      className="bg-sky-500/20 text-sky-400 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs active:scale-[0.95] transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Mensagem
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-black text-white tracking-tight">Relatórios</h2>
            <p className="text-xs text-slate-500 mt-0.5">Histórico detalhado de atividade</p>
            
            <div className="bg-[#161820] border border-white/5 rounded-2xl p-5 text-center space-y-3">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <PieChart className="w-6 h-6 text-slate-700" />
              </div>
              <p className="text-sm font-bold text-white">Nenhum dado recente</p>
              <p className="text-xs text-slate-500 px-4">Relatórios automáticos de vendas e conversões aparecerão aqui conforme o uso.</p>
            </div>
          </div>
        )}

        {activeTab === "wallet" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-black text-white tracking-tight">Financeiro</h2>
            <button className="w-full bg-purple-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-all mb-6">
              <DollarSign className="w-4 h-4" /> Solicitar Saque
            </button>

            <h3 className="text-base font-bold text-white mb-2">Últimas Movimentações</h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-[10px] text-slate-600 mb-1 uppercase font-bold tracking-widest">Hoje, 14:22</p>
                  <p className="text-sm font-bold text-white">R$ 1.005,90</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Comissão - Venda Aprovada</p>
                </div>
                <div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">Pago</div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                  <p className="text-[10px] text-slate-600 mb-1 uppercase font-bold tracking-widest">Ontem, 09:15</p>
                  <p className="text-sm font-bold text-white">R$ 247,00</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Comissão - Venda Aprovada</p>
                </div>
                <div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">Pago</div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Navigation */}
      <div className="h-20 bg-[#0f1117] border-t border-white/5 flex items-center justify-around px-2 relative z-50">
        {[
          { id: "painel", icon: LayoutDashboard, label: "Painel" },
          { id: "reports", icon: PieChart, label: "Relatórios" },
          { id: "wallet", icon: Wallet, label: "Saques" },
          { id: "bot", icon: Bot, label: "Telegram" },
          { id: "settings", icon: Settings, label: "Ajustes" },
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
