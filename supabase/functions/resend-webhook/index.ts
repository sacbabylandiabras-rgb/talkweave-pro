import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function verifySvix(secret: string, id: string, ts: string, body: string, sigHeader: string): Promise<boolean> {
  try {
    const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const toSign = encoder.encode(`${id}.${ts}.${body}`);
    const sig = await crypto.subtle.sign("HMAC", key, toSign);
    const expected = bytesToBase64(new Uint8Array(sig));
    return sigHeader.split(" ").some((s) => {
      const [, v] = s.split(",");
      return v === expected;
    });
  } catch (e) {
    console.error("Svix verify error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.text();
    const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");

    if (secret) {
      const id = req.headers.get("svix-id") || "";
      const ts = req.headers.get("svix-timestamp") || "";
      const sig = req.headers.get("svix-signature") || "";
      if (!id || !ts || !sig) {
        return new Response(JSON.stringify({ error: "Missing signature headers" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ok = await verifySvix(secret, id, ts, body, sig);
      if (!ok) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = JSON.parse(body || "{}");
    const type = String(payload?.type || "");
    const data = payload?.data || {};
    const emailId = data?.email_id || data?.id || null;
    const to = Array.isArray(data?.to) ? data.to[0] : data?.to || null;
    const from = data?.from || null;
    const subject = data?.subject || null;

    console.log(`[resend-webhook] ${type} email_id=${emailId} to=${to}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: mapping } = await supabase
      .from("sent_emails_mapping")
      .select("user_id")
      .eq("email_id", emailId)
      .maybeSingle();

    await supabase.from("resend_webhook_events").insert({
      user_id: mapping?.user_id || null,
      event_type: type,
      email_id: emailId,
      recipient: to,
      sender: from,
      subject,
      raw_payload: payload,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resend-webhook error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});