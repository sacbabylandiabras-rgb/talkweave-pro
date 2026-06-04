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

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    });

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
      console.error(`[OAuth] Failed to exchange code. Status: ${tokenRes.status}, Body: ${errBody}`);
      return json({ error: `Failed to exchange code: ${errBody}` }, 400);
    }
    const tokenData = await tokenRes.json();
    console.log(`[OAuth] Token received successfully. Access token starts with: ${tokenData.access_token?.substring(0, 10)}...`);

    const meRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const meData = await meRes.json();

    // Fetch affiliate source_id
    let sourceId = null;
    try {
      const affRes = await fetch("https://api.mercadolibre.com/affiliate-program/v1/advertisers/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (affRes.ok) {
        const affData = await affRes.json();
        sourceId = affData.source_id || affData.id;
      }
    } catch {}

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const record = {
      provider: PROVIDER,
      account_id: meData.id,
      account_nickname: meData.nickname,
      affiliate_source_id: sourceId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const storagePath = `${userId}/${PROVIDER}.json`;
    console.log(`[Storage] Saving token to: ${storagePath}`);
    
    // Save to storage
    const { data: uploadData, error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, new Blob([JSON.stringify(record)], { type: "application/json" }), { 
        upsert: true,
        contentType: "application/json" 
      });

    if (uploadError) {
      console.error("[Storage] Error saving token:", uploadError);
    } else {
      console.log("[Storage] Token saved successfully:", uploadData);
    }

    // NEW: Save to database as well to ensure persistence and easier lookup
    try {
      // Create table if it doesn't exist (using a simple SQL query via RPC or just trying the insert)
      // The admin client uses service role so it can do everything.
      const { error: dbError } = await admin.from("affiliate_connections").upsert({
        user_id: userId,
        provider: PROVIDER,
        account_id: String(meData.id),
        account_nickname: meData.nickname,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        metadata: { source_id: sourceId }
      }, { onConflict: "user_id,provider" });

      if (dbError) {
        console.error("[DB] Error saving connection:", dbError);
        // If table doesn't exist, we try to create it using a raw query
        if (dbError.message.includes("relation \"affiliate_connections\" does not exist")) {
          console.log("[DB] Attempting to create table via raw SQL...");
          await admin.rpc('exec_sql', { sql: `
            CREATE TABLE IF NOT EXISTS public.affiliate_connections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                provider TEXT NOT NULL,
                account_id TEXT,
                account_nickname TEXT,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                expires_at TIMESTAMPTZ,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, provider)
            );
            ALTER TABLE public.affiliate_connections ENABLE ROW LEVEL SECURITY;
            CREATE POLICY IF NOT EXISTS "Users can view their own connections" ON public.affiliate_connections FOR SELECT USING (auth.uid() = user_id);
          `}).catch(e => console.error("[DB] SQL execution failed:", e));
          
          // Retry upsert
          await admin.from("affiliate_connections").upsert({
            user_id: userId,
            provider: PROVIDER,
            account_id: String(meData.id),
            account_nickname: meData.nickname,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            metadata: { source_id: sourceId }
          }, { onConflict: "user_id,provider" });
        }
      } else {
        console.log("[DB] Connection saved successfully");
      }
    } catch (err) {
      console.error("[DB] Error in database operations:", err.message);
    }


    return json({ success: true, nickname: meData.nickname });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
