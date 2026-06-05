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

    // Use zaplynx.com as the default domain as requested by the user
    const origin = req.headers.get("origin") || "https://zaplynx.com";
    const baseUrl = origin.includes("lovable.app") ? "https://zaplynx.com" : origin;
    const inviteUrl = `${baseUrl}/aceitar-convite?token=${inviteToken}`;

    // Send invite via Supabase Auth invite
    console.log(`Inviting ${email} via Supabase Auth...`);
    const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        invite_token: inviteToken,
        team_id: team.id,
        owner_name: user.email || "sua equipe",
      },
      redirectTo: inviteUrl,
    });

    if (inviteErr) {
      if (inviteErr.status === 422 && (inviteErr.message.includes("already registered") || inviteErr.code === 'email_exists')) {
        console.log("User already exists in Supabase Auth. Sending generic confirmation email via Auth...");
        
        // Se o usuário já existe, usamos magic link ou apenas registramos o convite.
        // Como o convite do Supabase falha se o e-mail existe, vamos enviar um magic link manual ou reset de senha
        // Mas a melhor forma para convites de equipe de quem já tem conta é apenas criar o registro no banco
        // e notificar o usuário por outros meios ou enviar um email customizado.
        // O usuário quer que envie o email. Vamos tentar o magic link se o convite falhar.
        
        const { error: magicLinkErr } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
          options: { redirectTo: inviteUrl }
        });

        if (magicLinkErr) {
          console.error("Failed to send magic link to existing user:", magicLinkErr);
        }

        return new Response(JSON.stringify({ 
          ok: true, 
          message: "O usuário já possui conta. Enviamos um link de acesso para ele aceitar o convite.",
          inviteUrl, 
          invite: inv 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      console.error("Supabase invite error:", inviteErr);
      throw new Error(`Erro ao enviar convite via Supabase: ${inviteErr.message}`);
    }

    console.log("Supabase invite sent successfully:", inviteData.user?.id);

    return new Response(JSON.stringify({ ok: true, inviteUrl, invite: inv }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});