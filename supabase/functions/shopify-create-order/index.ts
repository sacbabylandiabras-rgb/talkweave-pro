import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const API_VERSION = "2025-01";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL) return json({ error: "SUPABASE_URL is not configured" }, 500);
    if (!SUPABASE_SERVICE_ROLE_KEY) return json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, 500);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => null);
    const transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";

    if (!transactionId) return json({ error: "transactionId é obrigatório." }, 400);

    const { data: tx, error: txError } = await adminClient
      .from("gateway_transactions")
      .select("id, user_id, status, amount, product_id, customer_name, customer_email, customer_phone, external_id, metadata")
      .eq("id", transactionId)
      .maybeSingle();

    if (txError || !tx) return json({ error: "Transação não encontrada." }, 404);
    if (tx.status !== "approved") return json({ error: "Apenas transações aprovadas podem virar pedido Shopify." }, 400);

    const metadata = (tx.metadata as Record<string, unknown> | null) || {};
    if (metadata.shopify_order_id) return json({ created: false, reason: "order_exists", orderId: metadata.shopify_order_id });

    const [{ data: integration }, { data: product }] = await Promise.all([
      adminClient
        .from("gateway_integrations")
        .select("auth_token, headers, active")
        .eq("user_id", tx.user_id)
        .eq("name", "Shopify")
        .eq("active", true)
        .maybeSingle(),
      tx.product_id
        ? adminClient.from("gateway_products").select("name, sku").eq("id", tx.product_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const shopDomain = (integration?.headers as Record<string, string> | null)?.domain;
    const accessToken = integration?.auth_token;

    if (!integration?.active || !shopDomain || !accessToken) {
      return json({ error: "Shopify não está conectada ou ativa para esse usuário." }, 400);
    }

    const mutation = `mutation DraftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          invoiceUrl
          order { id name }
        }
        userErrors { field message }
      }
    }`;

    const draftOrderInput = {
      email: tx.customer_email || undefined,
      note: `Pedido criado automaticamente pela venda ${tx.external_id || tx.id}`,
      tags: ["zaplynxpay", "shopify-auto-order"],
      lineItems: [
        {
          title: product?.name || "Produto ZapLynxPay",
          sku: product?.sku || undefined,
          originalUnitPrice: (tx.amount / 100).toFixed(2),
          quantity: 1,
        },
      ],
      billingAddress: tx.customer_name
        ? {
            address1: tx.customer_name,
            city: "São Paulo",
            country: "Brazil",
            firstName: tx.customer_name,
            phone: tx.customer_phone || undefined,
          }
        : undefined,
    };

    const response = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: mutation, variables: { input: draftOrderInput } }),
    });

    const payload = await response.json().catch(() => ({}));
    const userErrors = payload?.data?.draftOrderCreate?.userErrors ?? [];
    if (!response.ok || payload?.errors || userErrors.length > 0) {
      console.error("Shopify create order error:", payload);
      const message = userErrors[0]?.message || payload?.errors?.[0]?.message || `Falha ao criar pedido Shopify [${response.status}]`;
      return json({ error: message }, 502);
    }

    const draftOrder = payload?.data?.draftOrderCreate?.draftOrder;
    const orderId = draftOrder?.order?.id || draftOrder?.id;

    await adminClient
      .from("gateway_transactions")
      .update({
        metadata: {
          ...metadata,
          shopify_order_id: orderId,
          shopify_invoice_url: draftOrder?.invoiceUrl || null,
        },
      })
      .eq("id", tx.id);

    return json({ created: true, orderId, invoiceUrl: draftOrder?.invoiceUrl || null });
  } catch (error) {
    console.error("shopify-create-order error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro ao criar pedido na Shopify." }, 500);
  }
});