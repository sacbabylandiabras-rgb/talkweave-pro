import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const buildFriendlyVoiceError = (status: number, rawBody: string) => {
  let upstreamCode = "";
  let upstreamMessage = "";

  try {
    const parsed = JSON.parse(rawBody);
    upstreamCode = String(parsed?.error?.code || parsed?.code || parsed?.detail?.status || "");
    upstreamMessage = String(parsed?.error?.message || parsed?.message || parsed?.detail?.message || "");
  } catch {
    upstreamMessage = rawBody;
  }

  const normalized = `${upstreamCode} ${upstreamMessage}`.toLowerCase();

  if (status === 429 || normalized.includes("quota")) {
    return {
      error: "Créditos do serviço de voz acabaram",
      details:
        "A geração de áudio não foi concluída porque a conta conectada ao serviço de voz está sem créditos ou sem cobrança ativa. Adicione créditos na conta da API e tente novamente em 1–2 minutos.",
      hint: "Se você já adicionou créditos, confirme se a chave informada pertence à organização correta e tem acesso ao recurso de voz.",
      status,
    };
  }

  if (status === 429) {
    return {
      error: "Serviço de voz temporariamente ocupado",
      details: "O serviço recusou a geração neste momento. Aguarde alguns instantes e tente novamente.",
      status,
    };
  }

  if (status === 401 || normalized.includes("invalid_api_key") || normalized.includes("invalid api key")) {
    return {
      error: "Serviço de voz não autorizado",
      details: "O Token API Key informado é inválido ou foi removido. Verifique a chave configurada no bloco.",
      status,
    };
  }

  if (status === 403) {
    return {
      error: "Serviço de voz sem permissão",
      details: "A chave configurada não tem permissão para gerar áudio. Verifique as permissões e o acesso ao recurso de voz na conta da API.",
      status,
    };
  }

  if (status === 404 || normalized.includes("voice_not_found") || normalized.includes("voice not found")) {
    return {
      error: "Voice ID não encontrado",
      details: "O Voice ID informado não existe ou não está disponível para esta chave. Verifique e tente novamente.",
      status,
    };
  }

  if (status === 400) {
    return {
      error: "Configuração do áudio inválida",
      details: upstreamMessage || "Revise o texto, o Voice ID e os parâmetros. Depois tente gerar o áudio novamente.",
      status,
    };
  }

  return {
    error: "Falha ao gerar áudio",
    details: "O serviço de voz retornou um erro inesperado. Tente novamente em alguns minutos.",
    status,
  };
};

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
    const apiKey = String(body.apiKey || "").trim();
    const voiceId = String(body.voiceId || "").trim();
    const stability = Math.min(1, Math.max(0, Number(body.stability ?? 0.95)));
    const similarityBoost = Math.min(1, Math.max(0, Number(body.similarityBoost ?? 0.75)));
    const style = Math.min(1, Math.max(0, Number(body.style ?? 0.08)));
    const speed = Math.min(1.2, Math.max(0.7, Number(body.speed ?? 1)));
    const useSpeakerBoost = body.useSpeakerBoost !== false;
    const preview = Boolean(body.preview);
    const audioName = String(body.audioName || "").trim() || `audio-${Date.now()}`;

    if (!text) {
      return new Response(JSON.stringify({ error: "Texto é obrigatório" }), { status: 400, headers: jsonHeaders });
    }
    if (text.length > 4000) {
      return new Response(JSON.stringify({ error: "Texto muito longo (máx. 4000 caracteres)" }), { status: 400, headers: jsonHeaders });
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Token API Key é obrigatório" }), { status: 400, headers: jsonHeaders });
    }
    if (!voiceId) {
      return new Response(JSON.stringify({ error: "Voice ID é obrigatório" }), { status: 400, headers: jsonHeaders });
    }

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost,
            speed,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => "");
      console.error("TTS upstream error", ttsRes.status, errText);
      return new Response(
        JSON.stringify(buildFriendlyVoiceError(ttsRes.status, errText)),
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
      JSON.stringify({
        error: "Erro interno ao gerar áudio",
        details: "Não foi possível concluir a geração agora. Tente novamente em alguns minutos.",
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
});