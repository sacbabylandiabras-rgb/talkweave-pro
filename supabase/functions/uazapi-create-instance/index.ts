import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { instanceName, action } = body;
    
    // Configurações padrão do servidor UAZAPI
    const apiUrl = "https://zaplynx-uazapi-01.evolution-api.com";
    const apiToken = "3B8E3D7C6F2A4B1D9E0A7C5F3B8E3D7C";

    console.log(`UAZAPI Create/Manage: ${action || 'create'} - Instance: ${instanceName}`);

    if (action === "delete") {
      const { instanceToken } = body;
      const response = await fetch(`${apiUrl}/instance/logout?token=${instanceToken}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "token": apiToken }
      });
      const data = await response.json().catch(() => ({}));
      return new Response(JSON.stringify({ success: response.ok, ...data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Caso padrão: Criar instância
    if (!instanceName) throw new Error("instanceName is required");

    const response = await fetch(`${apiUrl}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": apiToken
      },
      body: JSON.stringify({
        instanceName: instanceName,
        token: apiToken,
        qrcode: true
      })
    });

    const data = await response.json().catch(async () => ({ error: await response.text() }));
    console.log("UAZAPI Response:", data);

    if (!response.ok) {
      throw new Error(data.message || data.error || `Erro ${response.status} ao criar instância`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});