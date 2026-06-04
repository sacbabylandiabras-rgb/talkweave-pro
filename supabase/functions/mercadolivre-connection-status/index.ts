import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "affiliate-connections";
const PROVIDER = "mercadolivre";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (authErr || !user) {
      return json({ connected: false });
    }

    const { data: record } = await admin
      .from("affiliate_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", PROVIDER)
      .maybeSingle();

    if (!record || !record.access_token) {
      return json({ connected: false });
    }

    // First check: is the token expired based on our DB?
    const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
    const isActuallyExpired = expiresAt < Date.now();

    // If not expired, try to validate with ML
    if (!isActuallyExpired) {
      try {
        const meRes = await fetch("https://api.mercadolibre.com/users/me", {
          headers: { 
            "Authorization": `Bearer ${record.access_token}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
        });

        if (meRes.ok) {
          const meData = await meRes.json();
          return json({
            connected: true,
            accountId: meData.id,
            nickname: meData.nickname,
            expiresAt: record.expires_at,
          });
        }
        
        // If it's a 403, ML might be blocking the IP. 
        // If we just got the token and it's not expired, we assume it's still connected
        // but the validation call was blocked.
        if (meRes.status === 403) {
          console.warn("[Status] Validation blocked (403), assuming connected since token is not expired in DB");
          return json({
            connected: true,
            accountId: record.account_id,
            nickname: record.account_nickname || "Minha Conta",
            expiresAt: record.expires_at,
          });
        }
      } catch (err) {
        console.warn("[Status] Validation error:", err);
      }
    }

    // If expired or validation failed (non-403), try refresh
    if (record.refresh_token) {
      const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
      const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");

      if (ML_CLIENT_ID && ML_CLIENT_SECRET) {
        try {
          const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: ML_CLIENT_ID,
              client_secret: ML_CLIENT_SECRET,
              refresh_token: record.refresh_token,
            }),
          });

          if (refreshRes.ok) {
            const newData = await refreshRes.json();
            const updatedRecord = {
              access_token: newData.access_token,
              refresh_token: newData.refresh_token || record.refresh_token,
              expires_at: new Date(Date.now() + newData.expires_in * 1000).toISOString(),
            };

            await admin.from("affiliate_connections").update({
              access_token: updatedRecord.access_token,
              refresh_token: updatedRecord.refresh_token,
              expires_at: updatedRecord.expires_at,
              updated_at: new Date().toISOString()
            }).eq("user_id", user.id).eq("provider", PROVIDER);

            return json({
              connected: true,
              accountId: newData.user_id || record.account_id,
              nickname: record.account_nickname || "Minha Conta",
              expiresAt: updatedRecord.expires_at,
            });
          }
        } catch (e) {
          console.error("[Status] Refresh error:", e);
        }
      }
    }

    return json({ connected: false });
    
  } catch (err) {
    console.error("ml-connection-status error:", err);
    return json({ connected: false }, 200);
  }
});
