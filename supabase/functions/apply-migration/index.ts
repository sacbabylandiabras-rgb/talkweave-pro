import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    // Use postgres connection to run DDL
    const { Client } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const client = new Client(dbUrl);
    await client.connect();

    // Create redirect_link_clicks table
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS public.redirect_link_clicks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        redirect_link_id uuid NOT NULL REFERENCES public.redirect_links(id) ON DELETE CASCADE,
        group_redirected_to text,
        ip_address text,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.queryArray(`
      CREATE INDEX IF NOT EXISTS idx_redirect_link_clicks_link_id ON public.redirect_link_clicks(redirect_link_id);
    `);

    await client.queryArray(`ALTER TABLE public.redirect_link_clicks ENABLE ROW LEVEL SECURITY;`);

    try {
      await client.queryArray(`
        CREATE POLICY "Service role can insert clicks"
          ON public.redirect_link_clicks
          FOR INSERT
          TO anon, authenticated
          WITH CHECK (true);
      `);
    } catch { /* policy may already exist */ }

    try {
      await client.queryArray(`
        CREATE POLICY "Users can view clicks for own links"
          ON public.redirect_link_clicks
          FOR SELECT
          TO authenticated
          USING (
            redirect_link_id IN (
              SELECT id FROM public.redirect_links WHERE user_id = auth.uid()
            )
          );
      `);
    } catch { /* policy may already exist */ }

    // Add group_photo column
    await client.queryArray(`
      ALTER TABLE public.redirect_link_groups ADD COLUMN IF NOT EXISTS group_photo text DEFAULT NULL;
    `);

    await client.end();

    return new Response(JSON.stringify({ success: true, message: "Migration applied" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
