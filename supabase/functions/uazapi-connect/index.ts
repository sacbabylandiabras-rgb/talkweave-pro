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
     
      const withToken = (path: string, params: Record<string, string> = {}) => {
        const url = new URL(`${cleanUrl}${path}`);
        url.searchParams.set("token", apiToken);
        url.searchParams.set("apikey", apiToken);
        url.searchParams.set("admintoken", apiToken);
        for (const [key, val] of Object.entries(params)) {
          if (val) url.searchParams.set(key, val);
        }
        return url.toString();
      };

      const headers: Record<string, string> = { 
        "Content-Type": "application/json", 
        "token": apiToken,
        "apikey": apiToken,
        "admintoken": apiToken,
        "AdminToken": apiToken,
        "Authorization": `Bearer ${apiToken}`,
        "instance": instanceName || "",
        "instance_name": instanceName || ""
      };

       // Try multiple possible endpoints for connection
       let connectEndpoints = ["/instance/connect"];
       if (instanceName) {
         connectEndpoints = [
           `/instance/connect/${instanceName}`,
           `/instance/connect`,
           `/instance/connect/pairing/${instanceName}`,
           `/instance/paircode/${instanceName}`
         ];
       }
 
       let data: any = {};
       let success = false;
 
       for (const ep of connectEndpoints) {
         try {
           console.log(`Trying connect endpoint: ${ep}`);
           const requestBody = phone ? { phone } : {};
           
           // If phone is provided, try both body and query param
           const params: Record<string, string> = {};
           if (phone) params.phone = phone;
           
           console.log(`Request body: ${JSON.stringify(requestBody)}`);
           const response = await fetch(withToken(ep, params), {
             method: "POST",
             headers,
             body: JSON.stringify(requestBody),
           });
           
           const resText = await response.text();
           console.log(`Raw response from ${ep}:`, resText);
           
           if (response.ok) {
             const resData = JSON.parse(resText || "{}");
             // Validamos se veio algo útil (QR ou Pairing)
             const norm = normalizeConnectPayload(resData);
             if (norm.qrCode || norm.pairingCode || norm.connectionStatus === "connected") {
               data = resData;
               success = true;
               break;
             } else if (!data.instance) {
               // Se não tiver nada ainda, guarda o que veio
               data = resData;
             }
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