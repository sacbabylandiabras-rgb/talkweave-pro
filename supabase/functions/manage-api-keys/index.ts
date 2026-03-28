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

async function ensureTable(supabaseUrl: string, serviceRoleKey: string) {
  // Try to query the table; if it fails with 42P01 (undefined_table), create it
  const testRes = await fetch(
    `${supabaseUrl}/rest/v1/gateway_api_keys?select=id&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (testRes.status === 404 || (testRes.status >= 400 && (await testRes.text()).includes("42P01"))) {
    // Create table via pg-meta SQL endpoint
    const createSQL = `
      CREATE TABLE IF NOT EXISTS public.gateway_api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        public_key text NOT NULL,
        secret_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id)
      );
      ALTER TABLE public.gateway_api_keys ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        CREATE POLICY "Users can view own api keys" ON public.gateway_api_keys
          FOR SELECT TO authenticated USING (auth.uid() = user_id);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE POLICY "Users can insert own api keys" ON public.gateway_api_keys
          FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE POLICY "Users can update own api keys" ON public.gateway_api_keys
          FOR UPDATE TO authenticated USING (auth.uid() = user_id);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `;

    // Use the SQL endpoint available in Supabase
    const sqlRes = await fetch(`${supabaseUrl}/pg/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: createSQL }),
    });
    
    console.log("Table creation attempt status:", sqlRes.status);
  }
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
    
    // Ensure the table exists
    await ensureTable(supabaseUrl, serviceRoleKey);

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
    const { data: keys, error: keysError } = await adminClient
      .from("gateway_api_keys")
      .select("public_key, secret_key, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (keysError) {
      console.error("Error fetching keys:", keysError);
      return new Response(JSON.stringify({ error: keysError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (keys) {
      return new Response(JSON.stringify(keys), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First time — generate keys
    const publicKey = generateKey("pk_live_zlp_");
    const secretKey = generateKey("sk_live_zlp_");

    const { error: insertError } = await adminClient.from("gateway_api_keys").insert({
      user_id: user.id,
      public_key: publicKey,
      secret_key: secretKey,
    });

    if (insertError) {
      console.error("Error inserting keys:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ public_key: publicKey, secret_key: secretKey }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
