import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const ALLOWED_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "ash", "coral", "sage", "verse"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: jsonHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: jsonHeaders });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").trim();
    const voice = ALLOWED_VOICES.includes(body.voice) ? body.voice : "alloy";
    const speed = Math.min(4, Math.max(0.25, Number(body.speed) || 1));
    const instructions = typeof body.instructions === "string" ? body.instructions.slice(0, 500) : "";
    const preview = Boolean(body.preview);
    const audioName = String(body.audioName || "").trim() || `audio-${Date.now()}`;

    if (!text) {
      return new Response(JSON.stringify({ error: "Texto é obrigatório" }), { status: 400, headers: jsonHeaders });
    }
    if (text.length > 4000) {
      return new Response(JSON.stringify({ error: "Texto muito longo (máx. 4000 caracteres)" }), { status: 400, headers: jsonHeaders });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Serviço de voz não configurado" }), { status: 500, headers: jsonHeaders });
    }

    // Use gpt-4o-mini-tts so we can pass `instructions` for tom/estilo de narração.
    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice,
        input: text,
        speed,
        response_format: "mp3",
        ...(instructions ? { instructions } : {}),
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => "");
      console.error("TTS upstream error", ttsRes.status, errText);
      const safe = errText.replace(/openai/gi, "geração de voz");
      return new Response(
        JSON.stringify({ error: `Falha ao gerar áudio (${ttsRes.status})`, details: safe.slice(0, 400) }),
        { status: 502, headers: jsonHeaders }
      );
    }

    const audioBuf = new Uint8Array(await ttsRes.arrayBuffer());

    if (preview) {
      // Return base64 inline so client can play without writing to storage
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < audioBuf.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(audioBuf.subarray(i, i + chunk)));
      }
      const b64 = btoa(bin);
      return new Response(JSON.stringify({ audioBase64: b64, mimeType: "audio/mpeg" }), { headers: jsonHeaders });
    }

    // Persist to flow-media bucket
    const adminClient = createClient(supabaseUrl, supabaseService);
    const safeName = audioName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
    const path = `${userId}/tts/${Date.now()}-${safeName}.mp3`;

    const { error: uploadError } = await adminClient.storage
      .from("flow-media")
      .upload(path, audioBuf, { contentType: "audio/mpeg", cacheControl: "3600", upsert: false });

    if (uploadError) {
      console.error("Storage upload error", uploadError);
      return new Response(JSON.stringify({ error: "Falha ao salvar áudio gerado" }), { status: 500, headers: jsonHeaders });
    }

    const { data: pub } = adminClient.storage.from("flow-media").getPublicUrl(path);

    return new Response(JSON.stringify({ url: pub.publicUrl, audioName: safeName }), { headers: jsonHeaders });
  } catch (err) {
    console.error("generate-tts-audio error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});