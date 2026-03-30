import { useState } from "react";
import { AlertTriangle, Copy, CreditCard, FileText, Loader2, Lock, QrCode, ShieldCheck, Smartphone, Zap, Check } from "lucide-react";
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
}

export default function CheckoutStep3Payment({ config, pixPrice, formName, formEmail, formPhone, formCpf, timerStr }: Props) {
  const s = getCheckoutStyles(config);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrCodeImage: string; brCode: string } | null>(null);
  const [pixError, setPixError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGeneratePix = async () => {
    setPixLoading(true);
    setPixError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const slug = window.location.pathname.split('/pay/')[1];
      const res = await fetch(`${supabaseUrl}/functions/v1/create-pix-charge`, {
        method: 'POST',
        headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, amount: pixPrice,
          customerName: formName || undefined, customerEmail: formEmail || undefined,
          customerPhone: formPhone || undefined, customerCpf: formCpf || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar cobrança');
      setPixData({ qrCodeImage: data.qrCodeImage, brCode: data.brCode });
    } catch (e: any) {
      setPixError(e.message || 'Erro ao gerar PIX');
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

      {/* Beneficiary */}
      <div className="rounded-xl border p-4" style={cardStyle(s)}>
        <p className="text-xs" style={{ color: s.cardDesc }}>
          <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-green-500" />
          O beneficiário do Pix é o <strong style={{ color: s.cardTitle }}>INTERMEDIADOR (AKASEG)</strong>, a empresa que gerencia nossos pagamentos de forma segura.
        </p>
      </div>

      {/* QR Code */}
      <div className="rounded-xl border p-5 space-y-4" style={cardStyle(s)}>
        {pixData ? (
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

      {/* Upload receipt */}
      <div className="rounded-xl border p-5 space-y-3" style={cardStyle(s)}>
        <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: s.primary }}>
          <FileText className="w-4 h-4" /> enviar comprovante
        </h4>
        <p className="text-xs" style={{ color: s.cardDesc }}>
          (opcional) Se necessário, envie o comprovante para agilizar a confirmação do seu pagamento.
        </p>
        <div className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer" style={{ borderColor: s.primary, background: `${s.primary}08` }}>
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
      </div>

      {/* Banks */}
      <div className="rounded-xl border p-5 space-y-3" style={cardStyle(s)}>
        <h4 className="text-sm font-bold" style={{ color: s.cardTitle }}>pague com seu banco</h4>
        <div className="space-y-2">
          {[
            { name: "Nubank", desc: "Pedir para resolver manualmente" },
            { name: "BANCO INTER", desc: "Pedir para resolver manualmente" },
            { name: "Bradesco", desc: "Pedir para resolver manualmente" },
            { name: "ITAU", desc: "Pedir para resolver manualmente" },
            { name: "banco do brasil", desc: "Pedir para resolver manualmente" },
          ].map((bank, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" style={{ borderColor: s.cardBorder, background: s.cardBg }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.isDark ? "#222" : "#F3F4F6" }}>
                <CreditCard className="w-4 h-4" style={{ color: s.cardDesc }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: s.cardTitle }}>{bank.name}</p>
                <p className="text-[10px]" style={{ color: s.cardDesc }}>{bank.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="w-full text-center text-xs py-2 border rounded-lg" style={{ borderColor: s.cardBorder, color: s.cardDesc, background: s.cardBg }}>
          ▼ Ver todos os bancos
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
