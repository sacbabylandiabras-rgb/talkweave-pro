import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Bell, 
  User, 
  Mail, 
  Lock, 
  Loader2, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function CustomInputPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { workspace } = useWorkspace();
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
        fetchNotifications(session.user.id);
      }
    };
    getSession();

    // Subscribe to notifications channel
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          console.log('New notification:', payload);
          setNotifications(prev => [payload.new, ...prev]);
          toast({
            title: "Nova Notificação",
            description: payload.new.message || "Você recebeu uma nova atualização.",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const fetchNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!error && data) {
      setNotifications(data);
    }
  };

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
        title: "Sucesso!",
        description: "Login realizado com sucesso. Seus dados estão sendo carregados.",
      });
      
      setUser(data.user);
      fetchNotifications(data.user.id);
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header com botão de voltar */}
        <div className="flex items-center justify-between w-full">
          <Button 
            variant="ghost" 
            className="text-muted-foreground hover:text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-2 text-purple-400">
            <Smartphone className="h-5 w-5" />
            <span className="font-bold tracking-tight">ZAPLYNX PRO</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Lado Esquerdo: Formulário de Login/Input */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight">Portal de Acesso</h1>
              <p className="text-muted-foreground">
                Insira suas credenciais para sincronizar dados e notificações em tempo real.
              </p>
            </div>

            <Card className="bg-[#161820] border-white/5 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl">Identificação</CardTitle>
                <CardDescription className="text-muted-foreground/60">
                  Os dados inseridos aqui são protegidos por criptografia de ponta a ponta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        className="bg-[#1e2130] border-white/5 pl-10 h-12"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="bg-[#1e2130] border-white/5 pl-10 h-12"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-600 hover:opacity-90 font-bold"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "ACESSAR SISTEMA"}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex justify-center border-t border-white/5 pt-6">
                <p className="text-xs text-muted-foreground">
                  Ambiente Seguro: 256-bit SSL Encryption
                </p>
              </CardFooter>
            </Card>
          </div>

          {/* Lado Direito: Sistema de Notificações */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Bell className="h-5 w-5 text-purple-400" />
                Notificações Recentes
              </h2>
              {notifications.length > 0 && (
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded-full animate-pulse">
                  AO VIVO
                </span>
              )}
            </div>

            <div className="space-y-4">
              {notifications.length > 0 ? (
                notifications.map((notif, index) => (
                  <div 
                    key={notif.id || index}
                    className="bg-[#161820] border border-white/5 p-4 rounded-xl flex gap-4 items-start animate-in fade-in slide-in-from-right-4 duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className={`p-2 rounded-lg ${notif.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {notif.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    </div>
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">{notif.title || 'Sistema'}</p>
                      <p className="text-xs text-muted-foreground">{notif.message}</p>
                      <p className="text-[10px] text-muted-foreground/40 pt-1">
                        {notif.created_at ? new Date(notif.created_at).toLocaleTimeString() : 'Agora'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-[#161820] border border-dashed border-white/10 rounded-2xl p-12 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                    <Bell className="text-muted-foreground/40 h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Nenhuma notificação</p>
                    <p className="text-xs text-muted-foreground">Faça login para ver suas atividades em tempo real.</p>
                  </div>
                </div>
              )}

              {/* Mock de Notificação de Exemplo se não houver login */}
              {!user && (
                <div className="opacity-40 grayscale pointer-events-none space-y-4">
                   <div className="bg-[#161820] border border-white/5 p-4 rounded-xl flex gap-4 items-start">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">Venda Aprovada</p>
                      <p className="text-xs text-muted-foreground">Você recebeu um novo pagamento de R$ 197,00</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
