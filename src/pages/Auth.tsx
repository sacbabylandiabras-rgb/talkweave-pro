import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Mail, Lock, User, Phone, TrendingUp, Zap } from "lucide-react";
import { z } from "zod";
import "./Landing.css";
import lynxLogo from "@/assets/lynx-logo-new.png";

const authSchema = z.object({
  email: z.string().email("Email inválido").max(255),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(100)
});

const signupSchema = authSchema.extend({
  fullName: z.string().trim().min(3, "Nome completo deve ter no mínimo 3 caracteres").max(100, "Nome muito longo"),
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
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [activeTab, setActiveTab] = useState<"login" | "signup">(searchParams.get("signup") ? "signup" : "login");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
       if (session) navigate("/dashboard", { replace: true });
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED') {
        toast({ title: "✅ Email confirmado!", description: "Agora você pode fazer login com suas credenciais." });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      authSchema.parse({ email: email.trim(), password });
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        toast({
          title: "Erro ao entrar",
          description: error.message.includes("Invalid login credentials") ? "Email ou senha incorretos" : error.message,
          variant: "destructive"
        });
        return;
      }
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).single();
        if (profile && !profile.is_active) {
          await supabase.auth.signOut();
          toast({ title: "Conta desativada", description: "Sua conta foi desativada. Entre em contato com o suporte.", variant: "destructive" });
          return;
        }
      }
      toast({ title: "Login realizado!", description: "Bem-vindo de volta" });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Dados inválidos", description: error.errors[0].message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      signupSchema.parse({ email: email.trim(), password, fullName: fullName.trim(), whatsapp: whatsapp.trim() });
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: 'https://zaplynx.com/dashboard',
          data: { full_name: fullName.trim(), whatsapp: whatsapp.trim() }
        }
      });
      if (error) {
        toast({
          title: "Erro ao criar conta",
          description: error.message.includes("User already registered") ? "Este email já está cadastrado." : error.message,
          variant: "destructive"
        });
        return;
      }
      toast({ title: "✅ Conta criada!", description: "📧 Verifique sua caixa de entrada e confirme o email.", duration: 10000 });
      setEmail(""); setPassword(""); setFullName(""); setWhatsapp("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Dados inválidos", description: error.errors[0].message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = forgotEmail.trim();
    if (!targetEmail) {
      toast({ title: "Informe o email", description: "Digite o email da sua conta", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "✅ Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
        duration: 10000,
      });
      setShowForgot(false);
      setForgotEmail("");
    } catch (error: any) {
      toast({ title: "Erro ao enviar email", description: error?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="lp-root auth-page" style={{ display: "flex", minHeight: "100vh", overflow: "hidden" }}>
      {/* LEFT — animated message/sales notifications */}
      <div className="auth-left">
        <div className="auth-left-glow" />
        <div className="auth-left-grid" />

        <div className="auth-float auth-float-1">
          <div className="auth-msg-bubble">
            <div className="auth-msg-avatar" style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>M</div>
            <div>
              <div className="auth-msg-name">Maria Silva</div>
              <div className="auth-msg-text">Oi! Quero comprar 🛒</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-2">
          <div className="auth-sale-card">
            <div className="auth-sale-icon auth-sale-icon-green">
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="auth-sale-title">Nova venda aprovada</div>
              <div className="auth-sale-value">+ R$ 297,00</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-3">
          <div className="auth-msg-bubble">
            <div className="auth-msg-avatar" style={{ background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}>J</div>
            <div>
              <div className="auth-msg-name">João Pedro</div>
              <div className="auth-msg-text">Pix pago ✅</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-4">
          <div className="auth-sale-card auth-sale-pix">
            <div className="auth-sale-icon auth-sale-icon-purple">
              <Zap size={18} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="auth-sale-title">Pix recebido</div>
              <div className="auth-sale-value">+ R$ 89,90</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-5">
          <div className="auth-msg-bubble">
            <div className="auth-msg-avatar" style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)" }}>A</div>
            <div>
              <div className="auth-msg-name">Ana Costa</div>
              <div className="auth-msg-text">Mensagem entregue 📩</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-6">
          <div className="auth-sale-card">
            <div className="auth-sale-icon auth-sale-icon-green">
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="auth-sale-title">Venda confirmada</div>
              <div className="auth-sale-value">+ R$ 547,00</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-7">
          <div className="auth-msg-bubble">
            <div className="auth-msg-avatar" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>L</div>
            <div>
              <div className="auth-msg-name">Lucas Mendes</div>
              <div className="auth-msg-text">Quero o link 🔗</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-8">
          <div className="auth-sale-card auth-sale-pix">
            <div className="auth-sale-icon auth-sale-icon-purple">
              <Zap size={18} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="auth-sale-title">Pix recebido</div>
              <div className="auth-sale-value">+ R$ 1.290,00</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-9">
          <div className="auth-msg-bubble">
            <div className="auth-msg-avatar" style={{ background: "linear-gradient(135deg,#ec4899,#be185d)" }}>C</div>
            <div>
              <div className="auth-msg-name">Camila Rocha</div>
              <div className="auth-msg-text">Pode enviar! 🚀</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-10">
          <div className="auth-sale-card">
            <div className="auth-sale-icon auth-sale-icon-green">
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="auth-sale-title">Nova venda aprovada</div>
              <div className="auth-sale-value">+ R$ 197,00</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-11">
          <div className="auth-msg-bubble">
            <div className="auth-msg-avatar" style={{ background: "linear-gradient(135deg,#06b6d4,#0e7490)" }}>R</div>
            <div>
              <div className="auth-msg-name">Rafael Lima</div>
              <div className="auth-msg-text">Recebi, obrigado! 🙏</div>
            </div>
          </div>
        </div>

        <div className="auth-float auth-float-12">
          <div className="auth-sale-card auth-sale-pix">
            <div className="auth-sale-icon auth-sale-icon-purple">
              <Zap size={18} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="auth-sale-title">Pix recebido</div>
              <div className="auth-sale-value">+ R$ 49,90</div>
            </div>
          </div>
        </div>

        <div className="auth-left-headline">
          <h2>Vendas em tempo real</h2>
          <p>Receba notificações de cada venda e mensagem direto no seu painel.</p>
        </div>
      </div>

      {/* RIGHT — login */}
      <div className="auth-right">
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="lp-btn-ghost"
          style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        {/* Card */}
        <div style={{
          background: "var(--lp-surface)",
          border: "1px solid var(--lp-border)",
          borderRadius: 4,
          padding: "40px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
        }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
              <img src={lynxLogo} alt="Lynx" style={{ height: 48, width: "auto", objectFit: "contain" }} />
            </div>
            <p style={{ color: "var(--lp-muted)", fontSize: 14, marginTop: 8 }}>
              {activeTab === "login" ? "Entre na sua conta" : "Crie sua conta grátis"}
            </p>
          </div>

          {/* Tab switcher */}
          <div style={{
            display: "flex",
            background: "var(--lp-surface2)",
            borderRadius: 4,
            padding: 4,
            marginBottom: 28,
            gap: 4
          }}>
            {(["login", "signup"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s",
                  background: activeTab === tab ? "var(--lp-accent)" : "transparent",
                  color: activeTab === tab ? "#fff" : "var(--lp-muted)",
                }}
              >
                 {tab === "login" ? "Entrar" : "Teste Grátis"}
              </button>
            ))}
          </div>

          {/* Forms */}
          {activeTab === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <InputField icon={<Mail size={16} />} type="email" placeholder="seu@email.com" value={email} onChange={setEmail} disabled={loading} />
              <InputField icon={<Lock size={16} />} type="password" placeholder="••••••••" value={password} onChange={setPassword} disabled={loading} />
              <SubmitButton loading={loading} label="Entrar" loadingLabel="Entrando..." />
              <div style={{ textAlign: "center", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setForgotEmail(email); setShowForgot(true); }}
                  style={{ background: "transparent", border: "none", color: "var(--lp-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 4 }}
                >
                  Esqueci minha senha
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <InputField icon={<User size={16} />} type="text" placeholder="Seu nome completo" value={fullName} onChange={setFullName} disabled={loading} />
              <InputField icon={<Mail size={16} />} type="email" placeholder="seu@email.com" value={email} onChange={setEmail} disabled={loading} />
              <InputField icon={<Phone size={16} />} type="text" placeholder="+5511999999999" value={whatsapp} onChange={setWhatsapp} disabled={loading} />
               <InputField icon={<Lock size={16} />} type="password" placeholder="••••••••" value={password} onChange={setPassword} disabled={loading} />
               <SubmitButton loading={loading} label="Iniciar 2 Dias Grátis" loadingLabel="Criando conta..." />
               <div style={{ textAlign: "center", marginTop: 8 }}>
                 <p style={{ fontSize: 12, color: "var(--lp-muted)", margin: "0 0 4px 0" }}>
                   Após criar sua conta, confirme seu email para acessar.
                 </p>
                 <p style={{ fontSize: 11, color: "var(--lp-accent)", fontWeight: 600 }}>
                   ✓ Acesso total liberado por 2 dias
                 </p>
               </div>
             </form>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

/* ── Reusable sub-components ── */

function InputField({ icon, type, placeholder, value, onChange, disabled }: {
  icon: React.ReactNode; type: string; placeholder: string; value: string;
  onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "var(--lp-surface2)", border: "1px solid var(--lp-border)",
      borderRadius: 4, padding: "0 14px", transition: "border-color 0.2s",
    }}>
      <span style={{ color: "var(--lp-muted)", flexShrink: 0 }}>{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: "var(--lp-text)", fontSize: 14, padding: "12px 0",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: "100%", padding: "13px 0", borderRadius: 4, border: "none",
        background: loading ? "var(--lp-muted2)" : "var(--lp-accent)",
        color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "all 0.2s", marginTop: 4,
      }}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {loading ? loadingLabel : label}
    </button>
  );
}

export default Auth;
