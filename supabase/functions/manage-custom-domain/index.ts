import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VERCEL_API_TOKEN = Deno.env.get("VERCEL_API_TOKEN");
    const VERCEL_PROJECT_ID = Deno.env.get("VERCEL_PROJECT_ID");
    const VERCEL_TEAM_ID = Deno.env.get("VERCEL_TEAM_ID");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!VERCEL_API_TOKEN || !VERCEL_PROJECT_ID) {
      return new Response(
        JSON.stringify({ error: "Vercel credentials not configured" }),
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
    const teamQuery = VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : "";
    const vercelHeaders = {
      Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
    };

    // CREATE — add domain to Vercel project
    if (action === "create") {
      if (!hostname || typeof hostname !== "string") {
        return new Response(JSON.stringify({ error: "hostname is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanHostname = hostname.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

      // Add domain to Vercel project (DNS validation is done after, not before)
      console.log("Registering domain on Vercel:", cleanHostname);
      const res = await fetch(
        `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains?${teamQuery.replace(/^&/, "")}`,
        {
          method: "POST",
          headers: vercelHeaders,
          body: JSON.stringify({ name: cleanHostname }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const errCode = data.error?.code;
        // If domain is already added to this project, treat as success but continue to Resend registration
        if (errCode === "domain_already_in_use" && data.error?.domain) {
          console.log("Domain already exists in project, continuing to check Resend...");
          // Save to profile
          try {
            await supabase
              .from("profiles")
              .update({ custom_domain: cleanHostname } as any)
              .eq("id", user.id);
          } catch (dbErr) {
            console.warn("Could not save domain to profile:", dbErr);
          }
        } else {
          const errMsg = data.error?.message || "Failed to add domain to Vercel";
          console.error("Vercel error:", JSON.stringify(data));
          return new Response(JSON.stringify({ error: errMsg }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Register domain in Resend if API key is available
      let emailVerification = null;
      if (RESEND_API_KEY) {
        try {
          // Check if already in our DB first
          const { data: existingV } = await supabase
            .from("email_domain_verifications")
            .select("*")
            .eq("user_id", user.id)
            .eq("domain", cleanHostname)
            .single();

          if (existingV?.resend_domain_id) {
            console.log("Domain already in Resend DB, fetching latest status...");
            const resendRes = await fetch(`https://api.resend.com/domains/${existingV.resend_domain_id}`, {
              headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
            });
            if (resendRes.ok) {
              const resendData = await resendRes.json();
              emailVerification = {
                id: resendData.id,
                status: resendData.status,
                records: resendData.records,
              };
              // Update DB
              await supabase.from("email_domain_verifications").update({
                status: resendData.status,
                dkim_records: resendData.records,
                updated_at: new Date().toISOString(),
              }).eq("id", existingV.id);
            }
          } else {
            console.log("Registering domain on Resend:", cleanHostname);
            const resendRes = await fetch("https://api.resend.com/domains", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ name: cleanHostname }),
            });
            const resendData = await resendRes.json();
            
            if (resendRes.ok) {
              emailVerification = {
                id: resendData.id,
                status: resendData.status,
                records: resendData.records,
              };
              // Save to email_domain_verifications
              await supabase.from("email_domain_verifications").upsert({
                user_id: user.id,
                domain: cleanHostname,
                resend_domain_id: resendData.id,
                status: resendData.status,
                dkim_records: resendData.records,
                updated_at: new Date().toISOString(),
              });
            } else if (resendData.message?.includes("already exists")) {
              // Try to list domains to find the ID
              const listRes = await fetch("https://api.resend.com/domains", {
                headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
              });
              if (listRes.ok) {
                const listData = await listRes.json();
                const found = listData.data?.find((d: any) => d.name === cleanHostname);
                if (found) {
                  const detailRes = await fetch(`https://api.resend.com/domains/${found.id}`, {
                    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
                  });
                  if (detailRes.ok) {
                    const detailData = await detailRes.json();
                    emailVerification = {
                      id: detailData.id,
                      status: detailData.status,
                      records: detailData.records,
                    };
                    await supabase.from("email_domain_verifications").upsert({
                      user_id: user.id,
                      domain: cleanHostname,
                      resend_domain_id: detailData.id,
                      status: detailData.status,
                      dkim_records: detailData.records,
                      updated_at: new Date().toISOString(),
                    });
                  }
                }
              }
            }
          }
        } catch (resendErr) {
          console.error("Critical Resend registration error:", resendErr);
        }
      }

      // Save to profile
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
          hostname: data.name,
          status: data.verified ? "active" : "pending",
          ssl_status: data.verified ? "active" : "pending",
          verification: data.verification || null,
          email_verification: emailVerification,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STATUS — check domain verification + SSL details
    if (action === "status") {
      if (!hostname) {
        return new Response(JSON.stringify({ error: "hostname required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanHostname = hostname.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

      // Get domain info from Vercel
      const res = await fetch(
        `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${encodeURIComponent(cleanHostname)}?${teamQuery.replace(/^&/, "")}`,
        { headers: vercelHeaders }
      );

      if (res.status === 404) {
        return new Response(
          JSON.stringify({ status: "not_found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();

      // Try to verify if not yet verified
      let domainData = data;
      if (!data.verified) {
        try {
          const verifyRes = await fetch(
            `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${encodeURIComponent(cleanHostname)}/verify?${teamQuery.replace(/^&/, "")}`,
            { method: "POST", headers: vercelHeaders }
          );
          domainData = await verifyRes.json();
        } catch (verifyErr) {
          console.warn("Verify attempt failed:", verifyErr);
        }
      }

      // Get SSL certificate details via domain config endpoint
      let sslDetails: any = null;
      try {
        const certRes = await fetch(
          `https://api.vercel.com/v6/domains/${encodeURIComponent(cleanHostname)}/config?${teamQuery.replace(/^&/, "")}`,
          { headers: vercelHeaders }
        );
        if (certRes.ok) {
          const certData = await certRes.json();
          sslDetails = {
            configured: !certData.misconfigured,
            misconfigured: certData.misconfigured || false,
            // certs array from Vercel
            certs: (certData.certs || []).map((c: any) => ({
              issuer: c.issuer || null,
              expiry: c.expiresAt || null,
              auto_renew: true,
            })),
            // DNS records Vercel expects
            expected_cnames: certData.cnames || [],
            expected_a_values: certData.aValues || [],
          };
        }
      } catch (certErr) {
        console.warn("Could not fetch SSL details:", certErr);
      }

      // Also do a live HTTPS check
      let httpsReachable = false;
      try {
        const liveCheck = await fetch(`https://${cleanHostname}`, {
          method: "HEAD",
          redirect: "follow",
        });
        httpsReachable = liveCheck.ok || liveCheck.status < 500;
      } catch {
        httpsReachable = false;
      }

      const isVerified = domainData.verified === true;
      const sslActive = sslDetails?.certs?.length > 0 && !sslDetails?.misconfigured;

      // Get Resend status if available
      let emailVerification = null;
      if (RESEND_API_KEY) {
        try {
          const { data: evData } = await supabase
            .from("email_domain_verifications")
            .select("*")
            .eq("user_id", user.id)
            .eq("domain", cleanHostname)
            .single();
          
          if (evData?.resend_domain_id) {
            const resendRes = await fetch(`https://api.resend.com/domains/${evData.resend_domain_id}`, {
              headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
            });
            if (resendRes.ok) {
              const resendData = await resendRes.json();
              emailVerification = {
                id: resendData.id,
                status: resendData.status,
                records: resendData.records,
              };
              // Update DB
              await supabase.from("email_domain_verifications").update({
                status: resendData.status,
                dkim_records: resendData.records,
                updated_at: new Date().toISOString(),
              }).eq("id", evData.id);
            }
          }
        } catch (resendErr) {
          console.warn("Could not fetch Resend status:", resendErr);
        }
      }

      return new Response(
        JSON.stringify({
          status: isVerified ? "active" : "pending",
          ssl_status: sslActive ? "active" : isVerified ? "provisioning" : "pending",
          hostname: domainData.name,
          verification: domainData.verification || null,
          email_verification: emailVerification,
          ssl: {
            active: sslActive,
            https_reachable: httpsReachable,
            issuer: sslDetails?.certs?.[0]?.issuer || null,
            expires_at: sslDetails?.certs?.[0]?.expiry || null,
            auto_renew: true,
            misconfigured: sslDetails?.misconfigured || false,
          },
          dns: {
            configured: sslDetails?.configured || false,
            expected_cnames: sslDetails?.expected_cnames || [],
            expected_a_values: sslDetails?.expected_a_values || [],
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE — remove domain from Vercel project
    if (action === "delete") {
      if (!hostname) {
        return new Response(JSON.stringify({ error: "hostname required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanHostname = hostname.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

      await fetch(
        `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${encodeURIComponent(cleanHostname)}?${teamQuery.replace(/^&/, "")}`,
        { method: "DELETE", headers: vercelHeaders }
      );

      // Remove from profile
      try {
        await supabase
          .from("profiles")
          .update({ custom_domain: null } as any)
          .eq("id", user.id);
      } catch (dbErr) {
        console.warn("Could not remove domain from profile:", dbErr);
      }

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
