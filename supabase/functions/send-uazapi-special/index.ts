import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Send special UAZAPI message types:
 * - status (Stories)            → POST /send/status
 * - location-button             → POST /send/location-button
 * - request-payment             → POST /send/request-payment
 *
 * Body: {
 *   kind: 'status' | 'location-button' | 'request-payment',
 *   instanceId?: string,         // zapi_instances.id (UAZAPI only). If omitted → user default
 *   phone?: string,              // required for location-button & request-payment
 *   payload: Record<string, any> // forwarded to UAZAPI as-is (merged with `number` when needed)
 * }
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) {
      return json({ success: false, error: "Missing Authorization" }, 401);
    }

    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const kind = String(body?.kind || "").trim();
    const phone = String(body?.phone || "").replace(/\D/g, "");
    const payload = (body?.payload && typeof body.payload === "object") ? body.payload : {};
    const instanceIdInput = body?.instanceId ? String(body.instanceId) : null;

    const validKinds = ["status", "location-button", "request-payment"];
    if (!validKinds.includes(kind)) {
      return json({ success: false, error: `Invalid kind. Use one of: ${validKinds.join(", ")}` }, 400);
    }

    if ((kind === "location-button" || kind === "request-payment") && !phone) {
      return json({ success: false, error: "phone is required for this kind" }, 400);
    }

    // Resolve UAZAPI instance: explicit id → user default UAZAPI instance
    let inst: any = null;
    if (instanceIdInput) {
      const { data } = await admin
        .from("zapi_instances")
        .select("id, user_id, api_provider, evolution_api_url, evolution_api_key, instance_name")
        .eq("user_id", user.id)
        .or(`id.eq.${instanceIdInput},zapi_instance_id.eq.${instanceIdInput}`)
        .maybeSingle();
      inst = data;
    } else {
      const { data } = await admin
        .from("zapi_instances")
        .select("id, user_id, api_provider, evolution_api_url, evolution_api_key, instance_name, is_default, created_at")
        .eq("user_id", user.id)
        .ilike("api_provider", "uazapi")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      inst = data;
    }

    if (!inst) {
      return json({ success: false, error: "Nenhuma instância UAZAPI encontrada para este usuário." }, 400);
    }
    if (String(inst.api_provider || "").toLowerCase() !== "uazapi") {
      return json({ success: false, error: "Esta funcionalidade requer uma instância UAZAPI." }, 400);
    }

    const apiUrl = String(inst.evolution_api_url || "").replace(/\/+$/, "");
    const apiToken = String(inst.evolution_api_key || "");
    if (!apiUrl || !apiToken) {
      return json({ success: false, error: "Instância UAZAPI sem URL/token configurados." }, 500);
    }

    const endpointMap: Record<string, string> = {
      "status": "/send/status",
      "location-button": "/send/location-button",
      "request-payment": "/send/request-payment",
    };
    const endpoint = endpointMap[kind];

    // Build final body: status doesn't take `number`; the others do.
    const finalBody: Record<string, any> = { ...payload };
    if (kind === "status") {
      if (finalBody.media && !finalBody.file) finalBody.file = finalBody.media;
      if (finalBody.caption && !finalBody.text) finalBody.text = finalBody.caption;
      if (finalBody.backgroundColor && !finalBody.background_color) {
        const raw = String(finalBody.backgroundColor).trim();
        const hexToUazBg = (value: string): number => {
          const numeric = Number(value);
          if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= 19) return Math.round(numeric);
          const match = value.replace('#', '').match(/^([0-9a-f]{6})$/i);
          if (!match) return 19;
          const r = parseInt(match[1].slice(0, 2), 16);
          const g = parseInt(match[1].slice(2, 4), 16);
          const b = parseInt(match[1].slice(4, 6), 16);
          if (r > 200 && g > 200 && b < 100) return 2;
          if (g > 150 && r < 150 && b < 150) return 5;
          if (b > 150 && r < 150) return 8;
          if (r > 150 && b > 150 && g < 150) return 11;
          if (r > 200 && b > 100 && g < 100) return 13;
          if (r > 200 && g < 150 && b > 150) return 14;
          if (r > 100 && g > 60 && b < 80) return 16;
          return 19;
        };
        finalBody.background_color = hexToUazBg(raw);
      }
      if (finalBody.font !== undefined) finalBody.font = Number(finalBody.font || 1);
      delete finalBody.media;
      delete finalBody.caption;
      delete finalBody.backgroundColor;
    }
    if (kind !== "status") {
      finalBody.number = phone;
    }

    console.log(`📤 UAZAPI special → ${apiUrl}${endpoint}`, JSON.stringify(finalBody).slice(0, 400));

    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": apiToken,
      },
      body: JSON.stringify(finalBody),
    });

    const respText = await res.text();
    let data: any = null;
    try { data = JSON.parse(respText); } catch { data = { raw: respText }; }

    if (!res.ok) {
      const errMsg = data?.error || data?.message || `UAZAPI HTTP ${res.status}`;
      console.error(`❌ UAZAPI special failed [${kind}] HTTP ${res.status}:`, respText.slice(0, 400));
      return json({ success: false, error: errMsg, status: res.status, data }, res.status);
    }

    return json({ success: true, kind, data });
  } catch (err: any) {
    console.error("send-uazapi-special error:", err);
    return json({ success: false, error: err?.message || "Unknown error" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}