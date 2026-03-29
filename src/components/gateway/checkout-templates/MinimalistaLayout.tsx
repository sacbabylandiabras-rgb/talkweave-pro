import { useState, useEffect } from "react";
import { ShieldCheck, Lock, Package, CreditCard, Truck, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, BoletoIcon, PaymentFooter } from "./PaymentIcons";
import { getCheckoutStyles, inputStyle, cardStyle, buttonStyle, stepStyle } from "./checkout-style-helpers";

interface Props {
  config: Record<string, any>;
}

export default function MinimalistaLayout({ config }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 9, s: 0 });

  useEffect(() => {
    if (!config.showTimer) return;
    setCountdown({ m: config.timerMinutes || 9, s: 0 });
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
  const timerStr = `${String(0).padStart(2, "0")}h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  const steps = [
    { num: 1, label: "Identificação", icon: <ShoppingBag className="w-4 h-4" /> },
    { num: 2, label: "Entrega", icon: <Truck className="w-4 h-4" /> },
    { num: 3, label: "Pagamento", icon: <CreditCard className="w-4 h-4" /> },
  ];

  const unitPrice = config.price;
  const frete = 1500;

  return (
    <div className="h-full overflow-auto" style={{ background: s.bgColor, fontFamily: s.fontFamily, color: s.textColor }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: s.cardBg, borderColor: s.cardBorder }}>
        <span className="text-sm font-bold" style={{ color: s.cardTitle }}>
          {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-6 object-contain" /> : "Minha Loja"}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#16A34A" }}>
          <Lock className="w-3 h-3" />
          PAGAMENTO 100% SEGURO
        </span>
      </div>

      {/* Countdown */}
      {config.showTimer && (
        <div className="w-full text-center py-2.5 text-sm font-medium" style={{ background: s.primary, color: "#FFFFFF" }}>
          Oferta termina em: <span className="font-bold tracking-wide">{timerStr}</span>
        </div>
      )}

      <div className="mx-auto px-3 py-6" style={{ maxWidth: "900px" }}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* LEFT: Steps + Form */}
          <div className="flex-1 space-y-5">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2">
              {steps.map((st, i) => (
                <div key={st.num} className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(st.num as 1 | 2 | 3)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all"
                    style={{
                      borderRadius: s.stepRadius,
                      background: step === st.num ? `${s.stepBg}15` : "transparent",
                      color: step === st.num ? s.stepBg : s.cardLabel,
                      border: step === st.num ? `1.5px solid ${s.stepBg}` : "1.5px solid transparent",
                    }}
                  >
                    <div
                      className="w-6 h-6 flex items-center justify-center text-[10px] font-bold"
                      style={stepStyle(s, step === st.num)}
                    >
                      {st.num}
                    </div>
                    <span className="hidden sm:inline">{st.label}</span>
                  </button>
                  {i < steps.length - 1 && <div className="w-6 h-[1.5px] rounded" style={{ background: s.cardBorder }} />}
                </div>
              ))}
            </div>

            {/* Step 1: Identificação */}
            {step === 1 && (
              <div className="border p-5 space-y-4" style={cardStyle(s)}>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: s.cardTitle }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={stepStyle(s)}>1</div>
                    Identificação
                  </h3>
                  <p className="text-xs mt-1 ml-7" style={{ color: s.cardDesc }}>
                    Preencha as informações essenciais para concluir sua compra com segurança.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Nome completo</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Digite seu nome completo" />
                  </div>
                  {config.showCpf && (
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CPF ou CNPJ</label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="000.000.000-00" />
                    </div>
                  )}
                  {config.showPhone && (
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Celular (WhatsApp)</label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="+55 (00) 00000-0000" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>E-mail</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="seu@email.com" />
                  </div>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 font-bold text-sm transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
                  style={buttonStyle(s)}
                >
                  PRÓXIMO
                </button>
              </div>
            )}

            {/* Step 2: Entrega */}
            {step === 2 && (
              <div className="border p-5 space-y-4" style={cardStyle(s)}>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: s.cardTitle }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={stepStyle(s)}>2</div>
                    Entrega
                  </h3>
                  <p className="text-xs mt-1 ml-7" style={{ color: s.cardDesc }}>
                    Para realizar o frete é necessário preencher todos os campos abaixo.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CEP</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="00000-000" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Cidade</label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Sua cidade" />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Estado</label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="UF" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Endereço</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Rua, número" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Complemento</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Apto, bloco (opcional)" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 text-sm font-medium border" style={{ borderRadius: s.buttonRadius, borderColor: s.cardBorder, color: s.cardLabel, background: s.cardBg }}>
                    Voltar
                  </button>
                  <button onClick={() => setStep(3)} className="flex-1 py-3 font-bold text-sm" style={buttonStyle(s)}>
                    PRÓXIMO
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Pagamento */}
            {step === 3 && (
              <div className="border p-5 space-y-4" style={cardStyle(s)}>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: s.cardTitle }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={stepStyle(s)}>3</div>
                    Pagamento
                  </h3>
                  <p className="text-xs mt-1 ml-7" style={{ color: s.cardDesc }}>
                    Complete as etapas anteriores para prosseguir!
                  </p>
                </div>
                <div className="space-y-2">
                  {config.pix && (
                    <div className="flex items-center gap-3 p-3 border-2 cursor-pointer" style={{ borderRadius: s.cardRadius, borderColor: s.primary, background: `${s.primary}08` }}>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: s.primary }}>
                        <div className="w-3 h-3 rounded-full" style={{ background: s.primary }} />
                      </div>
                      <PixIcon size={18} />
                      <span className="text-sm font-medium" style={{ color: s.cardText }}>PIX — Aprovação instantânea</span>
                    </div>
                  )}
                  {config.creditCard && (
                    <div className="flex items-center gap-3 p-3 border cursor-pointer" style={{ borderRadius: s.cardRadius, borderColor: s.cardBorder }}>
                      <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: s.cardBorder }} />
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
                      <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: s.cardBorder }} />
                      <div style={{ color: s.cardLabel }}><BoletoIcon size={18} /></div>
                      <span className="text-sm" style={{ color: s.cardText }}>Boleto</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(2)} className="flex-1 py-3 text-sm font-medium border" style={{ borderRadius: s.buttonRadius, borderColor: s.cardBorder, color: s.cardLabel, background: s.cardBg }}>
                    Voltar
                  </button>
                  <button className="flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2" style={buttonStyle(s)}>
                    <Lock className="w-3.5 h-3.5" />
                    FINALIZAR PEDIDO
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Summary sidebar */}
          <div className="w-full md:w-60 flex-shrink-0 space-y-4">
            <div className="border p-4 space-y-3" style={cardStyle(s)}>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: s.cardTitle }}>Resumo (1)</h4>
              </div>
              <div className="text-xs" style={{ color: s.cardDesc }}>Tem um cupom?</div>
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-xs border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Código do cupom" />
                <button className="px-3 py-1.5 text-xs font-medium border" style={{ borderRadius: s.fieldRadius, borderColor: s.cardBorder, color: s.cardText, background: s.cardBg }}>
                  Aplicar
                </button>
              </div>
              <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: s.cardDesc }}>Produtos</span>
                  <span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(unitPrice)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: s.cardDesc }}>Frete</span>
                  <span className="font-medium" style={{ color: s.cardText }}>+ {formatCurrency(frete)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                  <span style={{ color: "#16A34A" }}>Total</span>
                  <span style={{ color: "#16A34A" }}>{formatCurrency(unitPrice + frete)}</span>
                </div>
              </div>
            </div>

            <div className="border p-4" style={cardStyle(s)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                  {config.productImage ? (
                    <img src={config.productImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5" style={{ color: s.cardLabel }} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: s.cardTitle }}>{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <p className="text-xs" style={{ color: s.cardDesc }}>{formatCurrency(unitPrice)}</p>
                </div>
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
