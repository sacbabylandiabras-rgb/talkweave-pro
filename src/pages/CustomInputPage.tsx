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
  AlertCircle,
  Smartphone,
  Zap,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

/**
 * CustomInputPage - Versão integrada com Design System e Layout Realtime.
 * Utiliza tokens semânticos (--background, --primary, etc) do tailwind.config.ts.
 */
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
        // Mock inicial baseado no dashboard mobile
        setNotifications([
          { id: 1, title: 'Conexão Ativa', message: 'Instância iPhone 13 conectada com sucesso.', type: 'success', created_at: new Date().toISOString() },
          { id: 2, title: 'Venda Aprovada', message: 'Pagamento de R$ 297,00 via Pix recebido.', type: 'sale', created_at: new Date(Date.now() - 300000).toISOString() }
        ]);
      }
    };
    getSession();

    // Simulação de eventos em tempo real para paridade visual com o app mobile
    const timer = setInterval(() => {
      if (Math.random() > 0.7) {
        const types = ['sale', 'message', 'system'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let title = 'Sistema';
        let message = 'Nova atualização recebida.';
        
        if (type === 'sale') {
          title = 'Nova Venda';
          message = `Pix recebido: R$ ${(Math.random() * 100).toFixed(2)}`;
        } else if (type === 'message') {
          title = 'WhatsApp';
          message = 'Nova mensagem de cliente recebida.';
        }

        const newNotif = {
          id: Date.now(),
          title,
          message,
          type,
          created_at: new Date().toISOString()
        };
        
        setNotifications(prev => [newNotif, ...prev].slice(0, 6));
        
        toast({
          title: title,
          description: message,
        });
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      toast({
        title: "Sincronização Ativa",
        description: "Login realizado. Monitorando eventos em tempo real.",
      });
      
      setUser(data.user);
    } catch (error: any) {
      toast({
        title: "Erro de Acesso",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex flex-col items-center">
      {/* Glow Effect de fundo similar ao mobile */}
      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="w-full max-w-5xl space-y-8 relative z-10">
        {/* Top Navigation */}
        <div className="flex items-center justify-between w-full">
          <Button 
            variant="ghost" 
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Home
          </Button>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border">
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold tracking-widest uppercase">ZapLynx Pro</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Lado Esquerdo: Login/Form (40%) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/50">
                Monitor Realtime
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                Conecte sua conta para transformar este painel em uma central de notificações ativa.
              </p>
            </div>

            <Card className="bg-card border-border/50 shadow-2xl overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <CardHeader className="pb-4 relative">
                <CardTitle className="text-xl font-bold">Identificação</CardTitle>
                <CardDescription>Acesso seguro ao motor de notificações.</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4 relative">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">E-mail Corporativo</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/50" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@zaplynx.com"
                        className="bg-secondary/50 border-border/50 pl-10 h-12 text-sm focus:ring-primary/20 transition-all"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Senha de Acesso</Label>
                      <span className="text-[10px] text-primary cursor-pointer hover:underline">Esqueci a senha</span>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/50" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="bg-secondary/50 border-border/50 pl-10 h-12 text-sm focus:ring-primary/20 transition-all"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-primary text-primary-foreground hover:brightness-110 font-black shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "SINCRONIZAR AGORA"}
                  </Button>
                </form>
              </CardContent>
              
              <CardFooter className="flex flex-col gap-4 border-t border-border/50 pt-6 relative">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Status do Servidor: Operacional
                </div>
              </CardFooter>
            </Card>
          </div>

          {/* Lado Direito: Notificações (60%) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Live Feed
              </h2>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                 <span className="text-[10px] font-black uppercase tracking-tighter text-primary">Ao Vivo</span>
              </div>
            </div>

            <div className="grid gap-3">
              {notifications.length > 0 ? (
                notifications.map((notif, index) => (
                  <div 
                    key={notif.id || index}
                    className="bg-card border border-border/50 p-4 rounded-2xl flex gap-4 items-center animate-in fade-in slide-in-from-right-4 duration-500 hover:border-primary/30 transition-all group/item"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className={`p-3 rounded-xl transition-transform group-hover/item:scale-110 ${
                      notif.type === 'sale' ? 'bg-green-500/10 text-green-400' : 
                      notif.type === 'message' ? 'bg-blue-500/10 text-blue-400' : 
                      'bg-primary/10 text-primary'
                    }`}>
                      {notif.type === 'sale' ? <TrendingUp size={20} /> : 
                       notif.type === 'message' ? <MessageSquare size={20} /> : 
                       <Zap size={20} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-black truncate">{notif.title}</p>
                        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{notif.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-card/50 border-2 border-dashed border-border/50 rounded-3xl p-16 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                    <Bell className="text-muted-foreground/30 h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-bold">Aguardando Eventos</p>
                    <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                      Realize o acesso para começar a capturar notificações em tempo real.
                    </p>
                  </div>
                </div>
              )}

              {/* Mock placeholder para usuários não logados */}
              {!user && notifications.length === 0 && (
                <div className="space-y-3">
                   {[1, 2].map(i => (
                     <div key={i} className="bg-card/30 border border-border/20 p-4 rounded-2xl flex gap-4 items-center opacity-40 blur-[1px]">
                        <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
                        <div className="flex-1 space-y-2">
                           <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                           <div className="h-2 w-full bg-muted rounded animate-pulse" />
                        </div>
                     </div>
                   ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
