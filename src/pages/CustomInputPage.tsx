import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Bell, 
  Mail, 
  Lock, 
  Loader2, 
  ArrowLeft,
  CheckCircle2,
  Smartphone,
  Zap,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

export default function CustomInputPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        setNotifications([
          { id: 1, title: 'Conexão Ativa', message: 'Instância iPhone 13 conectada.', type: 'success', created_at: new Date().toISOString() },
          { id: 2, title: 'Venda Aprovada', message: 'Pagamento de R$ 297,00 via Pix recebido.', type: 'sale', created_at: new Date(Date.now() - 300000).toISOString() }
        ]);
      }
    };
    getSession();

    const timer = setInterval(() => {
      if (Math.random() > 0.7) {
        const types = ['sale', 'message', 'system'];
        const type = types[Math.floor(Math.random() * types.length)];
        let title = 'Sistema';
        let message = 'Nova atualização.';
        if (type === 'sale') { title = 'Nova Venda'; message = `Pix recebido: R$ ${(Math.random() * 100).toFixed(2)}`; }
        else if (type === 'message') { title = 'WhatsApp'; message = 'Nova mensagem recebida.'; }

        const newNotif = { id: Date.now(), title, message, type, created_at: new Date().toISOString() };
        setNotifications(prev => [newNotif, ...prev].slice(0, 6));
        toast({ title, description: message });
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast({ title: "Sincronização Ativa", description: "Monitorando eventos." });
      setUser(data.user);
    } catch (error: any) {
      toast({ title: "Erro de Acesso", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-4 md:p-8 flex flex-col items-center font-sans">
      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="w-full max-w-5xl space-y-8 relative z-10">
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" className="text-gray-400 hover:text-white" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-white/5">
            <Smartphone className="h-4 w-4 text-purple-400" /><span className="text-xs font-bold uppercase tracking-widest">ZapLynx Pro</span>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-6">
            <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-white/50">Monitor Realtime</h1>
            <Card className="bg-[#161820] border-white/5 shadow-2xl">
              <CardHeader><CardTitle className="text-xl">Identificação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-gray-400">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                      <Input type="email" placeholder="admin@zaplynx.com" className="bg-[#1e2130] border-white/5 pl-10 h-12 text-white" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-gray-400">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                      <Input type="password" placeholder="••••••••" className="bg-[#1e2130] border-white/5 pl-10 h-12 text-white" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 bg-purple-500 hover:bg-purple-600 text-white font-black" disabled={loading}>{loading ? <Loader2 className="animate-spin h-5 w-5" /> : "SINCRONIZAR"}</Button>
                </form>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold flex items-center gap-2"><Bell className="h-5 w-5 text-purple-400" /> Feed Ao Vivo</h2><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500 animate-ping" /><span className="text-[10px] font-black uppercase text-purple-400">Live</span></div></div>
            <div className="grid gap-3">
              {notifications.map((notif, index) => (
                <div key={notif.id || index} className="bg-[#161820] border border-white/5 p-4 rounded-2xl flex gap-4 items-center">
                  <div className={`p-3 rounded-xl ${notif.type === 'sale' ? 'bg-green-500/10 text-green-400' : notif.type === 'message' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {notif.type === 'sale' ? <TrendingUp size={20} /> : notif.type === 'message' ? <MessageSquare size={20} /> : <Zap size={20} />}
                  </div>
                  <div className="flex-1 min-w-0"><div className="flex items-center justify-between mb-0.5"><p className="text-sm font-black truncate">{notif.title}</p><span className="text-[10px] text-gray-500">{new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><p className="text-xs text-gray-400 line-clamp-1">{notif.message}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
