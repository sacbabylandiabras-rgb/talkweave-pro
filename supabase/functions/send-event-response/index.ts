import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sanitizePhone = (phone: string) => String(phone || "").replace(/\D/g, "");

async function resolveCreds(req: Request, instanceDbId?: string) {
  const auth = req.headers.get("authorization");
  if (!auth) throw new Error("Unauthorized");
  const token = auth.replace(/^Bearer\s+/i, "");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  const select = "id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, is_default, is_active";
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let q = admin.from("zapi_instances")
    .select(select)
    .eq("user_id", user.id)
    .eq("api_provider", "zapi")
    .eq("is_active", true);

  if (instanceDbId) {
    q = uuidLike.test(instanceDbId) ? q.eq("id", instanceDbId) : q.eq("zapi_instance_id", instanceDbId);
  } else {
    q = q.eq("is_default", true);
  }

  let { data: inst } = await q.maybeSingle();
  if (!inst) {
    const r = await admin.from("zapi_instances")
      .select(select)
      .eq("user_id", user.id).eq("api_provider", "zapi").eq("is_active", true).limit(1).maybeSingle();
    inst = r.data as any;
  }
  if (!inst?.zapi_instance_id || !inst?.zapi_token || !inst?.zapi_client_token) {
    throw new Error("Conexão WhatsApp não configurada");
  }
  return {
    instanceId: inst.zapi_instance_id,
    token: inst.zapi_token,
    clientToken: inst.zapi_client_token,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { instanceDbId, phone, eventMessageId, eventResponse } = body || {};

    if (!phone) throw new Error("phone é obrigatório");
    if (!eventMessageId) throw new Error("eventMessageId é obrigatório");
    if (!eventResponse) throw new Error("eventResponse é obrigatório (1=Sim, 2=Talvez, 3=Não)");

    const creds = await resolveCreds(req, instanceDbId);
    const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/send-event-response`;

    const payload = {
      phone: sanitizePhone(phone),
      eventMessageId,
      eventResponse: String(eventResponse),
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": creds.clientToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.error) {
      console.error("❌ send-event-response failed", resp.status, data);
      return new Response(
        JSON.stringify({ error: data?.error || data?.message || "Falha ao responder evento", details: data }),
        { status: resp.status || 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("✅ send-event-response ok", data);
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ send-event-response error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});