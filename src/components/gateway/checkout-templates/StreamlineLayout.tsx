import { useState, useEffect } from "react";
import { Lock, ShieldCheck, CreditCard, Package, User, Truck, ChevronDown, ChevronUp, Star } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, BoletoIcon, PaymentFooter } from "./PaymentIcons";

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

  const primary = config.primaryColor || "#E8174A";
  const unitPrice = config.price || 9900;
  const originalPrice = config.originalPrice || 0;
  const frete = 1500;
  const total = unitPrice + frete;

  const timerStr = `${String(countdown.h).padStart(2, "0")} : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  const inputClass = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-md outline-none bg-white text-gray-800 placeholder:text-gray-400 focus:border-gray-400 transition-colors";
  const labelClass = "text-xs font-medium text-gray-600 block mb-1";

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const SectionHeader = ({ icon: Icon, number, title, sectionKey }: { icon: any; number: number; title: string; sectionKey: string }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between py-3"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: primary }}
        >
          {number}
        </div>
        <span className="text-sm font-bold text-gray-900">{title}</span>
      </div>
      {openSections[sectionKey] ? (
        <ChevronUp className="w-4 h-4 text-gray-400" />
      ) : (
        <ChevronDown className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );

  /* ── Desktop step tabs ── */
  const StepTabs = () => (
    <div className="hidden md:flex items-center bg-white rounded-xl border border-gray-200 overflow-hidden">
      {[
        { icon: User, label: "Identificação", num: 1 },
        { icon: CreditCard, label: "Pagamento", num: 2 },
        { icon: Truck, label: "Entrega", num: 3 },
      ].map((s, i) => (
        <div key={s.num} className="flex-1 flex items-center gap-2 px-5 py-3 border-r border-gray-200 last:border-r-0">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
            style={{ background: primary }}
          >
            {s.num}
          </div>
          <span className="text-xs font-semibold text-gray-800">{s.label}</span>
        </div>
      ))}
    </div>
  );

  const Testimonial = ({ name, text }: { name: string; text: string }) => (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-center gap-1 mb-1">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-xs font-bold text-gray-900">{name}</p>
      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{text}</p>
    </div>
  );

  return (
    <div className="h-full overflow-auto" style={{ background: "#F5F5F5", fontFamily: "'Inter', sans-serif", color: "#1F2937" }}>

      {/* ── Banner area (placeholder for product banner) ── */}
      {config.productImage && (
        <div className="w-full max-h-52 overflow-hidden">
          <img src={config.productImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* ── Timer bar ── */}
      {config.showTimer && (
        <div
          className="w-full text-center py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: primary, color: "#FFFFFF" }}
        >
          Oferta termina em:{" "}
          <span className="font-bold tracking-wider bg-white/20 px-3 py-0.5 rounded-full text-xs">
            {timerStr}
          </span>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="mx-auto px-3 py-6" style={{ maxWidth: "960px" }}>
        <div className="flex flex-col lg:flex-row gap-5">

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="flex-1 space-y-4">

            {/* Desktop step indicators */}
            <StepTabs />

            {/* ── 1. Identificação ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 border-b border-gray-100">
                <SectionHeader icon={User} number={1} title="Identificação" sectionKey="identification" />
                <p className="text-[11px] text-gray-400 -mt-2 pb-3">
                  Preencha seus dados para concluir sua compra com segurança.
                </p>
              </div>
              {openSections.identification && (
                <div className="p-5 space-y-3">
                  <div>
                    <label className={labelClass}>Nome completo</label>
                    <input className={inputClass} placeholder="Digite seu nome completo" />
                  </div>
                  {config.showCpf && (
                    <div>
                      <label className={labelClass}>CPF ou CNPJ</label>
                      <input className={inputClass} placeholder="000.000.000-00" />
                    </div>
                  )}
                  {config.showPhone && (
                    <div>
                      <label className={labelClass}>Celular (WhatsApp)</label>
                      <div className="flex gap-2">
                        <span className="flex items-center px-2.5 py-2 border border-gray-200 rounded-md text-xs text-gray-500 bg-gray-50">
                          🇧🇷 +55
                        </span>
                        <input className={`${inputClass} flex-1`} placeholder="(00) 00000-0000" />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>E-mail</label>
                    <input className={inputClass} placeholder="seu@email.com" />
                  </div>

                  <button
                    className="w-full py-3 font-bold text-sm rounded-lg transition-transform hover:scale-[1.01] uppercase tracking-wide"
                    style={{ background: primary, color: "#FFFFFF" }}
                  >
                    {config.buttonText || "PRÓXIMO"}
                  </button>
                </div>
              )}
            </div>

            {/* ── 2. Pagamento ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 border-b border-gray-100">
                <SectionHeader icon={CreditCard} number={2} title="Pagamento" sectionKey="payment" />
                <p className="text-[11px] text-gray-400 -mt-2 pb-3">
                  Complete os dados do pagamento para finalizar sua compra.
                </p>
              </div>
              {openSections.payment && (
                <div className="p-5 space-y-3">
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
                      <span className="text-sm text-gray-600">Boleto</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 3. Entrega ── */}
            {config.showAddress && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 border-b border-gray-100">
                  <SectionHeader icon={Truck} number={3} title="Entrega" sectionKey="delivery" />
                </div>
                {openSections.delivery && (
                  <div className="p-5 space-y-3">
                    <div>
                      <label className={labelClass}>CEP</label>
                      <input className={inputClass} placeholder="00000-000" />
                    </div>
                    <div>
                      <label className={labelClass}>Rua</label>
                      <input className={inputClass} placeholder="Rua, avenida..." />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>Número</label>
                        <input className={inputClass} placeholder="Nº" />
                      </div>
                      <div className="col-span-2">
                        <label className={labelClass}>Complemento</label>
                        <input className={inputClass} placeholder="Apto (opcional)" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
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
              </div>
            )}

            {/* ── Shipping info ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">Frete Grátis</p>
                  <p className="text-[11px] text-gray-500">Para todo o Brasil em compras acima de R$ 99</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">Entrega Rápida</p>
                  <p className="text-[11px] text-gray-500">Enviaremos em até 24 horas após a confirmação</p>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4">

            {/* RESUMO */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Resumo (1)</h3>
              </div>

              {/* Coupon */}
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md outline-none placeholder:text-gray-400" placeholder="Código do cupom" />
                <button className="px-3 py-1.5 text-xs font-semibold rounded-md text-white" style={{ background: primary }}>
                  Aplicar
                </button>
              </div>

              {/* Totals */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Produtos</span>
                  <span className="text-gray-800 font-medium">{formatCurrency(unitPrice)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Frete</span>
                  <span className="font-medium" style={{ color: "#16A34A" }}>+ {formatCurrency(frete)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                  <span className="text-gray-900">Total</span>
                  <span style={{ color: primary }}>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Product preview */}
              {originalPrice > unitPrice && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400">Produto Premium</span>
                  <span className="text-xs line-through text-gray-400 ml-auto">{formatCurrency(originalPrice)}</span>
                </div>
              )}

              {/* Product image */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {config.productImage ? (
                    <img src={config.productImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <p className="text-xs font-bold" style={{ color: primary }}>{formatCurrency(unitPrice)}</p>
                </div>
              </div>
            </div>

            {/* Testimonials */}
            <Testimonial
              name="Breno Santos"
              text="Compra rápida, fácil e sem dor de cabeça."
            />
            <Testimonial
              name="Luísa Romeiro"
              text="Muito satisfeita com a compra. Voltarei com certeza!"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <PaymentFooter />
    </div>
  );
}
