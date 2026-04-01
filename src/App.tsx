import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Landing from "./pages/Landing";
import { usePushNotifications } from "./hooks/usePushNotifications";
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
import MetaOAuthCallback from "./pages/MetaOAuthCallback";
import PayDashboard from "./pages/gateway/PayDashboard";
import PayProducts from "./pages/gateway/PayProducts";
import PayCheckouts from "./pages/gateway/PayCheckouts";
import PayReports from "./pages/gateway/PayReports";
import PayPixels from "./pages/gateway/PayPixels";
import PayIntegrations from "./pages/gateway/PayIntegrations";
import PaySettings from "./pages/gateway/PaySettings";
import PayWithdrawals from "./pages/gateway/PayWithdrawals";
import PayDocs from "./pages/gateway/PayDocs";
import AdminPayDashboard from "./pages/gateway/AdminDashboard";
import AdminCompanies from "./pages/gateway/AdminCompanies";
import AdminAcquirers from "./pages/gateway/AdminAcquirers";
import AdminFees from "./pages/gateway/AdminFees";
import AdminPayUsers from "./pages/gateway/AdminUsers";
import AdminKYC from "./pages/gateway/AdminKYC";
import AdminPayReports from "./pages/gateway/AdminReports";
import AdminTransactions from "./pages/gateway/AdminTransactions";
import AdminManagers from "./pages/gateway/AdminManagers";
import AdminWithdrawals from "./pages/gateway/AdminWithdrawals";
import ManagerDashboard from "./pages/gateway/ManagerDashboard";
import ManagerClients from "./pages/gateway/ManagerClients";
import ManagerCommissions from "./pages/gateway/ManagerCommissions";
import ManagerReferral from "./pages/gateway/ManagerReferral";
import CheckoutBuilder from "./pages/gateway/CheckoutBuilder";
import PublicCheckout from "./pages/PublicCheckout";
import ThankYou from "./pages/ThankYou";
import GatewayKycGate from "./components/gateway/GatewayKycGate";

const queryClient = new QueryClient();

function AppContent() {
  usePushNotifications();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <WorkspaceProvider>
          <Toaster />
          <Sonner />
          <AppContent />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
              <Route element={<DashboardLayout />}>
                {/* Dashboard — acessível no mobile */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/gateway-checkout/dashboard" element={<GatewayKycGate><PayDashboard /></GatewayKycGate>} />

                {/* Rotas desktop-only */}
                <Route path="/perfil" element={<MobileRestricted><Perfil /></MobileRestricted>} />
                <Route path="/campanhas" element={<MobileRestricted><Campanhas /></MobileRestricted>} />
                <Route path="/contatos" element={<MobileRestricted><Contatos /></MobileRestricted>} />
                <Route path="/relatorio" element={<MobileRestricted><Relatorio /></MobileRestricted>} />
                <Route path="/gateway" element={<MobileRestricted><GatewayIntegracoes /></MobileRestricted>} />
                <Route path="/admin" element={<MobileRestricted><Admin /></MobileRestricted>} />
                <Route path="/dispositivos" element={<MobileRestricted><Dispositivos /></MobileRestricted>} />
                <Route path="/modelos" element={<MobileRestricted><Modelos /></MobileRestricted>} />
                <Route path="/fluxo-visual" element={<MobileRestricted><FluxoVisual /></MobileRestricted>} />
                <Route path="/enviar-mensagem" element={<MobileRestricted><EnviarMensagem /></MobileRestricted>} />
                <Route path="/configuracao-zapi" element={<MobileRestricted><ConfiguracaoZAPI /></MobileRestricted>} />
                <Route path="/mensagens" element={<MobileRestricted><MensagensRecebidas /></MobileRestricted>} />
                <Route path="/apanhador-grupos" element={<MobileRestricted><ApanhadorGrupos /></MobileRestricted>} />
                <Route path="/criar-grupos" element={<MobileRestricted><CriarGrupos /></MobileRestricted>} />
                <Route path="/agente-ia" element={<MobileRestricted><AgenteIA /></MobileRestricted>} />

                {/* Meta API */}
                <Route path="/meta/dashboard" element={<MobileRestricted><DashboardMeta /></MobileRestricted>} />
                <Route path="/meta/templates" element={<MobileRestricted><TemplatesAprovados /></MobileRestricted>} />
                <Route path="/meta/enviar" element={<MobileRestricted><EnvioCloudAPI /></MobileRestricted>} />
                <Route path="/meta/configuracao" element={<MobileRestricted><ConfiguracaoMeta /></MobileRestricted>} />

                {/* Gateway — Lojista (desktop-only exceto dashboard) */}
                <Route path="/gateway-checkout/products" element={<MobileRestricted><GatewayKycGate><PayProducts /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/checkouts" element={<MobileRestricted><GatewayKycGate><PayCheckouts /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/checkouts/new" element={<MobileRestricted><GatewayKycGate><CheckoutBuilder /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/checkouts/edit/:id" element={<MobileRestricted><GatewayKycGate><CheckoutBuilder /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/reports" element={<MobileRestricted><GatewayKycGate><PayReports /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/pixels" element={<MobileRestricted><GatewayKycGate><PayPixels /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/integrations" element={<MobileRestricted><GatewayKycGate><PayIntegrations /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/settings" element={<MobileRestricted><GatewayKycGate><PaySettings /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/withdrawals" element={<MobileRestricted><GatewayKycGate><PayWithdrawals /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/fees" element={<MobileRestricted><GatewayKycGate><AdminFees /></GatewayKycGate></MobileRestricted>} />
                <Route path="/gateway-checkout/docs" element={<MobileRestricted><PayDocs /></MobileRestricted>} />
                {/* Gateway — Admin */}
                <Route path="/gateway-checkout/admin/dashboard" element={<MobileRestricted><AdminPayDashboard /></MobileRestricted>} />
                <Route path="/gateway-checkout/admin/companies" element={<MobileRestricted><AdminCompanies /></MobileRestricted>} />
                <Route path="/gateway-checkout/admin/acquirers" element={<MobileRestricted><AdminAcquirers /></MobileRestricted>} />
                <Route path="/gateway-checkout/admin/fees" element={<MobileRestricted><AdminFees /></MobileRestricted>} />
                <Route path="/gateway-checkout/admin/users" element={<MobileRestricted><AdminPayUsers /></MobileRestricted>} />
                <Route path="/gateway-checkout/admin/kyc" element={<MobileRestricted><AdminKYC /></MobileRestricted>} />
                <Route path="/gateway-checkout/admin/reports" element={<MobileRestricted><AdminPayReports /></MobileRestricted>} />
                <Route path="/gateway-checkout/admin/transactions" element={<MobileRestricted><AdminTransactions /></MobileRestricted>} />
                <Route path="/gateway-checkout/admin/managers" element={<MobileRestricted><AdminManagers /></MobileRestricted>} />
                <Route path="/gateway-checkout/admin/withdrawals" element={<MobileRestricted><AdminWithdrawals /></MobileRestricted>} />
                {/* Gateway — Manager */}
                <Route path="/gateway-checkout/manager/dashboard" element={<MobileRestricted><ManagerDashboard /></MobileRestricted>} />
                <Route path="/gateway-checkout/manager/clients" element={<MobileRestricted><ManagerClients /></MobileRestricted>} />
                <Route path="/gateway-checkout/manager/commissions" element={<MobileRestricted><ManagerCommissions /></MobileRestricted>} />
                <Route path="/gateway-checkout/manager/referral" element={<MobileRestricted><ManagerReferral /></MobileRestricted>} />
              </Route>
              <Route path="/invite/:slug" element={<InvitePage />} />
              <Route path="/pay/:slug" element={<PublicCheckout />} />
              <Route path="/pay/:slug/obrigado" element={<ThankYou />} />
              <Route path="/checkout/:slug" element={<PublicCheckout />} />
              <Route path="/checkout/:slug/obrigado" element={<ThankYou />} />
              <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
              <Route path="/termos-servico" element={<TermosServico />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </WorkspaceProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
