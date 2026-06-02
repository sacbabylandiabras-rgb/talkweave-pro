import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function AceitarConvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [needsSignup, setNeedsSignup] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await supabase.functions.invoke("team-invite-accept", { body: { action: "lookup", token } });
      const inv = (data as any)?.invite;
      setInvite(inv);
      const { data: { user } } = await supabase.auth.getUser();
      setHasSession(!!user);
      if (inv && !user) setNeedsSignup(true);
      setLoading(false);
    })();
  }, [token]);

  async function accept() {
    if (!token) return;
    setSubmitting(true);
    try {
      if (needsSignup) {
        const { error } = await supabase.auth.signUp({
          email: invite.email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/aceitar-convite?token=${token}` },
        });
        if (error) throw error;
        // try sign-in (in case email confirmation off)
        await supabase.auth.signInWithPassword({ email: invite.email, password });
      }
      const { data, error } = await supabase.functions.invoke("team-invite-accept", { body: { action: "accept", token } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast({ title: "Convite aceito!", description: "Você agora faz parte da equipe." });
      navigate("/dashboard");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8">Carregando convite...</div>;
  if (!invite) return <div className="p-8">Convite inválido ou expirado.</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Aceitar convite</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Você foi convidado(a) para entrar na equipe <strong>{invite.team_name}</strong> como funcionário.
          </p>
          <div>
            <Label>Email</Label>
            <Input value={invite.email} disabled />
          </div>
          {needsSignup && (
            <>
              <div>
                <Label>Nome completo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Crie uma senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </>
          )}
          {!needsSignup && !hasSession && (
            <p className="text-sm">Faça login com o email <strong>{invite.email}</strong> e volte para aceitar.</p>
          )}
          <Button className="w-full" onClick={accept} disabled={submitting || (needsSignup && (!name || !password))}>
            {submitting ? "Processando..." : "Aceitar convite"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}