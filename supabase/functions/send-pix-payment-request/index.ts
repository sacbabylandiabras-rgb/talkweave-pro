import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CARTWAVE_PROXY_BASE = "http://187.77.249.247:3480";
const CARTWAVE_AUTH_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/auth-token/`;
const CARTWAVE_PIX_URL = `${CARTWAVE_PROXY_BASE}/v2/finance/create-pix-copy-and-paste/`;

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function resolveAcquirer(admin: any, userId: string): Promise<string> {
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("pix_acquirer")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.pix_acquirer) return profile.pix_acquirer;

    const { data: cfg } = await admin
      .from("gateway_platform_config")
      .select("value")
      .eq("key", "active_acquirer")
      .maybeSingle();
    if (cfg?.value) return cfg.value;
  } catch (_) {}
  return "openpix";
}

async function createOpenPixCharge(amountCents: number, description: string, customerPhone: string) {
  const token = Deno.env.get("OPENPIX_APP_ID");
  if (!token) return { ok: false, error: "Woovi/OpenPix não configurada" };

  const correlationID = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch("https://api.openpix.com.br/api/v1/charge", {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({
      correlationID,
      value: amountCents,
      comment: description.slice(0, 140) || "Solicitação de pagamento",
      customer: { name: "Cliente WhatsApp", phone: customerPhone },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || `OpenPix HTTP ${res.status}`, details: data };

  const charge = data.charge || data;
  return {
    ok: true,
    provider: "openpix",
    externalId: correlationID,
    brCode: charge.brCode || charge.pixKey || "",
    qrCodeImage: charge.qrCodeImage || "",
    chargeId: charge.id || correlationID,
  };
}

async function createHubPagueCharge(amountCents: number, description: string, customerPhone: string) {
  const token = Deno.env.get("HUBPAGUE_TOKEN");
  if (!token) return { ok: false, error: "HubPague não configurada" };

  const externalId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch("https://app.hubpague.io/api/payments", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amountCents,
      method: "pix",
      external_id: externalId,
      customer: {
        name: "Cliente WhatsApp",
        email: "cliente@email.com",
        phone: customerPhone || "00000000000",
        document: { type: "CPF", value: "12345678909" },
      },
      products: [{
        name: (description || "Solicitação de pagamento").slice(0, 60),
        price: amountCents,
        quantity: "1",
        type: "digital",
      }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data?.message || data?.error || JSON.stringify(data?.errors || data).slice(0, 300) || `HubPague HTTP ${res.status}`;
    return { ok: false, error: errMsg, details: data };
  }

  return {
    ok: true,
    provider: "hubpague",
    externalId,
    brCode: data?.pix?.copypaste || "",
    qrCodeImage: data?.pix?.qrcode || "",
    chargeId: data?.id || externalId,
  };
}

async function createCartWaveCharge(admin: any, amountCents: number, description: string) {
  const clientId = Deno.env.get("CARTWAVE_CLIENT_ID");
  const clientSecret = Deno.env.get("CARTWAVE_CLIENT_SECRET");
  const hmacSecret = Deno.env.get("CARTWAVE_HMAC_KEY");
  if (!clientId || !clientSecret || !hmacSecret) {
    return { ok: false, error: "CartWave não configurada" };
  }

  // Auth
  const authRes = await fetch(CARTWAVE_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const authData = await authRes.json().catch(() => ({}));
  const accessToken = authData?.access || authData?.access_token || authData?.token;
  if (!authRes.ok || !accessToken) {
    return { ok: false, error: "Falha ao autenticar na CartWave", details: authData };
  }

  let branch = "0001";
  let account = "7003299";
  try {
    const { data: branchCfg } = await admin.from("gateway_platform_config").select("value").eq("key", "cartwave_branch").maybeSingle();
    if (branchCfg?.value) branch = branchCfg.value;
    const { data: accountCfg } = await admin.from("gateway_platform_config").select("value").eq("key", "cartwave_account").maybeSingle();
    if (accountCfg?.value) account = accountCfg.value;
  } catch (_) {}

  const externalId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const body = {
    amount: parseFloat((amountCents / 100).toFixed(2)),
    debtor_name: "Cliente WhatsApp",
    debtor_document: "12345678909",
    type_document: "CPF",
    type_fine: "NONE",
    fine: 0,
    source_account_branch_identifier: branch,
    source_account_number: account,
    base_64_image: true,
  };
  const bodyString = JSON.stringify(body);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacSecret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyString));
  const hmacHex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const res = await fetch(CARTWAVE_PIX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      hmac: hmacHex,
    },
    body: bodyString,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.worked === false) {
    return { ok: false, error: "Falha ao criar PIX na CartWave", details: data };
  }

  return {
    ok: true,
    provider: "cartwave",
    externalId,
    brCode: data?.pix_copy_and_paste || "",
    qrCodeImage: data?.base_64_image_url || "",
    chargeId: data?.qr_code_id || data?.tx_id || externalId,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json({ success: false, error: "Missing Authorization" }, 401);

    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone || "").replace(/\D/g, "");
    const amountReais = parseFloat(String(body?.amount || "").replace(",", "."));
    const description = String(body?.description || "").trim();
    const notes = String(body?.notes || "").trim();
    const instanceId = body?.instanceId ? String(body.instanceId) : null;

    if (!phone || phone.length < 10) return json({ success: false, error: "Número inválido" }, 400);
    if (!amountReais || amountReais <= 0) return json({ success: false, error: "Valor inválido" }, 400);

    const amountCents = Math.round(amountReais * 100);
    const acquirer = await resolveAcquirer(admin, user.id);
    console.log(`💳 Creating PIX charge via "${acquirer}" for user ${user.id} → R$ ${amountReais} → ${phone}`);

    let charge: any;
    if (acquirer === "cartwave") {
      charge = await createCartWaveCharge(admin, amountCents, description);
    } else if (acquirer === "hubpague") {
      charge = await createHubPagueCharge(amountCents, description, phone);
    } else {
      charge = await createOpenPixCharge(amountCents, description, phone);
    }

    if (!charge.ok) {
      return json({ success: false, error: charge.error, acquirer, details: charge.details }, 502);
    }
    if (!charge.brCode) {
      return json({ success: false, error: "Provedor não retornou código PIX", acquirer, details: charge }, 502);
    }

    // Persist transaction (no checkout linked)
    try {
      await admin.from("gateway_transactions").insert({
        user_id: user.id,
        amount: amountCents,
        fee: 0,
        net: amountCents,
        payment_method: "pix",
        status: "pending",
        external_id: charge.externalId,
        customer_phone: phone,
        customer_name: "Cliente WhatsApp",
        metadata: {
          provider: charge.provider,
          source: "uazapi-payment-request",
          description: description || null,
          notes: notes || null,
          brCode: charge.brCode,
          chargeId: charge.chargeId,
        },
      });
    } catch (e) {
      console.error("Failed to persist transaction:", e);
    }

    // Resolve UAZAPI instance to send the message
    let inst: any = null;
    if (instanceId) {
      const { data } = await admin
        .from("zapi_instances")
        .select("id, evolution_api_url, evolution_api_key, api_provider, instance_name")
        .eq("user_id", user.id)
        .eq("id", instanceId)
        .maybeSingle();
      inst = data;
    } else {
      const { data } = await admin
        .from("zapi_instances")
        .select("id, evolution_api_url, evolution_api_key, api_provider, instance_name, is_default, created_at")
        .eq("user_id", user.id)
        .ilike("api_provider", "uazapi")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      inst = data;
    }

    if (!inst || String(inst.api_provider || "").toLowerCase() !== "uazapi") {
      return json({
        success: false,
        error: "Cobrança gerada, mas nenhuma instância UAZAPI conectada para envio.",
        charge,
      }, 400);
    }

    const apiUrl = String(inst.evolution_api_url || "").replace(/\/+$/, "");
    const apiToken = String(inst.evolution_api_key || "");
    if (!apiUrl || !apiToken) {
      return json({ success: false, error: "Instância UAZAPI sem URL/token configurados.", charge }, 500);
    }

    // Build the WhatsApp message with brCode
    const lines: string[] = [];
    lines.push(`💰 *Solicitação de pagamento*`);
    if (description) lines.push(`📝 ${description}`);
    lines.push(`💵 Valor: *${formatBRL(amountCents)}*`);
    lines.push("");
    lines.push("Pague pelo PIX copia e cola abaixo:");
    lines.push("");
    lines.push(charge.brCode);
    if (notes) {
      lines.push("");
      lines.push(notes);
    }
    const messageText = lines.join("\n");

    const sendRes = await fetch(`${apiUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: apiToken },
      body: JSON.stringify({ number: phone, text: messageText }),
    });
    const sendText = await sendRes.text();
    let sendData: any = null;
    try { sendData = JSON.parse(sendText); } catch { sendData = { raw: sendText }; }
    console.log(`📤 UAZAPI send/text → HTTP ${sendRes.status}`, sendText.slice(0, 300));

    if (!sendRes.ok) {
      return json({
        success: false,
        error: sendData?.error || sendData?.message || `Falha ao enviar mensagem (HTTP ${sendRes.status})`,
        charge,
        sendStatus: sendRes.status,
        sendBody: sendData,
      }, 502);
    }

    return json({
      success: true,
      acquirer: charge.provider,
      brCode: charge.brCode,
      qrCodeImage: charge.qrCodeImage,
      externalId: charge.externalId,
      amountCents,
      messageId: sendData?.messageid || sendData?.id || sendData?.key?.id || null,
    });
  } catch (err: any) {
    console.error("send-pix-payment-request error:", err);
    return json({ success: false, error: err?.message || "Unknown error" }, 500);
  }
});