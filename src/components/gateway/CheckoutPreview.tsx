import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreditCard, QrCode, FileText, Lock, ShieldCheck, Clock, Gift, User, CreditCard as CardIcon, Check, ShoppingCart, X, Minus, Plus, Copy, Smartphone, Zap, AlertTriangle, Loader2, Upload } from "lucide-react";
import { PixIcon, CardBrandsRow, BoletoIcon, PaymentFooter } from "./checkout-templates/PaymentIcons";
import { CheckoutElement, CheckoutElementType, ElementPosition } from "./checkout-elements/types";
import CheckoutDropZone from "./checkout-elements/CheckoutDropZone";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { validateCpfCnpj, formatCpfCnpj } from "@/components/gateway/checkout-templates/cpf-cnpj-validator";
import MinimalistaLayout from "@/components/gateway/checkout-templates/MinimalistaLayout";
import AltoImpactoLayout from "@/components/gateway/checkout-templates/AltoImpactoLayout";
import TikTokLayout from "@/components/gateway/checkout-templates/TikTokLayout";
import StreamlineLayout from "@/components/gateway/checkout-templates/StreamlineLayout";
import LynxFyLayout from "@/components/gateway/checkout-templates/LynxFyLayout";
import ConfiancaLayout from "@/components/gateway/checkout-templates/ConfiancaLayout";
import CheckoutStepIndicators from "@/components/gateway/checkout-templates/CheckoutStepIndicators";
import { buttonStyle, cardStyle, getCheckoutStyles, inputStyle } from "@/components/gateway/checkout-templates/checkout-style-helpers";
import { resolveCheckoutFormat } from "@/components/gateway/checkout-templates/checkout-format-helpers";
import { getCheckoutSteps, getStepNumbers } from "@/components/gateway/checkout-templates/checkout-steps-helpers";
import nubankLogo from "@/assets/banks/nubank.png";
import interLogo from "@/assets/banks/inter.png";
import bradescoLogo from "@/assets/banks/bradesco.png";
import itauLogo from "@/assets/banks/itau.png";
import bbLogo from "@/assets/banks/bb.png";
import caixaLogo from "@/assets/banks/caixa.png";
import santanderLogo from "@/assets/banks/santander.png";
import picpayLogo from "@/assets/banks/picpay.png";
import mercadopagoLogo from "@/assets/banks/mercadopago.png";

interface CheckoutConfig {
  productName: string;
  offerName: string;
  price: number;
  originalPrice: number;
  buttonText: string;
  guaranteeDays: number;
  showGuarantee: boolean;
  showTimer: boolean;
  timerMinutes: number;
  format: string;
  primaryColor: string;
  bgColor: string;
  textColor: string;
  font: string;
  theme: "light" | "dark" | "custom";
  borderStyle: string;
  buttonColor?: string;
  cardBgColor?: string;
  cardLabelColor?: string;
  cardTextColor?: string;
  cardBorderColor?: string;
  inputBorderColor?: string;
  inputBgColor?: string;
  cardTitleColor?: string;
  cardDescColor?: string;
  stepBgColor?: string;
  stepTextColor?: string;
  cardBorderRadius?: string;
  buttonBorderRadius?: string;
  fieldBorderRadius?: string;
  stepBorderRadius?: string;
  showSecurityBadges: boolean;
  creditCard: boolean;
  debitCard: boolean;
  pix: boolean;
  boleto: boolean;
  maxInstallments: number;
  pixDiscount: number;
  showCpf: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showBirthdate: boolean;
  showOrderBump: boolean;
  orderBumpText: string;
  orderBumpPrice: number;
  productImage?: string;
  logoUrl?: string;
  showLogo?: boolean;
  templateId?: string;
  templateName?: string;
  shippingEnabled?: boolean;
  shippingPrice?: number;
  footerCompanyName?: string;
  footerCnpj?: string;
}

interface Props {
  config: CheckoutConfig;
  templateName?: string;
  elements?: CheckoutElement[];
  isBuilder?: boolean;
  onSelectElement?: (id: string) => void;
  selectedElementId?: string | null;
  onDropElement?: (type: CheckoutElementType, position: ElementPosition) => void;
  previewMode?: "desktop" | "mobile";
}

export default function CheckoutPreview({ config, templateName, elements = [], isBuilder, onSelectElement, selectedElementId, onDropElement, previewMode }: Props) {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [quantity, setQuantity] = useState(1);
   const [pixLoading, setPixLoading] = useState(false);
   const [pixData, setPixData] = useState<{ qrCodeImage: string; brCode: string; correlationID?: string } | null>(null);
   const [pixError, setPixError] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">(config.pix !== false ? "pix" : "credit_card");
   const [cardData, setCardInfo] = useState({ number: "", holder: "", expiry: "", cvv: "", installments: "1" });
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 15, s: 0 });
  const [showAllBanks, setShowAllBanks] = useState(false);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCpf, setFormCpf] = useState("");
  const [formCep, setFormCep] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formComplement, setFormComplement] = useState("");
  const [formNeighborhood, setFormNeighborhood] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!config.showTimer) return;
    setCountdown({ m: config.timerMinutes || 15, s: 0 });
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

  const isPublicCheckout = window.location.pathname.includes('/pay/');

  // Auto-generate PIX when entering step 3 (only on public checkout)
  useEffect(() => {
    if (isPublicCheckout && step === getStepNumbers(config).payment && paymentMethod === 'pix' && !pixData && !pixLoading && !pixError) {
      handleGeneratePix();
    }
  }, [step, paymentMethod]);

  // Poll for payment status once we have a correlationID
  useEffect(() => {
    if (!isPublicCheckout || !pixData?.correlationID || paymentApproved) return;

    const checkStatus = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/check-payment-status?external_id=${encodeURIComponent(pixData.correlationID!)}`,
          { headers: { apikey: anonKey } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.status === 'approved') {
            setPaymentApproved(true);
            if (pollingRef.current) clearInterval(pollingRef.current);
            const slug = window.location.pathname.split('/pay/')[1]?.split('/')[0] || window.location.pathname.split('/checkout/')[1]?.split('/')[0];
            if (slug) {
              const thankYouType = (config as any).thankYouType || 'default';
              if (thankYouType === 'custom_url' && (config as any).thankYouUrl) {
                window.location.href = (config as any).thankYouUrl;
              } else {
                const basePath = window.location.pathname.includes('/pay/') ? '/pay' : '/checkout';
                const params = new URLSearchParams();
                if (formName) params.set('name', formName);
                if (pixData.correlationID) params.set('tid', pixData.correlationID);
                if (pixPrice) params.set('amount', String(Math.round(pixPrice)));
                if (thankYouType === 'custom_message') {
                  if ((config as any).thankYouTitle) params.set('title', (config as any).thankYouTitle);
                  if ((config as any).thankYouMessage) params.set('msg', (config as any).thankYouMessage);
                }
                window.location.href = `${basePath}/${slug}/obrigado?${params.toString()}`;
              }
            }
          }
        }
      } catch {}
    };

    checkStatus();
    pollingRef.current = setInterval(checkStatus, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pixData?.correlationID, paymentApproved]);

   const handleGeneratePix = async () => {
     setPixLoading(true);
     setPixError(null);
     try {
       const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
       const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
       const slug = window.location.pathname.split('/pay/')[1];
       
       // Use specialized Pagar.me function if credit card or fallback to pix-charge
       const endpoint = paymentMethod === 'credit_card' ? 'create-pagarme-charge' : 'create-pix-charge';
       const body: any = {
         slug, amount: pixPrice,
         customerName: formName || undefined, customerEmail: formEmail || undefined,
         customerPhone: formPhone || undefined, customerCpf: formCpf || undefined,
       };
 
       if (paymentMethod === 'credit_card') {
         const [month, year] = cardData.expiry.split('/');
         body.paymentMethod = 'credit_card';
         body.cardInfo = {
           number: cardData.number,
           holder_name: cardData.holder,
           exp_month: parseInt(month),
           exp_year: 2000 + parseInt(year),
           cvv: cardData.cvv,
           installments: parseInt(cardData.installments)
         };
       }
 
       const res = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
         method: 'POST',
         headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
         body: JSON.stringify(body),
       });
       const data = await res.json();
       if (!res.ok) {
         throw new Error(data?.error || 'Erro ao processar pagamento');
       }
       if (data.status === 'approved') {
         setPaymentApproved(true);
       } else {
         setPixData({ qrCodeImage: data.qrCodeImage, brCode: data.brCode, correlationID: data.correlationID });
       }
     } catch (e: any) {
       setPixError(e.message || 'Erro ao processar');
     } finally {
       setPixLoading(false);
     }
   };

  const handleCopyPix = () => {
    if (pixData?.brCode) {
      navigator.clipboard.writeText(pixData.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFileSelect = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) { setReceiptError('Formato não suportado.'); return; }
    if (file.size > 7 * 1024 * 1024) { setReceiptError('Arquivo muito grande. Máximo 7MB.'); return; }
    setReceiptFile(file);
    setReceiptError(null);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setReceiptPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else { setReceiptPreview(null); }
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile || !pixData?.correlationID) return;
    setReceiptUploading(true);
    setReceiptError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const fd = new FormData();
      fd.append('file', receiptFile);
      fd.append('correlationID', pixData.correlationID);
      const res = await fetch(`${supabaseUrl}/functions/v1/upload-receipt`, { method: 'POST', headers: { 'apikey': anonKey }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar');
      setReceiptUploaded(true);
    } catch (e: any) { setReceiptError(e.message); } finally { setReceiptUploading(false); }
  };

  const s = getCheckoutStyles(config);
  const resolvedFormat = resolveCheckoutFormat(config.format);
  const isOneStep = resolvedFormat.flow === "one_step";

  const unitPrice = config.price;
  const subtotal = unitPrice * quantity;
  const pixPrice = config.pixDiscount > 0 ? Math.round(subtotal * (1 - config.pixDiscount / 100)) : subtotal;

  const timerStr = `00h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  const elementProps = {
    elements, isBuilder, onSelectElement, selectedElementId, onDropElement,
  };

  const wrapBuilderShell = (content: JSX.Element) => {
    if (!isBuilder) return content;

    if (resolvedFormat.shell === "modal") {
      return (
        <div className="flex min-h-[760px] items-center justify-center rounded-[2rem] border border-border bg-background/80 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3 text-xs">
              <span className="font-semibold text-foreground">Prévia Modal Pop-up</span>
              <span className="text-muted-foreground">Abre sobre a página</span>
            </div>
            {content}
          </div>
        </div>
      );
    }

    if (resolvedFormat.shell === "inline") {
      return (
        <div className="rounded-[1.75rem] border border-dashed border-border bg-background p-3">
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-2 text-xs">
            <span className="font-semibold text-foreground">Prévia Inline / Embed</span>
            <span className="text-muted-foreground">Incorporado em página externa</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">{content}</div>
        </div>
      );
    }

    return content;
  };

  if (!isOneStep) {
    if (config.templateId === "minimalista") {
      return wrapBuilderShell(<MinimalistaLayout config={config} {...elementProps} previewMode={previewMode} />);
    }
    if (config.templateId === "alto-impacto") {
      return wrapBuilderShell(<AltoImpactoLayout config={config} {...elementProps} previewMode={previewMode} />);
    }
    if (config.templateId === "tiktok") {
      return wrapBuilderShell(<TikTokLayout config={config} {...elementProps} previewMode={previewMode} />);
    }
    if (config.templateId === "streamline") {
      return wrapBuilderShell(<StreamlineLayout config={config} {...elementProps} previewMode={previewMode} />);
    }
    if (config.templateId === "lynxfy") {
      return wrapBuilderShell(<LynxFyLayout config={config} {...elementProps} previewMode={previewMode} />);
    }
    if (config.templateId === "confianca") {
      return wrapBuilderShell(<ConfiancaLayout config={config} {...elementProps} previewMode={previewMode} />);
    }
  }

  const stepLabels = getCheckoutSteps(config);
  const sn = getStepNumbers(config);

  return wrapBuilderShell(
    <div
      className="h-full overflow-auto"
      style={{ background: s.bgColor, fontFamily: s.fontFamily, minHeight: "100%", color: s.textColor }}
    >
      {/* Countdown Banner */}
      {config.showTimer && (
        <div
          className="w-full text-center py-3 text-sm font-medium"
          style={{ background: s.primary, color: "#FFFFFF" }}
        >
          Oferta termina em: <span className="font-bold ml-1">{timerStr}</span>
        </div>
      )}

      {/* Logo Header */}
      {config.logoUrl && config.showLogo !== false && (
        <div className="flex items-center justify-between py-3 px-4" style={{ background: s.cardBg, borderBottom: `1px solid ${s.cardBorder}` }}>
          <img src={config.logoUrl} alt="Logo" className="h-8 object-contain" />
          {config.showSecurityBadges && (
            <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#16A34A" }}>
              <ShieldCheck className="w-3.5 h-3.5" /> Pagamento 100% seguro
            </span>
          )}
        </div>
      )}

      <div className="max-w-lg mx-auto py-6 px-4 space-y-4">

        {/* DROP ZONE: Top */}
        <CheckoutDropZone
          position="top" elements={elements} primaryColor={s.primary} textColor={s.textColor}
          cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder}
          onSelectElement={onSelectElement} selectedElementId={selectedElementId}
          onDrop={onDropElement} label="Solte aqui (Topo)"
        />

        {templateName && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Modelo aplicado
            </p>
            <p className="mt-1 text-sm font-bold text-foreground">{templateName}</p>
          </div>
        )}

        {/* Order Summary Card - hidden on mobile for public checkout */}
        {!(isPublicCheckout && isMobile) && (
        <div className="rounded-xl border p-4 space-y-4" style={cardStyle(s)}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Resumo do pedido</h3>
            <span className="text-xs" style={{ color: "#16A34A" }}>● Dados seguros</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: s.isDark ? "#222" : "#F3F4F6", borderRadius: s.cardRadius }}>
              {config.productImage ? (
                <img src={config.productImage} alt={config.productName} className="w-full h-full object-cover" />
              ) : (
                <ShoppingCart className="w-6 h-6" style={{ color: s.cardDesc }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: s.cardTitle }}>
                {config.offerName || config.productName || "Produto Exemplo"}
              </p>
              {config.originalPrice > config.price && (
                <p className="text-xs line-through" style={{ color: s.cardDesc }}>{formatCurrency(config.originalPrice)}</p>
              )}
              <p className="text-sm font-bold" style={{ color: s.primary }}>{formatCurrency(unitPrice)}</p>
            </div>
            {step === 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-7 h-7 rounded-md border flex items-center justify-center" style={{ ...inputStyle(s), padding: 0 }}>
                  <Minus className="w-3 h-3" style={{ color: s.cardDesc }} />
                </button>
                <span className="text-sm font-medium w-6 text-center" style={{ color: s.cardTitle }}>{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)} className="w-7 h-7 rounded-md border flex items-center justify-center" style={{ ...inputStyle(s), padding: 0 }}>
                  <Plus className="w-3 h-3" style={{ color: s.cardDesc }} />
                </button>
              </div>
            )}
          </div>

          {step === 1 && (
            <>
              <div className="flex gap-2">
                <input className="flex-1 px-3 py-2 text-sm border outline-none placeholder:opacity-50" style={inputStyle(s)} placeholder="Cupom de desconto" />
                <button className="px-4 py-2 text-sm font-medium border" style={{ ...inputStyle(s), color: s.cardText }}>Aplicar</button>
              </div>
            </>
          )}

          <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: s.cardDesc }}>Subtotal</span>
              <span style={{ color: s.cardTitle }} className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: s.cardDesc }}>Frete</span>
              {(() => { const frete = config.shippingEnabled ? (config.shippingPrice || 0) : 0; return (
                <span style={{ color: frete > 0 ? s.cardText : "#16A34A" }} className="font-medium">{frete > 0 ? formatCurrency(frete) : "Grátis"}</span>
              ); })()}
            </div>
            <div className="flex justify-between text-base font-bold pt-1" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
              <span style={{ color: s.cardTitle }}>Total</span>
              <span style={{ color: s.primary }}>{formatCurrency(subtotal + (config.shippingEnabled ? (config.shippingPrice || 0) : 0))}</span>
            </div>
          </div>
        </div>
        )}

        {/* Step Indicators */}
        {!isOneStep && !(isPublicCheckout && isMobile) && (
          <CheckoutStepIndicators
            config={config}
            steps={stepLabels}
            step={step}
            onStepChange={setStep}
            previewMode={previewMode}
          />
        )}

        {/* ───── STEP 1: Identification ───── */}
        {(step === 1 || isOneStep) && (
          <>
            {/* DROP ZONE: Above Form */}
            <CheckoutDropZone
              position="above-form" elements={elements} primaryColor={s.primary} textColor={s.textColor}
              cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder}
              onSelectElement={onSelectElement} selectedElementId={selectedElementId}
              onDrop={onDropElement} label="Solte aqui (Acima do formulário)"
            />

            <div className="rounded-xl border p-5 space-y-4" style={cardStyle(s)}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Dados pessoais</h3>
                <p className="text-xs mt-0.5" style={{ color: s.cardDesc }}>
                  Informe seus dados para concluir sua compra com segurança.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Nome completo</label>
                  <input className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="Digite seu nome completo" value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>E-mail</label>
                  <input className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="seu@email.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
                </div>
                <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CPF ou CNPJ <span style={{ color: '#EF4444' }}>*</span></label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none" style={{ ...inputStyle(s), ...(formErrors.cpf ? { borderColor: '#EF4444' } : {}) }} placeholder="000.000.000-00" value={formCpf} onChange={(e) => { setFormCpf(formatCpfCnpj(e.target.value)); setFormErrors(prev => ({ ...prev, cpf: '' })); }} maxLength={18} />
                    {formErrors.cpf && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{formErrors.cpf}</p>}
                  </div>
                {config.showPhone && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Celular (WhatsApp)</label>
                    <div className="flex gap-2">
                      <div className="flex items-center px-3 py-2.5 border text-sm font-medium" style={{ ...inputStyle(s), background: s.isDark ? "#222" : "#F9FAFB", color: s.cardDesc }}>
                        🇧🇷 +55
                      </div>
                      <input className="flex-1 px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="(00) 00000-0000" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
                    </div>
                  </div>
                )}
                {config.showBirthdate && (
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Data de Nascimento</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="DD/MM/AAAA" />
                  </div>
                )}
                {config.showAddress && (!sn.address || isOneStep) && (
                  <>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CEP</label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="00000-000" value={formCep} onChange={(e) => setFormCep(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Endereço</label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="Rua, Avenida..." value={formStreet} onChange={(e) => setFormStreet(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Número</label>
                          <input className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="123" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Complemento</label>
                          <input className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="Apto, Bloco..." value={formComplement} onChange={(e) => setFormComplement(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Bairro</label>
                      <input className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="Bairro" value={formNeighborhood} onChange={(e) => setFormNeighborhood(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Cidade</label>
                          <input className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} placeholder="Cidade" value={formCity} onChange={(e) => setFormCity(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Estado</label>
                          <select className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} value={formState} onChange={(e) => setFormState(e.target.value)}>
                          <option value="">UF</option>
                          {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {config.showOrderBump && (
              <div className="rounded-xl border-2 p-4 space-y-2" style={{ ...cardStyle(s), borderColor: s.primary, borderStyle: "dashed" }}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 rounded" style={{ accentColor: s.primary }} />
                  <div className="flex items-center gap-1.5">
                    <Gift className="w-4 h-4" style={{ color: s.primary }} />
                    <span className="text-xs font-bold" style={{ color: s.primary }}>OFERTA ESPECIAL!</span>
                  </div>
                </div>
                <p className="text-xs" style={{ color: s.cardDesc }}>
                  {config.orderBumpText || "Adicione este produto por apenas"}{" "}
                  <strong style={{ color: s.primary }}>{formatCurrency(config.orderBumpPrice)}</strong>
                </p>
              </div>
            )}

            {!isOneStep && <button
              onClick={() => {
                const errors: Record<string, string> = {};
                if (!formName.trim()) errors.name = 'Campo obrigatório';
                if (!formEmail.trim()) errors.email = 'Campo obrigatório';
                if (!formCpf.trim()) errors.cpf = 'CPF/CNPJ é obrigatório';
                else if (!validateCpfCnpj(formCpf)) errors.cpf = 'CPF ou CNPJ inválido';
                setFormErrors(errors);
                if (Object.keys(errors).length === 0) setStep(sn.address || sn.review);
              }}
              className="w-full py-4 font-bold text-base transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
              style={buttonStyle(s)}
            >
              <Lock className="w-4 h-4" />
              Continuar
            </button>}
            {/* DROP ZONE: Below Form */}
            <CheckoutDropZone
              position="below-form" elements={elements} primaryColor={s.primary} textColor={s.textColor}
              cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder}
              onSelectElement={onSelectElement} selectedElementId={selectedElementId}
              onDrop={onDropElement} label="Solte aqui (Abaixo do formulário)"
            />
          </>
        )}

        {/* ───── ADDRESS STEP (only in 4-step mode) ───── */}
        {!isOneStep && sn.address && step === sn.address && (
          <>
            <div className="rounded-xl border p-5 space-y-4" style={cardStyle(s)}>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: s.cardTitle }}>
                  Endereço de Entrega
                </h3>
                <p className="text-xs mt-1" style={{ color: s.cardDesc }}>
                  Informe o endereço para envio do seu pedido.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CEP <span style={{ color: '#EF4444' }}>*</span></label>
                  <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="00000-000" value={formCep} onChange={(e) => setFormCep(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Rua / Avenida</label>
                  <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Rua / Avenida" value={formStreet} onChange={(e) => setFormStreet(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Nº</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Nº" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Complemento</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Complemento" value={formComplement} onChange={(e) => setFormComplement(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Bairro</label>
                  <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Bairro" value={formNeighborhood} onChange={(e) => setFormNeighborhood(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Cidade</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Cidade" value={formCity} onChange={(e) => setFormCity(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Estado</label>
                    <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Estado" value={formState} onChange={(e) => setFormState(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 font-bold text-sm flex items-center justify-center gap-2 border"
                  style={{ borderColor: s.cardBorder, background: s.cardBg, color: s.cardTitle, borderRadius: s.buttonRadius }}
                >
                  Voltar
                </button>
                <button
                  onClick={() => setStep(sn.review)}
                  className="flex-1 py-3.5 font-bold text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
                  style={buttonStyle(s)}
                >
                  <Lock className="w-4 h-4" />
                  PRÓXIMO
                </button>
              </div>
            </div>
          </>
        )}

        {/* ───── REVIEW STEP: Confirm Data ───── */}
        {!isOneStep && step === sn.review && (
          <>
            <div className="rounded-xl border p-5 space-y-4" style={cardStyle(s)}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Confira seus dados</h3>
                <p className="text-xs mt-0.5" style={{ color: s.cardDesc }}>
                  Verifique se as informações estão corretas antes de prosseguir.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: s.cardBorder }}>
                  <span className="text-xs font-medium" style={{ color: s.cardLabel }}>Nome</span>
                  <span className="text-sm font-semibold" style={{ color: s.cardTitle }}>{formName || "—"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: s.cardBorder }}>
                  <span className="text-xs font-medium" style={{ color: s.cardLabel }}>E-mail</span>
                  <span className="text-sm font-semibold" style={{ color: s.cardTitle }}>{formEmail || "—"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: s.cardBorder }}>
                    <span className="text-xs font-medium" style={{ color: s.cardLabel }}>CPF / CNPJ</span>
                    <span className="text-sm font-semibold" style={{ color: s.cardTitle }}>{formCpf || "—"}</span>
                  </div>
                {config.showPhone && (
                  <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: s.cardBorder }}>
                    <span className="text-xs font-medium" style={{ color: s.cardLabel }}>Celular</span>
                    <span className="text-sm font-semibold" style={{ color: s.cardTitle }}>{formPhone || "—"}</span>
                  </div>
                )}
                {config.showAddress && (
                  <div className="flex justify-between items-center py-2 border-b gap-4" style={{ borderColor: s.cardBorder }}>
                    <span className="text-xs font-medium" style={{ color: s.cardLabel }}>Endereço</span>
                    <span className="text-sm font-semibold text-right" style={{ color: s.cardTitle }}>
                      {[formCep, [formStreet, formNumber].filter(Boolean).join(', '), [formComplement, formNeighborhood].filter(Boolean).join(' • '), [formCity, formState].filter(Boolean).join(' - ')].filter(Boolean).join(' | ') || "—"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-medium" style={{ color: s.cardLabel }}>Valor total</span>
                  <span className="text-base font-bold" style={{ color: s.primary }}>{formatCurrency(subtotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(sn.address || 1)}
                className="flex-1 py-3.5 font-bold text-sm flex items-center justify-center gap-2 border"
                style={{ borderColor: s.cardBorder, background: s.cardBg, color: s.cardTitle, borderRadius: s.buttonRadius }}
              >
                Voltar
              </button>
              <button
                onClick={() => setStep(sn.payment)}
                className="flex-1 py-3.5 font-bold text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
                style={buttonStyle(s)}
              >
                <Lock className="w-4 h-4" />
                Confirmar e Pagar
              </button>
            </div>
          </>
        )}

         {/* ───── STEP 3: Payment ───── */}
         {(step === sn.payment || isOneStep) && (
           <>
             {/* Payment Method Selection */}
             {!pixData && !paymentApproved && (
               <div className="rounded-xl border p-2 flex gap-1 mb-4" style={cardStyle(s)}>
                  {config.pix !== false && (
                    <button 
                      onClick={() => setPaymentMethod("pix")}
                      className={`flex-1 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${paymentMethod === "pix" ? "shadow-sm border" : "opacity-60"}`}
                      style={paymentMethod === "pix" ? { background: s.isDark ? "#222" : "#f3f4f6", borderColor: s.primary } : {}}
                    >
                      <PixIcon size={16} /> PIX
                    </button>
                  )}
                  {config.creditCard !== false && (
                    <button 
                      onClick={() => setPaymentMethod("credit_card")}
                      className={`flex-1 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${paymentMethod === "credit_card" ? "shadow-sm border" : "opacity-60"}`}
                      style={paymentMethod === "credit_card" ? { background: s.isDark ? "#222" : "#f3f4f6", borderColor: s.primary } : {}}
                    >
                      <CreditCard className="w-4 h-4" /> Cartão
                    </button>
                  )}
               </div>
             )}
 
             {/* Header */}
             <div className="rounded-xl border p-5 space-y-3" style={cardStyle(s)}>
               <h3 className="text-lg font-bold" style={{ color: s.cardTitle }}>
                 {paymentMethod === 'pix' ? 'Já é quase seu...' : 'Finalize sua compra'}
               </h3>
               {paymentMethod === 'pix' && (
                 <p className="text-sm" style={{ color: s.cardDesc }}>
                   Pague seu pix dentro de <span className="font-bold" style={{ color: s.primary }}>{timerStr}</span> para garantir sua compra
                 </p>
               )}
               <div className="flex justify-between items-center pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
                 <span className="text-sm font-medium" style={{ color: s.cardDesc }}>Valor do pedido</span>
                 <span className="text-xl font-bold" style={{ color: s.cardTitle }}>{formatCurrency(pixPrice)}</span>
               </div>
             </div>
 
             {/* Payment UI Section */}
             <div className="rounded-xl border p-5 space-y-4" style={cardStyle(s)}>
               {paymentMethod === 'credit_card' && !paymentApproved ? (
                 <div className="space-y-3">
                   <div className="grid gap-3">
                     <div>
                       <label className="text-[10px] font-bold uppercase mb-1 block opacity-60">Número do cartão</label>
                       <input 
                         className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} 
                         placeholder="0000 0000 0000 0000"
                         value={cardData.number} onChange={e => setCardInfo({...cardData, number: e.target.value})}
                       />
                     </div>
                     <div>
                       <label className="text-[10px] font-bold uppercase mb-1 block opacity-60">Nome no cartão</label>
                       <input 
                         className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} 
                         placeholder="NOME DO TITULAR"
                         value={cardData.holder} onChange={e => setCardInfo({...cardData, holder: e.target.value.toUpperCase()})}
                       />
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <label className="text-[10px] font-bold uppercase mb-1 block opacity-60">Validade</label>
                         <input 
                           className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} 
                           placeholder="MM/AA"
                           value={cardData.expiry} onChange={e => setCardInfo({...cardData, expiry: e.target.value})}
                         />
                       </div>
                       <div>
                         <label className="text-[10px] font-bold uppercase mb-1 block opacity-60">CVV</label>
                         <input 
                           className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} 
                           placeholder="000"
                           value={cardData.cvv} onChange={e => setCardInfo({...cardData, cvv: e.target.value})}
                         />
                       </div>
                     </div>
                     <div>
                       <label className="text-[10px] font-bold uppercase mb-1 block opacity-60">Parcelas</label>
                       <select className="w-full px-3 py-2.5 text-sm border outline-none" style={inputStyle(s)} value={cardData.installments} onChange={e => setCardInfo({...cardData, installments: e.target.value})}>
                         {[1,2,3,4,5,6,10,12].map(n => (
                           <option key={n} value={n}>{n}x de {formatCurrency(pixPrice / n)}</option>
                         ))}
                       </select>
                     </div>
                   </div>
                   {pixError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg">{pixError}</div>}
                   <button 
                     onClick={handleGeneratePix} disabled={pixLoading}
                     className="w-full py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                     style={buttonStyle(s)}
                   >
                     {pixLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                     {pixLoading ? 'Processando...' : 'Finalizar Pagamento'}
                   </button>
                 </div>
                ) : paymentMethod === 'pix' ? (
                  pixData ? (
                    <div className="space-y-4">
                      <p className="text-xs font-medium text-center" style={{ color: s.cardLabel }}>
                        <Smartphone className="w-4 h-4 inline mr-1" />
                        aponte a câmera do seu celular
                      </p>
                      <div className="flex justify-center">
                        <img src={pixData.qrCodeImage} alt="QR Code PIX" className="w-52 h-52 rounded-lg" />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium" style={{ color: s.cardLabel }}>Código Pix</p>
                        <div className="flex gap-2">
                          <input readOnly value={pixData.brCode} className="flex-1 px-3 py-2 text-xs border rounded-lg truncate" style={{ borderColor: s.inputBorder, background: s.isDark ? "#111" : "#F9FAFB", color: s.cardDesc }} />
                          <button onClick={handleCopyPix} className="px-4 py-2 text-xs font-medium rounded-lg flex items-center gap-1" style={{ background: copied ? '#10B981' : s.primary, color: 'white', borderRadius: s.buttonRadius }}>
                            <Copy className="w-3 h-3" /> {copied ? 'Copiado!' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs font-medium text-center" style={{ color: s.cardLabel }}>
                        <Smartphone className="w-4 h-4 inline mr-1" />
                        aponte a câmera do seu celular
                      </p>
                      <div className="flex justify-center">
                        <div className="w-52 h-52 rounded-lg flex items-center justify-center" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                          <QrCode className="w-20 h-20" style={{ color: s.cardDesc }} />
                        </div>
                      </div>
                      {pixError && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-xs">
                          <AlertTriangle className="w-4 h-4" /> {pixError}
                        </div>
                      )}
                      <button
                        type="button" onClick={handleGeneratePix} disabled={pixLoading}
                        className="w-full py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-60"
                        style={buttonStyle(s)}
                      >
                        {pixLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                        {pixLoading ? 'Gerando...' : 'Gerar QR Code PIX'}
                      </button>
                    </div>
                  )
                ) : paymentApproved ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="font-bold text-lg">Pagamento Confirmado!</h4>
                    <p className="text-sm opacity-60">Sua compra foi processada com sucesso.</p>
                  </div>
                ) : null}
            </div>

            {/* How to pay */}
            <div className="rounded-xl border p-5 space-y-3" style={cardStyle(s)}>
              <h4 className="text-sm font-bold" style={{ color: s.cardTitle }}>como pagar o pix</h4>
              <div className="space-y-2.5">
                {[
                  "abra o app do seu banco",
                  'acesse a opção "Copia e Cola"',
                  "insira o código copiado e finalize seu pagamento",
                ].map((txt, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: `${s.primary}20`, color: s.primary }}>
                      {i + 1}
                    </div>
                    <p className="text-xs" style={{ color: s.cardDesc }}>{txt}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Security notice */}
            {config.showSecurityBadges && (
              <div className="rounded-xl border p-4 space-y-2" style={{ ...cardStyle(s), borderColor: "#FCD34D", background: s.isDark ? "#1a1800" : "#FFFBEB" }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs" style={{ color: s.isDark ? "#FCD34D" : "#92400E" }}>
                    Os bancos reforçaram a segurança do Pix e podem exibir alertas preventivos durante o pagamento. Fique tranquilo — sua transação é segura e está totalmente protegida.
                  </p>
                </div>
              </div>
            )}

            {/* Upload receipt - FUNCTIONAL */}
            <div className="rounded-xl border p-5 space-y-3" style={cardStyle(s)}>
              <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: s.primary }}>
                <FileText className="w-4 h-4" /> enviar comprovante
              </h4>
              <p className="text-xs" style={{ color: s.cardDesc }}>
                (opcional) Se necessário, envie o comprovante para agilizar a confirmação do seu pagamento.
              </p>

              {receiptUploaded ? (
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: s.isDark ? "#0a2010" : "#F0FDF4", border: "1px solid #22C55E" }}>
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "#16A34A" }}>Comprovante enviado com sucesso!</p>
                    <p className="text-xs" style={{ color: s.cardDesc }}>{receiptFile?.name}</p>
                  </div>
                </div>
              ) : receiptFile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: s.cardBorder, background: s.isDark ? "#111" : "#F9FAFB" }}>
                    {receiptPreview ? (
                      <img src={receiptPreview} alt="Comprovante" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${s.primary}15` }}>
                        <FileText className="w-6 h-6" style={{ color: s.primary }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: s.cardTitle }}>{receiptFile.name}</p>
                      <p className="text-[10px]" style={{ color: s.cardDesc }}>{(receiptFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); setReceiptUploaded(false); setReceiptError(null); }} className="p-1.5 rounded-full hover:opacity-70" style={{ color: s.cardDesc }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {receiptError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg text-xs" style={{ background: s.isDark ? "#2a1010" : "#FEF2F2", color: "#DC2626" }}>
                      <AlertTriangle className="w-4 h-4" /> {receiptError}
                    </div>
                  )}
                  <button
                    onClick={handleUploadReceipt}
                    disabled={receiptUploading || !pixData?.correlationID}
                    className="w-full py-3 font-bold text-sm flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-60"
                    style={buttonStyle(s)}
                  >
                    {receiptUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {receiptUploading ? 'Enviando...' : 'Enviar Comprovante'}
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                    className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-opacity hover:opacity-80"
                    style={{ borderColor: s.primary, background: `${s.primary}08` }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${s.primary}15` }}>
                      <FileText className="w-6 h-6" style={{ color: s.primary }} />
                    </div>
                    <p className="text-xs text-center" style={{ color: s.cardDesc }}>
                      Arraste o comprovante aqui ou clique para selecionar
                    </p>
                    <p className="text-[10px]" style={{ color: s.cardDesc }}>
                      Formatos: JPG, PNG, WebP, PDF (Até 7MB)
                    </p>
                  </div>
                  {receiptError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg text-xs" style={{ background: s.isDark ? "#2a1010" : "#FEF2F2", color: "#DC2626" }}>
                      <AlertTriangle className="w-4 h-4" /> {receiptError}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Banks */}
            <div className="rounded-xl border p-5 space-y-3" style={cardStyle(s)}>
              <h4 className="text-sm font-bold" style={{ color: s.cardTitle }}>pague com seu banco</h4>
              <p className="text-xs" style={{ color: s.cardDesc }}>Clique no seu banco para abrir o app e pagar:</p>
              <div className="space-y-2">
                {[
                  { name: "Nubank", desc: "Abrir app Nubank", intentUrl: "intent://pay#Intent;package=com.nu.production;scheme=nubank;end", fallback: "https://play.google.com/store/apps/details?id=com.nu.production", logo: nubankLogo },
                  { name: "Banco Inter", desc: "Abrir app Inter", intentUrl: "intent://#Intent;package=br.com.intermedium;scheme=bancointer;end", fallback: "https://play.google.com/store/apps/details?id=br.com.intermedium", logo: interLogo },
                  { name: "Bradesco", desc: "Abrir app Bradesco", intentUrl: "intent://#Intent;package=com.bradesco;scheme=bradesco;end", fallback: "https://play.google.com/store/apps/details?id=com.bradesco", logo: bradescoLogo },
                  { name: "Itaú", desc: "Abrir app Itaú", intentUrl: "intent://#Intent;package=com.itau;scheme=itau;end", fallback: "https://play.google.com/store/apps/details?id=com.itau", logo: itauLogo },
                  { name: "Banco do Brasil", desc: "Abrir app BB", intentUrl: "intent://#Intent;package=br.com.bb.android;scheme=bb;end", fallback: "https://play.google.com/store/apps/details?id=br.com.bb.android", logo: bbLogo },
                  { name: "Caixa", desc: "Abrir app Caixa", intentUrl: "intent://#Intent;package=br.com.gabba.Caixa;scheme=caixa;end", fallback: "https://play.google.com/store/apps/details?id=br.com.gabba.Caixa", logo: caixaLogo },
                  { name: "Santander", desc: "Abrir app Santander", intentUrl: "intent://#Intent;package=com.santander.app;scheme=santander;end", fallback: "https://play.google.com/store/apps/details?id=com.santander.app", logo: santanderLogo },
                  { name: "PicPay", desc: "Abrir app PicPay", intentUrl: "intent://#Intent;package=com.picpay;scheme=picpay;end", fallback: "https://play.google.com/store/apps/details?id=com.picpay", logo: picpayLogo },
                  { name: "Mercado Pago", desc: "Abrir app Mercado Pago", intentUrl: "intent://#Intent;package=com.mercadopago.wallet;scheme=mercadopago;end", fallback: "https://play.google.com/store/apps/details?id=com.mercadopago.wallet", logo: mercadopagoLogo },
                ].slice(0, showAllBanks ? 9 : 5).map((bank, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (pixData?.brCode) navigator.clipboard.writeText(pixData.brCode);
                      window.location.href = bank.intentUrl;
                      setTimeout(() => {
                        window.open(bank.fallback, '_blank');
                      }, 1500);
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ borderColor: s.cardBorder, background: s.cardBg }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: "#FFFFFF" }}>
                      <img src={bank.logo} alt={bank.name} className="w-6 h-6 object-contain" loading="lazy" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold" style={{ color: s.cardTitle }}>{bank.name}</p>
                      <p className="text-[10px]" style={{ color: s.cardDesc }}>{bank.desc}</p>
                    </div>
                    <Smartphone className="w-4 h-4" style={{ color: s.primary }} />
                  </div>
                ))}
              </div>
              <button onClick={() => setShowAllBanks(!showAllBanks)} className="w-full text-center text-xs py-2 border rounded-lg" style={{ borderColor: s.cardBorder, color: s.cardDesc, background: s.cardBg }}>
                {showAllBanks ? '▲ Ver menos' : '▼ Ver todos os bancos'}
              </button>
            </div>

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-2 py-3">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: s.primary }} />
              <span className="text-xs font-medium" style={{ color: s.cardDesc }}>aguardando pagamento...</span>
            </div>
          </>
        )}

        {/* Guarantee */}
        {config.showGuarantee && (
          <div className="flex items-center justify-center gap-2 text-xs py-2" style={{ color: s.cardDesc }}>
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span>Garantia de {config.guaranteeDays} dias — Satisfação ou dinheiro de volta</span>
          </div>
        )}

        {/* DROP ZONE: Footer */}
        <CheckoutDropZone
          position="footer" elements={elements} primaryColor={s.primary} textColor={s.textColor}
          cardBg={s.cardBg} cardBorder={s.cardBorder} isBuilder={isBuilder}
          onSelectElement={onSelectElement} selectedElementId={selectedElementId}
          onDrop={onDropElement} label="Solte aqui (Rodapé)"
        />

        <PaymentFooter companyName={config.footerCompanyName} cnpj={config.footerCnpj} />
      </div>
    </div>
  );
}
