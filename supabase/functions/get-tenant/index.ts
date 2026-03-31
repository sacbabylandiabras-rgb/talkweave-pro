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
    const url = new URL(req.url);
    const subdomain = url.searchParams.get("subdomain");

    if (!subdomain) {
      return new Response(JSON.stringify({ error: "subdomain is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Try to find the profile by custom_domain
    // custom_domain can be stored as full domain (pay.payshein.site) or subdomain (payshein)
    // We search for matches containing the subdomain
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, custom_domain")
      .or(`custom_domain.ilike.%${subdomain}%`)
      .maybeSingle();

    if (error || !profile) {
      // Also try exact match on the full hostname
      const { data: profileExact, error: errExact } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, custom_domain")
        .eq("custom_domain", subdomain)
        .maybeSingle();

      if (errExact || !profileExact) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          tenant: {
            id: profileExact.id,
            name: profileExact.full_name || "Loja",
            logo_url: profileExact.avatar_url || "",
            primary_color: "",
            subdomain: subdomain,
            custom_domain: profileExact.custom_domain || "",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        tenant: {
          id: profile.id,
          name: profile.full_name || "Loja",
          logo_url: profile.avatar_url || "",
          primary_color: "",
          subdomain: subdomain,
          custom_domain: profile.custom_domain || "",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
