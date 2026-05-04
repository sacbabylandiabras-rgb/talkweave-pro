import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const signedRequest = body.signed_request;

    // Meta sends a signed_request with user_id
    // We acknowledge receipt and return a confirmation
    const confirmationCode = crypto.randomUUID();
    const url = `https://zaplynx.com/politica-privacidade`;

    console.log("Data deletion request received:", JSON.stringify(body));

    return new Response(
      JSON.stringify({
        url,
        confirmation_code: confirmationCode,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing data deletion:", error);
    return new Response(
      JSON.stringify({ url: "https://zaplynx.com/politica-privacidade", confirmation_code: "error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
