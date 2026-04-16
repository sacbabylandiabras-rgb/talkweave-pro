const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const DEFAULT_ORIGIN = "https://talkweave-pro.lovable.app";
const SUCCESS_PATH = "/gateway-checkout/integrations";
const API_VERSION = "2025-01";

type ShopifyState = {
  nonce: string;
  origin: string;
  shop: string;
  userId: string;
  ts: number;
};

function buildRedirect(origin: string, params: Record<string, string>) {
  const url = new URL(`${origin}${SUCCESS_PATH}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function redirect(url: string) {
  return Response.redirect(url, 302);
}

function parseState(raw: string | null): ShopifyState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(atob(raw)) as ShopifyState;
    if (!parsed?.shop || !parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let result = 0;
  for (let i = 0; i < aBytes.length; i += 1) result |= aBytes[i] ^ bBytes[i];
  return result === 0;
}

async function verifyShopifyHmac(searchParams: URLSearchParams, secret: string) {
  const entries = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b));

  const message = entries.map(([key, value]) => `${key}=${value}`).join("&");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const digest = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(digest, searchParams.get("hmac") || "");
}

async function fetchShopSummary(shop: string, accessToken: string) {
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `query ShopSummary { shop { name email myshopifyDomain currencyCode } }`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errors) {
    throw new Error(`Falha ao validar a loja Shopify [${response.status}]`);
  }

  return payload?.data?.shop ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const origin = url.searchParams.get("origin") || DEFAULT_ORIGIN;
  const state = parseState(url.searchParams.get("state"));
  const resolvedOrigin = state?.origin || origin || DEFAULT_ORIGIN;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID");
    const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
      return redirect(buildRedirect(resolvedOrigin, { shopify_error: "1", message: "Configuração da Shopify incompleta." }));
    }

    const code = url.searchParams.get("code");
    const shop = url.searchParams.get("shop");
    const hmac = url.searchParams.get("hmac");

    if (!code || !shop || !hmac || !state) {
      return redirect(buildRedirect(resolvedOrigin, { shopify_error: "1", message: "Parâmetros inválidos do Shopify." }));
    }

    const isValidHmac = await verifyShopifyHmac(url.searchParams, SHOPIFY_CLIENT_SECRET);
    if (!isValidHmac) {
      return redirect(buildRedirect(resolvedOrigin, { shopify_error: "1", message: "Assinatura do Shopify inválida." }));
    }

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });
    const tokenPayload = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      console.error("Shopify token exchange failed:", tokenPayload);
      return redirect(buildRedirect(resolvedOrigin, { shopify_error: "1", message: "Não foi possível autorizar a loja Shopify." }));
    }

    const accessToken = tokenPayload.access_token as string;
    const scope = tokenPayload.scope as string | undefined;
    const shopInfo = await fetchShopSummary(shop, accessToken);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload = {
      user_id: state.userId,
      name: "Shopify",
      webhook_url: `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
      method: "POST",
      auth_type: "X-Shopify-Access-Token",
      auth_token: accessToken,
      active: true,
      headers: {
        domain: shop,
        scope: scope || "",
        store_name: shopInfo?.name || null,
        store_email: shopInfo?.email || null,
        currency_code: shopInfo?.currencyCode || null,
        myshopify_domain: shopInfo?.myshopifyDomain || shop,
      },
    };

    const { data: existing } = await supabase
      .from("gateway_integrations")
      .select("id")
      .eq("user_id", state.userId)
      .eq("name", "Shopify")
      .maybeSingle();

    const { error } = existing
      ? await supabase.from("gateway_integrations").update(payload).eq("id", existing.id)
      : await supabase.from("gateway_integrations").insert(payload);

    if (error) {
      console.error("Shopify save integration error:", error);
      return redirect(buildRedirect(resolvedOrigin, { shopify_error: "1", message: "Não foi possível salvar a integração Shopify." }));
    }

    return redirect(buildRedirect(resolvedOrigin, { shopify_connected: "1" }));
  } catch (error) {
    console.error("shopify-oauth-callback error:", error);
    return redirect(buildRedirect(resolvedOrigin, {
      shopify_error: "1",
      message: error instanceof Error ? error.message : "Erro ao concluir integração Shopify.",
    }));
  }
});