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
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!META_APP_ID || !META_APP_SECRET) {
    console.error("META_APP_ID or META_APP_SECRET not configured");
    return new Response(errorPage("Configuração do servidor incompleta."), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 500,
    });
  }

  try {
    let userId = state;
    let appOrigin: string | null = null;

    try {
      const decodedState = JSON.parse(atob(state));
      if (decodedState?.userId) userId = decodedState.userId;
      if (decodedState?.origin && /^https?:\/\//.test(decodedState.origin)) appOrigin = decodedState.origin;
    } catch {
      // Backward compatibility with old state format
    }

    // Exchange code for access token
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

    // Get WhatsApp Business Account info
    const bizRes = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?access_token=${finalToken}`
    );
    const bizData = await bizRes.json();

    // Get WABA (WhatsApp Business Account) 
    const wabaRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${finalToken}`
    );
    const wabaData = await wabaRes.json();

    // Try to get WhatsApp phone numbers
    let phoneNumberId = null;
    let businessAccountId = null;
    let wabaId = null;

    if (bizData.data && bizData.data.length > 0) {
      businessAccountId = bizData.data[0].id;
      
      // Get WABA for this business
      const wabaListRes = await fetch(
        `https://graph.facebook.com/v21.0/${businessAccountId}/owned_whatsapp_business_accounts?access_token=${finalToken}`
      );
      const wabaListData = await wabaListRes.json();
      
      if (wabaListData.data && wabaListData.data.length > 0) {
        wabaId = wabaListData.data[0].id;
        
        // Get phone numbers
        const phoneRes = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${finalToken}`
        );
        const phoneData = await phoneRes.json();
        
        if (phoneData.data && phoneData.data.length > 0) {
          phoneNumberId = phoneData.data[0].id;
        }
      }
    }

    // Store credentials in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: dbError } = await supabase
      .from("meta_credentials")
      .upsert({
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
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(errorPage("Erro ao salvar credenciais."), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 500,
      });
    }

    // Return success page that closes the popup
    const redirectBase = (appOrigin || "https://zaplynx.pro").replace(/\/$/, "");
    return Response.redirect(`${redirectBase}/meta-oauth-callback?name=${encodeURIComponent(wabaData.name || "Conta conectada")}`, 302);

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
<h2>${name}</h2>
<p>Conta Business conectada com sucesso!<br>Esta janela será fechada automaticamente.</p>
</div>
<script>
window.opener && window.opener.postMessage({type:'META_OAUTH_SUCCESS'},'*');
setTimeout(()=>window.close(),2000);
</script>
</body></html>`;
}

function errorPage(msg: string) {
  return `<!DOCTYPE html>
<html><head><title>Erro</title><style>
body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fef2f2}
.card{text-align:center;padding:40px;border-radius:16px;background:white;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
h2{margin:0 0 8px;color:#dc2626}p{color:#6b7280;margin:0}
</style></head><body>
<div class="card">
<h2>Erro na conexão</h2>
<p>${msg}</p>
</div>
<script>setTimeout(()=>window.close(),5000);</script>
</body></html>`;
}
