 import { corsHeaders } from "../_shared/cors.ts";

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const normalizeConnectPayload = (data: any) => {
  const qrCode = pickFirstString(
    data?.qrCode,
    data?.qrcode,
    data?.base64,
    data?.code,
    data?.data?.qrCode,
    data?.data?.qrcode,
    data?.data?.base64,
    data?.data?.code,
    data?.instance?.qrCode,
    data?.instance?.qrcode,
    data?.instance?.base64,
    data?.instance?.code,
  );
  const pairingCode = pickFirstString(
    data?.pairingCode, 
    data?.pairing_code, 
    data?.codePairing, 
    data?.data?.pairingCode,
    data?.code, // Alguns retornam apenas "code" quando é pareamento
    data?.data?.code
  );
  const connectionStatus = typeof data?.status === "string" ? data.status : pickFirstString(data?.connectionStatus, data?.state, data?.instance?.status, data?.data?.status);
  return { ...data, qrCode, pairingCode, connectionStatus: connectionStatus || "connecting" };
};
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
      const body = await req.json();
      const { apiUrl, apiToken } = body;
      const phone = body.phone ? String(body.phone).replace(/\D/g, "") : null;
      const instanceName = body.instanceName || body.instance_name;
      if (!apiUrl || !apiToken) throw new Error("apiUrl and apiToken are required");

      console.log(`UAZAPI Connect: ${apiUrl} (Instance: ${instanceName})`);
 
     const cleanUrl = apiUrl.replace(/\/+$/, "");
     
      const withToken = (path: string) => {
        const separator = path.includes("?") ? "&" : "?";
        return `${cleanUrl}${path}${separator}token=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}`;
      };

      const headers = { 
        "Content-Type": "application/json", 
        "token": apiToken,
        "apikey": apiToken,
        "Authorization": `Bearer ${apiToken}`
      };

      // Try multiple possible endpoints for connection
      const connectEndpoints = ["/instance/connect"];
      if (instanceName) {
        connectEndpoints.unshift(`/instance/connect/${instanceName}`);
      }

      let data = {};
      let success = false;

      for (const ep of connectEndpoints) {
        try {
          console.log(`Trying connect endpoint: ${ep}`);
          const response = await fetch(withToken(ep), {
            method: "POST",
            headers,
            body: JSON.stringify(phone ? { phone } : {}),
          });
          
          const resData = await response.json().catch(() => ({}));
          console.log(`Response from ${ep}:`, JSON.stringify(resData).substring(0, 100));
          
          if (response.ok) {
            data = resData;
            success = true;
            break;
          }
        } catch (e) {
          console.error(`Error connecting to ${ep}:`, e.message);
        }
      }
 
 
      return new Response(JSON.stringify(normalizeConnectPayload(data)), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (err) {
     return new Response(JSON.stringify({ error: err.message }), {
       status: 400,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });