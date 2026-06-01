import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock } from "lucide-react";
import "./Landing.css";
import lynxLogo from "@/assets/lynx-logo-new.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha curta", description: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas diferentes", description: "As senhas não conferem", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "✅ Senha atualizada!", description: "Você já pode fazer login com a nova senha." });
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar senha", description: err?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-root auth-page" style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{
          background: "var(--lp-surface)", border: "1px solid var(--lp-border)",
          borderRadius: 4, padding: "40px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <img src={lynxLogo} alt="Lynx" style={{ height: 48, width: "auto", objectFit: "contain" }} />
            <p style={{ color: "var(--lp-muted)", fontSize: 14, marginTop: 8 }}>
              Defina sua nova senha
            </p>
          </div>

          {!ready ? (
            <div style={{ textAlign: "center", color: "var(--lp-muted)", fontSize: 13, padding: 20 }}>
              <Loader2 size={20} className="animate-spin" style={{ display: "inline-block", marginBottom: 8 }} />
              <div>Validando link de redefinição...</div>
              <div style={{ marginTop: 12, fontSize: 12 }}>
                Se demorar muito, solicite um novo link na tela de login.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field placeholder="Nova senha" value={password} onChange={setPassword} disabled={loading} />
              <Field placeholder="Confirmar nova senha" value={confirm} onChange={setConfirm} disabled={loading} />
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 4, border: "none",
                  background: loading ? "var(--lp-muted2)" : "var(--lp-accent)",
                  color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4,
                }}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? "Salvando..." : "Atualizar senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ placeholder, value, onChange, disabled }: { placeholder: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "var(--lp-surface2)", border: "1px solid var(--lp-border)",
      borderRadius: 4, padding: "0 14px",
    }}>
      <span style={{ color: "var(--lp-muted)", flexShrink: 0 }}><Lock size={16} /></span>
      <input
        type="password"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: "var(--lp-text)", fontSize: 14, padding: "12px 0", fontFamily: "inherit",
        }}
      />
    </div>
  );
}