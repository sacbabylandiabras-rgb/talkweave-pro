 import { corsHeaders } from "../_shared/cors.ts";
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
     const { apiUrl, apiToken, phone } = await req.json();
     if (!apiUrl || !apiToken) throw new Error("apiUrl and apiToken are required");
 
     const cleanUrl = apiUrl.replace(/\/+$/, "");
     
     // Try /instance/connect or similar
     const response = await fetch(`${cleanUrl}/instance/connect`, {
       method: "GET",
       headers: { "Content-Type": "application/json", token: apiToken },
     });
 
     const data = await response.json().catch(() => ({}));
     
     // If phone is provided, try pairing code
     if (phone) {
       const pairingResponse = await fetch(`${cleanUrl}/instance/pairing-code?phone=${phone}`, {
         method: "GET",
         headers: { "Content-Type": "application/json", token: apiToken },
       });
       const pairingData = await pairingResponse.json().catch(() => ({}));
       return new Response(JSON.stringify({ ...data, ...pairingData }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
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