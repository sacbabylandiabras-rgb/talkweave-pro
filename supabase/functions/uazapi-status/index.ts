 import { corsHeaders } from "../_shared/cors.ts";
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
     const { apiUrl, apiToken } = await req.json();
     if (!apiUrl || !apiToken) throw new Error("apiUrl and apiToken are required");
 
     const cleanUrl = apiUrl.replace(/\/+$/, "");
     const endpoints = ["/instance/status", "/status", "/instance"];
     
     let lastError = null;
     for (const ep of endpoints) {
       try {
         const response = await fetch(`${cleanUrl}${ep}`, {
           method: "GET",
           headers: { "Content-Type": "application/json", token: apiToken },
         });
         
         if (!response.ok) continue;
         const data = await response.json();
         
         const status = String(
           data?.instance?.status || data?.status || data?.connectionStatus || data?.state || ""
         ).toLowerCase();
         
         const connected =
           data?.connected === true ||
           data?.loggedIn === true ||
           data?.instance?.connected === true ||
           ["connected", "open", "online", "logged_in", "loggedin"].some((s) => status === s);
 
         return new Response(JSON.stringify({ connected, status, qrCode: data?.qrCode || data?.qrcode || null }), {
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       } catch (e) {
         lastError = e;
       }
     }
 
     throw lastError || new Error("Failed to check status");
   } catch (err) {
     return new Response(JSON.stringify({ error: err.message }), {
       status: 400,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });