import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

const normalizeTimestamp = (value: unknown) => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return new Date().toISOString();
  const ms = raw < 4102444800 ? raw * 1000 : raw;
  const parsed = new Date(ms);
  return parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100
    ? parsed.toISOString()
    : new Date().toISOString();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const maxChats = Math.min(Math.max(Number(body?.maxChats) || 50, 1), 200);

    // Allow caller to specify a specific instance to sync
    let instanceId = "";
    let token = "";
    let clientToken = "";
    let apiProvider = 'zapi';
    let uazapiUrl: string | null = null;
    let uazapiToken: string | null = null;
    const userId = user.id;

    if (body?.instanceId) {
      const { data: specificInstance } = await adminClient
        .from("zapi_instances")
        .select("id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .or(`id.eq.${body.instanceId},zapi_instance_id.eq.${body.instanceId}`)
        .maybeSingle();

      if (specificInstance) {
        instanceId = specificInstance.zapi_instance_id;
        token = specificInstance.zapi_token;
        clientToken = specificInstance.zapi_client_token;
        apiProvider = specificInstance.api_provider || 'zapi';
        uazapiUrl = specificInstance.evolution_api_url || null;
        uazapiToken = specificInstance.evolution_api_key || null;
        console.log(`📌 Using specific instance: ${instanceId}`);
      }
    }

    if (!body?.instanceId) {
      const { data: activeInstance } = await adminClient
        .from("zapi_instances")
        .select("id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (activeInstance) {
        instanceId = activeInstance.zapi_instance_id;
        token = activeInstance.zapi_token;
        clientToken = activeInstance.zapi_client_token;
        apiProvider = activeInstance.api_provider || 'zapi';
        uazapiUrl = activeInstance.evolution_api_url || null;
        uazapiToken = activeInstance.evolution_api_key || null;
        console.log(`📌 Using active instance fallback: ${instanceId} (${apiProvider})`);
      } else {
        const fallbackCredentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
        instanceId = fallbackCredentials.instanceId;
        token = fallbackCredentials.token;
        clientToken = fallbackCredentials.clientToken;
        console.log(`📌 Using legacy credentials fallback: ${instanceId}`);
      }
    }

    if (!instanceId && apiProvider !== 'uazapi') {
      throw new Error('Instância não encontrada para sincronização');
    }

    console.log(`📱 Syncing contacts for user: ${userId}, instance: ${instanceId || body?.instanceId}`);

    // Fetch all chats with pagination (this works in multi-device)
    let allChats: any[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore && allChats.length < maxChats) {
      let chats: any[] = [];

      if (apiProvider === 'uazapi') {
        const apiUrl = (uazapiUrl || '').replace(/\/+$/, '');
        const apiToken = uazapiToken || '';
        if (!apiUrl || !apiToken) {
          throw new Error('UAZAPI URL/Token não configurados');
        }

        const chatsResponse = await fetch(`${apiUrl}/chat/find`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            token: apiToken,
          },
          body: JSON.stringify({
            limit: Math.min(pageSize, Math.max(maxChats, pageSize)),
            offset: (page - 1) * pageSize,
            sort: '-wa_lastMsgTimestamp',
          }),
        });

        const rawText = await chatsResponse.text();
        let chatsPayload: any = {};
        try { chatsPayload = JSON.parse(rawText); } catch { chatsPayload = { message: rawText }; }

        if (!chatsResponse.ok) {
          console.error(`❌ UAZAPI chats error: ${chatsResponse.status} - ${rawText}`);
          if (String(rawText).toLowerCase().includes('disconnect') || String(rawText).toLowerCase().includes('not connected')) {
            return new Response(
              JSON.stringify({ success: false, error: 'disconnected', message: 'Instância WhatsApp desconectada.' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
          throw new Error(`UAZAPI chats error: ${chatsResponse.status}`);
        }

        chats = Array.isArray(chatsPayload?.chats) ? chatsPayload.chats : [];
      } else {
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
          if (chatsResponse.status === 400 && errorText.toLowerCase().includes("connected")) {
            return new Response(
              JSON.stringify({ success: false, error: "disconnected", message: "Instância WhatsApp desconectada." }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          throw new Error(`Z-API chats error: ${chatsResponse.status}`);
        }

        const chatsPayload = await chatsResponse.json();
        chats = Array.isArray(chatsPayload) ? chatsPayload : [];
      }

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
      .eq("user_id", userId);

    const existingMap = new Map<string, { name: string; profile_picture_url: string | null }>();
    (existingContacts || []).forEach((c: any) => {
      existingMap.set(c.phone, { name: c.name, profile_picture_url: c.profile_picture_url });
    });

    const contactsToUpsert: any[] = [];

    for (const chat of allChats) {
      const phone = String(chat?.phone || chat?.wa_chatid || "").trim();
      if (!phone) continue;

      const chatName = chat?.name || chat?.wa_contactName || chat?.wa_name || chat?.contact || chat?.contact_name || chat?.contactName || "";
      const profilePic = chat?.profileThumbnail || chat?.imagePreview || chat?.image || null;
      const isGroup = chat?.isGroup === true || chat?.wa_isGroup === true || phone.includes("-group") || phone.includes("@g.us");

      // Skip groups for contact saving
      if (isGroup) continue;

      const existing = existingMap.get(phone);

      // Only upsert if we have new info or contact doesn't exist yet
      if (!existing) {
        contactsToUpsert.push({
          phone,
          name: chatName,
          user_id: userId,
          profile_picture_url: profilePic,
        });
        importedContacts++;
      } else if (!existing.name && chatName) {
        // Update name if existing contact has no name
        contactsToUpsert.push({
          phone,
          name: chatName,
          user_id: userId,
          profile_picture_url: existing.profile_picture_url || profilePic,
        });
        importedContacts++;
      } else if (!existing.profile_picture_url && profilePic) {
        // Update photo if existing contact has no photo
        contactsToUpsert.push({
          phone,
          name: existing.name,
          user_id: userId,
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
      .eq("user_id", userId);

    const existingPhoneSet = new Set((existingPhones || []).map((r: any) => r.phone));
    
    const placeholderRows: any[] = [];
    const groupContactsToUpsert: any[] = [];
    const apiUrlClean = (uazapiUrl || '').replace(/\/+$/, '');

    const isUsableImportedGroupName = (value: unknown) => {
      const normalized = String(value || '').trim();
      if (!normalized) return false;
      if (/^\d+$/.test(normalized.replace(/\s+/g, ''))) return false;
      if (/^(grupo|grupo sem nome|conversa com grupo)$/i.test(normalized)) return false;
      if (/^conversa com\s+grupo$/i.test(normalized)) return false;
      return true;
    };

    // Helper: fetch group name via UAZAPI /group/info
    const fetchUazapiGroupName = async (groupjid: string): Promise<{ name: string; pic: string | null }> => {
      if (apiProvider !== 'uazapi' || !apiUrlClean || !uazapiToken) return { name: '', pic: null };
      try {
        const gRes = await fetch(`${apiUrlClean}/group/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', token: uazapiToken },
          body: JSON.stringify({ groupjid }),
        });
        if (!gRes.ok) return { name: '', pic: null };
        const g = await gRes.json();
        const name = g?.subject || g?.name || g?.group?.subject || g?.group?.name
          || g?.groupMetadata?.subject || g?.data?.subject || '';
        const pic = g?.imageUrl || g?.picture || g?.profilePicUrl || g?.group?.imageUrl || null;
        return { name: String(name || ''), pic: pic || null };
      } catch (e) {
        console.error('UAZAPI group/info failed:', e);
        return { name: '', pic: null };
      }
    };

    for (const chat of allChats) {
      // For UAZAPI, group chats have wa_chatid = "<id>@g.us"; use it as the phone identifier
      const rawId = String(chat?.phone || chat?.wa_chatid || chat?.id || "").trim();
      if (!rawId) continue;
      const isGroup = chat?.isGroup === true || chat?.wa_isGroup === true || rawId.includes("-group") || rawId.includes("@g.us");
      const phone = isGroup
        ? rawId.replace("@g.us", "").replace(/\D/g, "") + "-group"
        : rawId.replace("@c.us", "").replace("@s.whatsapp.net", "").replace(/\D/g, "");
      if (!phone) continue;

      const lastMessageTime = normalizeTimestamp(chat.lastMessageTime || chat.wa_lastMsgTimestamp);

      let chatName = chat?.name
        || chat?.wa_contactName
        || chat?.wa_name
        || chat?.wa_chatName
        || chat?.subject
        || chat?.groupSubject
        || chat?.groupName
        || "";

      let chatPic = chat?.imagePreview || chat?.profileThumbnail || chat?.image || null;

      // For UAZAPI groups, fetch /group/info whenever the current label is not a real group name
      const needsResolvedGroupName = isGroup && !isUsableImportedGroupName(chatName);
      if (apiProvider === 'uazapi' && needsResolvedGroupName) {
        const info = await fetchUazapiGroupName(rawId);
        if (isUsableImportedGroupName(info.name)) chatName = info.name;
        if (info.pic) chatPic = info.pic;
      }

      // Insert placeholder log only if no message exists yet for this chat
      if (!existingPhoneSet.has(phone)) {
        placeholderRows.push({
          phone,
          user_id: userId,
          timestamp: lastMessageTime,
            message_received: `💬 Conversa com ${isUsableImportedGroupName(chatName) ? chatName : (isGroup ? 'Grupo' : phone)}`,
          response_sent: null,
          keyword_matched: "__history_import__",
          instance_id: instanceId,
        });
      }

      // Always upsert group name so the chat list shows the friendly name (even for existing chats)
      if (isGroup && isUsableImportedGroupName(chatName)) {
        groupContactsToUpsert.push({
          phone,
          name: chatName,
          user_id: userId,
          profile_picture_url: chatPic,
        });
      }
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

    // Upsert group names into saved_contacts so chat list shows the group name
    if (groupContactsToUpsert.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < groupContactsToUpsert.length; i += batchSize) {
        const batch = groupContactsToUpsert.slice(i, i + batchSize);
        const { error: gErr } = await adminClient
          .from("saved_contacts")
          .upsert(batch, { onConflict: "user_id,phone" });
        if (gErr) console.error(`❌ Error upserting group names:`, gErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        importedContacts,
        importedChats,
        importedMessages: importedChats,
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
