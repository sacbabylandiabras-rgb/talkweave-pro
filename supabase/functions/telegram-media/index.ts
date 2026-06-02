import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const contentTypeByExt: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  pdf: "application/pdf",
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json(500, { error: "server_not_configured" });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { error: "unauthorized" });

    const authClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) return json(401, { error: "unauthorized" });

    const url = new URL(req.url);
    const botId = url.searchParams.get("bot_id") || "";
    const fileId = url.searchParams.get("file_id") || "";
    if (!botId || !fileId || botId.length > 80 || fileId.length > 300) return json(400, { error: "invalid_request" });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: bot, error: botError } = await admin
      .from("telegram_bots")
      .select("bot_token,user_id")
      .eq("id", botId)
      .single();
    if (botError || !bot || bot.user_id !== user.id) return json(404, { error: "not_found" });

    const fileRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileJson = await fileRes.json().catch(() => ({}));
    if (!fileRes.ok || !fileJson?.ok || !fileJson?.result?.file_path) return json(502, { error: "file_lookup_failed" });

    const filePath = String(fileJson.result.file_path);
    const downloadRes = await fetch(`https://api.telegram.org/file/bot${bot.bot_token}/${filePath}`);
    if (!downloadRes.ok || !downloadRes.body) return json(502, { error: "file_download_failed" });

    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    return new Response(downloadRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": downloadRes.headers.get("Content-Type") || contentTypeByExt[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    console.error("telegram-media error", e);
    return json(500, { error: "internal_error" });
  }
});
