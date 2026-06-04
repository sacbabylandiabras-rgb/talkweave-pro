import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mercadolibre-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * MERCADO LIVRE WEBHOOK LISTENER
 * Recebe eventos do ML em tempo real
 */

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
    const signature = req.headers.get("x-mercadolibre-signature");

    console.log("[ML Webhook] Evento recebido:", event.topic, event.resource);

    // O ML envia user_id no payload
    const ml_user_id = event.user_id;
    
    // Buscar usuário interno correspondente
    const { data: connection } = await supabase
      .from("mercadolivre_connections")
      .select("user_id, access_token")
      .eq("mercadolivre_user_id", ml_user_id.toString())
      .single();

    if (!connection) {
      console.warn("[ML Webhook] Usuário não encontrado para ML ID:", ml_user_id);
      return new Response("Ignored", { status: 200 });
    }

    // Registrar evento
    await supabase.from("ml_webhook_events").insert({
      user_id: connection.user_id,
      topic: event.topic,
      resource: event.resource,
      data: event,
      processed_at: new Date().toISOString()
    });

    // Processar de acordo com o tópico
    if (event.topic === "promotions" || event.topic === "promotions_seller") {
        // Buscar detalhes da promoção no ML e salvar
        const promotion_id = event.resource.split("/").pop();
        console.log(`[ML Webhook] Sincronizando promoção ${promotion_id}`);
        
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
    } else if (event.topic === "items") {
        const item_id = event.resource.split("/").pop();
        console.log(`[ML Webhook] Sincronizando item ${item_id}`);

        const mlResponse = await fetch(`https://api.mercadolibre.com/items/${item_id}`, {
            headers: { "Authorization": `Bearer ${connection.access_token}` }
        });

        if (mlResponse.ok) {
            const itemData = await mlResponse.json();
            await supabase.from("ml_webhook_items").upsert({
                user_id: connection.user_id,
                item_id,
                data: itemData,
                title: itemData.title,
                price: itemData.price,
                status: itemData.status,
                updated_at: new Date().toISOString()
            });
        }
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("[ML Webhook Error]", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
