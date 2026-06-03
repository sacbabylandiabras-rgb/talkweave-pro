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
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body.action || "lookup";
    const token = String(body.token || "");
    if (!token) return new Response(JSON.stringify({ error: "Token obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: inv } = await admin.from("team_invites").select("*, team:teams(name, owner_id)").eq("token", token).maybeSingle();
    if (!inv) return new Response(JSON.stringify({ error: "Convite não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (inv.accepted_at) return new Response(JSON.stringify({ error: "Convite já utilizado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (new Date(inv.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({ error: "Convite expirado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (action === "lookup") {
      return new Response(JSON.stringify({ invite: { email: inv.email, team_name: inv.team?.name, role_id: inv.role_id } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // accept: requires logged-in user with matching email
    const authHeader = req.headers.get("Authorization") || "";
    const userToken = authHeader.replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(userToken);
    if (!user) return new Response(JSON.stringify({ error: "Faça login primeiro" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if ((user.email || "").toLowerCase() !== inv.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Este convite foi para outro email" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Owner cannot accept own invite, and user cannot already be member of another team
    if (user.id === inv.team.owner_id) {
      return new Response(JSON.stringify({ error: "Você é dono desta equipe" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: existing } = await admin.from("pipeline_members").select("id").eq("user_id", user.id).maybeSingle();
    if (existing) return new Response(JSON.stringify({ error: "Você já está em uma equipe" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { error: insErr } = await admin.from("pipeline_members").insert({
      team_id: inv.team_id,
      user_id: user.id,
      role_id: inv.role_id,
      allowed_instance_ids: inv.allowed_instance_ids || [],
      status: "active",
      invited_email: inv.email,
    });
    if (insErr) throw insErr;
    await admin.from("team_invites").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});