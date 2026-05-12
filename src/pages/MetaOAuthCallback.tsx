import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

export default function MetaOAuthCallback() {
  useEffect(() => {
    if (window.opener) {
       window.opener.postMessage({ type: "META_OAUTH_SUCCESS" }, "*");
    }

    const timeout = window.setTimeout(() => {
      window.close();
      // Fallback: if window.close() is blocked (no opener context), redirect
      if (!window.closed) {
        window.location.href = "/meta/dashboard?connected=1";
      }
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Conta conectada!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta Business foi vinculada com sucesso. Esta janela será fechada automaticamente.
        </p>
      </section>
    </main>
  );
}
