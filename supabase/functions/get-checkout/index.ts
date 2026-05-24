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
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch checkout by slug or id
    let { data: checkout, error } = await supabase
      .from("gateway_checkouts")
      .select("*")
      .eq("slug", slug)
      .eq("status", true)
      .maybeSingle();

    // Fallback: try by id
    if (!checkout) {
      const res = await supabase
        .from("gateway_checkouts")
        .select("*")
        .eq("id", slug)
        .eq("status", true)
        .maybeSingle();
      checkout = res.data;
      error = res.error;
    }

    if (error || !checkout) {
      return new Response(JSON.stringify({ error: "Checkout not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment visits
    await supabase
      .from("gateway_checkouts")
      .update({ visits: (checkout.visits || 0) + 1 })
      .eq("id", checkout.id);

    // Fetch product and plans if linked
    let product = null;
    let plans = [];
    if (checkout.product_id) {
      const { data: prod } = await supabase
        .from("gateway_products")
        .select("id, name, description, price, image_url")
        .eq("id", checkout.product_id)
        .maybeSingle();
      product = prod;

      if (product) {
        const { data: pls } = await supabase
          .from("gateway_plans")
          .select("*")
          .eq("product_id", product.id);
        plans = pls || [];
      }
    }

    // Fetch active pixels owned by checkout user (public-safe fields only)
    let pixels: any[] = [];
    if (checkout.user_id) {
      const { data: pxs } = await supabase
        .from("gateway_pixels")
        .select("platform, pixel_id, events, active, extra_config")
        .eq("user_id", checkout.user_id)
        .eq("active", true);
      pixels = pxs || [];
    }

    return new Response(JSON.stringify({ checkout, product, plans, pixels }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
