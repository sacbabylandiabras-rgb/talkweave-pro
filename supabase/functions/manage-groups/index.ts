import { createClient } from "npm:@supabase/supabase-js@2.58.0";
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

        // Filter out empty or invalid phones
        const validPhones = Array.isArray(phones) 
          ? phones.map(p => String(p).trim()).filter(p => p.length >= 8)
          : [];

        const response = await fetch(`${baseUrl}/create-group`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupName,
            phones: validPhones,
          }),
        });

        const data = await response.json();
        console.log("✅ Group created response:", JSON.stringify(data));
        
        // Z-API returns { success: false, message: "participants not found" } if phones are provided but not found
        // If phones were provided and it failed with that message, retry without phones
        if (data?.success === false && data?.message === "participants not found" && validPhones.length > 0) {
          console.log("⚠️ Failed with 'participants not found', retrying without phones...");
          const retryResponse = await fetch(`${baseUrl}/create-group`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              groupName,
              phones: [],
            }),
          });
          const retryData = await retryResponse.json();
          console.log("✅ Group created (retry):", JSON.stringify(retryData));
          return new Response(JSON.stringify(retryData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update-group-name": {
        const { groupId, groupName } = body;
        if (!groupId || !groupName) throw new Error("groupId and groupName are required");
        let cleanId = groupId;
        if (!groupId.includes('@newsletter') && !groupId.includes('-community')) {
          cleanId = groupId.replace("-group", "@g.us");
        }
        const response = await fetch(`${baseUrl}/update-group-name`, {
          method: "POST",
          headers,
          body: JSON.stringify({ groupId: cleanId, groupName }),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update-group-description": {
        const { groupId, description } = body;
        if (!groupId) throw new Error("groupId is required");
        // Z-API expects groupId in "-group" format and field "groupDescription"
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        console.log("📋 update-group-description groupId:", groupId, "-> cleanId:", cleanId, "description:", description);
        const response = await fetch(`${baseUrl}/update-group-description`, {
          method: "POST",
          headers,
          body: JSON.stringify({ groupId: cleanId, groupDescription: description || "" }),
        });
        const data = await response.json();
        console.log("📋 update-group-description response:", JSON.stringify(data));
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

       case "update-group-photo": {
         const { groupId, imageUrl } = body;
         if (!groupId || !imageUrl) throw new Error("groupId and imageUrl are required");
         
         let cleanId = groupId;
         // Z-API expects @g.us for groups in /update-group-photo
         if (!groupId.includes('@newsletter') && !groupId.includes('-community')) {
           cleanId = groupId.replace("-group", "@g.us");
         }
         
         console.log("📷 update-group-photo groupId:", groupId, "-> cleanId:", cleanId, "imageUrl:", imageUrl);
         
         // Attempt 1: Regular Z-API endpoint
         const response = await fetch(`${baseUrl}/update-group-photo`, {
           method: "POST",
           headers,
           body: JSON.stringify({ groupId: cleanId, groupPhoto: imageUrl }),
         });
         
         let data = await response.json().catch(() => ({}));
         console.log("📷 update-group-photo response (attempt 1):", JSON.stringify(data));
         
         // If failed with specific error or not found, try alternative endpoint or payload
         if (!response.ok || data?.error) {
           console.log("⚠️ Attempt 1 failed, trying alternative payload (phone instead of groupId)...");
           const retryResponse = await fetch(`${baseUrl}/update-group-photo`, {
             method: "POST",
             headers,
             body: JSON.stringify({ phone: cleanId, groupPhoto: imageUrl }),
           });
           data = await retryResponse.json().catch(() => ({}));
           console.log("📷 update-group-photo response (attempt 2):", JSON.stringify(data));
         }
         
         return new Response(JSON.stringify(data), {
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }

      case "admin-only-messages": {
        const {
          groupId,
          value,
          adminOnlySettings,
          requireAdminApproval,
          adminOnlyAddMember,
        } = body;
        if (!groupId) throw new Error("groupId is required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        console.log("📋 admin-only-messages groupId:", groupId, "-> cleanId:", cleanId);
        const payload: Record<string, unknown> = {
          phone: cleanId,
          adminOnlyMessage: value ?? true,
        };
        if (typeof adminOnlySettings === "boolean") payload.adminOnlySettings = adminOnlySettings;
        if (typeof requireAdminApproval === "boolean") payload.requireAdminApproval = requireAdminApproval;
        if (typeof adminOnlyAddMember === "boolean") payload.adminOnlyAddMember = adminOnlyAddMember;
        const response = await fetch(`${baseUrl}/update-group-settings`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        console.log("📋 admin-only-messages response:", JSON.stringify(data));
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

       case "get-invite-link": {
         const { groupId, isCommunity, isChannel } = body;
         if (!groupId) throw new Error("groupId is required");
 
         const sGroupId = String(groupId);
         const isActuallyChannel = isChannel || sGroupId.includes("@newsletter");
         const isActuallyCommunity = isCommunity || sGroupId.includes("@lid");
 
         console.log(`📋 get-invite-link: id=${groupId}, channel=${isActuallyChannel}, community=${isActuallyCommunity}`);
 
         if (isActuallyCommunity) {
           const cleanId = sGroupId.replace("-group", "").replace("@lid", "").replace("@g.us", "");
           const resp = await fetch(`${baseUrl}/redefine-invitation-link/${encodeURIComponent(cleanId)}`, {
             method: "POST",
             headers,
           });
           const respData = await resp.json().catch(() => ({}));
           console.log("✅ Community invite link result:", JSON.stringify(respData));
           const link = respData?.invitationLink || respData?.invitation_link || respData?.link;
           return new Response(
             JSON.stringify(link ? { link, invitationLink: link, success: true } : { ...respData, success: false }),
             {
               status: 200,
               headers: { ...corsHeaders, "Content-Type": "application/json" },
             }
           );
         }
 
         if (isActuallyChannel) {
           // For Channels, Z-API usually doesn't have a direct invitation link endpoint.
           // We try to find it in the chats list or specific metadata.
           const res = await fetch(`${baseUrl}/chats`, { method: "GET", headers });
           const chats = await res.json().catch(() => []);
           const cleanId = sGroupId.replace("@newsletter", "");
            const chat = Array.isArray(chats) ? chats.find((c: any) => 
              c.id === sGroupId || 
              c.phone === sGroupId || 
              c.id === cleanId || 
              c.phone === cleanId ||
              String(c.id).includes(cleanId)
            ) : null;
            
            let link = chat?.invitationLink || chat?.link || chat?.url || chat?.metadata?.inviteCode;
            
            if (!link) {
             // Try multiple strategies to find the newsletter invite link
             const newsletterId = cleanId.includes("@newsletter") ? cleanId : `${cleanId}@newsletter`;
             
             // Strategy 1: Search in all chats (this usually contains the link if the user has access)
             console.log("📋 Searching for channel invite link in all chats...");
             const chatsRes = await fetch(`${baseUrl}/chats?pageSize=100`, { method: "GET", headers });
             const chatsData = await chatsRes.json().catch(() => []);
             const chatList = Array.isArray(chatsData) ? chatsData : (chatsData?.chats || []);
             
             // Priority search in chats list
             if (Array.isArray(chatList)) {
               const foundChat = chatList.find((c: any) => 
                 String(c.id) === newsletterId || 
                 String(c.phone) === newsletterId || 
                 (cleanId && String(c.id).includes(cleanId))
               );
               
               if (foundChat) {
                 console.log("✅ Channel found in chats list");
                 link = foundChat.inviteLink || foundChat.invitationLink || foundChat.link || foundChat.url;
               }
             }
             
             if (!link) {
               // Strategy 2: Specific newsletter endpoints
               const endpoints = [
                  `${baseUrl}/newsletter/metadata/${encodeURIComponent(newsletterId)}`,
                  `${baseUrl}/newsletter/metadata?newsletterId=${encodeURIComponent(newsletterId)}`,
                 `${baseUrl}/newsletter/${encodeURIComponent(newsletterId)}`,
                 `${baseUrl}/newsletter-metadata/${encodeURIComponent(newsletterId)}`,
                 `${baseUrl}/newsletter-metadata/${encodeURIComponent(cleanId)}`,
                 `${baseUrl}/channel/${encodeURIComponent(cleanId)}`,
                 `${baseUrl}/channel-metadata/${encodeURIComponent(cleanId)}`
               ];
               
               for (const endpoint of endpoints) {
                 try {
                   console.log(`📋 Checking endpoint: ${endpoint}`);
                   const res = await fetch(endpoint, { method: "GET", headers });
                   if (!res.ok) continue;
                   const data = await res.json().catch(() => ({}));
                   console.log(`📋 Result from ${endpoint}:`, JSON.stringify(data));
                   link = data?.inviteLink || data?.invitationLink || data?.link || data?.url || data?.metadata?.inviteLink;
                   if (link) break;
                 } catch (e) {
                   console.error(`Error checking endpoint ${endpoint}:`, e);
                 }
               }
             }
            }

            if (link && !String(link).startsWith('http')) {
              link = `https://whatsapp.com/channel/${link}`;
            }
 
           if (link) {
             return new Response(JSON.stringify({ link, invitationLink: link, success: true }), {
               headers: { ...corsHeaders, "Content-Type": "application/json" },
             });
           }
 
           return new Response(JSON.stringify({ error: "Could not find channel invite link", success: false }), {
             status: 200,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
           });
         }
 
         // Regular Group
         const cleanId = sGroupId.includes("-group") ? sGroupId : sGroupId.replace("@g.us", "-group");
         const response = await fetch(`${baseUrl}/group-invitation-link/${cleanId}`, { method: "GET", headers });
         const data = await response.json().catch(() => ({}));
         console.log("✅ Group invite link result:", JSON.stringify(data));
         
         return new Response(JSON.stringify(data), {
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }

      case "add-participant": {
        const { groupId, phone } = body;
        if (!groupId || !phone) throw new Error("groupId and phone are required");

        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/add-participant`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupId: cleanId,
            phones: [phone],
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

        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/remove-participant`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupId: cleanId,
            phones: [phone],
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

        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/add-admin`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupId: cleanId,
            phones: [phone],
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

        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/remove-admin`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupId: cleanId,
            phones: [phone],
          }),
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Aliases para alinhar com a documentação Z-API
      case "add-admin": {
        const { groupId, phones, phone } = body;
        const list = Array.isArray(phones) ? phones : phone ? [phone] : [];
        if (!groupId || list.length === 0) throw new Error("groupId and phones are required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/add-admin`, {
          method: "POST", headers,
          body: JSON.stringify({ groupId: cleanId, phones: list }),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "remove-admin": {
        const { groupId, phones, phone } = body;
        const list = Array.isArray(phones) ? phones : phone ? [phone] : [];
        if (!groupId || list.length === 0) throw new Error("groupId and phones are required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/remove-admin`, {
          method: "POST", headers,
          body: JSON.stringify({ groupId: cleanId, phones: list }),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "approve-participant": {
        const { groupId, phones, phone } = body;
        const list = Array.isArray(phones) ? phones : phone ? [phone] : [];
        if (!groupId || list.length === 0) throw new Error("groupId and phones are required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/approve-participant`, {
          method: "POST", headers,
          body: JSON.stringify({ groupId: cleanId, phones: list }),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "reject-participant": {
        const { groupId, phones, phone } = body;
        const list = Array.isArray(phones) ? phones : phone ? [phone] : [];
        if (!groupId || list.length === 0) throw new Error("groupId and phones are required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/reject-participant`, {
          method: "POST", headers,
          body: JSON.stringify({ groupId: cleanId, phones: list }),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "mention-participant": {
        const { phone: groupPhone, message, mentioned } = body;
        if (!groupPhone || !message) throw new Error("phone and message are required");
        const response = await fetch(`${baseUrl}/send-text`, {
          method: "POST", headers,
          body: JSON.stringify({
            phone: groupPhone.includes("-group") ? groupPhone : groupPhone.replace("@g.us", "-group"),
            message,
            mentioned: Array.isArray(mentioned) ? mentioned : [],
          }),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "mention-group": {
        const { phone: groupPhone, groupId, message } = body;
        const target = groupPhone || groupId;
        if (!target || !message) throw new Error("groupId and message are required");
        const cleanId = target.includes("-group") ? target : target.replace("@g.us", "-group");

        // Buscar metadata do grupo para extrair os participantes reais
        let mentioned: string[] = [];
        try {
          const metaResp = await fetch(`${baseUrl}/group-metadata/${cleanId}`, { method: "GET", headers });
          const metaData = await metaResp.json().catch(() => ({}));
          const participants = metaData?.participants || metaData?.groupMetadata?.participants || [];
          mentioned = participants
            .map((p: any) => String(p?.phone || p?.id || "").replace(/\D/g, ""))
            .filter((n: string) => n && n.length >= 10);
        } catch (e) {
          console.error("Erro buscando participantes para mention-group:", e);
        }

        const response = await fetch(`${baseUrl}/send-text`, {
          method: "POST", headers,
          body: JSON.stringify({
            phone: cleanId,
            message,
            mentioned: mentioned.length > 0 ? mentioned : undefined,
          }),
        });
        const data = await response.json();
        return new Response(JSON.stringify({ ...data, mentionedCount: mentioned.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "leave-group": {
        const { groupId } = body;
        if (!groupId) throw new Error("groupId is required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/leave-group/${cleanId}`, { method: "GET", headers });
        const data = await response.json().catch(() => ({}));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

       case "metadata-group":
       case "group-metadata": {
         const { groupId, phone } = body;
         const targetId = groupId || phone;
         if (!targetId) throw new Error("groupId or phone is required");
         const cleanId = targetId.includes("-group") ? targetId : targetId.replace("@g.us", "-group");
         const response = await fetch(`${baseUrl}/group-metadata/${cleanId}`, { method: "GET", headers });
         const data = await response.json().catch(() => ({}));
         return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
       }

      case "light-group-metadata": {
        const { groupId } = body;
        if (!groupId) throw new Error("groupId is required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/light-group-metadata/${cleanId}`, { method: "GET", headers });
        const data = await response.json().catch(() => ({}));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "group-invitation-metadata": {
        const { url, code } = body;
        const inviteCode = code || (url ? String(url).split("/").pop() : "");
        if (!inviteCode) throw new Error("url or code is required");
        const response = await fetch(`${baseUrl}/group-invitation-metadata/${inviteCode}`, { method: "GET", headers });
        const data = await response.json().catch(() => ({}));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update-group-settings": {
        const { groupId, ...rest } = body;
        if (!groupId) throw new Error("groupId is required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const allowed = [
          "adminOnlyMessage",
          "adminOnlySettings",
          "requireAdminApproval",
          "adminOnlyAddMember",
        ];
        const payload: Record<string, unknown> = { phone: cleanId };
        for (const key of allowed) {
          if (typeof rest[key] === "boolean") payload[key] = rest[key];
        }
        const response = await fetch(`${baseUrl}/update-group-settings`, {
          method: "POST", headers, body: JSON.stringify(payload),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "redefine-invitation-link": {
        const { groupId } = body;
        if (!groupId) throw new Error("groupId is required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/redefine-invitation-link/${cleanId}`, { method: "PUT", headers });
        const data = await response.json().catch(() => ({}));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get-invitation-link":
      case "get-invite-link-v2": {
        const { groupId } = body;
        if (!groupId) throw new Error("groupId is required");
        const cleanId = groupId.includes("-group") ? groupId : groupId.replace("@g.us", "-group");
        const response = await fetch(`${baseUrl}/group-invitation-link/${cleanId}`, { method: "GET", headers });
        const data = await response.json().catch(() => ({}));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "accept-group-invite": {
        const { url, code } = body;
        const inviteCode = code || (url ? String(url).split("/").pop() : "");
        if (!inviteCode) throw new Error("url or code is required");
        const response = await fetch(`${baseUrl}/accept-group-invite/${inviteCode}`, { method: "GET", headers });
        const data = await response.json().catch(() => ({}));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get-groups": {
        const response = await fetch(`${baseUrl}/groups`, { method: "GET", headers });
        const data = await response.json().catch(() => ([]));
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
