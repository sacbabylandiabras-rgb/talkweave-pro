import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const to = Array.isArray(body?.to) ? body.to : (body?.to ? [body.to] : []);
    const subject = String(body?.subject || "").trim();
    const html = String(body?.html || "").trim();
    const fromAlias = String(body?.fromAlias || "contato").replace(/[^a-z0-9._-]/gi, "");

    if (!to.length || !subject || !html) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: to, subject, html" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: domainData } = await admin
      .from("email_domain_verifications")
      .select("domain, status")
      .eq("user_id", userId)
      .eq("status", "verified")
      .maybeSingle();

    if (!domainData?.domain) {
      return new Response(JSON.stringify({ error: "Configure e verifique seu domínio antes de enviar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email_sender_name")
      .eq("id", userId)
      .maybeSingle();

    const senderName = (profile as any)?.email_sender_name || profile?.full_name || "ZapLynx";
    const from = `${senderName} <${fromAlias}@${domainData.domain}>`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Serviço de email indisponível" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ to: string; ok: boolean; error?: string; id?: string }> = [];
    for (const recipient of to.slice(0, 200)) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: recipient, subject, html }),
      });
      const j = await r.json().catch(() => ({}));
      results.push({ to: recipient, ok: r.ok, error: r.ok ? undefined : (j?.message || j?.error || `HTTP ${r.status}`), id: j?.id });
    }

    const sent = results.filter(x => x.ok).length;
    return new Response(JSON.stringify({ ok: true, sent, total: results.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-user-email error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});