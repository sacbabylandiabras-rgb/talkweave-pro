import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || "").trim();
    const conversationId = String(body?.conversation_id || "default")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60) || "default";

    if (!text) {
      return new Response(JSON.stringify({ error: "text é obrigatório" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
    if (text.length > 4000) {
      return new Response(
        JSON.stringify({ error: "text muito longo (máx 4000 chars)" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: "nova",
        response_format: "mp3",
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => "");
      console.error("[tts] upstream error", ttsRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Falha ao gerar áudio", details: errText.slice(0, 300) }),
        { status: 502, headers: jsonHeaders },
      );
    }

    const audioBuf = new Uint8Array(await ttsRes.arrayBuffer());

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const path = `audio/${conversationId}/${Date.now()}.mp3`;
    const { error: uploadError } = await admin.storage
      .from("crm-audio")
      .upload(path, audioBuf, {
        contentType: "audio/mpeg",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[tts] storage upload error", uploadError);
      return new Response(
        JSON.stringify({ error: "Falha ao salvar áudio no storage" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const { data: pub } = admin.storage.from("crm-audio").getPublicUrl(path);

    return new Response(JSON.stringify({ audio_url: pub.publicUrl }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error("[tts] error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});