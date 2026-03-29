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

  const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-800 outline-none placeholder:text-gray-400 focus:border-gray-300";
  const labelClass = "mb-1 block text-[11px] font-medium text-gray-600";
  const cardClass = "rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]";

  const progressColors = ["#16A34A", "#16A34A", "#22C55E", "#EAB308", "#F97316", "#EF4444", "#EC4899", "#A855F7", "#3B82F6", "#06B6D4"];

  const OrderSummaryCard = ({ compact = false }: { compact?: boolean }) => (
    <div className={cardClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-red-100 bg-red-50">
            <Package className="h-3.5 w-3.5" style={{ color: primary }} />
          </div>
          <span className="text-xs font-semibold text-gray-900">Resumo do Pedido</span>
        </div>
        <span className="text-xs font-bold text-gray-900">{formatCurrency(totalPrice)}</span>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
            {config.productImage ? (
              <img src={config.productImage} alt={config.productName || "Produto"} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-5 w-5 text-gray-300" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-gray-900">{config.offerName || config.productName || "Curso Método"}</p>
            <div className="mt-1 flex items-center gap-2">
              {config.originalPrice > config.price && (
                <span className="text-[10px] text-gray-400 line-through">{formatCurrency(config.originalPrice)}</span>
              )}
              <span className="text-xs font-bold" style={{ color: primary }}>{formatCurrency(unitPrice)}</span>
            </div>
          </div>

          {!compact && (
            <div className="flex items-center gap-1">
              <button className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white">
                <Minus className="h-3 w-3 text-gray-400" />
              </button>
              <span className="w-4 text-center text-xs font-medium text-gray-700">1</span>
              <button className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white">
                <Plus className="h-3 w-3 text-gray-400" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input className="flex-1 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-[11px] outline-none placeholder:text-gray-400" placeholder="Adicionar cupom de desconto" />
          <button className="rounded-md px-3 py-2 text-[11px] font-semibold text-white" style={{ background: primary }}>
            Aplicar
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>Subtotal</span>
          <span className="text-gray-700">{formatCurrency(unitPrice)}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-bold text-gray-900">
          <span>Total</span>
          <span style={{ color: primary }}>{formatCurrency(totalPrice)}</span>
        </div>
      </div>
    </div>
  );

  const PaymentSection = ({ showButton = false }: { showButton?: boolean }) => (
    <div className={`${cardClass} space-y-3`}>
      <h3 className="text-xs font-semibold text-gray-900">Forma de pagamento</h3>

      {config.pix && (
        <div
          onClick={() => setSelectedPayment("pix")}
          className="cursor-pointer rounded-lg border p-3 transition-all"
          style={{ borderColor: selectedPayment === "pix" ? primary : "#E5E7EB", background: selectedPayment === "pix" ? `${primary}08` : "#fff" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <QrCode className="mt-0.5 h-4 w-4" style={{ color: selectedPayment === "pix" ? primary : "#9CA3AF" }} />
              <div>
                <p className="text-xs font-semibold text-gray-900">Pix</p>
                <p className="text-[10px] text-gray-400">Pague em até 30 minutos e receba a confirmação imediatamente.</p>
              </div>
            </div>
            <div className="flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: selectedPayment === "pix" ? primary : "#D1D5DB" }}>
              {selectedPayment === "pix" && <div className="h-2.5 w-2.5 rounded-full" style={{ background: primary }} />}
            </div>
          </div>
        </div>
      )}

      {config.creditCard && (
        <div
          onClick={() => setSelectedPayment("credit")}
          className="cursor-pointer rounded-lg border p-3 transition-all"
          style={{ borderColor: selectedPayment === "credit" ? primary : "#E5E7EB", background: selectedPayment === "credit" ? `${primary}08` : "#fff" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-4 w-4" style={{ color: selectedPayment === "credit" ? primary : "#9CA3AF" }} />
              <div>
                <p className="text-xs font-semibold text-gray-900">Cartão de crédito</p>
                <p className="text-[10px] text-gray-400">Parcele sua compra com total segurança.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-rose-500">★</span>
              <div className="flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: selectedPayment === "credit" ? primary : "#D1D5DB" }}>
                {selectedPayment === "credit" && <div className="h-2.5 w-2.5 rounded-full" style={{ background: primary }} />}
              </div>
            </div>
          </div>

          {selectedPayment === "credit" && (
            <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
              <div className="flex gap-1.5">
                {["Visa", "MC", "Elo"].map((brand) => (
                  <span key={brand} className="rounded border border-gray-200 px-1.5 py-0.5 text-[9px] text-gray-500">{brand}</span>
                ))}
              </div>
              <input className={inputClass} placeholder="Nome no cartão" />
              <input className={inputClass} placeholder="Nº do cartão" />
              <input className={inputClass} placeholder="Número do cartão" />
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-2">
                  <span className="text-[11px] text-gray-400">Mês</span>
                  <ChevronDown className="ml-auto h-3 w-3 text-gray-400" />
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-2">
                  <span className="text-[11px] text-gray-400">Ano</span>
                  <ChevronDown className="ml-auto h-3 w-3 text-gray-400" />
                </div>
                <input className={inputClass} placeholder="CVV" />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2">
                <span className="text-[11px] text-gray-600">1x de {formatCurrency(unitPrice)} (à vista)</span>
                <ChevronDown className="ml-auto h-3 w-3 text-gray-400" />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 p-3">
        <div className="h-4 w-4 rounded-full bg-black" />
        <span className="text-xs font-medium text-gray-900">Apple Pay</span>
        <div className="ml-auto h-4 w-4 rounded-full border-2 border-gray-300" />
      </div>

      {config.boleto && (
        <div
          onClick={() => setSelectedPayment("boleto")}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 transition-all"
          style={{ borderColor: selectedPayment === "boleto" ? primary : "#E5E7EB" }}
        >
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-900">Boleto</span>
          <div className="ml-auto flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: selectedPayment === "boleto" ? primary : "#D1D5DB" }}>
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
    <div className="h-full overflow-auto bg-white pb-24 text-gray-800" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex gap-0.5 px-4 pt-2">
        {progressColors.map((c, i) => (
          <div key={i} className="flex-1 h-1 rounded-full" style={{ background: c }} />
        ))}
      </div>

      {config.showTimer && (
        <div className="mx-auto mt-2 w-[calc(100%-2rem)] rounded-md px-3 py-2 text-center text-[11px] font-bold text-white md:max-w-[1040px]" style={{ background: primary }}>
          Oferta termina em: <span className="ml-1 tracking-wide">{timerStr}</span>
        </div>
      )}

      <div className="mx-auto max-w-[1040px] px-3 py-4 md:px-4 md:py-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="lg:hidden">
              <OrderSummaryCard compact />
            </div>

            {config.showAddress && (
              <div className={`${cardClass} space-y-3`}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  <h3 className="text-xs font-semibold text-gray-900">Endereço de Entrega</h3>
                </div>
                <input className={inputClass} placeholder="00000-000" />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} placeholder="Rua *" />
                  <input className={inputClass} placeholder="Número *" />
                </div>
                <input className={inputClass} placeholder="Complemento" />
                <div className="grid grid-cols-3 gap-2">
                  <input className={inputClass} placeholder="Bairro *" />
                  <input className={inputClass} placeholder="Cidade *" />
                  <input className={inputClass} placeholder="UF *" />
                </div>
              </div>
            )}

            {config.showCpf && (
              <div className={`${cardClass} space-y-2`}>
                <h3 className="text-xs font-semibold text-gray-900">CPF / CNPJ</h3>
                <input className={inputClass} placeholder="000.000.000-00" />
              </div>
            )}

            <div className={`${cardClass} space-y-3`}>
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-900">Informações de Contato</h3>
              </div>
              <div>
                <label className={labelClass}>Nome completo *</label>
                <input className={inputClass} placeholder="Nome completo *" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>E-mail *</label>
                  <input className={inputClass} placeholder="E-mail *" />
                </div>
                <div>
                  <label className={labelClass}>Telefone *</label>
                  <input className={inputClass} placeholder="Telefone *" />
                </div>
              </div>
            </div>

            <div className="lg:hidden">
              <PaymentSection />
            </div>
          </div>

          <div className="hidden space-y-4 lg:block">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-gray-900">Resumo do Pedido</span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <ShieldCheck className="h-3 w-3 text-green-500" />
                Seus dados estão seguros e criptografados.
              </span>
            </div>
            <OrderSummaryCard />
            <PaymentSection showButton />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[420px] items-center gap-3">
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] text-gray-500">Total a pagar</span>
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