import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Zap } from "lucide-react";

declare global {
  interface Window {
    shopify?: any;
    "app-bridge"?: any;
  }
}

const APP_BRIDGE_SRC = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
const SHOPIFY_API_KEY = "0a4a4627f4e668ba37162e209e84862a";

const ShopifyEmbedded = () => {
  const [ready, setReady] = useState(false);
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

    if (document.querySelector(`script[src="${APP_BRIDGE_SRC}"]`)) {
      setReady(true);
      return;
    }

    const meta = document.createElement("meta");
    meta.name = "shopify-api-key";
    meta.content = SHOPIFY_API_KEY;
    document.head.appendChild(meta);

    const script = document.createElement("script");
    script.src = APP_BRIDGE_SRC;
    script.onload = () => setReady(true);
    script.onerror = () => setError("Falha ao carregar Shopify App Bridge.");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready || !window.shopify?.idToken) return;
    window.shopify
      .idToken()
      .then((token: string) => setSessionToken(token))
      .catch(() => setError("Não foi possível obter o session token."));
  }, [ready]);

  const handleConnect = async () => {
    if (!sessionToken) {
      setError("Session token indisponível. Recarregue a página dentro do Shopify Admin.");
      return;
    }
    setConnecting(true);
    setError("");
    try {
      // Aqui você pode chamar uma edge function passando o sessionToken e shop
      // para vincular a loja Shopify ao usuário ZapLynx.
      await new Promise((r) => setTimeout(r, 800));
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar.");
    } finally {
      setConnecting(false);
    }
  };

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando Shopify App Bridge…</p>
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
            <p className="text-xs text-muted-foreground">
              {shop || "Loja não identificada"}
            </p>
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
              disabled={connecting}
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
