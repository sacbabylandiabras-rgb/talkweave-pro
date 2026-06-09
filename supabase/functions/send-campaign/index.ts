import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Buscar a campanha e a instância (UAZAPI)
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("campaigns")
      .select(`
        *,
        zapi_instances (
          instance_id,
          instance_token,
          provider
        )
      `)
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campanha não encontrada");
    }

    const instance = campaign.zapi_instances;
    if (!instance) {
      throw new Error("Instância não configurada na campanha");
    }

    // 2. Buscar contatos para envio
    const { data: contacts, error: contactsError } = await supabaseClient
      .from("saved_contacts")
      .select("phone")
      .eq("user_id", campaign.user_id);

    if (contactsError || !contacts || contacts.length === 0) {
      throw new Error("Nenhum contato encontrado para envio");
    }

    // 3. Processar envios via UAZAPI
    console.log(`Iniciando campanha ${campaignId} para ${contacts.length} contatos usando UAZAPI`);
    
    // Atualiza status da campanha para 'processing'
    await supabaseClient
      .from("campaigns")
      .update({ status: "processing" })
      .eq("id", campaignId);

    let successCount = 0;
    let errorCount = 0;

    for (const contact of contacts) {
      try {
        // Endpoint UAZAPI para envio de texto
        const response = await fetch(`https://api.uazapi.com.br/instances/${instance.instance_id}/token/${instance.instance_token}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: contact.phone,
            message: campaign.message
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          const errorData = await response.text();
          console.error(`Erro ao enviar para ${contact.phone}:`, errorData);
          errorCount++;
        }

        // Delay entre envios conforme configurado na campanha
        if (campaign.delay_seconds > 0) {
          await new Promise(resolve => setTimeout(resolve, campaign.delay_seconds * 1000));
        }
      } catch (err) {
        console.error(`Falha técnica no envio para ${contact.phone}:`, err);
        errorCount++;
      }
    }

    // 4. Finalizar campanha
    await supabaseClient
      .from("campaigns")
      .update({ status: successCount > 0 ? "completed" : "failed" })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({ 
        message: "Campanha finalizada", 
        success: successCount, 
        errors: errorCount 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
