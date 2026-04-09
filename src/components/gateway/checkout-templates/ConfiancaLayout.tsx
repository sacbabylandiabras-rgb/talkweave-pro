import { useState } from "react";
import { ShieldCheck, CreditCard, Package, User, Minus, Plus, Trash2, Check } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { validateCpfCnpj, formatCpfCnpj } from "./cpf-cnpj-validator";
import { PaymentFooter } from "./PaymentIcons";
import { getCheckoutStyles, inputStyle, cardStyle, buttonStyle } from "./checkout-style-helpers";
import { getCheckoutSteps, getStepNumbers } from "./checkout-steps-helpers";
import CheckoutStep2Review from "./CheckoutStep2Review";
import CheckoutStep3Payment from "./CheckoutStep3Payment";
import CheckoutStep2Address from "./CheckoutStep2Address";
import CheckoutStepIndicators from "./CheckoutStepIndicators";
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

export default function ConfiancaLayout({ config, elements = [], isBuilder, onSelectElement, selectedElementId, onDropElement, previewMode }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [quantity, setQuantity] = useState(1);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [cpfError, setCpfError] = useState("");

  const sn0 = getStepNumbers(config);
  const handleNext = () => {
    if (!validateCpfCnpj(formCpf)) { setCpfError("CPF ou CNPJ inválido"); return; }
    setCpfError(""); setStep(sn0.address || sn0.review);
  };
  const [formPhone, setFormPhone] = useState("");
  const [formCep, setFormCep] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formComplement, setFormComplement] = useState("");
  const [formNeighborhood, setFormNeighborhood] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");

  const s = getCheckoutStyles(config);
  const bannerBg = config.bgColor || "#C8E832";
  const unitPrice = config.price || 9900;
  const subtotal = unitPrice * quantity;
  const pixPrice = config.pixDiscount > 0 ? Math.round(subtotal * (1 - config.pixDiscount / 100)) : subtotal;

  const stepLabels = getCheckoutSteps(config);
  const sn = getStepNumbers(config);

  return (
    <div className="h-full overflow-auto" style={{ fontFamily: s.fontFamily, color: s.textColor }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: s.cardBg, borderColor: s.cardBorder }}>
        <span className="text-sm font-bold" style={{ color: s.cardTitle }}>
          {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-7 object-contain" /> : "Minha Loja"}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#16A34A" }}>
          <ShieldCheck className="w-3.5 h-3.5" /> Pagamento 100% Seguro
        </span>
      </div>

      {/* Banner */}
      <div className="w-full py-8 px-6 flex items-center justify-center" style={{ background: bannerBg }}>
        {config.productImage ? (
          <img src={config.productImage} alt="" className="max-h-40 object-contain" style={{ borderRadius: s.cardRadius }} />
        ) : (
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "#1A1A1A" }}>Revele sua <em className="font-extrabold not-italic">beleza interior</em></p>
            <p className="text-lg font-bold" style={{ color: "#1A1A1A" }}>e exterior.</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-white/80 rounded-full px-4 py-1.5">
              <ShieldCheck className="w-4 h-4" style={{ color: s.primary }} />
              <span className="text-xs font-semibold">Compra segura.</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: s.cardBg, borderBottom: `1px solid ${s.cardBorder}` }}>
        <div className="mx-auto" style={{ maxWidth: "700px" }}>
          <CheckoutStepIndicators
            config={config}
            steps={stepLabels}
            step={step}
            onStepChange={setStep}
            previewMode={previewMode}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto px-3 py-6" style={{ maxWidth: "960px", background: s.bgColor }}>
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
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Dados pessoais</h3>
                    <p className="text-[11px] mt-0.5" style={{ color: s.cardDesc }}>
                      Utilizaremos seu e-mail para identificar seu perfil, histórico de compra, verificação de pedidos e carrinho de compras.
                    </p>
                  </div>
                  <div><label className="text-xs font-medium block mb-1.5" style={{ color: s.cardLabel }}>Nome completo</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Ex.: Maria da Silva" value={formName} onChange={e => setFormName(e.target.value)} /></div>
                  <div><label className="text-xs font-medium block mb-1.5" style={{ color: s.cardLabel }}>E-mail</label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Ex.: maria@email.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5" style={{ color: s.cardLabel }}>CPF <span style={{ color: '#EF4444' }}>*</span></label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={{ ...inputStyle(s), ...(cpfError ? { borderColor: '#EF4444' } : {}) }} placeholder="000.000.000-00" value={formCpf} onChange={e => { setFormCpf(formatCpfCnpj(e.target.value)); setCpfError(""); }} maxLength={18} />
                    {cpfError && <span className="text-[11px] mt-0.5 block" style={{ color: '#EF4444' }}>{cpfError}</span>}
                  </div>
                  {config.showPhone && (
                    <div>
                      <label className="text-xs font-medium block mb-1.5" style={{ color: s.cardLabel }}>Celular / WhatsApp</label>
                      <div className="flex gap-2">
                        <span className="flex items-center px-2.5 py-2 border text-xs" style={{ borderRadius: s.fieldRadius, borderColor: s.inputBorder, background: s.isDark ? "#222" : "#F9FAFB", color: s.cardDesc }}>+55</span>
                        <input className="flex-1 px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="(00) 00000-0000" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                      </div>
                    </div>
                  )}
                  {config.showAddress && !sn.address && (
                    <div className="border p-4 space-y-2" style={cardStyle(s)}>
                      <label className="text-xs font-bold block" style={{ color: s.cardTitle }}>Endereço de Entrega</label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="CEP" value={formCep} onChange={e => setFormCep(e.target.value)} />
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Rua / Avenida" value={formStreet} onChange={e => setFormStreet(e.target.value)} />
                      <div className="grid grid-cols-3 gap-2">
                        <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Nº" value={formNumber} onChange={e => setFormNumber(e.target.value)} />
                        <input className="col-span-2 w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Complemento" value={formComplement} onChange={e => setFormComplement(e.target.value)} />
                      </div>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Bairro" value={formNeighborhood} onChange={e => setFormNeighborhood(e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Cidade" value={formCity} onChange={e => setFormCity(e.target.value)} />
                        <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Estado" value={formState} onChange={e => setFormState(e.target.value)} />
                      </div>
                    </div>
                  )}
                  <button onClick={handleNext} className="w-full py-3 font-bold text-sm transition-transform hover:scale-[1.01]" style={buttonStyle(s)}>Próximo</button>
                </div>

                {/* DROP ZONE: Below Form */}
                <CheckoutDropZone position="below-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Abaixo do formulário)" />
              </>
            )}

            {/* Address step (4-step flow) */}
            {sn.address && step === sn.address && (
              <CheckoutStep2Address config={config} formCep={formCep} formStreet={formStreet} formNumber={formNumber} formComplement={formComplement} formNeighborhood={formNeighborhood} formCity={formCity} formState={formState} onCepChange={setFormCep} onStreetChange={setFormStreet} onNumberChange={setFormNumber} onComplementChange={setFormComplement} onNeighborhoodChange={setFormNeighborhood} onCityChange={setFormCity} onStateChange={setFormState} onBack={() => setStep(1)} onNext={() => setStep(sn.review)} />
            )}

            {/* Review */}
            {step === sn.review && (
              <CheckoutStep2Review config={config} formName={formName} formEmail={formEmail} formCpf={formCpf} formPhone={formPhone} formCep={formCep} formStreet={formStreet} formNumber={formNumber} formComplement={formComplement} formNeighborhood={formNeighborhood} formCity={formCity} formState={formState} totalPrice={subtotal} onBack={() => setStep(sn.address || 1)} onConfirm={() => setStep(sn.payment)} />
            )}

            {/* Payment */}
            {step === sn.payment && (
              <CheckoutStep3Payment config={config} pixPrice={pixPrice} formName={formName} formEmail={formEmail} formPhone={formPhone} formCpf={formCpf} />
            )}
          </div>

          {/* RIGHT: Sidebar */}
          <div className={!previewMode ? "w-full lg:w-72 flex-shrink-0 space-y-4" : "space-y-4"} style={previewMode ? { width: previewMode === "mobile" ? "100%" : "18rem", flexShrink: 0 } : undefined}>
            {/* DROP ZONE: Sidebar */}
            <CheckoutDropZone position="sidebar" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar)" />

            <div className="border p-4 space-y-3" style={cardStyle(s)}>
              <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: s.cardDesc }}>Resumo do pedido</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                  {config.productImage ? <img src={config.productImage} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5" style={{ color: s.cardLabel }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: s.cardTitle }}>{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <p className="text-xs font-bold" style={{ color: s.primary }}>{formatCurrency(unitPrice)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-5 h-5 rounded border flex items-center justify-center" style={{ borderColor: s.cardBorder }}><Minus className="w-3 h-3" style={{ color: s.cardLabel }} /></button>
                  <span className="text-xs font-medium w-4 text-center" style={{ color: s.cardText }}>{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="w-5 h-5 rounded border flex items-center justify-center" style={{ borderColor: s.cardBorder }}><Plus className="w-3 h-3" style={{ color: s.cardLabel }} /></button>
                  <button className="w-5 h-5 flex items-center justify-center text-red-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-xs border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Cupom de desconto" />
                <button className="px-3 py-1.5 text-xs font-semibold border" style={{ borderRadius: s.buttonRadius, borderColor: s.cardBorder, color: s.cardText, background: s.cardBg }}>Aplicar</button>
              </div>
              <div className="space-y-1.5 pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                {(() => { const frete = config.shippingEnabled ? (config.shippingPrice || 0) : 0; const totalWithShipping = subtotal + frete; return (<>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Subtotal</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Frete</span><span className="font-medium" style={{ color: frete > 0 ? s.cardText : "#16A34A" }}>{frete > 0 ? formatCurrency(frete) : "Grátis"}</span></div>
                <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                  <span style={{ color: s.cardTitle }}>Total</span><span style={{ color: s.primary }}>{formatCurrency(totalWithShipping)}</span>
                </div>
                </>); })()}
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
