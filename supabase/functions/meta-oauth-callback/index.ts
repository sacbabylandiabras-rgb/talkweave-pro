import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return redirectToApp(null, "/meta/configuracao", {
      error: "1",
      popup: "1",
      message: "Parâmetros inválidos. Tente novamente.",
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
      const igAppId = "831998069944962";
      const igAppSecret = INSTAGRAM_APP_SECRET;

      if (!igAppSecret) {
        console.error("INSTAGRAM_APP_SECRET not configured");
        return redirectToApp(appOrigin, "/instagram/configuracao", {
          error: "1",
          popup: "1",
          message: "Instagram App Secret não configurado no servidor.",
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
        return redirectToApp(appOrigin, "/instagram/configuracao", {
          error: "1",
          popup: "1",
          message: "Resposta inválida do Instagram. Tente novamente.",
        });
      }

      if (!tokenRes.ok || tokenData.error_type || tokenData.error_message) {
        console.error("Instagram token exchange error:", tokenData);
        const errMsg = tokenData.error_message || tokenData.error?.message || "Erro desconhecido";
        return redirectToApp(appOrigin, "/instagram/configuracao", {
          error: "1",
          popup: "1",
          message: `Erro ao trocar código do Instagram: ${errMsg}`,
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
        return redirectToApp(appOrigin, "/instagram/configuracao", {
          error: "1",
          popup: "1",
          message: "Erro ao salvar credenciais do Instagram.",
        });
      }

      console.log("Instagram connected successfully for user:", userId, "username:", username);

      return redirectToApp(appOrigin, "/instagram/configuracao", {
        connected: "1",
        popup: "1",
      });
    }

    // === Facebook / WhatsApp Business flow ===
    if (!META_APP_ID || !META_APP_SECRET) {
      console.error("META_APP_ID or META_APP_SECRET not configured");
      return redirectToApp(appOrigin, "/meta/configuracao", {
        error: "1",
        popup: "1",
        message: "Configuração do servidor incompleta.",
      });
    }

    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(SUPABASE_URL + "/functions/v1/meta-oauth-callback")}&client_secret=${META_APP_SECRET}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return redirectToApp(appOrigin, "/meta/configuracao", {
        error: "1",
        popup: "1",
        message: "Erro ao trocar código: " + (tokenData.error.message || "desconhecido"),
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

    // Try multiple approaches to find WABA
    if (bizData.data && bizData.data.length > 0) {
      businessAccountId = bizData.data[0].id;
      
      // 1. Try owned_whatsapp_business_accounts
      const ownedRes = await fetch(`https://graph.facebook.com/v21.0/${businessAccountId}/owned_whatsapp_business_accounts?access_token=${finalToken}`);
      const ownedData = await ownedRes.json();
      console.log("Owned WABAs:", JSON.stringify(ownedData).substring(0, 500));
      
      if (ownedData.data && ownedData.data.length > 0) {
        wabaId = ownedData.data[0].id;
      }
      
      // 2. If not found, try client_whatsapp_business_accounts
      if (!wabaId) {
        const clientRes = await fetch(`https://graph.facebook.com/v21.0/${businessAccountId}/client_whatsapp_business_accounts?access_token=${finalToken}`);
        const clientData = await clientRes.json();
        console.log("Client WABAs:", JSON.stringify(clientData).substring(0, 500));
        if (clientData.data && clientData.data.length > 0) {
          wabaId = clientData.data[0].id;
        }
      }

      // 3. Try all businesses
      if (!wabaId && bizData.data.length > 1) {
        for (const biz of bizData.data.slice(1)) {
          const r = await fetch(`https://graph.facebook.com/v21.0/${biz.id}/owned_whatsapp_business_accounts?access_token=${finalToken}`);
          const d = await r.json();
          if (d.data && d.data.length > 0) {
            businessAccountId = biz.id;
            wabaId = d.data[0].id;
            break;
          }
        }
      }

      // Get phone numbers if we found a WABA
      if (wabaId) {
        const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${finalToken}`);
        const phoneData = await phoneRes.json();
        console.log("Phone numbers:", JSON.stringify(phoneData).substring(0, 500));
        if (phoneData.data && phoneData.data.length > 0) {
          phoneNumberId = phoneData.data[0].id;
        }
      }
    }

    // 4. Last resort: try direct WABA discovery via debug_token
    if (!wabaId) {
      try {
        const debugRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${finalToken}&access_token=${finalToken}`);
        const debugData = await debugRes.json();
        console.log("Debug token granular_scopes:", JSON.stringify(debugData?.data?.granular_scopes || []).substring(0, 500));
        
        const scopes = debugData?.data?.granular_scopes || [];
        for (const scope of scopes) {
          if (scope.scope === "whatsapp_business_management" && scope.target_ids?.length > 0) {
            wabaId = scope.target_ids[0];
            console.log("Found WABA from debug_token:", wabaId);
            
            const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${finalToken}`);
            const phoneData = await phoneRes.json();
            if (phoneData.data && phoneData.data.length > 0) {
              phoneNumberId = phoneData.data[0].id;
            }
            break;
          }
          if (scope.scope === "whatsapp_business_messaging" && scope.target_ids?.length > 0 && !phoneNumberId) {
            phoneNumberId = scope.target_ids[0];
            console.log("Found phone_number_id from debug_token:", phoneNumberId);
          }
        }
      } catch (e) {
        console.warn("debug_token lookup failed:", e);
      }
    }
    
    console.log("Final credentials - WABA:", wabaId, "Phone:", phoneNumberId, "Business:", businessAccountId);

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
      return redirectToApp(appOrigin, "/meta/configuracao", {
        error: "1",
        popup: "1",
        message: "Erro ao salvar credenciais.",
      });
    }

    return redirectToApp(appOrigin, "/meta/configuracao", {
      connected: "1",
      popup: "1",
    });

  } catch (err) {
    console.error("OAuth callback error:", err);
    return redirectToApp(null, "/meta/configuracao", {
      error: "1",
      popup: "1",
      message: "Falha ao concluir a conexão.",
    });
  }
});

function redirectToApp(
  appOrigin: string | null,
  path: string,
  params: Record<string, string>,
) {
  const target = new URL(path, sanitizeOrigin(appOrigin));

  for (const [key, value] of Object.entries(params)) {
    if (value) target.searchParams.set(key, value);
  }

  const destination = target.toString();
  console.log("Redirecting to:", destination);

  return new Response(null, {
    status: 302,
    headers: {
      "Location": destination,
      "Cache-Control": "no-store",
    },
  });
}

function sanitizeOrigin(origin: string | null) {
  if (origin && /^https?:\/\//.test(origin)) return origin;
  return "https://zaplynx.pro";
}
