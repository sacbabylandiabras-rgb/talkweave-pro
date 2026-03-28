import { useState, useEffect } from "react";
import { CreditCard, QrCode, FileText, Lock, ShieldCheck, Clock, Gift, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/pages/gateway/mock-data";

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
}

interface Props {
  config: CheckoutConfig;
}

export default function CheckoutPreview({ config }: Props) {
  const [timerSeconds, setTimerSeconds] = useState(config.timerMinutes * 60);
  const [selectedMethod, setSelectedMethod] = useState(config.pix ? "pix" : config.creditCard ? "credit" : "boleto");

  useEffect(() => {
    setTimerSeconds(config.timerMinutes * 60);
  }, [config.timerMinutes]);

  useEffect(() => {
    if (!config.showTimer) return;
    const interval = setInterval(() => {
      setTimerSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [config.showTimer]);

  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;

  const isDark = config.theme === "dark";
  const bg = config.theme === "custom" ? config.bgColor : isDark ? "#0D0D0D" : "#FFFFFF";
  const text = config.theme === "custom" ? config.textColor : isDark ? "#FFFFFF" : "#1A1A1A";
  const subtxt = isDark ? "#A0A0A0" : "#666666";
  const cardBg = isDark ? "#141414" : "#F9F9F9";
  const borderColor = isDark ? "#2A2A2A" : "#E5E5E5";
  const primary = config.primaryColor;
  const borderRadius = config.borderStyle === "pill" ? "50px" : config.borderStyle === "square" ? "0px" : "8px";
  const inputRadius = config.borderStyle === "pill" ? "25px" : config.borderStyle === "square" ? "0px" : "8px";

  const pixPrice = config.pixDiscount > 0 ? Math.round(config.price * (1 - config.pixDiscount / 100)) : config.price;

  const fontFamily = config.font === "plus_jakarta" ? "'Plus Jakarta Sans', sans-serif"
    : config.font === "roboto" ? "'Roboto', sans-serif"
    : config.font === "montserrat" ? "'Montserrat', sans-serif"
    : config.font === "poppins" ? "'Poppins', sans-serif"
    : "'Inter', sans-serif";

  return (
    <div
      className="h-full overflow-auto"
      style={{ background: bg, color: text, fontFamily, minHeight: "100%" }}
    >
      <div className="max-w-md mx-auto p-6 space-y-5">
        {/* Timer */}
        {config.showTimer && (
          <div
            className="flex items-center justify-center gap-2 py-2.5 px-4 text-white text-sm font-bold"
            style={{ background: primary, borderRadius }}
          >
            <Clock className="w-4 h-4" />
            <span>Oferta expira em {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
          </div>
        )}

        {/* Product Header */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold" style={{ color: text }}>{config.offerName || config.productName || "Seu Produto"}</h2>
          {config.originalPrice > config.price && (
            <div className="flex items-center justify-center gap-3">
              <span className="line-through text-sm" style={{ color: subtxt }}>
                {formatCurrency(config.originalPrice)}
              </span>
              <Badge style={{ background: `${primary}20`, color: primary, border: "none" }} className="text-xs font-bold">
                {Math.round((1 - config.price / config.originalPrice) * 100)}% OFF
              </Badge>
            </div>
          )}
          <p className="text-2xl font-extrabold" style={{ color: primary }}>
            {formatCurrency(config.price)}
          </p>
          {config.maxInstallments > 1 && (
            <p className="text-xs" style={{ color: subtxt }}>
              ou {config.maxInstallments}x de {formatCurrency(Math.round(config.price / config.maxInstallments))}
            </p>
          )}
        </div>

        {/* Payment Methods Tabs */}
        <div className="flex gap-2">
          {config.creditCard && (
            <button
              onClick={() => setSelectedMethod("credit")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all"
              style={{
                borderRadius: inputRadius,
                border: `2px solid ${selectedMethod === "credit" ? primary : borderColor}`,
                background: selectedMethod === "credit" ? `${primary}10` : "transparent",
                color: selectedMethod === "credit" ? primary : subtxt,
              }}
            >
              <CreditCard className="w-3.5 h-3.5" /> Cartão
            </button>
          )}
          {config.pix && (
            <button
              onClick={() => setSelectedMethod("pix")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all"
              style={{
                borderRadius: inputRadius,
                border: `2px solid ${selectedMethod === "pix" ? primary : borderColor}`,
                background: selectedMethod === "pix" ? `${primary}10` : "transparent",
                color: selectedMethod === "pix" ? primary : subtxt,
              }}
            >
              <QrCode className="w-3.5 h-3.5" /> PIX
              {config.pixDiscount > 0 && <Badge className="text-[9px] px-1 py-0 ml-1" style={{ background: "#22C55E", color: "white", border: "none" }}>-{config.pixDiscount}%</Badge>}
            </button>
          )}
          {config.boleto && (
            <button
              onClick={() => setSelectedMethod("boleto")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all"
              style={{
                borderRadius: inputRadius,
                border: `2px solid ${selectedMethod === "boleto" ? primary : borderColor}`,
                background: selectedMethod === "boleto" ? `${primary}10` : "transparent",
                color: selectedMethod === "boleto" ? primary : subtxt,
              }}
            >
              <FileText className="w-3.5 h-3.5" /> Boleto
            </button>
          )}
        </div>

        {/* Form Fields */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>Nome completo</label>
            <input
              className="w-full px-3 py-2.5 text-sm outline-none"
              style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }}
              placeholder="Seu nome completo"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>E-mail</label>
            <input
              className="w-full px-3 py-2.5 text-sm outline-none"
              style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }}
              placeholder="seu@email.com"
            />
          </div>
          {config.showCpf && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>CPF/CNPJ</label>
              <input className="w-full px-3 py-2.5 text-sm outline-none" style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }} placeholder="000.000.000-00" />
            </div>
          )}
          {config.showPhone && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>Telefone</label>
              <input className="w-full px-3 py-2.5 text-sm outline-none" style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }} placeholder="(11) 99999-9999" />
            </div>
          )}
          {config.showBirthdate && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>Data de Nascimento</label>
              <input className="w-full px-3 py-2.5 text-sm outline-none" style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }} placeholder="DD/MM/AAAA" />
            </div>
          )}
          {config.showAddress && (
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>CEP</label>
              <input className="w-full px-3 py-2.5 text-sm outline-none" style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }} placeholder="00000-000" />
            </div>
          )}

          {/* Credit Card Fields */}
          {selectedMethod === "credit" && (
            <>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>Número do cartão</label>
                <input className="w-full px-3 py-2.5 text-sm outline-none" style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }} placeholder="0000 0000 0000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>Validade</label>
                  <input className="w-full px-3 py-2.5 text-sm outline-none" style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }} placeholder="MM/AA" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>CVV</label>
                  <input className="w-full px-3 py-2.5 text-sm outline-none" style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }} placeholder="123" />
                </div>
              </div>
              {config.maxInstallments > 1 && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: subtxt }}>Parcelas</label>
                  <select className="w-full px-3 py-2.5 text-sm outline-none" style={{ borderRadius: inputRadius, border: `1px solid ${borderColor}`, background: cardBg, color: text }}>
                    {Array.from({ length: config.maxInstallments }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}x de {formatCurrency(Math.round(config.price / n))} {n === 1 ? "(à vista)" : ""}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* PIX Info */}
          {selectedMethod === "pix" && (
            <div className="text-center p-4 space-y-2" style={{ borderRadius, border: `1px solid ${borderColor}`, background: cardBg }}>
              <QrCode className="w-16 h-16 mx-auto" style={{ color: subtxt }} />
              <p className="text-sm font-medium" style={{ color: text }}>QR Code PIX</p>
              {config.pixDiscount > 0 && (
                <p className="text-xs font-bold" style={{ color: "#22C55E" }}>
                  Pague {formatCurrency(pixPrice)} com {config.pixDiscount}% de desconto!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Order Bump */}
        {config.showOrderBump && (
          <div
            className="p-3 space-y-1"
            style={{ borderRadius, border: `2px dashed ${primary}`, background: `${primary}08` }}
          >
            <div className="flex items-center gap-2">
              <input type="checkbox" className="w-4 h-4 accent-orange-500" />
              <div className="flex items-center gap-1.5">
                <Gift className="w-4 h-4" style={{ color: primary }} />
                <span className="text-xs font-bold" style={{ color: primary }}>OFERTA ESPECIAL!</span>
              </div>
            </div>
            <p className="text-xs" style={{ color: subtxt }}>{config.orderBumpText || "Adicione este produto por apenas"} <strong style={{ color: primary }}>{formatCurrency(config.orderBumpPrice)}</strong></p>
          </div>
        )}

        {/* CTA Button */}
        <button
          className="w-full py-3.5 text-white font-bold text-base transition-transform hover:scale-[1.03]"
          style={{ background: primary, borderRadius }}
        >
          <Lock className="w-4 h-4 inline mr-2" />
          {config.buttonText || "Comprar Agora"}
        </button>

        {/* Guarantee */}
        {config.showGuarantee && (
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: subtxt }}>
            <ShieldCheck className="w-4 h-4" style={{ color: "#22C55E" }} />
            <span>Garantia de {config.guaranteeDays} dias — Satisfação ou dinheiro de volta</span>
          </div>
        )}

        {/* Security Badges */}
        {config.showSecurityBadges && (
          <div className="flex items-center justify-center gap-4 pt-2">
            {["Visa", "Master", "PIX", "🔒 SSL"].map(badge => (
              <span key={badge} className="text-[10px] font-medium px-2 py-1" style={{ color: subtxt, border: `1px solid ${borderColor}`, borderRadius: "4px" }}>
                {badge}
              </span>
            ))}
          </div>
        )}

        <p className="text-center text-[10px]" style={{ color: subtxt }}>
          Pagamento processado com segurança por ZapLynxPay
        </p>
      </div>
    </div>
  );
}