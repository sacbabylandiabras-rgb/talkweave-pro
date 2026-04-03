import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response(errorPage("Parâmetros inválidos. Feche esta janela e tente novamente."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 400,
    });
  }

  const META_APP_ID = Deno.env.get("META_APP_ID");
  const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
  const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    let userId = state;
    let appOrigin: string | null = null;

    try {
      const decodedState = JSON.parse(atob(decodeURIComponent(state)));
      if (decodedState?.userId) userId = decodedState.userId;
      if (decodedState?.origin && /^https?:\/\//.test(decodedState.origin)) appOrigin = decodedState.origin;
    } catch {
      // Try without decodeURIComponent for backward compat
      try {
        const decodedState = JSON.parse(atob(state));
        if (decodedState?.userId) userId = decodedState.userId;
        if (decodedState?.origin && /^https?:\/\//.test(decodedState.origin)) appOrigin = decodedState.origin;
      } catch {
        // state is just userId
      }
    }

    console.log("OAuth callback - userId:", userId, "origin:", appOrigin, "ig_flow:", url.searchParams.get("ig_flow"));

    const isInstagramFlow = url.searchParams.get("ig_flow") === "1";

    if (isInstagramFlow) {
      const igAppId = "829722106116857";
      const igAppSecret = INSTAGRAM_APP_SECRET;

      if (!igAppSecret) {
        console.error("INSTAGRAM_APP_SECRET not configured");
        return new Response(errorPage("Instagram App Secret não configurado no servidor."), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
          status: 500,
        });
      }

      const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth-callback?ig_flow=1`;
      console.log("Instagram token exchange - redirect_uri:", redirectUri);

      const tokenBody = new URLSearchParams({
        client_id: igAppId,
        client_secret: igAppSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });

      console.log("Token exchange body (without secret):", JSON.stringify({
        client_id: igAppId,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: code.substring(0, 20) + "...",
      }));

      const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody,
      });

      const tokenText = await tokenRes.text();
      console.log("Instagram token response status:", tokenRes.status, "body:", tokenText);

      let tokenData: any;
      try {
        tokenData = JSON.parse(tokenText);
      } catch {
        console.error("Failed to parse token response:", tokenText);
        return new Response(errorPage("Resposta inválida do Instagram. Tente novamente."), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
          status: 400,
        });
      }

      if (!tokenRes.ok || tokenData.error_type || tokenData.error_message) {
        console.error("Instagram token exchange error:", tokenData);
        const errMsg = tokenData.error_message || tokenData.error?.message || "Erro desconhecido";
        return new Response(errorPage(`Erro ao trocar código do Instagram: ${errMsg}`), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
          status: 400,
        });
      }

      const shortLivedToken = tokenData.access_token;
      const igUserId = tokenData.user_id;
      console.log("Got short-lived token, user_id:", igUserId);

      // Exchange for long-lived token
      let finalToken = shortLivedToken;
      try {
        const longLivedRes = await fetch(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(igAppSecret)}&access_token=${encodeURIComponent(shortLivedToken)}`
        );
        const longLivedData = await longLivedRes.json();
        console.log("Long-lived token response:", longLivedRes.status, JSON.stringify(longLivedData).substring(0, 200));
        if (longLivedData.access_token) {
          finalToken = longLivedData.access_token;
        }
      } catch (e) {
        console.warn("Failed to get long-lived token, using short-lived:", e);
      }

      // Get profile info
      let username = "Instagram conectado";
      let profileUserId = igUserId || "";
      try {
        const profileRes = await fetch(
          `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url,account_type&access_token=${encodeURIComponent(finalToken)}`
        );
        const profileData = await profileRes.json();
        console.log("Profile response:", profileRes.status, JSON.stringify(profileData).substring(0, 300));
        if (profileRes.ok && !profileData.error) {
          username = profileData.username || profileData.name || username;
          profileUserId = String(profileData.user_id || profileData.id || profileUserId);
        }
      } catch (e) {
        console.warn("Failed to fetch profile:", e);
      }

      // Store credentials - check if record exists first
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: existing } = await supabase
        .from("meta_credentials")
        .select("id")
        .eq("user_id", userId)
        .eq("app_id", igAppId)
        .maybeSingle();

      const credData = {
        user_id: userId,
        access_token: finalToken,
        app_id: igAppId,
        fb_user_id: profileUserId,
        fb_user_name: username,
        connected: true,
        updated_at: new Date().toISOString(),
      };

      const { error: dbError } = existing
        ? await supabase.from("meta_credentials").update(credData).eq("id", existing.id)
        : await supabase.from("meta_credentials").insert(credData);

      if (dbError) {
        console.error("DB error:", dbError);
        return new Response(errorPage("Erro ao salvar credenciais do Instagram."), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
          status: 500,
        });
      }

      console.log("Instagram connected successfully for user:", userId, "username:", username);

      // Return success page that sends postMessage and closes
      return new Response(successPage(username), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 200,
      });
    }

    // === Facebook / WhatsApp Business flow ===
    if (!META_APP_ID || !META_APP_SECRET) {
      console.error("META_APP_ID or META_APP_SECRET not configured");
      return new Response(errorPage("Configuração do servidor incompleta."), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 500,
      });
    }

    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(SUPABASE_URL + "/functions/v1/meta-oauth-callback")}&client_secret=${META_APP_SECRET}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return new Response(errorPage("Erro ao trocar código: " + (tokenData.error.message || "desconhecido")), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 400,
      });
    }

    const accessToken = tokenData.access_token;

    // Get long-lived token
    const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${accessToken}`;
    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json();
    const finalToken = longLivedData.access_token || accessToken;

    // Get Business info
    const bizRes = await fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${finalToken}`);
    const bizData = await bizRes.json();
    const wabaRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${finalToken}`);
    const wabaData = await wabaRes.json();

    let phoneNumberId = null;
    let businessAccountId = null;
    let wabaId = null;

    if (bizData.data && bizData.data.length > 0) {
      businessAccountId = bizData.data[0].id;
      const wabaListRes = await fetch(`https://graph.facebook.com/v21.0/${businessAccountId}/owned_whatsapp_business_accounts?access_token=${finalToken}`);
      const wabaListData = await wabaListRes.json();
      if (wabaListData.data && wabaListData.data.length > 0) {
        wabaId = wabaListData.data[0].id;
        const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${finalToken}`);
        const phoneData = await phoneRes.json();
        if (phoneData.data && phoneData.data.length > 0) {
          phoneNumberId = phoneData.data[0].id;
        }
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await supabase
      .from("meta_credentials")
      .select("id")
      .eq("user_id", userId)
      .eq("app_id", META_APP_ID)
      .maybeSingle();

    const credData = {
      user_id: userId,
      access_token: finalToken,
      app_id: META_APP_ID,
      phone_number_id: phoneNumberId,
      business_account_id: businessAccountId,
      waba_id: wabaId,
      fb_user_id: wabaData.id,
      fb_user_name: wabaData.name,
      connected: true,
      updated_at: new Date().toISOString(),
    };

    const { error: dbError } = existing
      ? await supabase.from("meta_credentials").update(credData).eq("id", existing.id)
      : await supabase.from("meta_credentials").insert(credData);

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(errorPage("Erro ao salvar credenciais."), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 500,
      });
    }

    return new Response(successPage(wabaData.name || "Conta conectada"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 200,
    });

  } catch (err) {
    console.error("OAuth callback error:", err);
    return new Response(errorPage("Erro interno: " + (err as Error).message), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 500,
    });
  }
});

function successPage(name: string) {
  return `<!DOCTYPE html>
<html><head><title>Conectado!</title><style>
body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0fdf4}
.card{text-align:center;padding:40px;border-radius:16px;background:white;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.check{width:64px;height:64px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
h2{margin:0 0 8px;color:#15803d}p{color:#6b7280;margin:0}
</style></head><body>
<div class="card">
<div class="check"><svg width="32" height="32" fill="none" stroke="white" stroke-width="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></div>
<h2>@${name}</h2>
<p>Conta conectada com sucesso!<br>Esta janela será fechada automaticamente.</p>
</div>
<script>
try {
  if (window.opener) {
    window.opener.postMessage({type:'META_OAUTH_SUCCESS'},'*');
  }
} catch(e) { console.warn('postMessage failed:', e); }
setTimeout(function(){ window.close(); }, 3000);
</script>
</body></html>`;
}

function errorPage(msg: string) {
  return `<!DOCTYPE html>
<html><head><title>Erro</title><style>
body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fef2f2}
.card{text-align:center;padding:40px;border-radius:16px;background:white;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:500px}
h2{margin:0 0 8px;color:#dc2626}p{color:#6b7280;margin:0;word-break:break-word}
</style></head><body>
<div class="card">
<h2>Erro na conexão</h2>
<p>${msg}</p>
</div>
<script>setTimeout(function(){ window.close(); },8000);</script>
</body></html>`;
}
