import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_VERSION = "v21.0";

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Sessão inválida" }, 401);
    }

    const userId = claimsData.claims.sub as string;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: creds, error: credsError } = await serviceClient
      .from("meta_credentials")
      .select("access_token, phone_number_id, waba_id")
      .eq("user_id", userId)
      .eq("connected", true)
      .maybeSingle();

    if (credsError || !creds) {
      return jsonResponse({ error: "Conta Meta não conectada. Conecte via Facebook primeiro." }, 400);
    }

    if (!creds.access_token || !creds.phone_number_id) {
      return jsonResponse({ error: "Credenciais incompletas. Phone Number ID não detectado. Reconecte sua conta." }, 400);
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "send_template":
        return await sendTemplateMessage(creds, body);
      case "send_text":
        return await sendTextMessage(creds, body);
      case "list_templates":
        return await listTemplates(creds);
      case "get_profile":
        return await getBusinessProfile(creds);
      case "update_profile_name":
        return await updateProfileName(creds, body);
      case "update_profile_photo":
        return await updateProfilePhoto(creds, body);
      case "get_phone_numbers":
        return await getPhoneNumbers(creds);
      default:
        return jsonResponse({ error: "Ação inválida" }, 400);
    }
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

// ── Send Template ──
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

// ── Send Text ──
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

// ── List Templates ──
async function listTemplates(creds: { access_token: string; phone_number_id: string; waba_id?: string }) {
  if (!creds.waba_id) {
    return jsonResponse({ error: "WABA ID não configurado. Reconecte sua conta." }, 400);
  }

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.waba_id}/message_templates?limit=250`,
    creds.access_token
  );
  if (result instanceof Response) return result;
  return jsonResponse({ templates: result.data.data || [] });
}

// ── Get Business Profile ──
async function getBusinessProfile(creds: { access_token: string; phone_number_id: string }) {
  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
    creds.access_token
  );
  if (result instanceof Response) return result;

  // Also get the phone number details
  const phoneResult = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,name_status`,
    creds.access_token
  );
  if (phoneResult instanceof Response) return phoneResult;

  return jsonResponse({
    profile: result.data.data?.[0] || {},
    phone_info: phoneResult.data || {},
  });
}

// ── Update Profile Name (about) ──
async function updateProfileName(
  creds: { access_token: string; phone_number_id: string },
  body: { about?: string; description?: string; address?: string; email?: string; websites?: string[] }
) {
  const updateData: any = { messaging_product: "whatsapp" };
  if (body.about !== undefined) updateData.about = body.about;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.address !== undefined) updateData.address = body.address;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.websites !== undefined) updateData.websites = body.websites;

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/whatsapp_business_profile`,
    creds.access_token,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updateData) }
  );
  if (result instanceof Response) return result;
  return jsonResponse({ success: true });
}

// ── Update Profile Photo ──
async function updateProfilePhoto(
  creds: { access_token: string; phone_number_id: string },
  body: { photo_url: string }
) {
  if (!body.photo_url) {
    return jsonResponse({ error: "URL da foto é obrigatória" }, 400);
  }

  console.log("Updating profile photo via profile_picture_url");

  // Use the WhatsApp Business Profile API with profile_picture_url
  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.phone_number_id}/whatsapp_business_profile`,
    creds.access_token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        profile_picture_url: body.photo_url,
      }),
    }
  );
  if (result instanceof Response) return result;
  return jsonResponse({ success: true });
}

// ── Get Phone Numbers ──
async function getPhoneNumbers(creds: { access_token: string; phone_number_id: string; waba_id?: string }) {
  if (!creds.waba_id) {
    return jsonResponse({ error: "WABA ID não configurado" }, 400);
  }

  const result = await metaFetch(
    `https://graph.facebook.com/${API_VERSION}/${creds.waba_id}/phone_numbers?fields=display_phone_number,verified_name,quality_rating,name_status,code_verification_status`,
    creds.access_token
  );
  if (result instanceof Response) return result;
  return jsonResponse({ phone_numbers: result.data.data || [] });
}
