 import { corsHeaders } from "../_shared/cors.ts";

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
    try {
      const { apiUrl, apiToken, instanceName } = await req.json();
      if (!apiUrl || !apiToken) throw new Error("apiUrl and apiToken are required");
  
      const cleanUrl = apiUrl.replace(/\/+$/, "");
      const withToken = (path: string) => `${cleanUrl}${path}${path.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(apiToken)}`;
      
      const endpoints = [];
      if (instanceName) {
        endpoints.push(`/instance/connectionStatus/${instanceName}`);
        endpoints.push(`/instance/status/${instanceName}`);
      }
      endpoints.push("/instance/status");
      endpoints.push("/status");
      endpoints.push("/instance");
      
      const headers = { 
        "Content-Type": "application/json", 
        "token": apiToken,
        "apikey": apiToken 
      };

      let lastError = null;
      for (const ep of endpoints) {
        try {
          console.log(`Checking status at: ${ep}`);
          const response = await fetch(withToken(ep), {
            method: "GET",
            headers,
          });
          
          if (!response.ok) {
            console.log(`Status endpoint ${ep} returned ${response.status}`);
            continue;
          }

          const data = await response.json();
          console.log(`Data from ${ep}:`, JSON.stringify(data).substring(0, 100));
          
          const status = String(
            data?.instance?.status || 
            data?.status || 
            data?.connectionStatus || 
            data?.state || 
            data?.instance?.state || 
            ""
          ).toLowerCase();
          
          const negativeStates = ["disconnected", "disconnect", "closed", "close", "logout", "logged_out", "loggedout", "offline", "connecting"];
          
          const isDisconnected = 
            data?.connected === false ||
            data?.loggedIn === false ||
            data?.instance?.connected === false ||
            negativeStates.some((s) => status === s || status.includes(s));
          
          const connected = !isDisconnected && (
            data?.connected === true ||
            data?.loggedIn === true ||
            data?.instance?.connected === true ||
            ["connected", "open", "online", "logged_in", "loggedin", "connected_in"].some((s) => status === s)
          );
  
           const qrCode = pickFirstString(
             data?.qrCode, data?.qrcode, data?.base64, data?.code, 
             data?.data?.qrCode, data?.data?.qrcode, data?.data?.base64, data?.data?.code, 
             data?.instance?.qrCode, data?.instance?.qrcode, data?.instance?.base64, data?.instance?.code
           );
           
           const pairingCode = pickFirstString(data?.pairingCode, data?.pairing_code, data?.data?.pairingCode);
           
           console.log(`Normalized: connected=${connected}, status=${status}, hasQr=${!!qrCode}`);

           return new Response(JSON.stringify({ connected, status, qrCode, pairingCode }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error(`Error checking ${ep}:`, e.message);
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