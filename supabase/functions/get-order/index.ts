import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id || !/^[0-9a-f-]{8,}$/i.test(id)) {
      return new Response(JSON.stringify({ error: "id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tx, error } = await supabase
      .from("gateway_transactions")
      .select("id, user_id, checkout_id, product_id, customer_name, customer_email, customer_phone, amount, status, payment_method, metadata, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error || !tx) {
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let checkout: any = null;
    if (tx.checkout_id) {
      const { data } = await supabase
        .from("gateway_checkouts")
        .select("id, name, slug, config")
        .eq("id", tx.checkout_id)
        .maybeSingle();
      checkout = data;
    }

    let product: any = null;
    if (tx.product_id) {
      const { data } = await supabase
        .from("gateway_products")
        .select("id, name, image_url, description")
        .eq("id", tx.product_id)
        .maybeSingle();
      product = data;
    }

    return new Response(
      JSON.stringify({ transaction: tx, checkout, product }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});