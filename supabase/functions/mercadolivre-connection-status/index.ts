import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "affiliate-connections";
const PROVIDER = "mercadolivre";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json({ connected: false }, 200);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) return json({ connected: false }, 200);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const storagePath = `${userData.user.id}/${PROVIDER}.json`;
    console.log(`[Storage] Checking connection at: ${storagePath}`);
    const { data, error } = await admin.storage
      .from(BUCKET)
      .download(storagePath);


    if (error || !data) return json({ connected: false });

    const record = JSON.parse(await data.text());
    return json({
      connected: true,
      accountId: record.account_id ?? null,
      nickname: record.account_nickname ?? null,
      expiresAt: record.expires_at ?? null,
    });
  } catch (err) {
    console.error("ml-connection-status error:", err);
    return json({ connected: false }, 200);
  }
});
