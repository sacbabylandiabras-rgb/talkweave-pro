import { useState, useEffect } from "react";
import { Lock, CreditCard, Package, Minus, Plus, User, Check } from "lucide-react";
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

export default function LynxFyLayout({ config, elements = [], isBuilder, onSelectElement, selectedElementId, onDropElement, previewMode }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState({ h: 0, m: config.timerMinutes || 10, s: 0 });
  const [quantity, setQuantity] = useState(1);
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
  const frete = config.shippingEnabled ? (config.shippingPrice || 0) : 0;
  const subtotal = unitPrice * quantity;
  const total = subtotal + frete;
  const timerStr = `${String(countdown.h).padStart(2, "0")}h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;
  const pixPrice = config.pixDiscount > 0 ? Math.round(subtotal * (1 - config.pixDiscount / 100)) : subtotal;

  const stepLabels = [
    { num: 1, label: "Identificação" },
    { num: 2, label: "Conferência" },
    { num: 3, label: "Pagamento" },
  ];

  return (
    <div className="h-full overflow-auto" style={{ background: s.bgColor, fontFamily: s.fontFamily, color: s.textColor }}>
      {config.showTimer && (
        <div className="w-full text-center py-2.5 text-sm font-semibold" style={{ background: s.primary, color: "#FFFFFF" }}>
          Oferta termina em: <span className="font-bold tracking-wider ml-1">{timerStr}</span>
        </div>
      )}

      <div className="mx-auto px-3 py-6" style={{ maxWidth: "960px" }}>
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 mb-5">
          {stepLabels.map((sl, i) => (
            <div key={sl.num} className="flex items-center gap-3">
              <button onClick={() => setStep(sl.num as 1 | 2 | 3)} className="flex items-center gap-2 px-3 py-2 text-xs font-medium"
                style={{
                  borderRadius: s.stepRadius,
                  background: step === sl.num ? `${s.stepBg}15` : "transparent",
                  color: step === sl.num ? s.stepBg : s.cardLabel,
                  border: step === sl.num ? `1.5px solid ${s.stepBg}` : "1.5px solid transparent",
                }}>
                <div className="w-6 h-6 flex items-center justify-center text-[10px] font-bold" style={stepStyle(s, step === sl.num)}>
                  {step > sl.num ? <Check className="w-3 h-3" /> : sl.num}
                </div>
                <span className={!previewMode ? "hidden sm:inline" : ""} style={previewMode ? { display: previewMode === "mobile" ? "none" : undefined } : undefined}>{sl.label}</span>
              </button>
              {i < stepLabels.length - 1 && <div className="w-6 h-[1.5px] rounded" style={{ background: step > sl.num ? s.primary : s.cardBorder }} />}
            </div>
          ))}
        </div>

        <div className={!previewMode ? "flex flex-col-reverse lg:flex-row gap-5" : ""} style={previewMode ? { display: "flex", flexDirection: previewMode === "mobile" ? "column-reverse" : "row", gap: "1.25rem" } : undefined}>
          <div className="flex-1 space-y-4">
            {/* DROP ZONE: Top */}
            <CheckoutDropZone position="top" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Topo)" />

            {/* Step 1 */}
            {step === 1 && (
              <>
                {/* DROP ZONE: Above Form */}
                <CheckoutDropZone position="above-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Acima do formulário)" />

                <div className="border p-5 space-y-3" style={cardStyle(s)}>
                  <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Informações de contato</h3>
                  <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>E-mail</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="seu@email.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
                  <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Nome completo</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Digite seu nome completo" value={formName} onChange={e => setFormName(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    {config.showPhone && (
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Celular</label>
                        <div className="flex gap-1.5">
                          <span className="flex items-center px-2 py-2 border text-xs" style={{ borderRadius: s.fieldRadius, borderColor: s.inputBorder, background: s.isDark ? "#222" : "#F9FAFB", color: s.cardDesc }}>🇧🇷 +55</span>
                          <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="(00) 00000-0000" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CPF/CNPJ <span style={{ color: '#EF4444' }}>*</span></label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={{ ...inputStyle(s), ...(cpfError ? { borderColor: '#EF4444' } : {}) }} placeholder="000.000.000-00" value={formCpf} onChange={e => { setFormCpf(formatCpfCnpj(e.target.value)); setCpfError(""); }} maxLength={18} />
                      {cpfError && <span className="text-[11px] mt-0.5 block" style={{ color: '#EF4444' }}>{cpfError}</span>}
                    </div>
                  </div>
                </div>

                {config.showAddress && (
                  <div className="border p-5 space-y-3" style={cardStyle(s)}>
                    <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Endereço de entrega</h3>
                    <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CEP</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="00000-000" /></div>
                    <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Rua</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Rua, avenida..." /></div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Número</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Nº" /></div>
                      <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Cidade</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Cidade" /></div>
                      <div><label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Estado</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="UF" /></div>
                    </div>
                  </div>
                )}

                <button onClick={handleNext} className="w-full py-3.5 font-bold text-sm transition-transform hover:scale-[1.01] flex items-center justify-center gap-2" style={buttonStyle(s)}>
                  <Lock className="w-3.5 h-3.5" /> PRÓXIMO
                </button>

                {/* DROP ZONE: Below Form */}
                <CheckoutDropZone position="below-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Abaixo do formulário)" />
              </>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <CheckoutStep2Review config={config} formName={formName} formEmail={formEmail} formCpf={formCpf} formPhone={formPhone} totalPrice={subtotal} onBack={() => setStep(1)} onConfirm={() => setStep(3)} />
            )}

            {/* Step 3 */}
            {step === 3 && (
              <CheckoutStep3Payment config={config} pixPrice={pixPrice} formName={formName} formEmail={formEmail} formPhone={formPhone} formCpf={formCpf} timerStr={timerStr} />
            )}
          </div>

          {/* RIGHT: Summary sidebar */}
          <div className={!previewMode ? "w-full lg:w-72 flex-shrink-0 space-y-4" : "space-y-4"} style={previewMode ? { width: previewMode === "mobile" ? "100%" : "18rem", flexShrink: 0 } : undefined}>
            {/* DROP ZONE: Sidebar */}
            <CheckoutDropZone position="sidebar" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar)" />

            <div className="border p-4 space-y-3" style={cardStyle(s)}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: s.cardDesc }}>Resumo do Pedido</h3>
                <span className="text-sm font-bold" style={{ color: s.primary }}>{formatCurrency(total)}</span>
              </div>
              <div className="space-y-1.5 pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Produtos</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Frete</span><span className="font-medium" style={{ color: frete > 0 ? s.cardText : "#16A34A" }}>{frete > 0 ? formatCurrency(frete) : "Grátis"}</span></div>
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

            {/* DROP ZONE: Sidebar Bottom */}
            <CheckoutDropZone position="sidebar-bottom" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar Inferior)" />
          </div>
        </div>
        </div>

        {/* DROP ZONE: Footer */}
        <CheckoutDropZone position="footer" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Rodapé)" />
      </div>

      <PaymentFooter />
    </div>
  );
}
