import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import DashboardMeta from "./pages/DashboardMeta";
import Admin from "./pages/Admin";
import Dispositivos from "./pages/Dispositivos";
import Perfil from "./pages/Perfil";
import Campanhas from "./pages/Campanhas";
import Contatos from "./pages/Contatos";
import Modelos from "./pages/Modelos";
import EnviarMensagem from "./pages/EnviarMensagem";
import Relatorio from "./pages/Relatorio";
import ConfiguracaoZAPI from "./pages/ConfiguracaoZAPI";
import FluxoVisual from "./pages/FluxoVisual";
import GatewayIntegracoes from "./pages/GatewayIntegracoes";
import MensagensRecebidas from "./pages/MensagensRecebidas";
import ApanhadorGrupos from "./pages/ApanhadorGrupos";
import CriarGrupos from "./pages/CriarGrupos";
import AgenteIA from "./pages/AgenteIA";
import InvitePage from "./pages/InvitePage";
import NotFound from "./pages/NotFound";
import TemplatesAprovados from "./pages/TemplatesAprovados";
import EnvioCloudAPI from "./pages/EnvioCloudAPI";
import ConfiguracaoMeta from "./pages/ConfiguracaoMeta";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosServico from "./pages/TermosServico";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <WorkspaceProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route element={<DashboardLayout />}>
                {/* Shared routes */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/campanhas" element={<Campanhas />} />
                <Route path="/contatos" element={<Contatos />} />
                <Route path="/relatorio" element={<Relatorio />} />
                <Route path="/gateway" element={<GatewayIntegracoes />} />
                <Route path="/admin" element={<Admin />} />

                {/* Z-API specific routes */}
                <Route path="/dispositivos" element={<Dispositivos />} />
                <Route path="/modelos" element={<Modelos />} />
                <Route path="/fluxo-visual" element={<FluxoVisual />} />
                <Route path="/enviar-mensagem" element={<EnviarMensagem />} />
                <Route path="/configuracao-zapi" element={<ConfiguracaoZAPI />} />
                <Route path="/mensagens" element={<MensagensRecebidas />} />
                <Route path="/apanhador-grupos" element={<ApanhadorGrupos />} />
                <Route path="/criar-grupos" element={<CriarGrupos />} />
                <Route path="/agente-ia" element={<AgenteIA />} />

                {/* Meta API specific routes */}
                <Route path="/meta/dashboard" element={<DashboardMeta />} />
                <Route path="/meta/templates" element={<TemplatesAprovados />} />
                <Route path="/meta/enviar" element={<EnvioCloudAPI />} />
                <Route path="/meta/configuracao" element={<ConfiguracaoMeta />} />
              </Route>
              <Route path="/invite/:slug" element={<InvitePage />} />
              <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </WorkspaceProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
