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
    userId: user.id,
    instanceId: inst.zapi_instance_id,
    token: inst.zapi_token,
    clientToken: inst.zapi_client_token,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      instanceDbId,
      phone,
      messageId,
      referenceId,
      orderRequestId,
      orderStatus,
      paymentStatus,
      order,
    } = body || {};

    if (!phone) throw new Error("phone é obrigatório");
    if (!orderStatus && !paymentStatus) throw new Error("orderStatus ou paymentStatus é obrigatório");

    const creds = await resolveCreds(req, instanceDbId);

    const url = `https://api.z-api.io/instances/${creds.instanceId}/token/${creds.token}/order-status-update`;
    const payload: Record<string, unknown> = {
      phone: sanitizePhone(phone),
    };
    if (messageId) payload.messageId = messageId;
    if (referenceId) payload.referenceId = referenceId;
    if (orderRequestId) payload.orderRequestId = orderRequestId;
    if (orderStatus) payload.orderStatus = orderStatus;
    if (paymentStatus) payload.paymentStatus = paymentStatus;
    if (order && typeof order === "object") payload.order = order;

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
      console.error("❌ order-status-update failed", resp.status, data);
      return new Response(
        JSON.stringify({ error: data?.error || data?.message || "Falha ao atualizar status do pedido", details: data }),
        { status: resp.status || 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("✅ order-status-update ok", data);
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ send-order-status-update error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});