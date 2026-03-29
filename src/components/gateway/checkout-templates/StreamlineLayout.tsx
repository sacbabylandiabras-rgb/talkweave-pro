import { useState, useEffect } from "react";
import { Lock, ShieldCheck, CreditCard, Package, User, Truck, ChevronDown, ChevronUp, Star } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, BoletoIcon, PaymentFooter } from "./PaymentIcons";
import { getCheckoutStyles, inputStyle, cardStyle, buttonStyle, stepStyle } from "./checkout-style-helpers";

interface Props {
  config: Record<string, any>;
}

export default function StreamlineLayout({ config }: Props) {
  const [countdown, setCountdown] = useState({ h: 0, m: config.timerMinutes || 9, s: 0 });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identification: true,
    payment: false,
    delivery: false,
  });

  useEffect(() => {
    if (!config.showTimer) return;
    setCountdown({ h: 0, m: config.timerMinutes || 9, s: 0 });
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
  const originalPrice = config.originalPrice || 0;
  const frete = 1500;
  const total = unitPrice + frete;
  const timerStr = `${String(countdown.h).padStart(2, "0")} : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const SectionHeader = ({ number, title, sectionKey }: { icon: any; number: number; title: string; sectionKey: string }) => (
    <button onClick={() => toggleSection(sectionKey)} className="w-full flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 flex items-center justify-center text-xs font-bold" style={stepStyle(s)}>{number}</div>
        <span className="text-sm font-bold" style={{ color: s.cardTitle }}>{title}</span>
      </div>
      {openSections[sectionKey] ? <ChevronUp className="w-4 h-4" style={{ color: s.cardLabel }} /> : <ChevronDown className="w-4 h-4" style={{ color: s.cardLabel }} />}
    </button>
  );

  const StepTabs = () => (
    <div className="hidden md:flex items-center border overflow-hidden" style={{ ...cardStyle(s) }}>
      {[
        { icon: User, label: "Identificação", num: 1 },
        { icon: CreditCard, label: "Pagamento", num: 2 },
        { icon: Truck, label: "Entrega", num: 3 },
      ].map((st) => (
        <div key={st.num} className="flex-1 flex items-center gap-2 px-5 py-3" style={{ borderRight: `1px solid ${s.cardBorder}` }}>
          <div className="w-6 h-6 flex items-center justify-center text-[10px] font-bold" style={stepStyle(s)}>{st.num}</div>
          <span className="text-xs font-semibold" style={{ color: s.cardText }}>{st.label}</span>
        </div>
      ))}
    </div>
  );

  const Testimonial = ({ name, text }: { name: string; text: string }) => (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-center gap-1 mb-1">
        {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
      </div>
      <p className="text-xs font-bold" style={{ color: s.cardTitle }}>{name}</p>
      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: s.cardDesc }}>{text}</p>
    </div>
  );

  return (
    <div className="h-full overflow-auto" style={{ background: s.bgColor, fontFamily: s.fontFamily, color: s.textColor }}>
      {config.productImage && (
        <div className="w-full max-h-52 overflow-hidden"><img src={config.productImage} alt="" className="w-full h-full object-cover" /></div>
      )}

      {config.showTimer && (
        <div className="w-full text-center py-2.5 text-sm font-semibold flex items-center justify-center gap-2" style={{ background: s.primary, color: "#FFFFFF" }}>
          Oferta termina em: <span className="font-bold tracking-wider bg-white/20 px-3 py-0.5 rounded-full text-xs">{timerStr}</span>
        </div>
      )}

      <div className="mx-auto px-3 py-6" style={{ maxWidth: "960px" }}>
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 space-y-4">
            <StepTabs />

            {/* 1. Identificação */}
            <div className="border overflow-hidden" style={cardStyle(s)}>
              <div className="px-5" style={{ borderBottom: `1px solid ${s.cardBorder}` }}>
                <SectionHeader icon={User} number={1} title="Identificação" sectionKey="identification" />
                <p className="text-[11px] -mt-2 pb-3" style={{ color: s.cardDesc }}>Preencha seus dados para concluir sua compra com segurança.</p>
              </div>
              {openSections.identification && (
                <div className="p-5 space-y-3">
                  <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Nome completo</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Digite seu nome completo" /></div>
                  {config.showCpf && <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CPF ou CNPJ</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="000.000.000-00" /></div>}
                  {config.showPhone && (
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Celular (WhatsApp)</label>
                      <div className="flex gap-2">
                        <span className="flex items-center px-2.5 py-2 border text-xs" style={{ borderRadius: s.fieldRadius, borderColor: s.inputBorder, background: s.isDark ? "#222" : "#F9FAFB", color: s.cardDesc }}>🇧🇷 +55</span>
                        <input className="flex-1 px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="(00) 00000-0000" />
                      </div>
                    </div>
                  )}
                  <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>E-mail</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="seu@email.com" /></div>
                  <button className="w-full py-3 font-bold text-sm uppercase tracking-wide transition-transform hover:scale-[1.01]" style={buttonStyle(s)}>{config.buttonText || "PRÓXIMO"}</button>
                </div>
              )}
            </div>

            {/* 2. Pagamento */}
            <div className="border overflow-hidden" style={cardStyle(s)}>
              <div className="px-5" style={{ borderBottom: `1px solid ${s.cardBorder}` }}>
                <SectionHeader icon={CreditCard} number={2} title="Pagamento" sectionKey="payment" />
                <p className="text-[11px] -mt-2 pb-3" style={{ color: s.cardDesc }}>Complete os dados do pagamento para finalizar sua compra.</p>
              </div>
              {openSections.payment && (
                <div className="p-5 space-y-3">
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
                      <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: s.cardBorder }} /><div style={{ color: s.cardLabel }}><BoletoIcon size={18} /></div><span className="text-sm" style={{ color: s.cardText }}>Boleto</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Entrega */}
            {config.showAddress && (
              <div className="border overflow-hidden" style={cardStyle(s)}>
                <div className="px-5" style={{ borderBottom: `1px solid ${s.cardBorder}` }}>
                  <SectionHeader icon={Truck} number={3} title="Entrega" sectionKey="delivery" />
                </div>
                {openSections.delivery && (
                  <div className="p-5 space-y-3">
                    <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CEP</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="00000-000" /></div>
                    <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Rua</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Rua, avenida..." /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Número</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Nº" /></div>
                      <div className="col-span-2"><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Complemento</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Apto (opcional)" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Cidade</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Cidade" /></div>
                      <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Estado</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="UF" /></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Shipping info */}
            <div className="border p-4 space-y-2" style={cardStyle(s)}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0"><Truck className="w-4 h-4 text-blue-500" /></div>
                <div><p className="text-xs font-bold" style={{ color: s.cardTitle }}>Frete Grátis</p><p className="text-[11px]" style={{ color: s.cardDesc }}>Para todo o Brasil em compras acima de R$ 99</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0"><Package className="w-4 h-4 text-green-500" /></div>
                <div><p className="text-xs font-bold" style={{ color: s.cardTitle }}>Entrega Rápida</p><p className="text-[11px]" style={{ color: s.cardDesc }}>Enviaremos em até 24 horas após a confirmação</p></div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
            <div className="border p-4 space-y-3" style={cardStyle(s)}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: s.cardDesc }}>Resumo (1)</h3>
              </div>
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-xs border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Código do cupom" />
                <button className="px-3 py-1.5 text-xs font-semibold text-white" style={{ borderRadius: s.buttonRadius, background: s.buttonColor }}>Aplicar</button>
              </div>
              <div className="space-y-1.5 pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Produtos</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(unitPrice)}</span></div>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Frete</span><span className="font-medium" style={{ color: "#16A34A" }}>+ {formatCurrency(frete)}</span></div>
                <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                  <span style={{ color: s.cardTitle }}>Total</span><span style={{ color: s.primary }}>{formatCurrency(total)}</span>
                </div>
              </div>
              {originalPrice > unitPrice && (
                <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                  <span className="text-[10px]" style={{ color: s.cardDesc }}>Produto Premium</span>
                  <span className="text-xs line-through ml-auto" style={{ color: s.cardDesc }}>{formatCurrency(originalPrice)}</span>
                </div>
              )}
              <div className="flex items-center gap-3 pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                  {config.productImage ? <img src={config.productImage} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5" style={{ color: s.cardLabel }} />}
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: s.cardTitle }}>{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <p className="text-xs font-bold" style={{ color: s.primary }}>{formatCurrency(unitPrice)}</p>
                </div>
              </div>
            </div>

            <Testimonial name="Breno Santos" text="Compra rápida, fácil e sem dor de cabeça." />
            <Testimonial name="Luísa Romeiro" text="Muito satisfeita com a compra. Voltarei com certeza!" />
          </div>
        </div>
      </div>

      <PaymentFooter />
    </div>
  );
}
