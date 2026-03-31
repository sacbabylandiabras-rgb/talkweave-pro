import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  CreditCard,
  Lock,
  Package,
  ShieldCheck,
  User,
  Check,
} from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, ApplePayIcon, BoletoIcon, PaymentFooter } from "./PaymentIcons";
import { buttonStyle, cardStyle, getCheckoutStyles, inputStyle } from "./checkout-style-helpers";
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

function getInitialSections(initialState: string) {
  return {
    info: initialState === "expanded" || initialState === "first_open",
    address: initialState === "expanded",
    cpf: initialState === "expanded",
  };
}

export default function TikTokLayout({ config, elements = [], isBuilder, onSelectElement, selectedElementId, onDropElement, previewMode }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 9, s: 0 });
  const [selectedPayment, setSelectedPayment] = useState<"pix" | "credit" | "boleto">("credit");
  const [mobileSections, setMobileSections] = useState(() => getInitialSections(config.mobileInitialState || "collapsed"));
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formPhone, setFormPhone] = useState("");

  useEffect(() => {
    if (!config.showTimer) return;
    setCountdown({ m: config.timerMinutes || 9, s: 0 });
  }, [config.timerMinutes, config.showTimer]);

  useEffect(() => {
    if (!config.showTimer) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev.m === 0 && prev.s === 0) return prev;
        if (prev.s === 0) return { m: prev.m - 1, s: 59 };
        return { ...prev, s: prev.s - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [config.showTimer]);

  useEffect(() => {
    setMobileSections(getInitialSections(config.mobileInitialState || "collapsed"));
  }, [config.mobileInitialState]);

  const s = getCheckoutStyles(config);
  const unitPrice = config.price || 7191;
  const productName = config.offerName || config.productName || "Produto";
  const timerStr = `00h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;
  const safeGreen = "#16A34A";
  const softSurface = s.isDark ? "#141414" : "#F8FAFC";
  const pixPrice = config.pixDiscount > 0 ? Math.round(unitPrice * (1 - config.pixDiscount / 100)) : unitPrice;

  const shellStyle = { ...cardStyle(s), border: `1px solid ${s.cardBorder}` } as const;
  const compactInputStyle = { ...inputStyle(s), fontSize: "11px", padding: "10px 12px" } as const;

  const stepLabels = [
    { num: 1, label: "Identificação", icon: <User className="h-4 w-4" /> },
    { num: 2, label: "Conferência", icon: <Check className="h-4 w-4" /> },
    { num: 3, label: "Pagamento", icon: <CreditCard className="h-4 w-4" /> },
  ];

  const SummaryContent = ({ compact = false }: { compact?: boolean }) => (
    <div style={shellStyle} className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${s.cardBorder}` }}>
        <div>
          <p className="text-xs font-semibold" style={{ color: s.cardTitle }}>Resumo do Pedido</p>
          {!compact && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: s.cardDesc }}>
              <ShieldCheck className="h-3 w-3" style={{ color: safeGreen }} />
              Seus dados estão seguros e criptografados.
            </p>
          )}
        </div>
        {compact && <span className="text-[11px] font-bold" style={{ color: s.cardTitle }}>{formatCurrency(unitPrice)}</span>}
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden border" style={{ borderRadius: s.cardRadius, borderColor: s.cardBorder, background: softSurface }}>
            {config.productImage ? <img src={config.productImage} alt={productName} className="h-full w-full object-cover" /> : <Package className="h-4 w-4" style={{ color: s.cardLabel }} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium" style={{ color: s.cardText }}>{productName}</p>
            {config.originalPrice > config.price && <p className="text-[10px] line-through" style={{ color: s.cardDesc }}>{formatCurrency(config.originalPrice)}</p>}
            <p className="text-xs font-bold" style={{ color: s.primary }}>{formatCurrency(unitPrice)}</p>
          </div>
        </div>
        {!compact && (
          <>
            <div className="flex gap-2">
              <input className="flex-1 border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="Adicionar cupom de desconto" />
              <button className="border px-3 py-2 text-[10px] font-semibold" style={{ ...inputStyle(s), color: s.cardText }}>Aplicar</button>
            </div>
            <div className="space-y-2 pt-3" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
              <div className="flex items-center justify-between text-[10px]" style={{ color: s.cardDesc }}><span>Subtotal</span><span>{formatCurrency(unitPrice)}</span></div>
              <div className="flex items-center justify-between text-[10px]" style={{ color: s.cardDesc }}><span>Frete</span><span style={{ color: safeGreen }}>Grátis</span></div>
              <div className="flex items-center justify-between pt-1 text-sm font-bold"><span style={{ color: s.cardTitle }}>Total</span><span style={{ color: s.primary }}>{formatCurrency(unitPrice)}</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const MobileSection = ({ open, title, onToggle, children }: { open: boolean; title: string; onToggle: () => void; children: ReactNode }) => (
    <div className="border" style={shellStyle}>
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-[11px] font-semibold" style={{ color: s.cardTitle }}>{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: s.cardLabel }} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );

  const ContactForm = (
    <div className="space-y-3">
      <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="Nome completo *" value={formName} onChange={e => setFormName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="E-mail *" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
        <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="Telefone *" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
      </div>
    </div>
  );

  const AddressForm = (
    <div className="space-y-3">
      <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="00000-000" />
      <div className="grid grid-cols-2 gap-2">
        <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="Rua *" />
        <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="Número *" />
      </div>
      <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="Complemento" />
      <div className="grid grid-cols-3 gap-2">
        <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="Bairro *" />
        <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="Cidade *" />
        <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="ESTADO/UF *" />
      </div>
    </div>
  );

  const CpfForm = <input className="w-full border outline-none placeholder:text-gray-400" style={compactInputStyle} placeholder="000.000.000-00" value={formCpf} onChange={e => setFormCpf(e.target.value)} />;

  // Step indicators for desktop
  const StepIndicators = () => (
    <div className={!previewMode ? "mb-5 hidden items-center justify-center gap-5 md:flex" : "mb-5 items-center justify-center gap-5"} style={previewMode ? { display: previewMode === "mobile" ? "none" : "flex" } : undefined}>
      {stepLabels.map((sl, i) => (
        <div key={sl.num} className="flex items-center gap-5">
          <button onClick={() => setStep(sl.num as 1 | 2 | 3)} className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center border-2" style={{
              borderColor: step === sl.num ? s.stepBg : step > sl.num ? s.stepBg : s.cardBorder,
              color: step >= sl.num ? s.stepBg : s.cardLabel,
              borderRadius: s.stepRadius,
              background: step > sl.num ? `${s.stepBg}20` : "transparent",
            }}>
              {step > sl.num ? <Check className="h-4 w-4" /> : sl.icon}
            </div>
            <span className="text-xs font-semibold" style={{ color: step === sl.num ? s.stepBg : s.cardLabel }}>{sl.label}</span>
          </button>
          {i < stepLabels.length - 1 && <div className="h-px w-12" style={{ background: step > sl.num ? s.primary : s.cardBorder }} />}
        </div>
      ))}
    </div>
  );

  const PaymentOption = ({ active, icon, title, subtitle, onClick, children }: { active: boolean; icon: ReactNode; title: string; subtitle?: string; onClick: () => void; children?: ReactNode }) => (
    <div className="border p-3" style={{ ...cardStyle(s), borderColor: active ? s.primary : s.cardBorder, background: active ? `${s.primary}10` : s.cardBg }}>
      <button onClick={onClick} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5" style={{ color: active ? s.primary : s.cardLabel }}>{icon}</div>
          <div>
            <p className="text-[11px] font-medium" style={{ color: s.cardText }}>{title}</p>
            {subtitle && <p className="mt-0.5 text-[9px]" style={{ color: s.cardDesc }}>{subtitle}</p>}
          </div>
        </div>
        <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: active ? s.primary : s.cardBorder }}>
          {active && <div className="h-2 w-2 rounded-full" style={{ background: s.primary }} />}
        </div>
      </button>
      {children}
    </div>
  );

  // ─── Step 1 content for desktop ───
  const Step1Desktop = () => (
    <div className="space-y-4">
      {config.showAddress && (
        <div style={shellStyle} className="p-4">
          <h3 className="mb-3 text-[11px] font-semibold" style={{ color: s.cardTitle }}>Endereço de Entrega</h3>
          {AddressForm}
        </div>
      )}
      <div style={shellStyle} className="p-4">
          <h3 className="mb-3 text-[11px] font-semibold" style={{ color: s.cardTitle }}>CPF / CNPJ <span style={{ color: '#EF4444' }}>*</span></h3>
          {CpfForm}
        </div>
      <div style={shellStyle} className="p-4">
        <h3 className="mb-1 flex items-center gap-2 text-[11px] font-semibold" style={{ color: s.cardTitle }}>
          <User className="h-3.5 w-3.5" style={{ color: s.cardLabel }} /> Informações de Contato
        </h3>
        {ContactForm}
      </div>
      <button onClick={() => setStep(2)} className="flex w-full items-center justify-center gap-2 px-5 py-3 text-xs font-bold" style={buttonStyle(s)}>
        <Lock className="h-3.5 w-3.5" /> Próximo
      </button>
    </div>
  );

  // ─── Step 1 content for mobile ───
  const Step1Mobile = () => (
    <>
      {config.mobileInfoBeforeCart ? (
        <>
          <MobileSection open={mobileSections.info} title="Informações de Contato" onToggle={() => setMobileSections(prev => ({ ...prev, info: !prev.info }))}>
            {ContactForm}
          </MobileSection>
          <SummaryContent compact />
        </>
      ) : (
        <>
          <SummaryContent compact />
          <MobileSection open={mobileSections.info} title="Informações de Contato" onToggle={() => setMobileSections(prev => ({ ...prev, info: !prev.info }))}>
            {ContactForm}
          </MobileSection>
        </>
      )}
      {config.showAddress && (
        <MobileSection open={mobileSections.address} title="Endereço de Entrega" onToggle={() => setMobileSections(prev => ({ ...prev, address: !prev.address }))}>
          {AddressForm}
        </MobileSection>
      )}
      <MobileSection open={mobileSections.cpf} title="CPF / CNPJ *" onToggle={() => setMobileSections(prev => ({ ...prev, cpf: !prev.cpf }))}>
          {CpfForm}
        </MobileSection>
      <button onClick={() => setStep(2)} className="flex w-full items-center justify-center gap-2 px-5 py-3 text-xs font-bold" style={buttonStyle(s)}>
        <Lock className="h-3.5 w-3.5" /> Próximo
      </button>
    </>
  );

  return (
    <div className="min-h-screen" style={{ background: s.bgColor, color: s.textColor, fontFamily: s.fontFamily }}>
      <div className="mx-auto w-full" style={{ background: s.cardBg }}>
        {config.showTimer && (
          <div className="px-4 py-3 text-center text-xs font-bold text-white" style={{ background: s.primary }}>
            Oferta termina em: <span className="ml-1">{timerStr}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-b px-4 py-4" style={{ borderColor: s.cardBorder, background: s.cardBg }}>
          <div>
            {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-8 object-contain" /> : <span className="text-base font-semibold" style={{ color: s.cardTitle }}>Minha Loja</span>}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: safeGreen }}>
            <ShieldCheck className="h-3.5 w-3.5" /> Pagamento 100% seguro
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[980px] px-3 py-6 md:px-4" style={previewMode ? { paddingLeft: previewMode === "mobile" ? "0.75rem" : "1rem", paddingRight: previewMode === "mobile" ? "0.75rem" : "1rem" } : undefined}>
        <StepIndicators />

        {/* Desktop layout */}
        <div className={!previewMode ? "hidden gap-4 md:grid md:grid-cols-[minmax(0,1fr)_300px]" : ""} style={previewMode ? { display: previewMode === "mobile" ? "none" : "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: "1rem" } : undefined}>
          <div className="space-y-4">
            {/* DROP ZONE: Top */}
            <CheckoutDropZone position="top" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Topo)" />
            {/* DROP ZONE: Above Form */}
            <CheckoutDropZone position="above-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Acima do formulário)" />
            {step === 1 && <Step1Desktop />}
            {step === 2 && <CheckoutStep2Review config={config} formName={formName} formEmail={formEmail} formCpf={formCpf} formPhone={formPhone} totalPrice={unitPrice} onBack={() => setStep(1)} onConfirm={() => setStep(3)} />}
            {step === 3 && <CheckoutStep3Payment config={config} pixPrice={pixPrice} formName={formName} formEmail={formEmail} formPhone={formPhone} formCpf={formCpf} timerStr={timerStr} />}
            {/* DROP ZONE: Below Form */}
            <CheckoutDropZone position="below-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Abaixo do formulário)" />
          </div>
          <div className="space-y-4">
            {/* DROP ZONE: Sidebar */}
            <CheckoutDropZone position="sidebar" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar)" />
            <SummaryContent />
            {/* DROP ZONE: Sidebar Bottom */}
            <CheckoutDropZone position="sidebar-bottom" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar Inferior)" />
          </div>
        </div>

        {/* DROP ZONE: Footer (desktop) */}
        <CheckoutDropZone position="footer" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Rodapé)" />

        {/* Mobile layout */}
        <div className={!previewMode ? "mx-auto max-w-[360px] space-y-3 md:hidden" : "mx-auto max-w-[360px] space-y-3"} style={previewMode ? { display: previewMode === "mobile" ? "block" : "none" } : undefined}>
          {/* DROP ZONE: Top (mobile) */}
          <CheckoutDropZone position="top" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Topo)" />
          {/* DROP ZONE: Above Form (mobile) */}
          <CheckoutDropZone position="above-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Acima do formulário)" />
          {step === 1 && <Step1Mobile />}
          {step === 2 && <CheckoutStep2Review config={config} formName={formName} formEmail={formEmail} formCpf={formCpf} formPhone={formPhone} totalPrice={unitPrice} onBack={() => setStep(1)} onConfirm={() => setStep(3)} />}
          {step === 3 && <CheckoutStep3Payment config={config} pixPrice={pixPrice} formName={formName} formEmail={formEmail} formPhone={formPhone} formCpf={formCpf} timerStr={timerStr} />}
          {/* DROP ZONE: Below Form (mobile) */}
          <CheckoutDropZone position="below-form" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Abaixo do formulário)" />
          {/* DROP ZONE: Sidebar Bottom (mobile) */}
          <CheckoutDropZone position="sidebar-bottom" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Sidebar Inferior)" />
          {/* DROP ZONE: Footer (mobile) */}
          <CheckoutDropZone position="footer" elements={elements} primaryColor={s.primary} textColor={s.textColor} cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder} onSelectElement={onSelectElement} selectedElementId={selectedElementId} onDrop={onDropElement} label="Solte aqui (Rodapé)" />
          <PaymentFooter />
        </div>
      </div>
    </div>
  );
}
