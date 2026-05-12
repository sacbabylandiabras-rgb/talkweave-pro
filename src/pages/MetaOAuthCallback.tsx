import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function MetaOAuthCallback() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const errorParam = params.get("error_description") || params.get("error");

      if (errorParam) {
        setStatus("error");
        setErrorMsg(errorParam);
        if (window.opener) {
          window.opener.postMessage({ type: "META_OAUTH_ERROR", message: errorParam }, "*");
        }
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setErrorMsg("Parâmetros ausentes no callback.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("meta-oauth-callback", {
          body: {
            code,
            state,
            origin: window.location.origin,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setStatus("success");
        if (window.opener) {
          window.opener.postMessage({ type: "META_OAUTH_SUCCESS" }, "*");
        }

        window.setTimeout(() => {
          window.close();
          if (!window.closed) {
            window.location.href = "/meta/dashboard?connected=1";
          }
        }, 1500);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao concluir a conexão.";
        setStatus("error");
        setErrorMsg(message);
        if (window.opener) {
          window.opener.postMessage({ type: "META_OAUTH_ERROR", message }, "*");
        }
      }
    };

    void run();
  }, []);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-lg">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Finalizando conexão…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Estamos vinculando sua conta. Aguarde um instante.</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Conta conectada!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sua conta Business foi vinculada com sucesso. Esta janela será fechada automaticamente.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Não foi possível conectar</h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
          </>
        )}
      </section>
    </main>
  );
}
