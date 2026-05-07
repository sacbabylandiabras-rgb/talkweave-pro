 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabase = createClient(
       Deno.env.get("SUPABASE_URL")!,
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
     );
 
     console.log("Checking for expired subscriptions...");
 
     // Find all users with active status but expired date
     const now = new Date().toISOString();
     
     const { data: expiredProfiles, error: fetchError } = await supabase
       .from("profiles")
       .select("id, email, subscription_expires_at")
       .eq("is_active", true)
       .eq("subscription_status", "active")
       .lt("subscription_expires_at", now);
 
     if (fetchError) throw fetchError;
 
     console.log(`Found ${expiredProfiles?.length || 0} expired profiles.`);
 
     if (expiredProfiles && expiredProfiles.length > 0) {
       const ids = expiredProfiles.map(p => p.id);
       
       const { error: updateError } = await supabase
         .from("profiles")
         .update({
           is_active: false,
           subscription_status: "expired",
           updated_at: now
         })
         .in("id", ids);
 
       if (updateError) throw updateError;
 
       console.log(`Updated ${ids.length} profiles to expired.`);
     }
 
     return new Response(JSON.stringify({ 
       success: true, 
       checked_at: now, 
       expired_count: expiredProfiles?.length || 0 
     }), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error) {
     console.error("Error in check-subscriptions:", error);
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });