import { useLocation } from "react-router-dom";

export default function WhatsAppFloatingButton() {
  const location = useLocation();

  // Hide on public checkout/invite/redirect pages
  if (
    location.pathname.startsWith('/pay/') ||
    location.pathname.startsWith('/invite/') ||
    location.pathname === '/r' ||
    location.pathname.startsWith('/r/')
  ) {
    return null;
  }

  return (
    <a
      href="https://wa.me/556195225927"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:scale-110 transition-transform"
      title="Fale conosco no WhatsApp"
    >
      <svg viewBox="0 0 32 32" className="w-7 h-7 fill-current">
        <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.128 6.744 3.046 9.378L1.054 31.29l6.118-1.96A15.93 15.93 0 0016.004 32C24.826 32 32 24.826 32 16.004 32 7.176 24.826 0 16.004 0zm9.35 22.606c-.392 1.104-1.942 2.02-3.164 2.288-.836.178-1.928.32-5.604-1.204-4.702-1.948-7.726-6.716-7.96-7.028-.226-.312-1.89-2.52-1.89-4.808 0-2.288 1.196-3.412 1.62-3.878.392-.432 1.038-.626 1.654-.626.2 0 .38.01.54.018.468.02.702.048 1.01.782.384.918 1.322 3.222 1.436 3.456.116.234.232.546.076.858-.148.32-.278.518-.512.796-.234.278-.458.492-.692.79-.214.26-.456.538-.194.97.262.432 1.166 1.924 2.504 3.118 1.72 1.534 3.168 2.01 3.618 2.234.33.164.722.134.994-.154.346-.37.774-.982 1.21-1.588.31-.432.702-.486 1.068-.33.37.148 2.344 1.106 2.744 1.306.4.2.668.3.768.468.098.168.098.968-.294 2.072z"/>
      </svg>
    </a>
  );
}
