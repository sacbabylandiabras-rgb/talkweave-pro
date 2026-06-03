import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REDIRECT_URI = "https://zaplynx.com/afiliados/callback/mercadolivre";
const PROVIDER = "mercadolivre";

type StatePayload = {
  u: string;
  p: string;
  r: string;
  exp: number;
  n: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

async function createState(userId: string, secret: string): Promise<string> {
  const payload: StatePayload = {
    u: userId,
    p: PROVIDER,
    r: REDIRECT_URI,
    exp: Date.now() + 10 * 60 * 1000,
    n: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlJson(payload);
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");
    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
      return json({ error: "Integração ainda não configurada." }, 500);
    }

    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json({ error: "Faça login novamente." }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Faça login novamente." }, 401);

    const state = await createState(userData.user.id, ML_CLIENT_SECRET);
    const authUrl = new URL("https://auth.mercadolivre.com.br/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", ML_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("state", state);
    // Mercado Livre utiliza 'prompt=login' para forçar autenticação
    // Alguns provedores OAuth também respeitam 'force_login=true' ou 'access_type=offline'
    authUrl.searchParams.set("prompt", "login");
    // Adicionando um timestamp ao state para garantir que a URL seja única e não cacheada pelo browser
    authUrl.searchParams.set("pkce", "true"); // ML suporta PKCE em alguns fluxos, forçar ajuda a invalidar sessões automáticas


    return json({ authUrl: authUrl.toString() });
  } catch (err) {
    console.error("ml-oauth-start error:", err);
    return json({ error: "Não foi possível iniciar a conexão." }, 500);
  }
});
