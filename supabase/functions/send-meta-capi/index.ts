// Server-side Meta Conversions API + TikTok Events API + Google Ads conversion
// Called by payment webhooks when a transaction becomes "approved".
//
// Body: { user_id, event: "Purchase", value, currency?, customer?: { email, phone, name, doc }, event_id?, source_url? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildUserData(customer: any) {
  if (!customer) return {};
  const ud: Record<string, string[]> = {};
  if (customer.email) ud.em = [await sha256(customer.email)];
  if (customer.phone) ud.ph = [await sha256(String(customer.phone).replace(/\D/g, ""))];
  if (customer.name) {
    const parts = String(customer.name).trim().split(/\s+/);
    ud.fn = [await sha256(parts[0] || "")];
    if (parts.length > 1) ud.ln = [await sha256(parts.slice(1).join(" "))];
  }
  if (customer.doc) ud.external_id = [await sha256(String(customer.doc).replace(/\D/g, ""))];
  return ud;
}

async function sendMetaCapi(pixel: any, payload: {
  event: string;
  value: number;
  currency: string;
  customer: any;
  event_id?: string;
  source_url?: string;
}) {
  const pixelId = pixel.pixel_id;
  const token = pixel.api_token;
  if (!pixelId || !token) return { skipped: "missing_credentials" };

  const userData = await buildUserData(payload.customer);
  const testEventCode = (pixel.extra_config || {}).test_event_code;

  const body: any = {
    data: [{
      event_name: payload.event,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: payload.source_url || undefined,
      event_id: payload.event_id || undefined,
      user_data: userData,
      custom_data: {
        currency: payload.currency,
        value: payload.value,
      },
    }],
  };
  if (testEventCode) body.test_event_code = testEventCode;

  const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, response: text };
}

async function sendTikTokCapi(pixel: any, payload: any) {
  const pixelId = pixel.pixel_id;
  const token = pixel.api_token;
  if (!pixelId || !token) return { skipped: "missing_credentials" };

  const userData = await buildUserData(payload.customer);
  const ttEventMap: Record<string, string> = {
    Purchase: "CompletePayment",
    InitiateCheckout: "InitiateCheckout",
    Lead: "SubmitForm",
  };

  const body = {
    event_source: "web",
    event_source_id: pixelId,
    data: [{
      event: ttEventMap[payload.event] || payload.event,
      event_time: Math.floor(Date.now() / 1000),
      event_id: payload.event_id,
      user: {
        email: userData.em?.[0],
        phone: userData.ph?.[0],
        external_id: userData.external_id?.[0],
      },
      properties: {
        currency: payload.currency,
        value: payload.value,
      },
    }],
  };

  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": token },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, response: text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, event, value, currency, customer, event_id, source_url } = await req.json();
    if (!user_id || !event) {
      return new Response(JSON.stringify({ error: "user_id and event are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pixels } = await supabase
      .from("gateway_pixels")
      .select("*")
      .eq("user_id", user_id)
      .eq("active", true);

    if (!pixels?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_pixels" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const px of pixels) {
      const events = (px.events as string[]) || [];
      const payload = {
        event,
        value: Number(value) || 0,
        currency: currency || "BRL",
        customer,
        event_id,
        source_url,
      };

      const baseLog: any = {
        user_id,
        pixel_id: px.id,
        platform: px.platform,
        event_name: event,
        value: payload.value,
        currency: payload.currency,
        customer_email: customer?.email || null,
        customer_name: customer?.name || null,
        event_id: event_id || null,
      };

      if (events.length && !events.includes(event)) {
        await supabase.from("pixel_event_logs").insert({
          ...baseLog, status: "skipped", error_message: "Evento não habilitado",
        });
        continue;
      }

      try {
        let r: any = { skipped: "unsupported_platform" };
        if (px.platform === "meta") r = await sendMetaCapi(px, payload);
        else if (px.platform === "tiktok") r = await sendTikTokCapi(px, payload);

        const ok = r.status && r.status >= 200 && r.status < 300;
        await supabase.from("pixel_event_logs").insert({
          ...baseLog,
          status: r.skipped ? "skipped" : (ok ? "success" : "error"),
          http_status: r.status || null,
          response_body: typeof r.response === "string" ? r.response.slice(0, 2000) : (r.skipped || null),
          error_message: !ok && !r.skipped ? `HTTP ${r.status}` : null,
        });
        results.push({ platform: px.platform, ...r });
      } catch (err: any) {
        await supabase.from("pixel_event_logs").insert({
          ...baseLog, status: "error", error_message: err.message,
        });
        results.push({ platform: px.platform, error: err.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-meta-capi error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
