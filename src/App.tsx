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
import { Capacitor } from "@capacitor/core";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NativeAppLayout from "./components/layout/NativeAppLayout";
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
import FluxoVisual from "./pages/FluxoVisual";
import GatewayIntegracoes from "./pages/GatewayIntegracoes";
import MensagensRecebidas from "./pages/MensagensRecebidas";
import ApanhadorGrupos from "./pages/ApanhadorGrupos";
import CriarGrupos from "./pages/CriarGrupos";
import AgenteIA from "./pages/AgenteIA";
import AquecimentoNumero from "./pages/AquecimentoNumero";
import AdminAquecimento from "./pages/AdminAquecimento";
import InvitePage from "./pages/InvitePage";
import NotFound from "./pages/NotFound";
import TemplatesAprovados from "./pages/TemplatesAprovados";
import EnvioCloudAPI from "./pages/EnvioCloudAPI";
import ConfiguracaoMeta from "./pages/ConfiguracaoMeta";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosServico from "./pages/TermosServico";
import MetaOAuthCallback from "./pages/MetaOAuthCallback";
import ShopifyOAuthCallback from "./pages/ShopifyOAuthCallback";
import ShopifyEmbedded from "./pages/ShopifyEmbedded";
import PayDashboard from "./pages/gateway/PayDashboard";
import PayProducts from "./pages/gateway/PayProducts";
import PayCheckouts from "./pages/gateway/PayCheckouts";
import PayLandingPages from "./pages/gateway/PayLandingPages";
import PayReports from "./pages/gateway/PayReports";
import PayCartRecovery from "./pages/gateway/PayCartRecovery";
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
import PublicOrder from "./pages/PublicOrder";
import GatewayKycGate from "./components/gateway/GatewayKycGate";
import AdminRouteGuard from "./components/admin/AdminRouteGuard";
import { PaidRouteGuard } from "./components/auth/PaidRouteGuard";
import AutomacaoComentarios from "./pages/instagram/AutomacaoComentarios";
import CampanhasInstagram from "./pages/instagram/CampanhasInstagram";
import ContatosInstagram from "./pages/instagram/ContatosInstagram";
import ConfiguracaoInstagram from "./pages/instagram/ConfiguracaoInstagram";
import TelegramPlaceholder from "./pages/telegram/TelegramPlaceholder";
import TelegramCriarBot from "./pages/telegram/TelegramCriarBot";
import TelegramAtualizarBot from "./pages/telegram/TelegramAtualizarBot";
import TelegramDashboard from "./pages/telegram/TelegramDashboard";
import DashboardInstagram from "./pages/instagram/DashboardInstagram";
import ExtrairComunidade from "./pages/ExtrairComunidade";
import DisparoOculto from "./pages/DisparoOculto";
import AdminDisparoOculto from "./pages/AdminDisparoOculto";

const queryClient = new QueryClient();

const isNative = Capacitor.isNativePlatform();

function AppContent() {
  usePushNotifications();
  return null;
}

const KycWrap = ({ children }: { children: React.ReactNode }) => (
  <GatewayKycGate>{children}</GatewayKycGate>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
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
                <Route path="/shopify/callback" element={<ShopifyEmbedded />} />
                <Route path="/shopify/embedded" element={<ShopifyEmbedded />} />
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/gateway-checkout/dashboard" element={<KycWrap><PayDashboard /></KycWrap>} />
                  <Route path="/perfil" element={<Perfil />} />
                  <Route path="/campanhas" element={<Campanhas />} />
                  <Route path="/contatos" element={<Contatos />} />
                  <Route path="/relatorio" element={<Relatorio />} />
                  <Route path="/gateway" element={<GatewayIntegracoes />} />
                  <Route path="/admin" element={<AdminRouteGuard><Admin /></AdminRouteGuard>} />
                  <Route path="/dispositivos" element={<Dispositivos />} />
                  <Route path="/modelos" element={<Modelos />} />
                  <Route path="/fluxo-visual" element={<FluxoVisual />} />
                  <Route path="/enviar-mensagem" element={<EnviarMensagem />} />
                  <Route path="/mensagens" element={<MensagensRecebidas />} />
                  <Route path="/apanhador-grupos" element={<PaidRouteGuard><ApanhadorGrupos /></PaidRouteGuard>} />
                  <Route path="/criar-grupos" element={<PaidRouteGuard><CriarGrupos /></PaidRouteGuard>} />
                  <Route path="/extrair-comunidade" element={<ExtrairComunidade />} />
                  <Route path="/agente-ia" element={<AgenteIA />} />
                  <Route path="/aquecimento" element={<AquecimentoNumero />} />
                  <Route
                    path="/admin/aquecimento"
                    element={
                      <AdminRouteGuard>
                        <AdminAquecimento />
                      </AdminRouteGuard>
                    }
                  />
                  <Route path="/meta/dashboard" element={<DashboardMeta />} />
                  <Route path="/meta/templates" element={<TemplatesAprovados />} />
                  <Route path="/meta/enviar" element={<EnvioCloudAPI />} />
                  <Route path="/meta/configuracao" element={<ConfiguracaoMeta />} />
                  <Route path="/instagram/dashboard" element={<DashboardInstagram />} />
                  <Route path="/instagram/automacao" element={<AutomacaoComentarios />} />
                  <Route path="/instagram/campanhas" element={<CampanhasInstagram />} />
                  <Route path="/instagram/contatos" element={<ContatosInstagram />} />
                  <Route path="/instagram/configuracao" element={<ConfiguracaoInstagram />} />
                  {/* Telegram routes */}
                  <Route path="/telegram/dashboard" element={<TelegramDashboard />} />
                  <Route path="/telegram/criar-bot" element={<TelegramCriarBot />} />
                  <Route path="/telegram/atualizar-bot" element={<TelegramAtualizarBot />} />
                  <Route path="/telegram/planos" element={<TelegramPlaceholder title="Planos de Pagamento" description="Configure os planos de assinatura oferecidos pelo bot." />} />
                  <Route path="/telegram/redirecionamento" element={<TelegramPlaceholder title="Botões de Redirecionamento" description="Crie botões inline com URL para redirecionar usuários." />} />
                  <Route path="/telegram/administradores" element={<TelegramPlaceholder title="Administradores" description="Gerencie administradores dos seus bots e canais." />} />
                  <Route path="/telegram/grupos-canais" element={<TelegramPlaceholder title="Grupos e Canais" description="Gerencie os grupos e canais conectados ao bot." />} />
                  <Route path="/telegram/canal-free" element={<TelegramPlaceholder title="Canal Free" description="Configure o canal de acesso gratuito como funil de entrada." />} />
                  <Route path="/telegram/tarefas-afiliados" element={<TelegramPlaceholder title="Tarefas para Afiliados" description="Defina tarefas e missões para o programa de afiliados." />} />
                  <Route path="/telegram/referencia" element={<TelegramPlaceholder title="Links de Referência" description="Gere e gerencie links de indicação." />} />
                  <Route path="/telegram/resultados" element={<TelegramPlaceholder title="Resultados" description="Acompanhe resultados e provas sociais." />} />
                  <Route path="/telegram/contatos" element={<TelegramPlaceholder title="Contatos" description="Lista de usuários que interagiram com o bot." />} />
                  <Route path="/telegram/vendas" element={<TelegramPlaceholder title="Gestão de Vendas" description="Acompanhe vendas, assinaturas e renovações." />} />
                  <Route path="/telegram/chat" element={<TelegramPlaceholder title="Chat ao vivo" description="Atenda seus usuários do Telegram em tempo real." />} />
                  <Route path="/telegram/remarketing" element={<TelegramPlaceholder title="Remarketing" description="Envie campanhas de remarketing para a base." />} />
                  <Route path="/telegram/alertas" element={<TelegramPlaceholder title="Alertas" description="Configure alertas automáticos para eventos importantes." />} />
                  <Route path="/telegram/downsell" element={<TelegramPlaceholder title="Downsell" description="Crie ofertas de downsell para usuários que recusaram a oferta principal." />} />
                  <Route path="/telegram/integracoes" element={<TelegramPlaceholder title="Integrações" description="Conecte o Telegram a gateways, CRMs e outras ferramentas." />} />
                  <Route path="/telegram/traqueamento" element={<TelegramPlaceholder title="Traqueamento" description="Configure pixels e eventos de conversão." />} />
                  <Route path="/telegram/links-traqueamento" element={<TelegramPlaceholder title="Links de Traqueamento" description="Gere links rastreáveis para campanhas." />} />
                  <Route path="/telegram/links-utm" element={<TelegramPlaceholder title="Links UTM" description="Construa links com parâmetros UTM personalizados." />} />
                  <Route path="/gateway-checkout/products" element={<KycWrap><PayProducts /></KycWrap>} />
                  <Route path="/gateway-checkout/checkouts" element={<KycWrap><PayCheckouts /></KycWrap>} />
                  <Route path="/gateway-checkout/checkouts/new" element={<KycWrap><CheckoutBuilder /></KycWrap>} />
                  <Route path="/gateway-checkout/checkouts/edit/:id" element={<KycWrap><CheckoutBuilder /></KycWrap>} />
                  <Route path="/gateway-checkout/landing-pages" element={<KycWrap><PayLandingPages /></KycWrap>} />
                  <Route path="/gateway-checkout/reports" element={<KycWrap><PayReports /></KycWrap>} />
                  <Route path="/gateway-checkout/cart-recovery" element={<KycWrap><PayCartRecovery /></KycWrap>} />
                  <Route path="/gateway-checkout/pixels" element={<KycWrap><PayPixels /></KycWrap>} />
                  <Route path="/gateway-checkout/integrations" element={<KycWrap><PayIntegrations /></KycWrap>} />
                  <Route path="/gateway-checkout/settings" element={<KycWrap><PaySettings /></KycWrap>} />
                  <Route path="/gateway-checkout/withdrawals" element={<KycWrap><PayWithdrawals /></KycWrap>} />
                  <Route path="/gateway-checkout/fees" element={<KycWrap><AdminFees /></KycWrap>} />
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
                <Route path="/disparo-oculto" element={<DisparoOculto />} />
                <Route path="/admin/disparo-oculto" element={<AdminRouteGuard><AdminDisparoOculto /></AdminRouteGuard>} />
                <Route path="/pay/:slug" element={<PublicCheckout />} />
                <Route path="/pay/:slug/obrigado" element={<ThankYou />} />
                <Route path="/checkout/:slug" element={<PublicCheckout />} />
                <Route path="/checkout/:slug/obrigado" element={<ThankYou />} />
                <Route path="/pedido/:id" element={<PublicOrder />} />
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
