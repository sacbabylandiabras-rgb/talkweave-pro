import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { TopMetrics } from "@/components/dashboard/TopMetrics";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import Dispositivos from "./Dispositivos";
import EnviarMensagem from "./EnviarMensagem";
import MensagemBoasVindas from "./MensagemBoasVindas";
import RespostaAutomatica from "./RespostaAutomatica";
import Modelos from "./Modelos";
import Contatos from "./Contatos";
import CancelarAssinaturas from "./CancelarAssinaturas";
import FiltroNumero from "./FiltroNumero";
import ApanhadorGrupos from "./ApanhadorGrupos";
import Relatorio from "./Relatorio";
import MensagensRecebidas from "./MensagensRecebidas";
import Contexto from "./Contexto";

const Index = () => {
  const [activeItem, setActiveItem] = useState("painel");

  const renderContent = () => {
    switch (activeItem) {
      case "dispositivos":
        return <Dispositivos />;
      case "enviar-mensagem":
        return <EnviarMensagem />;
      case "mensagem-boas-vindas":
        return <MensagemBoasVindas />;
      case "resposta-automatica":
        return <RespostaAutomatica />;
      case "modelos":
        return <Modelos />;
      case "contatos":
        return <Contatos />;
      case "cancelar-assinaturas":
        return <CancelarAssinaturas />;
      case "filtro-numero":
        return <FiltroNumero />;
      case "apanhador-grupos":
        return <ApanhadorGrupos />;
      case "relatorio":
        return <Relatorio />;
      case "mensagens-recebidas":
        return <MensagensRecebidas />;
      case "contexto":
        return <Contexto />;
      case "painel":
      default:
        return (
          <>
            <TopMetrics />
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Estatísticas Detalhadas
              </h2>
              <StatsGrid />
            </div>
          </>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Sidebar */}
      <Sidebar activeItem={activeItem} onItemClick={setActiveItem} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header />
        
        {/* Content */}
        <main className="flex-1 p-6 space-y-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;
