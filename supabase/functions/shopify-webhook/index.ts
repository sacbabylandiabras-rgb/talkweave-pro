import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") ?? "";

async function verifyHmac(rawBody: Uint8Array, hmacHeader: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, rawBody);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64 === hmacHeader;
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return new Response("OK", { status: 200 });
  }

  const rawBody = new Uint8Array(await req.arrayBuffer());
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "";

  if (!hmac) {
    return new Response("OK", { status: 200 });
  }

  if (!(await verifyHmac(rawBody, hmac))) {
    return new Response("Unauthorized", { status: 401 });
  }

  console.log(`Webhook recebido: ${topic}`);
  return new Response("OK", { status: 200 });
});
