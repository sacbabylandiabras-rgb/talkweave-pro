 import { corsHeaders } from "../_shared/cors.ts";
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
     const { apiUrl, apiToken } = await req.json();
     if (!apiUrl || !apiToken) throw new Error("apiUrl and apiToken are required");
 
     const cleanUrl = apiUrl.replace(/\/+$/, "");
     const withToken = (path: string) => `${cleanUrl}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(apiToken)}`;
     let data = null;
     let lastFailure = "";

     const attempts = [
       { method: "POST", path: "/instance/disconnect" },
       { method: "POST", path: "/instance/logout" },
       { method: "DELETE", path: "/instance/logout" },
     ];

     for (const attempt of attempts) {
       try {
         const response = await fetch(withToken(attempt.path), {
           method: attempt.method,
           headers: { "Content-Type": "application/json", token: apiToken },
           body: attempt.method === "POST" ? JSON.stringify({}) : undefined,
         });
         const payload = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }));
         if (response.ok && !payload?.error) {
           data = { success: true, disconnected: true, ...payload };
           break;
         }
         lastFailure = payload?.error || payload?.message || payload?.raw || `${attempt.method} ${attempt.path} retornou ${response.status}`;
         console.warn(`Disconnect attempt failed: ${attempt.method} ${attempt.path}`, lastFailure);
       } catch (e) {
         lastFailure = e instanceof Error ? e.message : String(e);
         console.error(`Disconnect attempt errored: ${attempt.method} ${attempt.path}`, e);
       }
     }

     if (!data) {
       throw new Error(lastFailure || "Não foi possível desconectar a instância.");
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