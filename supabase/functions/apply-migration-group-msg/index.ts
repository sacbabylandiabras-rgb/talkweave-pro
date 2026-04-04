import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.rpc("exec_sql" as any, {
    sql: `
      ALTER TABLE public.redirect_links
      ADD COLUMN IF NOT EXISTS group_message_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS group_message_text text NOT NULL DEFAULT '';
    `
  });

  if (error) {
    // Try direct approach
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/exec_sql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        },
        body: JSON.stringify({ sql: "SELECT 1" }),
      }
    );
    
    // Use the DB URL directly
    return new Response(JSON.stringify({ error: error.message, hint: "Run SQL manually" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
