import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Disparo Oculto - envia mensagem usando instâncias Z-API cadastradas pelo admin
 * na tabela hidden_dispatch_instances. Qualquer usuário autenticado pode invocar.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { hiddenInstanceId, phone, message, mediaUrl, mediaType, buttons, footer } = await req.json();

    if (!hiddenInstanceId || !phone) {
      return new Response(JSON.stringify({ error: "hiddenInstanceId e phone são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!message && !mediaUrl) {
      return new Response(JSON.stringify({ error: "Informe message ou mediaUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inst, error: instErr } = await admin
      .from("hidden_dispatch_instances")
      .select("*")
      .eq("id", hiddenInstanceId)
      .eq("is_active", true)
      .maybeSingle();

    if (instErr || !inst) {
      return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = String(phone).replace(/\D/g, "");
    const btnList: Array<{ label: string; url?: string; phone?: string }> =
      Array.isArray(buttons) ? buttons.filter((b: any) => b && b.label) : [];
    const hasButtons = btnList.length > 0;

    let endpoint = "";
    let body: Record<string, unknown> = {};
    let headers: Record<string, string> = { "Content-Type": "application/json" };

    {
      // Z-API
      const iid = inst.zapi_instance_id;
      const tkn = inst.zapi_token;
      const cTkn = inst.zapi_client_token;
      if (!iid || !tkn || !cTkn) {
        return new Response(JSON.stringify({ error: "Credenciais Z-API incompletas" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      headers["Client-Token"] = cTkn;

      const base = `https://api.z-api.io/instances/${iid}/token/${tkn}`;
      if (hasButtons && mediaUrl && mediaType === "image") {
        // Z-API - imagem com botões
        endpoint = `${base}/send-button-actions`;
        body = {
          phone: cleanPhone,
          message: message || "",
          image: mediaUrl,
          ...(footer ? { footer } : {}),
          buttonActions: btnList.map((b, idx) => {
            if (b.url) return { id: String(idx + 1), type: "URL", url: b.url, label: b.label };
            if (b.phone) return { id: String(idx + 1), type: "CALL", phone: b.phone, label: b.label };
            return { id: String(idx + 1), type: "REPLY", label: b.label };
          }),
        };
      } else if (hasButtons) {
        // Z-API - texto com botões
        endpoint = `${base}/send-button-actions`;
        body = {
          phone: cleanPhone,
          message: message || "",
          ...(footer ? { footer } : {}),
          buttonActions: btnList.map((b, idx) => {
            if (b.url) return { id: String(idx + 1), type: "URL", url: b.url, label: b.label };
            if (b.phone) return { id: String(idx + 1), type: "CALL", phone: b.phone, label: b.label };
            return { id: String(idx + 1), type: "REPLY", label: b.label };
          }),
        };
      } else if (mediaUrl && mediaType === "image") {
        endpoint = `${base}/send-image`;
        body = { phone: cleanPhone, image: mediaUrl, caption: message || "" };
      } else if (mediaUrl && mediaType === "video") {
        endpoint = `${base}/send-video`;
        body = { phone: cleanPhone, video: mediaUrl, caption: message || "" };
      } else if (mediaUrl && mediaType === "audio") {
        endpoint = `${base}/send-audio`;
        body = { phone: cleanPhone, audio: mediaUrl };
      } else if (mediaUrl && mediaType === "document") {
        const ext = (mediaUrl.split(".").pop() || "pdf").toLowerCase();
        endpoint = `${base}/send-document/${ext}`;
        body = { phone: cleanPhone, document: mediaUrl, fileName: `arquivo.${ext}` };
      } else {
        endpoint = `${base}/send-text`;
        body = { phone: cleanPhone, message: message || "" };
      }
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data?.error || data?.message || `HTTP ${res.status}`, details: data }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});