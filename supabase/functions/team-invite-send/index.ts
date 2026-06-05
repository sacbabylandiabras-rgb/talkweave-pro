import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INVITE_EMAIL_HTML = `
<!DOCTYPE html> <html lang="pt-BR"> <head> <meta charset="UTF-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <title>Zaplynx - Convite</title> </head> <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;"> <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;"> <!-- HEADER --> <tr> <td style="background-color: #2d1b4e; padding: 40px 30px; text-align: center; border-bottom: 2px solid #c878ff;"> <!-- Logo --> <table width="100%" cellpadding="0" cellspacing="0"> <tr> <td style="text-align: center;"> <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50' width='50' height='50'%3E%3Crect x='5' y='5' width='40' height='40' rx='10' fill='%23c878ff'/%3E%3Ctext x='25' y='35' font-size='28' font-weight='bold' fill='white' text-anchor='middle'%3E⚡%3C/text%3E%3C/svg%3E" alt="Zaplynx" style="width: 50px; height: 50px; margin-right: 12px; vertical-align: middle; display: inline-block;"> <span style="font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: 2px; vertical-align: middle; display: inline-block;">ZAPLYNX</span> </td> </tr> </table> </td> </tr> <!-- CONTENT --> <tr> <td style="background-color: #1a1a2e; padding: 40px 30px; color: #ffffff;"> <!-- Heading --> <h1 style="margin: 0 0 15px 0; font-size: 28px; font-weight: bold; color: #ffffff;"> Você foi convidado! </h1> <!-- Subtitle --> <p style="margin: 0 0 30px 0; font-size: 16px; color: #b0b0b0; line-height: 1.6;"> Você foi convidado para criar uma conta na plataforma Zaplynx. </p> <!-- Message Box --> <div style="background-color: rgba(200, 120, 255, 0.08); border-left: 4px solid #c878ff; padding: 20px; margin-bottom: 30px;"> <p style="margin: 0 0 15px 0; font-size: 15px; color: #e0e0e0; line-height: 1.6;"> Clique no link abaixo para aceitar o convite e começar a usar a plataforma Zaplynx. Acesso rápido e seguro para suas necessidades. </p> <p style="margin: 0; font-size: 15px;"> <a href="{{INVITE_URL}}" style="color: #c878ff; text-decoration: none; font-weight: bold;">Aceitar convite →</a> </p> </div> <!-- CTA Button --> <table cellpadding="0" cellspacing="0" style="margin: 30px 0;"> <tr> <td style="background-color: #c878ff; padding: 14px 40px; border-radius: 8px; text-align: center;"> <a href="{{INVITE_URL}}" style="color: white; text-decoration: none; font-weight: bold; font-size: 16px; display: block;"> ACEITAR CONVITE </a> </td> </tr> </table> </td> </tr> <!-- FOOTER --> <tr> <td style="background-color: #0a0a14; padding: 25px 30px; border-top: 1px solid rgba(200, 120, 255, 0.2); text-align: center;"> <!-- Footer Text --> <p style="margin: 0 0 10px 0; font-size: 13px; color: #808080; line-height: 1.6;"> Este é um email automático da Zaplynx. Por favor, não responda diretamente a este email.<br> <a href="#" style="color: #c878ff; text-decoration: none;">Política de Privacidade</a> • <a href="#" style="color: #c878ff; text-decoration: none;">Termos de Serviço</a> </p> <!-- Social Icons --> <table cellpadding="0" cellspacing="0" style="margin: 15px auto; text-align: center;"> <tr> <td style="padding: 0 8px;"> <a href="#" style="display: inline-block; width: 32px; height: 32px; background-color: rgba(200, 120, 255, 0.1); border-radius: 50%; text-align: center; line-height: 32px; color: #c878ff; text-decoration: none; font-weight: bold;">f</a> </td> <td style="padding: 0 8px;"> <a href="#" style="display: inline-block; width: 32px; height: 32px; background-color: rgba(200, 120, 255, 0.1); border-radius: 50%; text-align: center; line-height: 32px; color: #c878ff; text-decoration: none; font-weight: bold;">𝕏</a> </td> <td style="padding: 0 8px;"> <a href="#" style="display: inline-block; width: 32px; height: 32px; background-color: rgba(200, 120, 255, 0.1); border-radius: 50%; text-align: center; line-height: 32px; color: #c878ff; text-decoration: none; font-weight: bold;">📷</a> </td> <td style="padding: 0 8px;"> <a href="#" style="display: inline-block; width: 32px; height: 32px; background-color: rgba(200, 120, 255, 0.1); border-radius: 50%; text-align: center; line-height: 32px; color: #c878ff; text-decoration: none; font-weight: bold;">in</a> </td> </tr> </table> <!-- Copyright --> <p style="margin: 15px 0 0 0; font-size: 12px; color: #606060;"> © 2025 Zaplynx. Todos os direitos reservados. </p> </td> </tr> </table> </body> </html>
`;

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

    let { data: team } = await admin.from("teams").select("*").eq("owner_id", user.id).maybeSingle();
    if (!team) {
      const ins = await admin.from("teams").insert({ owner_id: user.id, name: "Minha equipe" }).select().single();
      team = ins.data;
    }

    const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existingProfile) {
      const { data: existingMember } = await admin.from("pipeline_members").select("user_id").eq("user_id", existingProfile.id).maybeSingle();
      if (existingMember) return new Response(JSON.stringify({ error: "Este email já faz parte de uma equipe." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const inviteToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error: invErr } = await admin.from("team_invites").insert({
      team_id: team.id, email, role_id: roleId, allowed_instance_ids: allowedInstanceIds, token: inviteToken,
    }).select().single();
    if (invErr) throw invErr;

    const baseUrl = "https://zaplynx.com";
    const inviteUrl = `${baseUrl}/aceitar-convite?token=${inviteToken}`;

    const html = INVITE_EMAIL_HTML
      .replace("{{OWNER_EMAIL}}", user.email || "sua equipe")
      .replace("{{TEAM_NAME}}", team.name || "Zaplynx")
      .replace(/{{INVITE_URL}}/g, inviteUrl);

    // Usar Supabase Auth para convidar o usuário, o que envia o e-mail via SMTP configurado no Supabase
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        team_id: team.id,
        invite_token: inviteToken,
      },
    });

    if (inviteError) {
      console.error("Supabase invite error:", inviteError);

      if (inviteError.code !== "email_exists") {
        throw inviteError;
      }

      // Usuário já cadastrado: o Supabase não permite reenviar invite padrão.
      // Enviamos um magic link pelo próprio Supabase.
      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey);
      const { error: magicLinkError } = await authClient.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (magicLinkError) {
        console.error("Supabase magic link error:", magicLinkError);
        throw magicLinkError;
      }
    }

    return new Response(JSON.stringify({ ok: true, inviteUrl, invite: inv }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});