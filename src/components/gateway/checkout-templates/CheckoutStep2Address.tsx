import { MapPin } from "lucide-react";
import { cardStyle, buttonStyle, inputStyle, getCheckoutStyles, stepStyle } from "./checkout-style-helpers";

interface Props {
  config: Record<string, any>;
  onBack: () => void;
  onNext: () => void;
}

export default function CheckoutStep2Address({ config, onBack, onNext }: Props) {
  const s = getCheckoutStyles(config);

  return (
    <div className="space-y-4">
      <div className="border p-5 space-y-4" style={cardStyle(s)}>
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: s.cardTitle }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={stepStyle(s)}>2</div>
            Endereço de Entrega
          </h3>
          <p className="text-xs mt-1 ml-7" style={{ color: s.cardDesc }}>
            Informe o endereço para envio do seu pedido.
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>CEP <span style={{ color: '#EF4444' }}>*</span></label>
            <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="00000-000" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Rua / Avenida</label>
            <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Rua / Avenida" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Nº</label>
              <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Nº" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Complemento</label>
              <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Complemento" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Bairro</label>
            <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Bairro" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Cidade</label>
              <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Cidade" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: s.cardLabel }}>Estado</label>
              <input className="w-full px-3 py-2.5 text-sm border outline-none placeholder:text-gray-400" style={inputStyle(s)} placeholder="Estado" />
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
            onClick={onNext}
            className="flex-1 py-3.5 font-bold text-sm transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
            style={buttonStyle(s)}
          >
            PRÓXIMO
          </button>
        </div>
      </div>
    </div>
  );
}
