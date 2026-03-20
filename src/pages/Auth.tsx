import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Email inválido").max(255),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(100)
});

const signupSchema = authSchema.extend({
  whatsapp: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, "WhatsApp inválido. Use formato: +5511999999999")
    .min(10, "WhatsApp deve ter no mínimo 10 dígitos")
    .max(20, "WhatsApp muito longo")
});

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [activeTab, setActiveTab] = useState(searchParams.get("signup") ? "signup" : "login");

  useEffect(() => {
    // Verificar se usuário já está logado
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate("/dashboard");
      }
      
      // Quando o usuário confirma o email
      if (event === 'USER_UPDATED') {
        toast({
          title: "✅ Email confirmado!",
          description: "Agora você pode fazer login com suas credenciais.",
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar inputs
      authSchema.parse({ email: email.trim(), password });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Erro ao entrar",
            description: "Email ou senha incorretos",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro ao entrar",
            description: error.message,
            variant: "destructive"
          });
        }
        return;
      }

      // Verificar se o usuário está ativo
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_active, subscription_status")
          .eq("id", data.user.id)
          .single();

        if (profileError) {
          console.error("Erro ao verificar perfil:", profileError);
        }

        if (profile && !profile.is_active) {
          await supabase.auth.signOut();
          toast({
            title: "Conta desativada",
            description: "Sua assinatura não está ativa. Finalize o pagamento para acessar.",
            variant: "destructive"
          });
          return;
        }

        if (profile && profile.subscription_status !== 'active') {
          await supabase.auth.signOut();
          toast({
            title: "Assinatura pendente",
            description: "Finalize o pagamento para acessar a plataforma.",
            variant: "destructive"
          });
          return;
        }
      }

      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta"
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Dados inválidos",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar inputs
      signupSchema.parse({ email: email.trim(), password, whatsapp: whatsapp.trim() });

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            whatsapp: whatsapp.trim()
          }
        }
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          toast({
            title: "Erro ao criar conta",
            description: "Este email já está cadastrado. Faça login ou recupere sua senha.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro ao criar conta",
            description: error.message,
            variant: "destructive"
          });
        }
        return;
      }

      toast({
        title: "✅ Conta criada com sucesso!",
        description: "📧 Verifique sua caixa de entrada (e spam) e clique no link de confirmação do email antes de fazer login.",
        duration: 10000
      });
      
      // Limpar campos
      setEmail("");
      setPassword("");
      setWhatsapp("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Dados inválidos",
          description: error.errors[0].message,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">ZapLynx</CardTitle>
            <CardDescription>
              Gerencie suas mensagens de forma profissional
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar Conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Entrar"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <div className="space-y-6 py-4">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <span className="text-3xl">🔒</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Cadastro via Pagamento</h3>
                    <p className="text-sm text-muted-foreground">
                      Para acessar o ZapLynx, é necessário assinar um dos nossos planos. 
                      Sua conta será criada automaticamente após a confirmação do pagamento.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: "Plano Start", price: "R$397/mês", link: "https://checkout.perfectpay.com.br/pay/PPU38CQ97NN" },
                      { name: "Plano Pro", price: "R$497/mês", link: "https://checkout.perfectpay.com.br/pay/PPU38CQ97NP", popular: true },
                      { name: "Plano Scale", price: "R$897/mês", link: "https://checkout.perfectpay.com.br/pay/PPU38CQ97NO" },
                    ].map((plan, i) => (
                      <a
                        key={i}
                        href={plan.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:-translate-y-0.5 ${
                          plan.popular 
                            ? "border-primary bg-primary/5 shadow-sm" 
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <div>
                          <p className="text-foreground font-semibold text-sm">{plan.name}</p>
                          <p className="text-muted-foreground text-xs">{plan.price}</p>
                        </div>
                        {plan.popular && (
                          <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                            POPULAR
                          </span>
                        )}
                        <span className="text-primary text-sm font-bold">Assinar →</span>
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Após o pagamento, você receberá um email para definir sua senha e acessar a plataforma.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
