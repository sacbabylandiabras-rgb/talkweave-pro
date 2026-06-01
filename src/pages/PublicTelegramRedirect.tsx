import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const PublicTelegramRedirect = () => {
  const { slug = "" } = useParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const resolveRedirect = async () => {
      try {
        const { data, error: fnError } = await (supabase as any).functions.invoke("telegram-redirect", {
          body: { slug },
        });

        if (fnError || !data?.destination) {
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