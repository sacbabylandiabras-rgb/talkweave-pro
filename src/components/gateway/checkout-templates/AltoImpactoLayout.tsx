import { useState, useEffect } from "react";
import { Lock, ShieldCheck, CreditCard, Package, ShoppingBag, User, Check } from "lucide-react";
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

export default function AltoImpactoLayout({ config, elements = [], isBuilder, onSelectElement, selectedElementId, onDropElement, previewMode }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 10, s: 0 });
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
  const frete = config.shippingEnabled ? (config.shippingPrice || 0) : 0;
  const timerStr = `${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;
  const pixPrice = config.pixDiscount > 0 ? Math.round(unitPrice * (1 - config.pixDiscount / 100)) : unitPrice;

  const steps = [
    { num: 1, label: "Identificação", icon: <User className="w-4 h-4" /> },
    { num: 2, label: "Conferência", icon: <Check className="w-4 h-4" /> },
    { num: 3, label: "Pagamento", icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full overflow-auto" style={{ background: s.bgColor, fontFamily: s.fontFamily, color: s.textColor }}>
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: s.cardBg, borderColor: s.cardBorder }}>
        <span className="text-sm font-bold" style={{ color: s.cardTitle }}>
          {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-6 object-contain" /> : "Minha Loja"}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#16A34A" }}>
          <ShieldCheck className="w-3.5 h-3.5" /> Pagamento 100% seguro
        </span>
      </div>

      {config.showTimer && (
        <div className="w-full text-center py-2.5 text-sm font-semibold" style={{ background: s.primary, color: "#FFFFFF" }}>
          Oferta termina em: <span className="font-bold tracking-wide ml-1">{timerStr}</span>
        </div>
      )}

      <div className="mx-auto px-3 py-6" style={{ maxWidth: "900px" }}>
        {/* DROP ZONE: Top */}
        <CheckoutDropZone position="top" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Topo)" />
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 mb-5">
          {steps.map((st, i) => (
            <div key={st.num} className="flex items-center gap-3">
              <button onClick={() => setStep(st.num as 1 | 2 | 3)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all"
                style={{
                  borderRadius: s.stepRadius,
                  background: step === st.num ? `${s.stepBg}15` : "transparent",
                  color: step === st.num ? s.stepBg : s.cardLabel,
                  border: step === st.num ? `1.5px solid ${s.stepBg}` : "1.5px solid transparent",
                }}>
                <div className="w-6 h-6 flex items-center justify-center text-[10px] font-bold" style={stepStyle(s, step === st.num)}>
                  {step > st.num ? <Check className="w-3 h-3" /> : st.num}
                </div>
                <span className={!previewMode ? "hidden sm:inline" : ""} style={previewMode ? { display: previewMode === "mobile" ? "none" : undefined } : undefined}>{st.label}</span>
              </button>
              {i < steps.length - 1 && <div className="w-6 h-[1.5px] rounded" style={{ background: step > st.num ? s.primary : s.cardBorder }} />}
            </div>
          ))}
        </div>

        <div className={!previewMode ? "flex flex-col md:flex-row gap-5" : ""} style={previewMode ? { display: "flex", flexDirection: previewMode === "mobile" ? "column" : "row", gap: "1.25rem" } : undefined}>
          <div className="flex-1 space-y-4">
            {/* Step 1 */}
            {step === 1 && (
              <>
                {/* DROP ZONE: Above Form */}
                <CheckoutDropZone position="above-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Acima do formulário)" />

                <div className="border p-5 space-y-3" style={cardStyle(s)}>
                  <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Informações de contato</h3>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>E-mail</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="seu@email.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Nome completo</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Digite seu nome completo" value={formName} onChange={e => setFormName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Celular</label>
                      <div className="flex gap-1.5">
                        <span className="flex items-center px-2 py-2 border text-xs" style={{ borderRadius: s.fieldRadius, borderColor: s.inputBorder, background: s.isDark ? "#222" : "#F9FAFB", color: s.cardDesc }}>🇧🇷 +55</span>
                        <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="(00) 00000-0000" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                      </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CPF/CNPJ <span style={{ color: '#EF4444' }}>*</span></label>
                        <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={{ ...inputStyle(s), ...(cpfError ? { borderColor: '#EF4444' } : {}) }} placeholder="000.000.000-00" value={formCpf} onChange={e => { setFormCpf(formatCpfCnpj(e.target.value)); setCpfError(""); }} maxLength={18} />
                        {cpfError && <span className="text-[11px] mt-0.5 block" style={{ color: '#EF4444' }}>{cpfError}</span>}
                      </div>
                  </div>
                </div>


                {/* DROP ZONE: Below Form */}
                <CheckoutDropZone position="below-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Abaixo do formulário)" />

                <button onClick={() => setStep(2)} className="w-full py-3.5 font-bold text-sm transition-transform hover:scale-[1.01] flex items-center justify-center gap-2" style={buttonStyle(s)}>
                  <Lock className="w-3.5 h-3.5" /> PRÓXIMO
                </button>
              </>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <CheckoutStep2Review config={config} formName={formName} formEmail={formEmail} formCpf={formCpf} formPhone={formPhone} totalPrice={unitPrice} onBack={() => setStep(1)} onConfirm={() => setStep(3)} />
            )}

            {/* Step 3 */}
            {step === 3 && (
              <CheckoutStep3Payment config={config} pixPrice={pixPrice} formName={formName} formEmail={formEmail} formPhone={formPhone} formCpf={formCpf} timerStr={timerStr} />
            )}
          </div>

          {/* RIGHT sidebar */}
          <div className={!previewMode ? "w-full md:w-60 flex-shrink-0 space-y-4" : "space-y-4"} style={previewMode ? { width: previewMode === "mobile" ? "100%" : "15rem", flexShrink: 0 } : undefined}>
            {/* DROP ZONE: Sidebar */}
            <CheckoutDropZone position="sidebar" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar)" />

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

            <div className="border p-4" style={cardStyle(s)}>
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-xs border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Código do cupom" />
                <button className="px-3 py-1.5 text-xs font-semibold text-white" style={{ borderRadius: s.buttonRadius, background: s.buttonColor }}>Aplicar</button>
              </div>
            </div>

            <div className="border p-4 space-y-2" style={cardStyle(s)}>
              <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Subtotal / 1 item</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(unitPrice)}</span></div>
              <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Frete</span><span className="font-medium" style={{ color: frete > 0 ? s.cardText : "#16A34A" }}>{frete > 0 ? formatCurrency(frete) : "Grátis"}</span></div>
              <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <span style={{ color: s.primary }}>Total</span><span style={{ color: s.primary }}>{formatCurrency(unitPrice + frete)}</span>
              </div>
            </div>

            {/* DROP ZONE: Sidebar Bottom */}
            <CheckoutDropZone position="sidebar-bottom" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar Inferior)" />
          </div>
        </div>

        {/* DROP ZONE: Footer */}
        <CheckoutDropZone position="footer" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Rodapé)" />
      </div>

      <PaymentFooter />
    </div>
  );
}
