 import { corsHeaders } from "../_shared/cors.ts";
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
     const { apiUrl, apiToken } = await req.json();
     if (!apiUrl || !apiToken) throw new Error("apiUrl and apiToken are required");
 
     const cleanUrl = apiUrl.replace(/\/+$/, "");
      let data = null;
      let success = false;

      // Try DELETE /instance/logout (UAZAPI / Evolution standard)
      try {
        const resp1 = await fetch(`${cleanUrl}/instance/logout`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", token: apiToken },
        });
        if (resp1.ok) {
          data = await resp1.json().catch(() => ({ success: true }));
          success = true;
        }
      } catch (e) {
        console.error("Logout DELETE failed:", e);
      }

      // Try POST /instance/logout if DELETE failed
      if (!success) {
        try {
          const resp2 = await fetch(`${cleanUrl}/instance/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: apiToken },
          });
          if (resp2.ok) {
            data = await resp2.json().catch(() => ({ success: true }));
            success = true;
          }
        } catch (e) {
          console.error("Logout POST failed:", e);
        }
      }

      // Fallback: Try DELETE /instance/delete if logout isn't working to clear session
      if (!success) {
        try {
          const resp3 = await fetch(`${cleanUrl}/instance/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", token: apiToken },
          });
          if (resp3.ok) {
            data = await resp3.json().catch(() => ({ success: true }));
            success = true;
          }
        } catch (e) {
          console.error("Delete DELETE failed:", e);
        }
      }

      if (!success && !data) {
        throw new Error("Não foi possível desconectar a instância através dos métodos conhecidos.");
      }

     return new Response(JSON.stringify(data), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (err) {
     return new Response(JSON.stringify({ error: err.message }), {
       status: 400,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });