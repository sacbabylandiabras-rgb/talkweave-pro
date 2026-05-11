import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Best-effort generic detection — works with any payload shape
function pick(obj: any, keys: string[]): any {
  for (const k of keys) {
    const parts = k.split(".");
    let v: any = obj;
    for (const p of parts) {
      if (v == null) break;
      v = v[p];
    }
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function detectAmountCents(payload: any): number {
  const raw = pick(payload, [
    "amount", "value", "price", "total", "totalAmount", "valor",
    "purchase.price.value", "purchase.original_offer_price.value",
    "data.amount", "data.value", "Commissions.charge.amount",
    "transaction.amount", "order.total", "checkout.amount",
  ]);
  if (raw == null) return 0;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^\d.,-]/g, "").replace(",", "."));
  if (isNaN(num)) return 0;
  // Heuristic: if value has decimals or < 1000, probably reais → convert to cents.
  if (num < 1000 || String(raw).includes(".") || String(raw).includes(",")) {
    return Math.round(num * 100);
  }
  return Math.round(num);
}

function detectStatus(payload: any): "pending" | "approved" | "refused" | "refunded" | "expired" {
  const raw = String(
    pick(payload, [
      "status", "event", "type", "transaction_status",
      "data.status", "purchase.status", "order.status", "transaction.status",
    ]) || ""
  ).toLowerCase();

  if (/(approved|paid|completed|complete|success|aprovad|pag(o|a)|purchase_complete|purchase_approved|order_approved|sale_approved|order\.paid)/.test(raw)) return "approved";
  if (/(refund|chargeback|estornad)/.test(raw)) return "refunded";
  if (/(refus|deni|cancel|fail|recusad|cancelad|declin)/.test(raw)) return "refused";
  if (/(expir|venc)/.test(raw)) return "expired";
  return "pending";
}

function detectExternalId(payload: any): string | null {
  const v = pick(payload, [
    "id", "transaction_id", "order_id", "purchase_id", "external_id",
    "data.id", "transaction.id", "purchase.transaction", "order.id",
    "checkout.id", "code",
  ]);
  return v ? String(v) : null;
}

function detectSource(payload: any, ua: string): string {
  const raw = String(
    pick(payload, ["platform", "source", "gateway", "provider"]) || ""
  ).toLowerCase();
  if (raw) return raw;
  const u = ua.toLowerCase();
  if (u.includes("hotmart")) return "hotmart";
  if (u.includes("kiwify")) return "kiwify";
  if (u.includes("cakto")) return "cakto";
  if (u.includes("eduzz")) return "eduzz";
  if (u.includes("monetizze")) return "monetizze";
  return "external";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Token via path (?token=xxx) or last path segment
    const token = url.searchParams.get("token") || url.pathname.split("/").filter(Boolean).pop() || "";

    if (!token || token === "external-gateway-webhook") {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenRow, error: tErr } = await supabase
      .from("external_gateway_tokens")
      .select("user_id")
      .eq("token", token)
      .maybeSingle();

    if (tErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: any = {};
    try {
      const text = await req.text();
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }

    const userId = tokenRow.user_id;
    const externalId = detectExternalId(payload);
    const status = detectStatus(payload);
    const amount = detectAmountCents(payload);
    const source = detectSource(payload, req.headers.get("user-agent") || "");

    const customerName = pick(payload, ["customer.name", "buyer.name", "client.name", "name", "customer_name"]) || null;
    const customerEmail = pick(payload, ["customer.email", "buyer.email", "client.email", "email", "customer_email"]) || null;
    const customerPhone = pick(payload, ["customer.phone", "buyer.phone", "client.phone", "phone", "customer_phone"]) || null;

    // Upsert by external_id when available; otherwise insert new
    if (externalId) {
      const { data: existing } = await supabase
        .from("external_gateway_events")
        .select("id")
        .eq("user_id", userId)
        .eq("external_id", externalId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("external_gateway_events")
          .update({
            status, amount,
            customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone,
            raw_payload: payload, updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("external_gateway_events").insert({
          user_id: userId, external_id: externalId, status, amount, source,
          customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone,
          raw_payload: payload,
        });
      }
    } else {
      await supabase.from("external_gateway_events").insert({
        user_id: userId, status, amount, source,
        customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone,
        raw_payload: payload,
      });
    }

    return new Response(JSON.stringify({ ok: true, status, amount }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("external-gateway-webhook error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});