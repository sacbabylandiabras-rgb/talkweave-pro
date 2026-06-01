import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck } from "lucide-react";

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

const PROFILE_BG: Record<string, string> = {
  rosa: "linear-gradient(135deg,#ff5fa3,#ff84c0)",
  azul: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
  escuro: "linear-gradient(135deg,#111827,#1f2937)",
  roxo: "linear-gradient(135deg,#7c3aed,#a855f7)",
  verde: "linear-gradient(135deg,#047857,#10b981)",
};

const INTERACTIVE: Record<string, { emoji: string; bg: string; color: string }> = {
  respondendo: { emoji: "😊", bg: "#e5e7eb", color: "#111827" },
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
    const bg = profile === "custom"
      ? `linear-gradient(135deg, ${pageConfig.custom_color || "#374151"}, ${pageConfig.custom_color || "#4b5563"})`
      : PROFILE_BG[profile] || PROFILE_BG.rosa;
    const inter = INTERACTIVE[pageConfig.interactive_template || "respondendo"] || INTERACTIVE.respondendo;
    const name = pageConfig.name || "Canal";
    const buttonText = pageConfig.button_text || "Entrar agora";
    const responseTime = pageConfig.response_time || "3 minutos";

    return (
      <main className="fixed inset-0 flex items-center justify-center px-4" style={{ background: bg }}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-6 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-4 ring-4 ring-white shadow-lg">
              {pageConfig.avatar_url ? (
                <img src={pageConfig.avatar_url} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{name}</h1>
              {pageConfig.verified && <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500 text-white" />}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Responde em {responseTime}
            </div>
            <div
              className="w-full rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm font-medium"
              style={{ background: inter.bg, color: inter.color }}
            >
              <span className="text-lg">{inter.emoji}</span>
              <span>Online agora</span>
            </div>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full rounded-xl py-3.5 font-semibold text-white text-base transition active:scale-[0.98] disabled:opacity-60"
              style={{ background: bg }}
            >
              {confirming ? "Abrindo..." : buttonText}
            </button>
          </div>
        </div>
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