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
    const requestedSource = String(body.source || "flow_visual").trim().toLowerCase();
    const allowedSources = new Set(["flow_visual", "telegram", "whatsapp", "agent", "campaign"]);
    const source = allowedSources.has(requestedSource) ? requestedSource : "flow_visual";
    const telegramBotId = body.telegramBotId ? String(body.telegramBotId) : null;
    const telegramChatId = body.telegramChatId != null ? Number(body.telegramChatId) : null;
    const telegramSessionId = body.telegramSessionId ? String(body.telegramSessionId) : null;

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
      const hmacSecret = Deno.env.get("CARTWAVE_HMAC_KEY");
      
      if (!clientId || !clientSecret || !hmacSecret) {
        throw new Error("CartWave não configurado corretamente (ID, Secret ou HMAC faltando)");
      }

      const PROXY_BASE = 'http://187.77.249.247:3480';
      const AUTH_URL = `${PROXY_BASE}/v2/finance/auth-token/`;
      const PIX_URL = `${PROXY_BASE}/v2/finance/create-pix-copy-and-paste/`;

      // Step 1: Auth via Proxy
      const authRes = await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "ZapLynxPay/1.0" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
      });
      const authData = await authRes.json();
      const token = authData?.access_token || authData?.access || authData?.data?.access_token || authData?.token;
      
      if (!token) {
        console.error("❌ CartWave Auth failed:", JSON.stringify(authData));
        throw new Error("Falha na autenticação CartWave via Proxy");
      }

      // Step 2: Get branch/account config
      let branch = '0001';
      let account = '7003299';
      try {
        const { data: bCfg } = await supabase.from('gateway_platform_config').select('value').eq('key', 'cartwave_branch').maybeSingle();
        if (bCfg?.value) branch = bCfg.value;
        const { data: aCfg } = await supabase.from('gateway_platform_config').select('value').eq('key', 'cartwave_account').maybeSingle();
        if (aCfg?.value) account = aCfg.value;
      } catch (e) {
        console.warn("⚠️ Usando branch/account padrão para CartWave");
      }

      // Step 3: Prepare Body and HMAC
      const cartwaveBody = {
        amount: parseFloat((amount / 100).toFixed(2)),
        debtor_name: (customerName || 'Cliente').substring(0, 25),
        debtor_document: (customerCpf || "00000000000").replace(/\D/g, ""),
        type_document: (customerCpf || "").replace(/\D/g, "").length === 14 ? 'CNPJ' : 'CPF',
        type_fine: 'NONE',
        fine: 0,
        source_account_branch_identifier: branch,
        source_account_number: account,
        base_64_image: true,
        tag: externalId
      };

      const bodyString = JSON.stringify(cartwaveBody);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(hmacSecret),
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyString));
      const hmacHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

      // Step 4: Create Charge via Proxy
      const r = await fetch(PIX_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "accept": "application/json",
          "User-Agent": "ZapLynxPay/1.0",
          "Authorization": `Bearer ${token}`,
          "hmac": hmacHex
        },
        body: bodyString,
      });
      
      const d = await r.json();
      brCode = d?.pix_copy_and_paste || d?.copy_and_paste || d?.brcode || d?.data?.pix_copy_and_paste || "";
      qrCodeImage = d?.base_64_image_url || d?.qrcode_base64 || d?.data?.base_64_image_url || "";
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

    const transactionMetadata = {
      source,
      channel: source,
      provider: acquirer,
      description,
      brCode,
      ...(source === "telegram"
        ? {
            telegram: {
              bot_id: telegramBotId,
              chat_id: telegramChatId,
              session_id: telegramSessionId,
            },
          }
        : {}),
    };

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
      metadata: transactionMetadata,
    });

    // Também registra a venda pendente do Telegram para relatórios/downsells.
    // Se a migração ainda não foi aplicada, não quebramos a cobrança.
    if (source === "telegram" && telegramBotId && telegramChatId) {
      const { error: pendingSaleError } = await supabase.from("telegram_pending_sales").insert({
        user_id: userId,
        bot_id: telegramBotId,
        chat_id: telegramChatId,
        plan_id: null,
        plan_name: description || "Pagamento via Telegram",
        amount,
        status: "pending",
      });
      if (pendingSaleError) {
        console.warn("telegram_pending_sales insert skipped:", pendingSaleError.message);
      }
    }

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