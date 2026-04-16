import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { usePushNotifications } from "./hooks/usePushNotifications";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import NativeAppLayout from "./components/layout/NativeAppLayout";
import { Capacitor } from "@capacitor/core";
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
import ShopifyOAuthCallback from "./pages/ShopifyOAuthCallback";
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
import AutomacaoComentarios from "./pages/instagram/AutomacaoComentarios";
import CampanhasInstagram from "./pages/instagram/CampanhasInstagram";
import ContatosInstagram from "./pages/instagram/ContatosInstagram";
import ConfiguracaoInstagram from "./pages/instagram/ConfiguracaoInstagram";
import DashboardInstagram from "./pages/instagram/DashboardInstagram";
import ExtrairComunidade from "./pages/ExtrairComunidade";

const queryClient = new QueryClient();

const isNative = Capacitor.isNativePlatform();

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
            {isNative ? (
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/termos-servico" element={<TermosServico />} />
                <Route path="*" element={<NativeAppLayout />} />
              </Routes>
            ) : (
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
                <Route path="/shopify-oauth-callback" element={<ShopifyOAuthCallback />} />
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/gateway-checkout/dashboard" element={<GatewayKycGate><PayDashboard /></GatewayKycGate>} />
                  <Route path="/perfil" element={<Perfil />} />
                  <Route path="/campanhas" element={<Campanhas />} />
                  <Route path="/contatos" element={<Contatos />} />
                  <Route path="/relatorio" element={<Relatorio />} />
                  <Route path="/gateway" element={<GatewayIntegracoes />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/dispositivos" element={<Dispositivos />} />
                  <Route path="/modelos" element={<Modelos />} />
                  <Route path="/fluxo-visual" element={<FluxoVisual />} />
                  <Route path="/enviar-mensagem" element={<EnviarMensagem />} />
                  <Route path="/configuracao-zapi" element={<ConfiguracaoZAPI />} />
                  <Route path="/mensagens" element={<MensagensRecebidas />} />
                  <Route path="/apanhador-grupos" element={<ApanhadorGrupos />} />
                  <Route path="/criar-grupos" element={<CriarGrupos />} />
                  <Route path="/extrair-comunidade" element={<ExtrairComunidade />} />
                  <Route path="/agente-ia" element={<AgenteIA />} />
                  <Route path="/meta/dashboard" element={<DashboardMeta />} />
                  <Route path="/meta/templates" element={<TemplatesAprovados />} />
                  <Route path="/meta/enviar" element={<EnvioCloudAPI />} />
                  <Route path="/meta/configuracao" element={<ConfiguracaoMeta />} />
                  <Route path="/instagram/dashboard" element={<DashboardInstagram />} />
                  <Route path="/instagram/automacao" element={<AutomacaoComentarios />} />
                  <Route path="/instagram/campanhas" element={<CampanhasInstagram />} />
                  <Route path="/instagram/contatos" element={<ContatosInstagram />} />
                  <Route path="/instagram/configuracao" element={<ConfiguracaoInstagram />} />
                  <Route path="/gateway-checkout/products" element={<GatewayKycGate><PayProducts /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/checkouts" element={<GatewayKycGate><PayCheckouts /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/checkouts/new" element={<GatewayKycGate><CheckoutBuilder /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/checkouts/edit/:id" element={<GatewayKycGate><CheckoutBuilder /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/reports" element={<GatewayKycGate><PayReports /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/pixels" element={<GatewayKycGate><PayPixels /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/integrations" element={<GatewayKycGate><PayIntegrations /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/settings" element={<GatewayKycGate><PaySettings /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/withdrawals" element={<GatewayKycGate><PayWithdrawals /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/fees" element={<GatewayKycGate><AdminFees /></GatewayKycGate>} />
                  <Route path="/gateway-checkout/docs" element={<PayDocs />} />
                  <Route path="/gateway-checkout/admin/dashboard" element={<AdminPayDashboard />} />
                  <Route path="/gateway-checkout/admin/companies" element={<AdminCompanies />} />
                  <Route path="/gateway-checkout/admin/acquirers" element={<AdminAcquirers />} />
                  <Route path="/gateway-checkout/admin/fees" element={<AdminFees />} />
                  <Route path="/gateway-checkout/admin/users" element={<AdminPayUsers />} />
                  <Route path="/gateway-checkout/admin/kyc" element={<AdminKYC />} />
                  <Route path="/gateway-checkout/admin/reports" element={<AdminPayReports />} />
                  <Route path="/gateway-checkout/admin/transactions" element={<AdminTransactions />} />
                  <Route path="/gateway-checkout/admin/managers" element={<AdminManagers />} />
                  <Route path="/gateway-checkout/admin/withdrawals" element={<AdminWithdrawals />} />
                  <Route path="/gateway-checkout/manager/dashboard" element={<ManagerDashboard />} />
                  <Route path="/gateway-checkout/manager/clients" element={<ManagerClients />} />
                  <Route path="/gateway-checkout/manager/commissions" element={<ManagerCommissions />} />
                  <Route path="/gateway-checkout/manager/referral" element={<ManagerReferral />} />
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
            )}
            {!isNative && <WhatsAppFloatingButton />}
          </BrowserRouter>
        </WorkspaceProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
