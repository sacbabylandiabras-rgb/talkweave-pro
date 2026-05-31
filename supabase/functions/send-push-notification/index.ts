import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Tipo do evento — usado para checar preferências de notificação do usuário.
   *  Valores aceitos: 'credit_card' | 'boleto_paid' | 'pix_paid' | 'pix_recurring'
   *  | 'apple_pay' | 'pix_or_boleto_issued' | 'report' | undefined (sempre envia) */
  event_type?: string;
  /** Checkout específico — se ausente, usa preferência padrão (checkout_id IS NULL). */
  checkout_id?: string | null;
}

/**
 * Mapeia o tipo de evento para o nome do arquivo de som (sem extensão).
 *
 * IMPORTANTE: Os arquivos de som DEVEM existir dentro do app nativo:
 *  - iOS:     ios/<App>/Sounds/<nome>.wav   (formato CAF/AIFF/WAV, máx 30s)
 *  - Android: android/app/src/main/res/raw/<nome>.mp3 (somente minúsculas e _)
 *
 * iOS espera o nome COM extensão (ex: "venda_aprovada.wav").
 * Android espera SEM extensão (ex: "venda_aprovada") + um channel próprio.
 */
function getSoundForEvent(eventType?: string): { ios: string; android: string; channel: string } {
  switch (eventType) {
    case "pix_paid":
    case "credit_card":
    case "boleto_paid":
    case "apple_pay":
    case "pix_recurring":
      return { ios: "venda_aprovada.wav", android: "venda_aprovada", channel: "venda_aprovada" };
    case "pix_or_boleto_issued":
      return { ios: "venda_pendente.wav", android: "venda_pendente", channel: "venda_pendente" };
    case "credit_card_failed":
    case "payment_failed":
      return { ios: "venda_recusada.wav", android: "venda_recusada", channel: "venda_recusada" };
    case "withdrawal_approved":
    case "withdrawal_paid":
      return { ios: "saque_aprovado.wav", android: "saque_aprovado", channel: "saque_aprovado" };
    case "report":
      return { ios: "relatorio.wav", android: "relatorio", channel: "relatorio" };
    default:
      return { ios: "default", android: "default", channel: "transactions" };
  }
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  // Create JWT for Google OAuth2
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const signInput = `${header}.${claimSet}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const jwt = `${signInput}.${btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("FCM_SERVICE_ACCOUNT secret not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const projectId = serviceAccount.project_id;

    const payload: PushPayload = await req.json();
    const { user_id, title, body, data, event_type, checkout_id, url } = payload;

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "user_id, title e body são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's push tokens
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verifica preferências de notificação (se event_type for fornecido)
    if (event_type) {
      const prefKeyMap: Record<string, string> = {
        credit_card: "notify_credit_card",
        boleto_paid: "notify_boleto_paid",
        pix_paid: "notify_pix_paid",
        pix_recurring: "notify_pix_recurring",
        apple_pay: "notify_apple_pay",
        pix_or_boleto_issued: "notify_pix_or_boleto_issued",
      };
      const prefKey = prefKeyMap[event_type];
      if (prefKey) {
        // Tenta preferência específica do checkout, senão a padrão (checkout_id IS NULL)
        let prefRow: any = null;
        if (checkout_id) {
          const { data: r } = await supabase
            .from("notification_preferences")
            .select("enabled," + prefKey)
            .eq("user_id", user_id)
            .eq("checkout_id", checkout_id)
            .maybeSingle();
          prefRow = r;
        }
        if (!prefRow) {
          const { data: r } = await supabase
            .from("notification_preferences")
            .select("enabled," + prefKey)
            .eq("user_id", user_id)
            .is("checkout_id", null)
            .maybeSingle();
          prefRow = r;
        }
        // Se existir preferência, respeita; se não existir, default ON para todos os eventos
        if (prefRow) {
          if (prefRow.enabled === false || prefRow[prefKey] === false) {
            return new Response(
              JSON.stringify({ success: true, sent: 0, skipped: true, reason: "user preference disabled" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    const { data: tokens, error: tokensError } = await supabase
      .from("device_push_tokens")
      .select("token, platform")
      .eq("user_id", user_id);

    if (tokensError) {
      throw new Error(`Error fetching tokens: ${tokensError.message}`);
    }

    const results: any = { web_push: null, telegram: null, fcm: { sent: 0, errors: [] } };

     console.log(`[send-push-notification] Triggering web-push-send for user: ${user_id}`);
     const webPushPromise = fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/web-push-send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          user_id,
          title,
          body,
          url: url || data?.url || "/",
          tag: event_type || "zaplynx",
        }),
      }
     ).then(async res => {
       const text = await res.text();
       console.log(`[send-push-notification] web-push-send response status: ${res.status} body: ${text}`);
       try { return JSON.parse(text); } catch { return { error: "Invalid JSON", text }; }
     }).catch(e => {
       console.error(`[send-push-notification] web-push-send fetch error:`, e);
       return { error: String(e) };
     });

    const telegramPromise = (async () => {
      try {
        // Relatórios são apenas para o dono do BOT no app (push/web-push).
        // Nunca devem ser entregues como mensagem dentro do chat do bot
        // — isso vazaria dados de vendas para os clientes finais.
        if (event_type === "report") {
          return { skipped: true, reason: "report event - telegram suppressed" };
        }
        const { data: bot } = await supabase
          .from("telegram_bots")
          .select("bot_token")
          .eq("user_id", user_id)
          .eq("active", true)
          .limit(1)
          .maybeSingle();

        if (!bot?.bot_token) return { skipped: true, reason: "no active bot" };

        const { data: lastMsg } = await supabase
          .from("telegram_messages")
          .select("chat_id")
          .eq("user_id", user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastMsg?.chat_id) return { skipped: true, reason: "no chat_id found" };

        const tgMsg = `<b>${title}</b>\n\n${body}`;
        const tgRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: lastMsg.chat_id,
            text: tgMsg,
            parse_mode: "HTML",
          }),
        });
        return await tgRes.json();
      } catch (e) {
        return { error: String(e) };
      }
    })();

    const [wpRes, tgRes] = await Promise.all([webPushPromise, telegramPromise]);
    results.web_push = wpRes;
    results.telegram = tgRes;

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, ...results, message: "No FCM tokens, other channels attempted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(serviceAccount);

    for (const deviceToken of tokens) {
      try {
        const message: any = {
          message: {
            token: deviceToken.token,
            notification: { title, body },
          },
        };

        if (data) {
          message.message.data = data;
        }

        // Som customizado por tipo de evento
        const sound = getSoundForEvent(event_type);

        // Platform-specific config
        if (deviceToken.platform === "android") {
          message.message.android = {
            priority: "high",
            notification: {
              sound: sound.android,
              channel_id: sound.channel,
            },
          };
        } else if (deviceToken.platform === "ios") {
          message.message.apns = {
            payload: {
              aps: {
                sound: sound.ios,
                badge: 1,
              },
            },
          };
        }

        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
          }
        );

        if (res.ok) {
          results.fcm.sent++;
        } else {
          const errBody = await res.text();
          console.error(`FCM error for token ${deviceToken.token}:`, errBody);
          if (errBody.includes("UNREGISTERED") || errBody.includes("INVALID_ARGUMENT")) {
            await supabase.from("device_push_tokens").delete().eq("token", deviceToken.token);
          }
          results.fcm.errors.push(errBody);
        }
      } catch (e: any) {
        results.fcm.errors.push(e.message);
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
