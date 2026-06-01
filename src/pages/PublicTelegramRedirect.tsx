import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const PublicTelegramRedirect = () => {
  const { slug = "" } = useParams();
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolveRedirect = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shk = params.get("shk") || "";
        const { data, error: fnError } = await (supabase as any).functions.invoke("telegram-redirect", {
          body: { slug, shk, userAgent: navigator.userAgent },
        });

        if (fnError) {
          throw new Error(fnError?.message || "Link não encontrado");
        }
        if (data?.blocked) {
          if (data.blockMethod === "redirect" && data.redirectUrl) {
            window.location.replace(data.redirectUrl);
            return;
          }
          if (!cancelled) setBlocked(true);
          return;
        }
        if (!data?.destination) {
          throw new Error(data?.error || fnError?.message || "Link não encontrado");
        }

        window.location.replace(data.destination);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Link inválido ou inativo");
      }
    };

    resolveRedirect();

    return () => {
      cancelled = true;
    };
  }, [slug]);

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