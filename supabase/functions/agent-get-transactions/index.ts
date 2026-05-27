import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function digits(v?: string) {
  return (v || "").replace(/\D+/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // Authenticate caller
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !user) return json(401, { error: "unauthorized" });

    const body = await req.json().catch(() => ({}));
    const phone = digits(body.phone);
    const email = (body.email || "").trim().toLowerCase();
    const document = digits(body.document);
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100);
    const transactionId = body.transaction_id || body.external_id || null;

    if (!phone && !email && !document && !transactionId) {
      return json(400, { error: "missing_filter", message: "Informe phone, email, document ou transaction_id." });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Lookup by specific transaction id
    if (transactionId) {
      const { data } = await admin
        .from("gateway_transactions")
        .select("*")
        .eq("user_id", user.id)
        .or(`id.eq.${transactionId},external_id.eq.${transactionId}`)
        .limit(1)
        .maybeSingle();
      return json(200, { source: data ? "internal" : "none", transactions: data ? [data] : [] });
    }

    // 2) Internal gateway lookup
    let q = admin
      .from("gateway_transactions")
      .select("id,external_id,amount,fee,net,status,payment_method,customer_name,customer_email,customer_phone,product_id,metadata,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    const ors: string[] = [];
    if (phone) ors.push(`customer_phone.ilike.%${phone}%`);
    if (email) ors.push(`customer_email.eq.${email}`);
    if (ors.length) q = q.or(ors.join(","));

    const { data: internal, error: intErr } = await q;
    if (intErr) console.error("internal err", intErr);

    if (internal && internal.length > 0) {
      return json(200, { source: "internal", count: internal.length, transactions: internal });
    }

    // 3) Fallback: external integration webhook logs
    let lq = admin
      .from("gateway_webhook_logs")
      .select("id,event_type,phone,payload,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (phone) lq = lq.ilike("phone", `%${phone}%`);

    const { data: external } = await lq;

    // If email/document filter, sift payload jsonb manually
    const sifted = (external || []).filter((row: any) => {
      if (!email && !document) return true;
      const p = row.payload || {};
      const blob = JSON.stringify(p).toLowerCase();
      if (email && blob.includes(email)) return true;
      if (document && blob.includes(document)) return true;
      return false;
    });

    return json(200, {
      source: sifted.length ? "external" : "none",
      count: sifted.length,
      transactions: sifted.map((row: any) => ({
        id: row.id,
        external_id: row.payload?.id || row.payload?.transaction_id || null,
        status: row.payload?.status || row.event_type,
        amount: row.payload?.amount || row.payload?.value || null,
        payment_method: row.payload?.payment_method || row.payload?.method || null,
        customer_name: row.payload?.customer?.name || row.payload?.customer_name || null,
        customer_email: row.payload?.customer?.email || row.payload?.customer_email || null,
        customer_phone: row.phone,
        created_at: row.created_at,
        raw: row.payload,
      })),
    });
  } catch (e: any) {
    console.error("agent-get-transactions error", e);
    return json(500, { error: "internal_error", message: e?.message || String(e) });
  }
});