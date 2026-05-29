import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

const pickStr = (...vals: unknown[]) => {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
};

const getQr = (p: any) => pickStr(
  p?.qrCode, p?.qrcode, p?.qr, p?.value,
  p?.data?.qrCode, p?.data?.qrcode, p?.data?.qr, p?.data?.value,
  p?.instance?.qrCode, p?.instance?.qrcode, p?.instance?.qr,
);

const getCode = (p: any) => pickStr(
  p?.pairingCode, p?.paircode, p?.pairCode, p?.code,
  p?.data?.pairingCode, p?.data?.paircode, p?.data?.pairCode, p?.data?.code,
  p?.instance?.pairingCode, p?.instance?.paircode, p?.instance?.pairCode, p?.instance?.code,
);

const parseBody = async (r: Response) => {
  const t = await r.text();
  if (!t) return {};
  try { return JSON.parse(t); } catch { return { message: t }; }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("No authorization header");

    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { hiddenInstanceId, mode, phoneNumber } = body || {};
    if (!hiddenInstanceId) {
      return new Response(JSON.stringify({ error: "hiddenInstanceId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (mode === "pairing" && !phoneNumber) {
      return new Response(JSON.stringify({ error: "phoneNumber required for pairing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: inst, error: instErr } = await admin
      .from("hidden_dispatch_instances")
      .select("*")
      .eq("id", hiddenInstanceId)
      .single();
    if (instErr || !inst) throw new Error("Instance not found");

    // ==== Z-API ====
    const zid = (inst as any).zapi_instance_id;
    const ztk = (inst as any).zapi_token;
    const zct = (inst as any).zapi_client_token;
    if (!zid || !ztk || !zct) {
      return new Response(JSON.stringify({ error: "Z-API credentials missing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "pairing") {
      const url = `https://api.z-api.io/instances/${zid}/token/${ztk}/phone-code/${phoneNumber}`;
      const r = await fetch(url, { headers: { "Content-Type": "application/json", "Client-Token": zct } });
      const d: any = await parseBody(r);
      if (!r.ok || !d?.code) {
        return new Response(JSON.stringify({ error: d?.error || "Falha", details: d }),
          { status: r.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, data: { pairingCode: d.code } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // QR
    const url = `https://api.z-api.io/instances/${zid}/token/${ztk}/qr-code/image`;
    const r = await fetch(url, { headers: { "Content-Type": "application/json", "Client-Token": zct } });
    const d: any = await parseBody(r);
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "Falha ao obter QR", details: d }),
        { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const qr = getQr(d) || d?.value || null;
    return new Response(JSON.stringify({ success: true, data: { qrCode: qr, connected: d?.connected === true } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});