import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const API_VERSION = "2025-01";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parsePrice(amount: string | null | undefined) {
  const num = Number(amount || 0);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

function inferCategory(tags: string[] | undefined) {
  if (!tags?.length) return null;
  return tags[0] || null;
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL) return json({ error: "SUPABASE_URL is not configured" }, 500);
    if (!SUPABASE_ANON_KEY) return json({ error: "SUPABASE_ANON_KEY is not configured" }, 500);
    if (!SUPABASE_SERVICE_ROLE_KEY) return json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, 500);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Sessão inválida. Faça login novamente." }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Sessão inválida. Faça login novamente." }, 401);
    }

    const body = await req.json().catch(() => null);
    const integrationId = typeof body?.integrationId === "string" ? body.integrationId : "";
    if (!integrationId) return json({ error: "integrationId é obrigatório." }, 400);

    const { data: integration, error: integrationError } = await adminClient
      .from("gateway_integrations")
      .select("id, auth_token, headers")
      .eq("id", integrationId)
      .eq("user_id", user.id)
      .eq("name", "Shopify")
      .maybeSingle();

    if (integrationError || !integration) {
      return json({ error: "Integração Shopify não encontrada." }, 404);
    }

    const shopDomain = (integration.headers as Record<string, string> | null)?.domain;
    const accessToken = integration.auth_token;

    if (!shopDomain || !accessToken) {
      return json({ error: "Integração Shopify incompleta." }, 400);
    }

    const query = `query ProductSync($first: Int!) {
      products(first: $first, query: "status:active") {
        edges {
          node {
            id
            title
            descriptionHtml
            featuredImage { url }
            productType
            tags
            variants(first: 1) {
              edges {
                node {
                  sku
                  price
                  inventoryItem { tracked }
                }
              }
            }
          }
        }
      }
    }`;

    const response = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { first: 50 } }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.errors) {
      console.error("Shopify sync GraphQL error:", payload);
      return json({ error: `Falha ao buscar produtos da Shopify [${response.status}]` }, 502);
    }

    const edges = payload?.data?.products?.edges ?? [];
    let importedCount = 0;

    for (const edge of edges) {
      const product = edge?.node;
      const variant = product?.variants?.edges?.[0]?.node;
      const externalId = String(product?.id || "");
      if (!externalId || !product?.title) continue;

      const candidate = {
        user_id: user.id,
        name: product.title,
        description: product.descriptionHtml || null,
        price: parsePrice(variant?.price),
        sku: variant?.sku || `shopify-${externalId.split("/").pop()}`,
        category: product.productType || inferCategory(product.tags) || "Shopify",
        image_url: product.featuredImage?.url || null,
        type: variant?.inventoryItem?.tracked ? "physical" : "digital",
        status: true,
      };

      const { data: existing } = await adminClient
        .from("gateway_products")
        .select("id")
        .eq("user_id", user.id)
        .eq("sku", candidate.sku)
        .maybeSingle();

      const result = existing
        ? await adminClient.from("gateway_products").update(candidate).eq("id", existing.id)
        : await adminClient.from("gateway_products").insert(candidate);

      if (!result.error) importedCount += 1;
    }

    return json({ importedCount, totalFetched: edges.length });
  } catch (error) {
    console.error("shopify-sync-products error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro ao sincronizar produtos da Shopify." }, 500);
  }
});