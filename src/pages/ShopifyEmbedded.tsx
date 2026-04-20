import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Zap } from "lucide-react";

const SHOPIFY_API_KEY = "0a4a4627f4e668ba37162e209e84862a";

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
      config?: { shop?: string; host?: string };
    };
    "app-bridge"?: unknown;
  }
}

const ShopifyEmbedded = () => {
  const [shop, setShop] = useState<string>("");
  const [host, setHost] = useState<string>("");
  const [sessionToken, setSessionToken] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get("shop") || "";
    const hostParam = params.get("host") || "";
    setShop(shopParam);
    setHost(hostParam);

    if (!hostParam) {
      setError("Parâmetro 'host' ausente na URL. Abra o app pelo Shopify Admin.");
      return;
    }

    // App Bridge v4 (CDN) auto-inicializa lendo a meta tag `shopify-api-key`
    // e expõe `window.shopify` globalmente. Aguardamos sua disponibilidade.
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 50; // ~5s

    const fetchToken = async () => {
      try {
        if (!window.shopify?.idToken) {
          attempts++;
          if (attempts >= maxAttempts) {
            setError("App Bridge não carregou. Verifique se a página está embedada no Shopify Admin.");
            return;
          }
          setTimeout(fetchToken, 100);
          return;
        }
        const token = await window.shopify.idToken();
        if (cancelled) return;
        if (!token) {
          setError("Session token vazio. Recarregue dentro do Shopify Admin.");
          return;
        }
        setSessionToken(token);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao obter session token.");
        }
      }
    };

    fetchToken();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnect = async () => {
    if (!sessionToken) {
      setError("Session token indisponível.");
      return;
    }
    setConnecting(true);
    setError("");
    try {
      // TODO: chamar edge function passando sessionToken + shop para vincular ao usuário ZapLynx
      await new Promise((r) => setTimeout(r, 600));
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar.");
    } finally {
      setConnecting(false);
    }
  };

  if (!sessionToken && !error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Inicializando Shopify App Bridge…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">ZapLynx para Shopify</h1>
            <p className="text-xs text-muted-foreground">{shop || "Loja não identificada"}</p>
          </div>
        </div>

        {connected ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Loja conectada!</h2>
            <p className="text-sm text-muted-foreground">
              Sua loja Shopify está pronta para usar o ZapLynx.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              Conecte sua loja Shopify ao ZapLynx para automatizar mensagens, recuperar carrinhos
              e disparar campanhas no WhatsApp.
            </p>

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting || !sessionToken}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Conectando…
                </>
              ) : (
                "Conectar ao ZapLynx"
              )}
            </button>

            <div className="mt-6 space-y-1 text-[11px] text-muted-foreground">
              <p>Host: {host ? "✓" : "—"}</p>
              <p>Session token: {sessionToken ? "✓" : "—"}</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default ShopifyEmbedded;
