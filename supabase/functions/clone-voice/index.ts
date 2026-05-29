import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: jsonHeaders });
    }
    const userId = userData.user.id;

    const form = await req.formData();
    const apiKey = String(form.get("api_key") || "").trim();
    const voiceName = String(form.get("name") || "Minha Voz").trim().slice(0, 60);
    const description = String(form.get("description") || "Voz personalizada").trim().slice(0, 240);
    const audio = form.get("audio");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Token de voz premium é obrigatório" }), { status: 400, headers: jsonHeaders });
    }
    if (!(audio instanceof File) && !(audio instanceof Blob)) {
      return new Response(JSON.stringify({ error: "Arquivo de áudio é obrigatório" }), { status: 400, headers: jsonHeaders });
    }
    const audioBlob = audio as Blob;
    if (audioBlob.size > 11 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Áudio muito grande (máx 11MB)" }), { status: 400, headers: jsonHeaders });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("name", voiceName);
    upstreamForm.append("description", description);
    upstreamForm.append("files", audioBlob, (audio as File).name || "sample.mp3");

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstreamForm,
    });

    const bodyText = await res.text();
    if (!res.ok) {
      console.error("[clone-voice] upstream error", res.status, bodyText);
      let msg = "Falha ao clonar voz. Verifique o token e o áudio.";
      try {
        const p = JSON.parse(bodyText);
        const detail = p?.detail?.message || p?.detail || p?.message;
        if (typeof detail === "string") msg = detail;
      } catch { /* noop */ }
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: jsonHeaders });
    }

    let voiceId = "";
    try {
      const parsed = JSON.parse(bodyText);
      voiceId = String(parsed?.voice_id || "");
    } catch { /* noop */ }

    if (!voiceId) {
      return new Response(JSON.stringify({ error: "Resposta inválida do provedor de voz" }), { status: 502, headers: jsonHeaders });
    }

    const admin = createClient(supabaseUrl, service);
    await admin
      .from("agent_config")
      .update({
        elevenlabs_api_key: apiKey,
        elevenlabs_voice_id: voiceId,
        elevenlabs_voice_name: voiceName,
        voice_provider: "elevenlabs",
      })
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({ voice_id: voiceId, voice_name: voiceName }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("[clone-voice] error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
