import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data, error } = await supabase
  .from("profiles")
  .update({ is_active: true, subscription_status: "active", updated_at: new Date().toISOString() })
  .eq("id", "d2ead472-70cd-48e5-9c54-4249a74308f8")
  .select();

if (error) {
  console.error("Error:", error);
  process.exit(1);
}

console.log("Updated user:", data);
