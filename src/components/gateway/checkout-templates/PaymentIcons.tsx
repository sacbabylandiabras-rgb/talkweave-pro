/** Shared payment method SVG icons & footer for all checkout templates */

// Pix logo (teal diamond)
export const PixIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.4 22.2a5.54 5.54 0 0 1-3.93-1.63l-2.46-2.46-2.46 2.46A5.54 5.54 0 0 1 9.62 22.2H8.8l4.88 4.88a5.38 5.38 0 0 0 7.64 0l4.88-4.88h-3.8z" fill="#32BCAD"/>
    <path d="M9.62 9.8a5.54 5.54 0 0 1 3.93 1.63l2.46 2.46 2.46-2.46a5.54 5.54 0 0 1 3.93-1.63h3.8l-4.88-4.88a5.38 5.38 0 0 0-7.64 0L8.8 9.8h.82z" fill="#32BCAD"/>
    <path d="M27.08 13.32l-2.62-2.62c-.1.03-.2.05-.3.05h-1.76c-1.1 0-2.16.44-2.94 1.22l-2.46 2.46a1.76 1.76 0 0 1-2.5 0l-2.46-2.46a4.16 4.16 0 0 0-2.94-1.22H8.28c-.1 0-.2-.02-.3-.05l-2.62 2.62a5.38 5.38 0 0 0 0 7.64l2.62 2.62c.1-.03.2-.05.3-.05h.82c1.1 0 2.16-.44 2.94-1.22l2.46-2.46a1.76 1.76 0 0 1 2.5 0l2.46 2.46a4.16 4.16 0 0 0 2.94 1.22h1.76c.1 0 .2.02.3.05l2.62-2.62a5.38 5.38 0 0 0 0-7.64z" fill="#32BCAD"/>
  </svg>
);

// Mastercard logo
export const MastercardIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size * 0.62} viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="30" rx="4" fill="#fff" stroke="#E5E7EB" strokeWidth="0.5"/>
    <circle cx="18" cy="15" r="9" fill="#EB001B"/>
    <circle cx="30" cy="15" r="9" fill="#F79E1B"/>
    <path d="M24 8.34A8.97 8.97 0 0 1 27 15a8.97 8.97 0 0 1-3 6.66A8.97 8.97 0 0 1 21 15a8.97 8.97 0 0 1 3-6.66z" fill="#FF5F00"/>
  </svg>
);

// Visa logo
export const VisaIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size * 0.62} viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="30" rx="4" fill="#fff" stroke="#E5E7EB" strokeWidth="0.5"/>
    <path d="M20.3 19.5h-2.8l1.8-10.5h2.8l-1.8 10.5zm-4.6-10.5l-2.6 7.2-.3-1.5-.9-4.6s-.1-1.1-1.4-1.1H6.1l-.1.3s1.5.3 3.2 1.4l2.6 9.8h2.9l4.4-11.5H15.7zm22.1 10.5h2.6l-2.2-10.5h-2.3c-1 0-1.6.6-1.6.6l-4.2 9.9h2.9l.6-1.6h3.6l.6 1.6zm-3.1-3.8l1.5-4 .8 4h-2.3zM31 12l.4-2.3s-1.2-.5-2.5-.5c-1.4 0-4.6.6-4.6 3.5 0 2.7 3.8 2.7 3.8 4.1s-3.4 1.2-4.5.3l-.4 2.4s1.2.6 3 .6c1.9 0 4.8-.9 4.8-3.6 0-2.7-3.9-3-3.9-4.1 0-1.2 2.7-1 3.9-.4z" fill="#1A1F71"/>
  </svg>
);

// Elo logo
export const EloIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size * 0.62} viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="30" rx="4" fill="#fff" stroke="#E5E7EB" strokeWidth="0.5"/>
    <circle cx="16" cy="13" r="4" fill="#FFC72C"/>
    <circle cx="26" cy="13" r="4" fill="#00A4E0"/>
    <circle cx="21" cy="19" r="4" fill="#EF4123"/>
    <text x="13" y="26" fontSize="5" fontWeight="bold" fill="#000" fontFamily="sans-serif">elo</text>
  </svg>
);

// Amex / Hipercard placeholder
export const AmexIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size * 0.62} viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="30" rx="4" fill="#fff" stroke="#E5E7EB" strokeWidth="0.5"/>
    <text x="24" y="18" fontSize="7" fontWeight="bold" fill="#2E77BC" textAnchor="middle" fontFamily="sans-serif">AMEX</text>
  </svg>
);

// Apple Pay icon
export const ApplePayIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.65-2.2.46-3.06-.4C3.79 16.17 4.36 9.04 8.93 8.78c1.27.07 2.15.72 2.88.76.97-.2 1.9-.74 2.93-.67 1.24.1 2.18.58 2.79 1.46-2.55 1.55-1.95 4.96.5 5.92-.6 1.57-1.37 3.13-2.98 4.03zM12.12 8.7c-.15-2.34 1.82-4.35 4.01-4.55.3 2.64-2.37 4.62-4.01 4.55z"/>
  </svg>
);

// Boleto barcode icon
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
export const PaymentFooter = () => (
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
      Pagamento processado com segurança por ZapLynxPay
    </p>
  </div>
);
