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

  // Mapeia pathname para activeItem
  const getActiveItem = () => {
    const path = location.pathname;
    if (path === "/dashboard") return "painel";
    if (path === "/dispositivos") return "dispositivos";
    if (path === "/perfil") return "perfil";
    if (path === "/campanhas") return "campanhas";
    if (path === "/contatos") return "contatos";
    if (path === "/modelos") return "modelos";
    if (path === "/enviar-mensagem") return "enviar-mensagem";
    if (path === "/relatorio") return "relatorio";
    if (path === "/configuracao-zapi") return "configuracao-zapi";
    if (path === "/admin") return "admin";
    return "painel";
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
