import { useState, useEffect } from "react";
import { Lock, ShieldCheck, CreditCard, Package, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, BoletoIcon, PaymentFooter } from "./PaymentIcons";
import { getCheckoutStyles, inputStyle, cardStyle, buttonStyle } from "./checkout-style-helpers";

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

  const s = getCheckoutStyles(config);
  const unitPrice = config.price || 9900;
  const frete = 1500;
  const timerStr = `${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  return (
    <div className="h-full overflow-auto" style={{ background: s.bgColor, fontFamily: s.fontFamily, color: s.textColor }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: s.cardBg, borderColor: s.cardBorder }}>
        <span className="text-sm font-bold" style={{ color: s.cardTitle }}>
          {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-6 object-contain" /> : "Minha Loja"}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#16A34A" }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          Pagamento 100% seguro
        </span>
      </div>

      {config.showTimer && (
        <div className="w-full text-center py-2.5 text-sm font-semibold" style={{ background: s.primary, color: "#FFFFFF" }}>
          Oferta termina em: <span className="font-bold tracking-wide ml-1">{timerStr}</span>
        </div>
      )}

      <div className="mx-auto px-3 py-6" style={{ maxWidth: "900px" }}>
        <div className="flex flex-col md:flex-row gap-5">
          <div className="flex-1 space-y-4">
            {/* Informações de contato */}
            <div className="border p-5 space-y-3" style={cardStyle(s)}>
              <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Informações de contato</h3>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>E-mail</label>
                <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="seu@email.com" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Nome completo</label>
                <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Digite seu nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Celular</label>
                  <div className="flex gap-1.5">
                    <span className="flex items-center px-2 py-2 border text-xs" style={{ borderRadius: s.fieldRadius, borderColor: s.inputBorder, background: s.isDark ? "#222" : "#F9FAFB", color: s.cardDesc }}>🇧🇷 +55</span>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                {config.showCpf && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CPF/CNPJ</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="000.000.000-00" />
                  </div>
                )}
              </div>
            </div>

            {/* Banners */}
            <div className="overflow-hidden border" style={{ borderRadius: s.cardRadius, borderColor: s.cardBorder }}>
              <div className="py-4 px-5 text-center font-bold text-sm" style={{ background: "linear-gradient(135deg, #0EA5E9, #2563EB)", color: "#fff" }}>
                🚚 Frete Grátis para todo o Brasil!
              </div>
            </div>
            <div className="overflow-hidden border" style={{ borderRadius: s.cardRadius, borderColor: s.cardBorder }}>
              <div className="py-3 px-5 text-center font-semibold text-xs" style={{ background: "linear-gradient(135deg, #3B82F6, #6366F1)", color: "#fff" }}>
                ⚡ Entrega digital imediata após confirmação
              </div>
            </div>

            {/* Endereço */}
            {config.showAddress && (
              <div className="border p-5 space-y-3" style={cardStyle(s)}>
                <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Endereço de entrega</h3>
                <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CEP</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="00000-000" /></div>
                <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Rua</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Rua, avenida..." /></div>
                <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Bairro</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Seu bairro" /></div>
                <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Complemento</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Apto, bloco (opcional)" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Número</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Nº" /></div>
                  <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Cidade</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Cidade" /></div>
                  <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Estado</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="UF" /></div>
                </div>
              </div>
            )}

            {/* Pagamento */}
            <div className="border p-5 space-y-3" style={cardStyle(s)}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Pagamento</h3>
                <p className="text-xs mt-0.5" style={{ color: s.cardDesc }}>Todos os dados são seguros e criptografados</p>
              </div>
              <div className="space-y-2">
                {config.pix && (
                  <div className="flex items-center gap-3 p-3 border-2 cursor-pointer" style={{ borderRadius: s.cardRadius, borderColor: s.primary, background: `${s.primary}08` }}>
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: s.primary }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.primary }} />
                    </div>
                    <PixIcon size={18} />
                    <span className="text-sm font-medium" style={{ color: s.cardText }}>Pix</span>
                  </div>
                )}
                {config.creditCard && (
                  <div className="flex items-center gap-3 p-3 border cursor-pointer" style={{ borderRadius: s.cardRadius, borderColor: s.cardBorder }}>
                    <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: s.cardBorder }} />
                    <CreditCard className="w-4 h-4" style={{ color: s.cardLabel }} />
                    <div className="flex-1">
                      <span className="text-sm" style={{ color: s.cardText }}>Cartão de Crédito</span>
                      <p className="text-[10px] font-medium text-[#EF4444]">Sem juros</p>
                      <CardBrandsRow size={24} />
                    </div>
                  </div>
                )}
                {config.boleto && (
                  <div className="flex items-center gap-3 p-3 border cursor-pointer" style={{ borderRadius: s.cardRadius, borderColor: s.cardBorder }}>
                    <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: s.cardBorder }} />
                    <div style={{ color: s.cardLabel }}><BoletoIcon size={18} /></div>
                    <span className="text-sm" style={{ color: s.cardText }}>Boleto</span>
                  </div>
                )}
              </div>
              <button
                className="w-full py-3.5 font-bold text-sm transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
                style={buttonStyle(s)}
              >
                <Lock className="w-3.5 h-3.5" />
                {config.buttonText || "Finalizar Pedido"}
              </button>
            </div>
          </div>

          {/* RIGHT: Summary sidebar */}
          <div className="w-full md:w-60 flex-shrink-0 space-y-4">
            <div className="border p-4" style={cardStyle(s)}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                  {config.productImage ? <img src={config.productImage} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5" style={{ color: s.cardLabel }} />}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: s.cardTitle }}>{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <p className="text-sm font-bold" style={{ color: s.primary }}>{formatCurrency(unitPrice)}</p>
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed p-4" style={{ borderRadius: s.cardRadius, borderColor: "#93C5FD", background: s.cardBg }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                  <ShoppingBag className="w-5 h-5" style={{ color: s.cardLabel }} />
                </div>
                <p className="text-xs" style={{ color: s.cardDesc }}>Bump de venda (solte aqui)</p>
              </div>
            </div>

            <div className="border p-4" style={cardStyle(s)}>
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-xs border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Código do cupom" />
                <button className="px-3 py-1.5 text-xs font-semibold text-white" style={{ borderRadius: s.buttonRadius, background: s.buttonColor }}>Aplicar</button>
              </div>
            </div>

            <div className="border p-4 space-y-2" style={cardStyle(s)}>
              <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Subtotal / 1 item</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(unitPrice)}</span></div>
              <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Frete</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(frete)}</span></div>
              <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <span style={{ color: s.primary }}>Total</span>
                <span style={{ color: s.primary }}>{formatCurrency(unitPrice + frete)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-xs font-semibold" style={{ color: s.cardTitle }}>Atenção</p>
              <p className="text-xs mt-0.5" style={{ color: s.cardDesc }}>Não perca essa oportunidade!</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <ShoppingBag className="w-4 h-4 text-green-600" />
                <span className="text-lg font-extrabold text-green-600">55 Compras</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PaymentFooter />
    </div>
  );
}
