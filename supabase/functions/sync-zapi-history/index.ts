import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { corsHeaders } from "../_shared/cors.ts";
import { getUserZAPICredentials } from "../_shared/user-credentials.ts";

const normalizeTimestamp = (value: unknown) => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return new Date().toISOString();
  const ms = raw < 4102444800 ? raw * 1000 : raw;
  const parsed = new Date(ms);
  return (parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100 ? parsed : new Date())
    .toISOString()
    .replace('T', ' ')
    .split('.')[0];
};

const sanitizeProfilePictureUrl = (value: unknown): string | null => {
  const str = String(value || "").trim();
  if (!str) return null;
  const lower = str.toLowerCase();
  if (["null", "undefined", "false"].includes(lower)) return null;
  if (!/^https?:\/\//i.test(str) && !str.startsWith("data:")) return null;
  return str;
};

const extractProfilePictureUrl = (source: any): string | null => sanitizeProfilePictureUrl(
  source?.profileThumbnail ||
  source?.imagePreview ||
  source?.imgUrl ||
  source?.profilePictureUrl ||
  source?.profilePicUrl ||
  source?.profilePicture ||
  source?.picture ||
  source?.imageUrl ||
  source?.image ||
  source?.photo ||
  source?.groupPhoto ||
  source?.chat?.imagePreview ||
  source?.chat?.image ||
  source?.chat?.imgUrl ||
  source?.group?.image ||
  source?.group?.picture ||
  source?.data?.imagePreview ||
  source?.data?.image ||
  source?.data?.imgUrl
);

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
    const userId = user.id;

    // If it's a Meta instance, we return success but skipped, as Meta doesn't support chat listing
    if (body?.instanceId?.startsWith('meta:')) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: "A API oficial da Meta sincroniza mensagens automaticamente via webhook.",
          importedContacts: 0,
          importedChats: 0,
          totalChatsRead: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body?.instanceId) {
      const { data: specificInstance } = await adminClient
        .from("zapi_instances")
        .select("id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key")
        .eq("user_id", user.id)
        .or(`id.eq.${body.instanceId},zapi_instance_id.eq.${body.instanceId}`)
        .maybeSingle();

      if (specificInstance) {
        instanceId = specificInstance.zapi_instance_id;
        token = specificInstance.zapi_token;
        clientToken = specificInstance.zapi_client_token;
        apiProvider = specificInstance.api_provider || 'zapi';
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
        console.log(`📌 Using active instance fallback: ${instanceId} (${apiProvider})`);
      } else {
        const fallbackCredentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey);
        instanceId = fallbackCredentials.instanceId;
        token = fallbackCredentials.token;
        clientToken = fallbackCredentials.clientToken;
        console.log(`📌 Using legacy credentials fallback: ${instanceId}`);
      }
    }

    if (!instanceId) {
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

    for (let i = 0; i < allChats.length; i++) {
      const chat = allChats[i];
      const phone = String(chat?.phone || chat?.wa_chatid || "").trim();
      if (!phone) continue;

      const chatName = chat?.name || chat?.wa_contactName || chat?.wa_name || chat?.contact || chat?.contact_name || chat?.contactName || "";
      let profilePic = extractProfilePictureUrl(chat);
      const isGroup = chat?.isGroup === true || chat?.wa_isGroup === true || phone.includes("-group") || phone.includes("@g.us");

      // Skip groups for contact saving
      if (isGroup) continue;

      const existingContact = existingMap.get(phone);
      const existingPhoto = sanitizeProfilePictureUrl(existingContact?.profile_picture_url);

      // Fallback: If no photo is found in chat metadata, try to fetch it dynamically
      if (!profilePic && !existingPhoto) {
        try {
          // Limit dynamic fetching to avoid rate limits during sync
          if (i < 20) {
            const { data: picData, error: picError } = await adminClient.functions.invoke('get-profile-picture', {
              body: { phone, instanceId }
            });
            if (!picError && picData?.success && picData?.data?.link) {
              profilePic = picData.data.link;
              console.log(`📸 Foto de perfil recuperada dinamicamente para ${phone} durante sincronização`);
            }
          }
        } catch (e) {
          console.error(`⚠️ Erro ao buscar foto dinâmica durante sync para ${phone}:`, e);
        }
      }

      // Only upsert if we have new info or contact doesn't exist yet
      if (!existingContact) {
        contactsToUpsert.push({
          phone,
          name: chatName,
          user_id: userId,
          profile_picture_url: profilePic,
        });
        importedContacts++;
      } else if (!existingContact.name && chatName) {
        // Update name if existing contact has no name
        contactsToUpsert.push({
          phone,
          name: chatName,
          user_id: userId,
          profile_picture_url: existingPhoto || profilePic,
        });
        importedContacts++;
      } else if (!existingPhoto && profilePic) {
        // Update photo if existing contact has no photo
        contactsToUpsert.push({
          phone,
          name: existingContact.name,
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
      .select("id, phone, timestamp, keyword_matched")
      .eq("user_id", userId);

    const existingPhoneSet = new Set((existingPhones || []).map((r: any) => r.phone));
    const latestLocalTimestampByPhone = new Map<string, string>();
    (existingPhones || []).forEach((r: any) => {
      const current = latestLocalTimestampByPhone.get(r.phone);
      if (!current || new Date(r.timestamp).getTime() > new Date(current).getTime()) {
        latestLocalTimestampByPhone.set(r.phone, r.timestamp);
      }
    });
    const placeholderRows: any[] = [];
    const groupContactsToUpsert: any[] = [];

    const isUsableImportedGroupName = (value: unknown) => {
      const normalized = String(value || '').trim();
      if (!normalized) return false;
      if (/^\d+$/.test(normalized.replace(/\s+/g, ''))) return false;
      if (/^(grupo|grupo sem nome|conversa com grupo)$/i.test(normalized)) return false;
      if (/^conversa com\s+grupo$/i.test(normalized)) return false;
      return true;
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

      let chatPic = extractProfilePictureUrl(chat);

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
        const existing = existingMap.get(phone);
        groupContactsToUpsert.push({
          phone,
          name: chatName,
          user_id: userId,
          profile_picture_url: chatPic || sanitizeProfilePictureUrl(existing?.profile_picture_url),
        });
      } else if (isGroup) {
        // Sem nome utilizável: tenta resolver nome do contato existente para preservá-lo
        const existing = existingMap.get(phone);
        if (existing && isUsableImportedGroupName(existing.name)) {
          // Já temos um nome bom salvo; nada a fazer
        }
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

      // Atualiza placeholders antigos ("Conversa com Grupo") para refletir o nome resolvido
      for (const g of groupContactsToUpsert) {
        try {
          await adminClient
            .from('message_logs')
            .update({ message_received: `💬 Conversa com ${g.name}` })
            .eq('user_id', userId)
            .eq('phone', g.phone)
            .eq('keyword_matched', '__history_import__');
        } catch (e) {
          console.error('Failed to refresh placeholder for', g.phone, e);
        }
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
