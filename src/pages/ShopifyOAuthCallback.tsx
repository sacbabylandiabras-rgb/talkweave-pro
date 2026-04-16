import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const CALLBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth-callback`;

const ShopifyOAuthCallback = () => {
  useEffect(() => {
    const search = window.location.search;

    if (!search) {
      window.location.replace("/gateway-checkout/integrations?shopify_error=1&message=Parâmetros inválidos do Shopify.");
      return;
    }

    window.location.replace(`${CALLBACK_URL}${search}`);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Conectando Shopify</h1>
        <p className="text-sm text-muted-foreground">
          Estamos validando a autorização da loja e redirecionando você.
        </p>
      </div>
    </main>
  );
};

export default ShopifyOAuthCallback;