import { useState, useEffect } from "react";
import { CreditCard, QrCode, FileText, Lock, ShieldCheck, Clock, Gift, User, CreditCard as CardIcon, Check, ShoppingCart, X, Minus, Plus, Copy, Smartphone, Zap, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";

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
  productImage?: string;
  logoUrl?: string;
}

interface Props {
  config: CheckoutConfig;
}

export default function CheckoutPreview({ config }: Props) {
  const [step, setStep] = useState<"identification" | "payment">("identification");
  const [purchaseCount, setPurchaseCount] = useState(60);
  const [quantity, setQuantity] = useState(1);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrCodeImage: string; brCode: string } | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCpf, setFormCpf] = useState("");

  const handleGeneratePix = async () => {
    setPixLoading(true);
    setPixError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const slug = window.location.pathname.split('/pay/')[1];
      
      const res = await fetch(`${supabaseUrl}/functions/v1/create-pix-charge`, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug,
          amount: pixPrice,
          customerName: formName || undefined,
          customerEmail: formEmail || undefined,
          customerPhone: formPhone || undefined,
          customerCpf: formCpf || undefined,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar cobrança');
      
      setPixData({ qrCodeImage: data.qrCodeImage, brCode: data.brCode });
    } catch (e: any) {
      setPixError(e.message || 'Erro ao gerar PIX');
    } finally {
      setPixLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.brCode) {
      navigator.clipboard.writeText(pixData.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Simulate purchase counter
  useEffect(() => {
    if (!config.showTimer) return;
    const interval = setInterval(() => {
      setPurchaseCount(prev => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(50, Math.min(99, prev + delta));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [config.showTimer]);

  const primary = config.primaryColor;
  const unitPrice = config.price;
  const subtotal = unitPrice * quantity;
  const pixPrice = config.pixDiscount > 0 ? Math.round(subtotal * (1 - config.pixDiscount / 100)) : subtotal;

  const fontFamily = config.font === "plus_jakarta" ? "'Plus Jakarta Sans', sans-serif"
    : config.font === "roboto" ? "'Roboto', sans-serif"
    : config.font === "montserrat" ? "'Montserrat', sans-serif"
    : config.font === "poppins" ? "'Poppins', sans-serif"
    : "'Inter', sans-serif";

  const borderRadius = config.borderStyle === "pill" ? "50px" : config.borderStyle === "square" ? "0px" : "8px";
  const inputRadius = config.borderStyle === "pill" ? "25px" : config.borderStyle === "square" ? "0px" : "6px";

  return (
    <div
      className="h-full overflow-auto"
      style={{ background: "#EFF1F5", fontFamily, minHeight: "100%" }}
    >
      <div className="max-w-lg mx-auto py-6 px-4 space-y-4">

        {/* Logo */}
        {config.logoUrl && (
          <div className="flex items-center justify-between py-2">
            <img src={config.logoUrl} alt="Logo" className="h-8 object-contain" />
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: primary }}>
              <ShieldCheck className="w-3.5 h-3.5" /> Pagamento 100% seguro
            </span>
          </div>
        )}

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-8 py-4">
          <button
            onClick={() => setStep("identification")}
            className="flex flex-col items-center gap-1.5 transition-all"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: step === "identification" ? `${primary}15` : "#E5E7EB",
                border: step === "identification" ? `2px solid ${primary}` : "2px solid transparent",
              }}
            >
              <User className="w-5 h-5" style={{ color: step === "identification" ? primary : "#9CA3AF" }} />
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: step === "identification" ? primary : "#9CA3AF" }}
            >
              Identificação
            </span>
          </button>
          <div className="w-12 h-[2px] bg-gray-300 rounded" />
          <button
            onClick={() => setStep("payment")}
            className="flex flex-col items-center gap-1.5 transition-all"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: step === "payment" ? `${primary}15` : "#E5E7EB",
                border: step === "payment" ? `2px solid ${primary}` : "2px solid transparent",
              }}
            >
              <CardIcon className="w-5 h-5" style={{ color: step === "payment" ? primary : "#9CA3AF" }} />
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: step === "payment" ? primary : "#9CA3AF" }}
            >
              Pagamento
            </span>
          </button>
        </div>

        {/* Order Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Resumo do pedido</h3>
            <button className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Product Row */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {config.productImage ? (
                <img src={config.productImage} alt={config.productName} className="w-full h-full object-cover" />
              ) : (
                <ShoppingCart className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {config.offerName || config.productName || "Seu Produto"}
              </p>
              <p className="text-xs text-gray-500">{formatCurrency(unitPrice)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50"
              >
                <Minus className="w-3 h-3 text-gray-600" />
              </button>
              <span className="text-sm font-medium text-gray-800 w-6 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-50"
              >
                <Plus className="w-3 h-3 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Coupon */}
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none bg-white text-gray-700 placeholder:text-gray-400"
              placeholder="Cupom de desconto"
            />
            <button
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
            >
              Aplicar
            </button>
          </div>

          {/* Totals */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700 font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Frete</span>
              <span className="text-green-500 font-medium">Grátis</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-100">
              <span className="text-gray-800">Total</span>
              <span className="text-gray-800">{formatCurrency(subtotal)}</span>
            </div>
          </div>
        </div>

        {/* Urgency Banner */}
        {config.showTimer && (
          <div
            className="rounded-xl py-4 px-5 text-center text-white space-y-0.5"
            style={{ background: primary }}
          >
            <p className="text-sm font-bold">Atenção</p>
            <p className="text-xs opacity-90">Não perca essa oportunidade!</p>
            <p className="text-3xl font-extrabold">{purchaseCount} Compras</p>
          </div>
        )}

        {step === "identification" && (
          <>
            {/* Personal Data Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Dados pessoais</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Utilizaremos seu e-mail para identificar seu perfil, histórico de compra, notificação de pedidos e carrinho de compras.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Nome completo</label>
                  <input
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 outline-none bg-white text-gray-700 placeholder:text-gray-400"
                    style={{ borderRadius: inputRadius }}
                    placeholder="Ex.: Maria da Silva"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">E-mail</label>
                  <input
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 outline-none bg-white text-gray-700 placeholder:text-gray-400"
                    style={{ borderRadius: inputRadius }}
                    placeholder="Ex.: maria@email.com"
                  />
                </div>

                {config.showCpf && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">CPF ou CNPJ</label>
                    <input
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 outline-none bg-white text-gray-700 placeholder:text-gray-400"
                      style={{ borderRadius: inputRadius }}
                      placeholder="CPF ou CNPJ"
                    />
                  </div>
                )}

                {config.showPhone && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Celular / WhatsApp</label>
                    <div className="flex gap-2">
                      <div
                        className="flex items-center px-3 py-2.5 border border-gray-200 bg-gray-50 text-sm text-gray-600 font-medium"
                        style={{ borderRadius: inputRadius }}
                      >
                        +55
                      </div>
                      <input
                        className="flex-1 px-3 py-2.5 text-sm border border-gray-200 outline-none bg-white text-gray-700 placeholder:text-gray-400"
                        style={{ borderRadius: inputRadius }}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                )}

                {config.showBirthdate && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Data de Nascimento</label>
                    <input
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 outline-none bg-white text-gray-700 placeholder:text-gray-400"
                      style={{ borderRadius: inputRadius }}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                )}

                {config.showAddress && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">CEP</label>
                    <input
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 outline-none bg-white text-gray-700 placeholder:text-gray-400"
                      style={{ borderRadius: inputRadius }}
                      placeholder="00000-000"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Order Bump */}
            {config.showOrderBump && (
              <div
                className="bg-white rounded-xl border-2 p-4 space-y-2"
                style={{ borderColor: primary, borderStyle: "dashed" }}
              >
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 rounded" style={{ accentColor: primary }} />
                  <div className="flex items-center gap-1.5">
                    <Gift className="w-4 h-4" style={{ color: primary }} />
                    <span className="text-xs font-bold" style={{ color: primary }}>OFERTA ESPECIAL!</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {config.orderBumpText || "Adicione este produto por apenas"}{" "}
                  <strong style={{ color: primary }}>{formatCurrency(config.orderBumpPrice)}</strong>
                </p>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={() => setStep("payment")}
              className="w-full py-4 text-white font-bold text-base transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
              style={{ background: primary, borderRadius }}
            >
              <Lock className="w-4 h-4" />
              {config.buttonText || "Pagar Agora"}
            </button>
          </>
        )}

        {step === "payment" && (
          <>
            {/* Payment Method Selection */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">Forma de pagamento</h3>

              <div className="space-y-2">
                {config.pix && (
                  <div
                    className="flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer"
                    style={{ borderColor: primary, background: `${primary}08` }}
                  >
                    <div className="flex items-center gap-3">
                      <QrCode className="w-5 h-5" style={{ color: primary }} />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">PIX</p>
                        <p className="text-xs text-gray-500">Pagamento instantâneo</p>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: primary }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: primary }} />
                    </div>
                  </div>
                )}

                {config.creditCard && (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Cartão de Crédito</p>
                        {config.maxInstallments > 1 && (
                          <p className="text-xs text-gray-400">até {config.maxInstallments}x</p>
                        )}
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  </div>
                )}

                {config.boleto && (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Boleto</p>
                        <p className="text-xs text-gray-400">Pode precisar colar manualmente</p>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  </div>
                )}
              </div>
            </div>

            {/* PIX Payment Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-800">Pagamento via PIX</h3>
              <p className="text-sm text-gray-600">
                Valor à vista: <strong className="text-gray-800">{formatCurrency(pixPrice)}</strong>
              </p>

              {/* PIX Benefits */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Aprovação instantânea</p>
                    <p className="text-xs text-gray-500">Liberação imediata</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                    <Check className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Sem custos extras</p>
                    <p className="text-xs text-gray-500">Transferência gratuita</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">100% Seguro</p>
                    <p className="text-xs text-gray-500">Desenvolvido pelo Banco Central</p>
                  </div>
                </div>
              </div>

              {/* Generate QR Code Button */}
              <button
                type="button"
                onClick={() => window.alert("Integração PIX ainda não conectada neste checkout.")}
                className="w-full py-3.5 text-white font-bold text-sm flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                style={{ background: primary, borderRadius }}
              >
                <QrCode className="w-4 h-4" />
                Gerar QR Code PIX
              </button>
            </div>
          </>
        )}

        {/* Guarantee */}
        {config.showGuarantee && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-2">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span>Garantia de {config.guaranteeDays} dias — Satisfação ou dinheiro de volta</span>
          </div>
        )}

        {/* Security Badges */}
        {config.showSecurityBadges && (
          <div className="flex items-center justify-center gap-3 pt-1">
            {["🔒 SSL", "Visa", "Master", "PIX"].map(badge => (
              <span key={badge} className="text-[10px] font-medium px-2 py-1 text-gray-400 border border-gray-200 rounded">
                {badge}
              </span>
            ))}
          </div>
        )}

        <p className="text-center text-[10px] text-gray-400 pb-4">
          Pagamento processado com segurança por ZapLynxPay
        </p>
      </div>
    </div>
  );
}
