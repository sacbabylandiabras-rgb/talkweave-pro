import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { instanceName, action } = body;

    const apiUrl = (Deno.env.get("UAZAPI_SERVER_URL") || "").replace(/\/+$/, "");
    const adminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";
    if (!apiUrl || !adminToken) throw new Error("Servidor não configurado");

    console.log(`Provision: ${action || "create"} - ${instanceName}`);

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
      throw new Error(data.message || data.error || `Erro ${response.status}`);
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