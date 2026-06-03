import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");
    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
      return json({ error: "ML_CLIENT_ID / ML_CLIENT_SECRET ausentes" }, 500);
    }

    const { code, state } = await req.json().catch(() => ({}));
    if (!code || !state) return json({ error: "code/state ausentes" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: stateRow, error: stateErr } = await admin
      .from("affiliate_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();

    if (stateErr || !stateRow) return json({ error: "State inválido ou expirado" }, 400);

    // Troca o code pelo access token
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        code,
        redirect_uri: stateRow.redirect_uri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("ML token exchange failed:", tokenData);
      return json({ error: tokenData.message || "Falha ao trocar token" }, 400);
    }

    // Busca dados da conta
    let accountId: string | null = null;
    let nickname: string | null = null;
    try {
      const meRes = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        accountId = String(me.id ?? "");
        nickname = me.nickname ?? me.email ?? null;
      }
    } catch (_) {}

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    await admin
      .from("affiliate_connections")
      .upsert(
        {
          user_id: stateRow.user_id,
          provider: "mercadolivre",
          account_id: accountId,
          account_nickname: nickname,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token ?? null,
          scope: tokenData.scope ?? null,
          token_type: tokenData.token_type ?? null,
          expires_at: expiresAt,
          raw: tokenData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );

    await admin.from("affiliate_oauth_states").delete().eq("state", state);

    return json({ success: true, nickname, accountId });
  } catch (err) {
    console.error("ml-oauth-callback error:", err);
    return json({ error: err instanceof Error ? err.message : "Erro" }, 500);
  }
});