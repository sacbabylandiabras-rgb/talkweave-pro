import { useEffect, useState } from "react";
import {
  ChevronDown,
  CreditCard,
  Lock,
  Package,
  Plus,
  ShieldCheck,
  User,
} from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, ApplePayIcon, BoletoIcon, PaymentFooter } from "./PaymentIcons";

interface Props {
  config: Record<string, any>;
}

export default function TikTokLayout({ config }: Props) {
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 9, s: 0 });
  const [selectedPayment, setSelectedPayment] = useState<"pix" | "credit" | "boleto">("credit");

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

  const primary = config.primaryColor || "#F41F5E";
  const unitPrice = config.price || 7191;
  const productName = config.offerName || config.productName || "Produto";
  const timerStr = `00h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;
  const progressColors = ["#22C55E", "#10B981", "#06B6D4", "#3B82F6", "#A855F7", "#EC4899", "#F97316", "#F43F5E"];

  const shellStyle = {
    background: "#FFFFFF",
    border: "1px solid #E9EDF5",
    borderRadius: "12px",
  } as const;

  const inputClass = "w-full rounded-lg border border-[#E5EAF3] bg-white px-3 py-2.5 text-[11px] text-[#111827] outline-none placeholder:text-[#9CA3AF]";

  const SummaryContent = ({ compact = false }: { compact?: boolean }) => (
    <div style={shellStyle} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EEF2F7] px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-[#101828]">Resumo do Pedido</p>
          {!compact && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#6B7280]">
              <ShieldCheck className="h-3 w-3 text-[#22C55E]" />
              Seus dados estão seguros e criptografados.
            </p>
          )}
        </div>
        {compact && <span className="text-[11px] font-bold text-[#101828]">{formatCurrency(unitPrice)}</span>}
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-[#EEF2F7] bg-[#F8FAFC]">
            {config.productImage ? (
              <img src={config.productImage} alt={productName} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-[#98A2B3]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-[#111827]">{productName}</p>
            {config.originalPrice > config.price && (
              <p className="text-[10px] text-[#98A2B3] line-through">{formatCurrency(config.originalPrice)}</p>
            )}
            <p className="text-xs font-bold" style={{ color: primary }}>{formatCurrency(unitPrice)}</p>
          </div>

          {!compact && (
            <div className="flex items-center gap-2">
              <button className="flex h-6 w-6 items-center justify-center rounded-full border border-[#D0D5DD] text-xs text-[#667085]">−</button>
              <span className="text-xs font-semibold text-[#111827]">1</span>
              <button className="flex h-6 w-6 items-center justify-center rounded-full border border-[#D0D5DD] text-xs text-[#667085]">+</button>
            </div>
          )}
        </div>

        {!compact && (
          <>
            <div className="flex gap-2">
              <input className="flex-1 rounded-md border border-[#D9E0EA] px-3 py-2 text-[10px] outline-none placeholder:text-[#98A2B3]" placeholder="Adicionar cupom de desconto" />
              <button className="rounded-md border border-[#D9E0EA] px-3 py-2 text-[10px] font-semibold text-[#667085]">Aplicar</button>
            </div>

            <div className="space-y-2 border-t border-[#EEF2F7] pt-3">
              <div className="flex items-center justify-between text-[10px] text-[#667085]">
                <span>Subtotal</span>
                <span>{formatCurrency(unitPrice)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#667085]">
                <span>Frete</span>
                <span className="text-[#22C55E]">Grátis</span>
              </div>
              <div className="flex items-center justify-between pt-1 text-sm font-bold text-[#111827]">
                <span>Total</span>
                <span style={{ color: primary }}>{formatCurrency(unitPrice)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const PaymentOption = ({
    active,
    icon,
    title,
    subtitle,
    onClick,
    children,
  }: {
    active: boolean;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onClick: () => void;
    children?: React.ReactNode;
  }) => (
    <div className="rounded-xl border border-[#E7ECF3] bg-white p-3">
      <button onClick={onClick} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 text-[#667085]">{icon}</div>
          <div>
            <p className="text-[11px] font-medium text-[#111827]">{title}</p>
            {subtitle && <p className="mt-0.5 text-[9px] text-[#98A2B3]">{subtitle}</p>}
          </div>
        </div>
        <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border" style={{ borderColor: active ? primary : "#D0D5DD" }}>
          {active && <div className="h-2 w-2 rounded-full" style={{ background: primary }} />}
        </div>
      </button>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full bg-[#FFFFFF]">
        {config.showTimer && (
          <div className="bg-[#F41F5E] px-4 py-3 text-center text-xs font-bold text-white">
            Oferta termina em: <span className="ml-1">{timerStr}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-[#EEF2F7] bg-[#FFFFFF] px-4 py-4">
          <div>
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="h-8 object-contain" />
            ) : (
              <span className="text-base font-semibold text-[#111827]">Minha Loja</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#16A34A]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Pagamento 100% seguro
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[980px] px-3 py-6 md:px-4">
        <div className="mb-5 hidden items-center justify-center gap-5 md:flex">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2" style={{ borderColor: primary, color: primary }}>
              <User className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold" style={{ color: primary }}>Identificação</span>
          </div>
          <div className="h-px w-12 bg-[#D0D5DD]" />
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#D0D5DD] text-[#98A2B3]">
              <CreditCard className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold text-[#98A2B3]">Pagamento</span>
          </div>
        </div>

        <div className="hidden gap-4 md:grid md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            {config.showAddress && (
              <div style={shellStyle} className="p-4">
                <h3 className="mb-3 text-[11px] font-semibold text-[#111827]">Endereço de Entrega</h3>
                <div className="space-y-3">
                  <input className={inputClass} placeholder="00000-000" />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} placeholder="Rua *" />
                    <input className={inputClass} placeholder="Número *" />
                  </div>
                  <input className={inputClass} placeholder="Complemento" />
                  <div className="grid grid-cols-3 gap-2">
                    <input className={inputClass} placeholder="Bairro *" />
                    <input className={inputClass} placeholder="Cidade *" />
                    <input className={inputClass} placeholder="ESTADO/UF *" />
                  </div>
                </div>
              </div>
            )}

            {config.showCpf && (
              <div style={shellStyle} className="p-4">
                <h3 className="mb-3 text-[11px] font-semibold text-[#111827]">CPF / CNPJ</h3>
                <input className={inputClass} placeholder="000.000.000-00" />
              </div>
            )}

            <div style={shellStyle} className="p-4">
              <h3 className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-[#111827]">
                <User className="h-3.5 w-3.5 text-[#667085]" />
                Informações de Contato
              </h3>
              <div className="space-y-3">
                <input className={inputClass} placeholder="Nome completo *" />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} placeholder="E-mail *" />
                  <input className={inputClass} placeholder="Telefone *" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <SummaryContent />

            <div style={shellStyle} className="p-4">
              <h3 className="mb-3 text-[11px] font-semibold text-[#111827]">Forma de pagamento</h3>

              {config.pix && (
                <PaymentOption
                  active={selectedPayment === "pix"}
                  icon={<QrCode className="h-4 w-4" />}
                  title="Pix"
                  subtitle="Pague em até 24 horas e obtenha confirmação instantânea."
                  onClick={() => setSelectedPayment("pix")}
                />
              )}

              {config.creditCard && (
                <div className="mt-2">
                  <PaymentOption
                    active={selectedPayment === "credit"}
                    icon={<CreditCard className="h-4 w-4" />}
                    title="Cartão de crédito"
                    subtitle="Pague em até 12 parcelas"
                    onClick={() => setSelectedPayment("credit")}
                  >
                    {selectedPayment === "credit" && (
                      <div className="mt-3 space-y-2 border-t border-[#EEF2F7] pt-3">
                        <div className="flex gap-1">
                          {[
                            { label: "Visa", color: "#F97316" },
                            { label: "MC", color: "#3B82F6" },
                            { label: "Amex", color: "#60A5FA" },
                          ].map((brand) => (
                            <span key={brand.label} className="rounded px-1.5 py-0.5 text-[8px] font-semibold text-white" style={{ background: brand.color }}>
                              {brand.label}
                            </span>
                          ))}
                        </div>
                        <input className={inputClass} placeholder="Número do cartão *" />
                        <input className={inputClass} placeholder="Nome no cartão *" />
                        <div className="grid grid-cols-3 gap-2">
                          <input className={inputClass} placeholder="Mês" />
                          <input className={inputClass} placeholder="Ano" />
                          <input className={inputClass} placeholder="CVV *" />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-[#E5EAF3] px-3 py-2 text-[10px] text-[#475467]">
                          <span>1x de {formatCurrency(unitPrice)} (à vista)</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    )}
                  </PaymentOption>
                </div>
              )}

              <div className="mt-2">
                <PaymentOption
                  active={false}
                  icon={<div className="h-4 w-4 rounded-full bg-[#111827]" />}
                  title="Apple Pay"
                  onClick={() => undefined}
                />
              </div>

              {config.boleto && (
                <div className="mt-2">
                  <PaymentOption
                    active={selectedPayment === "boleto"}
                    icon={<FileText className="h-4 w-4" />}
                    title="Boleto"
                    subtitle="Pagamento via boleto bancário"
                    onClick={() => setSelectedPayment("boleto")}
                  />
                </div>
              )}

              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-bold text-white" style={{ background: primary }}>
                <Lock className="h-3.5 w-3.5" />
                Finalizar pedido • {formatCurrency(unitPrice)}
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[360px] space-y-3 md:hidden">
          {config.showTimer && <div className="h-px w-full bg-transparent" />}

          {config.showAddress && (
            <button style={shellStyle} className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[11px] font-medium text-[#667085]">
              <Plus className="h-3.5 w-3.5" />
              Adicionar endereço de entrega
            </button>
          )}

          {config.showCpf && (
            <button style={shellStyle} className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[11px] font-medium text-[#667085]">
              <Plus className="h-3.5 w-3.5" />
              Adicionar CPF
            </button>
          )}

          <div className="flex gap-0.5 px-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full" style={{ background: progressColors[i] }} />
            ))}
          </div>

          <SummaryContent compact />

          <div style={shellStyle} className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-[#111827]">
              <User className="h-3.5 w-3.5 text-[#667085]" />
              Informações de Contato
            </h3>
            <div className="space-y-3">
              <input className={inputClass} placeholder="Nome completo *" />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClass} placeholder="E-mail *" />
                <input className={inputClass} placeholder="Telefone *" />
              </div>
            </div>
          </div>

          <div style={shellStyle} className="p-4">
            <h3 className="mb-3 text-[11px] font-semibold text-[#111827]">Forma de pagamento</h3>

            {config.pix && (
              <PaymentOption
                active={selectedPayment === "pix"}
                icon={<QrCode className="h-4 w-4" />}
                title="Pix"
                subtitle="Pague em até 24 horas e obtenha confirmação instantânea."
                onClick={() => setSelectedPayment("pix")}
              />
            )}

            {config.creditCard && (
              <div className="mt-2">
                <PaymentOption
                  active={selectedPayment === "credit"}
                  icon={<CreditCard className="h-4 w-4" />}
                  title="Cartão de crédito"
                  subtitle="Pague em até 12 parcelas"
                  onClick={() => setSelectedPayment("credit")}
                >
                  {selectedPayment === "credit" && (
                    <div className="mt-3 space-y-2 border-t border-[#EEF2F7] pt-3">
                      <div className="flex gap-1">
                        {[
                          { label: "Visa", color: "#F97316" },
                          { label: "MC", color: "#3B82F6" },
                          { label: "Amex", color: "#60A5FA" },
                        ].map((brand) => (
                          <span key={brand.label} className="rounded px-1.5 py-0.5 text-[8px] font-semibold text-white" style={{ background: brand.color }}>
                            {brand.label}
                          </span>
                        ))}
                      </div>
                      <input className={inputClass} placeholder="Nome no cartão" />
                      <input className={inputClass} placeholder="CPF / CNPJ" />
                      <input className={inputClass} placeholder="Número do cartão" />
                      <div className="grid grid-cols-3 gap-2">
                        <input className={inputClass} placeholder="Mês" />
                        <input className={inputClass} placeholder="Ano" />
                        <input className={inputClass} placeholder="CVV *" />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-[#E5EAF3] px-3 py-2 text-[10px] text-[#475467]">
                        <span>1x de {formatCurrency(unitPrice)} (à vista)</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  )}
                </PaymentOption>
              </div>
            )}

            <div className="mt-2">
              <PaymentOption
                active={false}
                icon={<div className="h-4 w-4 rounded-full bg-[#111827]" />}
                title="Apple Pay"
                onClick={() => undefined}
              />
            </div>

            {config.boleto && (
              <div className="mt-2">
                <PaymentOption
                  active={selectedPayment === "boleto"}
                  icon={<FileText className="h-4 w-4" />}
                  title="Boleto"
                  onClick={() => setSelectedPayment("boleto")}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}