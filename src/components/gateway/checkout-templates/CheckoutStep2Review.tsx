import { Lock } from "lucide-react";
import { formatCurrency } from "@/pages/gateway/mock-data";
import { cardStyle, buttonStyle, getCheckoutStyles } from "./checkout-style-helpers";

interface Props {
  config: Record<string, any>;
  formName: string;
  formEmail: string;
  formCpf: string;
  formPhone: string;
  totalPrice: number;
  onBack: () => void;
  onConfirm: () => void;
}

export default function CheckoutStep2Review({ config, formName, formEmail, formCpf, formPhone, totalPrice, onBack, onConfirm }: Props) {
  const s = getCheckoutStyles(config);

  const rows = [
    { label: "Nome", value: formName },
    { label: "E-mail", value: formEmail },
    { label: "CPF / CNPJ", value: formCpf },
    ...(config.showPhone ? [{ label: "Celular", value: formPhone }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-5 space-y-4" style={cardStyle(s)}>
        <div>
          <h3 className="text-sm font-bold" style={{ color: s.cardTitle }}>Confira seus dados</h3>
          <p className="text-xs mt-0.5" style={{ color: s.cardDesc }}>
            Verifique se as informações estão corretas antes de prosseguir.
          </p>
        </div>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b" style={{ borderColor: s.cardBorder }}>
              <span className="text-xs font-medium" style={{ color: s.cardLabel }}>{row.label}</span>
              <span className="text-sm font-semibold" style={{ color: s.cardTitle }}>{row.value || "—"}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-2">
            <span className="text-xs font-medium" style={{ color: s.cardLabel }}>Valor total</span>
            <span className="text-base font-bold" style={{ color: s.primary }}>{formatCurrency(totalPrice)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 font-bold text-sm flex items-center justify-center gap-2 border"
          style={{ borderColor: s.cardBorder, background: s.cardBg, color: s.cardTitle, borderRadius: s.buttonRadius }}
        >
          Voltar
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3.5 font-bold text-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
          style={buttonStyle(s)}
        >
          <Lock className="w-4 h-4" />
          Confirmar e Pagar
        </button>
      </div>
    </div>
  );
}
