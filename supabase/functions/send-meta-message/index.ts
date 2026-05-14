import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listAccessiblePhoneNumbers, type MetaCredentialsForDiscovery } from "./meta-phone-discovery.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_VERSION = "v21.0";
const WHATSAPP_META_APP_ID = "26985190684454065";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Sessão inválida" }, 401);
    }

    const userId = user.id;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: creds, error: credsError } = await serviceClient
      .from("meta_credentials")
      .select("access_token, phone_number_id, waba_id, business_account_id")
      .eq("user_id", userId)
      .eq("app_id", WHATSAPP_META_APP_ID)
      .eq("connected", true)
      .maybeSingle();

    if (credsError || !creds) {
      return jsonResponse({ error: "Conta Meta não conectada. Conecte via Facebook primeiro." }, 400);
    }

    if (!creds.access_token) {
      return jsonResponse({ error: "Credenciais incompletas. Access Token não detectado. Reconecte sua conta." }, 400);
    }

    const body = await req.json();
    const { action, override_phone_number_id, phone_number_id, phone: directPhone } = body;
    const effectivePhoneId = override_phone_number_id || phone_number_id || creds.phone_number_id;
    console.log(`[send-meta-message] action=${action}, override=${override_phone_number_id || 'none'}, default=${creds.phone_number_id}, effective=${effectivePhoneId}, to=${directPhone || 'none'}`);

    let result;
    switch (action) {
      case "send_template":
        if (!effectivePhoneId) return jsonResponse({ error: "Phone ID não detectado" }, 400);
        result = await sendTemplateMessage({ access_token: creds.access_token, phone_number_id: effectivePhoneId }, { ...body, phone: directPhone || body.phone });
        break;
      case "send_text":
        if (!effectivePhoneId) return jsonResponse({ error: "Phone ID não detectado" }, 400);
        result = await sendTextMessage({ access_token: creds.access_token, phone_number_id: effectivePhoneId }, { ...body, phone: directPhone || body.phone });
        break;
      case "send_media":
        if (!effectivePhoneId) return jsonResponse({ error: "Phone ID não detectado" }, 400);
        result = await sendMediaMessage({ access_token: creds.access_token, phone_number_id: effectivePhoneId }, { ...body, phone: directPhone || body.phone });
        break;
      case "send_interactive":
        if (!effectivePhoneId) return jsonResponse({ error: "Phone ID não detectado" }, 400);
        result = await sendInteractiveMessage({ access_token: creds.access_token, phone_number_id: effectivePhoneId }, { ...body, phone: directPhone || body.phone });
        break;
      case "list_templates":
        return await listTemplates(creds, effectivePhoneId);
      case "create_template":
        return await createTemplate(creds, body);
      case "get_profile":
        if (!creds.phone_number_id) {
          return jsonResponse({ error: "Credenciais incompletas. Phone Number ID não detectado. Reconecte sua conta." }, 400);
        }
        return await getBusinessProfile({ access_token: creds.access_token, phone_number_id: creds.phone_number_id });
      case "update_profile_name":
        if (!creds.phone_number_id) {
          return jsonResponse({ error: "Credenciais incompletas. Phone Number ID não detectado. Reconecte sua conta." }, 400);
        }
        return await updateProfileName({ access_token: creds.access_token, phone_number_id: creds.phone_number_id }, body);
      case "update_profile_photo":
        if (!creds.phone_number_id) {
          return jsonResponse({ error: "Credenciais incompletas. Phone Number ID não detectado. Reconecte sua conta." }, 400);
        }
        return await updateProfilePhoto({ access_token: creds.access_token, phone_number_id: creds.phone_number_id }, body);
      case "get_phone_numbers":
        return await getPhoneNumbers(creds);
    }

    if (result && result instanceof Response && result.status === 200) {
      const data = await result.clone().json();
      if (data?.success) {
        const { phone, message, media_type } = body;
        const content = message || (media_type ? `[Mídia: ${media_type}]` : '[mensagem]');
        
        console.log(`📝 Logging manual send to message_logs: to=${phone}, content=${content.slice(0, 50)}`);
        
        await serviceClient.from('message_logs').insert({
          user_id: userId,
          phone: phone,
          message_received: null,
          keyword_matched: '__manual_send__',
          response_sent: content,
          instance_id: `meta:${effectivePhoneId}`,
        });
      }
    }

    if (result) return result;
    return jsonResponse({ error: "Ação inválida ou sem resposta" }, 400);
  } catch (err) {
    console.error("send-meta-message error:", err);
    return jsonResponse({ error: (err as Error).message || "Erro interno" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function metaFetch(url: string, token: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Meta API error:", data);
    return jsonResponse(
      { error: data?.error?.message || "Erro na Meta API", details: data?.error },
      res.status
    );
  }
  return { data, ok: true };
}

async function sendTemplateMessage(
  creds: { access_token: string; phone_number_id: string },
  body: { phone: string; template_name: string; language?: string; variables?: string[] }
) {
  const { phone, template_name, language = "pt_BR", variables = [] } = body;
  if (!phone || !template_name) {
    return jsonResponse({ error: "Número e template são obrigatórios" }, 400);
  }

  const components: any[] = [];
  if (variables.length > 0) {
    components.push({
      type: "body",
      parameters: variables.map((v) => ({ type: "text", text: v })),
    });
  }

  const payload: any = {
    messaging_product: "whatsapp",
    to: phone.replace(/\D/g, ""),
    type: "template",
    template: { name: template_name, language: { code: language } },
  };
  if (components.length > 0) payload.template.components = components;

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/messages`,
    creds.access_token,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
  );
  if (result instanceof Response) return result;
  return jsonResponse({ success: true, data: result.data });
}

async function sendTextMessage(
  creds: { access_token: string; phone_number_id: string },
  body: { phone: string; message: string }
) {
  const { phone, message } = body;
  if (!phone || !message) {
    return jsonResponse({ error: "Número e mensagem são obrigatórios" }, 400);
  }

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/messages`,
    creds.access_token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.replace(/\D/g, ""),
        type: "text",
        text: { body: message },
      }),
    }
  );
  if (result instanceof Response) return result;
  return jsonResponse({ success: true, data: result.data });
}

async function resolveWabaIdForPhoneNumber(
  creds: { access_token: string; waba_id?: string | null; business_account_id?: string | null; phone_number_id?: string | null },
  phoneNumberId?: string | null,
) {
  if (!phoneNumberId) return creds.waba_id || null;

  const phoneNumbers = await listAccessiblePhoneNumbers(creds, API_VERSION);
  const matchedPhone = phoneNumbers.find((phone) => phone.id === phoneNumberId);

  return matchedPhone?.waba_id || creds.waba_id || null;
}

async function listTemplates(
  creds: { access_token: string; waba_id?: string | null; business_account_id?: string | null; phone_number_id?: string | null },
  phoneNumberId?: string | null,
) {
  const resolvedWabaId = await resolveWabaIdForPhoneNumber(creds, phoneNumberId);

  if (!resolvedWabaId) {
    return jsonResponse({ error: "WABA ID não configurado para o número remetente selecionado." }, 400);
  }

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${resolvedWabaId}/message_templates?limit=250`,
    creds.access_token
  );
  if (result instanceof Response) return result;
  return jsonResponse({ templates: result.data.data || [], waba_id: resolvedWabaId });
}

async function createTemplate(
  creds: { access_token: string; waba_id?: string | null },
  body: { name: string; category: string; language?: string; header_text?: string; body_text: string; footer_text?: string; buttons?: { type: string; text: string; url?: string; phone_number?: string }[] }
) {
  if (!creds.waba_id) {
    return jsonResponse({ error: "WABA ID não configurado. Reconecte sua conta." }, 400);
  }
  if (!body.name || !body.body_text) {
    return jsonResponse({ error: "Nome e corpo do template são obrigatórios" }, 400);
  }

  const components: any[] = [];

  if (body.header_text) {
    components.push({ type: "HEADER", format: "TEXT", text: body.header_text });
  }

  components.push({ type: "BODY", text: body.body_text });

  if (body.footer_text) {
    components.push({ type: "FOOTER", text: body.footer_text });
  }

  if (Array.isArray(body.buttons) && body.buttons.length > 0) {
    const buttons = body.buttons.map((button) => {
      if (button.type === "URL") {
        return { type: "URL", text: button.text, url: button.url };
      }
      if (button.type === "PHONE_NUMBER") {
        return { type: "PHONE_NUMBER", text: button.text, phone_number: button.phone_number };
      }
      return { type: "QUICK_REPLY", text: button.text };
    });

    components.push({ type: "BUTTONS", buttons });
  }

  const payload = {
    name: body.name,
    category: body.category,
    language: body.language || "pt_BR",
    components,
  };

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.waba_id}/message_templates`,
    creds.access_token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (result instanceof Response) return result;
  return jsonResponse({ success: true, data: result.data });
}

async function getBusinessProfile(creds: { access_token: string; phone_number_id: string }) {
  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
    creds.access_token
  );
  if (result instanceof Response) return result;
  return jsonResponse({ profile: result.data.data?.[0] || null });
}

async function updateProfileName(
  creds: { access_token: string; phone_number_id: string },
  body: { display_name: string }
) {
  if (!body.display_name) {
    return jsonResponse({ error: "Nome é obrigatório" }, 400);
  }

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/whatsapp_business_profile`,
    creds.access_token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", name: body.display_name }),
    }
  );
  if (result instanceof Response) return result;
  return jsonResponse({ success: true, data: result.data });
}

async function updateProfilePhoto(
  creds: { access_token: string; phone_number_id: string },
  body: { profile_picture_handle: string }
) {
  if (!body.profile_picture_handle) {
    return jsonResponse({ error: "Handle da foto é obrigatório" }, 400);
  }

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/whatsapp_business_profile`,
    creds.access_token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        profile_picture_handle: body.profile_picture_handle,
      }),
    }
  );
  if (result instanceof Response) return result;
  return jsonResponse({ success: true, data: result.data });
}

async function getPhoneNumbers(creds: MetaCredentialsForDiscovery) {
  const phoneNumbers = await listAccessiblePhoneNumbers(creds, API_VERSION);
  return jsonResponse({ phone_numbers: phoneNumbers });
}

async function sendMediaMessage(
  creds: { access_token: string; phone_number_id: string },
  body: { phone: string; media_url: string; media_type: string; caption?: string; voice?: boolean }
) {
  const { phone, media_url, media_type, caption } = body;
  if (!phone || !media_url || !media_type) {
    return jsonResponse({ error: "Número, URL da mídia e tipo são obrigatórios" }, 400);
  }

  const typeMap: Record<string, string> = {
    image: "image",
    video: "video",
    audio: "audio",
    document: "document",
  };

  const metaType = typeMap[media_type] || "document";
  const mediaPayload: Record<string, any> = { link: media_url };
  if (caption && metaType !== "audio") {
    mediaPayload.caption = caption;
  }
  // Send as voice note if it's an OGG/OPUS audio file
  if (metaType === "audio") {
    const lowerUrl = media_url.toLowerCase();
    let pathname = lowerUrl;
    try {
      pathname = new URL(media_url).pathname.toLowerCase();
    } catch {
      pathname = lowerUrl.split("?")[0] || lowerUrl;
    }
    if (pathname.endsWith(".ogg") || lowerUrl.includes("audio/ogg") || body.voice === true) {
      mediaPayload.voice = true;
    }
  }
  if (metaType === "document") {
    mediaPayload.filename = media_url.split("/").pop() || "file";
  }

  const payload = {
    messaging_product: "whatsapp",
    to: phone.replace(/\D/g, ""),
    type: metaType,
    [metaType]: mediaPayload,
  };

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/messages`,
    creds.access_token,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
  );
  if (result instanceof Response) return result;
  return jsonResponse({ success: true, data: result.data });
}

async function sendInteractiveMessage(
  creds: { access_token: string; phone_number_id: string },
  body: { phone: string; message: string; buttons: { id: string; title: string }[] }
) {
  const { phone, message, buttons } = body;
  if (!phone || !message || !buttons?.length) {
    return jsonResponse({ error: "Número, mensagem e botões são obrigatórios" }, 400);
  }

  // Meta allows max 3 buttons per interactive message
  const metaButtons = buttons.slice(0, 3).map((btn) => ({
    type: "reply",
    reply: { id: btn.id, title: btn.title.slice(0, 20) },
  }));

  const payload = {
    messaging_product: "whatsapp",
    to: phone.replace(/\D/g, ""),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: message },
      action: { buttons: metaButtons },
    },
  };

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/messages`,
    creds.access_token,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
  );
  if (result instanceof Response) return result;
  return jsonResponse({ success: true, data: result.data });
}
