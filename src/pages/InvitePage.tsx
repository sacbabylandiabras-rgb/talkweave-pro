import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Copy, ExternalLink, Loader2, QrCode, Users, X } from "lucide-react";

const APP_INVITE_BASE_URL = "https://pay.zaplynxpro.online/invite/";

interface InviteData {
  name: string;
  slug: string;
  group_name: string;
  group_photo: string | null;
  invite_link: string;
}

interface PageConfig {
  title?: string;
  description?: string;
  photo?: string;
  buttonColor?: string;
  bgColor?: string;
  textColor?: string;
}

const InvitePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [pageConfig, setPageConfig] = useState<PageConfig>({});

  useEffect(() => {
    const hostname = window.location.hostname;
    if (slug && hostname === "go.zaplynxpro.online") {
      window.location.replace(`${APP_INVITE_BASE_URL}${encodeURIComponent(slug)}${window.location.hash}`);
    }
  }, [slug]);

  useEffect(() => {
    // Read page config from URL hash
    try {
      const hash = window.location.hash.slice(1);
      if (hash) {
        const config = JSON.parse(decodeURIComponent(hash));
        setPageConfig(config);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/redirect-link?slug=${encodeURIComponent(slug)}`
        );
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Link não encontrado");
        } else {
          setData(json);
        }
      } catch {
        setError("Erro ao carregar link");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.invite_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
    }
  };

  const handleJoin = () => {
    if (data?.invite_link) {
      window.open(data.invite_link, "_blank");
    }
  };

  const qrUrl = data?.invite_link
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.invite_link)}`
    : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Link não encontrado</h1>
          <p className="text-gray-500 text-sm">
            Este link de convite não existe ou foi desativado.
          </p>
        </div>
      </div>
    );
  }

  const bgColor = pageConfig.bgColor || "#f5f5f5";
  const textColor = pageConfig.textColor || "#1f2937";
  const buttonColor = pageConfig.buttonColor || "#25D366";
  const displayPhoto = pageConfig.photo || data.group_photo;
  const displayTitle = pageConfig.title || data.group_name;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ backgroundColor: bgColor }}>
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          {displayPhoto ? (
            <img src={displayPhoto} alt={displayTitle} className="w-28 h-28 rounded-full object-cover shadow-lg ring-4 ring-white" />
          ) : (
            <div className="w-28 h-28 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white" style={{ backgroundColor: buttonColor }}>
              <Users className="w-14 h-14 text-white" />
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>{displayTitle}</h1>
          {pageConfig.description ? (
            <p className="text-sm mt-2" style={{ color: textColor, opacity: 0.7 }}>{pageConfig.description}</p>
          ) : (
            <p className="text-sm mt-1" style={{ color: textColor, opacity: 0.5 }}>{data.name}</p>
          )}
        </div>
        <button onClick={handleJoin} className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-colors shadow-md flex items-center justify-center gap-2" style={{ backgroundColor: buttonColor }}>
          <ExternalLink className="w-5 h-5" /> Entrar no grupo
        </button>

        {/* Copy link button */}
        <button
          onClick={handleCopy}
          className="w-full py-3.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-medium text-base border border-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-green-500" />
              Link copiado!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              Copiar link do grupo
            </>
          )}
        </button>

        {/* Instructions */}
        <div className="text-gray-500 text-sm leading-relaxed">
          <p>Se estiver com dificuldade para entrar no grupo,</p>
          <p>abra o WhatsApp e cole o link em uma conversa.</p>
          <p>Depois clique no link para abrir direto no grupo.</p>
          <button
            onClick={() => setShowQR(!showQR)}
            className="text-green-600 hover:text-green-700 underline mt-1 inline-flex items-center gap-1"
          >
            <QrCode className="w-4 h-4" />
            {showQR ? "Esconder QR Code" : "Clique aqui para ver o QR Code"}
          </button>
        </div>

        {/* QR Code */}
        {showQR && (
          <div className="flex justify-center animate-in fade-in duration-300">
            <img
              src={qrUrl}
              alt="QR Code do grupo"
              className="w-48 h-48 rounded-lg shadow-md"
            />
          </div>
        )}

        {/* Copied toast */}
        {copied && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-bottom duration-300">
            Link copiado. Abra o WhatsApp e cole o link em uma conversa.
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
