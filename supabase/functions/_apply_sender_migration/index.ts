import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
Deno.serve(async () => {
  // Try inserting a row with the new columns. If they don't exist, surface the error.
  const { error } = await supabase.from("message_logs").select("sender_name, sender_phone").limit(1);
  return new Response(JSON.stringify({ ok: !error, error: error?.message || null }), { headers: { "Content-Type": "application/json" } });
});
