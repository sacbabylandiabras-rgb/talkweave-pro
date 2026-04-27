import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, Check, ShieldCheck, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Transaction {
  id: string;
  status: string;
  amount: number;
  payment_method: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  metadata: any;
  created_at: string;
}

export default function PublicOrder() {
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [checkout, setCheckout] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/get-order?id=${encodeURIComponent(id)}`,
        { headers: { apikey: anonKey, "Content-Type": "application/json" } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Pedido não encontrado");
        return;
      }
      const data = await res.json();
      setTx(data.transaction);
      setCheckout(data.checkout);
      setProduct(data.product);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar pedido");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Auto-refresh status while pending
  useEffect(() => {
    if (!tx || tx.status !== "pending") return;
    const i = setInterval(fetchOrder, 8000);
    return () => clearInterval(i);
  }, [tx, fetchOrder]);

  // Realtime updates
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gateway_transactions", filter: `id=eq.${id}` },
        () => fetchOrder()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, fetchOrder]);

  const brCode: string = tx?.metadata?.brCode || tx?.metadata?.pixCode || tx?.metadata?.qrCode || "";

  useEffect(() => {
    if (!brCode) { setQrDataUrl(""); return; }
    QRCode.toDataURL(brCode, { width: 280, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [brCode]);

  const config = (checkout?.config || {}) as Record<string, any>;
  const primaryColor = config.primaryColor || "#a78bfa";
  const logoUrl = config.logoUrl || "";
  const productName = product?.name || config.productName || checkout?.name || "Pedido";
  const bgColor = config.bgColor || "#0F0F12";

  const formattedAmount = tx
    ? `R$ ${(tx.amount / 100).toFixed(2).replace(".", ",")}`
    : "";

  const handleCopy = () => {
    if (!brCode) return;
    navigator.clipboard.writeText(brCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F12]">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F12] p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <XCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <h1 className="text-lg font-bold text-gray-800">{error || "Pedido não encontrado"}</h1>
          <p className="text-sm text-gray-500 mt-2">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const isApproved = tx.status === "approved" || tx.status === "paid";
  const isFailed = ["failed", "cancelled", "canceled", "refused", "expired"].includes(tx.status);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bgColor }}>
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div
            className="relative px-6 pt-8 pb-12 text-center"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
          >
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-8 mx-auto mb-3 object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            )}
            <div
              className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {isApproved ? (
                <CheckCircle2 className="w-9 h-9 text-white" />
              ) : isFailed ? (
                <XCircle className="w-9 h-9 text-white" />
              ) : (
                <Clock className="w-9 h-9 text-white" />
              )}
            </div>
            <h1 className="text-xl font-bold text-white">
              {isApproved ? "Pagamento confirmado!" : isFailed ? "Pagamento não realizado" : "Finalize seu pagamento"}
            </h1>
            <p className="text-white/80 mt-1 text-sm">
              {tx.customer_name ? `Olá, ${tx.customer_name}` : "Continue de onde parou"}
            </p>
          </div>

          <div className="px-6 py-6 -mt-6 relative z-10">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Produto</span>
                <span className="text-sm font-semibold text-gray-800 text-right max-w-[220px] truncate">
                  {productName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Valor</span>
                <span className="text-lg font-bold" style={{ color: primaryColor }}>
                  {formattedAmount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Pedido</span>
                <span className="text-xs font-mono text-gray-600">{tx.id.slice(0, 8)}</span>
              </div>
            </div>

            {!isApproved && !isFailed && brCode && (
              <>
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code PIX" className="w-56 h-56" />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Aponte a câmera do seu app de banco
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Ou copie o código PIX:</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={brCode}
                      className="flex-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 truncate"
                    />
                    <button
                      onClick={handleCopy}
                      className="shrink-0 px-4 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-90"
                      style={{ background: primaryColor }}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Aguardando confirmação do pagamento...
                </div>
              </>
            )}

            {isApproved && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <p className="text-sm text-emerald-700 font-medium">
                  ✅ Recebemos seu pagamento. Em instantes você receberá o acesso pelo WhatsApp/e-mail.
                </p>
              </div>
            )}

            {isFailed && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                <p className="text-sm text-red-700">
                  Este pedido foi cancelado ou expirou. Por favor, gere um novo pedido.
                </p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-center gap-2 text-gray-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs">Pagamento processado com segurança</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/40 mt-4">Powered by ZapLynx Pay</p>
      </div>
    </div>
  );
}