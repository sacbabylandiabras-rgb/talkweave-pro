 import { corsHeaders } from "../_shared/cors.ts";
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
     const { apiUrl, apiToken } = await req.json();
     if (!apiUrl || !apiToken) throw new Error("apiUrl and apiToken are required");
 
     const cleanUrl = apiUrl.replace(/\/+$/, "");
     const response = await fetch(`${cleanUrl}/instance/logout`, {
       method: "DELETE",
       headers: { "Content-Type": "application/json", token: apiToken },
     });
 
     const data = await response.json().catch(() => ({}));
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