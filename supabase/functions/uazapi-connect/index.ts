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
  const pairingCode = pickFirstString(data?.pairingCode, data?.pairing_code, data?.codePairing, data?.data?.pairingCode);
  const connectionStatus = typeof data?.status === "string" ? data.status : pickFirstString(data?.connectionStatus, data?.state, data?.instance?.status, data?.data?.status);
  return { ...data, qrCode, pairingCode, connectionStatus: connectionStatus || "connecting" };
};
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
     const { apiUrl, apiToken, phone } = await req.json();
     if (!apiUrl || !apiToken) throw new Error("apiUrl and apiToken are required");
 
     const cleanUrl = apiUrl.replace(/\/+$/, "");
     
     const withToken = (path: string) => `${cleanUrl}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(apiToken)}`;

     // UAZAPI expects POST /instance/connect with the instance token in query params.
     const response = await fetch(withToken(`/instance/connect`), {
       method: "POST",
       headers: { "Content-Type": "application/json", token: apiToken },
       body: JSON.stringify(phone ? { phone } : {}),
     });
 
     const data = await response.json().catch(() => ({}));
     
     // If phone is provided, try pairing code
     if (phone) {
       const pairingResponse = await fetch(withToken(`/instance/connect?phone=${encodeURIComponent(phone)}`), {
         method: "POST",
         headers: { "Content-Type": "application/json", token: apiToken },
         body: JSON.stringify({ phone }),
       });
        const pairingData = await pairingResponse.json().catch(() => ({}));
        return new Response(JSON.stringify(normalizeConnectPayload({ ...data, ...pairingData })), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
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