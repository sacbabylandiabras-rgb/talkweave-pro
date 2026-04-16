import { lazy, Suspense } from "react";
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
import { Loader2 } from "lucide-react";

// Lazy load all pages
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const NativeAppLayout = lazy(() => import("./components/layout/NativeAppLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DashboardMeta = lazy(() => import("./pages/DashboardMeta"));
const Admin = lazy(() => import("./pages/Admin"));
const Dispositivos = lazy(() => import("./pages/Dispositivos"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Campanhas = lazy(() => import("./pages/Campanhas"));
const Contatos = lazy(() => import("./pages/Contatos"));
const Modelos = lazy(() => import("./pages/Modelos"));
const EnviarMensagem = lazy(() => import("./pages/EnviarMensagem"));
const Relatorio = lazy(() => import("./pages/Relatorio"));
const ConfiguracaoZAPI = lazy(() => import("./pages/ConfiguracaoZAPI"));
const FluxoVisual = lazy(() => import("./pages/FluxoVisual"));
const GatewayIntegracoes = lazy(() => import("./pages/GatewayIntegracoes"));
const MensagensRecebidas = lazy(() => import("./pages/MensagensRecebidas"));
const ApanhadorGrupos = lazy(() => import("./pages/ApanhadorGrupos"));
const CriarGrupos = lazy(() => import("./pages/CriarGrupos"));
const AgenteIA = lazy(() => import("./pages/AgenteIA"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TemplatesAprovados = lazy(() => import("./pages/TemplatesAprovados"));
const EnvioCloudAPI = lazy(() => import("./pages/EnvioCloudAPI"));
const ConfiguracaoMeta = lazy(() => import("./pages/ConfiguracaoMeta"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const TermosServico = lazy(() => import("./pages/TermosServico"));
const MetaOAuthCallback = lazy(() => import("./pages/MetaOAuthCallback"));
const ShopifyOAuthCallback = lazy(() => import("./pages/ShopifyOAuthCallback"));
const PayDashboard = lazy(() => import("./pages/gateway/PayDashboard"));
const PayProducts = lazy(() => import("./pages/gateway/PayProducts"));
const PayCheckouts = lazy(() => import("./pages/gateway/PayCheckouts"));
const PayReports = lazy(() => import("./pages/gateway/PayReports"));
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
const ThankYou = lazy(() => import("./pages/ThankYou"));
const GatewayKycGate = lazy(() => import("./components/gateway/GatewayKycGate").then(m => ({ default: m.default })));
const AutomacaoComentarios = lazy(() => import("./pages/instagram/AutomacaoComentarios"));
const CampanhasInstagram = lazy(() => import("./pages/instagram/CampanhasInstagram"));
const ContatosInstagram = lazy(() => import("./pages/instagram/ContatosInstagram"));
const ConfiguracaoInstagram = lazy(() => import("./pages/instagram/ConfiguracaoInstagram"));
const DashboardInstagram = lazy(() => import("./pages/instagram/DashboardInstagram"));
const ExtrairComunidade = lazy(() => import("./pages/ExtrairComunidade"));

const queryClient = new QueryClient();

const isNative = Capacitor.isNativePlatform();

function AppContent() {
  usePushNotifications();
  return null;
}

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const KycWrap = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>
    <GatewayKycGate>{children}</GatewayKycGate>
  </Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <WorkspaceProvider>
          <Toaster />
          <Sonner />
          <AppContent />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
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
                    <Route path="/gateway-checkout/dashboard" element={<KycWrap><PayDashboard /></KycWrap>} />
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
                    <Route path="/gateway-checkout/products" element={<KycWrap><PayProducts /></KycWrap>} />
                    <Route path="/gateway-checkout/checkouts" element={<KycWrap><PayCheckouts /></KycWrap>} />
                    <Route path="/gateway-checkout/checkouts/new" element={<KycWrap><CheckoutBuilder /></KycWrap>} />
                    <Route path="/gateway-checkout/checkouts/edit/:id" element={<KycWrap><CheckoutBuilder /></KycWrap>} />
                    <Route path="/gateway-checkout/reports" element={<KycWrap><PayReports /></KycWrap>} />
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
                  <Route path="/pay/:slug" element={<PublicCheckout />} />
                  <Route path="/pay/:slug/obrigado" element={<ThankYou />} />
                  <Route path="/checkout/:slug" element={<PublicCheckout />} />
                  <Route path="/checkout/:slug/obrigado" element={<ThankYou />} />
                  <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
                  <Route path="/termos-servico" element={<TermosServico />} />
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
