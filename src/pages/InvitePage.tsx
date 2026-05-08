import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { X, Users, ExternalLink, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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
  const [error, setError] = useState("");
  const [config, setConfig] = useState<PageConfig>({});
  const { toast } = useToast();

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        
        // Try to get config from local storage as fallback/initial
        const stored = localStorage.getItem("link-page-config");
        if (stored) {
          const allConfigs = JSON.parse(stored);
          // We don't have the link ID here easily, but we might find it by slug after fetch
        }

        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/redirect-link?slug=${encodeURIComponent(slug)}`);
        const json = await res.json();
        
        if (!res.ok) {
          setError(json.error || "Link não encontrado");
        } else {
          setData(json);
          // Check if response contains page_config
          if (json.page_config) {
            setConfig(json.page_config);
          } else if (stored && json.id) {
            // Fallback to local storage using link ID
            const allConfigs = JSON.parse(stored);
            if (allConfigs[json.id]) {
              setConfig(allConfigs[json.id]);
            }
          }
        }
      } catch {
        setError("Erro ao carregar link");
      }
    })();
  }, [slug]);

  const handleCopy = () => {
    if (!data?.invite_link) return;
    navigator.clipboard.writeText(data.invite_link);
    toast({
      description: "Link copiado com sucesso!",
    });
  };

  if (error) {
    return (
      <div
        style={{ background: "#ffffff", position: "fixed", inset: 0, zIndex: 9999 }}
        className="flex items-center justify-center px-4"
      >
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: "#1f2937" }}>Link não encontrado</h1>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Este link de convite não existe ou foi desativado.
          </p>
        </div>
      </div>
    );
  }

  const bgColor = config.bgColor || "#f5f5f5";
  const buttonColor = config.buttonColor || "#25D366";
  const textColor = config.textColor || "#1f2937";
  const title = config.title || data.name || data.group_name;
  const description = config.description || "";
  const photo = config.photo || data.group_photo;

  return (
    <div
      style={{ background: bgColor, position: "fixed", inset: 0, zIndex: 9999 }}
      className="flex items-center justify-center px-4"
    >
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full flex flex-col items-center gap-4">
        {!data ? (
          <Skeleton className="w-24 h-24 rounded-full shadow-lg" />
        ) : photo ? (
          <img src={photo} alt={title} className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-lg" />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center ring-4 ring-white shadow-lg"
            style={{ backgroundColor: buttonColor }}
          >
            <Users className="w-12 h-12 text-white" />
          </div>
        )}
        
        {!data ? (
          <>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="w-full h-12 mt-2 rounded-xl" />
            <Skeleton className="w-full h-12 rounded-xl" />
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-center" style={{ color: textColor }}>{title}</h1>
            {description && (
              <p 
                className="text-sm text-center whitespace-pre-wrap" 
                style={{ color: textColor, opacity: 0.75 }}
              >
                {description}
              </p>
            )}
            <a
              href={data.invite_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-white shadow-md transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: buttonColor }}
            >
              <ExternalLink className="w-4 h-4" /> Entrar no grupo
            </a>

            <button
              onClick={handleCopy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all hover:bg-black/5 active:scale-95"
              style={{ color: textColor, border: `2px solid ${buttonColor}` }}
            >
              <Copy className="w-4 h-4" /> Copiar link
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
