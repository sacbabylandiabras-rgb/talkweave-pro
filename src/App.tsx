import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dispositivos" element={<Dispositivos />} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/campanhas" element={<Campanhas />} />
              <Route path="/contatos" element={<Contatos />} />
              <Route path="/modelos" element={<Modelos />} />
              <Route path="/fluxo-visual" element={<FluxoVisual />} />
              <Route path="/enviar-mensagem" element={<EnviarMensagem />} />
              <Route path="/relatorio" element={<Relatorio />} />
              <Route path="/configuracao-zapi" element={<ConfiguracaoZAPI />} />
              <Route path="/gateway" element={<GatewayIntegracoes />} />
              <Route path="/mensagens" element={<MensagensRecebidas />} />
              <Route path="/apanhador-grupos" element={<ApanhadorGrupos />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
