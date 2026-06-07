import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { instanceName, action } = body;

    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Não autorizado");

    const apiUrl = (Deno.env.get("UAZAPI_SERVER_URL") || "").replace(/\/+$/, "");
    const adminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";
    if (!apiUrl || !adminToken) throw new Error("Servidor não configurado");

    console.log(`Provision: ${action || "create"} - ${instanceName} for user ${user.id}`);

    if (action === "delete") {
      const { instanceToken } = body;
      const response = await fetch(`${apiUrl}/instance/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": instanceToken || adminToken },
      });
      const data = await response.json().catch(() => ({}));
      return new Response(JSON.stringify({ success: response.ok, ...data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!instanceName) throw new Error("instanceName is required");

    // Validar limites do plano
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("max_instances")
      .eq("id", user.id)
      .single();

    const { count } = await supabaseClient
      .from("zapi_instances")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", user.id);

    const maxAllowed = profile?.max_instances ?? 1;
    if ((count || 0) >= maxAllowed) {
      throw new Error(`Limite de instâncias atingido (${count}/${maxAllowed}). Faça upgrade do seu plano.`);
    }

    // uazapiGO: /instance/init usa header admintoken
    const response = await fetch(`${apiUrl}/instance/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "admintoken": adminToken,
      },
      body: JSON.stringify({ name: instanceName }),
    });

    const text = await response.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    console.log("Provision Response:", response.status, data);

    if (!response.ok) {
      const providerMessage = String(data.message || data.error || data.info || `Erro ${response.status}`);
      if (response.status === 429 || providerMessage.toLowerCase().includes("maximum number of instances")) {
        throw new Error("O servidor de conexão configurado atingiu o limite de instâncias. Libere/remova instâncias no painel do provedor ou use uma conta com limite disponível.");
      }
      throw new Error(providerMessage);
    }

    // Se criou com sucesso, registrar no banco vinculado ao usuário
    if (data.token) {
      const { error: dbError } = await supabaseClient
        .from("zapi_instances")
        .insert({
          user_id: user.id,
          instance_name: instanceName,
          zapi_instance_id: data.name || instanceName,
          zapi_token: data.token,
          zapi_client_token: adminToken, // Ou o que for necessário para autenticar chamadas futuras
          status: "disconnected"
        });
      
      if (dbError) console.error("Erro ao registrar no banco:", dbError);
    }

    return new Response(JSON.stringify(data), {
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