import { useState, useEffect } from "react";
import { Lock, ShieldCheck, CreditCard, QrCode, FileText, Package, Minus, Plus, ChevronDown, User, MapPin } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";

interface Props {
  config: Record<string, any>;
}

export default function TikTokLayout({ config }: Props) {
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 15, s: 0 });
  const [selectedPayment, setSelectedPayment] = useState<"pix" | "credit" | "boleto">("credit");

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

  const primary = config.primaryColor || "#FF4D2E";
  const unitPrice = config.price || 9900;
  const totalPrice = unitPrice;
  const timerStr = `00h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  const isDark = config.theme === "dark";
  const bgPage = isDark ? "#0D0D0D" : "#F7F8FA";
  const bgCard = isDark ? "#1A1A1A" : "#FFFFFF";
  const bgInner = isDark ? "#111111" : "#F9FAFB";
  const borderColor = isDark ? "#2A2A2A" : "#E5E7EB";
  const borderInner = isDark ? "#222" : "#F3F4F6";
  const textPrimary = isDark ? "#F3F4F6" : "#111827";
  const textSecondary = isDark ? "#9CA3AF" : "#6B7280";
  const textMuted = isDark ? "#6B7280" : "#9CA3AF";
  const inputBg = isDark ? "#111" : "#FFFFFF";
  const inputBorder = isDark ? "#333" : "#E5E7EB";
  const inputText = isDark ? "#E5E7EB" : "#1F2937";
  const inputPlaceholder = isDark ? "#555" : "#9CA3AF";
  const headerBg = isDark ? "#111111" : "#FFFFFF";

  const inputClass = `w-full rounded-lg border px-3 py-2.5 text-xs outline-none transition-colors`;
  const inputStyle = { background: inputBg, borderColor: inputBorder, color: inputText };
  const labelClass = `mb-1 block text-[11px] font-medium`;
  const labelStyle = { color: textSecondary };
  const cardClass = `rounded-xl border p-4`;
  const cardStyle = { background: bgCard, borderColor };

  const progressColors = ["#16A34A", "#16A34A", "#22C55E", "#EAB308", "#F97316", "#EF4444", "#EC4899", "#A855F7", "#3B82F6", "#06B6D4"];

  const OrderSummaryCard = ({ compact = false }: { compact?: boolean }) => (
    <div className={cardClass} style={cardStyle}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${primary}15`, border: `1px solid ${primary}25` }}>
            <Package className="h-3.5 w-3.5" style={{ color: primary }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: textPrimary }}>Resumo do Pedido</span>
        </div>
        <span className="text-xs font-bold" style={{ color: textPrimary }}>{formatCurrency(totalPrice)}</span>
      </div>

      <div className="rounded-xl border p-3" style={{ background: bgInner, borderColor: borderInner }}>
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border" style={{ borderColor, background: bgCard }}>
            {config.productImage ? (
              <img src={config.productImage} alt={config.productName || "Produto"} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-5 w-5" style={{ color: textMuted }} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold" style={{ color: textPrimary }}>{config.offerName || config.productName || "Curso Método"}</p>
            <div className="mt-1 flex items-center gap-2">
              {config.originalPrice > config.price && (
                <span className="text-[10px] line-through" style={{ color: textMuted }}>{formatCurrency(config.originalPrice)}</span>
              )}
              <span className="text-xs font-bold" style={{ color: primary }}>{formatCurrency(unitPrice)}</span>
            </div>
          </div>

          {!compact && (
            <div className="flex items-center gap-1">
              <button className="flex h-6 w-6 items-center justify-center rounded border" style={{ borderColor, background: bgCard }}>
                <Minus className="h-3 w-3" style={{ color: textMuted }} />
              </button>
              <span className="w-4 text-center text-xs font-medium" style={{ color: textPrimary }}>1</span>
              <button className="flex h-6 w-6 items-center justify-center rounded border" style={{ borderColor, background: bgCard }}>
                <Plus className="h-3 w-3" style={{ color: textMuted }} />
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-md border px-2.5 py-2 text-[11px] outline-none"
            style={{ ...inputStyle, fontSize: "11px" }}
            placeholder="Adicionar cupom de desconto"
          />
          <button className="rounded-md px-3 py-2 text-[11px] font-semibold text-white" style={{ background: primary }}>
            Aplicar
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: borderInner }}>
        <div className="flex items-center justify-between text-[11px]" style={{ color: textSecondary }}>
          <span>Subtotal</span>
          <span style={{ color: textPrimary }}>{formatCurrency(unitPrice)}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-bold" style={{ color: textPrimary }}>
          <span>Total</span>
          <span style={{ color: primary }}>{formatCurrency(totalPrice)}</span>
        </div>
      </div>
    </div>
  );

  const PaymentSection = ({ showButton = false }: { showButton?: boolean }) => (
    <div className={`${cardClass} space-y-3`} style={cardStyle}>
      <h3 className="text-xs font-semibold" style={{ color: textPrimary }}>Forma de pagamento</h3>

      {config.pix && (
        <div
          onClick={() => setSelectedPayment("pix")}
          className="cursor-pointer rounded-lg border p-3 transition-all"
          style={{ borderColor: selectedPayment === "pix" ? primary : borderColor, background: selectedPayment === "pix" ? `${primary}10` : bgCard }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <QrCode className="mt-0.5 h-4 w-4" style={{ color: selectedPayment === "pix" ? primary : textMuted }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: textPrimary }}>Pix</p>
                <p className="text-[10px]" style={{ color: textMuted }}>Pague em até 30 minutos e receba a confirmação imediatamente.</p>
              </div>
            </div>
            <div className="flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: selectedPayment === "pix" ? primary : textMuted }}>
              {selectedPayment === "pix" && <div className="h-2.5 w-2.5 rounded-full" style={{ background: primary }} />}
            </div>
          </div>
        </div>
      )}

      {config.creditCard && (
        <div
          onClick={() => setSelectedPayment("credit")}
          className="cursor-pointer rounded-lg border p-3 transition-all"
          style={{ borderColor: selectedPayment === "credit" ? primary : borderColor, background: selectedPayment === "credit" ? `${primary}10` : bgCard }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-4 w-4" style={{ color: selectedPayment === "credit" ? primary : textMuted }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: textPrimary }}>Cartão de crédito</p>
                <p className="text-[10px]" style={{ color: textMuted }}>Parcele sua compra com total segurança.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-rose-500">★</span>
              <div className="flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: selectedPayment === "credit" ? primary : textMuted }}>
                {selectedPayment === "credit" && <div className="h-2.5 w-2.5 rounded-full" style={{ background: primary }} />}
              </div>
            </div>
          </div>

          {selectedPayment === "credit" && (
            <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: borderInner }}>
              <div className="flex gap-1.5">
                {["Visa", "MC", "Elo"].map((brand) => (
                  <span key={brand} className="rounded border px-1.5 py-0.5 text-[9px]" style={{ borderColor, color: textSecondary }}>{brand}</span>
                ))}
              </div>
              <input className={inputClass} style={inputStyle} placeholder="Nome no cartão" />
              <input className={inputClass} style={inputStyle} placeholder="CPF / CNPJ" />
              <input className={inputClass} style={inputStyle} placeholder="Número do cartão" />
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1 rounded-lg border px-2 py-2" style={{ borderColor }}>
                  <span className="text-[11px]" style={{ color: textMuted }}>Mês</span>
                  <ChevronDown className="ml-auto h-3 w-3" style={{ color: textMuted }} />
                </div>
                <div className="flex items-center gap-1 rounded-lg border px-2 py-2" style={{ borderColor }}>
                  <span className="text-[11px]" style={{ color: textMuted }}>Ano</span>
                  <ChevronDown className="ml-auto h-3 w-3" style={{ color: textMuted }} />
                </div>
                <input className={inputClass} style={inputStyle} placeholder="CVV" />
              </div>
              <div className="flex items-center gap-1 rounded-lg border px-3 py-2" style={{ borderColor }}>
                <span className="text-[11px]" style={{ color: textSecondary }}>1x de {formatCurrency(unitPrice)} (à vista)</span>
                <ChevronDown className="ml-auto h-3 w-3" style={{ color: textMuted }} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-lg border p-3" style={{ borderColor, background: bgCard }}>
        <div className="h-4 w-4 rounded-full" style={{ background: isDark ? "#fff" : "#000" }} />
        <span className="text-xs font-medium" style={{ color: textPrimary }}>Apple Pay</span>
        <div className="ml-auto h-4 w-4 rounded-full border-2" style={{ borderColor: textMuted }} />
      </div>

      {config.boleto && (
        <div
          onClick={() => setSelectedPayment("boleto")}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 transition-all"
          style={{ borderColor: selectedPayment === "boleto" ? primary : borderColor, background: bgCard }}
        >
          <FileText className="h-4 w-4" style={{ color: textMuted }} />
          <span className="text-xs font-medium" style={{ color: textPrimary }}>Boleto</span>
          <div className="ml-auto flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: selectedPayment === "boleto" ? primary : textMuted }}>
            {selectedPayment === "boleto" && <div className="h-2.5 w-2.5 rounded-full" style={{ background: primary }} />}
          </div>
        </div>
      )}

      {showButton && (
        <button className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white" style={{ background: primary }}>
          <Lock className="h-3.5 w-3.5" />
          Finalizar pedido • {formatCurrency(totalPrice)}
        </button>
      )}
    </div>
  );

  return (
    <div className="h-full overflow-auto pb-24" style={{ background: bgPage, fontFamily: "'Inter', sans-serif", color: textPrimary }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-3" style={{ background: headerBg, borderColor }}>
        <div>
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="h-7 object-contain" />
          ) : (
            <span className="text-sm font-bold" style={{ color: textPrimary }}>Minha Loja</span>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "#16A34A" }}>
          <ShieldCheck className="h-3.5 w-3.5" />
          Pagamento 100% seguro
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-0.5 px-4 pt-3">
        {progressColors.map((c, i) => (
          <div key={i} className="flex-1 h-1 rounded-full" style={{ background: c }} />
        ))}
      </div>

      {/* Countdown */}
      {config.showTimer && (
        <div className="mx-3 mt-3 rounded-lg px-3 py-2.5 text-center text-xs font-bold text-white md:mx-4 md:max-w-[1040px] md:mx-auto" style={{ background: primary }}>
          Oferta termina em: <span className="ml-1 tracking-wide">{timerStr}</span>
        </div>
      )}

      {/* Main */}
      <div className="mx-auto max-w-[1040px] px-3 py-5 md:px-4 md:py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="lg:hidden">
              <OrderSummaryCard compact />
            </div>

            {config.showAddress && (
              <div className={`${cardClass} space-y-3`} style={cardStyle}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" style={{ color: textMuted }} />
                  <h3 className="text-xs font-semibold" style={{ color: textPrimary }}>Endereço de Entrega</h3>
                </div>
                <input className={inputClass} style={inputStyle} placeholder="00000-000" />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} style={inputStyle} placeholder="Rua *" />
                  <input className={inputClass} style={inputStyle} placeholder="Número *" />
                </div>
                <input className={inputClass} style={inputStyle} placeholder="Complemento" />
                <div className="grid grid-cols-3 gap-2">
                  <input className={inputClass} style={inputStyle} placeholder="Bairro *" />
                  <input className={inputClass} style={inputStyle} placeholder="Cidade *" />
                  <input className={inputClass} style={inputStyle} placeholder="UF *" />
                </div>
              </div>
            )}

            {config.showCpf && (
              <div className={`${cardClass} space-y-2`} style={cardStyle}>
                <h3 className="text-xs font-semibold" style={{ color: textPrimary }}>CPF / CNPJ</h3>
                <input className={inputClass} style={inputStyle} placeholder="000.000.000-00" />
              </div>
            )}

            <div className={`${cardClass} space-y-3`} style={cardStyle}>
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5" style={{ color: textMuted }} />
                <h3 className="text-xs font-semibold" style={{ color: textPrimary }}>Informações de Contato</h3>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Nome completo *</label>
                <input className={inputClass} style={inputStyle} placeholder="Nome completo *" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass} style={labelStyle}>E-mail *</label>
                  <input className={inputClass} style={inputStyle} placeholder="E-mail *" />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Telefone *</label>
                  <input className={inputClass} style={inputStyle} placeholder="Telefone *" />
                </div>
              </div>
            </div>

            <div className="lg:hidden">
              <PaymentSection />
            </div>
          </div>

          <div className="hidden space-y-4 lg:block">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold" style={{ color: textPrimary }}>Resumo do Pedido</span>
              <span className="flex items-center gap-1 text-[11px]" style={{ color: textSecondary }}>
                <ShieldCheck className="h-3 w-3 text-green-500" />
                Seus dados estão seguros e criptografados.
              </span>
            </div>
            <OrderSummaryCard />
            <PaymentSection showButton />
          </div>
        </div>
      </div>

      {/* Sticky footer mobile */}
      <div className="fixed inset-x-0 bottom-0 border-t px-4 py-3 backdrop-blur lg:hidden" style={{ background: isDark ? "rgba(13,13,13,0.95)" : "rgba(255,255,255,0.95)", borderColor }}>
        <div className="mx-auto flex max-w-[420px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <span className="block text-[10px]" style={{ color: textMuted }}>Total a pagar</span>
            <span className="text-sm font-extrabold" style={{ color: primary }}>{formatCurrency(totalPrice)}</span>
          </div>
          <button className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white" style={{ background: primary }}>
            <Lock className="h-3.5 w-3.5" />
            Finalizar pedido
          </button>
        </div>
      </div>
    </div>
  );
}