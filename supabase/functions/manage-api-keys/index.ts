import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateKey(prefix: string): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}${hex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "get";

    if (action === "regenerate") {
      const newPublicKey = generateKey("pk_live_zlp_");
      const newSecretKey = generateKey("sk_live_zlp_");

      const { data: existing } = await adminClient
        .from("gateway_api_keys")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await adminClient
          .from("gateway_api_keys")
          .update({ public_key: newPublicKey, secret_key: newSecretKey })
          .eq("user_id", user.id);
      } else {
        await adminClient.from("gateway_api_keys").insert({
          user_id: user.id,
          public_key: newPublicKey,
          secret_key: newSecretKey,
        });
      }

      return new Response(
        JSON.stringify({ public_key: newPublicKey, secret_key: newSecretKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET — fetch or auto-create keys
    const { data: keys } = await adminClient
      .from("gateway_api_keys")
      .select("public_key, secret_key, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (keys) {
      return new Response(JSON.stringify(keys), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First time — generate keys
    const publicKey = generateKey("pk_live_zlp_");
    const secretKey = generateKey("sk_live_zlp_");

    await adminClient.from("gateway_api_keys").insert({
      user_id: user.id,
      public_key: publicKey,
      secret_key: secretKey,
    });

    return new Response(
      JSON.stringify({ public_key: publicKey, secret_key: secretKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
