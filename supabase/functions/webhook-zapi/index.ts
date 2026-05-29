import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FlowNode {
  id: string;
  type: string;
  data: {
    content?: string;
    contentType?: string;
    mediaUrl?: string;
    buttons?: Array<{ text: string; type: string; value: string }>;
    collectName?: boolean;
    collectWhatsapp?: boolean;
    collectEmail?: boolean;
    [key: string]: any;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

const FLOW_CAPTURE_PREFIX = "__flow_capture__:";
const FLOW_BUTTON_PREFIX = "__flow_button__:";

function normalizeForMatch(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isKeywordMatch(message: string, keyword: string): boolean {
  const normalizedKeyword = normalizeForMatch(keyword);
  if (!normalizedKeyword || !message) return false;
  const normalizedMessage = normalizeForMatch(message);
  return normalizedMessage.includes(normalizedKeyword);
}

function getCaptureHandle(field: string) {
  if (field === "nome") return "collect-name";
  if (field === "email") return "collect-email";
  if (field === "whatsapp") return "collect-whatsapp";
  return `collect-${field}`;
}

// Transcreve áudio (URL) usando OpenAI Whisper. Retorna string vazia em falha.
async function transcribeAudioUrl(audioUrl: string): Promise<string> {
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey || !audioUrl) return "";
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      console.error("[transcribeAudioUrl] download falhou:", audioRes.status);
      return "";
    }
    const audioBuf = await audioRes.arrayBuffer();
    const blob = new Blob([audioBuf], { type: audioRes.headers.get("content-type") || "audio/ogg" });
    const form = new FormData();
    form.append("file", blob, "audio.ogg");
    form.append("model", "whisper-1");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!r.ok) {
      console.error("[transcribeAudioUrl] whisper falhou:", r.status, await r.text());
      return "";
    }
    const data = await r.json();
    return String(data?.text || "").trim();
  } catch (e) {
    console.error("[transcribeAudioUrl] erro:", e);
    return "";
  }
}

function getIncomingAudioUrl(webhook: any): string {
  return String(
    webhook?.audio?.audioUrl ||
      webhook?.audio?.url ||
      webhook?.audio?.mediaUrl ||
      webhook?.audio?.fileUrl ||
      webhook?.audio?.downloadUrl ||
      webhook?.audioUrl ||
      webhook?.mediaUrl ||
      "",
  );
}

async function resolveAgentInboundText(messageRaw: string, audioUrl: string): Promise<string> {
  if (!audioUrl) return messageRaw || "";
  const transcript = await transcribeAudioUrl(audioUrl);
  if (transcript) {
    console.log(`[AI Agent] Áudio transcrito (${transcript.length} chars): ${transcript.slice(0, 120)}`);
    return transcript;
  }
  console.warn("[AI Agent] Falha ao transcrever áudio; seguindo sem transcrição.");
  const fallbackText = String(messageRaw || "")
    .replace(/\[media:audio:[^\]]+\]/gi, "")
    .trim();
  return fallbackText || "[áudio recebido]";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const webhook = await req.json();
    console.log("Webhook Z-API:", JSON.stringify(webhook).slice(0, 500));

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const isGroup = webhook?.isGroup === true || webhook?.isGroup === "true";
    const participantPhone =
      webhook?.participantPhone || webhook?.participant || webhook?.senderPhone || webhook?.sender?.phone || "";
    let chatId = webhook?.phone || webhook?.chatPhone || "";

    if (isGroup || chatId.includes("@g.us")) {
      const rawId = chatId.replace(/@g\.us$/i, "").replace(/-group$/i, "");
      if (rawId) {
        chatId = `${rawId}-group`;
      }
    }

    const phone = isGroup && participantPhone ? participantPhone : chatId;
    const instanceId = webhook?.instanceId || "";

    const type =
      webhook?.type ||
      webhook?.notification ||
      (webhook?.buttonsResponseMessage || webhook?.buttonReply ? "ButtonsResponseMessage" : "");
    const messageId = webhook?.messageId || (webhook?.ids && webhook.ids[0]) || "";

    if (
      type === "PresenceChatCallback" ||
      type === "PresenceCallback" ||
      type === "ChatPresenceCallback" ||
      webhook?.status === "AVAILABLE" ||
      webhook?.status === "UNAVAILABLE" ||
      webhook?.status === "COMPOSING" ||
      webhook?.status === "RECORDING"
    ) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Processamento de Webhooks de Dispositivo (Conexão/Desconexão)
    if (
      type === "ConnectedCallback" ||
      type === "DisconnectedCallback" ||
      type === "ReconnectedCallback" ||
      webhook?.instanceStatus === "CONNECTED" ||
      webhook?.instanceStatus === "DISCONNECTED" ||
      webhook?.instanceStatus === "RECONNECTED"
    ) {
      console.log(`📱 Device Webhook (${type}): instance=${instanceId}, status=${webhook?.instanceStatus || type}`);
      
      const isConnected = 
        type === "ConnectedCallback" || 
        type === "ReconnectedCallback" || 
        webhook?.instanceStatus === "CONNECTED" ||
        webhook?.instanceStatus === "RECONNECTED";

      const connectedPhone = webhook?.connectedPhone || webhook?.phone || "";
      const reason = webhook?.reason || webhook?.errorMessage || "";
      const isShadowBanReason = String(reason).toLowerCase().includes("shadow ban") || 
                               String(reason).toLowerCase().includes("banido") ||
                               String(reason).toLowerCase().includes("banned");

      if (instanceId) {
        const updatePayload: any = {
          is_active: isConnected,
          updated_at: new Date().toISOString(),
        };

        const { data: instanceBefore, error: fetchError } = await supabase
          .from("zapi_instances")
          .select("id")
          .or(`zapi_instance_id.eq.${instanceId},id.eq.${instanceId}`)
          .maybeSingle();

        const { error: updateError } = await supabase
          .from("zapi_instances")
          .update(updatePayload)
          .or(`zapi_instance_id.eq.${instanceId},id.eq.${instanceId}`);

        if (updateError) {
          console.error(`❌ Error updating instance ${instanceId} status:`, updateError.message);
        } else {
          console.log(`✅ Instance ${instanceId} updated to ${isConnected ? "ACTIVE" : "INACTIVE"}`);
          
          // Se desconectou ou detectou banimento, registrar na saúde da instância
          if ((!isConnected || isShadowBanReason) && instanceBefore?.id) {
            await supabase.from("warmup_instance_health").insert({
              instance_ref: instanceBefore.id,
              phone: connectedPhone || "",
              block_type: isShadowBanReason ? "shadowban" : "disconnected",
              detail: isShadowBanReason ? `Banimento detectado via webhook: ${reason}` : `Desconectado via webhook: ${type}`,
              last_detected_at: new Date().toISOString()
            });
            
            if (isShadowBanReason) {
              await supabase.from("zapi_instances").update({ is_active: false }).eq("id", instanceBefore.id);
            }
          }
        }
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const isMessage =
      !type ||
      type === "OnMessage" ||
      type === "MessageCallback" ||
      type === "OnText" ||
      type === "ReceivedCallback" ||
      type === "ButtonsResponseMessage" ||
      type === "ButtonReply" ||
      type === "ListResponseMessage" ||
      type === "ImageCallback" ||
      type === "VideoCallback" ||
      type === "AudioCallback" ||
      type === "StickerCallback" ||
      type === "DocumentCallback";

    const isButtonResponse =
      type === "ButtonsResponseMessage" ||
      type === "ButtonReply" ||
      type === "ListResponseMessage" ||
      !!webhook?.buttonsResponseMessage ||
      !!webhook?.buttonResponseMessage ||
      !!webhook?.buttonReply ||
      !!webhook?.listResponseMessage;

    const senderName = webhook?.senderName || webhook?.sender?.name || "";
    const senderPhoto = webhook?.photo || webhook?.sender?.photo || "";
    const senderPhone = participantPhone;

    let messageRaw =
      webhook?.buttonsResponseMessage?.message ||
      webhook?.buttonsResponseMessage?.buttonText ||
      webhook?.buttonsResponseMessage?.buttonId ||
      webhook?.buttonResponseMessage?.message ||
      webhook?.buttonResponseMessage?.buttonText ||
      webhook?.buttonResponseMessage?.selectedButtonId ||
      webhook?.buttonReply?.text ||
      webhook?.buttonReply?.buttonId ||
      webhook?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      webhook?.listResponseMessage?.title ||
      webhook?.listResponseMessage?.actionLabel ||
      webhook?.listResponseMessage?.description ||
      webhook?.text?.message ||
      webhook?.message?.text ||
      webhook?.text ||
      webhook?.interactiveResponseMessage?.body ||
      "";

    const incomingAudioUrl = getIncomingAudioUrl(webhook);
    const mediaUrl =
      webhook?.image?.url ||
      webhook?.video?.url ||
      incomingAudioUrl ||
      webhook?.sticker?.url ||
      webhook?.document?.url;
    if (mediaUrl) {
      let mediaType = "";
      if (webhook.image) mediaType = "image";
      else if (webhook.video) mediaType = "video";
      else if (webhook.audio || incomingAudioUrl) mediaType = "audio";
      else if (webhook.sticker) mediaType = "sticker";
      else if (webhook.document) mediaType = "document";

      if (mediaType) {
        const mediaTag = `[media:${mediaType}:${mediaUrl}]`;
        messageRaw = messageRaw ? `${mediaTag}\n${messageRaw}` : mediaTag;
      }
    }

    const fromMe =
      webhook?.fromMe === true ||
      webhook?.fromMe === "true" ||
      webhook?.fromApi === true ||
      webhook?.fromApi === "true";

    const { data: instanceData } = await supabase
      .from("zapi_instances")
      .select("id, user_id, zapi_instance_id, zapi_token, zapi_client_token")
      .or(`zapi_instance_id.eq.${instanceId},id.eq.${instanceId}`)
      .maybeSingle();

    const userId = instanceData?.user_id;

    const hasMedia = !!(webhook?.image || webhook?.video || webhook?.audio || webhook?.sticker || webhook?.document);
    const hasInteractive = !!(webhook?.buttonsResponseMessage || webhook?.buttonReply || webhook?.listResponseMessage || webhook?.interactiveResponseMessage);
    const hasText = !!(webhook?.text || webhook?.message?.text || messageRaw.trim().length > 0);

    const isStatusCallback =
      type === "DeliveryCallback" ||
      type === "MessageStatusCallback" ||
      type === "MessageStatus" ||
      type === "MessageCallback" ||
      type === "OnMessageSend" ||
      (!!webhook?.status && !hasText && !hasMedia && !hasInteractive);

    if (isStatusCallback) {
      const messageIds = webhook?.ids || (webhook?.messageId ? [webhook.messageId] : []);
      let status = (webhook?.status || "").toUpperCase();
      const error = webhook?.error || webhook?.errorMessage || "";

      // Se for MessageCallback (on-message-send) e o status for SENT, consideramos enviado
      if (type === "MessageCallback" || type === "OnMessageSend") {
        if (!status && !error) status = "SENT";
      }

      if (!status && type === "DeliveryCallback" && !error) {
        status = "DELIVERED";
      }

      console.log(
        `Processing StatusCallback (${type}) for messages ${messageIds.join(",")}: status=${status}, error=${error || "none"}`
      );

      const isReadStatus = ["READ", "READ_BY_ME", "PLAYED"].includes(status);
      const isDeliveredStatus = ["DELIVERED", "RECEIVED"].includes(status) || isReadStatus;
      const isSentStatus = ["SENT", "SENT_BY_ME"].includes(status);
      const isErrorStatus = (["ERROR", "FAILED", "REJECTED"].includes(status) || !!error) && !isSentStatus && !isDeliveredStatus;

      // Detectar shadowban pelos erros reais do Z-API (conforme documentação)
      const errorLower = String(error).toLowerCase();
      const isShadowBanError =
        webhook?.errorCode === "SHADOW_BAN" ||
        errorLower.includes("shadow ban") ||
        errorLower.includes("likely shadow ban") ||
        errorLower.includes("restricted") ||
        errorLower.includes("temporary limit") ||
        errorLower.includes("unauthorized") ||
        errorLower.includes("did not have permission") ||
        errorLower.includes("rejected sending") ||
        errorLower.includes("did not allow") ||
        errorLower.includes("whatsapp did not allow") ||
        errorLower.includes("whatsapp rejected") ||
        errorLower.includes("capping");

      const isInvalidPhone =
        errorLower.includes("phone number does not exist") ||
        errorLower.includes("invalid phone number") ||
        errorLower.includes("does not exist") ||
        errorLower.includes("not on whatsapp") ||
        errorLower.includes("invalid request params");

      if (messageIds.length > 0 && (isDeliveredStatus || isSentStatus)) {
        for (const msgId of messageIds) {
          const newStatusLabel = isReadStatus ? "read" : (isDeliveredStatus ? "delivered" : "sent");

          const { data: currentRecord, error: fetchError } = await supabase
            .from("campaign_sends")
            .select("status, id, phone")
            .eq("message_id", msgId)
            .maybeSingle();

          if (fetchError) {
            console.error(`❌ Error fetching campaign_send ${msgId}:`, fetchError.message);
            continue;
          }

          if (currentRecord) {
            // Se já está lida, não volta para entregue ou enviado. Se está entregue, não volta para enviado.
            const statusPriority = { "read": 3, "delivered": 2, "sent": 1, "failed": 0, "pending": 0 };
            const currentPriority = statusPriority[currentRecord.status as keyof typeof statusPriority] || 0;
            const newPriority = statusPriority[newStatusLabel as keyof typeof statusPriority] || 0;

            if (currentPriority > newPriority && currentRecord.status !== "failed") {
              console.log(`✅ Message ${msgId} is already ${currentRecord.status} (priority ${currentPriority}). Skipping update to ${newStatusLabel} (priority ${newPriority}).`);
              continue;
            }

            const updateData: any = { 
              status: newStatusLabel
            };

            // Only clear error message if it's actually delivered or sent
            if (isDeliveredStatus || isSentStatus) {
              updateData.error_message = null;
            }

            if (isReadStatus) {
              updateData.read_at = new Date().toISOString();
              if (!currentRecord.delivered_at) updateData.delivered_at = new Date().toISOString();
            } else if (isDeliveredStatus) {
              updateData.delivered_at = new Date().toISOString();
            } else {
              updateData.sent_at = new Date().toISOString();
            }

            const { data: updated, error: updateError } = await supabase
              .from("campaign_sends")
              .update(updateData)
              .eq("id", currentRecord.id)
              .select("id")
              .maybeSingle();

            if (updateError) {
              console.error(`❌ Error updating campaign_send ${currentRecord.id}:`, updateError.message);
            } else if (updated) {
              console.log(`✨ Updated campaign_send ${updated.id} to ${newStatusLabel} via message_id ${msgId}`);
              
              // Se foi entregue ou falhou, verificar se a campanha toda terminou
              if (isDeliveredStatus) {
                const { data: sendInfo } = await supabase
                  .from("campaign_sends")
                  .select("campaign_id")
                  .eq("id", updated.id)
                  .single();
                
                if (sendInfo?.campaign_id) {
                  // Verificar se ainda existem pendentes para esta campanha
                  const { count: pendingCount } = await supabase
                    .from("campaign_sends")
                    .select("id", { count: "exact", head: true })
                    .eq("campaign_id", sendInfo.campaign_id)
                    .in("status", ["pending", "sent"]);
                  
                  if (pendingCount === 0) {
                    console.log(`🏁 All messages for campaign ${sendInfo.campaign_id} are processed. Marking as completed.`);
                    await supabase
                      .from("campaigns")
                      .update({ status: "completed", updated_at: new Date().toISOString() })
                      .eq("id", sendInfo.campaign_id)
                      .in("status", ["active", "paused"]);
                  }
                }
              }
            }
          } else if (isDeliveredStatus || isSentStatus) {
            console.log(`🔍 No campaign_send found with message_id ${msgId}. Attempting fallback by phone...`);
            // Fallback: Tentar encontrar pelo telefone e status pendente/enviado recentemente
            const cleanPhone = String(phone || "").replace(/\D/g, "");
            const lidVariant = String(phone || "").toLowerCase().includes("@lid") ? phone : null;
            
            let query = supabase
              .from("campaign_sends")
              .select("id, status")
              .neq("status", "read"); // Se já está lida, não precisa fallback

            if (lidVariant) {
              query = query.eq("phone", lidVariant);
            } else {
              query = query.ilike("phone", `%${cleanPhone}%`);
            }

            const { data: fallbackRecord } = await query
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (fallbackRecord) {
              console.log(`🎯 Fallback found record ${fallbackRecord.id} (status: ${fallbackRecord.status}) for phone ${phone}. Updating...`);
              const updateData: any = { 
                status: newStatusLabel,
                message_id: msgId, // Aproveita para salvar o ID que estava faltando
                error_message: null
              };
              if (isReadStatus) {
                updateData.read_at = new Date().toISOString();
                updateData.delivered_at = new Date().toISOString();
              } else if (isDeliveredStatus) {
                updateData.delivered_at = new Date().toISOString();
              } else {
                updateData.sent_at = new Date().toISOString();
              }

              await supabase.from("campaign_sends").update(updateData).eq("id", fallbackRecord.id);
            }
          }
        }
      } else if (messageIds.length > 0 && isErrorStatus) {
        // Se detectamos shadowban, atualizar saúde da instância
        if (isShadowBanError && instanceData?.id) {
          console.log(`🛡️ Shadowban detected for instance ${instanceData.id}. Updating health table.`);
          await supabase.from("warmup_instance_health").insert({
            instance_ref: instanceData.id,
            phone: "",
            block_type: "shadowban",
            detail: `Detectado via erro de envio: ${error || status}`,
            last_detected_at: new Date().toISOString()
          });

          // Desativar a instância para evitar mais reijeições
          await supabase.from("zapi_instances")
            .update({ is_active: false })
            .eq("id", instanceData.id);
        }

        for (const msgId of messageIds) {
          let finalErrorMessage = error || status || "Erro desconhecido";
          let finalStatus = "failed";

          if (isShadowBanError) {
            finalErrorMessage = "Shadow Ban: número com restrição de envio. Mensagem não entregue.";
          } else if (isInvalidPhone) {
            finalErrorMessage = "Número inválido ou não cadastrado no WhatsApp.";
          } else if (errorLower.includes("media url") || errorLower.includes("media format")) {
            finalErrorMessage = "Erro na URL da mídia informada.";
          } else if (errorLower.includes("timeout")) {
            finalErrorMessage = "Tempo de envio expirado (instabilidade).";
          }

          console.log(`❌ Message ${msgId} failed: ${finalErrorMessage}`);

          // Busca pelo message_id para encontrar o registro
          const { data: record } = await supabase
            .from("campaign_sends")
            .select("id, status")
            .eq("message_id", msgId)
            .maybeSingle();

          if (record) {
            if (record.status === "delivered") {
              console.log(`⚠️ Record ${record.id} already marked as delivered. Ignoring error callback.`);
              continue;
            }

            const { error: updateError } = await supabase
              .from("campaign_sends")
              .update({
                status: "failed",
                error_message: finalErrorMessage,
              })
              .eq("id", record.id);

            if (updateError) {
              console.error(`❌ Error marking campaign_send ${record.id} as failed:`, updateError.message);
            } else {
              console.log(
                `❌ Campaign send ${record.id} marcado como falha via ${type}: ${finalErrorMessage}`,
              );
            }
          } else {
            // Fallback: tenta pelo message_id direto
            await supabase
              .from("campaign_sends")
              .update({
                status: "failed",
                error_message: finalErrorMessage,
              })
              .eq("message_id", msgId)
              .neq("status", "delivered");

            console.log(`❌ Fallback: marcou falha para message_id ${msgId}: ${finalErrorMessage}`);
          }
        }
      }

      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (!phone || !instanceId || !isMessage || (fromMe && !isButtonResponse && !webhook?.__manual_flow_trigger__)) {
      if (isMessage && fromMe && !isButtonResponse && userId) {
        const { data: existingLog } = await supabase
          .from("message_logs")
          .select("id")
          .eq("user_id", userId)
          .eq("phone", chatId)
          .eq("message_id", messageId)
          .maybeSingle();

        if (!existingLog) {
          await supabase.from("message_logs").insert({
            user_id: userId,
            phone: chatId,
            instance_id: instanceId,
            timestamp: new Date().toISOString(),
            message_received: null,
            response_sent: messageRaw,
            keyword_matched: "__manual_send__",
            message_id: messageId,
          });
        }
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (messageId && userId) {
      const { data: existingInbound } = await supabase
        .from("message_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("message_id", messageId)
        .maybeSingle();

      if (existingInbound) {
        console.log(`[Idempotency] Message ${messageId} already processed. Skipping.`);
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
    }

    const agentInboundText = incomingAudioUrl
      ? await resolveAgentInboundText(messageRaw || "", incomingAudioUrl)
      : messageRaw;
    const displayInboundMessage = incomingAudioUrl
      ? `[media:audio:${incomingAudioUrl}]\n🎙️ ${agentInboundText || "[áudio recebido]"}`
      : messageRaw;
    const normalizedMessage = normalizeForMatch(agentInboundText || messageRaw);

    const { data: participantFlowState } = await supabase
      .from("flow_captured_data")
      .select("*")
      .eq("user_id", userId)
      .eq("phone", phone)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let flowState = participantFlowState?.last_node_id
      ? participantFlowState
      : isButtonResponse && participantFlowState?.flow_id
        ? participantFlowState
        : null;
    let flowStateIsSharedGroup = false;

    if (!flowState && isGroup && chatId && chatId !== phone) {
      const { data: sharedGroupFlowState } = await supabase
        .from("flow_captured_data")
        .select("*")
        .eq("user_id", userId)
        .eq("phone", chatId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sharedGroupFlowState?.last_node_id || (isButtonResponse && sharedGroupFlowState?.flow_id)) {
        const { data: existingParticipantState } = await supabase
          .from("flow_captured_data")
          .select("id")
          .eq("user_id", userId)
          .eq("flow_id", sharedGroupFlowState.flow_id)
          .eq("phone", phone)
          .maybeSingle();

        flowState = existingParticipantState ? null : sharedGroupFlowState;
        flowStateIsSharedGroup = !!flowState;
      }
    }

    let flowStateHandled = false;

    if (flowState && (messageRaw || incomingAudioUrl) && (!fromMe || isButtonResponse)) {
      const flowId = flowState.flow_id;
      const lastNodeId = flowState.last_node_id;

      const { data: flow } = await supabase.from("flow_automations").select("*").eq("id", flowId).maybeSingle();

      if (flow) {
        const nodes = flow.nodes || [];
        const edges = flow.edges || [];
        const lastNode = lastNodeId ? nodes.find((n: any) => n.id === lastNodeId) : null;

        if (lastNode) {
          const isCapture =
            lastNode.data.collectName ||
            lastNode.data.collectEmail ||
            lastNode.data.collectWhatsapp ||
            lastNode.data.collectCPF;
          const field = lastNode.data.collectName
            ? "nome"
            : lastNode.data.collectEmail
              ? "email"
              : lastNode.data.collectWhatsapp
                ? "whatsapp"
                : lastNode.data.collectCPF
                  ? "cpf"
                  : null;

          if (isCapture && field) {
            flowStateHandled = true;
            const captured = { ...(flowState.captured_data || {}) };
            captured[field] = messageRaw;

            await supabase.from("flow_captured_data").upsert(
              {
                user_id: userId,
                flow_id: flowId,
                flow_name: flow.name,
                phone,
                captured_data: captured,
                [field]: messageRaw,
                last_node_id: null,
                source: isGroup ? "whatsapp_group" : "whatsapp",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,flow_id,phone" },
            );

            const captureHandle = getCaptureHandle(field);
            const edge = edges.find((e: any) => e.source === lastNodeId && e.sourceHandle === captureHandle);
            if (edge) {
              await executeFlow(
                supabase,
                userId,
                phone,
                flow,
                edge.target,
                captured,
                instanceData,
                chatId,
                isGroup,
                { ...webhook, __agent_input_text: agentInboundText },
              );
            }
            return new Response("capture_resumed", { status: 200, headers: corsHeaders });
          } else if (lastNode.type === "agenteIA") {
            flowStateHandled = true;
            if (messageId) {
              await supabase.from("message_logs").insert({
                user_id: userId,
                phone: chatId,
                instance_id: instanceId,
                timestamp: new Date().toISOString(),
                message_received: displayInboundMessage,
                response_sent: `[Agente IA: ${flow.name}]`,
                keyword_matched: `__agent_flow_inbound__:${flow.id}:${messageId}`,
                message_id: messageId,
              });
            }
            await executeFlow(
              supabase,
              userId,
              phone,
              flow,
              lastNodeId,
              flowState.captured_data || {},
              instanceData,
              chatId,
              isGroup,
              { ...webhook, __agent_input_text: agentInboundText },
            );
            return new Response("agent_flow_resumed", { status: 200, headers: corsHeaders });
          } else {
            const buttonMatch = findButtonMatch(nodes, edges, lastNodeId, normalizedMessage, webhook);
            console.log("Button match result:", JSON.stringify(buttonMatch));
            if (buttonMatch) {
              flowStateHandled = true;
              await supabase.from("message_logs").insert({
                user_id: userId,
                phone: chatId,
                instance_id: instanceId,
                timestamp: new Date().toISOString(),
                message_received: messageRaw,
                keyword_matched: `[Botão: ${buttonMatch.text}]`,
                response_sent: `[Fluxo: ${flow.name}]`,
                message_id: messageId,
              });

              await executeFlow(
                supabase,
                userId,
                phone,
                flow,
                buttonMatch.targetId,
                flowState.captured_data || {},
                instanceData,
                chatId,
                isGroup,
                { ...webhook, __agent_input_text: agentInboundText },
              );

              if (!flowStateIsSharedGroup) {
                await supabase
                  .from("flow_captured_data")
                  .update({
                    last_node_id: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", flowState.id)
                  .eq("last_node_id", lastNodeId);
              }

              return new Response("button_flow_resumed", { status: 200, headers: corsHeaders });
            }
          }
        } else if (isButtonResponse) {
          const buttonMatch = findAnyButtonMatch(nodes, edges, normalizedMessage, webhook);
          if (buttonMatch) {
            flowStateHandled = true;
            await supabase.from("message_logs").insert({
              user_id: userId,
              phone: chatId,
              instance_id: instanceId,
              timestamp: new Date().toISOString(),
              message_received: messageRaw,
              keyword_matched: `[Botão: ${buttonMatch.text}]`,
              response_sent: `[Fluxo: ${flow.name}]`,
              message_id: messageId,
            });

            await executeFlow(
              supabase,
              userId,
              phone,
              flow,
              buttonMatch.targetId,
              flowState.captured_data || {},
              instanceData,
              chatId,
              isGroup,
              webhook,
            );
            if (!flowStateIsSharedGroup) {
              await supabase
                .from("flow_captured_data")
                .update({
                  last_node_id: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", flowState.id);
            }
            return new Response("button_flow_recovered", { status: 200, headers: corsHeaders });
          }
        }
      }
    }

    if (!flowStateHandled && (!fromMe || isButtonResponse)) {
      if (!userId) {
        console.error("[FlowTrigger] No user ID found for instance:", instanceId);
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      console.log(`[FlowTrigger] Checking global triggers for message: "${messageRaw}" by user ${userId}`);
      const { data: flows, error: flowsError } = await supabase
        .from("flow_automations")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true);

      if (flowsError) {
        console.error("[FlowTrigger] Error fetching flows:", flowsError);
      }

      let triggerFound = false;
      const normalizedMessage = normalizeForMatch(messageRaw);

      for (const flow of flows || []) {
        if (triggerFound) break;

        if (isGroup && (flow as any).disable_in_groups === true) {
          console.log(`[FlowTrigger] Flow ${flow.name} disabled in groups. Skipping.`);
          continue;
        }

        const nodes = flow.nodes || [];
        const triggerNodes = nodes.filter((n: any) => n.type === "blocoGatilho");

        let shouldTrigger = false;
        let startNodeId = null;
        let matchedKeyword = "";

        // 1. Check main keywords on the flow
        const mainKeywords = (flow.keyword || "")
          .split(",")
          .map((k: string) => k.trim())
          .filter(Boolean);
        
        const matchedMain = mainKeywords.find((k: string) => isKeywordMatch(normalizedMessage, k));
        
        if (matchedMain) {
          console.log(`[FlowTrigger] Match found in flow ${flow.name} with keyword: ${matchedMain}`);
          shouldTrigger = true;
          matchedKeyword = matchedMain;
          const initialNode = nodes.find((n: any) => n.type === "blocoInicial");
          startNodeId = initialNode?.id;
        }

        // 2. Check trigger nodes (blocoGatilho)
        if (!shouldTrigger && triggerNodes.length > 0) {
          for (const tNode of triggerNodes) {
            const nodeKeywords = String(tNode.data?.keyword || "")
              .split(",")
              .map((k: string) => k.trim())
              .filter(Boolean);
            const matchedNode = nodeKeywords.find((k: string) => isKeywordMatch(normalizedMessage, k));
            if (matchedNode) {
              console.log(`[FlowTrigger] Match found in flow ${flow.name} with trigger node keyword: ${matchedNode}`);
              shouldTrigger = true;
              matchedKeyword = matchedNode;
              const edge = (flow.edges || []).find((e: any) => String(e.source) === String(tNode.id));
              startNodeId = edge?.target;
              break;
            }
          }
        }

        if (shouldTrigger && startNodeId) {
          if (isGroup) {
            // Check if bot was mentioned
            const wasMentioned =
              webhook?.isMentioned === true || 
              webhook?.isMentioned === "true" ||
              (messageRaw && messageRaw.includes(`@${instanceData?.zapi_instance_id}`));

            console.log(`[FlowTrigger] Group message: wasMentioned=${wasMentioned}`);

            if (!wasMentioned && normalizedMessage.split(" ").length > 5) {
              console.log(`[FlowTrigger] Group message not mentioning bot and too long. Skipping.`);
              continue;
            }
          }

          triggerFound = true;
          const triggerKey = `__flow_trigger__:${flow.id}:${messageId || normalizedMessage.substring(0, 50)}`;

          const { data: recentTrigger } = await supabase
            .from("message_logs")
            .select("id")
            .eq("user_id", userId)
            .eq("phone", chatId)
            .eq("keyword_matched", triggerKey)
            .gte("timestamp", new Date(Date.now() - 5000).toISOString())
            .maybeSingle();

          if (recentTrigger) {
            console.log(`[FlowTrigger] Duplicated trigger detected for flow ${flow.name} (Key: ${triggerKey}). Skipping.`);
            return new Response("flow_triggered_duplicate", { status: 200, headers: corsHeaders });
          }

          console.log(`[FlowTrigger] ✅ Triggering flow ${flow.name} for ${phone} (Node: ${startNodeId})`);
          
          await supabase.from("message_logs").insert({
            user_id: userId,
            phone: chatId,
            instance_id: instanceId,
            timestamp: new Date().toISOString(),
            message_received: displayInboundMessage,
            response_sent: `[Fluxo: ${flow.name}]`,
            keyword_matched: triggerKey,
            message_id: messageId,
          });

          await executeFlow(
            supabase,
            userId,
            phone,
            flow,
            startNodeId,
            {},
            instanceData,
            chatId,
            isGroup,
            { ...webhook, __agent_input_text: agentInboundText },
          );
          return new Response("flow_triggered", { status: 200, headers: corsHeaders });
        }
      }

      console.log(`[FlowTrigger] No flow matched for message: "${messageRaw}"`);

      // Se nada disparou e o agente global está ativo, vamos chamar o agente global
      const { data: agentConfig } = await supabase
        .from("agent_config")
        .select("active")
        .eq("user_id", userId)
        .maybeSingle();

      if (agentConfig?.active) {
        console.log(`[AI Agent] Global agent is active for user ${userId}. Calling agent-chat.`);

        // Se for áudio (PTT/voz), transcreve com Whisper antes de mandar pro agente
        if (messageId) {
          await supabase.from("message_logs").insert({
            user_id: userId,
            phone: chatId,
            instance_id: instanceId,
            timestamp: new Date().toISOString(),
            message_received: displayInboundMessage,
            response_sent: "[Agente IA global]",
            keyword_matched: `__global_agent_inbound__:${messageId}`,
            message_id: messageId,
          });
        }
        
        const { data: agentResponse, error: agentError } = await supabase.functions.invoke("agent-chat", {
          body: {
            messages: [{ role: "user", content: agentInboundText || "Olá" }],
            user_id: userId,
            phone: phone,
            user_sent_audio: !!incomingAudioUrl,
          }
        });

        if (!agentError && agentResponse) {
          console.log("[AI Agent] Global agent response received:", JSON.stringify(agentResponse).slice(0, 500));
          const aiResponse = agentResponse.reply || "Desculpe, não consegui gerar uma resposta.";
          const buttons = agentResponse.cta ? [{
            id: `global_agent_cta`,
            text: agentResponse.cta.label,
            type: "url",
            value: agentResponse.cta.url
          }] : [];

          let aiDestination =
            isGroup && (webhook?.phone || webhook?.chatPhone) ? webhook?.phone || webhook?.chatPhone : chatId || phone;
          if (isGroup || aiDestination.includes("@g.us")) {
            const numericId = aiDestination
              .replace(/@g\.us$/i, "")
              .replace(/-group$/i, "")
              .replace(/\D/g, "");
            aiDestination = numericId ? `${numericId}-group` : aiDestination;
          }

          if (agentResponse?.use_audio === true && !buttons.length) {
            try {
              const { data: ttsData, error: ttsErr } = await supabase.functions.invoke("tts", {
                body: { text: aiResponse, conversation_id: aiDestination },
              });
              if (!ttsErr && ttsData?.audio_url) {
                await sendZapiText(instance, aiDestination, "", [], "global_agent", "audio", ttsData.audio_url, supabase, userId);
              } else {
                console.error("[AI Agent] TTS failed, fallback to text:", ttsErr);
              }
            } catch (e) {
              console.error("[AI Agent] TTS exception:", e);
            }
          }
          await sendZapiText(instance, aiDestination, aiResponse, buttons, "global_agent", "text", "", supabase, userId);
        } else {
          console.error("[AI Agent] Error calling global agent-chat:", JSON.stringify(agentError));
        }
      } else {
        await supabase.from("message_logs").insert({
          user_id: userId,
          phone: chatId,
          instance_id: instanceId,
          timestamp: new Date().toISOString(),
          message_received: displayInboundMessage,
          message_id: messageId,
        });
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return new Response("error", { status: 200, headers: corsHeaders });
  }
});

function findButtonMatch(nodes: FlowNode[], edges: FlowEdge[], sourceNodeId: string, message: string, webhook: any) {
  const node = nodes.find((n) => String(n.id) === String(sourceNodeId));
  if (!node || !node.data.buttons) return null;

  for (let i = 0; i < node.data.buttons.length; i++) {
    const btn = node.data.buttons[i];
    const normalizedBtnText = normalizeForMatch(btn.text);
    const buttonIdFromWebhook = String(
      webhook?.buttonReply?.buttonId ||
        webhook?.buttonsResponseMessage?.buttonId ||
        webhook?.buttonsResponseMessage?.selectedButtonId ||
        webhook?.buttonResponseMessage?.buttonId ||
        webhook?.buttonResponseMessage?.selectedButtonId ||
        webhook?.listResponseMessage?.singleSelectReply?.selectedRowId ||
        "",
    );
    const expectedIds = [
      btn.id,
      btn.value,
      `${sourceNodeId}-btn-${i}`,
      String(i + 1),
      `node:${sourceNodeId}:button:${i}`,
    ]
      .filter(Boolean)
      .map(String);
    console.log(
      `Checking button ${i} (${btn.text}): expectedIds=${expectedIds.join(",")}, receivedId=${buttonIdFromWebhook}, msg=${message}`,
    );
    const isIdMatch = expectedIds.map(String).includes(String(buttonIdFromWebhook));
    const isTextMatch =
      normalizedBtnText && message && (normalizedBtnText === message || message.includes(normalizedBtnText));

    if (isIdMatch || isTextMatch) {
      const edge = edges.find(
        (e) =>
          String(e.source) === String(sourceNodeId) &&
          (String(e.sourceHandle) === `button-${i}` ||
            String(e.sourceHandle) === String(btn.id) ||
            String(e.sourceHandle) === `node:${sourceNodeId}:button:${i}`),
      );
      if (edge) return { targetId: edge.target, text: btn.text };
    }
  }
  return null;
}

function findAnyButtonMatch(nodes: FlowNode[], edges: FlowEdge[], message: string, webhook: any) {
  const buttonIdFromWebhook = String(
    webhook?.buttonReply?.buttonId ||
      webhook?.buttonsResponseMessage?.buttonId ||
      webhook?.buttonsResponseMessage?.selectedButtonId ||
      webhook?.buttonResponseMessage?.buttonId ||
      webhook?.buttonResponseMessage?.selectedButtonId ||
      webhook?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      "",
  );

  console.log(`[findAnyButtonMatch] Searching match for id="${buttonIdFromWebhook}" message="${message}"`);

  for (const edge of edges) {
    const sourceNode = nodes.find((n) => String(n.id) === String(edge.source));
    if (!sourceNode) continue;

    const buttons = sourceNode?.data?.buttons || [];
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const expectedIds = [
        btn.id,
        btn.value,
        `${sourceNode.id}-btn-${i}`,
        String(i + 1),
        `node:${sourceNode.id}:button:${i}`,
      ]
        .filter(Boolean)
        .map(String);

      const isHandleMatch =
        String(edge.sourceHandle) === `button-${i}` ||
        String(edge.sourceHandle) === String(btn.id) ||
        String(edge.sourceHandle) === `node:${sourceNode.id}:button:${i}`;
      const isIdMatch = expectedIds.map(String).includes(String(buttonIdFromWebhook));
      const normalizedBtnText = normalizeForMatch(btn.text);
      const isTextMatch = normalizedBtnText === message || (message && message.includes(normalizedBtnText));

      if (isHandleMatch && (isIdMatch || isTextMatch)) {
        console.log(
          `[findAnyButtonMatch] ✅ Match found! Node=${sourceNode.id} Button=${btn.text} Target=${edge.target}`,
        );
        return { targetId: edge.target, text: btn.text };
      }
    }
  }
  console.log(`[findAnyButtonMatch] ❌ No match found in ${edges.length} edges`);
  return null;
}

async function callAI(systemPrompt: string, userMessage: string, model: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("LOVABLE_API_KEY not found");
    return "Desculpe, estou com problemas técnicos agora (API Key ausente).";
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage || "Olá" },
        ],
      }),
    });

    const data = await response.json();
    console.log(`[AI Response] Status: ${response.status}, Data:`, JSON.stringify(data).slice(0, 500));
    
    if (data.error) {
      console.error("Erro na IA (Gateway):", data.error);
      return "Desculpe, tive um erro ao processar sua resposta com IA.";
    }
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn("IA retornou resposta vazia ou sem conteúdo:", JSON.stringify(data));
      return "Não consegui gerar uma resposta no momento. Por favor, tente novamente.";
    }
    
    return content;
  } catch (error) {
    console.error("Error calling AI Gateway:", error);
    return "Erro ao processar sua solicitação com IA.";
  }
}

function getConnectedAgentTools(nodes: FlowNode[], edges: FlowEdge[], agentNodeId: string) {
  return edges
    .filter((e: any) => String(e.source) === String(agentNodeId))
    .map((e: any) => nodes.find((n: any) => String(n.id) === String(e.target) && n.type === "agentTool")?.data)
    .filter((tool: any) => tool?.toolName && tool.enabled !== false)
    .map((tool: any) => ({ toolName: tool.toolName, enabled: tool.enabled !== false }));
}

async function executeFlow(
  supabase: any,
  userId: string,
  phone: string,
  flow: any,
  nodeId: string,
  captured: any,
  instance: any,
  chatId?: string,
  isGroup?: boolean,
  webhook?: any,
) {
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  let currentNodeId = nodeId;
  const visited = new Set();

  while (currentNodeId && !visited.has(String(currentNodeId))) {
    visited.add(String(currentNodeId));
    const node = nodes.find((n: any) => String(n.id) === String(currentNodeId));

    if (!node) break;

    // Rastreamento em tempo real: registra posição atual do lead no fluxo
    try {
      if (flow?.id && userId && phone) {
        const contactName =
          webhook?.senderName || webhook?.sender?.name || webhook?.chatName || null;
        await supabase
          .from("flow_lead_positions")
          .upsert(
            {
              user_id: userId,
              flow_id: String(flow.id),
              phone: String(phone),
              contact_name: contactName,
              block_id: String(currentNodeId),
              status: "active",
              entered_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,flow_id,phone" },
          );
      }
    } catch (_e) { /* silencioso */ }

    if (node.type === "blocoConteudo" || node.type === "blocoInicial") {
      const delaySeconds = Number(node.data.delaySeconds || 0);
      if (delaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(delaySeconds, 25) * 1000));
      }

      const isCapture =
        node.data.collectName || node.data.collectEmail || node.data.collectWhatsapp || node.data.collectCPF;
      const hasButtons = node.data.buttons?.length > 0;

      let content = "";
      if (isCapture) {
        if (node.data.collectName) content = node.data.namePrompt;
        else if (node.data.collectEmail) content = node.data.emailPrompt;
        else if (node.data.collectWhatsapp) content = node.data.whatsappPrompt;
        else if (node.data.collectCPF) content = node.data.cpfPrompt;
      } else {
        content = node.data.content || "";
      }

      const resolvedContent = replaceVars(content, captured, phone);
      const contentType = node.data.contentType || "text";
      const mediaUrl = node.data.mediaUrl || "";

      let destination =
        isGroup && (webhook?.phone || webhook?.chatPhone) ? webhook?.phone || webhook?.chatPhone : chatId || phone;
      if (isGroup || destination.includes("@g.us")) {
        const numericId = destination
          .replace(/@g\.us$/i, "")
          .replace(/-group$/i, "")
          .replace(/\D/g, "");
        destination = numericId ? `${numericId}-group` : destination;
      }

      if (!resolvedContent.trim() && !mediaUrl && !hasButtons && !isCapture && node.type === "blocoInicial") {
        const nextEdge = edges.find((e: any) => String(e.source) === String(currentNodeId));
        currentNodeId = nextEdge?.target;
        continue;
      }

      await sendZapiText(
        instance,
        destination,
        resolvedContent,
        node.data.buttons,
        node.id,
        contentType,
        mediaUrl,
        supabase,
        userId,
        flow.name,
      );

      if (isCapture || hasButtons) {
        await supabase.from("flow_captured_data").upsert(
          {
            user_id: userId,
            flow_id: flow.id,
            flow_name: flow.name,
            phone,
            captured_data: captured,
            last_node_id: node.id,
            source: isGroup ? "whatsapp_group" : "whatsapp",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,flow_id,phone" },
        );
        return;
      }
    } else if (node.type === "agenteIA") {
      const delaySeconds = Number(node.data.delaySeconds || 0);
      if (delaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(delaySeconds, 25) * 1000));
      }

      const prompt = node.data.prompt || "Você é um assistente virtual prestativo.";
      const resolvedPrompt = replaceVars(prompt, captured, phone);
      
      const agentInputOverride = String(webhook?.__agent_input_text || "").trim();
      const userMessage = agentInputOverride ||
        webhook?.buttonsResponseMessage?.message ||
        webhook?.buttonsResponseMessage?.buttonText ||
        webhook?.buttonResponseMessage?.message ||
        webhook?.buttonResponseMessage?.buttonText ||
        webhook?.buttonReply?.text ||
        webhook?.text?.message ||
        webhook?.message?.text ||
        (typeof webhook?.text === "string" ? webhook.text : "") ||
        "";

      console.log(`[Flow:agenteIA] Calling agent-chat for phone ${phone}`);
      
      const { data: flowCaptured } = await supabase
        .from("flow_captured_data")
        .select("captured_data")
        .eq("user_id", userId)
        .eq("phone", phone)
        .eq("flow_id", flow.id)
        .maybeSingle();

      const chatHistory = flowCaptured?.captured_data?.chat_history || [];
      const existingSentProofIds: string[] = Array.isArray(flowCaptured?.captured_data?.sent_social_proof_ids)
        ? flowCaptured.captured_data.sent_social_proof_ids
        : [];
      const currentMessages = [
        ...chatHistory,
        { role: "user", content: userMessage || "Olá" }
      ].slice(-10); // Keep last 10 messages for context
      const connectedTools = getConnectedAgentTools(nodes, edges, node.id);

      console.log(`[Flow:agenteIA] Calling agent-chat for phone ${phone} with history: ${currentMessages.length} msgs`);
      
      const { data: agentResponse, error: agentError } = await supabase.functions.invoke("agent-chat", {
        body: {
          messages: currentMessages,
          user_id: userId,
          phone: phone,
          instance_id: instance?.id || null,
          connected_tools: connectedTools,
          system_prompt: resolvedPrompt,
          skip_config: true,
          model: node.data.model || "claude-sonnet-4-6",
          sent_proof_ids: existingSentProofIds,
          user_sent_audio: !!getIncomingAudioUrl(webhook),
        }
      });

      if (agentError) {
        console.error("[Flow:agenteIA] Error calling agent-chat:", JSON.stringify(agentError));
        await sendZapiText(instance, chatId || phone, "Desculpe, tive um erro ao processar sua resposta. Por favor, tente novamente.", [], node.id, "text", "", supabase, userId, flow.name);
      } else {
        console.log("[Flow:agenteIA] Agent-chat response received:", JSON.stringify(agentResponse).slice(0, 500));
        const aiResponse = agentResponse?.reply || "Não consegui gerar uma resposta no momento.";
        
        // Update history
        const updatedHistory = [
          ...currentMessages,
          { role: "assistant", content: aiResponse }
        ].slice(-10);

        const mergedSentProofIds = Array.isArray(agentResponse?.sent_proof_ids)
          ? agentResponse.sent_proof_ids
          : existingSentProofIds;
        const finalCaptured = {
          ...(flowCaptured?.captured_data || captured || {}),
          chat_history: updatedHistory,
          sent_social_proof_ids: mergedSentProofIds,
        };

        await supabase.from("flow_captured_data").upsert(
          {
            user_id: userId,
            flow_id: flow.id,
            phone,
            captured_data: finalCaptured,
            last_node_id: node.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,flow_id,phone" }
        );

        const buttons = agentResponse.cta ? [{
          id: `cta:${node.id}`,
          text: agentResponse.cta.label,
          type: "url",
          value: agentResponse.cta.url
        }] : [];

        let aiDestination =
          isGroup && (webhook?.phone || webhook?.chatPhone) ? webhook?.phone || webhook?.chatPhone : chatId || phone;
        if (isGroup || aiDestination.includes("@g.us")) {
          const numericId = aiDestination
            .replace(/@g\.us$/i, "")
            .replace(/-group$/i, "")
            .replace(/\D/g, "");
          aiDestination = numericId ? `${numericId}-group` : aiDestination;
        }
        
        if (agentResponse?.use_audio === true && !buttons.length) {
          try {
            const { data: ttsData, error: ttsErr } = await supabase.functions.invoke("tts", {
              body: { text: aiResponse, conversation_id: aiDestination },
            });
            if (!ttsErr && ttsData?.audio_url) {
              await sendZapiText(instance, aiDestination, "", [], node.id, "audio", ttsData.audio_url, supabase, userId, flow.name);
            } else {
              console.error("[Flow:agenteIA] TTS failed, fallback to text:", ttsErr);
            }
          } catch (e) {
            console.error("[Flow:agenteIA] TTS exception:", e);
          }
        }
        await sendZapiText(instance, aiDestination, aiResponse, buttons, node.id, "text", "", supabase, userId, flow.name);
        
        const nextEdgeForAgent = edges.find(
          (e: any) =>
            String(e.source) === String(node.id) &&
            (!e.sourceHandle ||
              e.sourceHandle === "default" ||
              e.sourceHandle === "output" ||
              e.sourceHandle.includes("source")),
        );

        if (!nextEdgeForAgent) {
          return;
        }
      }
    } else if (node.type === "blocoAgendamento" || node.type === "blocoAcao") {
      const actionType = node.data.actionType;

      if (actionType === "delay" || (node.type === "blocoAcao" && actionType === "delay")) {
        const seconds = Number(node.data.delaySeconds ?? node.data.actionConfig ?? 0) || 0;
        if (seconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(seconds, 25) * 1000));
        }
      } else if (node.type === "blocoAcao" && actionType === "typing") {
        const seconds = Math.min(Number(node.data.typingDuration ?? 5) || 5, 25);
        const typingPhone = chatId || phone;
        try {
          const zUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}/send-chat-state`;
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "client-token": instance.zapi_client_token || "",
          };
          await fetch(zUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ phone: typingPhone, chatState: "composing" }),
          });
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
          await fetch(zUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ phone: typingPhone, chatState: "paused" }),
          });
        } catch (err) {
          console.error("typing presence error:", err);
        }
      } else if (node.type === "blocoAgendamento" || (node.type === "blocoAcao" && actionType === "schedule")) {
        const scheduledAt = node.data.scheduledAt || node.data.actionConfig;
        if (scheduledAt) {
          const targetDate = new Date(scheduledAt);
          const diffMs = targetDate.getTime() - Date.now();
          if (diffMs > 0) {
            const waitTime = Math.min(diffMs, 25000);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }
      }
    }

    const nextEdge = edges.find(
      (e: any) =>
        String(e.source) === String(currentNodeId) &&
        (!e.sourceHandle ||
          e.sourceHandle === "default" ||
          e.sourceHandle === "output" ||
          e.sourceHandle.includes("source")),
    );

    currentNodeId = nextEdge?.target;
  }

  // Marca lead como finalizado quando o fluxo termina
  try {
    if (flow?.id && userId && phone) {
      await supabase
        .from("flow_lead_positions")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("flow_id", String(flow.id))
        .eq("phone", String(phone));
    }
  } catch (_e) { /* silencioso */ }
}

function replaceVars(text: string, captured: any, phone: string) {
  return text
    .replace(/\{\{nome\}\}/gi, captured.nome || "")
    .replace(/\{\{whatsapp\}\}/gi, captured.whatsapp || phone)
    .replace(/\{\{email\}\}/gi, captured.email || "");
}

async function sendZapiText(
  instance: any,
  phone: string,
  message: string,
  buttons?: any[],
  nodeId?: string,
  contentType = "text",
  mediaUrl = "",
  supabase?: any,
  userId?: string,
  flowName?: string,
) {
  const zapiId = instance.zapi_instance_id;
  const zapiToken = instance.zapi_token;
  const clientToken = instance.zapi_client_token;

  if (supabase && userId) {
    try {
      let logContent = message || "";
      if (mediaUrl && contentType !== "text") {
        const mediaTag = `[media:${contentType}:${mediaUrl}]`;
        logContent = logContent ? `${mediaTag}\n${logContent}` : mediaTag;
      }
      if (buttons && buttons.length > 0) {
        const buttonLabels = buttons
          .map((b) => b.text)
          .filter(Boolean)
          .join(" | ");
        if (buttonLabels) {
          logContent = `${logContent}\n\n[Botões: ${buttonLabels}]`;
        }
      }

      await supabase.from("message_logs").insert({
        user_id: userId,
        phone,
        instance_id: zapiId,
        timestamp: new Date().toISOString(),
        message_received: null,
        response_sent: logContent || "[mensagem]",
        keyword_matched: flowName ? `__flow_send__:${flowName}` : "__flow_send__",
      });
    } catch (logErr) {
      console.error("Error logging flow message:", logErr);
    }
  }

  let url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-text`;
  let body: any = { phone, message };

  const normalizedType = String(contentType || "text").toLowerCase();
  if (mediaUrl && !buttons?.length) {
    if (normalizedType === "image") {
      url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-image`;
      body = { phone, image: mediaUrl, caption: message || "" };
    } else if (normalizedType === "video") {
      url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-video`;
      body = { phone, video: mediaUrl, caption: message || "" };
    } else if (normalizedType === "audio") {
      url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-audio`;
      body = { phone, audio: mediaUrl, waveform: true };
    } else if (normalizedType === "document") {
      const cleanUrl = String(mediaUrl).split("?")[0].split("#")[0];
      const ext =
        cleanUrl
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "pdf";
      url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-document/${ext}`;
      body = { phone, document: mediaUrl, fileName: message || `arquivo.${ext}` };
    }
  }

  if (buttons && buttons.length > 0) {
    url = `https://api.z-api.io/instances/${zapiId}/token/${zapiToken}/send-button-actions`;
    body = {
      phone,
      message,
      buttonActions: buttons.map((btn, idx) => ({
        id: btn.id || `node:${nodeId}:button:${idx}`,
        type: btn.type === "url" ? "URL" : btn.type === "call" ? "CALL" : "REPLY",
        label: btn.text,
        url: btn.type === "url" ? btn.value : undefined,
        phone: btn.type === "call" ? btn.value : undefined,
      })),
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken || "",
      },
      body: JSON.stringify(body),
    });

    return await response.json().catch(() => ({}));
  } catch (error) {
    console.error(`❌ Falha crítica ao enviar via Z-API:`, error);
    throw error;
  }
}
