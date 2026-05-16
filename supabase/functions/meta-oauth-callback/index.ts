import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

 const DEFAULT_APP_ORIGIN = "https://zaplynx.com";
 const WHATSAPP_META_APP_ID = "26985190684454065";
 const INSTAGRAM_META_APP_ID = "2389544344842071";
const CALLBACK_PATH = "/functions/v1/meta-oauth-callback";

type OAuthRequestBody = {
  code?: string;
  origin?: string;
  redirectUri?: string;
  state?: string;
  userId?: string;
};

type ParsedState = {
  ig_flow?: boolean;
  origin?: string;
  userId?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const isJsonRequest = req.method === "POST";
  const url = new URL(req.url);
  const body = isJsonRequest ? await readRequestBody(req) : null;
  const code = isJsonRequest ? body?.code ?? null : url.searchParams.get("code");
  const state = isJsonRequest ? body?.state ?? null : url.searchParams.get("state");

  if (!code || !state) {
    return respondError({
      appOrigin: body?.origin ?? null,
      isJsonRequest,
      message: "Parâmetros inválidos. Tente novamente.",
      path: "/meta/configuracao",
      status: 400,
    });
  }

  const META_APP_ID = WHATSAPP_META_APP_ID;
  const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
  const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const parsedState = parseStatePayload(state);
    let userId = parsedState.userId ?? body?.userId ?? (isJsonRequest ? null : state);
    let appOrigin = body?.origin ?? parsedState.origin ?? null;
    let isInstagramFlow = url.searchParams.get("ig_flow") === "1" || parsedState.ig_flow === true;

    if (isJsonRequest) {
      const authenticatedUserId = await getAuthenticatedUserId(req, SUPABASE_URL, SUPABASE_ANON_KEY);

      if (!authenticatedUserId) {
        return jsonResponse({ error: "Sessão inválida. Faça login novamente." }, 401);
      }

      if (userId && userId !== authenticatedUserId) {
        return jsonResponse({ error: "Sessão inválida para concluir a conexão." }, 403);
      }

      userId = authenticatedUserId;
    }

    if (!userId) {
      return respondError({
        appOrigin,
        isJsonRequest,
        message: "Usuário da conexão não identificado.",
        path: isInstagramFlow ? "/instagram/configuracao" : "/meta/configuracao",
        status: 400,
      });
    }

    console.log("OAuth callback - userId:", userId, "origin:", appOrigin, "ig_flow:", isInstagramFlow, "json:", isJsonRequest);

    if (isInstagramFlow) {
      const igAppSecret = INSTAGRAM_APP_SECRET || META_APP_SECRET;

      if (!igAppSecret) {
        console.error("INSTAGRAM_APP_SECRET not configured");
        return respondError({
          appOrigin,
          isJsonRequest,
          message: "Instagram App Secret não configurado no servidor.",
          path: "/instagram/configuracao",
          status: 500,
        });
      }

      // A Meta/Instagram exige que o redirect_uri na troca do token seja EXATAMENTE igual ao usado no diálogo.
      // Quando o Supabase Edge Function é chamado via GET, ele geralmente usa o domínio .supabase.co internamente,
      // mas se o usuário acessou via zaplynx.com, o redirecionamento pode ter vindo de lá.
      // IMPORTANTE: Se o domínio configurado no Meta Developer Console for zaplynx.com, devemos usar ele.
      // IMPORTANTE: A Meta/Instagram exige que o redirect_uri na troca do token seja EXATAMENTE igual ao usado no diálogo.
      // O frontend envia o redirect_uri para a Edge Function do Supabase.
      const redirectUri = "https://yodgjxdekuraxquxkxhx.supabase.co/functions/v1/meta-oauth-callback";
      console.log("Instagram token exchange using SUPABASE redirect_uri:", redirectUri);
      const tokenBody = new URLSearchParams({
        client_id: INSTAGRAM_META_APP_ID,
        client_secret: igAppSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      });

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
        return respondError({
          appOrigin,
          isJsonRequest,
          message: "Resposta inválida do Instagram. Tente novamente.",
          path: "/instagram/configuracao",
          status: 502,
        });
      }

      if (!tokenRes.ok || tokenData.error_type || tokenData.error_message) {
        const errMsg = tokenData.error_message || tokenData.error?.message || "Erro desconhecido";
        console.error("Instagram token exchange error:", tokenData);
        return respondError({
          appOrigin,
          isJsonRequest,
          message: `Erro ao trocar código do Instagram: ${errMsg}`,
          path: "/instagram/configuracao",
          status: 400,
        });
      }

      const shortLivedToken = tokenData.access_token;
      const igUserId = tokenData.user_id;
      let finalToken = shortLivedToken;

      try {
        const longLivedRes = await fetch(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(igAppSecret)}&access_token=${encodeURIComponent(shortLivedToken)}`,
        );
        const longLivedData = await longLivedRes.json();
        if (longLivedData.access_token) {
          finalToken = longLivedData.access_token;
        }
      } catch (error) {
        console.warn("Failed to get long-lived IG token, using short-lived token:", error);
      }

      let username = "Instagram conectado";
      let profileUserId = igUserId || "";

      try {
        const profileRes = await fetch(
          `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url,account_type&access_token=${encodeURIComponent(finalToken)}`,
        );
        const profileData = await profileRes.json();
        if (profileRes.ok && !profileData.error) {
          username = profileData.username || profileData.name || username;
          profileUserId = String(profileData.user_id || profileData.id || profileUserId);
        }
      } catch (error) {
        console.warn("Failed to fetch Instagram profile:", error);
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: existing } = await supabase
        .from("meta_credentials")
        .select("id")
        .eq("user_id", userId)
        .eq("app_id", INSTAGRAM_META_APP_ID)
        .maybeSingle();

      const credData = {
        user_id: userId,
        access_token: finalToken,
        app_id: INSTAGRAM_META_APP_ID,
        fb_user_id: profileUserId,
        fb_user_name: username,
        connected: true,
        updated_at: new Date().toISOString(),
      };

      const { error: dbError } = existing
        ? await supabase.from("meta_credentials").update(credData).eq("id", existing.id)
        : await supabase.from("meta_credentials").insert(credData);

      if (dbError) {
        console.error("Instagram DB error:", dbError);
        return respondError({
          appOrigin,
          isJsonRequest,
          message: "Erro ao salvar credenciais do Instagram.",
          path: "/instagram/configuracao",
          status: 500,
        });
      }

      return respondSuccess({
        appOrigin,
        isJsonRequest,
        path: "/instagram/configuracao",
        payload: { connected: true, provider: "instagram" },
        params: { connected: "1", popup: "1" },
      });
    }

    if (!META_APP_ID || !META_APP_SECRET) {
      console.error("META_APP_ID or META_APP_SECRET not configured");
      return respondError({
        appOrigin,
        isJsonRequest,
        message: "Configuração do servidor incompleta.",
        path: "/meta/configuracao",
        status: 500,
      });
    }

    const redirectUri = "https://zaplynx.com/meta-oauth-callback";
    const tokenData = await exchangeFacebookCode({
      appId: META_APP_ID,
      appSecret: META_APP_SECRET,
      code,
      redirectUri: redirectUri,
    });

    if (tokenData.error) {
      console.error("Facebook token exchange error:", tokenData.error);
      return respondError({
        appOrigin,
        isJsonRequest,
        message: `Erro ao trocar código: ${tokenData.error.message || "desconhecido"}`,
        path: "/meta/configuracao",
        status: 400,
      });
    }

    const accessToken = tokenData.access_token;

    const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${accessToken}`;
    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json();
    const finalToken = longLivedData.access_token || accessToken;

    const bizRes = await fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${finalToken}`);
    const bizData = await bizRes.json();
    const wabaRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${finalToken}`);
    const wabaData = await wabaRes.json();

    let phoneNumberId = null;
    let businessAccountId = null;
    let wabaId = null;

    if (bizData.data && bizData.data.length > 0) {
      businessAccountId = bizData.data[0].id;

      const ownedRes = await fetch(`https://graph.facebook.com/v21.0/${businessAccountId}/owned_whatsapp_business_accounts?access_token=${finalToken}`);
      const ownedData = await ownedRes.json();
      console.log("Owned WABAs:", JSON.stringify(ownedData).substring(0, 500));

      if (ownedData.data && ownedData.data.length > 0) {
        wabaId = ownedData.data[0].id;
      }

      if (!wabaId) {
        const clientRes = await fetch(`https://graph.facebook.com/v21.0/${businessAccountId}/client_whatsapp_business_accounts?access_token=${finalToken}`);
        const clientData = await clientRes.json();
        console.log("Client WABAs:", JSON.stringify(clientData).substring(0, 500));
        if (clientData.data && clientData.data.length > 0) {
          wabaId = clientData.data[0].id;
        }
      }

      if (!wabaId && bizData.data.length > 1) {
        for (const biz of bizData.data.slice(1)) {
          const response = await fetch(`https://graph.facebook.com/v21.0/${biz.id}/owned_whatsapp_business_accounts?access_token=${finalToken}`);
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            businessAccountId = biz.id;
            wabaId = data.data[0].id;
            break;
          }
        }
      }

      if (wabaId) {
        const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${finalToken}`);
        const phoneData = await phoneRes.json();
        console.log("Phone numbers:", JSON.stringify(phoneData).substring(0, 500));
        if (phoneData.data && phoneData.data.length > 0) {
          phoneNumberId = phoneData.data[0].id;
        }
      }
    }

    if (!wabaId) {
      try {
        const debugRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${finalToken}&access_token=${finalToken}`);
        const debugData = await debugRes.json();
        console.log("Debug token granular_scopes:", JSON.stringify(debugData?.data?.granular_scopes || []).substring(0, 500));

        const scopes = debugData?.data?.granular_scopes || [];
        for (const scope of scopes) {
          if (scope.scope === "whatsapp_business_management" && scope.target_ids?.length > 0) {
            wabaId = scope.target_ids[0];
            const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${finalToken}`);
            const phoneData = await phoneRes.json();
            if (phoneData.data && phoneData.data.length > 0) {
              phoneNumberId = phoneData.data[0].id;
            }
            break;
          }

          if (scope.scope === "whatsapp_business_messaging" && scope.target_ids?.length > 0 && !phoneNumberId) {
            phoneNumberId = scope.target_ids[0];
          }
        }
      } catch (error) {
        console.warn("debug_token lookup failed:", error);
      }
    }

    console.log("Final credentials - WABA:", wabaId, "Phone:", phoneNumberId, "Business:", businessAccountId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: existing } = await supabase
      .from("meta_credentials")
      .select("id")
      .eq("user_id", userId)
      .eq("app_id", WHATSAPP_META_APP_ID)
      .maybeSingle();

    const credData = {
      user_id: userId,
      access_token: finalToken,
      app_id: WHATSAPP_META_APP_ID,
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

    if (wabaId && !dbError) {
      try {
        console.log(`Subscribing app to WABA: ${wabaId}`);
        const subRes = await fetch(
          `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${finalToken}` }
          }
        );
        const subData = await subRes.json();
        console.log("Subscription response:", subData);
      } catch (subErr) {
        console.error("Error subscribing app to WABA:", subErr);
      }
    }

    if (dbError) {
      console.error("WhatsApp DB error:", dbError);
      return respondError({
        appOrigin,
        isJsonRequest,
        message: "Erro ao salvar credenciais.",
        path: "/meta/configuracao",
        status: 500,
      });
    }

    return respondSuccess({
      appOrigin,
      isJsonRequest,
      path: "/meta/configuracao",
      payload: {
        connected: true,
        phone_number_id: phoneNumberId,
        provider: "facebook",
        waba_id: wabaId,
      },
      params: { connected: "1", popup: "1" },
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    return respondError({
      appOrigin: body?.origin ?? null,
      isJsonRequest,
      message: "Falha ao concluir a conexão.",
      path: "/meta/configuracao",
      status: 500,
    });
  }
});

async function readRequestBody(req: Request): Promise<OAuthRequestBody | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function getAuthenticatedUserId(req: Request, supabaseUrl: string, supabaseAnonKey?: string | null) {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!token || !supabaseAnonKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    console.error("Failed to validate auth token:", error);
    return null;
  }

  return data.user.id;
}

async function exchangeFacebookCode(params: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri: string;
}) {
  const query = new URLSearchParams({
    client_id: params.appId,
    client_secret: params.appSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const response = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${query.toString()}`);
  const payload = await response.json();

  if (payload.error) {
    console.error("Facebook code exchange error details:", {
      redirectUri: params.redirectUri,
      status: response.status,
      error: payload.error,
    });
  }

  return payload;
}

function parseStatePayload(state: string): ParsedState {
  for (const candidate of [decodeURIComponent(state), state]) {
    try {
      const parsed = JSON.parse(atob(candidate));
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return {};
}

function respondSuccess(params: {
  appOrigin: string | null;
  isJsonRequest: boolean;
  path: string;
  payload: Record<string, unknown>;
  params: Record<string, string>;
}) {
  if (params.isJsonRequest) {
    return jsonResponse(params.payload, 200);
  }

  return redirectToApp(params.appOrigin, params.path, params.params);
}

function respondError(params: {
  appOrigin: string | null;
  isJsonRequest: boolean;
  message: string;
  path: string;
  status: number;
}) {
  if (params.isJsonRequest) {
    return jsonResponse({ error: params.message }, params.status);
  }

  return redirectToApp(params.appOrigin, params.path, {
    error: "1",
    message: params.message,
    popup: "1",
  });
}

function jsonResponse(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function redirectToApp(
  appOrigin: string | null,
  path: string,
  params: Record<string, string>,
) {
  const target = new URL(path, sanitizeOrigin(appOrigin));

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      target.searchParams.set(key, value);
    }
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
    },
  });
}

function sanitizeOrigin(origin: string | null) {
  if (origin && /^https?:\/\//.test(origin)) {
    return origin;
  }

  return DEFAULT_APP_ORIGIN;
}