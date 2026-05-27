import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Tool exposed to the AI agent: creates a PIX charge through the user's
 * configured gateway and returns brcode / qrcode_image / id / amount so the
 * agent can paste them into the conversation.
 *
 * Body: { userId, amount?, productId?, description?, lead? }
 * - amount: in BRL (decimal). If omitted and productId is given, the product
 *   price is used.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || "").trim();
    let amount = Number(body.amount || 0); // BRL
    const productId = body.productId ? String(body.productId) : null;
    let description = String(body.description || "").trim();
    const lead = body.lead || {};

    if (!userId) {
      return json({ error: "userId obrigatório" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve amount/description from product if needed
    if (productId) {
      const { data: product } = await supabase
        .from("agent_products")
        .select("name, price")
        .eq("id", productId)
        .eq("user_id", userId)
        .maybeSingle();
      if (product) {
        if (!amount || amount <= 0) amount = Number(product.price || 0);
        if (!description) description = String(product.name || "");
      }
    }

    if (!amount || amount <= 0) {
      return json({ error: "amount > 0 obrigatório (ou productId válido)" }, 400);
    }
    if (!description) description = "Pagamento";

    // Delegate to gateway-flow-charge (amount in cents)
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gateway-flow-charge`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        userId,
        amount: Math.round(amount * 100),
        description,
        customerName: lead?.name || null,
        customerEmail: lead?.email || null,
        customerPhone: lead?.phone || null,
        customerCpf: lead?.document || null,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return json({ error: data?.error || "Falha ao gerar cobrança" }, resp.status);
    }

    return json({
      ok: true,
      charge: {
        id: data.externalId,
        amount,
        brcode: data.brCode,
        qrcode_image: data.qrCodeImage,
        description,
      },
    });
  } catch (err) {
    console.error("[agent-create-charge] error", err);
    return json({ error: String(err?.message || err) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}