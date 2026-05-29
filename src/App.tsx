import { Suspense } from "react";
import { lazyWithRecovery } from "@/lib/chunk-load-recovery";
 const Canais = lazyWithRecovery(() => import("./pages/Canais"));
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorkspaceProvider, WorkspaceRouteSync } from "@/contexts/WorkspaceContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { usePushNotifications } from "./hooks/usePushNotifications";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import { Capacitor } from "@capacitor/core";

const Landing = lazyWithRecovery(() => import("./pages/Landing"));
const LandingWhatsApp = lazyWithRecovery(() => import("./pages/LandingWhatsApp"));
const Auth = lazyWithRecovery(() => import("./pages/Auth"));
import NativeAppLayout from "./components/layout/NativeAppLayout";
const Dashboard = lazyWithRecovery(() => import("./pages/Dashboard"));
const DashboardMeta = lazyWithRecovery(() => import("./pages/DashboardMeta"));
const Admin = lazyWithRecovery(() => import("./pages/Admin"));
const Dispositivos = lazyWithRecovery(() => import("./pages/Dispositivos"));
const Perfil = lazyWithRecovery(() => import("./pages/Perfil"));
const PerfilEmpresa = lazyWithRecovery(() => import("./pages/PerfilEmpresa"));
const Etiquetas = lazyWithRecovery(() => import("./pages/Etiquetas"));
const Campanhas = lazyWithRecovery(() => import("./pages/Campanhas"));
const CampanhaGrupoFluxo = lazyWithRecovery(() => import("./pages/CampanhaGrupoFluxo"));
const Contatos = lazyWithRecovery(() => import("./pages/Contatos"));
 const Modelos = lazyWithRecovery(() => import("./pages/Modelos"));
const EnviarMensagem = lazyWithRecovery(() => import("./pages/EnviarMensagem"));
const Relatorio = lazyWithRecovery(() => import("./pages/Relatorio"));
const FluxoVisual = lazyWithRecovery(() => import("./pages/FluxoVisual"));
const FluxoMeta = lazyWithRecovery(() => import("./pages/FluxoMeta"));
const FluxoGrupos = lazyWithRecovery(() => import("./pages/FluxoGrupos"));
const GatewayIntegracoes = lazyWithRecovery(() => import("./pages/GatewayIntegracoes"));
const MensagensRecebidas = lazyWithRecovery(() => import("./pages/MensagensRecebidas"));

const ExtractMembers = lazyWithRecovery(() => import("./pages/ExtractMembers"));
const AgenteIA = lazyWithRecovery(() => import("./pages/AgenteIA"));
const Departamento = lazyWithRecovery(() => import("./pages/Departamento"));
const Skills = lazyWithRecovery(() => import("./pages/Skills"));
const Produtos = lazyWithRecovery(() => import("./pages/Produtos"));
const AquecimentoNumero = lazyWithRecovery(() => import("./pages/AquecimentoNumero"));
const NotificacoesApp = lazyWithRecovery(() => import("./pages/NotificacoesApp"));

const InvitePage = lazyWithRecovery(() => import("./pages/InvitePage"));
const NotFound = lazyWithRecovery(() => import("./pages/NotFound"));
const TemplatesAprovados = lazyWithRecovery(() => import("./pages/TemplatesAprovados"));
const EnvioCloudAPI = lazyWithRecovery(() => import("./pages/EnvioCloudAPI"));
const MetaMessages = lazyWithRecovery(() => import("./pages/MetaMessages"));
const ConfiguracaoMeta = lazyWithRecovery(() => import("./pages/ConfiguracaoMeta"));
const PoliticaPrivacidade = lazyWithRecovery(() => import("./pages/PoliticaPrivacidade"));
const PreviewApp = lazyWithRecovery(() => import("./pages/PreviewApp"));
const CustomInputPage = lazyWithRecovery(() => import("./pages/CustomInputPage"));
const TermosServico = lazyWithRecovery(() => import("./pages/TermosServico"));
const ExclusaoDados = lazyWithRecovery(() => import("./pages/ExclusaoDados"));
const MetaOAuthCallback = lazyWithRecovery(() => import("./pages/MetaOAuthCallback"));
const ShopifyOAuthCallback = lazyWithRecovery(() => import("./pages/ShopifyOAuthCallback"));
const ShopifyEmbedded = lazyWithRecovery(() => import("./pages/ShopifyEmbedded"));
const PayDashboard = lazyWithRecovery(() => import("./pages/gateway/PayDashboard"));
const PayProducts = lazyWithRecovery(() => import("./pages/gateway/PayProducts"));
const PayProductManagement = lazyWithRecovery(() => import("./pages/gateway/PayProductManagement"));
const PayCheckouts = lazyWithRecovery(() => import("./pages/gateway/PayCheckouts"));
const PayLandingPages = lazyWithRecovery(() => import("./pages/gateway/PayLandingPages"));
const PayReports = lazyWithRecovery(() => import("./pages/gateway/PayReports"));
const PayCartRecovery = lazyWithRecovery(() => import("./pages/gateway/PayCartRecovery"));
const PayPixels = lazyWithRecovery(() => import("./pages/gateway/PayPixels"));
const PayIntegrations = lazyWithRecovery(() => import("./pages/gateway/PayIntegrations"));
const PaySettings = lazyWithRecovery(() => import("./pages/gateway/PaySettings"));
const PayWithdrawals = lazyWithRecovery(() => import("./pages/gateway/PayWithdrawals"));
const PayDocs = lazyWithRecovery(() => import("./pages/gateway/PayDocs"));
const PayMarketplace = lazyWithRecovery(() => import("./pages/gateway/PayMarketplace"));
const PayAffiliates = lazyWithRecovery(() => import("./pages/gateway/PayAffiliates"));
const PayMyAffiliations = lazyWithRecovery(() => import("./pages/gateway/PayMyAffiliations"));
const AdminPayDashboard = lazyWithRecovery(() => import("./pages/gateway/AdminDashboard"));
const AdminCompanies = lazyWithRecovery(() => import("./pages/gateway/AdminCompanies"));
const AdminAcquirers = lazyWithRecovery(() => import("./pages/gateway/AdminAcquirers"));
const AdminFees = lazyWithRecovery(() => import("./pages/gateway/AdminFees"));
const AdminPayUsers = lazyWithRecovery(() => import("./pages/gateway/AdminUsers"));
const AdminKYC = lazyWithRecovery(() => import("./pages/gateway/AdminKYC"));
const AdminPayReports = lazyWithRecovery(() => import("./pages/gateway/AdminReports"));
const AdminTransactions = lazyWithRecovery(() => import("./pages/gateway/AdminTransactions"));
const AdminManagers = lazyWithRecovery(() => import("./pages/gateway/AdminManagers"));
const AdminWithdrawals = lazyWithRecovery(() => import("./pages/gateway/AdminWithdrawals"));
const ManagerDashboard = lazyWithRecovery(() => import("./pages/gateway/ManagerDashboard"));
const ManagerClients = lazyWithRecovery(() => import("./pages/gateway/ManagerClients"));
const ManagerCommissions = lazyWithRecovery(() => import("./pages/gateway/ManagerCommissions"));
const ManagerReferral = lazyWithRecovery(() => import("./pages/gateway/ManagerReferral"));
const CheckoutBuilder = lazyWithRecovery(() => import("./pages/gateway/CheckoutBuilder"));
const PublicCheckout = lazyWithRecovery(() => import("./pages/PublicCheckout"));
const PublicLandingPreview = lazyWithRecovery(() => import("./pages/PublicLandingPreview"));
const PublicRedirectTracker = lazyWithRecovery(() => import("./pages/PublicRedirectTracker"));
const ThankYou = lazyWithRecovery(() => import("./pages/ThankYou"));
const PublicOrder = lazyWithRecovery(() => import("./pages/PublicOrder"));
import GatewayKycGate from "./components/gateway/GatewayKycGate";
import AdminRouteGuard from "./components/admin/AdminRouteGuard";
import { PaidRouteGuard } from "./components/auth/PaidRouteGuard";
const AutomacaoComentarios = lazyWithRecovery(() => import("./pages/instagram/AutomacaoComentarios"));
const CampanhasInstagram = lazyWithRecovery(() => import("./pages/instagram/CampanhasInstagram"));
const ContatosInstagram = lazyWithRecovery(() => import("./pages/instagram/ContatosInstagram"));
const ConfiguracaoInstagram = lazyWithRecovery(() => import("./pages/instagram/ConfiguracaoInstagram"));
const TelegramPlaceholder = lazyWithRecovery(() => import("./pages/telegram/TelegramPlaceholder"));
const TelegramPlanos = lazyWithRecovery(() => import("./pages/telegram/TelegramPlanos"));
const TelegramRedirecionamento = lazyWithRecovery(() => import("./pages/telegram/TelegramRedirecionamento"));
const TelegramAdministradores = lazyWithRecovery(() => import("./pages/telegram/TelegramAdministradores"));
const TelegramGruposCanais = lazyWithRecovery(() => import("./pages/telegram/TelegramGruposCanais"));
const TelegramCanalFree = lazyWithRecovery(() => import("./pages/telegram/TelegramCanalFree"));
const TelegramReferencia = lazyWithRecovery(() => import("./pages/telegram/TelegramReferencia"));
const TelegramContatos = lazyWithRecovery(() => import("./pages/telegram/TelegramContatos"));
const TelegramVendas = lazyWithRecovery(() => import("./pages/telegram/TelegramVendas"));
const TelegramChat = lazyWithRecovery(() => import("./pages/telegram/TelegramChat"));
const TelegramCriarBot = lazyWithRecovery(() => import("./pages/telegram/TelegramCriarBot"));
const TelegramAtualizarBot = lazyWithRecovery(() => import("./pages/telegram/TelegramAtualizarBot"));
const TelegramDashboard = lazyWithRecovery(() => import("./pages/telegram/TelegramDashboard"));
const TelegramAlertas = lazyWithRecovery(() => import("./pages/telegram/TelegramAlertas"));
const TelegramDownsell = lazyWithRecovery(() => import("./pages/telegram/TelegramDownsell"));
const TelegramIntegracoes = lazyWithRecovery(() => import("./pages/telegram/TelegramIntegracoes"));
const TelegramLinksTraqueamento = lazyWithRecovery(() => import("./pages/telegram/TelegramLinksTraqueamento"));
const TelegramLinksUtm = lazyWithRecovery(() => import("./pages/telegram/TelegramLinksUtm"));
 const DashboardInstagram = lazyWithRecovery(() => import("./pages/instagram/DashboardInstagram"));
 const ModelosInstagram = lazyWithRecovery(() => import("./pages/instagram/ModelosInstagram"));
const EnviarInstagram = lazyWithRecovery(() => import("./pages/instagram/EnviarInstagram"));
 const InstagramMessages = lazyWithRecovery(() => import("./pages/instagram/InstagramMessages"));

const DisparoOculto = lazyWithRecovery(() => import("./pages/DisparoOculto"));
const AdminDisparoOculto = lazyWithRecovery(() => import("./pages/AdminDisparoOculto"));
const Comunidades = lazyWithRecovery(() => import("./pages/Comunidades"));

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
     <ThemeProvider attribute="data-theme" defaultTheme="white" enableSystem={false} forcedTheme="white">
      <TooltipProvider>
        <WorkspaceProvider>
          <Toaster />
          <Sonner />
          <AppContent />
           <BrowserRouter>
             <Suspense fallback={null}>
               <WorkspaceRouteSync />
               {isNative ? (
                 <Routes>
                 <Route path="/auth" element={<Auth />} />
                 <Route path="/login" element={<Auth />} />
                   <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
                   <Route path="/termos-servico" element={<TermosServico />} />
                   <Route path="/exclusao-dados" element={<ExclusaoDados />} />
                   <Route path="*" element={<NativeAppLayout />} />
                 </Routes>
               ) : (
                 <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/whatsapp" element={<LandingWhatsApp />} />
                <Route path="/auth" element={<Auth />} />
                 <Route path="/preview-app" element={<PreviewApp />} />
                  <Route path="/aplicativo" element={<CustomInputPage />} />
                  <Route path="/aplicativo/index.html" element={<CustomInputPage />} />
                 <Route path="/exclusao-dados" element={<ExclusaoDados />} />
                 <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
                <Route path="/shopify-oauth-callback" element={<ShopifyOAuthCallback />} />
                <Route path="/shopify/callback" element={<ShopifyEmbedded />} />
                <Route path="/shopify/embedded" element={<ShopifyEmbedded />} />
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/gateway-checkout/dashboard" element={<KycWrap><PayDashboard /></KycWrap>} />
                  <Route path="/perfil" element={<Perfil />} />
                  <Route path="/perfil-empresa" element={<PerfilEmpresa />} />
                  <Route path="/etiquetas" element={<Etiquetas />} />
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
                  <Route path="/enviar" element={<EnviarMensagem />} />
                   <Route path="/mensagens" element={<MensagensRecebidas mode="chat" />} />
                  <Route path="/pipeline" element={<MensagensRecebidas mode="pipeline" />} />
                  <Route path="/notificacoes" element={<NotificacoesApp />} />
                  
                  <Route path="/extrair-membros" element={<PaidRouteGuard><ExtractMembers /></PaidRouteGuard>} />
                  <Route path="/comunidades" element={<PaidRouteGuard><Comunidades /></PaidRouteGuard>} />
                   <Route path="/canais" element={<PaidRouteGuard><Canais /></PaidRouteGuard>} />
                   
                   <Route path="/agente-ia" element={<AgenteIA />} />
                   <Route path="/departamento" element={<Departamento />} />
                   <Route path="/skills" element={<Skills />} />
                   <Route path="/produtos" element={<Produtos />} />
                   <Route path="/meta/dashboard" element={<DashboardMeta />} />
                   <Route path="/meta/mensagens" element={<MetaMessages />} />
                   <Route path="/meta/templates" element={<TemplatesAprovados />} />
                   <Route path="/meta/enviar" element={<EnvioCloudAPI />} />
                   <Route path="/meta/fluxo" element={<FluxoMeta />} />
                   <Route path="/meta/configuracao" element={<ConfiguracaoMeta />} />
                   <Route path="/meta/campanhas" element={<Campanhas mode="contacts" />} />
                   <Route path="/meta/contatos" element={<Contatos />} />
                   <Route path="/meta/relatorio" element={<Relatorio />} />
                   <Route path="/meta/gateway" element={<GatewayIntegracoes />} />
                   <Route path="/instagram/dashboard" element={<DashboardInstagram />} />
                   <Route path="/instagram/enviar" element={<EnviarInstagram />} />
                   <Route path="/instagram/mensagens" element={<InstagramMessages />} />
                   <Route path="/instagram/modelos" element={<ModelosInstagram />} />
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
                  <Route path="/gateway-checkout/products/new" element={<KycWrap><PayProductManagement /></KycWrap>} />
                  <Route path="/gateway-checkout/products/edit/:id" element={<KycWrap><PayProductManagement /></KycWrap>} />
                  <Route path="/gateway-checkout/checkouts" element={<KycWrap><PayCheckouts /></KycWrap>} />
                  <Route path="/gateway-checkout/checkouts/new" element={<KycWrap><CheckoutBuilder /></KycWrap>} />
                  <Route path="/gateway-checkout/checkouts/edit/:id" element={<KycWrap><CheckoutBuilder /></KycWrap>} />
                  <Route path="/gateway-checkout/landing-pages" element={<KycWrap><PayLandingPages /></KycWrap>} />
                  <Route path="/gateway-checkout/reports" element={<KycWrap><PayReports /></KycWrap>} />
                  <Route path="/gateway-checkout/marketplace" element={<KycWrap><PayMarketplace /></KycWrap>} />
                  <Route path="/gateway-checkout/my-affiliations" element={<KycWrap><PayMyAffiliations /></KycWrap>} />
                  <Route path="/gateway-checkout/affiliates" element={<KycWrap><PayAffiliates /></KycWrap>} />
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
