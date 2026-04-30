import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, error: "Sessão ausente" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ success: false, error: "Sessão inválida" }, 401);

    const body = await req.json().catch(() => ({}));
    const active = body?.active === true;
    const runId = typeof body?.runId === "string" && body.runId.trim() ? body.runId.trim() : crypto.randomUUID();
    const instanceIds = Array.isArray(body?.instanceIds)
      ? body.instanceIds.map((id: unknown) => String(id || "").trim()).filter(Boolean).slice(0, 200)
      : [];
    const minDelay = Math.max(2, Math.min(3600, Number(body?.minDelay) || 30));
    const maxDelay = Math.max(minDelay, Math.min(7200, Number(body?.maxDelay) || 120));
    const dailyLimit = Math.max(1, Math.min(800, Number(body?.dailyLimit) || 50));

    if (active && instanceIds.length === 0) {
      return json({ success: false, error: "Selecione pelo menos 1 instância" }, 400);
    }

    const { error } = await admin.from("warmup_user_controls").upsert(
      {
        user_id: user.id,
        active,
        run_id: active ? runId : runId,
        instance_ids: instanceIds,
        min_delay: minDelay,
        max_delay: maxDelay,
        daily_limit: dailyLimit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("warmup-control upsert error:", error.message);
      return json({ success: false, error: "Não consegui salvar o controle de pausa" }, 500);
    }

    return json({ success: true, active, runId });
  } catch (e: any) {
    console.error("warmup-control error:", e?.message || e);
    return json({ success: false, error: e?.message || "Erro interno" }, 500);
  }
});