import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mercadolibre-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const bodyText = await req.text();
    const event = JSON.parse(bodyText);

    console.log("[ML Webhook] Evento:", event.topic, event.resource);

    const ml_user_id = event.user_id;
    const { data: connection } = await supabase
      .from("mercadolivre_connections")
      .select("user_id, access_token")
      .eq("mercadolivre_user_id", ml_user_id?.toString())
      .single();

    if (!connection) return new Response("Ignored", { status: 200 });

    await supabase.from("ml_webhook_events").insert({
      user_id: connection.user_id,
      topic: event.topic,
      resource: event.resource,
      data: event,
      processed_at: new Date().toISOString()
    });

    if (event.topic?.startsWith("promotions")) {
        const promotion_id = event.resource.split("/").pop();
        const mlResponse = await fetch(`https://api.mercadolibre.com/seller-promotions/promotions/${promotion_id}?app_version=v2`, {
            headers: { "Authorization": `Bearer ${connection.access_token}` }
        });

        if (mlResponse.ok) {
            const promoData = await mlResponse.json();
            await supabase.from("ml_webhook_promotions").upsert({
                user_id: connection.user_id,
                promotion_id,
                data: promoData,
                status: promoData.status,
                type: promoData.type,
                updated_at: new Date().toISOString()
            });
        }
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
