import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const FLOW_CAPTURE_PREFIX = "__flow_capture__:";
const FLOW_BUTTON_PREFIX = "__flow_button__:";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const webhook = await req.json();
    console.log("Webhook Z-API:", JSON.stringify(webhook).slice(0, 500));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const phone = webhook?.phone || webhook?.chatPhone || "";
    const messageRaw = webhook?.text?.message || webhook?.message?.text || webhook?.text || "";
    const instanceId = webhook?.instanceId || "";

    if (!phone || !messageRaw) return new Response("no_data", { status: 200, headers: corsHeaders });

    // Encontrar usuário pela instância
    const { data: instanceData } = await supabase
      .from("zapi_instances")
      .select("user_id, zapi_token, zapi_client_token, zapi_instance_id")
      .eq("zapi_instance_id", instanceId)
      .maybeSingle();

    if (!instanceData) return new Response("instance_not_found", { status: 200, headers: corsHeaders });

    const userId = instanceData.user_id;

    // Lógica simplificada de captura de dados
    const { data: pendingFlowLog } = await supabase
      .from("message_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", phone)
      .in("keyword_matched", [`${FLOW_CAPTURE_PREFIX}${userId}`])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingFlowLog) {
      const pendingState = JSON.parse(pendingFlowLog.response_sent || "{}");
      console.log("Retomando captura:", pendingState.field);
      
      // Deletar log pendente
      await supabase.from("message_logs").delete().eq("id", pendingFlowLog.id);
      
      // Registrar dado capturado
      const updateData: any = {};
      updateData[pendingState.field] = messageRaw;
      
      await supabase.from("flow_captured_data").upsert({
        user_id: userId,
        flow_id: pendingState.flowId,
        phone,
        ...updateData,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,flow_id,phone" });

      // Responder com confirmação básica ou avançar fluxo (simplificado aqui para restaurar serviço)
      await fetch(`https://api.z-api.io/instances/${instanceData.zapi_instance_id}/token/${instanceData.zapi_token}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": instanceData.zapi_client_token || "" },
        body: JSON.stringify({ phone, message: "Recebido, obrigado!" })
      });
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return new Response("error", { status: 200, headers: corsHeaders });
  }
});
