import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, serviceKey);
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const roleId = body.roleId || null;
    const allowedInstanceIds = Array.isArray(body.allowedInstanceIds) ? body.allowedInstanceIds : [];
    if (!email) return new Response(JSON.stringify({ error: "Email obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Ensure team exists
    let { data: team } = await admin.from("teams").select("*").eq("owner_id", user.id).maybeSingle();
    if (!team) {
      const ins = await admin.from("teams").insert({ owner_id: user.id, name: "Minha equipe" }).select().single();
      team = ins.data;
    }

    // Check email is not already a member of any team
    const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existingProfile) {
      const { data: existingMember } = await admin.from("pipeline_members").select("id").eq("user_id", existingProfile.id).maybeSingle();
      if (existingMember) return new Response(JSON.stringify({ error: "Este email já faz parte de uma equipe." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const inviteToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error: invErr } = await admin.from("team_invites").insert({
      team_id: team.id, email, role_id: roleId, allowed_instance_ids: allowedInstanceIds, token: inviteToken,
    }).select().single();
    if (invErr) throw invErr;

    const origin = req.headers.get("origin") || "https://app.zaplynx.com";
    const inviteUrl = `${origin}/aceitar-convite?token=${inviteToken}`;

    // Best-effort email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        const { data: ownerProfile } = await admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
        const ownerName = ownerProfile?.full_name || ownerProfile?.email || "sua equipe";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: "ZapLynx <pay@zaplynxpro.online>",
            to: [email],
            subject: `Você foi convidado para uma equipe`,
            html: `<p>Olá!</p><p><strong>${ownerName}</strong> convidou você para entrar na equipe dele(a).</p><p><a href="${inviteUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Aceitar convite</a></p><p>Ou copie este link: ${inviteUrl}</p>`,
          }),
        });
      } catch (e) { console.error("email send fail", e); }
    }

    return new Response(JSON.stringify({ ok: true, inviteUrl, invite: inv }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});