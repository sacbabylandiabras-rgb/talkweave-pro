import { useState, useEffect } from "react";
import { Lock, ShieldCheck, CreditCard, QrCode, FileText, Package, Minus, Plus, ChevronDown } from "lucide-react";
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
  const timerStr = `${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  const inputClass = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none bg-white text-gray-800 placeholder:text-gray-400 focus:border-gray-300";
  const labelClass = "text-[11px] font-medium text-gray-500 block mb-1";

  // Progress bar colors
  const progressColors = ["#16A34A", "#16A34A", "#22C55E", "#EAB308", "#F97316", "#EF4444", "#EC4899", "#A855F7", "#3B82F6", "#06B6D4"];

  return (
    <div className="h-full overflow-auto" style={{ background: "#FFFFFF", fontFamily: "'Inter', sans-serif", color: "#1F2937" }}>

      {/* Countdown */}
      {config.showTimer && (
        <div className="w-full text-center py-2 text-xs font-bold tracking-wide" style={{ background: primary, color: "#FFFFFF" }}>
          Oferta termina em: <span className="ml-1 tracking-widest">{timerStr}</span>
        </div>
      )}

      {/* Main content */}
      <div className="mx-auto px-3 py-5" style={{ maxWidth: "900px" }}>
        <div className="flex flex-col md:flex-row gap-4">

          {/* LEFT column */}
          <div className="flex-1 space-y-4">

            {/* Endereço de Entrega */}
            {config.showAddress && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900">Endereço de Entrega</h3>
                <input className={inputClass} placeholder="00000-000" />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} placeholder="Rua *" />
                  <input className={inputClass} placeholder="Número *" />
                </div>
                <input className={inputClass} placeholder="Complemento" />
                <div className="grid grid-cols-3 gap-2">
                  <input className={inputClass} placeholder="Bairro *" />
                  <input className={inputClass} placeholder="Cidade *" />
                  <input className={inputClass} placeholder="Estado (UF) *" />
                </div>
              </div>
            )}

            {/* CPF */}
            {config.showCpf && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900">CPF / CNPJ</h3>
                <input className={inputClass} placeholder="Somente números" />
              </div>
            )}

            {/* Informações de Contato */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-gray-500">i</span>
                </div>
                Informações de Contato
              </h3>
              <input className={inputClass} placeholder="Nome completo *" />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClass} placeholder="E-mail *" />
                <input className={inputClass} placeholder="Telefone *" />
              </div>
            </div>
          </div>

          {/* RIGHT column */}
          <div className="w-full md:w-64 flex-shrink-0 space-y-4">

            {/* Resumo do Pedido */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Resumo do Pedido</h3>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-green-500" />
                  Dados seguros
                </span>
              </div>

              {/* Product */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Produto</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {config.productImage ? (
                      <img src={config.productImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{config.offerName || config.productName || "Produto Exemplo"}</p>
                    {config.originalPrice > config.price && (
                      <p className="text-[10px] line-through text-gray-400">{formatCurrency(config.originalPrice)}</p>
                    )}
                    <p className="text-xs font-bold" style={{ color: primary }}>{formatCurrency(unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center"><Minus className="w-3 h-3 text-gray-400" /></button>
                    <span className="text-xs font-medium w-5 text-center">1</span>
                    <button className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center"><Plus className="w-3 h-3 text-gray-400" /></button>
                  </div>
                </div>

                {/* Coupon */}
                <div className="flex gap-1.5 mt-3">
                  <input className="flex-1 px-2.5 py-1.5 text-[11px] border border-gray-200 rounded-md bg-white outline-none placeholder:text-gray-400" placeholder="Adicione cupom de desconto" />
                  <button className="px-3 py-1.5 text-[11px] font-semibold rounded-md text-white" style={{ background: primary }}>Aplicar</button>
                </div>

                {/* Totals */}
                <div className="mt-3 pt-2 border-t border-gray-200 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-700">{formatCurrency(unitPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-gray-900">Total</span>
                    <span style={{ color: primary }}>{formatCurrency(unitPrice)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Forma de pagamento */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Forma de pagamento</h3>

              {/* PIX */}
              {config.pix && (
                <div
                  onClick={() => setSelectedPayment("pix")}
                  className="rounded-lg border p-3 cursor-pointer transition-all"
                  style={{ borderColor: selectedPayment === "pix" ? primary : "#E5E7EB", background: selectedPayment === "pix" ? `${primary}08` : "#fff" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <QrCode className="w-4 h-4" style={{ color: selectedPayment === "pix" ? primary : "#9CA3AF" }} />
                      <div>
                        <p className="text-xs font-semibold">Pix</p>
                        <p className="text-[10px] text-gray-400">Pagamento em PIX possui confirmação automática.</p>
                      </div>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: selectedPayment === "pix" ? primary : "#D1D5DB" }}>
                      {selectedPayment === "pix" && <div className="w-2.5 h-2.5 rounded-full" style={{ background: primary }} />}
                    </div>
                  </div>
                </div>
              )}

              {/* Cartão de Crédito */}
              {config.creditCard && (
                <div
                  onClick={() => setSelectedPayment("credit")}
                  className="rounded-lg border p-3 cursor-pointer transition-all"
                  style={{ borderColor: selectedPayment === "credit" ? primary : "#E5E7EB", background: selectedPayment === "credit" ? `${primary}08` : "#fff" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4" style={{ color: selectedPayment === "credit" ? primary : "#9CA3AF" }} />
                      <div>
                        <p className="text-xs font-semibold">Cartão de crédito</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-red-500">★</span>
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: selectedPayment === "credit" ? primary : "#D1D5DB" }}>
                        {selectedPayment === "credit" && <div className="w-2.5 h-2.5 rounded-full" style={{ background: primary }} />}
                      </div>
                    </div>
                  </div>
                  {selectedPayment === "credit" && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-gray-100">
                      <div className="flex gap-1.5">
                        {["Visa", "MC", "Elo"].map(b => (
                          <span key={b} className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">{b}</span>
                        ))}
                      </div>
                      <input className={inputClass} placeholder="Número do cartão" />
                      <input className={inputClass} placeholder="Nome no cartão *" />
                      <input className={inputClass} placeholder="Número do cartão *" />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-2">
                          <span className="text-[11px] text-gray-400">Mês</span>
                          <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-2">
                          <span className="text-[11px] text-gray-400">Ano</span>
                          <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
                        </div>
                        <input className={inputClass} placeholder="CVV *" />
                      </div>
                      <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-2">
                        <span className="text-[11px] text-gray-600">1x de {formatCurrency(unitPrice)} (à vista)</span>
                        <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Apple Pay */}
              <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                <div className="w-4 h-4 rounded-full bg-black" />
                <span className="text-xs font-medium">Apple Pay</span>
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 ml-auto" />
              </div>

              {/* Boleto */}
              {config.boleto && (
                <div
                  onClick={() => setSelectedPayment("boleto")}
                  className="flex items-center gap-2.5 rounded-lg border p-3 cursor-pointer transition-all"
                  style={{ borderColor: selectedPayment === "boleto" ? primary : "#E5E7EB" }}
                >
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium">Boleto</span>
                  <span className="text-[10px] text-gray-400 ml-1">Pagamento em 3 dias</span>
                  <div className="w-4 h-4 rounded-full border-2 ml-auto" style={{ borderColor: selectedPayment === "boleto" ? primary : "#D1D5DB" }}>
                    {selectedPayment === "boleto" && <div className="w-2.5 h-2.5 rounded-full mx-auto mt-[1px]" style={{ background: primary }} />}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500">Total a pagar</span>
            <span className="text-sm font-extrabold ml-2" style={{ color: primary }}>{formatCurrency(unitPrice)}</span>
          </div>
          <button
            className="px-8 py-3 font-bold text-sm rounded-full transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
            style={{ background: primary, color: "#FFFFFF" }}
          >
            <Lock className="w-3.5 h-3.5" />
            {config.buttonText || "Criar pedido"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-0.5 px-4 py-1">
        {progressColors.map((c, i) => (
          <div key={i} className="flex-1 h-1 rounded-full" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}