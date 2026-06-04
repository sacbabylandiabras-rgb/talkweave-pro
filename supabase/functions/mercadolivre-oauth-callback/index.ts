import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
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
  if (req.method !== "POST") return json({ error: "Invalid method" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");

    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) return json({ error: "ML credentials missing" }, 500);

    const { code, state } = await req.json();
    console.log(`[OAuth] Processing callback for code: ${code?.substring(0, 5)}...`);
    
    const [payloadBase64, signature] = state.split(".");
    const expectedSignature = await sign(payloadBase64, ML_CLIENT_SECRET);
    if (signature !== expectedSignature) {
      console.error("[OAuth] Invalid state signature");
      return json({ error: "Invalid state signature" }, 400);
    }

    const payload = JSON.parse(decodeBase64Url(payloadBase64));
    const userId = payload.u;
    console.log(`[OAuth] User ID from payload: ${userId}`);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Retrieve verifier from bucket
    let code_verifier = null;
    try {
      const storagePath = `${userId}/oauth_pending.json`;
      const { data, error: downloadError } = await admin.storage
        .from(BUCKET)
        .download(storagePath);
      
      if (data) {
        const pending = JSON.parse(await data.text());
        if (pending.expires > Date.now()) {
          code_verifier = pending.code_verifier;
        }
        await admin.storage.from(BUCKET).remove([storagePath]);
      }
    } catch (e) {
      console.warn("[OAuth] Could not retrieve code_verifier from storage:", e.message);
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    });

    if (code_verifier) tokenParams.set("code_verifier", code_verifier);

    console.log(`[OAuth] Fetching token from ML...`);
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: tokenParams,
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(`[OAuth] Failed to exchange code. Status: ${tokenRes.status}`);
      return json({ error: "Failed to exchange authorization code with Mercado Livre" }, 400);
    }
    const tokenData = await tokenRes.json();

    const meRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const meData = await meRes.json();

    // Fetch affiliate source_id
    let sourceId = null;
    try {
      // Strategy 1: advertisers/me
      const affRes = await fetch("https://api.mercadolibre.com/affiliate-program/v1/advertisers/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (affRes.ok) {
        const affData = await affRes.json();
        sourceId = affData.source_id || affData.id;
      }
      
      // Strategy 2: If Strategy 1 failed or returned null, try /sources
      if (!sourceId) {
        const sourcesRes = await fetch("https://api.mercadolibre.com/affiliate-program/v1/sources", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (sourcesRes.ok) {
          const sourcesData = await sourcesRes.json();
          const sources = Array.isArray(sourcesData) ? sourcesData : (sourcesData.sources || []);
          if (sources.length > 0) {
            sourceId = sources[0].id || sources[0].source_id;
          }
        }
      }
    } catch (err) {
      console.warn("[Affiliate] Error fetching sources:", err.message);
    }

    const record = {
      provider: PROVIDER,
      account_id: String(meData.id),
      account_nickname: meData.nickname,
      affiliate_source_id: sourceId ? String(sourceId) : null,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { source_id: sourceId }
    };

    const storagePath = `${userId}/${PROVIDER}.json`;
    await admin.storage
      .from(BUCKET)
      .upload(storagePath, new Blob([JSON.stringify(record)], { type: "application/json" }), { 
        upsert: true,
        contentType: "application/json" 
      });

    const { error: dbError } = await admin.from("affiliate_connections").upsert({
      user_id: userId,
      provider: PROVIDER,
      account_id: String(meData.id),
      account_nickname: meData.nickname,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: record.expires_at,
      updated_at: new Date().toISOString(),
      affiliate_source_id: sourceId ? String(sourceId) : null,
      metadata: { source_id: sourceId }
    }, { onConflict: "user_id,provider" });

    if (dbError) console.error("[DB] Error saving connection:", dbError);

    return json({ success: true, nickname: meData.nickname });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
