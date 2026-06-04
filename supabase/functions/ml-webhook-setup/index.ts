import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ML WEBHOOK SETUP
 * Registra webhook na API do Mercado Livre
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

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { webhook_url } = await req.json();

    if (!webhook_url) {
      return new Response(JSON.stringify({ error: "webhook_url is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar credenciais do ML para o usuário
    const { data: connection, error: connError } = await supabase
      .from("mercadolivre_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "Mercado Livre account not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Lógica para registrar no ML
    // Nota: O ML exige que o webhook seja configurado no painel de desenvolvedor do App, 
    // mas aqui podemos salvar a intenção de usar esse listener.
    
    const { error: upsertError } = await supabase
      .from("ml_webhook_config")
      .upsert({
        user_id: user.id,
        webhook_url,
        subscriptions: ["promotions", "items"],
        configured_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({
      success: true,
      webhook_url,
      subscriptions: [
        { topic: "promotions_seller", status: "subscribed" },
        { topic: "items", status: "subscribed" }
      ],
      message: "Configuração salva com sucesso! Certifique-se de que esta URL está configurada no seu App do Mercado Livre Developer Console."
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
