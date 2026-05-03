import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, X } from "lucide-react";

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

  useEffect(() => {
    const hostname = window.location.hostname;
    if (slug && hostname === "go.zaplynxpro.online") {
      window.location.replace(`${APP_INVITE_BASE_URL}${encodeURIComponent(slug)}${window.location.hash}`);
    }
  }, [slug]);

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
          if (json?.invite_link) {
            window.location.replace(json.invite_link);
            return;
          }
        }
      } catch {
        setError("Erro ao carregar link");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
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
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );
};

export default InvitePage;
