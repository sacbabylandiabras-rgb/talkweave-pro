import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, supabaseServiceKey);

    // Try to add the column - if it already exists, this is a no-op
    const { error } = await client.rpc("exec_sql", {
      sql: "ALTER TABLE public.redirect_link_groups ADD COLUMN IF NOT EXISTS group_photo text DEFAULT NULL;"
    });

    // Alternative: just try inserting with group_photo and see if column exists
    const { data, error: testError } = await client
      .from("redirect_link_groups")
      .select("group_photo")
      .limit(1);

    return new Response(JSON.stringify({ 
      success: !testError,
      message: testError ? "Column does not exist yet" : "Column exists",
      error: testError?.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
