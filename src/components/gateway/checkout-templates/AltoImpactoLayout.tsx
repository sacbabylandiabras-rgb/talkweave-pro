import { useState, useEffect } from "react";
import { Lock, ShieldCheck, CreditCard, Package, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, BoletoIcon, PaymentFooter } from "./PaymentIcons";

interface Props {
  config: Record<string, any>;
}

export default function AltoImpactoLayout({ config }: Props) {
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 10, s: 0 });

  useEffect(() => {
    if (!config.showTimer) return;
    setCountdown({ m: config.timerMinutes || 10, s: 0 });
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

  const primary = config.primaryColor || "#E8174A";
  const unitPrice = config.price || 9900;
  const frete = 1500;
  const timerStr = `${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  const inputClass = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-md outline-none bg-white text-gray-800 placeholder:text-gray-400 focus:border-gray-400 transition-colors";
  const labelClass = "text-xs font-medium text-gray-600 block mb-1";

  return (
    <div className="h-full overflow-auto" style={{ background: "#F5F5F5", fontFamily: "'Inter', sans-serif", color: "#1F2937" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <span className="text-sm font-bold text-gray-900">
          {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-6 object-contain" /> : "Minha Loja"}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#16A34A" }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          Pagamento 100% seguro
        </span>
      </div>

      {/* Countdown */}
      {config.showTimer && (
        <div className="w-full text-center py-2.5 text-sm font-semibold" style={{ background: primary, color: "#FFFFFF" }}>
          Oferta termina em: <span className="font-bold tracking-wide ml-1">{timerStr}</span>
        </div>
      )}

      {/* Main: 2 columns desktop, 1 column mobile */}
      <div className="mx-auto px-3 py-6" style={{ maxWidth: "900px" }}>
        <div className="flex flex-col md:flex-row gap-5">

          {/* LEFT: All form sections (one step) */}
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
                <div>
                  <label className={labelClass}>Celular</label>
                  <div className="flex gap-1.5">
                    <span className="flex items-center px-2 py-2 border border-gray-200 rounded-md text-xs text-gray-500 bg-gray-50">🇧🇷 +55</span>
                    <input className={inputClass} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                {config.showCpf && (
                  <div>
                    <label className={labelClass}>CPF/CNPJ</label>
                    <input className={inputClass} placeholder="000.000.000-00" />
                  </div>
                )}
              </div>
            </div>

            {/* Banners */}
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="py-4 px-5 text-center font-bold text-sm" style={{ background: "linear-gradient(135deg, #0EA5E9, #2563EB)", color: "#fff" }}>
                🚚 Frete Grátis para todo o Brasil!
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <div className="py-3 px-5 text-center font-semibold text-xs" style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)", color: "#fff" }}>
                ⚡ Entrega digital imediata após confirmação
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
                    <QrCode className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium">Pix</span>
                  </div>
                )}
                {config.creditCard && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Cartão de Crédito</span>
                    <div className="ml-auto flex gap-1">
                      {["Visa", "MC", "Elo"].map(b => (
                        <span key={b} className="text-[9px] px-1 py-0.5 rounded border border-gray-200 text-gray-400">{b}</span>
                      ))}
                    </div>
                  </div>
                )}
                {config.boleto && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Boleto Bancário</span>
                    <span className="ml-auto text-[10px] text-gray-400">Vencimento em 3 dias</span>
                  </div>
                )}
              </div>

              <button
                className="w-full py-3.5 font-bold text-sm rounded-lg transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
                style={{ background: primary, color: "#FFFFFF" }}
              >
                <Lock className="w-3.5 h-3.5" />
                {config.buttonText || "Finalizar Pedido"}
              </button>
            </div>
          </div>

          {/* RIGHT: Summary sidebar */}
          <div className="w-full md:w-60 flex-shrink-0 space-y-4">
            {/* Product */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {config.productImage ? (
                    <img src={config.productImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <p className="text-sm font-bold" style={{ color: primary }}>{formatCurrency(unitPrice)}</p>
                </div>
              </div>
            </div>

            {/* Order Bump */}
            <div className="rounded-xl border-2 border-dashed border-blue-300 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">Bump de venda (solte aqui)</p>
              </div>
            </div>

            {/* Coupon */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md outline-none placeholder:text-gray-400" placeholder="Código do cupom" />
                <button className="px-3 py-1.5 text-xs font-semibold rounded-md text-white" style={{ background: primary }}>
                  Aplicar
                </button>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Subtotal / 1 item</span>
                <span className="text-gray-800 font-medium">{formatCurrency(unitPrice)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Frete</span>
                <span className="text-gray-800 font-medium">{formatCurrency(frete)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                <span style={{ color: primary }}>Total</span>
                <span style={{ color: primary }}>{formatCurrency(unitPrice + frete)}</span>
              </div>
            </div>

            {/* Social Proof */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-xs font-semibold text-gray-800">Atenção</p>
              <p className="text-xs text-gray-600 mt-0.5">Não perca essa oportunidade!</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <ShoppingBag className="w-4 h-4 text-green-600" />
                <span className="text-lg font-extrabold text-green-600">55 Compras</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-gray-400 py-4">Formas de Pagamento</p>
    </div>
  );
}