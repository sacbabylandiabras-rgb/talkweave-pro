import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Check, Send } from "lucide-react";

interface PageConfig {
  avatar_url?: string;
  name?: string;
  verified?: boolean;
  button_text?: string;
  response_time?: string;
  profile_template?: string;
  custom_color?: string;
  interactive_template?: string;
}

const DEFAULT_BUTTON_TEXT = "Toque AQUI para me chamar";

const normalizeButtonText = (value?: string) => {
  const text = (value || "").trim();
  return !text || text === "Entrar agora" ? DEFAULT_BUTTON_TEXT : text;
};

const VerificacaoView = ({ buttonText, confirming, onConfirm }: RaspadinhaViewProps) => {
  const [checked, setChecked] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleCheck = () => {
    if (checked || verifying) return;
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setChecked(true);
    }, 1200);
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-[#e5e7eb] gap-5">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center text-center">
        <h2 className="text-base font-bold text-gray-900">Verificação de segurança</h2>
        <p className="text-xs text-gray-500 mt-1.5 px-2 leading-relaxed">
          Para acessar o conteúdo, por favor, marque a caixinha abaixo!
        </p>
        <div className="mt-5 w-full border border-gray-300 rounded-md bg-[#f9f9f9] px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCheck}
              aria-label="Confirmar verificação"
              className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center transition ${checked ? "bg-green-500 border-green-500" : "bg-white border-gray-400"}`}
            >
              {verifying && (
                <span className="w-4 h-4 border-2 border-gray-300 border-t-[#4285f4] rounded-full animate-spin" />
              )}
              {checked && !verifying && (
                <Check className="w-4 h-4 text-white" strokeWidth={3.5} />
              )}
            </button>
            <span className="text-sm text-gray-800">Sou maior de 18 anos</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full border border-[#4285f4] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#4285f4]" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[8px] text-gray-500 mt-0.5 font-semibold tracking-wide">reCAPTCHA</span>
            <span className="text-[7px] text-gray-400">Privacidade - Termos</span>
          </div>
        </div>
        {checked && (
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="mt-5 w-full rounded-xl py-3.5 px-4 font-bold text-white text-sm tracking-wide transition active:scale-[0.98] shadow-md bg-gradient-to-r from-[#8b7cf6] to-[#6d5ee6] hover:opacity-95 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {confirming ? "ABRINDO..." : "VERIFICAR E ASSISTIR"}
          </button>
        )}
      </div>
    </main>
  );
};

const PROFILE_BG: Record<string, string> = {
  rosa: "linear-gradient(135deg,#ff5fa3,#ff84c0)",
  azul: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
  escuro: "linear-gradient(135deg,#111827,#1f2937)",
  roxo: "linear-gradient(135deg,#7c3aed,#a855f7)",
  verde: "linear-gradient(135deg,#047857,#10b981)",
};

const INTERACTIVE: Record<string, { emoji: string; bg: string; color: string }> = {
  raspadinha: { emoji: "🪙", bg: "#d1d5db", color: "#111827" },
  verificacao: { emoji: "🛡️", bg: "#1e3a5f", color: "#fff" },
  countdown: { emoji: "⏳", bg: "#1e40af", color: "#fff" },
  "+18": { emoji: "⚠️", bg: "#374151", color: "#fff" },
  presente: { emoji: "🎁", bg: "#3b0764", color: "#fff" },
};

const PublicTelegramRedirect = () => {
  const { slug = "" } = useParams();
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageConfig, setPageConfig] = useState<PageConfig | null>(null);
  const [destination, setDestination] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolveRedirect = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shk = params.get("shk") || "";
        const { data, error: fnError } = await (supabase as any).functions.invoke("telegram-redirect", {
          body: { slug, shk, userAgent: navigator.userAgent },
        });

        if (fnError) throw new Error(fnError?.message || "Link não encontrado");
        if (data?.blocked) {
          if (data.blockMethod === "redirect" && data.redirectUrl) {
            window.location.replace(data.redirectUrl);
            return;
          }
          if (!cancelled) setBlocked(true);
          return;
        }
        if (data?.page) {
          if (!cancelled) {
            setPageConfig(data.pageConfig || {});
            setDestination(data.destination || "");
            setLoading(false);
          }
          return;
        }
        if (!data?.destination) throw new Error(data?.error || "Link não encontrado");
        window.location.replace(data.destination);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Link inválido ou inativo");
          setLoading(false);
        }
      }
    };

    resolveRedirect();
    return () => { cancelled = true; };
  }, [slug]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const shk = params.get("shk") || "";
      const { data } = await (supabase as any).functions.invoke("telegram-redirect", {
        body: { slug, shk, userAgent: navigator.userAgent, confirm: true },
      });
      const url = data?.destination || destination;
      if (url) window.location.replace(url);
    } finally {
      setConfirming(false);
    }
  };

  if (pageConfig) {
    const profile = pageConfig.profile_template || "rosa";
    const parseCustom = (raw?: string) => {
      if (!raw) return { color: "#f472b6", pattern: "limpo" };
      if (raw.startsWith("{")) {
        try { const p = JSON.parse(raw); return { color: p.color || "#f472b6", pattern: p.pattern || "limpo" }; } catch { /* noop */ }
      }
      return { color: raw, pattern: "limpo" };
    };
    const buildCustomBg = (color: string, pattern: string) => {
      if (pattern === "bolinhas") return `radial-gradient(circle, rgba(255,255,255,0.18) 1.5px, transparent 2px) 0 0 / 16px 16px, ${color}`;
      if (pattern === "listras") return `repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 10px, transparent 10px 20px), ${color}`;
      return color;
    };
    const custom = parseCustom(pageConfig.custom_color);
    const bg = profile === "custom"
      ? buildCustomBg(custom.color, custom.pattern)
      : PROFILE_BG[profile] || PROFILE_BG.rosa;
    const inter = INTERACTIVE[pageConfig.interactive_template || "raspadinha"] || INTERACTIVE.raspadinha;
    const name = pageConfig.name || "Canal";
    const buttonText = normalizeButtonText(pageConfig.button_text);
    const responseTime = pageConfig.response_time || "3 minutos";

    if (pageConfig.interactive_template === "raspadinha") {
      return (
        <RaspadinhaView
          buttonText={buttonText}
          confirming={confirming}
          onConfirm={handleConfirm}
        />
      );
    }

    if (pageConfig.interactive_template === "verificacao") {
      return (
        <VerificacaoView
          buttonText={buttonText}
          confirming={confirming}
          onConfirm={handleConfirm}
        />
      );
    }

    if (pageConfig.interactive_template === "countdown") {
      return (
        <CountdownView
          buttonText={buttonText}
          confirming={confirming}
          onConfirm={handleConfirm}
        />
      );
    }

    if (pageConfig.interactive_template === "+18" || pageConfig.interactive_template === "mais18") {
      return (
        <Mais18View
          buttonText={buttonText}
          confirming={confirming}
          onConfirm={handleConfirm}
        />
      );
    }

    if (pageConfig.interactive_template === "presente") {
      return (
        <PresenteView
          buttonText={buttonText}
          confirming={confirming}
          onConfirm={handleConfirm}
        />
      );
    }

    return (
      <main className="fixed inset-0 flex items-center justify-center px-6" style={{ background: bg }}>
        <div className="w-full max-w-xs bg-white rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center">
          <div
            className="rounded-full p-[3px] mb-4 shadow-md"
            style={{ background: "linear-gradient(135deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)" }}
          >
            <div className="w-24 h-24 rounded-full overflow-hidden bg-white p-[2px]">
              <div className="w-full h-full rounded-full overflow-hidden bg-gray-200">
                {pageConfig.avatar_url ? (
                  <img src={pageConfig.avatar_url} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <h1 className="text-lg font-bold text-gray-900">{name}</h1>
            {pageConfig.verified && (
              <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#3b82f6]">
                <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="font-medium text-green-600">Online</span>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Tempo médio de resposta: {responseTime}
          </p>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full rounded-2xl py-3.5 px-4 font-semibold text-white text-sm transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg bg-[#2AABEE] hover:bg-[#1f95d2]"
          >
            <Send className="w-4 h-4 shrink-0" fill="currentColor" strokeWidth={0} />
            <span>{confirming ? "Abrindo..." : buttonText}</span>
          </button>
        </div>
        {pageConfig.interactive_template === "raspadinha" && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs rounded-2xl bg-[#d1d5db] py-10 px-6 flex flex-col items-center justify-center text-center shadow-xl">
            <svg className="h-8 w-8 text-gray-500 mb-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 2l4 14 2.5-5 5-2.5L5 2z" />
            </svg>
            <p className="text-sm font-bold tracking-wide text-gray-700">RASPE PARA VER</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Use a roda para descobrir</p>
          </div>
        )}
      </main>
    );
  }

  if (blocked) {
    return (
      <main className="fixed inset-0 z-[9999] flex items-center justify-center bg-background px-4 text-center">
        <div className="space-y-2 max-w-sm">
          <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            O conteúdo que você está procurando não está disponível.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-[9999] flex items-center justify-center bg-background px-4 text-center">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {error || "Redirecionando..."}
        </p>
        {error && (
          <a href="/" className="text-sm font-medium text-primary hover:underline">
            Voltar ao início
          </a>
        )}
      </div>
    </main>
  );
};

export default PublicTelegramRedirect;

interface RaspadinhaViewProps {
  buttonText: string;
  confirming: boolean;
  onConfirm: () => void;
}

const RaspadinhaView = ({ buttonText, confirming, onConfirm }: RaspadinhaViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const moveCountRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // Silver background
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#e5e7eb");
    grad.addColorStop(0.5, "#d1d5db");
    grad.addColorStop(1, "#9ca3af");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Speckles
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 220; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }

    // Center cursor icon + texts
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = w / 2;
    const cy = h / 2 - 30;

    // Cursor arrow icon (simple pointer)
    ctx.fillStyle = "#6b7280";
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 12);
    ctx.lineTo(cx + 10, cy + 2);
    ctx.lineTo(cx + 1, cy + 3);
    ctx.lineTo(cx + 6, cy + 14);
    ctx.lineTo(cx + 2, cy + 16);
    ctx.lineTo(cx - 3, cy + 5);
    ctx.lineTo(cx - 8, cy + 10);
    ctx.closePath();
    ctx.fill();

    // Small "tap" arcs around cursor
    ctx.strokeStyle = "rgba(107,114,128,0.55)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const ang = (Math.PI / 2) * i + Math.PI / 4;
      const rx = Math.cos(ang) * 22;
      const ry = Math.sin(ang) * 22;
      ctx.beginPath();
      ctx.arc(cx + rx, cy + ry, 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = "#374151";
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.fillText("RASPE PARA VER", cx, cy + 50);

    // Subtitle
    ctx.fillStyle = "#9ca3af";
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.fillText("Use o dedo para descobrir", cx, cy + 74);

    ctx.globalCompositeOperation = "destination-out";
    // Continuous stroke settings so it erases as a smooth path, not dots
    ctx.lineWidth = 48;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const checkReveal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const step = 16;
    const data = ctx.getImageData(0, 0, width, height).data;
    let cleared = 0;
    let total = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4 + 3;
        if (data[idx] < 32) cleared++;
        total++;
      }
    }
    if (cleared / total > 0.6) setRevealed(true);
  };

  const scratch = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    const last = lastPosRef.current;
    ctx.beginPath();
    if (last) {
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x - 0.01, y);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    lastPosRef.current = { x, y };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drawingRef.current = true;
    lastPosRef.current = null;
    moveCountRef.current = 0;
    (e.target as Element).setPointerCapture(e.pointerId);
    scratch(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    scratch(e.clientX, e.clientY);
    moveCountRef.current++;
    if (moveCountRef.current % 6 === 0) checkReveal();
  };
  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPosRef.current = null;
    checkReveal();
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center px-6 bg-black gap-6">
      <div className="relative w-[280px] h-[380px] rounded-2xl overflow-hidden shadow-2xl">
        {/* Revealed content underneath */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
             style={{ background: "linear-gradient(180deg,#1e3a8a,#1e40af)" }}>
          <h2 className="text-2xl font-extrabold text-white tracking-wide leading-tight">
            CONTEÚDO<br />LIBERADO
          </h2>
          <p className="text-xs text-white/80 mt-3">Você ganhou acesso exclusivo.</p>
        </div>
        {/* Scratch layer */}
        <canvas
          ref={canvasRef}
          width={280}
          height={380}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`absolute inset-0 w-full h-full touch-none cursor-grab transition-opacity duration-500 ${revealed ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        />
      </div>
      {revealed && (
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="w-[280px] rounded-2xl py-3.5 px-4 font-semibold text-white text-sm transition active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg bg-gradient-to-r from-[#2AABEE] to-[#56c5f5] animate-pulse"
          style={{ boxShadow: "0 0 30px rgba(42,171,238,0.6)" }}
        >
          <Send className="w-4 h-4 shrink-0" fill="currentColor" strokeWidth={0} />
          <span>{confirming ? "Abrindo..." : (buttonText || "Acessar Conteúdo")}</span>
        </button>
      )}
    </main>
  );
};

interface CountdownViewProps {
  buttonText: string;
  confirming: boolean;
  onConfirm: () => void;
}

const CountdownView = ({ buttonText, confirming, onConfirm }: CountdownViewProps) => {
  const [count, setCount] = useState(3);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (count <= 0) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    if (done) onConfirm();
  }, [done, onConfirm]);

  const total = 3;
  const progress = done ? 100 : ((total - count) / total) * 100;

  return (
    <main className="fixed inset-0 flex items-center justify-center px-6" style={{ background: "linear-gradient(180deg,#0f2547,#0a1a36)" }}>
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        <div
          key={count}
          className="text-white font-extrabold leading-none"
          style={{
            fontSize: "120px",
            textShadow: "0 0 40px rgba(56,189,248,0.5)",
            animation: "countPulse 1s ease-out",
          }}
        >
          {done ? "0" : count}
        </div>
        <p className="text-white/80 text-sm mt-6 mb-4">
          {confirming ? "Abrindo..." : "Preparando seu acesso..."}
        </p>
        <div className="w-48 h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-[#2AABEE] transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {buttonText ? <span className="sr-only">{buttonText}</span> : null}
      </div>
      <style>{`
        @keyframes countPulse {
          0% { transform: scale(0.6); opacity: 0; }
          40% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </main>
  );
};

interface Mais18ViewProps {
  buttonText: string;
  confirming: boolean;
  onConfirm: () => void;
}

const Mais18View = ({ buttonText, confirming, onConfirm }: Mais18ViewProps) => {
  return (
    <main className="fixed inset-0 flex items-center justify-center px-6" style={{ background: "#000" }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center text-center"
        style={{ background: "#1f2937", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
      >
        <div
          className="flex items-center justify-center rounded-xl mb-5"
          style={{ width: 56, height: 56, background: "rgba(245, 158, 11, 0.15)" }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 3 L22 20 L2 20 Z" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" fill="rgba(245,158,11,0.1)"/>
            <line x1="12" y1="10" x2="12" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="1" fill="#f59e0b"/>
          </svg>
        </div>
        <h1 className="text-white text-xl font-bold mb-3">Conteúdo Restrito</h1>
        <p className="text-[#9ca3af] text-xs leading-relaxed mb-6 px-2">
          Este conteúdo é destinado exclusivamente para maiores de 18 anos. Ao continuar, você confirma ter idade legal.
        </p>
        <div className="w-full flex gap-3 mb-5">
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 py-3 rounded-lg font-semibold text-white text-sm transition-opacity disabled:opacity-60"
            style={{ background: "#10b981" }}
          >
            {confirming ? "Abrindo..." : (buttonText || "Tenho +18")}
          </button>
          <button
            onClick={() => { window.location.href = "https://www.google.com"; }}
            className="flex-1 py-3 rounded-lg font-semibold text-sm"
            style={{ background: "#374151", color: "#9ca3af" }}
          >
            Sair
          </button>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-[#4b5563]">Verificação obrigatória</p>
      </div>
    </main>
  );
};