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
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const maxChats = Math.min(Math.max(Number(body?.maxChats) || 50, 1), 200);

    // Allow caller to specify a specific instance to sync
    let instanceId = credentials.instanceId;
    let token = credentials.token;
    let clientToken = credentials.clientToken;

    if (body?.instanceId) {
      const { data: specificInstance } = await adminClient
        .from("zapi_instances")
        .select("zapi_instance_id, zapi_token, zapi_client_token")
        .eq("zapi_instance_id", body.instanceId)
        .eq("user_id", credentials.userId)
        .eq("is_active", true)
        .maybeSingle();

      if (specificInstance) {
        instanceId = specificInstance.zapi_instance_id;
        token = specificInstance.zapi_token;
        clientToken = specificInstance.zapi_client_token;
        console.log(`📌 Using specific instance: ${instanceId}`);
      }
    }

    console.log(`📱 Syncing contacts for user: ${credentials.userId}, instance: ${instanceId}`);

    // Fetch all chats with pagination (this works in multi-device)
    let allChats: any[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore && allChats.length < maxChats) {
      const chatsUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/chats?page=${page}&pageSize=${pageSize}`;

      const chatsResponse = await fetch(chatsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
      });

      if (!chatsResponse.ok) {
        const errorText = await chatsResponse.text();
        console.error(`❌ Z-API chats error: ${chatsResponse.status} - ${errorText}`);
        throw new Error(`Z-API chats error: ${chatsResponse.status}`);
      }

      const chatsPayload = await chatsResponse.json();
      const chats = Array.isArray(chatsPayload) ? chatsPayload : [];

      console.log(`📄 Page ${page}: ${chats.length} chats`);
      allChats = [...allChats, ...chats];

      hasMore = chats.length === pageSize;
      page++;
      if (page > 10) break;
    }

    console.log(`📋 Total chats found: ${allChats.length}`);

    // Save contacts from chat list into saved_contacts
    let importedContacts = 0;
    let skippedContacts = 0;

    // Get existing saved contacts to avoid overwriting user-set names
    const { data: existingContacts } = await adminClient
      .from("saved_contacts")
      .select("phone, name, profile_picture_url")
      .eq("user_id", credentials.userId);

    const existingMap = new Map<string, { name: string; profile_picture_url: string | null }>();
    (existingContacts || []).forEach((c: any) => {
      existingMap.set(c.phone, { name: c.name, profile_picture_url: c.profile_picture_url });
    });

    const contactsToUpsert: any[] = [];

    for (const chat of allChats) {
      const phone = String(chat?.phone || "").trim();
      if (!phone) continue;

      const chatName = chat?.name || chat?.contact || "";
      const profilePic = chat?.profileThumbnail || null;
      const isGroup = chat?.isGroup === true || phone.includes("-group") || phone.includes("@g.us");

      // Skip groups for contact saving
      if (isGroup) continue;

      const existing = existingMap.get(phone);

      // Only upsert if we have new info or contact doesn't exist yet
      if (!existing) {
        contactsToUpsert.push({
          phone,
          name: chatName,
          user_id: credentials.userId,
          profile_picture_url: profilePic,
        });
        importedContacts++;
      } else if (!existing.name && chatName) {
        // Update name if existing contact has no name
        contactsToUpsert.push({
          phone,
          name: chatName,
          user_id: credentials.userId,
          profile_picture_url: existing.profile_picture_url || profilePic,
        });
        importedContacts++;
      } else if (!existing.profile_picture_url && profilePic) {
        // Update photo if existing contact has no photo
        contactsToUpsert.push({
          phone,
          name: existing.name,
          user_id: credentials.userId,
          profile_picture_url: profilePic,
        });
        importedContacts++;
      } else {
        skippedContacts++;
      }
    }

    // Batch upsert contacts
    if (contactsToUpsert.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < contactsToUpsert.length; i += batchSize) {
        const batch = contactsToUpsert.slice(i, i + batchSize);
        const { error: upsertError } = await adminClient
          .from("saved_contacts")
          .upsert(batch, { onConflict: "user_id,phone" });

        if (upsertError) {
          console.error(`❌ Error upserting contacts batch:`, upsertError);
        }
      }
    }

    // Also create a placeholder message_log entry for each chat so conversations appear in the chat list
    const { data: existingPhones } = await adminClient
      .from("message_logs")
      .select("phone")
      .eq("user_id", credentials.userId);

    const existingPhoneSet = new Set((existingPhones || []).map((r: any) => r.phone));
    
    const placeholderRows: any[] = [];
    for (const chat of allChats) {
      const phone = String(chat?.phone || "").trim();
      if (!phone || existingPhoneSet.has(phone)) continue;

      const lastMessageTime = chat?.lastMessageTime 
        ? new Date(Number(chat.lastMessageTime) * 1000).toISOString() 
        : new Date().toISOString();

      const chatName = chat?.name || "";

      placeholderRows.push({
        phone,
        user_id: credentials.userId,
        timestamp: lastMessageTime,
        message_received: `💬 Conversa com ${chatName || phone}`,
        response_sent: null,
        keyword_matched: "__history_import__",
        instance_id: instanceId,
      });
    }

    let importedChats = 0;
    if (placeholderRows.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < placeholderRows.length; i += batchSize) {
        const batch = placeholderRows.slice(i, i + batchSize);
        const { error: insertError } = await adminClient
          .from("message_logs")
          .insert(batch);

        if (insertError) {
          console.error(`❌ Error inserting placeholder messages:`, insertError);
        } else {
          importedChats += batch.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        importedContacts,
        importedChats,
        skippedContacts,
        totalChatsRead: allChats.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Error syncing history:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
