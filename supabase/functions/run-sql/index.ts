import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { sql } = await req.json();

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    // If rpc exec_sql doesn't exist, try a different way or just return the error
    return new Response(JSON.stringify({ error }), { status: 400 });
  }

  return new Response(JSON.stringify({ data }), { status: 200 });
});
