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
      } else {
        setUserId(session.user.id);
      }
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
      <div className="min-h-screen flex items-center justify-center">
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
      "/configuracao-zapi": "configuracao-zapi",
      "/fluxo-visual": "fluxo-visual",
      "/admin": "admin",
      "/gateway": "gateway",
    };
    return map[path] || "painel";
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeItem={getActiveItem()} userId={userId} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onNavigate={(item) => {
          if (item === "painel") navigate("/dashboard");
          else navigate(`/${item}`);
        }} />
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
