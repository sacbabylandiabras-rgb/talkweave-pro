import { lazy, Suspense } from "react";
const Canais = lazy(() => import("./pages/Canais"));
const Extensao = lazy(() => import("./pages/Extensao"));
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

const Landing = lazy(() => import("./pages/Landing"));
const LandingWhatsApp = lazy(() => import("./pages/LandingWhatsApp"));
const Auth = lazy(() => import("./pages/Auth"));
import NativeAppLayout from "./components/layout/NativeAppLayout";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DashboardMeta = lazy(() => import("./pages/DashboardMeta"));
const Admin = lazy(() => import("./pages/Admin"));
const Dispositivos = lazy(() => import("./pages/Dispositivos"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Campanhas = lazy(() => import("./pages/Campanhas"));
const CampanhaGrupoFluxo = lazy(() => import("./pages/CampanhaGrupoFluxo"));
const Contatos = lazy(() => import("./pages/Contatos"));
const Modelos = lazy(() => import("./pages/Modelos"));
const EnviarMensagem = lazy(() => import("./pages/EnviarMensagem"));
const Relatorio = lazy(() => import("./pages/Relatorio"));
const FluxoVisual = lazy(() => import("./pages/FluxoVisual"));
const FluxoGrupos = lazy(() => import("./pages/FluxoGrupos"));
const GatewayIntegracoes = lazy(() => import("./pages/GatewayIntegracoes"));
const MensagensRecebidas = lazy(() => import("./pages/MensagensRecebidas"));
const ApanhadorGrupos = lazy(() => import("./pages/ApanhadorGrupos"));
const CriarGrupos = lazy(() => import("./pages/CriarGrupos"));
const AgenteIA = lazy(() => import("./pages/AgenteIA"));
const AquecimentoNumero = lazy(() => import("./pages/AquecimentoNumero"));
const NotificacoesApp = lazy(() => import("./pages/NotificacoesApp"));
const AdminAquecimento = lazy(() => import("./pages/AdminAquecimento"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TemplatesAprovados = lazy(() => import("./pages/TemplatesAprovados"));
const EnvioCloudAPI = lazy(() => import("./pages/EnvioCloudAPI"));
const ConfiguracaoMeta = lazy(() => import("./pages/ConfiguracaoMeta"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const PreviewApp = lazy(() => import("./pages/PreviewApp"));
const CustomInputPage = lazy(() => import("./pages/CustomInputPage"));
const TermosServico = lazy(() => import("./pages/TermosServico"));
const MetaOAuthCallback = lazy(() => import("./pages/MetaOAuthCallback"));
const ShopifyOAuthCallback = lazy(() => import("./pages/ShopifyOAuthCallback"));
const ShopifyEmbedded = lazy(() => import("./pages/ShopifyEmbedded"));
const PayDashboard = lazy(() => import("./pages/gateway/PayDashboard"));
const PayProducts = lazy(() => import("./pages/gateway/PayProducts"));
const PayCheckouts = lazy(() => import("./pages/gateway/PayCheckouts"));
const PayLandingPages = lazy(() => import("./pages/gateway/PayLandingPages"));
const PayReports = lazy(() => import("./pages/gateway/PayReports"));
const PayCartRecovery = lazy(() => import("./pages/gateway/PayCartRecovery"));
const PayPixels = lazy(() => import("./pages/gateway/PayPixels"));
const PayIntegrations = lazy(() => import("./pages/gateway/PayIntegrations"));
const PaySettings = lazy(() => import("./pages/gateway/PaySettings"));
const PayWithdrawals = lazy(() => import("./pages/gateway/PayWithdrawals"));
const PayDocs = lazy(() => import("./pages/gateway/PayDocs"));
const AdminPayDashboard = lazy(() => import("./pages/gateway/AdminDashboard"));
const AdminCompanies = lazy(() => import("./pages/gateway/AdminCompanies"));
const AdminAcquirers = lazy(() => import("./pages/gateway/AdminAcquirers"));
const AdminFees = lazy(() => import("./pages/gateway/AdminFees"));
const AdminPayUsers = lazy(() => import("./pages/gateway/AdminUsers"));
const AdminKYC = lazy(() => import("./pages/gateway/AdminKYC"));
const AdminPayReports = lazy(() => import("./pages/gateway/AdminReports"));
const AdminTransactions = lazy(() => import("./pages/gateway/AdminTransactions"));
const AdminManagers = lazy(() => import("./pages/gateway/AdminManagers"));
const AdminWithdrawals = lazy(() => import("./pages/gateway/AdminWithdrawals"));
const ManagerDashboard = lazy(() => import("./pages/gateway/ManagerDashboard"));
const ManagerClients = lazy(() => import("./pages/gateway/ManagerClients"));
const ManagerCommissions = lazy(() => import("./pages/gateway/ManagerCommissions"));
const ManagerReferral = lazy(() => import("./pages/gateway/ManagerReferral"));
const CheckoutBuilder = lazy(() => import("./pages/gateway/CheckoutBuilder"));
const PublicCheckout = lazy(() => import("./pages/PublicCheckout"));
const PublicLandingPreview = lazy(() => import("./pages/PublicLandingPreview"));
const PublicRedirectTracker = lazy(() => import("./pages/PublicRedirectTracker"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const PublicOrder = lazy(() => import("./pages/PublicOrder"));
import GatewayKycGate from "./components/gateway/GatewayKycGate";
import AdminRouteGuard from "./components/admin/AdminRouteGuard";
import { PaidRouteGuard } from "./components/auth/PaidRouteGuard";
const AutomacaoComentarios = lazy(() => import("./pages/instagram/AutomacaoComentarios"));
const CampanhasInstagram = lazy(() => import("./pages/instagram/CampanhasInstagram"));
const ContatosInstagram = lazy(() => import("./pages/instagram/ContatosInstagram"));
const ConfiguracaoInstagram = lazy(() => import("./pages/instagram/ConfiguracaoInstagram"));
const TelegramPlaceholder = lazy(() => import("./pages/telegram/TelegramPlaceholder"));
const TelegramPlanos = lazy(() => import("./pages/telegram/TelegramPlanos"));
const TelegramRedirecionamento = lazy(() => import("./pages/telegram/TelegramRedirecionamento"));
const TelegramAdministradores = lazy(() => import("./pages/telegram/TelegramAdministradores"));
const TelegramGruposCanais = lazy(() => import("./pages/telegram/TelegramGruposCanais"));
const TelegramCanalFree = lazy(() => import("./pages/telegram/TelegramCanalFree"));
const TelegramReferencia = lazy(() => import("./pages/telegram/TelegramReferencia"));
const TelegramContatos = lazy(() => import("./pages/telegram/TelegramContatos"));
const TelegramVendas = lazy(() => import("./pages/telegram/TelegramVendas"));
const TelegramChat = lazy(() => import("./pages/telegram/TelegramChat"));
const TelegramCriarBot = lazy(() => import("./pages/telegram/TelegramCriarBot"));
const TelegramAtualizarBot = lazy(() => import("./pages/telegram/TelegramAtualizarBot"));
const TelegramDashboard = lazy(() => import("./pages/telegram/TelegramDashboard"));
const TelegramAlertas = lazy(() => import("./pages/telegram/TelegramAlertas"));
const TelegramDownsell = lazy(() => import("./pages/telegram/TelegramDownsell"));
const TelegramIntegracoes = lazy(() => import("./pages/telegram/TelegramIntegracoes"));
const TelegramLinksTraqueamento = lazy(() => import("./pages/telegram/TelegramLinksTraqueamento"));
const TelegramLinksUtm = lazy(() => import("./pages/telegram/TelegramLinksUtm"));
const DashboardInstagram = lazy(() => import("./pages/instagram/DashboardInstagram"));
const ExtrairComunidade = lazy(() => import("./pages/ExtrairComunidade"));
const DisparoOculto = lazy(() => import("./pages/DisparoOculto"));
const AdminDisparoOculto = lazy(() => import("./pages/AdminDisparoOculto"));
const Comunidades = lazy(() => import("./pages/Comunidades"));
const Status = lazy(() => import("./pages/Status"));

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
             <Suspense fallback={<div className="min-h-screen bg-[#0f1117] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div></div>}>
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
                <Route path="/whatsapp" element={<LandingWhatsApp />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/preview-app" element={<PreviewApp />} />
                <Route path="/notificacoes-app" element={<CustomInputPage />} />
                <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
                <Route path="/shopify-oauth-callback" element={<ShopifyOAuthCallback />} />
                <Route path="/shopify/callback" element={<ShopifyEmbedded />} />
                <Route path="/shopify/embedded" element={<ShopifyEmbedded />} />
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/gateway-checkout/dashboard" element={<KycWrap><PayDashboard /></KycWrap>} />
                  <Route path="/perfil" element={<Perfil />} />
                  <Route path="/campanhas" element={<Campanhas />} />
                  <Route path="/campanhas-grupo" element={<Campanhas mode="groups" />} />
                  <Route path="/campanhas-grupo/nova" element={<CampanhaGrupoFluxo />} />
                  <Route path="/contatos" element={<Contatos />} />
                  <Route path="/relatorio" element={<Relatorio />} />
                  <Route path="/gateway" element={<GatewayIntegracoes />} />
                  <Route path="/admin" element={<AdminRouteGuard><Admin /></AdminRouteGuard>} />
                  <Route path="/dispositivos" element={<Dispositivos />} />
                  <Route path="/modelos" element={<Modelos />} />
                  <Route path="/fluxo-visual" element={<FluxoVisual />} />
                  <Route path="/fluxo-grupos" element={<FluxoGrupos />} />
                  <Route path="/enviar-mensagem" element={<EnviarMensagem />} />
                  <Route path="/mensagens" element={<MensagensRecebidas />} />
                  <Route path="/notificacoes" element={<NotificacoesApp />} />
                  <Route path="/apanhador-grupos" element={<PaidRouteGuard><ApanhadorGrupos /></PaidRouteGuard>} />
                  <Route path="/criar-grupos" element={<PaidRouteGuard><CriarGrupos /></PaidRouteGuard>} />
                  <Route path="/comunidades" element={<PaidRouteGuard><Comunidades /></PaidRouteGuard>} />
                  <Route path="/canais" element={<PaidRouteGuard><Canais /></PaidRouteGuard>} />
                  <Route path="/status" element={<PaidRouteGuard><Status /></PaidRouteGuard>} />
                  <Route path="/extrair-comunidade" element={<ExtrairComunidade />} />
                  <Route path="/extensao" element={<Extensao />} />
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
                  <Route path="/telegram/planos" element={<TelegramPlanos />} />
                  <Route path="/telegram/redirecionamento" element={<TelegramRedirecionamento />} />
                  <Route path="/telegram/administradores" element={<TelegramAdministradores />} />
                  <Route path="/telegram/grupos-canais" element={<TelegramGruposCanais />} />
                  <Route path="/telegram/canal-free" element={<TelegramCanalFree />} />
                  <Route path="/telegram/referencia" element={<TelegramReferencia />} />
                  <Route path="/telegram/contatos" element={<TelegramContatos />} />
                  <Route path="/telegram/vendas" element={<TelegramVendas />} />
                  <Route path="/telegram/chat" element={<TelegramChat />} />
                  <Route path="/telegram/alertas" element={<TelegramAlertas />} />
                  <Route path="/telegram/downsell" element={<TelegramDownsell />} />
                  <Route path="/telegram/integracoes" element={<TelegramIntegracoes />} />
                  <Route path="/telegram/traqueamento" element={<TelegramPlaceholder title="Traqueamento" description="Configure pixels e eventos de conversão." />} />
                  <Route path="/telegram/links-traqueamento" element={<TelegramLinksTraqueamento />} />
                  <Route path="/telegram/links-utm" element={<TelegramLinksUtm />} />
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
                <Route path="/lp/:pageId/*" element={<PublicLandingPreview />} />
                <Route path="/pedido/:id" element={<PublicOrder />} />
                <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/termos-servico" element={<TermosServico />} />
                <Route path="/r" element={<PublicRedirectTracker />} />
                <Route path="*" element={<NotFound />} />
                 </Routes>
               )}
             </Suspense>
            {!isNative && <WhatsAppFloatingButton />}
          </BrowserRouter>
        </WorkspaceProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
