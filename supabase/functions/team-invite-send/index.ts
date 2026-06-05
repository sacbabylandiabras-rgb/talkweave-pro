import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INVITE_EMAIL_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zaplynx - Convite</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #1a1a2e;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(200, 120, 255, 0.2);
        }

        .email-header {
            background: linear-gradient(135deg, #2d1b4e 0%, #1a1a2e 100%);
            padding: 40px 30px;
            text-align: center;
            border-bottom: 1px solid rgba(200, 120, 255, 0.2);
        }

        .logo {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 30px;
        }

        .logo-icon {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #c878ff 0%, #9d4edd 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 28px;
            color: white;
            box-shadow: 0 8px 20px rgba(200, 120, 255, 0.3);
        }

        .logo-text {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 2px;
            background: linear-gradient(90deg, #ffffff 0%, #c878ff 50%, #9d4edd 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .email-content {
            padding: 40px 30px;
        }

        .greeting {
            font-size: 28px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 15px;
        }

        .subtitle {
            font-size: 16px;
            color: #b0b0b0;
            margin-bottom: 30px;
            line-height: 1.6;
        }

        .message-box {
            background: rgba(200, 120, 255, 0.08);
            border-left: 4px solid #c878ff;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }

        .message-box p {
            color: #e0e0e0;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 10px;
        }

        .message-box a {
            color: #c878ff;
            text-decoration: none;
            font-weight: 600;
        }

        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #c878ff 0%, #9d4edd 100%);
            color: white !important;
            padding: 14px 40px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 8px 20px rgba(200, 120, 255, 0.3);
            border: none;
        }

        .email-footer {
            background: rgba(0, 0, 0, 0.3);
            padding: 25px 30px;
            border-top: 1px solid rgba(200, 120, 255, 0.1);
            text-align: center;
        }

        .footer-text {
            font-size: 13px;
            color: #808080;
            line-height: 1.6;
            margin-bottom: 15px;
        }

        .footer-text a {
            color: #c878ff;
            text-decoration: none;
        }

        .social-icons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 15px;
        }

        .social-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(200, 120, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #c878ff;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <div class="logo-icon">⚡</div>
                <div class="logo-text">ZAPLYNX</div>
            </div>
        </div>

        <div class="email-content">
            <h1 class="greeting">Você foi convidado!</h1>
            <p class="subtitle">
                Você foi convidado por {{OWNER_EMAIL}} para se juntar à equipe {{TEAM_NAME}} na plataforma Zaplynx.
            </p>

            <div class="message-box">
                <p>
                    Clique no botão abaixo para aceitar o convite, criar sua senha e começar a usar a plataforma Zaplynx.
                </p>
            </div>

            <a href="{{INVITE_URL}}" class="cta-button">
                ACEITAR CONVITE
            </a>
        </div>

        <div class="email-footer">
            <p class="footer-text">
                Este é um email automático da Zaplynx. Por favor, não responda diretamente a este email.<br>
                <a href="#">Política de Privacidade</a> • <a href="#">Termos de Serviço</a>
            </p>
            <p class="footer-text" style="margin-top: 15px; font-size: 12px;">
                © 2025 Zaplynx. Todos os direitos reservados.
            </p>
        </div>
    </div>
</body>
</html>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
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
      const { data: existingMember } = await admin.from("pipeline_members").select("id").eq("user_id", existingProfile.id).maybeSingle();
      if (existingMember) return new Response(JSON.stringify({ error: "Este email já faz parte de uma equipe." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const inviteToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error: invErr } = await admin.from("team_invites").insert({
      team_id: team.id, email, role_id: roleId, allowed_instance_ids: allowedInstanceIds, token: inviteToken,
    }).select().single();
    if (invErr) throw invErr;

    const origin = req.headers.get("origin") || "https://zaplynx.com.br";
    const baseUrl = origin.includes("lovable.app") ? "https://zaplynx.com.br" : origin;
    const inviteUrl = `${baseUrl}/aceitar-convite?token=${inviteToken}`;

    if (resendApiKey) {
      console.log(`Sending custom HTML invite to ${email} via Resend...`);
      const html = INVITE_EMAIL_HTML
        .replace("{{OWNER_EMAIL}}", user.email || "")
        .replace("{{TEAM_NAME}}", team.name || "Minha Equipe")
        .replace("{{INVITE_URL}}", inviteUrl);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Zaplynx <onboarding@resend.dev>",
          to: email,
          subject: "Você foi convidado para o Zaplynx!",
          html: html,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Resend error:", err);
      } else {
        console.log("Custom HTML invite sent successfully via Resend");
      }
    }

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
        console.log("User already exists. Sending magic link...");
        await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: email,
          options: { redirectTo: inviteUrl }
        });
        
        return new Response(JSON.stringify({ 
          ok: true, 
          message: "O usuário já possui conta. Um convite foi enviado.",
          inviteUrl, 
          invite: inv 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Erro ao convidar: ${inviteErr.message}`);
    }

    return new Response(JSON.stringify({ ok: true, inviteUrl, invite: inv }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});