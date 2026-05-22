import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find campaigns that are scheduled (draft status) and due
    const { data: dueCampaigns, error: fetchError } = await supabase
      .from("campaigns")
      .select("id, user_id, target_audience, scheduled_at, schedule_type")
      .eq("status", "draft")
      .eq("schedule_type", "scheduled")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now);

    if (fetchError) {
      console.error("❌ Error fetching scheduled campaigns:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueCampaigns || dueCampaigns.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No scheduled campaigns due" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`⏰ Found ${dueCampaigns.length} scheduled campaign(s) due for processing`);

    const results = [];

    for (const campaign of dueCampaigns) {
      const contacts = campaign.target_audience?.contacts || [];
      if (contacts.length === 0) {
        console.log(`⚠️ Campaign ${campaign.id} has no contacts, skipping`);
        results.push({ campaignId: campaign.id, status: "skipped", reason: "no_contacts" });
        continue;
      }

      // Resolve instance for this user
      // Respect the instanceId stored in target_audience if it exists
      let instanceId = campaign.target_audience?.__sendConfig?.instanceId;
      
      if (!instanceId) {
        const { data: defaultInstance } = await supabase
          .from("zapi_instances")
          .select("id")
          .eq("user_id", campaign.user_id)
          .eq("is_default", true)
          .eq("is_active", true)
          .maybeSingle();

        instanceId = defaultInstance?.id || "__rotate_all__";
      }

      // Mark as active first
      await supabase
        .from("campaigns")
        .update({
          status: "active",
          target_audience: {
            ...campaign.target_audience,
            __sendConfig: {
              instanceId: instanceId !== "__rotate_all__" ? instanceId : null,
              rotateAll: instanceId === "__rotate_all__",
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);

      console.log(`🚀 Triggering scheduled campaign ${campaign.id} with ${contacts.length} contacts`);

      // Invoke send-campaign
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            campaignId: campaign.id,
            contacts,
            instanceId,
            _isContinuation: true,
            _userId: campaign.user_id,
          }),
        });

        const responseData = await response.json().catch(() => ({}));
        console.log(`📬 Campaign ${campaign.id} send-campaign response: ${response.status}`, responseData);
        results.push({ campaignId: campaign.id, status: "triggered", httpStatus: response.status });
      } catch (invokeError) {
        console.error(`❌ Error invoking send-campaign for ${campaign.id}:`, invokeError);
        results.push({ campaignId: campaign.id, status: "error", error: String(invokeError) });
      }
    }

    return new Response(JSON.stringify({ processed: dueCampaigns.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("💥 process-scheduled-campaigns error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
