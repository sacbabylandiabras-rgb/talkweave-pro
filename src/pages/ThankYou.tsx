import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, ShieldCheck, ArrowRight, Copy, Check } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { TenantProvider } from "@/contexts/TenantContext";

export default function ThankYou() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { tenant, loading: tenantLoading } = useTenant();
  const [copied, setCopied] = useState(false);
  const [checkout, setCheckout] = useState<any>(null);

  const customerName = searchParams.get("name") || "Cliente";
  const transactionId = searchParams.get("tid") || "";
  const amount = searchParams.get("amount") || "";
  const customTitle = searchParams.get("title") || "";
  const customMessage = searchParams.get("msg") || "";

  useEffect(() => {
    if (!slug) return;
    const fetchCheckout = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/get-checkout?slug=${encodeURIComponent(slug)}`,
          { headers: { apikey: anonKey, "Content-Type": "application/json" } }
        );
        if (res.ok) {
          const data = await res.json();
          setCheckout(data.checkout);
        }
      } catch {}
    };
    fetchCheckout();
  }, [slug]);

  const config = (checkout?.config || {}) as Record<string, any>;
  const primaryColor = config.primaryColor || tenant?.primary_color || "#EF4444";
  const logoUrl = config.logoUrl || tenant?.logo_url || "";
  const productName = config.productName || checkout?.name || "seu produto";
  const bgColor = config.bgColor || "#EFF1F5";

  const formattedAmount = amount
    ? `R$ ${(Number(amount) / 100).toFixed(2).replace(".", ",")}`
    : null;

  const handleCopy = () => {
    if (transactionId) {
      navigator.clipboard.writeText(transactionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <TenantProvider tenant={tenant}>
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: bgColor }}
      >
        <div className="w-full max-w-lg">
          {/* Card principal */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header com cor primária */}
            <div
              className="relative px-6 pt-10 pb-14 text-center"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
              }}
            >
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-8 mx-auto mb-4 object-contain"
                  style={{ filter: "brightness(0) invert(1)" }}
                />
              )}
              <div
                className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4"
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">
                {customTitle || "Pagamento Confirmado!"}
              </h1>
              <p className="text-white/80 mt-1 text-sm">
                Obrigado pela sua compra, {customerName}
              </p>
            </div>

            {/* Conteúdo */}
            <div className="px-6 py-6 -mt-6 relative z-10">
              <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                {/* Produto */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Produto</span>
                  <span className="text-sm font-semibold text-gray-800 text-right max-w-[200px] truncate">
                    {productName}
                  </span>
                </div>

                {/* Valor */}
                {formattedAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Valor pago</span>
                    <span
                      className="text-lg font-bold"
                      style={{ color: primaryColor }}
                    >
                      {formattedAmount}
                    </span>
                  </div>
                )}

                {/* ID Transação */}
                {transactionId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">ID da transação</span>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-xs font-mono text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      {transactionId.slice(0, 12)}...
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}

                {/* Método */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Método</span>
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    PIX
                  </span>
                </div>
              </div>

              {/* Mensagem de entrega */}
              <div className="mt-5 p-4 rounded-xl border border-dashed border-gray-300 bg-white text-center">
                <p className="text-sm text-gray-600">
                  {customMessage || "📧 Os detalhes de acesso ao produto serão enviados para o seu e-mail ou WhatsApp em instantes."}
                </p>
              </div>

              {/* Selo de segurança */}
              <div className="mt-5 flex items-center justify-center gap-2 text-gray-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs">Pagamento processado com segurança</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-4">
            Powered by ZapLynx Pay
          </p>
        </div>
      </div>
    </TenantProvider>
  );
}
