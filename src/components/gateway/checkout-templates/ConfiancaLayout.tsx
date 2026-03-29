import { useState } from "react";
import { Lock, ShieldCheck, CreditCard, Package, Truck, User, Minus, Plus, Trash2, ChevronDown, Star, Zap } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { PixIcon, CardBrandsRow, BoletoIcon, PaymentFooter } from "./PaymentIcons";

interface Props {
  config: Record<string, any>;
}

const FAQ_ITEMS = [
  { q: "Quais formas de pagamento são aceitas?", a: "Aceitamos Pix, cartão de crédito (Visa, Mastercard, Elo, Amex) e boleto bancário." },
  { q: "Posso parcelar minha compra?", a: "Sim! Parcele em até 12x sem juros no cartão de crédito." },
  { q: "Recebo confirmação após o pagamento?", a: "Sim, você receberá um e-mail e mensagem no WhatsApp com a confirmação." },
  { q: "Qual o prazo de entrega?", a: "Enviamos em até 24 horas após a confirmação do pagamento." },
];

export default function ConfiancaLayout({ config }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const primary = config.primaryColor || "#7AC800";
  const bgColor = config.bgColor || "#C8E832";
  const unitPrice = config.price || 9900;
  const subtotal = unitPrice * quantity;

  const inputClass = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-md outline-none bg-white text-gray-800 placeholder:text-gray-400 focus:border-gray-400 transition-colors";
  const labelClass = "text-xs font-medium text-gray-600 block mb-1.5";

  return (
    <div className="h-full overflow-auto" style={{ fontFamily: "'Inter', sans-serif", color: "#1A1A1A" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <span className="text-sm font-bold text-gray-900">
          {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-7 object-contain" /> : "Minha Loja"}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#16A34A" }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          Pagamento 100% Seguro
        </span>
      </div>

      {/* ── Banner area (lime green) ── */}
      <div className="w-full py-8 px-6 flex items-center justify-center" style={{ background: bgColor }}>
        {config.productImage ? (
          <img src={config.productImage} alt="" className="max-h-40 object-contain rounded-xl" />
        ) : (
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "#1A1A1A" }}>Revele sua <em className="font-extrabold not-italic">beleza interior</em></p>
            <p className="text-lg font-bold" style={{ color: "#1A1A1A" }}>e exterior.</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-white/80 rounded-full px-4 py-1.5">
              <ShieldCheck className="w-4 h-4" style={{ color: primary }} />
              <span className="text-xs font-semibold">Compra segura.</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Step indicators ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-center gap-10 py-3 mx-auto" style={{ maxWidth: "700px" }}>
          {[
            { icon: User, label: "Identificação", active: true },
            { icon: Truck, label: "Endereço", active: false },
            { icon: CreditCard, label: "Pagamento", active: false },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: s.active ? `${primary}20` : "#F3F4F6", border: s.active ? `2px solid ${primary}` : "2px solid transparent" }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.active ? primary : "#9CA3AF" }} />
              </div>
              <span className="text-[10px] font-semibold" style={{ color: s.active ? primary : "#9CA3AF" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto px-3 py-6" style={{ maxWidth: "960px", background: "#FAFAFA" }}>
        <div className="flex flex-col lg:flex-row gap-5">

          {/* ═══ LEFT: Form ═══ */}
          <div className="flex-1 space-y-4">

            {/* Dados pessoais */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Dados pessoais</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Utilizaremos seu e-mail para identificar seu perfil, histórico de compra, verificação de pedidos e carrinho de compras.
                </p>
              </div>
              <div>
                <label className={labelClass}>Nome completo</label>
                <input className={inputClass} placeholder="Ex.: Maria da Silva" />
              </div>
              <div>
                <label className={labelClass}>E-mail</label>
                <input className={inputClass} placeholder="Ex.: maria@email.com" />
              </div>
              {config.showCpf && (
                <div>
                  <label className={labelClass}>CPF</label>
                  <input className={inputClass} placeholder="000.000.000-00" />
                </div>
              )}
              {config.showPhone && (
                <div>
                  <label className={labelClass}>Celular / WhatsApp</label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-2.5 py-2 border border-gray-200 rounded-md text-xs text-gray-500 bg-gray-50">+55</span>
                    <input className={`${inputClass} flex-1`} placeholder="(00) 00000-0000" />
                  </div>
                </div>
              )}

              <button
                className="w-full py-3 font-bold text-sm rounded-lg transition-transform hover:scale-[1.01]"
                style={{ background: primary, color: "#FFFFFF" }}
              >
                Ir para Entrega
              </button>
            </div>

            {/* FAQ */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h3 className="text-sm font-bold text-gray-900 mb-2" style={{ color: primary }}>Perguntas Frequentes</h3>
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="border-b border-gray-100 last:border-0">
                  <button
                    className="w-full flex items-center justify-between py-3 text-left"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="text-xs font-medium text-gray-700">{item.q}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <p className="text-xs text-gray-500 pb-3 leading-relaxed">{item.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ═══ RIGHT: Sidebar ═══ */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4">

            {/* Resumo do pedido */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Resumo do pedido</h3>

              {/* Product */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {config.productImage ? (
                    <img src={config.productImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <p className="text-xs font-bold" style={{ color: primary }}>{formatCurrency(unitPrice)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center">
                    <Minus className="w-3 h-3 text-gray-400" />
                  </button>
                  <span className="text-xs font-medium text-gray-700 w-4 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center">
                    <Plus className="w-3 h-3 text-gray-400" />
                  </button>
                  <button className="w-5 h-5 flex items-center justify-center text-red-400 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Coupon */}
              <div className="flex gap-2">
                <input className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md outline-none placeholder:text-gray-400" placeholder="Cupom de desconto" />
                <button className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50">
                  Aplicar
                </button>
              </div>

              {/* Totals */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-800 font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Frete</span>
                  <span className="font-medium" style={{ color: "#16A34A" }}>Grátis</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                  <span className="text-gray-900">Total</span>
                  <span style={{ color: primary }}>{formatCurrency(subtotal)}</span>
                </div>
              </div>
            </div>

            {/* Testimonials */}
            {[
              { name: "Mariana Lopes", text: "Atendimento excelente e tudo chegou perfeito. Recomendo!" },
              { name: "Ana Paula", text: "Produto de ótima qualidade e entrega super rápida. Amei!" },
            ].map((t, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-500" />
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <p className="text-xs font-bold text-gray-900">{t.name}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{t.text}</p>
              </div>
            ))}

            {/* Shipping & Security info */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: primary }}>Frete Grátis</p>
                  <p className="text-[10px] text-gray-500">Para todo o Brasil em compras acima de R$ 199</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: primary }}>Compra Segura</p>
                  <p className="text-[10px] text-gray-500">Seus dados protegidos e pagamento seguro</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-yellow-50 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-3.5 h-3.5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: primary }}>Entrega Rápida</p>
                  <p className="text-[10px] text-gray-500">Enviamos em até 24 horas após a confirmação</p>
                </div>
              </div>
            </div>

            {/* Guarantee */}
            {config.showGuarantee && (
              <div className="rounded-xl border-2 border-dashed p-4 text-center" style={{ borderColor: primary, background: `${primary}10` }}>
                <ShieldCheck className="w-6 h-6 mx-auto mb-1" style={{ color: primary }} />
                <p className="text-xs font-bold" style={{ color: primary }}>Garantia de {config.guaranteeDays || 30} dias</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Satisfação garantida ou seu dinheiro de volta</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <PaymentFooter />
    </div>
  );
}
