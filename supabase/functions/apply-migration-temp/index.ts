import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  
  // Use pg client via Deno
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const client = new Client(dbUrl);
  await client.connect();
  
  await client.queryArray(`
    ALTER TABLE public.redirect_links
    ADD COLUMN IF NOT EXISTS group_message_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS group_message_text text NOT NULL DEFAULT '';
  `);
  
  await client.end();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
