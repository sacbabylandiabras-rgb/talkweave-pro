import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import Dispositivos from "./Dispositivos";
import Perfil from "./Perfil";
import Campanhas from "./Campanhas";
import Contatos from "./Contatos";
import Modelos from "./Modelos";
import EnviarMensagem from "./EnviarMensagem";
import MensagensRecebidas from "./MensagensRecebidas";
import Relatorio from "./Relatorio";
import ConfiguracaoZAPI from "./ConfiguracaoZAPI";
import Contexto from "./Contexto";
import FiltroNumero from "./FiltroNumero";
import ApanhadorGrupos from "./ApanhadorGrupos";
import Admin from "./Admin";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeItem, setActiveItem] = useState("dashboard");
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

  const renderContent = () => {
    switch (activeItem) {
      case "dispositivos":
        return <Dispositivos />;
      case "perfil":
        return <Perfil />;
      case "campanhas":
        return <Campanhas />;
      case "contatos":
        return <Contatos />;
      case "modelos":
        return <Modelos />;
      case "enviar-mensagem":
        return <EnviarMensagem />;
      case "mensagens-recebidas":
        return <MensagensRecebidas />;
      case "relatorio":
        return <Relatorio />;
      case "configuracao-zapi":
        return <ConfiguracaoZAPI />;
      case "contexto":
        return <Contexto />;
      case "filtro-numero":
        return <FiltroNumero />;
      case "apanhador-grupos":
        return <ApanhadorGrupos />;
      case "admin":
        return <Admin />;
      default:
        return (
          <div className="space-y-8">
            <TopMetrics />
            <StatsGrid />
            <VolumeChart />
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} userId={userId} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onNavigate={setActiveItem} />
        <main className="flex-1 overflow-auto p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
