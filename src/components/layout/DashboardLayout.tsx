import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";


export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        setLoading(false);
        return;
      }

      // Check if account is active
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", session.user.id)
        .single();

      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        navigate("/auth");
        setLoading(false);
        return;
      }

      setUserId(session.user.id);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getActiveItem = () => {
    const path = location.pathname;
    const map: Record<string, string> = {
      "/dashboard": "painel",
      "/dispositivos": "dispositivos",
      "/perfil": "perfil",
      "/campanhas": "campanhas",
      "/contatos": "contatos",
      "/modelos": "modelos",
      "/enviar-mensagem": "enviar-mensagem",
      "/relatorio": "relatorio",
      "/fluxo-visual": "fluxo-visual",
      "/admin": "admin",
      "/gateway": "gateway",
      "/mensagens": "mensagens",
      "/apanhador-grupos": "apanhador-grupos",
      "/agente-ia": "agente-ia",
      "/criar-grupos": "criar-grupos",
      // Instagram routes
      "/instagram/dashboard": "ig-dashboard",
      "/instagram/campanhas": "ig-campanhas",
      "/instagram/automacao": "ig-automacao",
      "/instagram/contatos": "ig-contatos",
      "/instagram/configuracao": "ig-configuracao",
      // Meta API routes
      "/meta/dashboard": "painel-meta",
      "/meta/templates": "templates-aprovados",
      "/meta/enviar": "envio-cloud",
      "/meta/configuracao": "configuracao-meta",
    };
    return map[path] || "painel";
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeItem={getActiveItem()} userId={userId} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onNavigate={(item) => {
          if (item === "painel") navigate("/dashboard");
          else navigate(`/${item}`);
        }} />
        <main className="flex-1 overflow-auto p-6 bg-background dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
