import { useState, useEffect } from "react";
import { CheckoutElement, ELEMENT_DEFINITIONS } from "./types";
import { Shield, Clock, Star, ThumbsUp, ChevronDown, ChevronUp, TrendingUp, BarChart3, CheckCircle, Truck, Package, CreditCard, Heart, Award, Zap, Gift, ShoppingCart, RefreshCw, Headphones, icons } from "lucide-react";

function getVideoEmbedUrl(url: string): string {
  if (!url) return "";
  // YouTube: watch?v=ID or youtu.be/ID or shorts/ID
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
  // Vturb: extract embed URL
  if (url.includes("vturb.com") || url.includes("vturb.com.br")) {
    // If already an embed URL, use as-is
    if (url.includes("/embed/") || url.includes("player.vturb")) return url;
    // Try to extract video ID from various vturb formats
    const vturbMatch = url.match(/vturb\.com(?:\.br)?\/(?:v|video)\/([a-zA-Z0-9]+)/);
    if (vturbMatch) return `https://player.vturb.com.br/embed/${vturbMatch[1]}`;
    return url; // fallback: use as-is
  }
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Already an embed or unknown - use as-is
  return url;
}

interface Props {
  element: CheckoutElement;
  primaryColor: string;
  textColor: string;
  cardBg: string;
  cardBorder: string;
  isBuilder?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function CheckoutElementRenderer({ element, primaryColor, textColor, cardBg, cardBorder, isBuilder, onClick, isSelected }: Props) {
  if (!element.visible) return null;

  const c = element.content;
  const wrapperStyle: React.CSSProperties = {
    cursor: isBuilder ? "pointer" : undefined,
    outline: isSelected ? `2px solid #FF4D2E` : isBuilder ? "2px dashed transparent" : "none",
    borderRadius: "12px",
    transition: "outline 0.15s",
  };
  const hoverClass = isBuilder ? "hover:outline-[#FF4D2E]/30 hover:outline-dashed" : "";

  switch (element.type) {
    case "text":
      return (
        <div style={{ ...wrapperStyle, padding: "8px 0" }} className={hoverClass} onClick={onClick}>
          <p style={{ fontSize: `${c.fontSize || 14}px`, fontWeight: c.fontWeight || "normal", textAlign: c.textAlign || "left", color: c.color || textColor }}>
            {c.text || "Seu texto aqui..."}
          </p>
        </div>
      );

    case "image":
      return (
        <div style={{ ...wrapperStyle }} className={hoverClass} onClick={onClick}>
          {c.url ? (
            <img src={c.url} alt={c.alt || ""} style={{ width: c.width || "100%", borderRadius: `${c.borderRadius || 8}px` }} />
          ) : (
            <div className="flex items-center justify-center border-2 border-dashed rounded-xl" style={{ height: "120px", borderColor: cardBorder, color: textColor + "80" }}>
              <span className="text-xs">Clique para adicionar imagem</span>
            </div>
          )}
        </div>
      );

    case "video":
      return (
        <div style={{ ...wrapperStyle }} className={hoverClass} onClick={onClick}>
          {c.url ? (
            <div className="relative w-full" style={{ paddingBottom: "56.25%", borderRadius: "12px", overflow: "hidden" }}>
              <iframe
                src={getVideoEmbedUrl(c.url)}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 0 }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center border-2 border-dashed rounded-xl" style={{ height: "160px", borderColor: cardBorder, color: textColor + "80" }}>
              <span className="text-xs">Cole o link do YouTube ou Vturb</span>
            </div>
          )}
        </div>
      );

    case "gallery":
      return (
        <div style={{ ...wrapperStyle }} className={hoverClass} onClick={onClick}>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${c.columns || 2}, 1fr)` }}>
            {(c.images && c.images.length > 0 ? c.images : [null, null, null, null]).map((img: string | null, i: number) => (
              <div key={i} className="rounded-lg overflow-hidden border" style={{ borderColor: cardBorder, aspectRatio: "1/1" }}>
                {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: cardBg, color: textColor + "40" }}>
                    <span className="text-[10px]">Img {i + 1}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case "faq":
      return <FaqElement content={c} primaryColor={primaryColor} textColor={textColor} cardBg={cardBg} cardBorder={cardBorder} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

    case "benefits":
      return <BenefitsElement content={c} primaryColor={primaryColor} textColor={textColor} cardBg={cardBg} cardBorder={cardBorder} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

    case "seal":
      return (
        <div style={{ ...wrapperStyle }} className={hoverClass} onClick={onClick}>
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl" style={{ background: `${primaryColor}10`, border: `1px solid ${primaryColor}30` }}>
            <Shield className="w-5 h-5" style={{ color: primaryColor }} />
            <span className="text-sm font-semibold" style={{ color: primaryColor }}>{c.text || "Compra 100% Segura"}</span>
          </div>
        </div>
      );

    case "testimonial":
      return (
        <div style={{ ...wrapperStyle }} className={hoverClass} onClick={onClick}>
          <div className="space-y-4">
            {(c.items || []).map((t: any, i: number) => (
              <div key={i} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "16px" }}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: `${primaryColor}20` }}>
                    {t.avatar ? (
                      <img src={t.avatar} className="w-full h-full object-cover" alt={t.name || ""} />
                    ) : (
                      <span className="text-sm font-bold" style={{ color: primaryColor }}>{t.name?.[0] || "?"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-semibold" style={{ color: textColor }}>{t.name || "Anônimo"}</p>
                      {t.timeAgo && <span className="text-[10px] shrink-0" style={{ color: textColor + "80" }}>{t.timeAgo}</span>}
                    </div>
                    <div className="flex items-center gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="w-3.5 h-3.5" style={{ fill: j < (t.rating || 5) ? "#FACC15" : "#D1D5DB", color: j < (t.rating || 5) ? "#FACC15" : "#D1D5DB" }} />
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: textColor + "CC" }}>{t.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "reviews":
      return <ReviewsElement content={c} primaryColor={primaryColor} textColor={textColor} cardBg={cardBg} cardBorder={cardBorder} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

    case "guarantee":
      return (
        <div style={{ ...wrapperStyle, background: cardBg, border: `2px dashed ${primaryColor}40`, borderRadius: "12px", padding: "16px" }} className={hoverClass} onClick={onClick}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: `${primaryColor}15` }}>
              <Clock className="w-6 h-6" style={{ color: primaryColor }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: textColor }}>Garantia de {c.days || 7} dias</p>
              <p className="text-xs mt-0.5" style={{ color: textColor + "99" }}>
                {(c.text || "Garantia incondicional de {days} dias.").replace("{days}", String(c.days || 7))}
              </p>
            </div>
          </div>
        </div>
      );

    case "countdown":
      return <CountdownElement content={c} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

    case "list":
      return (
        <div style={{ ...wrapperStyle, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "16px" }} className={hoverClass} onClick={onClick}>
          <h4 className="text-sm font-bold mb-3" style={{ color: textColor }}>{c.title || "O que você vai receber:"}</h4>
          <div className="space-y-2.5">
            {(c.items || []).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="text-base">{item.icon || "✅"}</span>
                <span className="text-sm" style={{ color: textColor }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "progress":
      return (
        <div style={{ ...wrapperStyle, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "16px" }} className={hoverClass} onClick={onClick}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: textColor }}>{(c.text || "").replace("{count}", String(c.percentage || 73))}</span>
            <span className="text-xs font-bold" style={{ color: c.color || primaryColor }}>{c.percentage || 73}%</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: cardBorder }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${c.percentage || 73}%`, background: c.color || primaryColor }} />
          </div>
        </div>
      );

    case "sales":
      return <SalesElement content={c} primaryColor={primaryColor} textColor={textColor} cardBg={cardBg} cardBorder={cardBorder} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

    default:
      return null;
  }
}

// Sub-components with state

function FaqElement({ content, primaryColor, textColor, cardBg, cardBorder, wrapperStyle, hoverClass, onClick }: any) {
  const [openIdx, setOpenIdx] = useState<Set<number>>(new Set(content.items?.map((_: any, i: number) => i) || []));
  const toggle = (i: number) => {
    setOpenIdx(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };
  return (
    <div style={{ ...wrapperStyle, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "16px" }} className={hoverClass} onClick={onClick}>
      <h4 className="text-sm font-bold mb-1" style={{ color: textColor }}>{content.title || "FAQ"}</h4>
      {content.description && <p className="text-xs mb-3" style={{ color: textColor + "80" }}>{content.description}</p>}
      <div className="space-y-2">
        {(content.items || []).map((item: any, i: number) => (
          <div key={i} className="border-t" style={{ borderColor: cardBorder }}>
            <button
              className="w-full flex items-center justify-between py-3 text-left"
              style={{ color: textColor }}
              onClick={(e) => { e.stopPropagation(); toggle(i); }}
            >
              <span className="text-xs font-semibold">{item.question}</span>
              {openIdx.has(i) ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </button>
            {openIdx.has(i) && (
              <div className="pb-3">
                <p className="text-xs" style={{ color: textColor + "80" }}>{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CountdownElement({ content, wrapperStyle, hoverClass, onClick }: any) {
  const [time, setTime] = useState({ m: content.minutes || 15, s: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(prev => {
        if (prev.m === 0 && prev.s === 0) return prev;
        if (prev.s === 0) return { m: prev.m - 1, s: 59 };
        return { ...prev, s: prev.s - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{ ...wrapperStyle, background: content.bgColor || "#EF4444", borderRadius: "12px", padding: "12px 16px" }}
      className={hoverClass}
      onClick={onClick}
    >
      <div className="flex items-center justify-center gap-2" style={{ color: content.textColor || "#FFFFFF" }}>
        <Clock className="w-4 h-4" />
        <span className="text-sm font-medium">{content.text || "Oferta expira em:"}</span>
        <span className="text-sm font-bold font-mono">
          {String(time.m).padStart(2, "0")}:{String(time.s).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function SalesElement({ content, primaryColor, textColor, cardBg, cardBorder, wrapperStyle, hoverClass, onClick }: any) {
  const [count, setCount] = useState(content.count || 1847);
  useEffect(() => {
    if (!content.showAnimation) return;
    const interval = setInterval(() => {
      setCount((prev: number) => prev + Math.floor(Math.random() * 3) + 1);
    }, (content.interval || 30) * 1000);
    return () => clearInterval(interval);
  }, [content.showAnimation, content.interval]);

  return (
    <div style={{ ...wrapperStyle, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "12px 16px" }} className={hoverClass} onClick={onClick}>
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4" style={{ color: primaryColor }} />
        <span className="text-sm font-medium" style={{ color: textColor }}>
          {(content.text || "{count} pessoas já compraram").replace("{count}", String(count))}
        </span>
      </div>
    </div>
  );
}

const BENEFIT_ICONS: Record<string, any> = {
  Truck, Shield, Clock, Star, Package, CreditCard, Heart, Award, Zap, Gift, ShoppingCart, RefreshCw, Headphones, CheckCircle, ThumbsUp,
};

function BenefitsElement({ content, primaryColor, textColor, cardBg, cardBorder, wrapperStyle, hoverClass, onClick }: any) {
  const layout = content.layout || "grid";
  const gap = content.gap || 24;
  const align = content.align || "left";
  const titleSize = content.titleSize || 16;
  const descSize = content.descSize || 14;
  const elTextColor = content.textColor || textColor;
  const elBgColor = content.bgColor || "transparent";

  const gridStyle: React.CSSProperties = layout === "grid"
    ? { display: "grid", gridTemplateColumns: `repeat(${Math.min((content.items || []).length, 3)}, 1fr)`, gap: `${gap}px` }
    : { display: "flex", flexDirection: "column", gap: `${gap}px` };

  return (
    <div
      style={{ ...wrapperStyle, background: elBgColor, borderRadius: "12px", padding: "24px 16px" }}
      className={hoverClass}
      onClick={onClick}
    >
      <div style={gridStyle}>
        {(content.items || []).map((item: any, i: number) => {
          const IconComp = BENEFIT_ICONS[item.icon] || CheckCircle;
          return (
            <div key={i} className="flex flex-col" style={{ textAlign: align as any }}>
              <div className="mb-2" style={{ textAlign: align as any }}>
                <IconComp className="w-6 h-6" style={{ color: elTextColor + "80", display: align === "center" ? "inline-block" : "block" }} />
              </div>
              <h5 className="font-semibold mb-1" style={{ color: elTextColor, fontSize: `${titleSize}px`, lineHeight: "1.3" }}>
                {item.title || item.text || "Benefício"}
              </h5>
              {item.description && (
                <p style={{ color: elTextColor + "99", fontSize: `${descSize}px`, lineHeight: "1.4" }}>
                  {item.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SIZE_MAP: Record<string, number> = { xs: 12, sm: 14, md: 18, lg: 24 };
const RATING_SIZE_MAP: Record<string, number> = { sm: 20, md: 30, lg: 40 };
const STAR_SIZE_MAP: Record<string, number> = { sm: 14, md: 18, lg: 24 };

function ReviewsElement({ content, primaryColor, textColor, cardBg, cardBorder, wrapperStyle, hoverClass, onClick }: any) {
  const c = content;
  const elTextColor = c.textColor || textColor;
  const elBgColor = c.bgColor || "transparent";
  const starColor = c.starColor || "#FACC15";
  const titlePx = SIZE_MAP[c.titleSize || "md"] || 18;
  const ratingPx = RATING_SIZE_MAP[c.ratingSize || "md"] || 30;
  const starPx = STAR_SIZE_MAP[c.starSize || "md"] || 18;
  const reviewTextPx = SIZE_MAP[c.reviewTextSize || "sm"] || 14;
  const avatars: string[] = c.avatars || [];
  const showAvatars = (c.style || "card_avatars") === "card_avatars" && avatars.length > 0;

  return (
    <div
      style={{ ...wrapperStyle, background: elBgColor, borderRadius: "12px", padding: "24px 16px" }}
      className={hoverClass}
      onClick={onClick}
    >
      <div className="flex flex-col items-center text-center">
        {/* Avatares sobrepostos */}
        {showAvatars && (
          <div className="flex items-center mb-2" style={{ marginLeft: `${Math.min(avatars.length - 1, 4) * 8}px` }}>
            {avatars.slice(0, 5).map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="rounded-full border-2 border-white object-cover"
                style={{
                  width: 36,
                  height: 36,
                  marginLeft: i === 0 ? 0 : -12,
                  zIndex: avatars.length - i,
                  position: "relative",
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ))}
          </div>
        )}

        {/* Título */}
        <h4 className="font-semibold mb-1" style={{ color: elTextColor, fontSize: `${titlePx}px` }}>
          {c.title || "Avaliação dos Clientes"}
        </h4>

        {/* Nota + Estrelas */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold" style={{ color: elTextColor, fontSize: `${ratingPx}px` }}>
            {c.average || 4.8}
          </span>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = i < Math.floor(c.average || 4.8);
              const half = !filled && i < (c.average || 4.8);
              return (
                <Star
                  key={i}
                  style={{ width: starPx, height: starPx, color: starColor, fill: filled ? starColor : half ? `${starColor}80` : "transparent" }}
                />
              );
            })}
          </div>
        </div>

        {/* Total */}
        <p style={{ color: elTextColor + "80", fontSize: `${reviewTextPx}px` }}>
          {c.total || 0} reviews
        </p>
      </div>
    </div>
  );
}
