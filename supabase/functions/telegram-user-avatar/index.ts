import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    const tgUserId = url.searchParams.get("tg_user_id") || "";
    if (!botId || !tgUserId) return json(400, { error: "invalid_request" });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: bot, error: botError } = await admin
      .from("telegram_bots")
      .select("bot_token,user_id")
      .eq("id", botId)
      .single();
    if (botError || !bot || bot.user_id !== user.id) return json(404, { error: "not_found" });

    // 1. Get user profile photos
    const photosRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getUserProfilePhotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: Number(tgUserId), limit: 1 }),
    });
    const photosJson = await photosRes.json().catch(() => ({}));
    const photoSizes = photosJson?.result?.photos?.[0];
    if (!Array.isArray(photoSizes) || photoSizes.length === 0) {
      return json(404, { error: "no_photo" });
    }
    // Pick smallest (last items are larger; smallest at index 0)
    const smallest = photoSizes[0];
    const fileId = smallest?.file_id;
    if (!fileId) return json(404, { error: "no_photo" });

    // 2. Get file path
    const fileRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileJson = await fileRes.json().catch(() => ({}));
    const filePath = fileJson?.result?.file_path;
    if (!filePath) return json(502, { error: "file_lookup_failed" });

    // 3. Download
    const downloadRes = await fetch(`https://api.telegram.org/file/bot${bot.bot_token}/${filePath}`);
    if (!downloadRes.ok || !downloadRes.body) return json(502, { error: "file_download_failed" });

    return new Response(downloadRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": downloadRes.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("telegram-user-avatar error", e);
    return json(500, { error: "internal_error" });
  }
});