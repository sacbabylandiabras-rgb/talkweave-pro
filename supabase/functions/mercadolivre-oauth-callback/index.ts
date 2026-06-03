import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REDIRECT_URI = "https://zaplynx.com/afiliados/callback/mercadolivre";
const PROVIDER = "mercadolivre";
const BUCKET = "affiliate-connections";

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

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
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

async function verifyState(state: string, secret: string): Promise<StatePayload | null> {
  const [payload, signature] = String(state).split(".");
  if (!payload || !signature) return null;
  const expected = await sign(payload, secret);
  if (signature !== expected) return null;
  const parsed = JSON.parse(decodeBase64Url(payload)) as StatePayload;
  if (parsed.p !== PROVIDER || parsed.r !== REDIRECT_URI || !parsed.u || Date.now() > Number(parsed.exp)) {
    return null;
  }
  return parsed;
}

async function ensureBucket(admin: ReturnType<typeof createClient>) {
  const { error: getError } = await admin.storage.getBucket(BUCKET);
  if (!getError) return;
  const { error: createError } = await admin.storage.createBucket(BUCKET, { public: false });
  if (createError && !/already exists/i.test(createError.message)) throw createError;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");
    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
      return json({ error: "Integração ainda não configurada." }, 500);
    }

    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json({ error: "Faça login novamente e tente conectar de novo." }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Faça login novamente e tente conectar de novo." }, 401);

    const { code, state } = await req.json().catch(() => ({}));
    if (!code || !state) return json({ error: "Link de conexão inválido. Inicie novamente." }, 400);

    const statePayload = await verifyState(String(state), ML_CLIENT_SECRET);
    if (!statePayload || statePayload.u !== userData.user.id) {
      return json({ error: "Sessão de conexão expirada. Inicie novamente." }, 400);
    }

    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        code: String(code),
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData?.access_token) {
      console.error("ML token exchange failed:", tokenData);
      return json({ error: "Autorização expirada. Clique em conectar novamente." }, 400);
    }

    let accountId: string | null = null;
    let nickname: string | null = null;
    try {
      const meRes = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        accountId = me.id != null ? String(me.id) : null;
        nickname = me.nickname ?? me.email ?? null;
      }
    } catch (err) {
      console.warn("ML profile fetch failed:", err);
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await ensureBucket(admin);
    const objectPath = `${userData.user.id}/${PROVIDER}.json`;
    const record = {
      provider: PROVIDER,
      account_id: accountId,
      account_nickname: nickname,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      scope: tokenData.scope ?? null,
      token_type: tokenData.token_type ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, new Blob([JSON.stringify(record)], { type: "application/json" }), {
        contentType: "application/json",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    return json({ success: true, nickname, accountId });
  } catch (err) {
    console.error("ml-oauth-callback error:", err);
    return json({ error: "Não foi possível concluir a conexão." }, 500);
  }
});
