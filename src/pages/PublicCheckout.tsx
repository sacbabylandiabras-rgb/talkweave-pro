import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import CheckoutPreview from "@/components/gateway/CheckoutPreview";
import { TenantProvider } from "@/contexts/TenantContext";
import { useTenant } from "@/hooks/useTenant";
import { useCheckoutPresence } from "@/hooks/useCheckoutPresence";
import { initCheckoutPixels, trackPixelEvent, type PublicPixelConfig } from "@/lib/checkout-pixels";

interface CheckoutConfig {
  productName: string;
  offerName: string;
  price: number;
  originalPrice: number;
  buttonText: string;
  guaranteeDays: number;
  showGuarantee: boolean;
  showTimer: boolean;
  timerMinutes: number;
  format: string;
  primaryColor: string;
  bgColor: string;
  textColor: string;
  font: string;
  theme: "light" | "dark" | "custom";
  borderStyle: string;
  showSecurityBadges: boolean;
  creditCard: boolean;
  debitCard: boolean;
  pix: boolean;
  boleto: boolean;
  maxInstallments: number;
  pixDiscount: number;
  showCpf: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showBirthdate: boolean;
  showOrderBump: boolean;
  orderBumpText: string;
  orderBumpPrice: number;
  productImage: string;
  logoUrl: string;
  faviconUrl: string;
  templateId: string;
  templateName: string;
  [key: string]: any;
}

const defaultConfig: CheckoutConfig = {
  productName: "",
  offerName: "",
  price: 0,
  originalPrice: 0,
  buttonText: "Pagar Agora",
  guaranteeDays: 7,
  showGuarantee: true,
  showTimer: false,
  timerMinutes: 15,
  format: "one_step",
  primaryColor: "#EF4444",
  bgColor: "#EFF1F5",
  textColor: "#1F2937",
  font: "inter",
  theme: "light",
  borderStyle: "rounded",
  showSecurityBadges: true,
  creditCard: true,
  debitCard: false,
  pix: true,
  boleto: false,
  maxInstallments: 12,
  pixDiscount: 0,
  showCpf: true,
  showPhone: true,
  showAddress: false,
  showBirthdate: false,
  showOrderBump: false,
  orderBumpText: "",
  orderBumpPrice: 0,
  productImage: "",
  logoUrl: "",
  faviconUrl: "",
  pageTitle: "",
  templateId: "",
  templateName: "",
};

const resolveTemplateId = (savedConfig: Record<string, any>) => {
  if (savedConfig.templateId) return savedConfig.templateId;

  const normalizedName = String(savedConfig.templateName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizedName.includes("tiktok") || normalizedName.includes("toklynx")) return "tiktok";
  if (normalizedName.includes("alto impacto")) return "alto-impacto";
  if (normalizedName.includes("minimalista")) return "minimalista";
  if (normalizedName.includes("streamline")) return "streamline";
  if (normalizedName.includes("lynxfy")) return "lynxfy";
  if (normalizedName.includes("confianca")) return "confianca";

  return "";
};

export default function PublicCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutOwnerId, setCheckoutOwnerId] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>("");
  const [pixels, setPixels] = useState<PublicPixelConfig[]>([]);
  const { tenant, loading: tenantLoading } = useTenant();

  useCheckoutPresence(slug, checkoutOwnerId, productName);

  useEffect(() => {
    if (!slug) return;

    const fetchCheckout = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/get-checkout?slug=${encodeURIComponent(slug)}`,
          {
            headers: {
              "apikey": anonKey,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          setError("Checkout não encontrado");
          setLoading(false);
          return;
        }

        const result = await res.json();
        const checkout = result.checkout;
        const product = result.product;
        const plans = result.plans || [];
        const fetchedPixels: PublicPixelConfig[] = Array.isArray(result.pixels) ? result.pixels : [];
        setPixels(fetchedPixels);
        const savedConfig = (checkout.config || {}) as Record<string, any>;
        const resolvedTemplateId = resolveTemplateId(savedConfig);

        setCheckoutOwnerId(typeof checkout?.user_id === "string" ? checkout.user_id : null);

        const resolvedProductName = product?.name || checkout.name || "";
        setProductName(resolvedProductName);

        const tenantLogo = tenant?.logo_url || "";
        const tenantColor = tenant?.primary_color || "";

        // Se houver um parâmetro 'plan' na URL, usamos o preço desse plano
        const selectedPlanId = searchParams.get("plan");
        const selectedPlan = plans.find((p: any) => p.id === selectedPlanId);
        
        const initialPrice = selectedPlan ? Number(selectedPlan.price) : (product?.price ?? savedConfig.price ?? 0);
        const initialProductName = selectedPlan ? `${resolvedProductName} - ${selectedPlan.name}` : (savedConfig.productName || resolvedProductName);

        const mergedConfig: CheckoutConfig = {
          ...defaultConfig,
          ...savedConfig,
          templateId: resolvedTemplateId,
          productName: initialProductName,
          offerName: initialProductName,
          price: initialPrice,
          productImage: product?.image_url || savedConfig.productImage || "",
          logoUrl: savedConfig.logoUrl || tenantLogo || "",
          faviconUrl: savedConfig.faviconUrl || "",
          pageTitle: savedConfig.pageTitle || "",
          primaryColor: savedConfig.primaryColor || tenantColor || defaultConfig.primaryColor,
          plans: plans, // Passamos todos os planos para o componente
        };
        setConfig(mergedConfig);
      } catch (e) {
        setError("Erro ao carregar checkout");
      } finally {
        setLoading(false);
      }
    };

    fetchCheckout();
  }, [slug, tenant]);

  useEffect(() => {
    if (config?.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = config.faviconUrl;
      link.type = "image/png";
    }
    if (config?.pageTitle) {
      document.title = config.pageTitle;
    }
  }, [config?.faviconUrl, config?.pageTitle]);

  // Inject configured pixels (Meta/TikTok/Google) and fire PageView once
  useEffect(() => {
    if (!pixels.length || !config) return;
    initCheckoutPixels(pixels);
    trackPixelEvent(pixels, "PageView");
    trackPixelEvent(pixels, "InitiateCheckout", {
      value: config.price || 0,
      currency: "BRL",
    });
  }, [pixels, config?.price]);

  if (loading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#EFF1F5" }}>
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#EFF1F5" }}>
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-gray-700">Link de pagamento inválido ou expirado.</p>
          <p className="text-sm text-gray-500">Este link pode estar inativo ou não existe.</p>
        </div>
      </div>
    );
  }

  return (
    <TenantProvider tenant={tenant}>
      <div className="min-h-screen" style={{ background: config.bgColor || "#EFF1F5" }}>
        <CheckoutPreview config={config as any} elements={(config as any).elements || []} />
      </div>
    </TenantProvider>
  );
}
