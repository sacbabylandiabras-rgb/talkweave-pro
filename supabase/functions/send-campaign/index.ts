import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

interface SendCampaignRequest {
  campaignId: string;
  contacts: Array<{
    phone: string;
    name?: string;
    variables?: Record<string, string>;
  }>;
  instanceId?: string;
  forceSend?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: SendCampaignRequest = await req.json();
    const { campaignId, contacts, instanceId: requestedInstanceId } = body;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) throw new Error("Não autorizado");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Não autorizado");

    // 1. Carregar dados da campanha
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("campaigns")
      .select(`*, template:message_templates(*)`)
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) throw new Error("Campanha não encontrada");

    // 2. Determinar a instância a ser usada (UAZAPI por padrão)
    let targetInstance: any = null;
    if (requestedInstanceId) {
      const { data: inst } = await supabaseClient
        .from("zapi_instances")
        .select("*")
        .eq("id", requestedInstanceId)
        .eq("user_id", user.id)
        .maybeSingle();
      targetInstance = inst;
    }

    if (!targetInstance) {
      const { data: inst } = await supabaseClient
        .from("zapi_instances")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .eq("api_provider", "uazapi")
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      targetInstance = inst;
    }

    if (!targetInstance) throw new Error("Nenhuma instância UAZAPI ativa encontrada.");

    const apiUrl = targetInstance.evolution_api_url || Deno.env.get("UAZAPI_SERVER_URL");
    const instanceToken = targetInstance.zapi_token;

    if (!apiUrl || !instanceToken) throw new Error("Configuração da instância inválida.");

    console.log(`🚀 Iniciando envio da campanha ${campaignId} via UAZAPI (${targetInstance.instance_name})`);

    // 3. Processar contatos
    const results = [];
    for (const contact of contacts) {
      try {
        let message = campaign.template.content;
        
        // Substituir variáveis
        if (contact.variables) {
          Object.entries(contact.variables).forEach(([key, val]) => {
            message = message.replace(new RegExp(`{${key}}`, "g"), val);
          });
        }
        if (contact.name) {
          message = message.replace(/{nome}/g, contact.name);
        }

        const cleanPhone = contact.phone.replace(/\D/g, "");
        const formattedPhone = cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone;

        const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/message/text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instanceToken,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        });

        const resData = await response.json().catch(() => ({}));
        const success = response.ok && (resData.key?.id || resData.messageId);

        // Registrar envio no banco
        await supabaseClient.from("campaign_sends").insert({
          campaign_id: campaignId,
          phone: contact.phone,
          contact_name: contact.name,
          message_content: message,
          status: success ? "sent" : "failed",
          sent_at: success ? new Date().toISOString() : null,
          error_message: success ? null : (resData.message || resData.error || "Erro desconhecido"),
          message_id: resData.key?.id || resData.messageId || null,
        });

        results.push({ phone: contact.phone, success });
        
        // Delay entre envios para evitar ban
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

      } catch (contactErr) {
        console.error(`Erro ao enviar para ${contact.phone}:`, contactErr);
        results.push({ phone: contact.phone, success: false, error: contactErr.message });
      }
    }

    // 4. Atualizar status da campanha se finalizada
    await supabaseClient.from("campaigns").update({ status: "completed" }).eq("id", campaignId);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
