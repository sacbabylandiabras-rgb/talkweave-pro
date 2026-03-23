import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's Meta credentials
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: creds, error: credsError } = await serviceClient
      .from("meta_credentials")
      .select("access_token, phone_number_id, waba_id")
      .eq("user_id", user.id)
      .eq("connected", true)
      .maybeSingle();

    if (credsError || !creds) {
      return new Response(
        JSON.stringify({ error: "Conta Meta não conectada. Conecte via Facebook primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!creds.access_token || !creds.phone_number_id) {
      return new Response(
        JSON.stringify({ error: "Credenciais incompletas. Phone Number ID não detectado. Reconecte sua conta." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // Route actions
    if (action === "send_template") {
      return await sendTemplateMessage(creds, body, corsHeaders);
    } else if (action === "send_text") {
      return await sendTextMessage(creds, body, corsHeaders);
    } else if (action === "list_templates") {
      return await listTemplates(creds, corsHeaders);
    } else {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("send-meta-message error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendTemplateMessage(
  creds: { access_token: string; phone_number_id: string },
  body: { phone: string; template_name: string; language?: string; variables?: string[] },
  headers: Record<string, string>
) {
  const { phone, template_name, language = "pt_BR", variables = [] } = body;

  if (!phone || !template_name) {
    return new Response(JSON.stringify({ error: "Número e template são obrigatórios" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
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
    template: {
      name: template_name,
      language: { code: language },
    },
  };

  if (components.length > 0) {
    payload.template.components = components;
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${creds.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("Meta API error:", data);
    return new Response(
      JSON.stringify({
        error: data?.error?.message || "Erro ao enviar mensagem",
        details: data?.error,
      }),
      { status: res.status, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function sendTextMessage(
  creds: { access_token: string; phone_number_id: string },
  body: { phone: string; message: string },
  headers: Record<string, string>
) {
  const { phone, message } = body;

  if (!phone || !message) {
    return new Response(JSON.stringify({ error: "Número e mensagem são obrigatórios" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${creds.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.replace(/\D/g, ""),
        type: "text",
        text: { body: message },
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("Meta API text error:", data);
    return new Response(
      JSON.stringify({
        error: data?.error?.message || "Erro ao enviar mensagem de texto",
        details: data?.error,
      }),
      { status: res.status, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function listTemplates(
  creds: { access_token: string; phone_number_id: string; waba_id?: string },
  headers: Record<string, string>
) {
  if (!creds.waba_id) {
    return new Response(
      JSON.stringify({ error: "WABA ID não configurado. Reconecte sua conta." }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${creds.waba_id}/message_templates?limit=100`,
    {
      headers: { Authorization: `Bearer ${creds.access_token}` },
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("Meta templates error:", data);
    return new Response(
      JSON.stringify({ error: data?.error?.message || "Erro ao buscar templates" }),
      { status: res.status, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ templates: data.data || [] }), {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
