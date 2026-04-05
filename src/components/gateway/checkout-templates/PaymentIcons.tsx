/** Shared payment method icons & footer for all checkout templates */
import pixLogo from "@/assets/payment/pix.png";
import mastercardLogo from "@/assets/payment/mastercard.png";
import visaLogo from "@/assets/payment/visa.png";
import eloLogo from "@/assets/payment/elo.jpg";
import amexLogo from "@/assets/payment/amex.png";

// Pix logo
export const PixIcon = ({ size = 20 }: { size?: number }) => (
  <img src={pixLogo} alt="Pix" width={size} height={size} className="object-contain" />
);

// Mastercard logo
export const MastercardIcon = ({ size = 28 }: { size?: number }) => (
  <img src={mastercardLogo} alt="Mastercard" height={size * 0.62} style={{ height: size * 0.62 }} className="object-contain" />
);

// Visa logo
export const VisaIcon = ({ size = 28 }: { size?: number }) => (
  <img src={visaLogo} alt="Visa" height={size * 0.62} style={{ height: size * 0.62 }} className="object-contain" />
);

// Elo logo
export const EloIcon = ({ size = 28 }: { size?: number }) => (
  <img src={eloLogo} alt="Elo" height={size * 0.62} style={{ height: size * 0.62 }} className="object-contain" />
);

// Amex logo
export const AmexIcon = ({ size = 28 }: { size?: number }) => (
  <img src={amexLogo} alt="Amex" height={size * 0.62} style={{ height: size * 0.62, borderRadius: 3 }} className="object-contain" />
);

// Boleto barcode icon (kept as SVG — no official logo needed)
export const BoletoIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="20" height="16" rx="2" fill="none"/>
    <line x1="6" y1="8" x2="6" y2="16"/>
    <line x1="8" y1="8" x2="8" y2="16"/>
    <line x1="11" y1="8" x2="11" y2="16"/>
    <line x1="13" y1="8" x2="13" y2="16"/>
    <line x1="15" y1="8" x2="15" y2="16"/>
    <line x1="18" y1="8" x2="18" y2="16"/>
  </svg>
);

// Apple Pay icon (kept as SVG)
export const ApplePayIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.65-2.2.46-3.06-.4C3.79 16.17 4.36 9.04 8.93 8.78c1.27.07 2.15.72 2.88.76.97-.2 1.9-.74 2.93-.67 1.24.1 2.18.58 2.79 1.46-2.55 1.55-1.95 4.96.5 5.92-.6 1.57-1.37 3.13-2.98 4.03zM12.12 8.7c-.15-2.34 1.82-4.35 4.01-4.55.3 2.64-2.37 4.62-4.01 4.55z"/>
  </svg>
);

/** Card brand row: Mastercard, Visa, Elo, Amex */
export const CardBrandsRow = ({ size = 28 }: { size?: number }) => (
  <div className="flex items-center gap-1">
    <MastercardIcon size={size} />
    <VisaIcon size={size} />
    <EloIcon size={size} />
    <AmexIcon size={size} />
  </div>
);

/** Footer with all payment method icons */
export const PaymentFooter = ({ companyName, cnpj }: { companyName?: string; cnpj?: string } = {}) => (
  <div className="py-4 space-y-2">
    <p className="text-center text-[10px] text-[#9CA3AF] font-medium">Formas de Pagamento</p>
    <div className="flex items-center justify-center gap-2">
      <PixIcon size={18} />
      <MastercardIcon size={26} />
      <VisaIcon size={26} />
      <EloIcon size={26} />
      <AmexIcon size={26} />
      <div className="text-[#6B7280]"><BoletoIcon size={18} /></div>
    </div>
    <p className="text-center text-[10px] text-[#9CA3AF]">
      Pagamento processado com segurança por {companyName || "ZapLynxPay"}
    </p>
    {cnpj && (
      <p className="text-center text-[10px] text-[#9CA3AF]">
        CNPJ: {cnpj}
      </p>
    )}
  </div>
);
