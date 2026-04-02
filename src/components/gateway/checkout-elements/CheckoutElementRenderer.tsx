import { useState, useEffect } from "react";
import { CheckoutElement, ELEMENT_DEFINITIONS } from "./types";
import { Shield, Clock, Star, ThumbsUp, ChevronDown, ChevronUp, TrendingUp, BarChart3, CheckCircle } from "lucide-react";

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
      return (
        <div style={{ ...wrapperStyle, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "16px" }} className={hoverClass} onClick={onClick}>
          <h4 className="text-sm font-bold mb-3" style={{ color: textColor }}>{c.title || "Por que escolher?"}</h4>
          <div className="space-y-2">
            {(c.items || []).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-base">{item.icon || "✅"}</span>
                <span className="text-sm" style={{ color: textColor }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      );

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
      return (
        <div style={{ ...wrapperStyle, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "12px", padding: "16px" }} className={hoverClass} onClick={onClick}>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: textColor }}>{c.average || 4.8}</p>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-[10px] mt-1" style={{ color: textColor + "80" }}>{c.total || 0} avaliações</p>
            </div>
            <div className="flex-1 space-y-1">
              {(c.distribution || [85, 10, 3, 1, 1]).map((pct: number, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] w-3" style={{ color: textColor + "80" }}>{5 - i}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: cardBorder }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#FACC15" }} />
                  </div>
                  <span className="text-[10px] w-7 text-right" style={{ color: textColor + "80" }}>{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

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
