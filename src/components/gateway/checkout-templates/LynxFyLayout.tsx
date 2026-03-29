import { useState, useEffect } from "react";
import { Lock, ShieldCheck, CreditCard, Package, Minus, Plus } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, BoletoIcon, PaymentFooter } from "./PaymentIcons";

interface Props {
  config: Record<string, any>;
}

export default function LynxFyLayout({ config }: Props) {
  const [countdown, setCountdown] = useState({ h: 0, m: config.timerMinutes || 10, s: 0 });
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!config.showTimer) return;
    setCountdown({ h: 0, m: config.timerMinutes || 10, s: 0 });
  }, [config.timerMinutes, config.showTimer]);

  useEffect(() => {
    if (!config.showTimer) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev.h === 0 && prev.m === 0 && prev.s === 0) return prev;
        if (prev.s === 0) {
          if (prev.m === 0) return { h: prev.h - 1, m: 59, s: 59 };
          return { ...prev, m: prev.m - 1, s: 59 };
        }
        return { ...prev, s: prev.s - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [config.showTimer]);

  const primary = config.primaryColor || "#16A34A";
  const unitPrice = config.price || 9900;
  const originalPrice = config.originalPrice || 0;
  const frete = 1500;
  const subtotal = unitPrice * quantity;
  const total = subtotal + frete;

  const timerStr = `${String(countdown.h).padStart(2, "0")}h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  const inputClass = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-md outline-none bg-white text-gray-800 placeholder:text-gray-400 focus:border-gray-400 transition-colors";
  const labelClass = "text-xs font-medium text-gray-600 block mb-1";

  return (
    <div className="h-full overflow-auto" style={{ background: "#F5F5F5", fontFamily: "'Inter', sans-serif", color: "#1F2937" }}>

      {/* Timer */}
      {config.showTimer && (
        <div
          className="w-full text-center py-2.5 text-sm font-semibold"
          style={{ background: primary, color: "#FFFFFF" }}
        >
          Oferta termina em: <span className="font-bold tracking-wider ml-1">{timerStr}</span>
        </div>
      )}

      {/* Main */}
      <div className="mx-auto px-3 py-6" style={{ maxWidth: "960px" }}>
        <div className="flex flex-col lg:flex-row gap-5">

          {/* ═══ LEFT: Form ═══ */}
          <div className="flex-1 space-y-4">

            {/* Informações de contato */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Informações de contato</h3>
              <div>
                <label className={labelClass}>E-mail</label>
                <input className={inputClass} placeholder="seu@email.com" />
              </div>
              <div>
                <label className={labelClass}>Nome completo</label>
                <input className={inputClass} placeholder="Digite seu nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {config.showPhone && (
                  <div>
                    <label className={labelClass}>Celular</label>
                    <div className="flex gap-1.5">
                      <span className="flex items-center px-2 py-2 border border-gray-200 rounded-md text-xs text-gray-500 bg-gray-50">🇧🇷 +55</span>
                      <input className={inputClass} placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                )}
                {config.showCpf && (
                  <div>
                    <label className={labelClass}>CPF/CNPJ</label>
                    <input className={inputClass} placeholder="000.000.000-00" />
                  </div>
                )}
              </div>
            </div>

            {/* Endereço de entrega */}
            {config.showAddress && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <h3 className="text-sm font-bold text-gray-900">Endereço de entrega</h3>
                <div>
                  <label className={labelClass}>CEP</label>
                  <input className={inputClass} placeholder="00000-000" />
                </div>
                <div>
                  <label className={labelClass}>Rua</label>
                  <input className={inputClass} placeholder="Rua, avenida..." />
                </div>
                <div>
                  <label className={labelClass}>Bairro</label>
                  <input className={inputClass} placeholder="Seu bairro" />
                </div>
                <div>
                  <label className={labelClass}>Complemento</label>
                  <input className={inputClass} placeholder="Apto, bloco (opcional)" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Número</label>
                    <input className={inputClass} placeholder="Nº" />
                  </div>
                  <div>
                    <label className={labelClass}>Cidade</label>
                    <input className={inputClass} placeholder="Cidade" />
                  </div>
                  <div>
                    <label className={labelClass}>Estado</label>
                    <input className={inputClass} placeholder="UF" />
                  </div>
                </div>
              </div>
            )}

            {/* Pagamento */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Pagamento</h3>
                <p className="text-xs text-gray-500 mt-0.5">Todos os dados são seguros e criptografados</p>
              </div>
              <div className="space-y-2">
                {config.pix && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer" style={{ borderColor: primary, background: `${primary}08` }}>
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: primary }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: primary }} />
                    </div>
                    <PixIcon size={18} />
                    <span className="text-sm font-medium">Pix</span>
                  </div>
                )}
                {config.creditCard && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <div className="flex-1">
                      <span className="text-sm text-gray-600">Cartão de Crédito</span>
                      <p className="text-[10px] font-medium text-[#EF4444]">Sem juros</p>
                      <CardBrandsRow size={24} />
                    </div>
                  </div>
                )}
                {config.boleto && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    <div className="text-gray-400"><BoletoIcon size={18} /></div>
                    <div>
                      <span className="text-sm text-gray-600">Boleto Bancário</span>
                      <p className="text-[10px] text-gray-400">Vencimento em 3 dias</p>
                    </div>
                  </div>
                )}
              </div>

              <button
                className="w-full py-3.5 font-bold text-sm rounded-lg transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
                style={{ background: primary, color: "#FFFFFF" }}
              >
                <Lock className="w-3.5 h-3.5" />
                {config.buttonText || "🔒 Finalizar Pedido"}
              </button>
            </div>
          </div>

          {/* ═══ RIGHT: Summary sidebar ═══ */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4">

            {/* Resumo do Pedido */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Resumo do Pedido
                </h3>
                <span style={{ color: primary }} className="text-sm font-bold">{formatCurrency(total)}</span>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Produtos</span>
                  <span className="text-gray-800 font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Frete</span>
                  <span className="text-gray-800 font-medium">{formatCurrency(frete)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                  <span className="text-gray-900">Total</span>
                  <span style={{ color: primary }}>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Product with quantity */}
              <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {config.productImage ? (
                    <img src={config.productImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center">
                      <Minus className="w-3 h-3 text-gray-400" />
                    </button>
                    <span className="text-xs font-medium text-gray-700 w-4 text-center">{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)} className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center">
                      <Plus className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-900">{formatCurrency(unitPrice)}</span>
              </div>

              {/* Coupon */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1.5">Tem cupom?</p>
                <div className="flex gap-2">
                  <input className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md outline-none placeholder:text-gray-400" placeholder="Código do cupom" />
                  <button className="px-3 py-1.5 text-xs font-semibold rounded-md text-white" style={{ background: primary }}>
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PaymentFooter />
    </div>
  );
}
