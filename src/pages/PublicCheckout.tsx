import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import CheckoutPreview from "@/components/gateway/CheckoutPreview";

const defaultConfig = {
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
  theme: "light" as const,
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
};

export default function PublicCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const [config, setConfig] = useState<typeof defaultConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const savedConfig = checkout.config || {};

        const productName = product?.name || checkout.name || "";
        setConfig({
          ...defaultConfig,
          ...savedConfig,
          productName: savedConfig.productName || productName,
          offerName: savedConfig.offerName || productName,
          price: savedConfig.price || (product?.price ? product.price : 0),
          productImage: savedConfig.productImage || product?.image_url || "",
          logoUrl: savedConfig.logoUrl || "",
        });
      } catch (e) {
        setError("Erro ao carregar checkout");
      } finally {
        setLoading(false);
      }
    };

    fetchCheckout();
  }, [slug]);

  if (loading) {
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
          <p className="text-lg font-semibold text-gray-700">Checkout não encontrado</p>
          <p className="text-sm text-gray-500">Este link pode estar inativo ou não existe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: config.bgColor || "#EFF1F5" }}>
      <CheckoutPreview config={config} />
    </div>
  );
}
