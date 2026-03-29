import { useState, useEffect } from "react";
import { Lock, CreditCard, Package, Minus, Plus } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, BoletoIcon, PaymentFooter } from "./PaymentIcons";
import { getCheckoutStyles, inputStyle, cardStyle, buttonStyle } from "./checkout-style-helpers";

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

  const s = getCheckoutStyles(config);
  const unitPrice = config.price || 9900;
  const frete = 1500;
  const subtotal = unitPrice * quantity;
  const total = subtotal + frete;
  const timerStr = `${String(countdown.h).padStart(2, "0")}h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  return (
    <div className="h-full overflow-auto" style={{ background: s.bgColor, fontFamily: s.fontFamily, color: s.textColor }}>
      {config.showTimer && (
        <div className="w-full text-center py-2.5 text-sm font-semibold" style={{ background: s.primary, color: "#FFFFFF" }}>
          Oferta termina em: <span className="font-bold tracking-wider ml-1">{timerStr}</span>
        </div>
      )}

      <div className="mx-auto px-3 py-6" style={{ maxWidth: "960px" }}>
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 space-y-4">
            {/* Informações de contato */}
            <div className="border p-5 space-y-3" style={cardStyle(s)}>
              <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Informações de contato</h3>
              <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>E-mail</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="seu@email.com" /></div>
              <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Nome completo</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Digite seu nome completo" /></div>
              <div className="grid grid-cols-2 gap-3">
                {config.showPhone && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Celular</label>
                    <div className="flex gap-1.5">
                      <span className="flex items-center px-2 py-2 border text-xs" style={{ borderRadius: s.fieldRadius, borderColor: s.inputBorder, background: s.isDark ? "#222" : "#F9FAFB", color: s.cardDesc }}>🇧🇷 +55</span>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                )}
                {config.showCpf && (
                  <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CPF/CNPJ</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="000.000.000-00" /></div>
                )}
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
                    <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: s.primary }}><div className="w-2.5 h-2.5 rounded-full" style={{ background: s.primary }} /></div>
                    <PixIcon size={18} /><span className="text-sm font-medium" style={{ color: s.cardText }}>Pix</span>
                  </div>
                )}
                {config.creditCard && (
                  <div className="flex items-center gap-3 p-3 border cursor-pointer" style={{ borderRadius: s.cardRadius, borderColor: s.cardBorder }}>
                    <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: s.cardBorder }} />
                    <CreditCard className="w-4 h-4" style={{ color: s.cardLabel }} />
                    <div className="flex-1"><span className="text-sm" style={{ color: s.cardText }}>Cartão de Crédito</span><p className="text-[10px] font-medium text-[#EF4444]">Sem juros</p><CardBrandsRow size={24} /></div>
                  </div>
                )}
                {config.boleto && (
                  <div className="flex items-center gap-3 p-3 border cursor-pointer" style={{ borderRadius: s.cardRadius, borderColor: s.cardBorder }}>
                    <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: s.cardBorder }} /><div style={{ color: s.cardLabel }}><BoletoIcon size={18} /></div>
                    <div><span className="text-sm" style={{ color: s.cardText }}>Boleto Bancário</span><p className="text-[10px]" style={{ color: s.cardDesc }}>Vencimento em 3 dias</p></div>
                  </div>
                )}
              </div>
              <button className="w-full py-3.5 font-bold text-sm transition-transform hover:scale-[1.01] flex items-center justify-center gap-2" style={buttonStyle(s)}>
                <Lock className="w-3.5 h-3.5" />{config.buttonText || "🔒 Finalizar Pedido"}
              </button>
            </div>
          </div>

          {/* RIGHT: Summary sidebar */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
            <div className="border p-4 space-y-3" style={cardStyle(s)}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: s.cardDesc }}>Resumo do Pedido</h3>
                <span className="text-sm font-bold" style={{ color: s.primary }}>{formatCurrency(total)}</span>
              </div>
              <div className="space-y-1.5 pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Produtos</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Frete</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(frete)}</span></div>
                <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                  <span style={{ color: s.cardTitle }}>Total</span><span style={{ color: s.primary }}>{formatCurrency(total)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-3" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                  {config.productImage ? <img src={config.productImage} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5" style={{ color: s.cardLabel }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: s.cardTitle }}>{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-5 h-5 rounded border flex items-center justify-center" style={{ borderColor: s.cardBorder }}><Minus className="w-3 h-3" style={{ color: s.cardLabel }} /></button>
                    <span className="text-xs font-medium w-4 text-center" style={{ color: s.cardText }}>{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)} className="w-5 h-5 rounded border flex items-center justify-center" style={{ borderColor: s.cardBorder }}><Plus className="w-3 h-3" style={{ color: s.cardLabel }} /></button>
                  </div>
                </div>
                <span className="text-xs font-bold" style={{ color: s.cardTitle }}>{formatCurrency(unitPrice)}</span>
              </div>
              <div className="pt-3" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <p className="text-[10px] mb-1.5" style={{ color: s.cardDesc }}>Tem cupom?</p>
                <div className="flex gap-2">
                  <input className="flex-1 px-2.5 py-1.5 text-xs border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Código do cupom" />
                  <button className="px-3 py-1.5 text-xs font-semibold text-white" style={{ borderRadius: s.buttonRadius, background: s.buttonColor }}>Aplicar</button>
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
