import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REDIRECT_URI = "https://zaplynx.com/afiliados/callback/mercadolivre";
const PROVIDER = "mercadolivre";
const BUCKET = "affiliate-connections";


function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0)));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");

    const authHeader = req.headers.get("authorization") || "";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    // PKCE: Generate code verifier and challenge
    const verifierArray = new Uint8Array(32);
    crypto.getRandomValues(verifierArray);
    const code_verifier = btoa(String.fromCharCode(...verifierArray))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    
    const encoder = new TextEncoder();
    const data = encoder.encode(code_verifier);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const code_challenge = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

    // Store verifier in bucket temporarily for the callback to pick up
    // We use a short TTL if bucket supports it, or just overwrite.
    const storagePath = `${user.id}/oauth_pending.json`;
    await admin.storage
      .from(BUCKET)
      .upload(storagePath, new Blob([JSON.stringify({ code_verifier, expires: Date.now() + 600000 })], { type: "application/json" }), { 
        upsert: true,
        contentType: "application/json" 
      });

    const payload = { u: user.id, p: PROVIDER, exp: Date.now() + 600000 };
    const payloadBase64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const signature = await sign(payloadBase64, ML_CLIENT_SECRET);
    const state = `${payloadBase64}.${signature}`;

    const authUrl = new URL("https://auth.mercadolivre.com.br/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", ML_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", code_challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("prompt", "login");

    return json({ authUrl: authUrl.toString() });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
