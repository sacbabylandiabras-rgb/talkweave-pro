import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CF_API = "https://api.cloudflare.com/client/v4";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const CLOUDFLARE_ZONE_ID = Deno.env.get("CLOUDFLARE_ZONE_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
      return new Response(
        JSON.stringify({ error: "Cloudflare credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, hostname } = await req.json();

    const cfHeaders = {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    };

    // CREATE custom hostname
    if (action === "create") {
      if (!hostname || typeof hostname !== "string") {
        return new Response(JSON.stringify({ error: "hostname is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanHostname = hostname.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

      // Create custom hostname in Cloudflare
      const cfRes = await fetch(`${CF_API}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames`, {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({
          hostname: cleanHostname,
          ssl: {
            method: "http",
            type: "dv",
            settings: {
              min_tls_version: "1.2",
            },
          },
        }),
      });

      const cfData = await cfRes.json();

      if (!cfData.success) {
        const errMsg = cfData.errors?.[0]?.message || "Failed to create custom hostname";
        console.error("Cloudflare error:", JSON.stringify(cfData));
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try to save to profile (column may not exist yet)
      try {
        await supabase
          .from("profiles")
          .update({ custom_domain: cleanHostname } as any)
          .eq("id", user.id);
      } catch (dbErr) {
        console.warn("Could not save domain to profile:", dbErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          hostname: cfData.result.hostname,
          status: cfData.result.status,
          ssl_status: cfData.result.ssl?.status,
          cf_hostname_id: cfData.result.id,
          ownership_verification: cfData.result.ownership_verification,
          ssl_validation: cfData.result.ssl?.validation_records,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK status of custom hostname
    if (action === "status") {
      if (!hostname) {
        return new Response(JSON.stringify({ error: "hostname required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanHostname = hostname.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

      const cfRes = await fetch(
        `${CF_API}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(cleanHostname)}`,
        { headers: cfHeaders }
      );
      const cfData = await cfRes.json();

      if (!cfData.success || !cfData.result?.length) {
        return new Response(
          JSON.stringify({ status: "not_found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ch = cfData.result[0];
      return new Response(
        JSON.stringify({
          status: ch.status,
          ssl_status: ch.ssl?.status,
          hostname: ch.hostname,
          cf_hostname_id: ch.id,
          ownership_verification: ch.ownership_verification,
          ssl_validation: ch.ssl?.validation_records,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE custom hostname
    if (action === "delete") {
      if (!hostname) {
        return new Response(JSON.stringify({ error: "hostname required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanHostname = hostname.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

      // Find the hostname ID first
      const listRes = await fetch(
        `${CF_API}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(cleanHostname)}`,
        { headers: cfHeaders }
      );
      const listData = await listRes.json();

      if (listData.success && listData.result?.length) {
        const chId = listData.result[0].id;
        await fetch(`${CF_API}/zones/${CLOUDFLARE_ZONE_ID}/custom_hostnames/${chId}`, {
          method: "DELETE",
          headers: cfHeaders,
        });
      }

      // Remove from profile
      await supabase
        .from("profiles")
        .update({ custom_domain: null })
        .eq("id", user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
