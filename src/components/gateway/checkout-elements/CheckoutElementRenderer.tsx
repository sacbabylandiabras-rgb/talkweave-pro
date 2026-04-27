import { useState, useEffect } from "react";
import { CheckoutElement, ELEMENT_DEFINITIONS } from "./types";
import { Shield, Clock, Star, ThumbsUp, ChevronDown, ChevronUp, TrendingUp, BarChart3, Check, CheckCircle, Truck, Package, CreditCard, Heart, Award, Zap, Gift, ShoppingCart, RefreshCw, Headphones, icons } from "lucide-react";

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
    outline: isSelected ? `2px solid #a78bfa` : isBuilder ? "2px dashed transparent" : "none",
    borderRadius: "12px",
    transition: "outline 0.15s",
  };
  const hoverClass = isBuilder ? "hover:outline-[#a78bfa]/30 hover:outline-dashed" : "";

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
            {(c.items || []).map((t: any, i: number) => {
              const tBg = c.bgColor || cardBg;
              const tBorder = c.borderColor || cardBorder;
              const tNameColor = c.nameColor || textColor;
              const tTextColor = c.textColor || textColor + "CC";
              const tStarColor = c.starColor || "#FACC15";
              const tTimeColor = c.timeColor || textColor + "80";
              return (
                <div key={i} style={{ background: tBg, border: `1px solid ${tBorder}`, borderRadius: "12px", padding: "16px" }}>
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
                        <p className="text-sm font-semibold" style={{ color: tNameColor }}>{t.name || "Anônimo"}</p>
                        {t.timeAgo && <span className="text-[10px] shrink-0" style={{ color: tTimeColor }}>{t.timeAgo}</span>}
                      </div>
                      <div className="flex items-center gap-0.5 mb-2">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} className="w-3.5 h-3.5" style={{ fill: j < (t.rating || 5) ? tStarColor : "#D1D5DB", color: j < (t.rating || 5) ? tStarColor : "#D1D5DB" }} />
                        ))}
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: tTextColor }}>{t.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "reviews":
      return <ReviewsElement content={c} primaryColor={primaryColor} textColor={textColor} cardBg={cardBg} cardBorder={cardBorder} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

    case "guarantee":
      return <GuaranteeElement content={c} primaryColor={primaryColor} textColor={textColor} cardBg={cardBg} cardBorder={cardBorder} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

    case "countdown":
      return <CountdownElement content={c} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

    case "list": {
      const titleColor = c.titleColor || textColor;
      const itemColor = c.itemColor || textColor;
      const iconColor = c.iconColor || "#16A34A";
      const bgColor = c.bgColor || cardBg;
      const borderColor = c.borderColor || cardBorder;
      const titleSize = c.titleSize || 16;
      const itemSize = c.itemSize || 14;
      const iconStyle = c.iconStyle || "check";
      return (
        <div style={{ ...wrapperStyle, background: bgColor, border: `1px solid ${borderColor}`, borderRadius: "12px", padding: "16px" }} className={hoverClass} onClick={onClick}>
          {c.title && <h4 className="font-bold mb-3" style={{ color: titleColor, fontSize: `${titleSize}px` }}>{c.title}</h4>}
          <div className="space-y-2.5">
            {(c.items || []).map((item: any, i: number) => (
              <div key={i} className="flex items-start gap-2.5">
                {iconStyle === "check" ? (
                  <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: iconColor }} />
                ) : iconStyle === "circle-check" ? (
                  <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: iconColor }} />
                ) : (
                  <span className="text-base flex-shrink-0">{item.icon || "✅"}</span>
                )}
                <span style={{ color: itemColor, fontSize: `${itemSize}px` }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "progress": {
      const pValue = c.percentage || 40;
      const pMax = c.maxValue || 100;
      const pPercent = Math.min(100, Math.round((pValue / pMax) * 100));
      const barColor = c.color || primaryColor;
      const pTextColor = c.textColor || textColor;
      const pBgColor = c.bgColor || "transparent";
      const trackColor = c.trackColor || cardBorder;
      const barHeight = c.barHeight === "sm" ? "8px" : c.barHeight === "lg" ? "24px" : "16px";
      const barStyle = c.barStyle || "solid";
      const showValue = c.showValue !== false ? c.showValue : false;
      return (
        <div style={{ ...wrapperStyle, background: pBgColor, borderRadius: "12px", padding: "16px" }} className={hoverClass} onClick={onClick}>
          {c.title && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium" style={{ color: pTextColor }}>{c.title}</span>
              {showValue && <span className="text-sm font-bold" style={{ color: barColor }}>{pValue}%</span>}
            </div>
          )}
          {c.description && <p className="text-xs mb-2" style={{ color: pTextColor + "99" }}>{c.description}</p>}
          <div className="w-full rounded-full overflow-hidden" style={{ background: trackColor, height: barHeight }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pPercent}%`,
                background: barStyle === "gradient" ? `linear-gradient(90deg, ${barColor}, ${barColor}CC)` : barColor,
              }}
            />
          </div>
        </div>
      );
    }

    case "sales":
      return <SalesElement content={c} primaryColor={primaryColor} textColor={textColor} cardBg={cardBg} cardBorder={cardBorder} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

    case "upsell":
      return <UpsellElement content={c} primaryColor={primaryColor} textColor={textColor} cardBg={cardBg} cardBorder={cardBorder} wrapperStyle={wrapperStyle} hoverClass={hoverClass} onClick={onClick} />;

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
  const totalSeconds = (content.minutes || 10) * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => {
    setRemaining((content.minutes || 10) * 60);
  }, [content.minutes]);
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 0) return content.timerType === "fixed" ? (content.minutes || 10) * 60 : 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [content.timerType, content.minutes]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  const style = content.style || "cards";
  const titleColor = content.titleColor || "#333";
  const numberColor = content.numberColor || "#111";
  const numberBgColor = content.numberBgColor || "#F3F4F6";
  const labelColor = content.labelColor || "#999";
  const accentColor = content.accentColor || "#E5E7EB";
  const bgColor = content.bgColor || "transparent";
  const titleSize = content.titleSize || 14;
  const numberSize = content.numberSize || 24;

  if (style === "banner") {
    return (
      <div style={{ ...wrapperStyle, background: bgColor || "#EF4444", borderRadius: "12px", padding: "12px 16px" }} className={hoverClass} onClick={onClick}>
        <div className="flex items-center justify-center gap-2" style={{ color: numberColor || "#FFFFFF" }}>
          <Clock className="w-4 h-4" />
          <span className="font-medium" style={{ fontSize: `${titleSize}px` }}>{content.text || "Oferta expira em:"}</span>
          <span className="font-bold font-mono" style={{ fontSize: `${numberSize}px` }}>
            {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
          </span>
        </div>
      </div>
    );
  }

  // Cards style (default)
  const units = [
    { value: h, label: "Horas" },
    { value: m, label: "Minutos" },
    { value: s, label: "Segundos" },
  ];

  return (
    <div style={{ ...wrapperStyle, background: bgColor, borderRadius: "12px", padding: "16px" }} className={hoverClass} onClick={onClick}>
      <p className="text-center font-medium mb-3" style={{ color: titleColor, fontSize: `${titleSize}px` }}>
        {content.text || "Oferta termina em:"}
      </p>
      <div className="flex items-center justify-center gap-3">
        {units.map((u, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="font-bold font-mono rounded-lg px-4 py-2" style={{ background: numberBgColor, color: numberColor, fontSize: `${numberSize}px`, border: `1px solid ${accentColor}` }}>
              {String(u.value).padStart(2, "0")}
            </div>
            <span className="text-[10px] mt-1" style={{ color: labelColor }}>{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesElement({ content, primaryColor, textColor, cardBg, cardBorder, wrapperStyle, hoverClass, onClick }: any) {
  const [count, setCount] = useState(content.count || 50);
  useEffect(() => { setCount(content.count || 50); }, [content.count]);
  useEffect(() => {
    if (!content.showAnimation) return;
    const intervalMs = content.interval || 800;
    const interval = setInterval(() => {
      setCount((prev: number) => {
        const max = content.maxValue || 1000;
        if (prev >= max) return content.minValue || prev;
        const inc = content.randomIncrement
          ? Math.floor(Math.random() * ((content.incrementMax || 5) - (content.incrementMin || 1) + 1)) + (content.incrementMin || 1)
          : (content.increment || 1);
        return Math.min(prev + inc, max);
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [content.showAnimation, content.interval, content.increment, content.randomIncrement, content.incrementMin, content.incrementMax, content.maxValue, content.minValue]);

  const valueColor = content.valueColor || primaryColor;
  const iconColor = content.iconColor || primaryColor;
  const elTextColor = content.textColor || textColor;
  const bgColor = content.bgColor || "transparent";
  const titleSize = content.titleSize || 18;
  const descSize = content.descSize || 14;
  const valueSize = content.valueSize || 30;
  const showIcon = content.showIcon !== false;
  const iconPosition = content.iconPosition || "left";
  const format = content.format || "default";
  const customFormat = content.customFormat || "{value} Compras";

  const formattedValue = format === "custom"
    ? customFormat.replace("{value}", String(count))
    : `${count} pessoas já compraram`;

  return (
    <div style={{ ...wrapperStyle, background: bgColor, borderRadius: "12px", padding: "16px", textAlign: "center", border: content.borderColor ? `1px solid ${content.borderColor}` : undefined }} className={hoverClass} onClick={onClick}>
      {content.title && <h4 className="font-bold mb-1" style={{ color: elTextColor, fontSize: `${titleSize}px` }}>{content.title}</h4>}
      {content.description && <p className="mb-2" style={{ color: elTextColor + "99", fontSize: `${descSize}px` }}>{content.description}</p>}
      <div className="flex items-center justify-center gap-2" style={{ fontSize: `${valueSize}px`, fontWeight: 700, color: valueColor }}>
        {showIcon && iconPosition === "left" && <CheckCircle className="flex-shrink-0" style={{ color: iconColor, width: `${valueSize * 0.7}px`, height: `${valueSize * 0.7}px` }} />}
        <span>{format === "custom" ? formattedValue : count}</span>
        {showIcon && iconPosition === "right" && <CheckCircle className="flex-shrink-0" style={{ color: iconColor, width: `${valueSize * 0.7}px`, height: `${valueSize * 0.7}px` }} />}
      </div>
      {format !== "custom" && <p className="mt-1" style={{ color: elTextColor + "99", fontSize: `${descSize}px` }}>{(content.text || "{count} pessoas já compraram").replace("{count}", String(count))}</p>}
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

const GUARANTEE_ICONS: Record<string, any> = { shield: Shield, clock: Clock, check: CheckCircle, award: Award, heart: Heart };

function GuaranteeElement({ content, primaryColor, textColor, cardBg, cardBorder, wrapperStyle, hoverClass, onClick }: any) {
  const c = content;
  const elTitleColor = c.titleColor || textColor;
  const elDescColor = c.descColor || textColor + "99";
  const elIconColor = c.iconColor || "#16A34A";
  const elBgColor = c.bgColor || "transparent";
  const sectionBg = c.sectionBgColor || "transparent";
  const IconComp = GUARANTEE_ICONS[c.iconType || "shield"] || Shield;

  return (
    <div
      style={{
        ...wrapperStyle,
        background: sectionBg,
        paddingTop: `${c.paddingTop || 0}px`,
        paddingBottom: `${c.paddingBottom || 0}px`,
      }}
      className={hoverClass}
      onClick={onClick}
    >
      <div className="flex flex-col items-center text-center py-6 px-4" style={{ background: elBgColor, borderRadius: "12px" }}>
        {c.showIcon !== false && (
          <div className="mb-3">
            <IconComp className="w-10 h-10" style={{ color: elIconColor }} />
          </div>
        )}
        <h4 className="text-lg font-bold mb-1" style={{ color: elTitleColor }}>
          {c.title || `Garantia de ${c.days || 30} dias`}
        </h4>
        <p className="text-sm" style={{ color: elDescColor }}>
          {(c.text || "").replace("{days}", String(c.days || 30))}
        </p>
      </div>
    </div>
  );
}

function UpsellElement({ content, primaryColor, textColor, cardBg, cardBorder, wrapperStyle, hoverClass, onClick }: any) {
  const c = content;
  const bgColor = c.bgColor || cardBg;
  const border = c.borderColor || cardBorder;
  const titleCol = c.titleColor || textColor;
  const priceCol = c.priceColor || primaryColor;
  const btnColor = c.buttonColor || primaryColor;
  const btnTextColor = c.buttonTextColor || "#FFFFFF";
  const badgeText = c.badgeText || "OFERTA ÚNICA";

  return (
    <div style={{ ...wrapperStyle, background: bgColor, border: `2px solid ${border}`, borderRadius: "12px", padding: "16px", position: "relative" }} className={hoverClass} onClick={onClick}>
      {c.showBadge !== false && (
        <div style={{ position: "absolute", top: "-10px", left: "16px", background: priceCol, color: btnTextColor, fontSize: "10px", fontWeight: 700, padding: "2px 10px", borderRadius: "999px", letterSpacing: "0.05em" }}>
          {badgeText}
        </div>
      )}
      <div className="flex gap-3 items-center">
        {c.image ? (
          <img src={c.image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-lg shrink-0 flex items-center justify-center" style={{ background: `${primaryColor}15`, border: `1px dashed ${border}` }}>
            <Gift className="w-6 h-6" style={{ color: primaryColor + "60" }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold truncate" style={{ color: titleCol }}>{c.productName || "Produto Extra"}</h4>
          <p className="text-xs mt-0.5" style={{ color: titleCol + "99" }}>{c.description || ""}</p>
          <div className="flex items-center gap-2 mt-1">
            {c.originalPrice > 0 && c.originalPrice !== c.price && (
              <span className="text-xs line-through" style={{ color: titleCol + "60" }}>R$ {Number(c.originalPrice || 0).toFixed(2).replace(".", ",")}</span>
            )}
            <span className="text-sm font-bold" style={{ color: priceCol }}>R$ {Number(c.price || 0).toFixed(2).replace(".", ",")}</span>
          </div>
        </div>
      </div>
      <button
        className="w-full mt-3 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: btnColor, color: btnTextColor }}
      >
        {c.buttonText || "Adicionar ao pedido"}
      </button>
    </div>
  );
}
