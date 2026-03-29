import { useState, useEffect } from "react";
import { ShieldCheck, Lock, Package, CreditCard, Truck, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";

interface MinimalistaConfig {
  productName: string;
  offerName: string;
  price: number;
  originalPrice: number;
  buttonText: string;
  showTimer: boolean;
  timerMinutes: number;
  primaryColor: string;
  bgColor: string;
  textColor: string;
  showCpf: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showBirthdate: boolean;
  productImage?: string;
  logoUrl?: string;
  [key: string]: any;
}

interface Props {
  config: MinimalistaConfig;
}

export default function MinimalistaLayout({ config }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countdown, setCountdown] = useState({ m: config.timerMinutes || 9, s: 0 });

  useEffect(() => {
    if (!config.showTimer) return;
    setCountdown({ m: config.timerMinutes || 9, s: 0 });
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

  const primary = config.primaryColor || "#1A1A1A";
  const timerStr = `${String(0).padStart(2, "0")}h : ${String(countdown.m).padStart(2, "0")}m : ${String(countdown.s).padStart(2, "0")}s`;

  const steps = [
    { num: 1, label: "Identificação", icon: <ShoppingBag className="w-4 h-4" /> },
    { num: 2, label: "Entrega", icon: <Truck className="w-4 h-4" /> },
    { num: 3, label: "Pagamento", icon: <CreditCard className="w-4 h-4" /> },
  ];

  const unitPrice = config.price;
  const frete = 1500;

  const inputClass = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-md outline-none bg-white text-gray-800 placeholder:text-gray-400 focus:border-gray-400 transition-colors";

  return (
    <div className="h-full overflow-auto" style={{ background: "#F5F7FA", fontFamily: "'Inter', sans-serif", color: "#1A1A1A" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <span className="text-sm font-bold text-gray-900">
          {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="h-6 object-contain" /> : "Minha Loja"}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
          <Lock className="w-3 h-3" />
          PAGAMENTO 100% SEGURO
        </span>
      </div>

      {/* Countdown */}
      {config.showTimer && (
        <div className="w-full text-center py-2.5 text-sm font-medium" style={{ background: "#1A1A1A", color: "#FFFFFF" }}>
          Oferta termina em:{" "}
          <span className="font-bold tracking-wide">{timerStr}</span>
        </div>
      )}

      {/* Desktop: 2 columns / Mobile: 1 column */}
      <div className="mx-auto px-3 py-6" style={{ maxWidth: "900px" }}>
        <div className="flex flex-col md:flex-row gap-6">
          {/* LEFT: Steps + Form */}
          <div className="flex-1 space-y-5">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2">
              {steps.map((s, i) => (
                <div key={s.num} className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(s.num as 1 | 2 | 3)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: step === s.num ? `${primary}15` : "transparent",
                      color: step === s.num ? primary : "#9CA3AF",
                      border: step === s.num ? `1.5px solid ${primary}` : "1.5px solid transparent",
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: step === s.num ? primary : "#E5E7EB",
                        color: step === s.num ? "#fff" : "#9CA3AF",
                      }}
                    >
                      {s.num}
                    </div>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < steps.length - 1 && <div className="w-6 h-[1.5px] bg-gray-200 rounded" />}
                </div>
              ))}
            </div>

            {/* Step 1: Identificação */}
            {step === 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-bold">1</div>
                    Identificação
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 ml-7">
                    Preencha as informações essenciais para concluir sua compra com segurança.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Nome completo</label>
                    <input className={inputClass} placeholder="Digite seu nome completo" />
                  </div>
                  {config.showCpf && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">CPF ou CNPJ</label>
                      <input className={inputClass} placeholder="000.000.000-00" />
                    </div>
                  )}
                  {config.showPhone && (
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Celular (WhatsApp)</label>
                      <input className={inputClass} placeholder="+55 (00) 00000-0000" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">E-mail</label>
                    <input className={inputClass} placeholder="seu@email.com" />
                  </div>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3.5 font-bold text-sm rounded-md transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
                  style={{ background: primary, color: "#FFFFFF" }}
                >
                  PRÓXIMO
                </button>
              </div>
            )}

            {/* Step 2: Entrega */}
            {step === 2 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-bold">2</div>
                    Entrega
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 ml-7">
                    Para realizar o frete é necessário preencher todos os campos abaixo.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">CEP</label>
                    <input className={inputClass} placeholder="00000-000" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Cidade</label>
                      <input className={inputClass} placeholder="Sua cidade" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Estado</label>
                      <input className={inputClass} placeholder="UF" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Endereço</label>
                    <input className={inputClass} placeholder="Rua, número" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Complemento</label>
                    <input className={inputClass} placeholder="Apto, bloco (opcional)" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 text-sm font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                    Voltar
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="flex-1 py-3 font-bold text-sm rounded-md"
                    style={{ background: primary, color: "#FFFFFF" }}
                  >
                    PRÓXIMO
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Pagamento */}
            {step === 3 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-bold">3</div>
                    Pagamento
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 ml-7">
                    Complete as etapas anteriores para prosseguir!
                  </p>
                </div>
                <div className="space-y-2">
                  {config.pix && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-900 bg-gray-50 cursor-pointer">
                      <div className="w-5 h-5 rounded-full border-2 border-gray-900 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-gray-900" />
                      </div>
                      <span className="text-sm font-medium">PIX — Aprovação instantânea</span>
                    </div>
                  )}
                  {config.creditCard && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                      <span className="text-sm text-gray-600">Cartão de Crédito</span>
                    </div>
                  )}
                  {config.boleto && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                      <span className="text-sm text-gray-600">Boleto</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(2)} className="flex-1 py-3 text-sm font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                    Voltar
                  </button>
                  <button className="flex-1 py-3 font-bold text-sm rounded-md flex items-center justify-center gap-2" style={{ background: primary, color: "#FFFFFF" }}>
                    <Lock className="w-3.5 h-3.5" />
                    FINALIZAR PEDIDO
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Summary sidebar */}
          <div className="w-full md:w-60 flex-shrink-0 space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Resumo ({1})</h4>
              </div>
              <div className="text-xs text-gray-500">Tem um cupom?</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md outline-none placeholder:text-gray-400"
                  placeholder="Código do cupom"
                />
                <button className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50">
                  Aplicar
                </button>
              </div>
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Produtos</span>
                  <span className="text-gray-800 font-medium">{formatCurrency(unitPrice)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Frete</span>
                  <span className="text-gray-800 font-medium">+ {formatCurrency(frete)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
                  <span className="text-green-600">Total</span>
                  <span className="text-green-600">{formatCurrency(unitPrice + frete)}</span>
                </div>
              </div>
            </div>

            {/* Product */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {config.productImage ? (
                    <img src={config.productImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900">{config.offerName || config.productName || "Produto Exemplo"}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(unitPrice)}</p>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
              <p className="text-xs font-semibold text-gray-800">Atenção</p>
              <p className="text-xs text-gray-600 mt-0.5">Não perca essa oportunidade!</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <ShoppingBag className="w-4 h-4 text-green-600" />
                <span className="text-lg font-extrabold text-green-600">55 Compras</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] text-gray-400 py-4">
        Formas de Pagamento
      </p>
    </div>
  );
}