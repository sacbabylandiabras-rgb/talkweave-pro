import { useState, useEffect } from "react";
import { CreditCard, QrCode, FileText, Lock, ShieldCheck, Clock, Gift, User, CreditCard as CardIcon, Check, ShoppingCart, X, Minus, Plus, Copy, Smartphone, Zap, AlertTriangle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import MinimalistaLayout from "@/components/gateway/checkout-templates/MinimalistaLayout";

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
  templateId?: string;
  templateName?: string;
}

interface Props {
  config: CheckoutConfig;
  templateName?: string;
}

export default function CheckoutPreview({ config, templateName }: Props) {
  const [step, setStep] = useState<"identification" | "payment">("identification");
  const [quantity, setQuantity] = useState(1);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrCodeImage: string; brCode: string } | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 15, s: 0 });

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCpf, setFormCpf] = useState("");

  // Countdown timer
  useEffect(() => {
    if (!config.showTimer) return;
    setCountdown({ m: config.timerMinutes || 15, s: 0 });
  }, [config.timerMinutes, config.showTimer]);

  useEffect(() => {
    if (!config.showTimer) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev.m === 0 && prev.s === 0) return prev;
        if (prev.s === 0) return { m: prev.m - 1, s: 59 };
        return { ...prev, s: prev.s - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [config.showTimer]);

  // Render template-specific layout (after all hooks)
  if (config.templateId === "minimalista") {
    return <MinimalistaLayout config={config} />;
  }

  const handleGeneratePix = async () => {
    setPixLoading(true);
    setPixError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const slug = window.location.pathname.split('/pay/')[1];
      const res = await fetch(`${supabaseUrl}/functions/v1/create-pix-charge`, {
        method: 'POST',
        headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, amount: pixPrice,
          customerName: formName || undefined, customerEmail: formEmail || undefined,
          customerPhone: formPhone || undefined, customerCpf: formCpf || undefined,
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

  const primary = config.primaryColor;
  const bgColor = config.bgColor || "#EFF1F5";
  const textColor = config.textColor || "#1F2937";
  const isDark = config.theme === "dark";
  const cardBg = isDark ? "#1A1A1A" : "#FFFFFF";
  const cardBorder = isDark ? "#333" : "#E5E7EB";
  const labelColor = isDark ? "#D1D5DB" : "#374151";
  const subtleText = isDark ? "#9CA3AF" : "#6B7280";
  const inputBg = isDark ? "#0D0D0D" : "#FFFFFF";
  const inputBorder = isDark ? "#444" : "#D1D5DB";

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

  const timerStr = `00h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  return (
    <div
      className="h-full overflow-auto"
      style={{ background: bgColor, fontFamily, minHeight: "100%", color: textColor }}
    >
      {/* Countdown Banner */}
      {config.showTimer && (
        <div
          className="w-full text-center py-3 text-sm font-medium"
          style={{ background: primary, color: "#FFFFFF" }}
        >
          Oferta termina em: <span className="font-bold ml-1">{timerStr}</span>
        </div>
      )}

      {/* Logo Header */}
      {config.logoUrl && (
        <div className="flex items-center justify-between py-3 px-4" style={{ background: cardBg, borderBottom: `1px solid ${cardBorder}` }}>
          <img src={config.logoUrl} alt="Logo" className="h-8 object-contain" />
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#16A34A" }}>
            <ShieldCheck className="w-3.5 h-3.5" /> Pagamento 100% seguro
          </span>
        </div>
      )}

      <div className="max-w-lg mx-auto py-6 px-4 space-y-4">

        {templateName && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Modelo aplicado
            </p>
            <p className="mt-1 text-sm font-bold text-foreground">{templateName}</p>
          </div>
        )}

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-8 py-2">
          <button onClick={() => setStep("identification")} className="flex flex-col items-center gap-1.5 transition-all">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: step === "identification" ? `${primary}20` : isDark ? "#333" : "#E5E7EB",
                border: step === "identification" ? `2px solid ${primary}` : "2px solid transparent",
              }}
            >
              <User className="w-5 h-5" style={{ color: step === "identification" ? primary : subtleText }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: step === "identification" ? primary : subtleText }}>
              Identificação
            </span>
          </button>
          <div className="w-12 h-[2px] rounded" style={{ background: isDark ? "#444" : "#D1D5DB" }} />
          <button onClick={() => setStep("payment")} className="flex flex-col items-center gap-1.5 transition-all">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: step === "payment" ? `${primary}20` : isDark ? "#333" : "#E5E7EB",
                border: step === "payment" ? `2px solid ${primary}` : "2px solid transparent",
              }}
            >
              <CardIcon className="w-5 h-5" style={{ color: step === "payment" ? primary : subtleText }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: step === "payment" ? primary : subtleText }}>
              Pagamento
            </span>
          </button>
        </div>

        {/* Order Summary Card */}
        <div className="rounded-xl border p-4 space-y-4" style={{ background: cardBg, borderColor: cardBorder }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: textColor }}>Resumo do pedido</h3>
            <span className="text-xs" style={{ color: "#16A34A" }}>● Dados seguros</span>
          </div>

          {/* Product Row */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: isDark ? "#222" : "#F3F4F6" }}>
              {config.productImage ? (
                <img src={config.productImage} alt={config.productName} className="w-full h-full object-cover" />
              ) : (
                <ShoppingCart className="w-6 h-6" style={{ color: subtleText }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: textColor }}>
                {config.offerName || config.productName || "Produto Exemplo"}
              </p>
              {config.originalPrice > config.price && (
                <p className="text-xs line-through" style={{ color: subtleText }}>{formatCurrency(config.originalPrice)}</p>
              )}
              <p className="text-sm font-bold" style={{ color: primary }}>{formatCurrency(unitPrice)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-7 h-7 rounded-md border flex items-center justify-center" style={{ borderColor: inputBorder, background: cardBg }}>
                <Minus className="w-3 h-3" style={{ color: subtleText }} />
              </button>
              <span className="text-sm font-medium w-6 text-center" style={{ color: textColor }}>{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="w-7 h-7 rounded-md border flex items-center justify-center" style={{ borderColor: inputBorder, background: cardBg }}>
                <Plus className="w-3 h-3" style={{ color: subtleText }} />
              </button>
            </div>
          </div>

          {/* Coupon */}
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm border outline-none placeholder:opacity-50"
              style={{ borderRadius: inputRadius, borderColor: inputBorder, background: inputBg, color: textColor }}
              placeholder="Cupom de desconto"
            />
            <button className="px-4 py-2 text-sm font-medium border" style={{ borderRadius: inputRadius, borderColor: inputBorder, background: cardBg, color: textColor }}>
              Aplicar
            </button>
          </div>

          {/* Totals */}
          <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${cardBorder}` }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: subtleText }}>Subtotal</span>
              <span style={{ color: textColor }} className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: subtleText }}>Frete</span>
              <span style={{ color: "#16A34A" }} className="font-medium">Grátis</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-1" style={{ borderTop: `1px solid ${cardBorder}` }}>
              <span style={{ color: textColor }}>Total</span>
              <span style={{ color: primary }}>{formatCurrency(subtotal)}</span>
            </div>
          </div>
        </div>

        {step === "identification" && (
          <>
            {/* Personal Data */}
            <div className="rounded-xl border p-5 space-y-4" style={{ background: cardBg, borderColor: cardBorder }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: textColor }}>Dados pessoais</h3>
                <p className="text-xs mt-0.5" style={{ color: subtleText }}>
                  Informe seus dados para concluir sua compra com segurança.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: labelColor }}>Nome completo</label>
                  <input
                    className="w-full px-3 py-2.5 text-sm border outline-none"
                    style={{ borderRadius: inputRadius, borderColor: inputBorder, background: inputBg, color: textColor }}
                    placeholder="Digite seu nome completo"
                    value={formName} onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: labelColor }}>E-mail</label>
                  <input
                    className="w-full px-3 py-2.5 text-sm border outline-none"
                    style={{ borderRadius: inputRadius, borderColor: inputBorder, background: inputBg, color: textColor }}
                    placeholder="seu@email.com"
                    value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>
                {config.showCpf && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: labelColor }}>CPF ou CNPJ</label>
                    <input
                      className="w-full px-3 py-2.5 text-sm border outline-none"
                      style={{ borderRadius: inputRadius, borderColor: inputBorder, background: inputBg, color: textColor }}
                      placeholder="000.000.000-00"
                      value={formCpf} onChange={(e) => setFormCpf(e.target.value)}
                    />
                  </div>
                )}
                {config.showPhone && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: labelColor }}>Celular (WhatsApp)</label>
                    <div className="flex gap-2">
                      <div className="flex items-center px-3 py-2.5 border text-sm font-medium" style={{ borderRadius: inputRadius, borderColor: inputBorder, background: isDark ? "#222" : "#F9FAFB", color: subtleText }}>
                        🇧🇷 +55
                      </div>
                      <input
                        className="flex-1 px-3 py-2.5 text-sm border outline-none"
                        style={{ borderRadius: inputRadius, borderColor: inputBorder, background: inputBg, color: textColor }}
                        placeholder="(00) 00000-0000"
                        value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {config.showBirthdate && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: labelColor }}>Data de Nascimento</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none" style={{ borderRadius: inputRadius, borderColor: inputBorder, background: inputBg, color: textColor }} placeholder="DD/MM/AAAA" />
                  </div>
                )}
                {config.showAddress && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: labelColor }}>CEP</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none" style={{ borderRadius: inputRadius, borderColor: inputBorder, background: inputBg, color: textColor }} placeholder="00000-000" />
                  </div>
                )}
              </div>
            </div>

            {/* Order Bump */}
            {config.showOrderBump && (
              <div className="rounded-xl border-2 p-4 space-y-2" style={{ borderColor: primary, borderStyle: "dashed", background: cardBg }}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 rounded" style={{ accentColor: primary }} />
                  <div className="flex items-center gap-1.5">
                    <Gift className="w-4 h-4" style={{ color: primary }} />
                    <span className="text-xs font-bold" style={{ color: primary }}>OFERTA ESPECIAL!</span>
                  </div>
                </div>
                <p className="text-xs" style={{ color: subtleText }}>
                  {config.orderBumpText || "Adicione este produto por apenas"}{" "}
                  <strong style={{ color: primary }}>{formatCurrency(config.orderBumpPrice)}</strong>
                </p>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={() => setStep("payment")}
              className="w-full py-4 font-bold text-base transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
              style={{ background: primary, color: "#FFFFFF", borderRadius }}
            >
              <Lock className="w-4 h-4" />
              {config.buttonText || "Pagar Agora"}
            </button>
          </>
        )}

        {step === "payment" && (
          <>
            {/* Payment Methods */}
            <div className="rounded-xl border p-5 space-y-4" style={{ background: cardBg, borderColor: cardBorder }}>
              <h3 className="text-sm font-bold" style={{ color: textColor }}>Forma de pagamento</h3>
              <div className="space-y-2">
                {config.pix && (
                  <div className="flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer" style={{ borderColor: primary, background: `${primary}10` }}>
                    <div className="flex items-center gap-3">
                      <QrCode className="w-5 h-5" style={{ color: primary }} />
                      <div>
                        <p className="text-sm font-semibold" style={{ color: textColor }}>PIX</p>
                        <p className="text-xs" style={{ color: subtleText }}>Pagamento instantâneo</p>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: primary }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: primary }} />
                    </div>
                  </div>
                )}
                {config.creditCard && (
                  <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer" style={{ borderColor: cardBorder, background: cardBg }}>
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5" style={{ color: subtleText }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: textColor }}>Cartão de Crédito</p>
                        {config.maxInstallments > 1 && <p className="text-xs" style={{ color: subtleText }}>até {config.maxInstallments}x</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {["Visa", "MC", "Elo"].map(b => (
                        <span key={b} className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: cardBorder, color: subtleText }}>{b}</span>
                      ))}
                    </div>
                  </div>
                )}
                {config.boleto && (
                  <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer" style={{ borderColor: cardBorder, background: cardBg }}>
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5" style={{ color: subtleText }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: textColor }}>Boleto</p>
                        <p className="text-xs" style={{ color: subtleText }}>Vencimento em 3 dias</p>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: cardBorder }} />
                  </div>
                )}
              </div>
            </div>

            {/* PIX Details */}
            <div className="rounded-xl border p-5 space-y-4" style={{ background: cardBg, borderColor: cardBorder }}>
              <h3 className="text-sm font-bold" style={{ color: textColor }}>Pagamento via PIX</h3>
              <p className="text-sm" style={{ color: subtleText }}>
                Valor à vista: <strong style={{ color: textColor }}>{formatCurrency(pixPrice)}</strong>
              </p>

              {pixData ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img src={pixData.qrCodeImage} alt="QR Code PIX" className="w-48 h-48 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-center" style={{ color: labelColor }}>Ou copie o código PIX:</p>
                    <div className="flex gap-2">
                      <input readOnly value={pixData.brCode} className="flex-1 px-3 py-2 text-xs border rounded-lg truncate" style={{ borderColor: inputBorder, background: isDark ? "#111" : "#F9FAFB", color: subtleText }} />
                      <button onClick={handleCopyPix} className="px-4 py-2 text-xs font-medium rounded-lg flex items-center gap-1" style={{ background: copied ? '#10B981' : primary, color: 'white', borderRadius }}>
                        <Copy className="w-3 h-3" /> {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {[
                      { icon: <Zap className="w-4 h-4 text-green-500" />, bg: isDark ? "#0a2a0a" : "#F0FDF4", title: "Aprovação instantânea", sub: "Liberação imediata" },
                      { icon: <Check className="w-4 h-4 text-blue-500" />, bg: isDark ? "#0a0a2a" : "#EFF6FF", title: "Sem custos extras", sub: "Transferência gratuita" },
                      { icon: <ShieldCheck className="w-4 h-4 text-purple-500" />, bg: isDark ? "#1a0a2a" : "#F5F3FF", title: "100% Seguro", sub: "Desenvolvido pelo Banco Central" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: item.bg }}>{item.icon}</div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: textColor }}>{item.title}</p>
                          <p className="text-xs" style={{ color: subtleText }}>{item.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {pixError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-xs">
                      <AlertTriangle className="w-4 h-4" /> {pixError}
                    </div>
                  )}
                  <button
                    type="button" onClick={handleGeneratePix} disabled={pixLoading}
                    className="w-full py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-60"
                    style={{ background: primary, color: "#FFFFFF", borderRadius }}
                  >
                    {pixLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    {pixLoading ? 'Gerando...' : 'Gerar QR Code PIX'}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* Guarantee */}
        {config.showGuarantee && (
          <div className="flex items-center justify-center gap-2 text-xs py-2" style={{ color: subtleText }}>
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span>Garantia de {config.guaranteeDays} dias — Satisfação ou dinheiro de volta</span>
          </div>
        )}

        {/* Security Badges */}
        {config.showSecurityBadges && (
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            {["🔒 SSL", "Visa", "Master", "Elo", "PIX"].map(badge => (
              <span key={badge} className="text-[10px] font-medium px-2 py-1 border rounded" style={{ color: subtleText, borderColor: cardBorder }}>
                {badge}
              </span>
            ))}
          </div>
        )}

        <p className="text-center text-[10px] pb-4" style={{ color: subtleText }}>
          Pagamento processado com segurança por ZapLynxPay
        </p>
      </div>
    </div>
  );
}
