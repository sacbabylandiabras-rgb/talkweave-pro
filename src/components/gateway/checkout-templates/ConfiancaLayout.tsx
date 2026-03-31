import { useState } from "react";
import { ShieldCheck, CreditCard, Package, Truck, User, Minus, Plus, Trash2, ChevronDown, Star, Zap, Check } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
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

const FAQ_ITEMS = [
  { q: "Quais formas de pagamento são aceitas?", a: "Aceitamos Pix, cartão de crédito (Visa, Mastercard, Elo, Amex) e boleto bancário." },
  { q: "Posso parcelar minha compra?", a: "Sim! Parcele em até 12x sem juros no cartão de crédito." },
  { q: "Recebo confirmação após o pagamento?", a: "Sim, você receberá um e-mail e mensagem no WhatsApp com a confirmação." },
  { q: "Qual o prazo de entrega?", a: "Enviamos em até 24 horas após a confirmação do pagamento." },
];

export default function ConfiancaLayout({ config, elements = [], isBuilder, onSelectElement, selectedElementId, onDropElement, previewMode }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [quantity, setQuantity] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formPhone, setFormPhone] = useState("");

  const s = getCheckoutStyles(config);
  const bannerBg = config.bgColor || "#C8E832";
  const unitPrice = config.price || 9900;
  const subtotal = unitPrice * quantity;
  const pixPrice = config.pixDiscount > 0 ? Math.round(subtotal * (1 - config.pixDiscount / 100)) : subtotal;

  const stepLabels = [
    { num: 1, label: "Identificação", icon: User },
    { num: 2, label: "Conferência", icon: Check },
    { num: 3, label: "Pagamento", icon: CreditCard },
  ];

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

      {/* Step indicators */}
      <div style={{ background: s.cardBg, borderBottom: `1px solid ${s.cardBorder}` }}>
        <div className="flex items-center justify-center gap-10 py-3 mx-auto" style={{ maxWidth: "700px" }}>
          {stepLabels.map((sl, i) => (
            <button key={i} onClick={() => setStep(sl.num as 1 | 2 | 3)} className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 flex items-center justify-center" style={{
                borderRadius: s.stepRadius,
                background: step === sl.num ? `${s.stepBg}20` : step > sl.num ? `${s.stepBg}20` : (s.isDark ? "#333" : "#F3F4F6"),
                border: step === sl.num ? `2px solid ${s.stepBg}` : step > sl.num ? `2px solid ${s.stepBg}80` : "2px solid transparent",
              }}>
                {step > sl.num ? <Check className="w-4 h-4" style={{ color: s.stepBg }} /> : <sl.icon className="w-4 h-4" style={{ color: step === sl.num ? s.stepBg : s.cardLabel }} />}
              </div>
              <span className="text-[10px] font-semibold" style={{ color: step === sl.num ? s.stepBg : s.cardLabel }}>{sl.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto px-3 py-6" style={{ maxWidth: "960px", background: s.bgColor }}>
        <div className={!previewMode ? "flex flex-col lg:flex-row gap-5" : ""} style={previewMode ? { display: "flex", flexDirection: previewMode === "mobile" ? "column" : "row", gap: "1.25rem" } : undefined}>
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
                  <div><label className="text-xs font-medium block mb-1.5" style={{ color: s.cardLabel }}>CPF <span style={{ color: '#EF4444' }}>*</span></label><input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="000.000.000-00" value={formCpf} onChange={e => setFormCpf(e.target.value)} /></div>
                  {config.showPhone && (
                    <div>
                      <label className="text-xs font-medium block mb-1.5" style={{ color: s.cardLabel }}>Celular / WhatsApp</label>
                      <div className="flex gap-2">
                        <span className="flex items-center px-2.5 py-2 border text-xs" style={{ borderRadius: s.fieldRadius, borderColor: s.inputBorder, background: s.isDark ? "#222" : "#F9FAFB", color: s.cardDesc }}>+55</span>
                        <input className="flex-1 px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="(00) 00000-0000" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                      </div>
                    </div>
                  )}
                  <button onClick={() => setStep(2)} className="w-full py-3 font-bold text-sm transition-transform hover:scale-[1.01]" style={buttonStyle(s)}>Próximo</button>
                </div>

                {/* DROP ZONE: Below Form */}
                <CheckoutDropZone position="below-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Abaixo do formulário)" />

                {/* FAQ */}
                <div className="border p-5 space-y-2" style={cardStyle(s)}>
                  <h3 className="text-sm font-bold mb-2" style={{ color: s.primary }}>Perguntas Frequentes</h3>
                  {FAQ_ITEMS.map((item, i) => (
                    <div key={i} style={{ borderBottom: `1px solid ${s.cardBorder}` }} className="last:border-0">
                      <button className="w-full flex items-center justify-between py-3 text-left" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                        <span className="text-xs font-medium" style={{ color: s.cardText }}>{item.q}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openFaq === i ? "rotate-180" : ""}`} style={{ color: s.cardLabel }} />
                      </button>
                      {openFaq === i && <p className="text-xs pb-3 leading-relaxed" style={{ color: s.cardDesc }}>{item.a}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <CheckoutStep2Review config={config} formName={formName} formEmail={formEmail} formCpf={formCpf} formPhone={formPhone} totalPrice={subtotal} onBack={() => setStep(1)} onConfirm={() => setStep(3)} />
            )}

            {/* Step 3 */}
            {step === 3 && (
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
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Subtotal</span><span className="font-medium" style={{ color: s.cardText }}>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-xs"><span style={{ color: s.cardDesc }}>Frete</span><span className="font-medium" style={{ color: "#16A34A" }}>Grátis</span></div>
                <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                  <span style={{ color: s.cardTitle }}>Total</span><span style={{ color: s.primary }}>{formatCurrency(subtotal)}</span>
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

      <PaymentFooter />
    </div>
  );
}
