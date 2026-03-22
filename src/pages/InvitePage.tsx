import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Copy, ExternalLink, Loader2, QrCode, X } from "lucide-react";

interface InviteData {
  name: string;
  slug: string;
  group_name: string;
  group_photo: string | null;
  invite_link: string;
}

const InvitePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Avatar / Icon */}
        <div className="flex justify-center">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg ring-4 ring-white">
            <svg viewBox="0 0 24 24" className="w-14 h-14 text-white fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
        </div>

        {/* Group name */}
        <h1 className="text-2xl font-bold text-gray-800">{data.name}</h1>

        {/* Join button */}
        <button
          onClick={handleJoin}
          className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-base transition-colors shadow-md flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-5 h-5" />
          Entrar no grupo
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
