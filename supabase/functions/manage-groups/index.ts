import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, instanceId, instanceToken, instanceClientToken } = body;

    // Use provided instance credentials or default
    const instId = instanceId || credentials.instanceId;
    const instToken = instanceToken || credentials.token;
    const instClientToken = instanceClientToken || credentials.clientToken;

    const baseUrl = `https://api.z-api.io/instances/${instId}/token/${instToken}`;
    const headers = {
      "Content-Type": "application/json",
      "Client-Token": instClientToken,
    };

    switch (action) {
      case "create-group": {
        const { groupName, phones } = body;
        if (!groupName) throw new Error("groupName is required");

        const response = await fetch(`${baseUrl}/create-group`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupName,
            phones: phones || [],
          }),
        });

        const data = await response.json();
        console.log("✅ Group created:", JSON.stringify(data));
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-invite-link": {
        const { groupId } = body;
        if (!groupId) throw new Error("groupId is required");

        const cleanId = groupId.replace("-group", "@g.us");
        const response = await fetch(`${baseUrl}/invite-link/${cleanId}`, {
          method: "GET",
          headers,
        });

        const data = await response.json();
        console.log("✅ Invite link:", JSON.stringify(data));
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add-participant": {
        const { groupId, phone } = body;
        if (!groupId || !phone) throw new Error("groupId and phone are required");

        const cleanId = groupId.replace("-group", "@g.us");
        const response = await fetch(`${baseUrl}/add-participant`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupId: cleanId,
            phone,
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove-participant": {
        const { groupId, phone } = body;
        if (!groupId || !phone) throw new Error("groupId and phone are required");

        const cleanId = groupId.replace("-group", "@g.us");
        const response = await fetch(`${baseUrl}/remove-participant`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupId: cleanId,
            phone,
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "promote-participant": {
        const { groupId, phone } = body;
        if (!groupId || !phone) throw new Error("groupId and phone are required");

        const cleanId = groupId.replace("-group", "@g.us");
        const response = await fetch(`${baseUrl}/promote-participant`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupId: cleanId,
            phone,
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "demote-participant": {
        const { groupId, phone } = body;
        if (!groupId || !phone) throw new Error("groupId and phone are required");

        const cleanId = groupId.replace("-group", "@g.us");
        const response = await fetch(`${baseUrl}/demote-participant`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupId: cleanId,
            phone,
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("❌ Error in manage-groups:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
