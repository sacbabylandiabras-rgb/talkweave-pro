import { useState, useEffect } from "react";
import { ShieldCheck, Lock, Package, Check, User, CreditCard } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { validateCpfCnpj, formatCpfCnpj } from "./cpf-cnpj-validator";
import { PaymentFooter } from "./PaymentIcons";
import { getCheckoutStyles, inputStyle, cardStyle, buttonStyle, stepStyle } from "./checkout-style-helpers";
import CheckoutStep2Review from "./CheckoutStep2Review";
import CheckoutStep3Payment from "./CheckoutStep3Payment";
import CheckoutDropZone from "../checkout-elements/CheckoutDropZone";
import { CheckoutElement, CheckoutElementType, ElementPosition } from "../checkout-elements/types";

interface Props {
  config: Record<string, any>;
  elements?: CheckoutElement[];
  isBuilder?: boolean;
  onSelectElement?: (id: string) => void;
  selectedElementId?: string | null;
  onDropElement?: (type: CheckoutElementType, position: ElementPosition) => void;
  previewMode?: "desktop" | "mobile";
}

export default function MinimalistaLayout({ config, elements = [], isBuilder, onSelectElement, selectedElementId, onDropElement, previewMode }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 9, s: 0 });
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [cpfError, setCpfError] = useState("");

  const handleNext = () => {
    if (!validateCpfCnpj(formCpf)) { setCpfError("CPF ou CNPJ inválido"); return; }
    setCpfError(""); setStep(2);
  };

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
  const unitPrice = config.price;
  const frete = config.shippingEnabled ? (config.shippingPrice || 0) : 0;
  const pixPrice = config.pixDiscount > 0 ? Math.round(unitPrice * (1 - config.pixDiscount / 100)) : unitPrice;

  const steps = [
    { num: 1, label: "Identificação", icon: <User className="w-3 h-3" /> },
    { num: 2, label: "Conferência", icon: <Check className="w-3 h-3" /> },
    { num: 3, label: "Pagamento", icon: <CreditCard className="w-3 h-3" /> },
  ];

  return (
    <div className="h-full overflow-auto" style={{ background: s.bgColor, fontFamily: s.fontFamily, color: s.textColor }}>
      {config.showLogo !== false && (
        <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: s.cardBg, borderColor: s.cardBorder }}>
          <span className="text-sm font-bold" style={{ color: s.cardTitle }}>
            {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-6 object-contain" /> : "Minha Loja"}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#16A34A" }}>
            <Lock className="w-3 h-3" />
            PAGAMENTO 100% SEGURO
          </span>
        </div>
      )}

      {config.showTimer && (
        <div className="w-full text-center py-2.5 text-sm font-medium" style={{ background: s.primary, color: "#FFFFFF" }}>
          Oferta termina em: <span className="font-bold tracking-wide">{timerStr}</span>
        </div>
      )}

      <div className="mx-auto px-3 py-6 space-y-4" style={{ maxWidth: "900px" }}>
        {/* DROP ZONE: Top */}
        <CheckoutDropZone position="top" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Topo)" />

        <div className={!previewMode ? "flex flex-col-reverse md:flex-row gap-6" : ""} style={previewMode ? { display: "flex", flexDirection: previewMode === "mobile" ? "column-reverse" : "row", gap: "1.5rem" } : undefined}>
          <div className="flex-1 space-y-5">
            {/* Step indicators */}
            {config.stepIndicatorStyle === "progress" ? (
              <div className="px-2 py-4 space-y-2">
                <div className="flex items-center gap-1">
                  {steps.map((st) => (
                    <div key={st.num} className="flex-1 h-2 rounded-full transition-all" style={{ background: step >= st.num ? s.primary : s.isDark ? "#3F3F46" : "#E5E7EB" }} />
                  ))}
                </div>
                <p className="text-center text-[11px] font-medium" style={{ color: s.primary }}>
                  Etapa {step} de 3 — {steps.find(st => st.num === step)?.label}
                </p>
              </div>
            ) : config.stepIndicatorStyle === "pills" ? (
              <div className="flex items-center justify-center gap-2 py-4">
                {steps.map((st, i) => (
                  <div key={st.num} className="flex items-center gap-2">
                    <button
                      onClick={() => setStep(st.num as 1 | 2 | 3)}
                      className="flex items-center gap-1.5 px-3 py-1.5 transition-all"
                      style={{
                        borderRadius: "999px",
                        background: step === st.num ? `${s.primary}12` : "transparent",
                        border: step === st.num ? `1.5px solid ${s.primary}50` : `1.5px solid ${s.isDark ? "#3F3F46" : "#E5E7EB"}`,
                        color: step === st.num ? s.primary : step > st.num ? s.primary : s.isDark ? "#71717A" : "#9CA3AF",
                      }}
                    >
                      <div className="w-5 h-5 rounded flex items-center justify-center text-[10px]" style={{
                        background: step >= st.num ? s.primary : s.isDark ? "#3F3F46" : "#D1D5DB",
                        color: "#fff", borderRadius: "4px",
                      }}>
                        {step > st.num ? <Check className="w-3 h-3" /> : st.icon}
                      </div>
                      <span className="text-[11px] font-medium">{st.label}</span>
                    </button>
                    {i < steps.length - 1 && <div className="h-px w-6" style={{ background: step > st.num ? s.primary : s.isDark ? "#3F3F46" : "#D1D5DB" }} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-4">
                {steps.map((st, i) => (
                  <div key={st.num} className="flex items-center">
                    <button
                      onClick={() => setStep(st.num as 1 | 2 | 3)}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all"
                        style={{
                          borderColor: step === st.num ? s.primary : step > st.num ? s.primary : s.isDark ? "#3F3F46" : "#E5E7EB",
                          background: step > st.num ? `${s.primary}15` : "transparent",
                          color: step === st.num ? s.primary : step > st.num ? s.primary : s.isDark ? "#71717A" : "#9CA3AF",
                        }}
                      >
                        {step > st.num ? <Check className="w-5 h-5" /> : st.icon}
                      </div>
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: step === st.num ? s.primary : s.isDark ? "#71717A" : "#9CA3AF" }}
                      >
                        {st.label}
                      </span>
                    </button>
                    {i < steps.length - 1 && <div className="h-px w-14 mb-5" style={{ background: step > st.num ? s.primary : s.isDark ? "#3F3F46" : "#D1D5DB" }} />}
                  </div>
                ))}
              </div>
            )}

            {/* Step 1: Identificação */}
            {step === 1 && (
              <>
                {/* DROP ZONE: Above Form */}
                <CheckoutDropZone position="above-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Acima do formulário)" />

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
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Digite seu nome completo" value={formName} onChange={e => setFormName(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CPF ou CNPJ <span style={{ color: '#EF4444' }}>*</span></label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={{ ...inputStyle(s), ...(cpfError ? { borderColor: '#EF4444' } : {}) }} placeholder="000.000.000-00" value={formCpf} onChange={e => { setFormCpf(formatCpfCnpj(e.target.value)); setCpfError(""); }} maxLength={18} />
                      {cpfError && <span className="text-[11px] mt-0.5 block" style={{ color: '#EF4444' }}>{cpfError}</span>}
                    </div>
                    {config.showPhone && (
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Celular (WhatsApp)</label>
                        <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="+55 (00) 00000-0000" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>E-mail</label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="seu@email.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                    </div>
                  </div>
                  <button onClick={handleNext} className="w-full py-3.5 font-bold text-sm transition-transform hover:scale-[1.01] flex items-center justify-center gap-2" style={buttonStyle(s)}>
                    PRÓXIMO
                  </button>
                </div>

                {/* DROP ZONE: Below Form */}
                <CheckoutDropZone position="below-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Abaixo do formulário)" />
              </>
            )}

            {/* Step 2: Conferência */}
            {step === 2 && (
              <CheckoutStep2Review
                config={config}
                formName={formName}
                formEmail={formEmail}
                formCpf={formCpf}
                formPhone={formPhone}
                totalPrice={unitPrice}
                onBack={() => setStep(1)}
                onConfirm={() => setStep(3)}
              />
            )}

            {/* Step 3: Pagamento */}
            {step === 3 && (
              <CheckoutStep3Payment
                config={config}
                pixPrice={pixPrice}
                formName={formName}
                formEmail={formEmail}
                formPhone={formPhone}
                formCpf={formCpf}
                timerStr={timerStr}
              />
            )}
          </div>

          {/* RIGHT: Summary sidebar */}
          <div className={!previewMode ? "w-full md:w-60 flex-shrink-0 space-y-4" : "space-y-4"} style={previewMode ? { width: previewMode === "mobile" ? "100%" : "15rem", flexShrink: 0 } : undefined}>
            {/* DROP ZONE: Sidebar */}
            <CheckoutDropZone position="sidebar" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar)" />

            <div className="border p-4 space-y-3" style={cardStyle(s)}>
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: s.cardTitle }}>Resumo (1)</h4>
              <div className="text-xs" style={{ color: s.cardDesc }}>Tem um cupom?</div>
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-xs border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Código do cupom" />
                <button className="px-3 py-1.5 text-xs font-medium border" style={{ borderRadius: s.fieldRadius, borderColor: s.cardBorder, color: s.cardText, background: s.cardBg }}>Aplicar</button>
              </div>
              <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Produtos</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(unitPrice)}</span></div>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Frete</span><span className="font-medium" style={{ color: frete > 0 ? s.cardText : "#16A34A" }}>{frete > 0 ? `+ ${formatCurrency(frete)}` : "Grátis"}</span></div>
                <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                  <span style={{ color: "#16A34A" }}>Total</span><span style={{ color: "#16A34A" }}>{formatCurrency(unitPrice + frete)}</span>
                </div>
              </div>
            </div>

            <div className="border p-4" style={cardStyle(s)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                  {config.productImage ? <img src={config.productImage} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5" style={{ color: s.cardLabel }} />}
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: s.cardTitle }}>{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <p className="text-xs" style={{ color: s.cardDesc }}>{formatCurrency(unitPrice)}</p>
                </div>
              </div>
            </div>

            {/* DROP ZONE: Sidebar Bottom */}
            <CheckoutDropZone position="sidebar-bottom" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar Inferior)" />
          </div>
        </div>

        {/* DROP ZONE: Footer */}
        <CheckoutDropZone position="footer" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Rodapé)" />
      </div>

      <PaymentFooter companyName={config.footerCompanyName} cnpj={config.footerCnpj} />
    </div>
  );
}
