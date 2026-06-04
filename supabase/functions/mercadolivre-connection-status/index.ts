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
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json({ connected: false }, 200);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ connected: false }, 200);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verificamos a validade real do token chamando a API do Mercado Livre
    // Tenta carregar do banco de dados primeiro
    const { data: dbData } = await admin
      .from("affiliate_connections")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("provider", PROVIDER)
      .maybeSingle();

    let record = dbData;

    // Fallback para storage se não houver no banco
    if (!record) {
      const storagePath = `${userData.user.id}/${PROVIDER}.json`;
      const { data: storageData } = await admin.storage
        .from(BUCKET)
        .download(storagePath);

      if (storageData) {
        record = JSON.parse(await storageData.text());
      }
    }

    if (!record || !record.access_token) {
      return json({ connected: false });
    }

    // Valida o token com a API do Mercado Livre
    try {
      const meRes = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: `Bearer ${record.access_token}` },
      });

      if (meRes.ok) {
        const meData = await meRes.json();
        return json({
          connected: true,
          accountId: meData.id,
          nickname: meData.nickname,
          expiresAt: record.expires_at,
        });
      } else {
        // Se o token expirou, tentamos usar o refresh token
        const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
        const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");

        if (record.refresh_token && ML_CLIENT_ID && ML_CLIENT_SECRET) {
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
            // Atualiza record com novos dados
            const updatedRecord = {
              ...record,
              access_token: newData.access_token,
              refresh_token: newData.refresh_token || record.refresh_token,
              expires_at: new Date(Date.now() + newData.expires_in * 1000).toISOString(),
            };

            // Salva atualizações
            await admin.from("affiliate_connections").upsert({
              user_id: userData.user.id,
              provider: PROVIDER,
              access_token: updatedRecord.access_token,
              refresh_token: updatedRecord.refresh_token,
              expires_at: updatedRecord.expires_at,
              account_id: String(newData.user_id || record.account_id),
            }, { onConflict: "user_id,provider" });

            return json({
              connected: true,
              accountId: newData.user_id || record.account_id,
              nickname: record.account_nickname,
              expiresAt: updatedRecord.expires_at,
            });
          }
        }
        
        console.log(`[Auth] Token invalid or expired for user ${userData.user.id}`);
        return json({ connected: false });
      }
    } catch (err) {
      console.error("Error validating ML token:", err);
      return json({ connected: false });
    }
  } catch (err) {
    console.error("ml-connection-status error:", err);
    return json({ connected: false }, 200);
  }
});
