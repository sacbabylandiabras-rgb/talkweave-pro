import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Gera uma cobrança PIX em nome do USUÁRIO logado (não de um checkout específico)
 * para uso pelos blocos PIX / Solicitar Pagamento do Fluxo Visual.
 * Retorna { brCode, qrCodeImage, externalId, provider, amount }.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const amount = Number(body.amount || 0); // em centavos
    const description = String(body.description || "Pagamento");
    const customerName = body.customerName || null;
    const customerEmail = body.customerEmail || null;
    const customerPhone = body.customerPhone || null;
    const customerCpf = body.customerCpf || null;

    if (!userId || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "userId e amount > 0 obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("pix_acquirer")
      .eq("id", userId)
      .maybeSingle();

    const acquirer = String(profile?.pix_acquirer || "openpix").toLowerCase();
    const externalId = `flow_${userId.slice(0, 8)}_${Date.now()}`;

    let brCode = "";
    let qrCodeImage = "";

    if (acquirer === "hubpague") {
      const token = Deno.env.get("HUBPAGUE_TOKEN");
      if (!token) throw new Error("HubPague não configurado");
      const r = await fetch("https://app.hubpague.io/api/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: "pix",
          external_id: externalId,
          customer: {
            name: customerName || "Cliente",
            email: customerEmail || "cliente@email.com",
            phone: customerPhone || "00000000000",
            document: { type: "CPF", value: (customerCpf || "00000000000").replace(/\D/g, "") },
          },
          products: [{ name: description, price: amount, quantity: "1", type: "digital" }],
        }),
      });
      const d = await r.json();
      brCode = d?.pix?.copypaste || "";
      qrCodeImage = d?.pix?.qrcode || "";
    } else if (acquirer === "cartwave") {
      const clientId = Deno.env.get("CARTWAVE_CLIENT_ID");
      const clientSecret = Deno.env.get("CARTWAVE_CLIENT_SECRET");
      if (!clientId || !clientSecret) throw new Error("CartWave não configurado");

      // Auth Step
      const authRes = await fetch("https://api.cartwavehub.com.br/v2/finance/auth-token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
      });
      const authData = await authRes.json();
      const token = authData?.access_token;
      if (!token) throw new Error("Falha na autenticação CartWave");

      // Charge Step
      const r = await fetch("https://api.cartwavehub.com.br/v2/finance/create-pix-copy-and-paste/", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat((amount / 100).toFixed(2)),
          type_fine: "NONE",
          fine: 0,
          debtor_name: customerName || "Cliente",
          debtor_document: (customerCpf || "00000000000").replace(/\D/g, ""),
          tag: externalId,
          base_64_image: true
        }),
      });
      const d = await r.json();
      brCode = d?.copy_and_paste || d?.brcode || d?.data?.copy_and_paste || "";
      qrCodeImage = d?.qrcode_base64 || d?.data?.qrcode_base64 || "";
    } else {
      const appId = Deno.env.get("OPENPIX_APP_ID");
      if (!appId) throw new Error("OpenPix não configurado");
      const r = await fetch("https://api.openpix.com.br/api/v1/charge", {
        method: "POST",
        headers: { Authorization: appId, "Content-Type": "application/json" },
        body: JSON.stringify({
          correlationID: externalId,
          value: amount,
          comment: description,
          customer: customerName
            ? {
                name: customerName,
                email: customerEmail || undefined,
                phone: customerPhone || undefined,
                taxID: customerCpf || undefined,
              }
            : undefined,
        }),
      });
      const d = await r.json();
      const charge = d?.charge || d;
      brCode = charge?.brCode || "";
      qrCodeImage = charge?.qrCodeImage || "";
    }

    // Persiste a transação para conciliação
    await supabase.from("gateway_transactions").insert({
      user_id: userId,
      amount,
      fee: 0,
      net: amount,
      payment_method: "pix",
      status: "pending",
      external_id: externalId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      metadata: { source: "flow_visual", provider: acquirer, description, brCode },
    });

    return new Response(
      JSON.stringify({ brCode, qrCodeImage, externalId, provider: acquirer, amount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("gateway-flow-charge error:", e);
    return new Response(JSON.stringify({ error: e?.message || "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});