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
    data?.instance?.qr,
    data?.qr
  );
  const pairingCode = pickFirstString(
    data?.pairingCode, 
    data?.pairing_code, 
    data?.codePairing, 
    data?.data?.pairingCode,
    data?.code,
    data?.data?.code,
    data?.instance?.pairingCode,
    data?.instance?.paircode,
    data?.paircode,
    data?.instance?.code
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
      console.log(`Phone provided: ${phone || 'NONE'}`);
 
     const cleanUrl = apiUrl.replace(/\/+$/, "");
     
      const withToken = (path: string) => {
        const separator = path.includes("?") ? "&" : "?";
        return `${cleanUrl}${path}${separator}token=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}`;
      };

      const headers = { 
        "Content-Type": "application/json", 
        "token": apiToken,
        "apikey": apiToken,
        "admintoken": apiToken,
        "AdminToken": apiToken,
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
          const requestBody = phone ? { phone } : {};
          console.log(`Request body: ${JSON.stringify(requestBody)}`);
          const response = await fetch(withToken(ep), {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody),
          });
          
          const resText = await response.text();
          console.log(`Raw response from ${ep}:`, resText);
          const resData = JSON.parse(resText || "{}");
          
          if (response.ok) {
            data = resData;
            success = true;
            break;
          }
        } catch (e) {
          console.error(`Error connecting to ${ep}:`, e.message);
        }
      }
 
 
       const normalized = normalizeConnectPayload(data);
       console.log(`Connect Normalized: hasQr=${!!normalized.qrCode}, hasPairing=${!!normalized.pairingCode}`);
       if (normalized.qrCode) console.log(`QR Code (prefix): ${normalized.qrCode.substring(0, 50)}`);
       if (normalized.pairingCode) console.log(`Pairing Code: ${normalized.pairingCode}`);
       
       return new Response(JSON.stringify(normalized), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (err) {
     return new Response(JSON.stringify({ error: err.message }), {
       status: 400,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });