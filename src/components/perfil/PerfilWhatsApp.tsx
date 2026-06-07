import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Phone, FileText, Calendar, CreditCard, ShieldCheck, Hash, Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getHttpAvatarUrl } from "@/lib/avatar-utils";

interface ProfileData {
  id: string;
  email: string | null;
  full_name: string | null;
  whatsapp: string | null;
  document: string | null;
  document_type: string | null;
  avatar_url: string | null;
  is_active: boolean;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  max_instances: number;
  custom_domain: string | null;
  pix_acquirer: string | null;
  created_at: string;
  updated_at: string;
}

const formatDate = (value: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return value;
  }
};

const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
    <Icon className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm text-foreground font-medium break-words">{value || "—"}</div>
    </div>
  </div>
);

const PerfilWhatsApp = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [createdAtAuth, setCreatedAtAuth] = useState<string>("");
  const [lastSignIn, setLastSignIn] = useState<string>("");
  const [role, setRole] = useState<string>("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setCreatedAtAuth(user.created_at || "");
        setLastSignIn(user.last_sign_in_at || "");

        const [{ data: profileData }, { data: roleData }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        ]);

        if (profileData) setProfile(profileData as ProfileData);
        if (roleData?.role) setRole(roleData.role);
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

   const displayName = profile?.full_name || (profile?.email && profile.email.includes("@") ? profile.email : null) || "Usuário";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Perfil do WhatsApp</h1>
        <p className="text-muted-foreground mt-2">Visualize todos os dados da sua conta</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Dados da Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <Avatar className="h-16 w-16">
                  {getHttpAvatarUrl(profile?.avatar_url) && <AvatarImage src={getHttpAvatarUrl(profile?.avatar_url)!} alt={displayName} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initial}</AvatarFallback>
                </Avatar>
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-lg font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                    <Mail className="w-3.5 h-3.5" />{profile?.email || "—"}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant={profile?.is_active ? "default" : "destructive"}>
                      {profile?.is_active ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {profile?.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Badge variant="secondary">{role === "admin" ? "Administrador" : "Usuário"}</Badge>
                    {profile?.subscription_status && (
                      <Badge variant="outline">{profile.subscription_status}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-1 md:grid-cols-2">
                <InfoRow icon={Hash} label="ID do Usuário" value={<span className="font-mono text-xs">{userId}</span>} />
                <InfoRow icon={User} label="Nome Completo" value={profile?.full_name} />
                <InfoRow icon={Mail} label="E-mail" value={profile?.email} />
                <InfoRow icon={Phone} label="WhatsApp" value={profile?.whatsapp} />
                <InfoRow
                  icon={FileText}
                  label={profile?.document_type?.toUpperCase() || "Documento"}
                  value={profile?.document}
                />
                <InfoRow icon={ShieldCheck} label="Permissão" value={role === "admin" ? "Administrador" : "Usuário"} />
                <InfoRow icon={CreditCard} label="Status da Assinatura" value={profile?.subscription_status} />
                <InfoRow icon={Calendar} label="Assinatura expira em" value={formatDate(profile?.subscription_expires_at || null)} />
                <InfoRow icon={Smartphone} label="Limite de Instâncias" value={profile?.max_instances?.toString()} />
                <InfoRow icon={CreditCard} label="Adquirente PIX" value={profile?.pix_acquirer} />
                <InfoRow icon={Hash} label="Domínio Personalizado" value={profile?.custom_domain} />
                <InfoRow icon={Calendar} label="Conta criada em" value={formatDate(createdAtAuth || profile?.created_at || null)} />
                <InfoRow icon={Calendar} label="Último acesso" value={formatDate(lastSignIn)} />
                <InfoRow icon={Calendar} label="Última atualização" value={formatDate(profile?.updated_at || null)} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PerfilWhatsApp;
