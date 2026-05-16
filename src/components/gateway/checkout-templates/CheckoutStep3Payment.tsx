import { useState, useEffect, useRef } from "react";
 import { AlertTriangle, Copy, FileText, Loader2, Lock, QrCode, ShieldCheck, Smartphone, Zap, Check, Upload, X, Image, CreditCard } from "lucide-react";
 import { PixIcon } from "./PaymentIcons";
import nubankLogo from "@/assets/banks/nubank.png";
import interLogo from "@/assets/banks/inter.png";
import bradescoLogo from "@/assets/banks/bradesco.png";
import itauLogo from "@/assets/banks/itau.png";
import bbLogo from "@/assets/banks/bb.png";
import caixaLogo from "@/assets/banks/caixa.png";
import santanderLogo from "@/assets/banks/santander.png";
import picpayLogo from "@/assets/banks/picpay.png";
import mercadopagoLogo from "@/assets/banks/mercadopago.png";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { cardStyle, buttonStyle, getCheckoutStyles } from "./checkout-style-helpers";

interface Props {
  config: Record<string, any>;
  pixPrice: number;
  formName?: string;
  formEmail?: string;
  formPhone?: string;
  formCpf?: string;
  timerStr?: string;
  isPreview?: boolean;
}

export default function CheckoutStep3Payment({ config, pixPrice, formName, formEmail, formPhone, formCpf, timerStr, isPreview: isPreviewProp }: Props) {
  const s = getCheckoutStyles(config);
  const isPreview = isPreviewProp ?? !window.location.pathname.includes('/pay/');
   const [pixLoading, setPixLoading] = useState(false);
   const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
   const [cardData, setCardInfo] = useState({ number: "", holder: "", expiry: "", cvv: "", installments: "1" });
  const [pixData, setPixData] = useState<{ qrCodeImage: string; brCode: string; correlationID?: string } | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAllBanks, setShowAllBanks] = useState(false);

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Payment status polling
  const [paymentApproved, setPaymentApproved] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

   // Auto-generate PIX when step 3 mounts if it's the selected method
   useEffect(() => {
     if (!isPreview && paymentMethod === 'pix' && !pixData && !pixLoading && !pixError) {
       handleGeneratePix();
     }
   }, [paymentMethod]);

  // Poll for payment status once we have a correlationID
  useEffect(() => {
    if (isPreview || !pixData?.correlationID || paymentApproved) return;

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
              // Check thank you config
              const thankYouType = config.thankYouType || 'default';
              if (thankYouType === 'custom_url' && config.thankYouUrl) {
                window.location.href = config.thankYouUrl;
              } else {
                const basePath = window.location.pathname.includes('/pay/') ? '/pay' : '/checkout';
                const params = new URLSearchParams();
                if (formName) params.set('name', formName);
                if (pixData.correlationID) params.set('tid', pixData.correlationID);
                if (pixPrice) params.set('amount', String(Math.round(pixPrice)));
                if (thankYouType === 'custom_message') {
                  if (config.thankYouTitle) params.set('title', config.thankYouTitle);
                  if (config.thankYouMessage) params.set('msg', config.thankYouMessage);
                }
                window.location.href = `${basePath}/${slug}/obrigado?${params.toString()}`;
              }
            }
          }
        }
      } catch {}
    };

    // Check immediately then every 5 seconds
    checkStatus();
    pollingRef.current = setInterval(checkStatus, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pixData?.correlationID, isPreview, paymentApproved]);

   const handleGeneratePix = async () => {
     setPixLoading(true);
     setPixError(null);
     try {
       const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
       const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
       const slug = window.location.pathname.split('/pay/')[1]?.split('/')[0] || window.location.pathname.split('/checkout/')[1]?.split('/')[0];
       
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
         throw new Error(data?.error || data?.message || 'Erro ao processar pagamento');
       }
       if (data.status === 'approved' || data.status === 'paid') {
         setPaymentApproved(true);
         const thankYouType = config.thankYouType || 'default';
         if (thankYouType === 'custom_url' && config.thankYouUrl) {
           window.location.href = config.thankYouUrl;
         } else {
           const basePath = window.location.pathname.includes('/pay/') ? '/pay' : '/checkout';
           const params = new URLSearchParams();
           if (formName) params.set('name', formName);
           if (data.correlationID) params.set('tid', data.correlationID);
           if (pixPrice) params.set('amount', String(Math.round(pixPrice)));
           window.location.href = `${basePath}/${slug}/obrigado?${params.toString()}`;
         }
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
    if (!allowedTypes.includes(file.type)) {
      setReceiptError('Formato não suportado. Use JPG, PNG, WebP ou PDF.');
      return;
    }
    if (file.size > 7 * 1024 * 1024) {
      setReceiptError('Arquivo muito grande. Máximo 7MB.');
      return;
    }
    setReceiptFile(file);
    setReceiptError(null);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setReceiptPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUploadReceipt = async () => {
    if (!receiptFile || !pixData?.correlationID) return;
    setReceiptUploading(true);
    setReceiptError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const formData = new FormData();
      formData.append('file', receiptFile);
      formData.append('correlationID', pixData.correlationID);
      const res = await fetch(`${supabaseUrl}/functions/v1/upload-receipt`, {
        method: 'POST',
        headers: { 'apikey': anonKey },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar comprovante');
      setReceiptUploaded(true);
    } catch (e: any) {
      setReceiptError(e.message || 'Erro ao enviar comprovante');
    } finally {
      setReceiptUploading(false);
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptUploaded(false);
    setReceiptError(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border p-5 space-y-3" style={cardStyle(s)}>
        <h3 className="text-lg font-bold" style={{ color: s.cardTitle }}>Já é quase seu...</h3>
        <p className="text-sm" style={{ color: s.cardDesc }}>
          Pague seu pix dentro de{" "}
          <span className="font-bold" style={{ color: s.primary }}>{timerStr || "15:00"}</span>{" "}
          para garantir sua compra
        </p>
        <div className="flex justify-between items-center pt-2" style={{ borderTop: `1px solid ${s.cardBorder}` }}>
          <span className="text-sm font-medium" style={{ color: s.cardDesc }}>Valor do pedido</span>
          <span className="text-xl font-bold" style={{ color: s.cardTitle }}>{formatCurrency(pixPrice)}</span>
        </div>
      </div>


      {/* QR Code */}
      <div className="rounded-xl border p-5 space-y-4" style={cardStyle(s)}>
        {(pixData || isPreview) ? (
          <div className="space-y-4">
            <p className="text-xs font-medium text-center" style={{ color: s.cardLabel }}>
              <Smartphone className="w-4 h-4 inline mr-1" />
              aponte a câmera do seu celular
            </p>
            <div className="flex justify-center">
              {isPreview && !pixData ? (
                <div className="w-52 h-52 rounded-lg flex items-center justify-center relative" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                  <QrCode className="w-28 h-28" style={{ color: s.cardDesc, opacity: 0.3 }} />
                  <span className="absolute text-[10px] font-bold px-2 py-1 rounded" style={{ background: s.primary, color: '#fff' }}>PREVIEW</span>
                </div>
              ) : (
                <img src={pixData!.qrCodeImage} alt="QR Code PIX" className="w-52 h-52 rounded-lg" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: s.cardLabel }}>Código Pix</p>
              <div className="flex gap-2">
                <input readOnly value={pixData?.brCode || "00020126580014br.gov.bcb.pix0136preview-mode-demo-code"} className="flex-1 px-3 py-2 text-xs border rounded-lg truncate" style={{ borderColor: s.inputBorder, background: s.isDark ? "#111" : "#F9FAFB", color: s.cardDesc }} />
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
                {pixLoading ? (
                  <Loader2 className="w-12 h-12 animate-spin" style={{ color: s.primary }} />
                ) : (
                  <QrCode className="w-20 h-20" style={{ color: s.cardDesc }} />
                )}
              </div>
            </div>
            {pixError && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-xs" style={{ background: s.isDark ? "#2a1010" : "#FEF2F2", color: "#DC2626" }}>
                <AlertTriangle className="w-4 h-4" /> {pixError}
              </div>
            )}
            {!pixLoading && pixError && (
              <button
                type="button" onClick={handleGeneratePix}
                className="w-full py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                style={buttonStyle(s)}
              >
                <QrCode className="w-4 h-4" /> Tentar novamente
              </button>
            )}
          </div>
        )}
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
      <div className="rounded-xl border p-4 space-y-2" style={{ ...cardStyle(s), borderColor: "#FCD34D", background: s.isDark ? "#1a1800" : "#FFFBEB" }}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs" style={{ color: s.isDark ? "#FCD34D" : "#92400E" }}>
            Os bancos reforçaram a segurança do Pix e podem exibir alertas preventivos durante o pagamento. Fique tranquilo — sua transação é segura e está totalmente protegida.
          </p>
        </div>
      </div>

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
              <button onClick={removeReceipt} className="p-1.5 rounded-full hover:opacity-70" style={{ color: s.cardDesc }}>
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
              onDrop={handleDrop}
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
        <p className="text-xs" style={{ color: s.cardDesc }}>Copie o código acima e cole no app do seu banco:</p>
        <div className="space-y-2">
          {[
            { name: "Nubank", logo: nubankLogo },
            { name: "Banco Inter", logo: interLogo },
            { name: "Bradesco", logo: bradescoLogo },
            { name: "Itaú", logo: itauLogo },
            { name: "Banco do Brasil", logo: bbLogo },
            { name: "Caixa", logo: caixaLogo },
            { name: "Santander", logo: santanderLogo },
            { name: "PicPay", logo: picpayLogo },
            { name: "Mercado Pago", logo: mercadopagoLogo },
          ].slice(0, showAllBanks ? 9 : 5).map((bank, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-lg border"
              style={{ borderColor: s.cardBorder, background: s.cardBg }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: "#FFFFFF" }}>
                <img src={bank.logo} alt={bank.name} className="w-6 h-6 object-contain" loading="lazy" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold" style={{ color: s.cardTitle }}>{bank.name}</p>
              </div>
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
    </div>
  );
}
