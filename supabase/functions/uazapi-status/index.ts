 import { corsHeaders } from "../_shared/cors.ts";

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};
 
 Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
    try {
      const body = await req.json();
      const { apiUrl, apiToken } = body;
      const instanceName = body.instanceName || body.instance_name;
      if (!apiUrl || !apiToken) throw new Error("apiUrl and apiToken are required");
  
      const cleanUrl = apiUrl.replace(/\/+$/, "");
      const withToken = (path: string) => {
        const url = new URL(`${cleanUrl}${path}`);
        url.searchParams.set("token", apiToken);
        url.searchParams.set("apikey", apiToken);
        url.searchParams.set("admintoken", apiToken);
        return url.toString();
      };
      
      const endpoints = ["/instance/status", "/status", "/instance"];
      if (instanceName) {
        endpoints.unshift(`/instance/status/${instanceName}`);
        endpoints.unshift(`/instance/connectionStatus/${instanceName}`);
      }

      const headers: Record<string, string> = { 
        "Content-Type": "application/json", 
        "token": apiToken,
        "apikey": apiToken,
        "admintoken": apiToken,
        "Authorization": `Bearer ${apiToken}`,
        "instance": instanceName || "",
        "instance_name": instanceName || ""
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

          const resText = await response.text();
          console.log(`Raw status from ${ep}:`, resText);
          const data = JSON.parse(resText || "{}");
          
          const statusRaw = 
            data?.instance?.status || 
            data?.status?.checked_instance?.connection_status ||
            data?.status?.connection_status ||
            data?.status || 
            data?.connectionStatus || 
            data?.state || 
            data?.instance?.state || 
            "";
          
          const status = typeof statusRaw === 'string' ? statusRaw.toLowerCase() : "";
          
          const negativeStates = ["disconnected", "disconnect", "closed", "close", "logout", "logged_out", "loggedout", "offline", "connecting"];
          
          const isDisconnected = 
            data?.connected === false ||
            data?.loggedIn === false ||
            data?.status?.connected === false ||
            data?.status?.loggedIn === false ||
            data?.instance?.connected === false ||
            negativeStates.some((s) => status === s || status.includes(s));
          
          const connected = !isDisconnected && (
            data?.connected === true ||
            data?.loggedIn === true ||
            data?.status?.connected === true ||
            data?.status?.loggedIn === true ||
            data?.instance?.connected === true ||
            data?.status?.checked_instance?.connection_status === 'connected' ||
            ["connected", "open", "online", "logged_in", "loggedin", "connected_in", "true"].some((s) =>
              status === s || status.includes(s)
            )
          );
  
           const qrCode = pickFirstString(
             data?.qrCode, data?.qrcode, data?.base64, data?.code, 
             data?.data?.qrCode, data?.data?.qrcode, data?.data?.base64, data?.data?.code, 
             data?.instance?.qrCode, data?.instance?.qrcode, data?.instance?.base64, data?.instance?.code,
             data?.instance?.qr, data?.qr
           );
           
           const pairingCode = pickFirstString(
             data?.pairingCode, 
             data?.pairing_code, 
             data?.data?.pairingCode,
             data?.code,
             data?.data?.code,
             data?.instance?.pairingCode,
             data?.instance?.paircode,
             data?.paircode,
             data?.instance?.code
           );
           
           console.log(`Normalized: connected=${connected}, status=${status}, hasQr=${!!qrCode}, hasPairing=${!!pairingCode}`);
           if (qrCode) console.log(`QR Code (prefix): ${qrCode.substring(0, 50)}`);
           if (pairingCode) console.log(`Pairing Code: ${pairingCode}`);

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