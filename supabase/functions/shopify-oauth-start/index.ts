const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const APP_ORIGIN = "https://talkweave-pro.lovable.app";
const CALLBACK_PATH = "/shopify-oauth-callback";
const SHOPIFY_SCOPES = [
  "read_products",
  "write_products",
  "read_orders",
  "write_orders",
  "read_inventory",
  "write_inventory",
].join(",");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeShopDomain(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");

  if (!normalized.endsWith(".myshopify.com")) {
    return `${normalized.replace(/\.myshopify\.com$/, "")}.myshopify.com`;
  }

  return normalized;
}

function resolveOrigin(input: unknown) {
  if (typeof input !== "string") return APP_ORIGIN;

  try {
    const url = new URL(input);
    const isLovableHost = url.hostname.endsWith(".lovable.app");
    const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    return isLovableHost || isLocalHost ? url.origin : APP_ORIGIN;
  } catch {
    return APP_ORIGIN;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID");

    if (!SUPABASE_URL) return json({ error: "SUPABASE_URL is not configured" }, 500);
    if (!SUPABASE_ANON_KEY) return json({ error: "SUPABASE_ANON_KEY is not configured" }, 500);
    if (!SHOPIFY_CLIENT_ID) return json({ error: "SHOPIFY_CLIENT_ID is not configured" }, 500);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Sessão inválida. Faça login novamente." }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Sessão inválida. Faça login novamente." }, 401);
    }

    const body = await req.json().catch(() => null);
    const shop = typeof body?.shop === "string" ? sanitizeShopDomain(body.shop) : "";
    const origin = resolveOrigin(body?.origin);

    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
      return json({ error: "Informe um domínio MyShopify válido." }, 400);
    }

    const redirectUri = `${APP_ORIGIN}${CALLBACK_PATH}`;
    const nonce = crypto.randomUUID();
    const statePayload = btoa(JSON.stringify({
      nonce,
      origin,
      shop,
      userId: user.id,
      ts: Date.now(),
    }));

    const installUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    installUrl.searchParams.set("client_id", SHOPIFY_CLIENT_ID);
    installUrl.searchParams.set("scope", SHOPIFY_SCOPES);
    installUrl.searchParams.set("redirect_uri", redirectUri);
    installUrl.searchParams.set("state", statePayload);

    return json({ installUrl: installUrl.toString(), shop });
  } catch (error) {
    console.error("shopify-oauth-start error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro ao iniciar conexão com Shopify." }, 500);
  }
});