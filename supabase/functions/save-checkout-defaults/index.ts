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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify auth
    const authHeader = req.headers.get("authorization") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, defaults } = await req.json();
    const configKey = `checkout_defaults:${user.id}`;

    if (action === "load") {
      const { data } = await supabase
        .from("gateway_platform_config")
        .select("value")
        .eq("key", configKey)
        .maybeSingle();

      return new Response(JSON.stringify({ value: data?.value || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const { error } = await supabase
        .from("gateway_platform_config")
        .upsert({ key: configKey, value: JSON.stringify(defaults) }, { onConflict: "key" });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "apply_all") {
      // Save defaults first
      await supabase
        .from("gateway_platform_config")
        .upsert({ key: configKey, value: JSON.stringify(defaults) }, { onConflict: "key" });

      // Get all user checkouts
      const { data: checkouts } = await supabase
        .from("gateway_checkouts")
        .select("id, config")
        .eq("user_id", user.id);

      if (!checkouts || checkouts.length === 0) {
        return new Response(JSON.stringify({ success: true, updated: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let updated = 0;
      for (const checkout of checkouts) {
        const existingConfig = (checkout.config || {}) as Record<string, any>;
        const mergedConfig = { ...existingConfig, ...defaults };

        const { error } = await supabase
          .from("gateway_checkouts")
          .update({ config: mergedConfig })
          .eq("id", checkout.id);

        if (!error) updated++;
      }

      return new Response(JSON.stringify({ success: true, updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
