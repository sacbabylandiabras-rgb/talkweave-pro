const pickPreferredInteractiveText = (candidates: unknown[]) => {
  const values = candidates.filter((v): v is string => typeof v === "string").map(v => v.trim()).filter(Boolean);
  return values[0] || "";
};

function extractButtonReplyCandidates(webhook: any): string[] {
  const values = new Set<string>();
  const push = (v: any) => { if (typeof v === "string" && v.trim()) values.add(v.trim()); };
  [
    webhook?.text?.title, webhook?.text?.description, webhook?.buttonReply?.title, webhook?.buttonReply?.text,
    webhook?.buttonReply?.label, webhook?.buttonReply?.selectedDisplayText, webhook?.message?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.message?.buttonResponseMessage?.selectedDisplayText, webhook?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.buttonsResponseMessage?.selectedButtonId, webhook?.buttonsResponseMessage?.selectedButtonText,
    webhook?.buttonResponseMessage?.selectedDisplayText, webhook?.buttonResponseMessage?.selectedButtonId,
    webhook?.interactiveResponse?.title, webhook?.interactiveResponse?.description, webhook?.title,
    webhook?.selectedButtonId, webhook?.response?.title, webhook?.response?.text, webhook?.response?.selectedDisplayText,
  ].forEach(push);
  return Array.from(values);
}

function extractQuotedMessageTextCandidates(webhook: any): string[] {
  const values = new Set<string>();
  const push = (v: any) => { if (typeof v === "string" && v.trim()) values.add(v.trim()); };
  [
    webhook?.contextInfo?.quotedMessage?.conversation, webhook?.contextInfo?.quotedMessage?.extendedTextMessage?.text,
    webhook?.message?.contextInfo?.quotedMessage?.conversation, webhook?.message?.contextInfo?.quotedMessage?.extendedTextMessage?.text,
  ].forEach(push);
  return Array.from(values);
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function stableUuidFromText(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function acquireMessageProcessingLock(
  supabase: any,
  params: {
    userId: string;
    phone: string;
    normalizedMessage: string;
    rawMessage: string;
    instanceId?: string;
    messageId?: string;
     senderName?: string;
     senderPhone?: string;
     senderPhoto?: string;
  },
): Promise<{ acquired: boolean; lockId: string }> {
  const { userId, phone, normalizedMessage, rawMessage, instanceId, messageId, senderName, senderPhone, senderPhoto } = params;
  // Embed sender info as a prefix so the frontend can show name/phone/photo
  // without requiring a schema change. The frontend strips this prefix.
  const senderPrefix = (senderName || senderPhone || senderPhoto)
    ? `[sender:${(senderName || '').replace(/[\|\]]/g, ' ')}|${(senderPhone || '').replace(/[\|\]]/g, ' ')}|${(senderPhoto || '').replace(/[\|\]]/g, ' ')}] `
    : '';
  const messageWithSender = senderPrefix + (rawMessage || '');
  const norm = normalizedMessage || normalizeForMatch(rawMessage);
  const now = Date.now();
  const bucketSize = 15000;
  const currentBucket = Math.floor(now / bucketSize);
  const prevBucket = currentBucket - 1;
  const dedupeSubject = String(messageId || "").trim() ? `mid:${String(messageId || "").trim()}` : `txt:${norm}`;
  const currentKey = `${userId}|${phone}|${dedupeSubject}|${currentBucket}`;
  const prevKey = `${userId}|${phone}|${dedupeSubject}|${prevBucket}`;
  const lockId = await stableUuidFromText(currentKey);
  const prevLockId = await stableUuidFromText(prevKey);
  const { data: prevLock } = await supabase.from("message_logs").select("id").eq("id", prevLockId).maybeSingle();
  if (prevLock) return { acquired: false, lockId };
   const logEntry: any = {
     id: lockId,
     phone,
     message_received: messageWithSender,
     keyword_matched: "__processing__",
     response_sent: "__processing__",
     timestamp: new Date().toISOString().replace('T', ' ').split('.')[0],
     user_id: userId,
     instance_id: instanceId || null,
   };

    const { error } = await supabase.from("message_logs").insert(logEntry);
  if (!error) return { acquired: true, lockId };
  const isDuplicate = error?.code === "23505" || (typeof error?.message === "string" && error.message.toLowerCase().includes("duplicate key"));
  if (isDuplicate) return { acquired: false, lockId };
  throw new Error(`Erro ao adquirir lock de dedupe: ${error.message}`);
}

async function finalizeMessageLog(supabase: any, lockId: string, params: { keywordMatched: string; responseSent: string }) {
  const { keywordMatched, responseSent } = params;
  await supabase.from("message_logs").update({ keyword_matched: keywordMatched, response_sent: responseSent, timestamp: new Date().toISOString() }).eq("id", lockId);
}

async function releaseMessageProcessingLock(supabase: any, lockId: string) {
  await supabase.from("message_logs").update({ keyword_matched: null, response_sent: null, timestamp: new Date().toISOString() }).eq("id", lockId).eq("keyword_matched", "__processing__");
}

function sanitizeTechnicalMessageReference(text: string): string {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const technicalMatch = raw.match(/^\d{10,}:([A-Z0-9]{10,})$/i);
  if (technicalMatch) {
    console.log("🧹 Sanitizing technical UAZAPI message reference from outgoing log");
    return "";
  }
  return raw;
}

  const extractExplicitButtonHandle = (value: string): string | null => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const match = trimmed.match(/\bbutton[-_ ]?(\d+)\b/i);
    if (!match) return null;
    return `button-${match[1]}`;
  };

  const extractUazapiChoiceIndex = (value: string): number | null => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;

    const directNumberMatch = trimmed.match(/^([1-9]\d?)$/);
    if (directNumberMatch) {
      const parsed = Number.parseInt(directNumberMatch[1], 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const prefixedLabelMatch = trimmed.match(/^([1-9]\d?)\s*[.)\-:]+\s*.+$/u);
    if (prefixedLabelMatch) {
      const parsed = Number.parseInt(prefixedLabelMatch[1], 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };

  const normalizedRaw = normalizeForMatch(rawMessage);
  const pendingHandleCandidates = getPendingButtonHandleCandidates(
    options?.pendingState,
    rawMessage,
  );
  const quotedMessageCandidates = extractQuotedMessageTextCandidates(webhook);

  const baseCandidates = [
    rawMessage,
    normalizedMessage,
    ...extractButtonReplyCandidates(webhook),
    ...quotedMessageCandidates,
    ...pendingHandleCandidates,
  ].filter((value): value is string =>
    typeof value === "string" && value.trim().length > 0
  );

  const replyCandidates = Array.from(
    new Set(
      baseCandidates.flatMap((value) => {
        return explodeChoiceCandidates(value).flatMap((candidate) => {
          const trimmed = candidate.trim();
          const stripped = stripChoicePrefix(trimmed);
          return stripped && stripped !== trimmed ? [trimmed, stripped] : [trimmed];
        });
      }),
    ),
  );

  const normalizedCandidates = new Set(
    replyCandidates
      .map((value) => normalizeForMatch(value))
      .filter(Boolean),
  );

  const explicitHandleCandidates = new Set(
    replyCandidates
      .map((value) => extractExplicitButtonHandle(value))
      .filter((value): value is string => Boolean(value)),
  );

  const derivedIndexCandidates = new Set(
    replyCandidates
      .map((value) => extractUazapiChoiceIndex(value))
      .filter((value): value is number => Number.isFinite(value))
      .map((value) => normalizeForMatch(String(value))),
  );

  console.log("🎛️ Button reply candidates:", replyCandidates);

  for (const flow of flows) {
    const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
    const edges = Array.isArray(flow?.edges) ? flow.edges : [];

    for (const node of nodes) {
      if (node?.type !== "blocoConteudo") continue;
      if (options?.nodeId && node?.id !== options.nodeId) continue;
      const buttons = Array.isArray(node?.data?.buttons)
        ? node.data.buttons
        : [];

      for (let idx = 0; idx < buttons.length; idx++) {
        const btn = buttons[idx];
        if (btn.type !== "flow" && btn.type !== "reply") continue;
        const btnText = (btn.text || "").trim();
        if (!btnText) continue;

        const normalizedBtn = normalizeForMatch(btnText);
        if (!normalizedBtn) continue;

        const exactButtonHandleAliases = getExactButtonHandleAliases(idx, btn);
        const legacyButtonHandleAliases = getLegacyOneBasedButtonHandleAliases(idx);
        const buttonHandleAliases = [
          ...exactButtonHandleAliases,
          ...legacyButtonHandleAliases,
        ];
        const buttonIndexValues = [
          String(idx + 1),
          `btn-${idx + 1}`,
          `btn_${idx + 1}`,
          ...buttonHandleAliases,
        ];
        const normalizedIndexValues = buttonIndexValues
          .map((value) => normalizeForMatch(value))
          .filter(Boolean);

        const idxNormalized = normalizeForMatch(String(idx + 1));
        const didMatch = normalizedRaw === normalizedBtn ||
          normalizedMessage === normalizedBtn ||
          normalizedCandidates.has(normalizedBtn) ||
          exactButtonHandleAliases.some((alias) => explicitHandleCandidates.has(alias)) ||
          derivedIndexCandidates.has(idxNormalized) ||
          normalizedRaw === idxNormalized ||
          normalizedMessage === idxNormalized ||
          normalizedIndexValues.some((value) =>
            normalizedCandidates.has(value)
          );

        if (didMatch) {
          const buttonEdge = edges.find((e: any) =>
            e.source === node.id && exactButtonHandleAliases.includes(String(e.sourceHandle || ""))
          ) || edges.find((e: any) =>
            e.source === node.id && legacyButtonHandleAliases.includes(String(e.sourceHandle || ""))
          );

          if (!buttonEdge) {
            console.log(
              "⛔ Button reply matched text, but no specific button edge exists for this handle",
              {
                flowId: flow?.id,
                nodeId: node?.id,
                buttonText: btnText,
                exactButtonHandleAliases,
                legacyButtonHandleAliases,
              },
            );
            continue;
          }

          return {
            flow,
            targetNodeId: buttonEdge.target,
            buttonText: btnText,
            flowName: flow.name,
          };
        }
      }
    }
  }

  return null;
}
 async function upsertSavedContact(supabase: any, params: { userId: string; phone: string; name: string; photo?: string }) {
   const { userId, phone, name, photo } = params;
   if (!phone || (!name && !photo)) return;
   
   const updateData: any = { 
     user_id: userId, 
     phone, 
     updated_at: new Date().toISOString() 
   };
   
   if (name) updateData.name = name;
    if (photo && photo !== "undefined" && photo !== "null") {
      updateData.profile_picture_url = photo;
    } else {
      // If photo is missing, try to fetch it dynamically from Z-API
      try {
        const { data: profilePicData, error: profilePicError } = await supabase.functions.invoke('get-profile-picture', {
          body: { phone, instanceId: params.instanceId }
        });
        if (!profilePicError && profilePicData?.success && profilePicData?.data?.link) {
          updateData.profile_picture_url = profilePicData.data.link;
          console.log(`📸 Foto de perfil recuperada dinamicamente para ${phone}`);
        }
      } catch (e) {
        console.error(`⚠️ Erro ao buscar foto de perfil dinâmica para ${phone}:`, e);
      }
    }
 
   await supabase.from("saved_contacts").upsert(updateData, { onConflict: "phone,user_id" });
 }
 
 function extractMediaUrl(webhook: any): { url: string; type: string; caption: string } {
   const mediaTypes = ["image", "video", "audio", "document", "sticker"];
   for (const type of mediaTypes) {
     const obj = webhook?.[type] || webhook?.message?.[`${type}Message`] || webhook?.data?.[type];
     const url = obj?.url || obj?.[`${type}Url`] || (type === "audio" ? obj?.audioUrl : null);
     if (typeof url === "string" && url.trim().startsWith("http")) {
       return { url: url.trim(), type, caption: obj?.caption || "" };
     }
   }
   return { url: "", type: "", caption: "" };
 }

function extractAudioUrl(webhook: any): string {
  const candidates = [
    webhook?.audio?.audioUrl, webhook?.audio?.url, webhook?.audioMessage?.url, webhook?.message?.audioMessage?.url,
    webhook?.data?.audio?.audioUrl, webhook?.data?.audio?.url, webhook?.data?.audioMessage?.url, webhook?.data?.message?.audioMessage?.url,
    webhook?.waitingMessage?.audio?.audioUrl, webhook?.waitingMessage?.audioMessage?.url
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim().startsWith("http")) return value.trim();
  }
  return "";
}

async function transcribeAudio(audioUrl: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return "";
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) return "";
    const buffer = await res.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) binary += String.fromCharCode(uint8Array[i]);
    const base64Audio = btoa(binary);
    let mimeType = "audio/ogg";
    if (audioUrl.includes(".mp3")) mimeType = "audio/mpeg";
    else if (audioUrl.includes(".wav")) mimeType = "audio/wav";
    else if (audioUrl.includes(".m4a")) mimeType = "audio/mp4";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: "Transcreva fielmente." }, { role: "user", content: [{ type: "input_audio", input_audio: { data: base64Audio, format: mimeType === "audio/wav" ? "wav" : "mp3" } }, { type: "text", text: "Transcreva este áudio." }] }], stream: false })
    });
    if (!response.ok) return "";
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) { return ""; }
}

function extractMessageText(webhook: any): string {
  const candidates = [
     webhook?.text,
     webhook?.message?.text,
    webhook?.message?.conversation,
    webhook?.message?.extendedTextMessage?.text,
    webhook?.message?.imageMessage?.caption,
    webhook?.message?.videoMessage?.caption,
    webhook?.message?.documentMessage?.caption,

    // Interactive/button replies (Z-API variations)
    webhook?.buttonReply?.title,
    webhook?.buttonReply?.text,
    webhook?.buttonReply?.label,
    webhook?.buttonReply?.selectedDisplayText,
    webhook?.buttonReply?.selectedRowId,
    webhook?.buttonReply?.id,
    webhook?.message?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.message?.buttonResponseMessage?.selectedDisplayText,
    webhook?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.buttonsResponseMessage?.selectedButtonId,
    webhook?.buttonsResponseMessage?.selectedButtonText,
    webhook?.buttonsResponseMessage?.message,
    webhook?.buttonsResponseMessage?.text,
    webhook?.buttonResponseMessage?.selectedDisplayText,
    webhook?.buttonResponseMessage?.selectedButtonId,
    webhook?.listResponseMessage?.title,
    webhook?.listResponseMessage?.singleSelectReply?.selectedRowId,
    webhook?.interactiveResponse?.title,
    webhook?.interactiveResponse?.description,

    // send-button-actions response formats (Z-API)
    webhook?.title,
    webhook?.selectedButtonId,
    webhook?.response?.title,
    webhook?.response?.text,
    webhook?.response?.selectedDisplayText,
    webhook?.message?.interactiveResponseMessage?.body?.text,
    webhook?.message?.interactiveResponseMessage?.nativeFlowResponseMessage
      ?.paramsJson,
    webhook?.interactiveResponseMessage?.body?.text,
    webhook?.message?.templateButtonReplyMessage?.selectedDisplayText,
    webhook?.message?.templateButtonReplyMessage?.selectedId,
    webhook?.templateButtonReplyMessage?.selectedDisplayText,
    webhook?.templateButtonReplyMessage?.selectedId,
    webhook?.message?.listResponseMessage?.title,
    webhook?.message?.listResponseMessage?.singleSelectReply?.selectedRowId,

    webhook?.waitingMessage?.text,
    webhook?.waitingMessage?.message,
    webhook?.waitingMessage?.body,
    webhook?.waitingMessage?.buttonReply?.title,
    webhook?.waitingMessage?.buttonReply?.text,
    webhook?.waitingMessage?.buttonReply?.label,
    webhook?.waitingMessage?.buttonReply?.selectedDisplayText,

    webhook?.text?.message,
    typeof webhook?.text === "string" ? webhook.text : undefined,
    webhook?.body,
    typeof webhook?.message === "string" ? webhook.message : undefined,
    webhook?.conversation,
    webhook?.image?.caption,
    webhook?.video?.caption,
    webhook?.document?.caption,

    webhook?.data?.message?.text,
    webhook?.data?.message,
    webhook?.data?.text?.message,
    webhook?.data?.body,
    webhook?.data?.conversation,
    webhook?.data?.image?.caption,
    webhook?.data?.video?.caption,
    webhook?.data?.document?.caption,
    webhook?.data?.buttonReply?.title,
    webhook?.data?.buttonReply?.text,
    webhook?.data?.buttonReply?.label,
    webhook?.data?.buttonReply?.selectedDisplayText,
    webhook?.data?.waitingMessage?.text,
    webhook?.data?.waitingMessage?.message,
    webhook?.data?.waitingMessage?.body,
  ];

  const preferredDirectCandidate = pickPreferredInteractiveText(candidates);
  if (preferredDirectCandidate) return preferredDirectCandidate;

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const objectCandidates = [
    webhook?.text,
    webhook?.buttonReply,
    webhook?.message,
    webhook?.buttonsResponseMessage,
    webhook?.buttonResponseMessage,
    webhook?.waitingMessage,
    webhook?.data?.text,
    webhook?.data?.buttonReply,
    webhook?.data?.message,
    webhook?.data?.waitingMessage,
    webhook?.data?.buttonsResponseMessage,
  ];

  const fallbackKeys = [
    "text",
    "message",
    "body",
    "caption",
    "conversation",
    "title",
    "description",
    "label",
    "selectedDisplayText",
    "selectedButtonId",
    "selectedButtonText",
    "selectedRowId",
    "id",
  ];
  for (const candidate of objectCandidates) {
    if (!candidate || typeof candidate !== "object") continue;
    for (const key of fallbackKeys) {
      const value = candidate?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return "";
}

interface WebhookMessage {
  phone: string;
  message: {
    text?: string;
    fromMe: boolean;
  };
  instanceId?: string;
  timestamp: number;
}

interface FlowNode {
  id: string;
  type: string;
  position?: {
    x?: number;
    y?: number;
  };
  data: {
    content?: string;
    contentType?: string;
    mediaUrl?: string;
    buttonLabel?: string;
    buttonUrl?: string;
    actionType?: string;
    actionConfig?: string;
    condition?: string;
    conditionType?: string;
    collectName?: boolean;
    collectWhatsapp?: boolean;
    collectEmail?: boolean;
    namePrompt?: string;
    whatsappPrompt?: string;
    emailPrompt?: string;
    nameFollowUp?: string;
    whatsappFollowUp?: string;
    emailFollowUp?: string;
    buttons?: Array<{
      text?: string;
      type?: string;
      value?: string;
      id?: string | number | null;
    }>;
  };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface PendingCaptureState {
  flowId?: string;
  flowName?: string;
  nodeId: string;
  field: "name" | "whatsapp" | "email";
  instanceId?: string | null;
  captured?: {
    nome?: string;
    whatsapp?: string;
    email?: string;
  };
}

interface PendingButtonState {
  flowId?: string;
  flowName?: string;
  nodeId: string;
  instanceId?: string | null;
  buttons?: Array<{
    text: string;
    handleAliases: string[];
    index: number;
    menuIndex?: number;
  }>;
  captured?: {
    nome?: string;
    whatsapp?: string;
    email?: string;
  };
}

const FLOW_CAPTURE_PREFIX = "__flow_capture__:";
const FLOW_BUTTON_PREFIX = "__flow_button__:";

const isButtonHandle = (handle?: string | null) => {
  const normalized = String(handle || "").trim().toLowerCase();
  return normalized.startsWith("button-") ||
    normalized.startsWith("button_") ||
    normalized.startsWith("btn-") ||
    normalized.startsWith("btn_");
};

const getExactButtonHandleAliases = (idx: number, button?: { id?: string | number | null }) => {
  const aliases = new Set<string>([
    `button-${idx}`,
    `button_${idx}`,
    `btn-${idx}`,
    `btn_${idx}`,
  ]);

  const rawId = String(button?.id || "").trim();
  if (rawId) aliases.add(rawId);

  return Array.from(aliases);
};

const getLegacyOneBasedButtonHandleAliases = (idx: number) => {
  return [
    `button-${idx + 1}`,
    `button_${idx + 1}`,
    `btn-${idx + 1}`,
    `btn_${idx + 1}`,
  ];
};

const getButtonHandleAliases = (idx: number, button?: { id?: string | number | null }) => {
  return Array.from(new Set([
    ...getExactButtonHandleAliases(idx, button),
    ...getLegacyOneBasedButtonHandleAliases(idx),
  ]));
};

const normalizeParticipantIdentifier = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("@lid")) return raw;
  if (raw.includes("@c.us")) return raw.replace("@c.us", "").replace(/\D/g, "");
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : raw;
};

const extractParticipantArray = (payload: any) => {
  const candidates = [
    payload?.participants,
    payload?.members,
    payload?.groupParticipants,
    payload?.data?.participants,
    payload?.data?.members,
  ];

  return candidates.find(Array.isArray) || [];
};

const resolveLidFromParticipants = (participants: any[], targetLid: string) => {
  for (const participant of participants || []) {
    const identifiers = [
      participant?.phone,
      participant?.id,
      participant?.participant,
      participant?.jid,
      participant?.lid,
      participant?.participantLid,
      participant?.user,
      participant?.waId,
      participant?.number,
    ].map((value) => String(value || "").trim()).filter(Boolean);

    const matchesTarget = identifiers.some((value) => value === targetLid);
    if (!matchesTarget) continue;

    const resolved = identifiers
      .map((value) => normalizeParticipantIdentifier(value))
      .find((value) => value && !value.includes("@lid") && value.length >= 8);

    if (resolved) return resolved;
  }

  return "";
};

const normalizePhoneCandidate = (value: unknown) => {
  return String(value || "")
    .replace("@c.us", "")
    .replace("@s.whatsapp.net", "")
    .replace(/\D/g, "");
};

const normalizeGroupCampaignPhone = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("-group@g.us")) {
    return raw.replace(/-group@g\.us$/i, "@g.us");
  }
  if (raw.endsWith("-group")) return raw.replace(/-group$/i, "@g.us");
  return raw;
};

const normalizeInstanceIdentifier = (value: unknown) => {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
};

const resolveWebhookInstanceReference = (webhook: any) => {
  const raw = webhook?.instanceId || webhook?.instance_id || webhook?.instanceName || webhook?.instance_name || "";
  return {
    raw,
    normalized: normalizeInstanceIdentifier(raw),
  };
};

const isLikelyTechnicalIdentifier = (value: unknown) => {
  const raw = String(value || "").trim();
  const digits = normalizePhoneCandidate(raw);
  return !raw.includes("@") && /^\d{12,16}$/.test(digits) &&
    !digits.startsWith("55");
};

const buildLidCandidateFromTechnicalId = (value: unknown) => {
  const raw = String(value || "").trim();
  if (raw.includes("@lid")) return raw;
  const digits = normalizePhoneCandidate(raw);
  return /^\d{12,16}$/.test(digits) && !digits.startsWith("55")
    ? `${digits}@lid`
    : "";
};

const resolveWebhookPhone = (webhook: any) => {
  const rawPhone = String(webhook?.phone || "");
  const participantPhone = String(webhook?.participantPhone || "");
  const senderPhone = String(webhook?.senderPhone || "");
  const chatPhone = String(webhook?.chatPhone || "");
  const chatLid = String(webhook?.chatLid || "");
  const isGroupMessage = webhook?.isGroup === true;

  if (isGroupMessage) {
    return normalizeGroupCampaignPhone(rawPhone);
  }

  if (
    rawPhone && !rawPhone.includes("@lid") &&
    !isLikelyTechnicalIdentifier(rawPhone)
  ) return rawPhone;
  if (senderPhone && !senderPhone.includes("@lid")) return senderPhone;
  if (participantPhone && !participantPhone.includes("@lid")) {
    return participantPhone;
  }
  if (chatPhone && !chatPhone.includes("@lid")) return chatPhone;
  if (
    chatLid && chatLid.includes("@lid") && isLikelyTechnicalIdentifier(rawPhone)
  ) return chatLid;
  if (rawPhone && isLikelyTechnicalIdentifier(rawPhone)) {
    return buildLidCandidateFromTechnicalId(rawPhone) || rawPhone;
  }
  if (rawPhone && !rawPhone.includes("@lid")) return rawPhone;

  return rawPhone || participantPhone || chatLid || "";
};

const parseBooleanLike = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
};

const resolveFromMe = (webhook: any): boolean => {
  const candidates = [
    webhook?.message?.fromMe,
    webhook?.fromMe,
    webhook?.data?.fromMe,
    webhook?.data?.message?.fromMe,
    webhook?.waitingMessage?.fromMe,
    webhook?.message?.key?.fromMe,
    webhook?.data?.message?.key?.fromMe,
    webhook?.key?.fromMe,
    webhook?.isFromMe,
    webhook?.data?.isFromMe,
  ];

  for (const candidate of candidates) {
    const parsed = parseBooleanLike(candidate);
    if (parsed !== null) return parsed;
  }

  const connectedPhone = normalizePhoneCandidate(webhook?.connectedPhone);
  const senderPhone = normalizePhoneCandidate(webhook?.senderPhone);
  const participantPhone = normalizePhoneCandidate(webhook?.participantPhone);

  if (connectedPhone) {
    if (senderPhone && senderPhone === connectedPhone) return true;
    if (participantPhone && participantPhone === connectedPhone) return true;
  }

  return false;
};

const mapCampaignSendStatusFromWebhook = (
  webhook: any,
): "sent" | "delivered" | "read" | null => {
  const webhookType = String(webhook?.type || "");
  const webhookStatus = String(webhook?.status || "").toUpperCase();
  const fromMe = resolveFromMe(webhook);

  if (webhookType === "DeliveryCallback") {
    if (webhookStatus === "RECEIVED" || webhookStatus === "DELIVERED") {
      return "delivered";
    }
    if (webhookStatus === "READ" || webhookStatus === "PLAYED") {
      return "read";
    }
    return "sent";
  }
  if (webhookType === "MessageStatusCallback") {
    // SENT means it left pending and is in sending state; it is NOT delivery.
    if (webhookStatus === "SENT") return "sent";
    if (webhookStatus === "RECEIVED" || webhookStatus === "DELIVERED") {
      return "delivered";
    }
    if (webhookStatus === "READ" || webhookStatus === "PLAYED") {
      return "read";
    }
  }
  // For ReceivedCallback with fromMe: treat as delivery confirmation
  // For groups, fromMe callbacks WITH text are the normal delivery pattern
  // For contacts, only treat as status update if no text content (pure status callback)
  if (webhookType === "ReceivedCallback" && fromMe) {
    const phone = resolveWebhookPhone(webhook);
    const isGroup = phone?.includes("@g.us") || phone?.includes("-group");

    if (isGroup || phone?.includes("@lid") || buildLidCandidateFromTechnicalId(webhook?.phone)) {
      if (webhookStatus === "RECEIVED" || webhookStatus === "DELIVERED") return "delivered";
      if (webhookStatus === "READ" || webhookStatus === "PLAYED") return "read";
      return "sent";
    }

    const hasTextContent = Boolean(
      webhook?.text?.message || webhook?.text || webhook?.body ||
        webhook?.message?.text || webhook?.message?.conversation ||
        webhook?.message?.extendedTextMessage?.text,
    );
    if (!hasTextContent) {
      if (webhookStatus === "SENT") return "sent";
      if (webhookStatus === "RECEIVED" || webhookStatus === "DELIVERED") {
        return "delivered";
      }
    }
  }

  return null;
};

const isAdminParticipant = (participant: any) => {
  const adminRole = String(participant?.admin || participant?.role || "")
    .toLowerCase();
  return Boolean(
    participant?.isAdmin ||
      participant?.isSuperAdmin ||
      participant?.isSuperadmin ||
      adminRole === "admin" ||
      adminRole === "superadmin" ||
      adminRole === "super_admin",
  );
};

const inferCountryCode = (value: unknown) => {
  const digits = normalizePhoneCandidate(value);
  if (digits.length >= 12) {
    return digits.slice(0, digits.length - 11);
  }
  return "";
};

const expandPhoneCandidates = (values: unknown[], referencePhone?: unknown) => {
  const countryCode = inferCountryCode(referencePhone);
  const unique = new Set<string>();
  const expanded: string[] = [];

  for (const value of values) {
    const digits = normalizePhoneCandidate(value);
    if (digits.length < 8) continue;

    const variants = [digits];
    if (
      countryCode && digits.length >= 10 && digits.length <= 11 &&
      !digits.startsWith(countryCode)
    ) {
      variants.unshift(`${countryCode}${digits}`);
    }

    for (const variant of variants) {
      if (variant.length < 10 || variant.length > 15 || unique.has(variant)) {
        continue;
      }
      unique.add(variant);
      expanded.push(variant);
    }
  }

  return expanded;
};

const resolveCreateGroupPhones = async (
  baseUrl: string,
  headers: Record<string, string>,
  phones: string[],
) => {
  const uniquePhones = Array.from(
    new Set(phones.filter((phone) => phone.length >= 10 && phone.length <= 15)),
  );
  if (uniquePhones.length === 0) return [];

  try {
    const response = await fetch(`${baseUrl}/phone-exists-batch`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phones: uniquePhones }),
    });

    const raw = await response.text();
    const data = JSON.parse(raw);
    const normalized = (Array.isArray(data) ? data : [])
      .filter((item: any) => item?.exists)
      .map((item: any) =>
        normalizePhoneCandidate(item?.outputPhone || item?.inputPhone || "")
      )
      .filter((phone: string) => phone.length >= 10 && phone.length <= 15);

    return Array.from(new Set(normalized));
  } catch (error) {
    console.error("❌ Failed to validate auto-create phones:", error);
    return uniquePhones;
  }
};

const TEMP_PARTICIPANT_PHONE = "5518981939571";

const WHATSAPP_VERIFY_TOKEN = "zaplynx_whatsapp_verify_2024";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Meta webhook verification (GET request)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("📋 WhatsApp webhook verification:", {
      mode,
      token,
      challenge,
    });

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("✅ WhatsApp webhook verified");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.error("❌ WhatsApp webhook verification failed");
    return new Response("Forbidden", { status: 403 });
  }

  let processingLockId: string | null = null;

  try {
    console.log("Webhook recebido - Method:", req.method);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();
    let webhook: any;

    try {
      webhook = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("Payload JSON inválido:", parseError);
      return new Response("invalid_json", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // === REVOKED MESSAGE DETECTION ===
    if (webhook?.type === "OnMessageRevoked") {
      const revokedMessageId = webhook?.data?.messageId || webhook?.messageId;
      if (revokedMessageId) {
        console.log(`🗑️ Mensagem revogada detectada: ${revokedMessageId}`);
        await supabase
          .from("message_logs")
          .delete()
          .or(`keyword_matched.eq.__msg_import__:${revokedMessageId},message_received.ilike.%[msgid:${revokedMessageId}]%,response_sent.ilike.%[msgid:${revokedMessageId}]%`);
      }
      return new Response("revoked_handled", { status: 200, headers: corsHeaders });
    }


    // === GROUP PARTICIPANT JOIN DETECTION ===
    // Z-API sends group join events in multiple formats:
    // 1. action/event: 'add'/'join'
    // 2. status: 'MEMBER_ADD'
    // 3. type: 'notification' with code 27 (added) or 32 (joined via link)
    const webhookAction = webhook?.action || webhook?.event || "";
    const webhookType = webhook?.type || "";
    const notificationCode = webhook?.code || webhook?.notification?.code || "";
    const notificationText = String(
      webhook?.notification || webhook?.notification?.text || "",
    ).toLowerCase();
    const notificationParams = webhook?.notificationParameters ||
      webhook?.notification?.parameters || [];
    const hasParticipantHint = Boolean(
      webhook?.participantPhone ||
        webhook?.participant ||
        webhook?.participantLid ||
        webhook?.groupParticipant?.phone ||
        (Array.isArray(notificationParams) && notificationParams.length > 0),
    );
    const isStatusCallback = webhookType === "MessageStatusCallback" ||
      Array.isArray(webhook?.ids);
    const noTextPayload = !webhook?.text?.message && !webhook?.message?.text &&
      !webhook?.body && !webhook?.caption;

    const isDirectJoinAction = webhookAction === "add" ||
      webhookAction === "join" ||
      webhook?.status === "MEMBER_ADD" ||
      webhook?.groupParticipant?.action === "add" ||
      webhook?.participantAction === "add";

    // Z-API notification format: code 27=added, 32=joined via invite link
    // The event type can be 'notification' OR 'ReceivedCallback' with notification/code fields
    const hasNotificationCode = ["27", "32"].includes(String(notificationCode));
    const hasJoinNotificationText = [
      "entrou",
      "joined",
      "added",
      "adicionado",
      "adicionou",
      "invite",
      "convite",
    ].some((term) => notificationText.includes(term));
    const hasLeaveNotificationText = [
      "leave",
      "left",
      "remove",
      "removed",
      "removeu",
      "saiu",
      "group_participant_leave",
    ].some((term) => notificationText.includes(term));
    const isNotificationJoin = webhook?.isGroup === true &&
      !isStatusCallback &&
      noTextPayload &&
      !hasLeaveNotificationText &&
      (
        hasNotificationCode ||
        ((webhookType === "notification" ||
          webhookType === "ReceivedCallback" || !!webhook?.notification) &&
          (hasParticipantHint || hasJoinNotificationText ||
            webhook?.senderName === "invite"))
      );

    const isParticipantEvent = isDirectJoinAction || isNotificationJoin;

    if (isParticipantEvent) {
      console.log(
        "👋 Group participant JOIN event detected:",
        JSON.stringify({
          type: webhookType,
          action: webhookAction,
          code: notificationCode,
          notification: webhook?.notification,
          notificationParameters: notificationParams,
          participantPhone: webhook?.participantPhone,
          participant: webhook?.participant,
          senderName: webhook?.senderName,
          phone: webhook?.phone,
          instanceId: webhook?.instanceId || webhook?.instance_id,
        }).substring(0, 800),
      );

      const groupPhone = webhook?.phone || webhook?.chatPhone ||
        webhook?.groupId || "";
      const connectedPhone = String(webhook?.connectedPhone || "").replace(
        /\D/g,
        "",
      );

      // For notification events, the joined phone is in notificationParameters or participantPhone
      let joinedPhone = normalizeParticipantIdentifier(
        webhook?.participantPhone || webhook?.participant ||
          webhook?.senderPhone || webhook?.groupParticipant?.phone || "",
      );
      // notificationParameters typically contains the phone(s) of added participants
      if (
        !joinedPhone && Array.isArray(notificationParams) &&
        notificationParams.length > 0
      ) {
        joinedPhone = normalizeParticipantIdentifier(notificationParams[0]);
      }

      const joinedName = webhook?.participantName || webhook?.senderName ||
        webhook?.groupParticipant?.name || "";
      const eventInstanceId = webhook?.instanceId || webhook?.instance_id || "";

      if (groupPhone && eventInstanceId) {
        // Find user by instanceId (normalized matching)
        const normalizedEventId = normalizeInstanceIdentifier(eventInstanceId);
        const { data: allActiveInstances } = await supabase
          .from("zapi_instances")
          .select("user_id, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key")
          .eq("is_active", true);

        const instData = (allActiveInstances || []).find((item: any) =>
          normalizeInstanceIdentifier(item?.zapi_instance_id) ===
            normalizedEventId
        );

        if (instData) {
          // Normalize group ID
          let normalizedGroupId = groupPhone;
          if (groupPhone.includes("@g.us")) {
            normalizedGroupId = groupPhone.replace("@g.us", "-group");
          } else if (!groupPhone.includes("-group")) {
            normalizedGroupId = groupPhone + "-group";
          }

          const metadataHeaders = {
            "Content-Type": "application/json",
            "Client-Token": instData.zapi_client_token,
          };

          const fetchGroupMetadata = async () => {
            const groupCandidates = [
              normalizedGroupId,
              normalizedGroupId.replace(/-group$/i, "@g.us"),
            ];
            for (const candidate of groupCandidates) {
              const metadataResponse = await fetch(
                `https://api.z-api.io/instances/${instData.zapi_instance_id}/token/${instData.zapi_token}/group-metadata/${candidate}`,
                { method: "GET", headers: metadataHeaders },
              );

              if (!metadataResponse.ok) {
                console.log(
                  `⚠️ Failed loading group metadata for ${candidate}:`,
                  metadataResponse.status,
                  await metadataResponse.text(),
                );
                continue;
              }

              return await metadataResponse.json();
            }

            return null;
          };

          if (joinedPhone.includes("@lid")) {
            const lidIdentifier = joinedPhone;

            const { data: existingMap } = await supabase
              .from("message_logs")
              .select("phone")
              .eq("user_id", instData.user_id)
              .eq("keyword_matched", "__lid_map__")
              .eq("message_received", lidIdentifier)
              .limit(1)
              .maybeSingle();

            if (existingMap?.phone) {
              joinedPhone = String(existingMap.phone).replace(/\D/g, "");
              console.log(
                `✅ Resolved join participant LID from cache: ${lidIdentifier} → ${joinedPhone}`,
              );
            } else {
              try {
                const metadata = await fetchGroupMetadata();
                if (metadata) {
                  const resolvedPhone = resolveLidFromParticipants(
                    extractParticipantArray(metadata),
                    lidIdentifier,
                  );
                  if (resolvedPhone) {
                    joinedPhone = resolvedPhone;
                    console.log(
                      `✅ Resolved join participant LID from group metadata: ${lidIdentifier} → ${joinedPhone}`,
                    );
                  }
                }
              } catch (resolveError) {
                console.error(
                  "❌ Error resolving join participant LID:",
                  resolveError,
                );
              }
            }
          }

          const canHandleParticipant = !!joinedPhone &&
            !joinedPhone.includes("@lid") && joinedPhone.length >= 8;

          if (!canHandleParticipant) {
            console.log(
              "⚠️ Group join detected but participant phone could not be resolved:",
              JSON.stringify({
                joinedPhone,
                notificationParameters: notificationParams,
                participantPhone: webhook?.participantPhone,
                participant: webhook?.participant,
                groupId: normalizedGroupId,
              }),
            );

            // Diagnóstico: mesmo sem resolver telefone, verificar se há config para esse grupo
            const { data: diagConfig } = await supabase
              .from("group_welcome_config")
              .select("id, active, response_type")
              .eq("user_id", instData.user_id)
              .eq("group_id", normalizedGroupId)
              .maybeSingle();
            if (diagConfig) {
              console.log(
                `🔎 [welcome-diag] Config existe para ${normalizedGroupId} (active=${diagConfig.active}, type=${diagConfig.response_type}) mas o telefone do novo membro não foi resolvido. Webhook completo:`,
                JSON.stringify(webhook).substring(0, 1500),
              );
            } else {
              console.log(
                `🔎 [welcome-diag] Sem config de boas-vindas para grupo ${normalizedGroupId} (user ${instData.user_id})`,
              );
            }
          }

          if (canHandleParticipant) {
            // Check if welcome message is configured for this group
            const { data: welcomeConfig } = await supabase
              .from("group_welcome_config")
              .select("*")
              .eq("user_id", instData.user_id)
              .eq("group_id", normalizedGroupId)
              .eq("active", true)
              .maybeSingle();

            if (welcomeConfig) {
              console.log(
                "✅ Group welcome config found for group:",
                normalizedGroupId,
                "type:",
                welcomeConfig.response_type,
              );
            } else {
              console.log(
                `🔎 [welcome-diag] Telefone resolvido (${joinedPhone}) mas SEM config ativa para grupo ${normalizedGroupId} (user ${instData.user_id})`,
              );
            }

            if (welcomeConfig) {

              // === DEDUPLICATION: Prevent duplicate welcome messages from multiple instances ===
              const dedupeWindow = new Date(Date.now() - 60 * 1000)
                .toISOString();
              const { data: recentWelcome } = await supabase
                .from("message_logs")
                .select("id")
                .eq("user_id", instData.user_id)
                .eq("phone", joinedPhone)
                .eq("keyword_matched", "__group_welcome__")
                .gte("created_at", dedupeWindow)
                .limit(1)
                .maybeSingle();

              if (recentWelcome) {
                console.log(
                  "⚠️ Duplicate group welcome blocked for",
                  joinedPhone,
                  "in group",
                  normalizedGroupId,
                  "(already sent in last 60s)",
                );
                return new Response("group_welcome_deduplicated", {
                  status: 200,
                  headers: corsHeaders,
                });
              }

              const responseType = welcomeConfig.response_type || "text";

              // If a specific instance_id is configured, use that instance's credentials
              let sendInstData = instData;
              if (welcomeConfig.instance_id) {
                const { data: overrideInst } = await supabase
                  .from("zapi_instances")
                  .select("zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key")
                  .eq("user_id", instData.user_id)
                  .eq("id", welcomeConfig.instance_id)
                  .eq("is_active", true)
                  .maybeSingle();
                if (overrideInst) {
                  console.log(
                    "🔄 Using override instance for welcome:",
                    welcomeConfig.instance_id,
                  );
                  sendInstData = { ...instData, ...overrideInst };
                } else {
                  console.log(
                    "⚠️ Override instance not found or inactive, using original",
                  );
                }
              }

              const buildWelcomeTransport = (providerInstance: any) => {
                const providerBaseUrl = `https://api.z-api.io/instances/${providerInstance?.zapi_instance_id}/token/${providerInstance?.zapi_token}`;
                const providerHeaders = { "Content-Type": "application/json", "Client-Token": providerInstance?.zapi_client_token };
                return { providerBaseUrl, providerHeaders };
              };

              const parseWelcomeResponse = async (res: Response, context: string) => {
                const raw = await res.text();
                let payload: any = null;
                try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { raw }; }
                const ack = payload?.messageId || payload?.zapiMessageId || payload?.zaapId || payload?.id || payload?.key?.id || payload?.message?.id || null;
                const status = String(payload?.status || payload?.messageStatus || payload?.state || "").toLowerCase();
                const confirmed = Boolean(ack || ["success", "sent", "queued", "accepted", "ok"].includes(status));
                console.log(`${context}: status=${res.status} confirmed=${confirmed} ack=${ack || "none"}`);
                if (!res.ok || !confirmed) throw new Error(`Envio falhou (${context})`);
                return payload;
              };

              const dispatchWelcome = async (providerInstance: any, payload: any, context: string) => {
                const { providerBaseUrl, providerHeaders } = buildWelcomeTransport(providerInstance);
                let endpoint = "/send-text";
                let body: any = { phone: joinedPhone };
                if (payload.type === "text") {
                  body.message = payload.message;
                } else if (payload.type === "buttons") {
                  endpoint = "/send-button-list";
                  body.message = payload.message;
                  body.buttonList = { buttons: payload.buttons.map((b: any) => ({ label: b.label })) };
                } else {
                  const epMap: any = { image: "/send-image", video: "/send-video", audio: "/send-audio", catalog: "/send-message-catalog", contact: "/send-contact" };
                  endpoint = epMap[payload.kind];
                  if (payload.kind === "catalog") {
                    body.catalogId = payload.catalogId;
                    body.productId = payload.productId;
                    body.body = payload.caption;
                  } else if (payload.kind === "contact") {
                    body.contactName = payload.contactName;
                    body.contactPhone = payload.contactPhone;
                    body.contactBusinessDescription = payload.caption;
                  } else {
                    body[payload.kind] = payload.file;
                    body.caption = payload.caption;
                  }
                }
                const res = await fetch(`${providerBaseUrl}${endpoint}`, { method: "POST", headers: providerHeaders, body: JSON.stringify(body) });
                return await parseWelcomeResponse(res, context);
              };

              const sendWelcomeWithFallback = async (
                payload:
                  | { type: "text"; message: string }
                  | { type: "media"; kind: "image" | "video" | "audio"; file: string; caption: string }
                | { type: "buttons"; message: string; buttons: any[] }
                | { type: "carousel"; message: string; cards: any[] }
                | { type: "catalog"; productId: string; catalogId: string; caption: string }
                | { type: "contact"; contactName: string; contactPhone: string; caption: string },
                context: string,
              ) => {
                try {
                  return await dispatchWelcome(sendInstData, payload, context);
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err || "");
                  const shouldFallback = Boolean(
                    welcomeConfig.instance_id &&
                      sendInstData?.zapi_instance_id !== instData?.zapi_instance_id &&
                      /instance not found/i.test(errorMessage),
                  );
                  if (!shouldFallback) throw err;

                  console.warn(
                    "⚠️ Welcome override instance failed with Instance not found; retrying with group source instance",
                    { override: sendInstData?.zapi_instance_id, source: instData?.zapi_instance_id },
                  );
                  return await dispatchWelcome(instData, payload, `${context} fallback`);
                }
              };

              const sendWelcomeText = async (message: string) =>
                sendWelcomeWithFallback({ type: "text", message }, "Welcome text");

              const sendWelcomeMedia = async (
                kind: "image" | "video" | "audio",
                file: string,
                caption: string,
              ) => sendWelcomeWithFallback({ type: "media", kind, file, caption }, `Welcome ${kind}`);

              const sendWelcomeButtons = async (message: string, btns: any[]) =>
                sendWelcomeWithFallback({ type: "buttons", message, buttons: btns }, "Welcome buttons");

              const sendWelcomeCarousel = async (message: string, cards: any[]) =>
                sendWelcomeWithFallback({ type: "carousel", message, cards }, "Welcome carousel");

              const sendWelcomeContact = async (name: string, phone: string, caption: string) =>
                sendWelcomeWithFallback({ type: "contact", contactName: name, contactPhone: phone, caption }, "Welcome contact");

              const sendWelcomeCatalog = async (productId: string, catalogId: string, caption: string) =>
                sendWelcomeWithFallback({ type: "catalog", productId, catalogId, caption }, "Welcome catalog");

              if (responseType === "flow" && welcomeConfig.flow_id) {
                // Trigger the flow for this contact by invoking webhook-zapi recursively with a virtual message
                const { data: flowData } = await supabase
                  .from("flow_automations")
                  .select("keyword")
                  .eq("id", welcomeConfig.flow_id)
                  .eq("user_id", instData.user_id)
                  .eq("active", true)
                  .maybeSingle();

                if (flowData?.keyword) {
                  // Send a virtual trigger to webhook-zapi itself
                  const selfUrl = Deno.env.get("SUPABASE_URL") +
                    "/functions/v1/webhook-zapi";
                  await fetch(selfUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      phone: joinedPhone,
                      message: { text: flowData.keyword, fromMe: false },
                      instanceId: instData.zapi_instance_id,
                      senderName: joinedName,
                      __manual_flow_trigger__: true,
                    }),
                  });
                  console.log(
                    "🔄 Flow triggered for group welcome:",
                    flowData.keyword,
                    "→",
                    joinedPhone,
                  );
                }

                await supabase.from("message_logs").insert({
                  phone: joinedPhone,
                  message_received: null,
                  response_sent: `[fluxo:${welcomeConfig.flow_id}]`,
                  keyword_matched: "__group_welcome__",
                  timestamp: new Date().toISOString(),
                  user_id: instData.user_id,
                  instance_id: instData.zapi_instance_id,
                });
              } else if (
                responseType === "template" && welcomeConfig.template_id
              ) {
                // Load template and send its content
                const { data: tpl } = await supabase
                  .from("message_templates")
                  .select("content, media_url, type, buttons, header, footer, carousel_cards")
                  .eq("id", welcomeConfig.template_id)
                  .maybeSingle();

                if (tpl) {
                  let tplMessage = (tpl.content || "")
                    .replace(/\{\{nome\}\}/gi, joinedName || "novo membro")
                    .replace(/\{\{telefone\}\}/gi, joinedPhone)
                    .replace(
                      /\{\{grupo\}\}/gi,
                      welcomeConfig.group_name || "grupo",
                    );

                  const rawButtons = Array.isArray(tpl.buttons)
                    ? tpl.buttons
                    : [];
                  const formattedButtons = rawButtons
                    .map((btn: any) => {
                      const btnType = String(
                        btn?.type || (btn?.url || btn?.value ? "url" : "reply"),
                      ).toUpperCase();
                      const label = btn?.text || btn?.label || "Acessar";

                      if (!label) return null;

                      const buttonData: any = { label };

                      if (btnType === "CALL") {
                        const phoneValue = btn?.phone || btn?.value || "";
                        if (!phoneValue) return null;
                        buttonData.type = "CALL";
                        buttonData.phone = phoneValue;
                      } else if (btnType === "REPLY" || btnType === "OPTION") {
                        buttonData.type = "REPLY";
                      } else if (btnType === "COPY") {
                        const copyValue = btn?.copyText || btn?.value || "";
                        if (!copyValue) return null;
                        buttonData.type = "URL";
                        buttonData.url =
                          `https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=${
                            encodeURIComponent(copyValue)
                          }`;
                      } else {
                        const urlValue = btn?.url || btn?.value || "";
                        if (!urlValue) return null;
                        buttonData.type = "URL";
                        buttonData.url = urlValue;
                      }

                      if (btn?.id) {
                        buttonData.id = btn.id;
                      }

                      return buttonData;
                    })
                    .filter(Boolean)
                    .slice(0, 3);

                  const canSendInteractiveButtons =
                    formattedButtons.length > 0 &&
                    !(tpl.media_url &&
                      (tpl.type === "video" || tpl.type === "vídeo" ||
                        tpl.type === "audio" || tpl.type === "áudio"));

                  // Build reply buttons and URL/CALL text suffix
                  const replyBtns = formattedButtons.filter((b: any) =>
                    b.type === "REPLY"
                  ).slice(0, 3);
                  const urlCallParts: string[] = [];
                  for (const b of formattedButtons) {
                    if (b.type === "URL" && b.url) {
                      urlCallParts.push(`🔗 ${b.label}: ${b.url}`);
                    }
                    if (b.type === "CALL" && b.phone) {
                      urlCallParts.push(`📞 ${b.label}: ${b.phone}`);
                    }
                  }
                  const urlCallSuffix = urlCallParts.length > 0
                    ? "\n\n" + urlCallParts.join("\n")
                    : "";

                  const carouselCards = Array.isArray((tpl as any).carousel_cards)
                    ? (tpl as any).carousel_cards
                    : [];
                  const normalizedTemplateType = String(tpl.type || "")
                    .trim()
                    .toLowerCase();
                  const isCarousel = carouselCards.length > 0 &&
                    (normalizedTemplateType === "carrossel" ||
                      normalizedTemplateType === "carousel" ||
                      normalizedTemplateType.includes("carrossel"));

                  const isProduct = normalizedTemplateType === "produto" || normalizedTemplateType === "product";
                  const isContact = normalizedTemplateType === "contato" || normalizedTemplateType === "contact" || normalizedTemplateType === "contato (vcard)";

                  if (isContact) {
                    const special = parseSpecialTemplate(tpl.content);
                    const contactName = special?.contactName || (tpl as any)?.contactName || "";
                    const contactPhone = special?.contactPhone || (tpl as any)?.contactPhone || "";
                    const sendResponse = await sendWelcomeContact(
                      contactName,
                      contactPhone,
                      special?.description || special?.contactBusinessDescription || ""
                    );
                    console.log(
                      "📤 Welcome template contact confirmed:",
                      JSON.stringify(sendResponse).substring(0, 300),
                    );
                  } else if (isProduct) {
                    const special = parseSpecialTemplate(tpl.content);
                    const productId = special?.productId || "";
                    const catalogId = special?.catalogId || "";
                    const sendResponse = await sendWelcomeCatalog(
                      productId,
                      catalogId,
                      tplMessage
                    );
                    console.log(
                      "📤 Welcome template product confirmed:",
                      JSON.stringify(sendResponse).substring(0, 300),
                    );
                  } else if (isCarousel) {
                    const carouselResponse = await sendWelcomeCarousel(
                      tplMessage,
                      carouselCards,
                    );
                    console.log(
                      "📤 Welcome template carousel confirmed:",
                      JSON.stringify(carouselResponse).substring(0, 300),
                    );
                  } else if (
                    tpl.media_url &&
                    (tpl.type === "imagem" || tpl.type === "image") &&
                    canSendInteractiveButtons
                  ) {
                    // Send image first, then buttons
                    await sendWelcomeMedia("image", tpl.media_url, "");
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    if (replyBtns.length > 0) {
                      const buttonResponse = await sendWelcomeButtons(
                        tplMessage + urlCallSuffix,
                        replyBtns,
                      );
                      console.log(
                        "📤 Welcome template image+buttons confirmed:",
                        JSON.stringify(buttonResponse).substring(0, 300),
                      );
                    } else {
                      const buttonResponse = await sendWelcomeText(
                        tplMessage + urlCallSuffix,
                      );
                      console.log(
                        "📤 Welcome template image+text-buttons confirmed:",
                        JSON.stringify(buttonResponse).substring(0, 300),
                      );
                    }
                  } else if (!tpl.media_url && canSendInteractiveButtons) {
                    if (replyBtns.length > 0) {
                      const buttonResponse = await sendWelcomeButtons(
                        tplMessage + urlCallSuffix,
                        replyBtns,
                      );
                      console.log(
                        "📤 Welcome template text+buttons confirmed:",
                        JSON.stringify(buttonResponse).substring(0, 300),
                      );
                    } else {
                      const buttonResponse = await sendWelcomeText(
                        tplMessage + urlCallSuffix,
                      );
                      console.log(
                        "📤 Welcome template text-only-buttons confirmed:",
                        JSON.stringify(buttonResponse).substring(0, 300),
                      );
                    }
                  } else if (
                    tpl.media_url &&
                    (tpl.type === "imagem" || tpl.type === "image")
                  ) {
                    const sendResponse = await sendWelcomeMedia(
                      "image",
                      tpl.media_url,
                      tplMessage,
                    );
                    console.log(
                      "📤 Welcome template image confirmed:",
                      JSON.stringify(sendResponse).substring(0, 300),
                    );
                  } else if (
                    tpl.media_url &&
                    (tpl.type === "video" || tpl.type === "vídeo")
                  ) {
                    const sendResponse = await sendWelcomeMedia(
                      "video",
                      tpl.media_url,
                      tplMessage,
                    );
                    console.log(
                      "📤 Welcome template video confirmed:",
                      JSON.stringify(sendResponse).substring(0, 300),
                    );
                  } else if (
                    tpl.media_url &&
                    (tpl.type === "audio" || tpl.type === "áudio")
                  ) {
                    const audioResponse = await sendWelcomeMedia(
                      "audio",
                      tpl.media_url,
                      "",
                    );
                    console.log(
                      "📤 Welcome template audio confirmed:",
                      JSON.stringify(audioResponse).substring(0, 300),
                    );
                    if (tplMessage) {
                      const textResponse = await sendWelcomeText(tplMessage);
                      console.log(
                        "📤 Welcome template text-after-audio confirmed:",
                        JSON.stringify(textResponse).substring(0, 300),
                      );
                    }
                  } else {
                    const textResponse = await sendWelcomeText(tplMessage);
                    console.log(
                      "📤 Welcome template text confirmed:",
                      JSON.stringify(textResponse).substring(0, 300),
                    );
                  }

                  console.log("📋 Template welcome sent to", joinedPhone);
                  // Build a readable log of what was sent
                  let logContent = tplMessage || "";
                  if (isCarousel) {
                    const cardCount = carouselCards.length;
                    logContent = `[carrossel: ${cardCount} cards]` + (logContent ? `\n${logContent}` : "");
                  } else if (tpl.media_url) {
                    const mediaTag = `[media:${
                      tpl.type === "imagem" || tpl.type === "imagem_botoes"
                        ? "image"
                        : tpl.type === "video" || tpl.type === "video_botoes"
                        ? "video"
                        : tpl.type === "audio" || tpl.type === "áudio"
                        ? "audio"
                        : "document"
                    }:${tpl.media_url}]`;
                    logContent = logContent
                      ? `${mediaTag}\n${logContent}`
                      : mediaTag;
                  }
                  if (rawButtons.length > 0) {
                    const btnLabels = rawButtons.map((b: any) =>
                      b?.text || b?.label || ""
                    ).filter(Boolean);
                    if (btnLabels.length > 0) {
                      logContent += `\n[Botões: ${btnLabels.join(" | ")}]`;
                    }
                  }

                  await supabase.from("message_logs").insert({
                    phone: joinedPhone,
                    message_received: null,
                    response_sent: logContent || `Modelo: ${welcomeConfig.template_id}`,
                    keyword_matched: "__group_welcome__",
                    timestamp: new Date().toISOString(),
                    user_id: instData.user_id,
                    instance_id: instData.zapi_instance_id,
                  });
                }
              } else {
                // Default: plain text message
                let finalMessage = welcomeConfig.message
                  .replace(/\{\{nome\}\}/gi, joinedName || "novo membro")
                  .replace(/\{\{telefone\}\}/gi, joinedPhone)
                  .replace(
                    /\{\{grupo\}\}/gi,
                    welcomeConfig.group_name || "grupo",
                  );

                const textResponse = await sendWelcomeText(finalMessage);
                console.log(
                  "📤 Welcome text confirmed:",
                  JSON.stringify(textResponse).substring(0, 300),
                );

                console.log("📨 Text welcome sent to", joinedPhone);

                await supabase.from("message_logs").insert({
                  phone: joinedPhone,
                  message_received: null,
                  response_sent: finalMessage,
                  keyword_matched: "__group_welcome__",
                  timestamp: new Date().toISOString(),
                  user_id: instData.user_id,
                  instance_id: instData.zapi_instance_id,
                });
              }
            }

            // === LOG GROUP JOIN EVENT ===
            // Find redirect link for this group to associate the join
            let joinRedirectLinkId: string | null = null;
            try {
              const { data: rlg } = await supabase
                .from("redirect_link_groups")
                .select("redirect_link_id, group_name")
                .eq("group_id", normalizedGroupId)
                .limit(1)
                .maybeSingle();
              if (rlg) joinRedirectLinkId = rlg.redirect_link_id;
            } catch {}

            await supabase.from("message_logs").insert({
              phone: joinedPhone,
              message_received: normalizedGroupId,
              response_sent: joinedName || "",
              keyword_matched: "__group_join__",
              timestamp: new Date().toISOString(),
              user_id: instData.user_id,
              instance_id: instData.zapi_instance_id,
            });
            console.log(
              `📝 Logged group join: ${joinedPhone} → ${normalizedGroupId}`,
            );

            // === REDIRECT LINK AUTOMATION ===
            // If no per-group welcome was sent, check if the redirect link has automation
            try {
              const { data: rlgData } = await supabase
                .from("redirect_link_groups")
                .select("redirect_link_id, group_name")
                .eq("group_id", normalizedGroupId)
                .limit(1)
                .maybeSingle();

              if (rlgData) {
                const { data: redirectLink } = await supabase
                  .from("redirect_links")
                  .select("*")
                  .eq("id", rlgData.redirect_link_id)
                  .eq("active", true)
                  .maybeSingle();

                if (redirectLink) {
                  const rlWelcomeType = redirectLink.welcome_type || "none";
                  const groupName = rlgData.group_name || "grupo";

                  // Check if per-group welcome already sent (dedup)
                  const dedupeWindow2 = new Date(Date.now() - 60 * 1000)
                    .toISOString();
                  const { data: alreadySent } = await supabase
                    .from("message_logs")
                    .select("id")
                    .eq("user_id", instData.user_id)
                    .eq("phone", joinedPhone)
                    .eq("keyword_matched", "__group_welcome__")
                    .gte("created_at", dedupeWindow2)
                    .limit(1)
                    .maybeSingle();

                  if (!alreadySent && rlWelcomeType !== "none") {
                    console.log(
                      `🔗 Redirect link automation: type=${rlWelcomeType} for ${joinedPhone}`,
                    );

                    // Resolve instance
                    let rlInstData = instData;
                    if (redirectLink.welcome_instance_id) {
                      const { data: overrideInst } = await supabase
                        .from("zapi_instances")
                        .select(
                          "zapi_instance_id, zapi_token, zapi_client_token",
                        )
                        .eq("user_id", instData.user_id)
                        .eq("id", redirectLink.welcome_instance_id)
                        .eq("is_active", true)
                        .maybeSingle();
                      if (overrideInst) {
                        rlInstData = { ...instData, ...overrideInst };
                      }
                    }

                    const rlBaseUrl =
                      `https://api.z-api.io/instances/${rlInstData.zapi_instance_id}/token/${rlInstData.zapi_token}`;
                    const rlHeaders = {
                      "Content-Type": "application/json",
                      "Client-Token": rlInstData.zapi_client_token,
                    };

                    if (
                      rlWelcomeType === "text" && redirectLink.welcome_message
                    ) {
                      const msg = (redirectLink.welcome_message || "")
                        .replace(/\{\{nome\}\}/gi, joinedName || "novo membro")
                        .replace(/\{\{telefone\}\}/gi, joinedPhone)
                        .replace(/\{\{grupo\}\}/gi, groupName);

                      await fetch(`${rlBaseUrl}/send-text`, {
                        method: "POST",
                        headers: rlHeaders,
                        body: JSON.stringify({
                          phone: joinedPhone,
                          message: msg,
                        }),
                      });
                      console.log(
                        `📤 Redirect link welcome text sent to ${joinedPhone}`,
                      );

                      await supabase.from("message_logs").insert({
                        phone: joinedPhone,
                        message_received: null,
                        response_sent: msg,
                        keyword_matched: "__group_welcome__",
                        timestamp: new Date().toISOString(),
                        user_id: instData.user_id,
                        instance_id: rlInstData.zapi_instance_id,
                      });
                    } else if (
                      rlWelcomeType === "template" &&
                      redirectLink.welcome_template_id
                    ) {
                      // Re-use webhook-zapi self-invocation pattern or send template inline
                      const { data: tpl } = await supabase
                        .from("message_templates")
                        .select(
                          "content, media_url, type, buttons, header, footer, name, carousel_cards",
                        )
                        .eq("id", redirectLink.welcome_template_id)
                        .maybeSingle();

                      if (tpl) {
                        let tplMsg = (tpl.content || "")
                          .replace(
                            /\{\{nome\}\}/gi,
                            joinedName || "novo membro",
                          )
                          .replace(/\{\{telefone\}\}/gi, joinedPhone)
                          .replace(/\{\{grupo\}\}/gi, groupName);

                        const normalizedTplType = String(tpl.type || "").toLowerCase();
                        const hasCarouselCards = Array.isArray(tpl.carousel_cards) && tpl.carousel_cards.length > 0;

                        if ((normalizedTplType === "carousel" || normalizedTplType === "carrossel") && hasCarouselCards) {
                          await fetch(`${rlBaseUrl}/send-carousel`, {
                            method: "POST",
                            headers: rlHeaders,
                            body: JSON.stringify({
                              phone: joinedPhone,
                              message: tplMsg,
                              carousel: tpl.carousel_cards,
                            }),
                          });
                        } else if (
                          tpl.media_url &&
                          (tpl.type === "imagem" || tpl.type === "image")
                        ) {
                          await fetch(`${rlBaseUrl}/send-image`, {
                            method: "POST",
                            headers: rlHeaders,
                            body: JSON.stringify({
                              phone: joinedPhone,
                              image: tpl.media_url,
                              caption: tplMsg,
                            }),
                          });
                        } else if (
                          tpl.media_url &&
                          (tpl.type === "video" || tpl.type === "vídeo")
                        ) {
                          await fetch(`${rlBaseUrl}/send-video`, {
                            method: "POST",
                            headers: rlHeaders,
                            body: JSON.stringify({
                              phone: joinedPhone,
                              video: tpl.media_url,
                              caption: tplMsg,
                            }),
                          });
                        } else if (
                          tpl.media_url &&
                          (tpl.type === "audio" || tpl.type === "áudio")
                        ) {
                          await fetch(`${rlBaseUrl}/send-audio`, {
                            method: "POST",
                            headers: rlHeaders,
                            body: JSON.stringify({
                              phone: joinedPhone,
                              audio: tpl.media_url,
                            }),
                          });
                          if (tplMsg) {
                            await fetch(`${rlBaseUrl}/send-text`, {
                              method: "POST",
                              headers: rlHeaders,
                              body: JSON.stringify({
                                phone: joinedPhone,
                                message: tplMsg,
                              }),
                            });
                          }
                        } else {
                          await fetch(`${rlBaseUrl}/send-text`, {
                            method: "POST",
                            headers: rlHeaders,
                            body: JSON.stringify({
                              phone: joinedPhone,
                              message: tplMsg,
                            }),
                          });
                        }

                        console.log(
                          `📤 Redirect link welcome template sent to ${joinedPhone}`,
                        );
                        await supabase.from("message_logs").insert({
                          phone: joinedPhone,
                          message_received: null,
                          response_sent: `[rl-tpl:${
                            tpl.name || redirectLink.welcome_template_id
                          }] ${tplMsg}`,
                          keyword_matched: "__group_welcome__",
                          timestamp: new Date().toISOString(),
                          user_id: instData.user_id,
                          instance_id: rlInstData.zapi_instance_id,
                        });
                      }
                    } else if (
                      rlWelcomeType === "flow" && redirectLink.welcome_flow_id
                    ) {
                      const { data: flowData } = await supabase
                        .from("flow_automations")
                        .select("keyword")
                        .eq("id", redirectLink.welcome_flow_id)
                        .eq("user_id", instData.user_id)
                        .eq("active", true)
                        .maybeSingle();

                      if (flowData?.keyword) {
                        const selfUrl = Deno.env.get("SUPABASE_URL") +
                          "/functions/v1/webhook-zapi";
                        await fetch(selfUrl, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            phone: joinedPhone,
                            message: { text: flowData.keyword, fromMe: false },
                            instanceId: rlInstData.zapi_instance_id,
                            senderName: joinedName,
                            __manual_flow_trigger__: true,
                          }),
                        });
                        console.log(
                          `🔄 Redirect link flow triggered: ${flowData.keyword} → ${joinedPhone}`,
                        );
                      }

                      await supabase.from("message_logs").insert({
                        phone: joinedPhone,
                        message_received: null,
                        response_sent:
                          `[rl-fluxo:${redirectLink.welcome_flow_id}]`,
                        keyword_matched: "__group_welcome__",
                        timestamp: new Date().toISOString(),
                        user_id: instData.user_id,
                        instance_id: rlInstData.zapi_instance_id,
                      });
                    }
                  }

                  // === GROUP MESSAGE (send inside the group) ===
                  const gmType = redirectLink.group_message_type || "none";
                  if (gmType !== "none") {
                    const groupChatId = normalizedGroupId.endsWith("-group")
                      ? normalizedGroupId
                      : normalizedGroupId.replace(/@g\.us$/i, "") + "-group";

                    let gmInstData = instData;
                    if (redirectLink.group_message_instance_id) {
                      const { data: overrideInst } = await supabase
                        .from("zapi_instances")
                        .select(
                          "zapi_instance_id, zapi_token, zapi_client_token",
                        )
                        .eq("user_id", instData.user_id)
                        .eq("id", redirectLink.group_message_instance_id)
                        .eq("is_active", true)
                        .maybeSingle();
                      if (overrideInst) {
                        gmInstData = { ...instData, ...overrideInst };
                      }
                    }

                    const gmBaseUrl =
                      `https://api.z-api.io/instances/${gmInstData.zapi_instance_id}/token/${gmInstData.zapi_token}`;
                    const gmHeaders = {
                      "Content-Type": "application/json",
                      "Client-Token": gmInstData.zapi_client_token,
                    };

                    if (gmType === "text" && redirectLink.group_message_text) {
                      const groupMsg = (redirectLink.group_message_text || "")
                        .replace(/\{\{nome\}\}/gi, joinedName || "novo membro")
                        .replace(/\{\{telefone\}\}/gi, joinedPhone)
                        .replace(/\{\{grupo\}\}/gi, groupName);
                      await fetch(`${gmBaseUrl}/send-text`, {
                        method: "POST",
                        headers: gmHeaders,
                        body: JSON.stringify({
                          phone: groupChatId,
                          message: groupMsg,
                        }),
                      });
                      console.log(
                        `📢 Group text message sent to ${groupChatId}`,
                      );
                    } else if (
                      gmType === "template" &&
                      redirectLink.group_message_template_id
                    ) {
                      const { data: tpl } = await supabase
                        .from("message_templates")
                        .select("*")
                        .eq("id", redirectLink.group_message_template_id)
                        .maybeSingle();
                      if (tpl) {
                        const tplContent = (tpl.content || "")
                          .replace(
                            /\{\{nome\}\}/gi,
                            joinedName || "novo membro",
                          )
                          .replace(/\{\{telefone\}\}/gi, joinedPhone)
                          .replace(/\{\{grupo\}\}/gi, groupName);

                        const normalizedGmType = String(tpl.type || "").toLowerCase();
                        const hasGmCarouselCards = Array.isArray(tpl.carousel_cards) && tpl.carousel_cards.length > 0;

                        if ((normalizedGmType === "carousel" || normalizedGmType === "carrossel") && hasGmCarouselCards) {
                          await fetch(`${gmBaseUrl}/send-carousel`, {
                            method: "POST",
                            headers: gmHeaders,
                            body: JSON.stringify({
                              phone: groupChatId,
                              message: tplContent,
                              carousel: tpl.carousel_cards,
                            }),
                          });
                        } else if (tpl.media_url) {
                          const fileType = tpl.file_type || "image";
                          const endpoint = fileType === "video"
                            ? "send-video"
                            : fileType === "audio"
                            ? "send-audio"
                            : fileType === "document"
                            ? "send-document"
                            : "send-image";
                          await fetch(`${gmBaseUrl}/${endpoint}`, {
                            method: "POST",
                            headers: gmHeaders,
                            body: JSON.stringify({
                              phone: groupChatId,
                              image: tpl.media_url,
                              video: tpl.media_url,
                              audio: tpl.media_url,
                              document: tpl.media_url,
                              caption: tplContent,
                            }),
                          });
                        } else {
                          await fetch(`${gmBaseUrl}/send-text`, {
                            method: "POST",
                            headers: gmHeaders,
                            body: JSON.stringify({
                              phone: groupChatId,
                              message: tplContent,
                            }),
                          });
                        }
                        console.log(
                          `📢 Group template message sent to ${groupChatId}`,
                        );
                      }
                    } else if (
                      gmType === "flow" && redirectLink.group_message_flow_id
                    ) {
                      // Trigger flow for group chat
                      const { data: flowData } = await supabase
                        .from("flow_automations")
                        .select("*")
                        .eq("id", redirectLink.group_message_flow_id)
                        .maybeSingle();
                      if (flowData) {
                        const flowPayload = {
                          instanceId: gmInstData.zapi_instance_id || "",
                          phone: groupChatId,
                           message: { text: "__manual_flow_trigger__" },
                           flowId: redirectLink.group_message_flow_id,
                           __manual_flow_trigger__: true,
                          senderName: joinedName || "",
                          momment: "received",
                          isGroup: true,
                        };
                        const fnUrl = Deno.env.get("SUPABASE_URL") +
                          "/functions/v1/webhook-zapi";
                        await fetch(fnUrl, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${
                              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
                            }`,
                          },
                          body: JSON.stringify(flowPayload),
                        });
                        console.log(
                          `📢 Group flow triggered for ${groupChatId}`,
                        );
                      }
                    }
                  }

                  // === ADMIN NOTIFICATION ===
                  if (redirectLink.notify_admin && redirectLink.notify_phone) {
                    const notifyMsg =
                      `🔔 *Novo membro no link rotativo*\n\n👤 ${
                        joinedName || "Desconhecido"
                      }\n📱 ${joinedPhone}\n📋 Grupo: ${groupName}\n🔗 Link: ${redirectLink.name}`;

                    // Use same instance resolution
                    let notifyInstData = rlWelcomeType !== "none"
                      ? (instData as any)
                      : instData;
                    if (redirectLink.welcome_instance_id) {
                      const { data: overrideInst } = await supabase
                        .from("zapi_instances")
                        .select(
                          "zapi_instance_id, zapi_token, zapi_client_token",
                        )
                        .eq("user_id", instData.user_id)
                        .eq("id", redirectLink.welcome_instance_id)
                        .eq("is_active", true)
                        .maybeSingle();
                      if (overrideInst) {
                        notifyInstData = { ...instData, ...overrideInst };
                      }
                    }

                    const notifyBase =
                      `https://api.z-api.io/instances/${notifyInstData.zapi_instance_id}/token/${notifyInstData.zapi_token}`;
                    await fetch(`${notifyBase}/send-text`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Client-Token": notifyInstData.zapi_client_token,
                      },
                      body: JSON.stringify({
                        phone: redirectLink.notify_phone,
                        message: notifyMsg,
                      }),
                    });
                    console.log(
                      `🔔 Admin notification sent to ${redirectLink.notify_phone}`,
                    );
                  }
                }
              }
            } catch (rlAutoErr) {
              console.error("❌ Redirect link automation error:", rlAutoErr);
            }
          }

          // === REDIRECT LINK: Update member count and auto-create group if full ===
          try {
            const { data: redirectGroups } = await supabase
              .from("redirect_link_groups")
              .select("*, redirect_links:redirect_link_id(*)")
              .eq("group_id", normalizedGroupId);

            if (redirectGroups && redirectGroups.length > 0) {
              for (const rg of redirectGroups) {
                const redirectLink = (rg as any).redirect_links;
                if (!redirectLink) continue;

                const maxMembers = redirectLink.max_members_per_group || 250;

                // Get real member count
                let realCount = (rg.current_members || 0) + 1;
                try {
                  const meta = await fetchGroupMetadata();
                  if (meta) {
                    realCount = meta.participants?.length || realCount;
                  }
                } catch {
                  // use incremented count
                }

                const isFull = realCount >= maxMembers;
                console.log(
                  `📊 Redirect link group "${rg.group_name}": ${realCount}/${maxMembers} members${
                    isFull ? " → FULL!" : ""
                  }`,
                );

                await supabase
                  .from("redirect_link_groups")
                  .update({ current_members: realCount, is_full: isFull })
                  .eq("id", rg.id);

                // If full, auto-create a new group
                if (isFull && redirectLink.active) {
                  console.log(
                    `🔄 Group "${rg.group_name}" reached limit. Auto-creating new group...`,
                  );

                  // Get all groups for this redirect link
                  const { data: allLinkGroups } = await supabase
                    .from("redirect_link_groups")
                    .select("*")
                    .eq("redirect_link_id", redirectLink.id)
                    .order("sort_order", { ascending: true });

                  const allFull = (allLinkGroups || []).every((g: any) =>
                    g.id === rg.id ? true : g.is_full
                  );

                  if (allFull) {
                    // 🔒 Anti-duplicação: evita criar vários grupos ao mesmo tempo
                    // quando vários membros entram simultaneamente (race condition).
                    const recentCutoff = new Date(Date.now() - 90_000).toISOString();
                    const { data: recentGroup } = await supabase
                      .from("redirect_link_groups")
                      .select("id, created_at")
                      .eq("redirect_link_id", redirectLink.id)
                      .gte("created_at", recentCutoff)
                      .limit(1)
                      .maybeSingle();

                    if (recentGroup) {
                      console.log(
                        `⏭️ Skipping auto-create for link "${redirectLink.name}": another group was created in the last 90s (${recentGroup.id}).`,
                      );
                      continue;
                    }

                    try {
                      const base =
                        `https://api.z-api.io/instances/${instData.zapi_instance_id}/token/${instData.zapi_token}`;
                      const headers = {
                        "Content-Type": "application/json",
                        "Client-Token": instData.zapi_client_token,
                      };
                      const groupCount = (allLinkGroups || []).length;

                      // Get template group metadata
                      let groupName = rg.group_name;
                      let description = "";
                      let admins: string[] = [];
                      let participantPhones: string[] = [];
                      let photoUrl: string | null = rg.group_photo || null;
                      let groupSettings = {
                        adminOnlyMessage: true,
                        adminOnlySettings: false,
                        requireAdminApproval: false,
                        adminOnlyAddMember: true,
                      };

                      const meta = await fetchGroupMetadata();
                      if (meta) {
                        description = meta.description || "";
                        groupSettings = {
                          adminOnlyMessage: Boolean(meta?.adminOnlyMessage),
                          adminOnlySettings: Boolean(meta?.adminOnlySettings),
                          requireAdminApproval: Boolean(
                            meta?.requireAdminApproval,
                          ),
                          adminOnlyAddMember:
                            typeof meta?.adminOnlyAddMember === "boolean"
                              ? meta.adminOnlyAddMember
                              : true,
                        };
                        const participants = extractParticipantArray(meta);
                        if (participants.length > 0) {
                          participantPhones = participants
                            .map((p: any) =>
                              normalizePhoneCandidate(
                                p.phone || p.id || p.participant || p.jid ||
                                  p.user || p.waId || p.number || "",
                              )
                            )
                            .filter((p: string) => p.length > 0);

                          admins = participants
                            .filter((p: any) => isAdminParticipant(p))
                            .map((p: any) =>
                              normalizePhoneCandidate(
                                p.phone || p.id || p.participant || p.jid ||
                                  p.user || "",
                              )
                            )
                            .filter((p: string) => p.length > 0);
                        }
                        if (meta.subject) groupName = meta.subject;
                        if (
                          !photoUrl &&
                          (meta.profileThumbnail || meta.groupPhoto ||
                            meta.imgUrl)
                        ) {
                          photoUrl = meta.profileThumbnail || meta.groupPhoto ||
                            meta.imgUrl;
                        }
                      }

                      if (!photoUrl) {
                        try {
                          const groupsRes = await fetch(`${base}/groups`, {
                            method: "GET",
                            headers,
                          });
                          if (groupsRes.ok) {
                            const groupsData = await groupsRes.json();
                            const matchedGroup =
                              (Array.isArray(groupsData) ? groupsData : [])
                                .find((group: any) => {
                                  const candidateId = group?.phone ||
                                    group?.id || "";
                                  return candidateId === normalizedGroupId ||
                                    candidateId === rg.group_id;
                                });
                            const listPhoto = matchedGroup?.imgUrl ||
                              matchedGroup?.profilePicture ||
                              matchedGroup?.image || matchedGroup?.photo ||
                              null;
                            if (listPhoto) photoUrl = listPhoto;
                          }
                        } catch (e) {
                          console.error(
                            "Failed to fetch group photo from groups list:",
                            e,
                          );
                        }
                      }

                      if (!photoUrl) {
                        try {
                          const { data, error } = await supabase.functions
                            .invoke("get-profile-picture", {
                              body: { phone: normalizedGroupId },
                            });
                          if (!error) {
                            const link = data?.data?.link ||
                              data?.data?.imgUrl ||
                              data?.data?.profilePictureUrl || data?.link ||
                              null;
                            if (link && link !== "null") {
                              photoUrl = link;
                            }
                          }
                        } catch (e) {
                          console.error("Failed to fetch group photo:", e);
                        }
                      }

                      const numberMatch = groupName.match(
                        /^(.*?)(\s+(\d+))?\s*$/,
                      );
                      let baseName = groupName;
                      let nextNumber = groupCount + 1;
                      if (numberMatch && numberMatch[3]) {
                        baseName = numberMatch[1];
                        nextNumber = parseInt(numberMatch[3]) + 1;
                      }
                      const newGroupName = `${baseName} ${nextNumber}`;

                      console.log(`🔄 Creating group: "${newGroupName}"`);

                      console.log(
                        `📞 Auto-create using temp participant: ${TEMP_PARTICIPANT_PHONE}`,
                      );

                      const createRes = await fetch(`${base}/create-group`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                          autoInvite: true,
                          groupName: newGroupName,
                          phones: [TEMP_PARTICIPANT_PHONE],
                        }),
                      });
                      const createData = await createRes.json();
                      console.log(
                        "📦 Auto-create group response:",
                        JSON.stringify(createData),
                      );

                      const newGroupPhone = createData.phone ||
                        createData.groupId || null;

                      if (newGroupPhone) {
                        const newGroupId = newGroupPhone.includes("-group")
                          ? newGroupPhone
                          : newGroupPhone.replace("@g.us", "-group");

                        await new Promise((r) => setTimeout(r, 2000));

                        if (description) {
                          await fetch(`${base}/update-group-description`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                              groupId: newGroupId,
                              groupDescription: description,
                            }),
                          }).catch(() => {});
                        }

                        if (photoUrl) {
                          await fetch(`${base}/update-group-photo`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                              groupId: newGroupId.replace("-group", "@g.us"),
                              groupPhoto: photoUrl,
                            }),
                          }).catch(() => {});
                        }

                        if (admins.length > 0) {
                          const expandedAdmins = expandPhoneCandidates(admins)
                            .filter((phone) =>
                              phone !== TEMP_PARTICIPANT_PHONE
                            );
                          if (expandedAdmins.length > 0) {
                            await fetch(`${base}/add-admin`, {
                              method: "POST",
                              headers,
                              body: JSON.stringify({
                                groupId: newGroupId,
                                phones: expandedAdmins,
                              }),
                            }).catch(() => {});
                          }
                        }

                        await fetch(`${base}/update-group-settings`, {
                          method: "POST",
                          headers,
                          body: JSON.stringify({
                            phone: newGroupId,
                            adminOnlyMessage: groupSettings.adminOnlyMessage,
                            adminOnlySettings: groupSettings.adminOnlySettings,
                            requireAdminApproval:
                              groupSettings.requireAdminApproval,
                            adminOnlyAddMember:
                              groupSettings.adminOnlyAddMember,
                          }),
                        }).catch(() => {});

                        // Remove temporary participant
                        await fetch(`${base}/remove-participant`, {
                          method: "POST",
                          headers,
                          body: JSON.stringify({
                            groupId: newGroupId,
                            phones: [TEMP_PARTICIPANT_PHONE],
                          }),
                        }).catch(() => {});

                        // Get invite link
                        let inviteLink: string | null = null;
                        const inviteRes = await fetch(
                          `${base}/group-invitation-link/${newGroupId}`,
                          {
                            method: "GET",
                            headers,
                          },
                        );
                        if (inviteRes.ok) {
                          const inviteData = await inviteRes.json();
                          inviteLink = inviteData.invitationLink ||
                            inviteData.inviteLink || inviteData.link || null;
                        }

                        // Save to DB
                        await supabase.from("redirect_link_groups").insert({
                          redirect_link_id: redirectLink.id,
                          user_id: redirectLink.user_id,
                          group_id: newGroupId,
                          group_name: newGroupName,
                          invite_link: inviteLink,
                          instance_id: instData.zapi_instance_id,
                          sort_order: groupCount,
                          current_members: 0,
                          is_full: false,
                          group_photo: photoUrl,
                        });

                        console.log(
                          `✅ Auto-created group "${newGroupName}" for link "${redirectLink.name}"`,
                        );
                      }
                    } catch (autoCreateErr) {
                      console.error(
                        "❌ Auto-create group failed:",
                        autoCreateErr,
                      );
                    }
                  }
                }
              }
            }
          } catch (redirectErr) {
            console.error("❌ Redirect link tracking error:", redirectErr);
          }
        }
      } else {
        console.log(
          "⚠️ Group join ignored after detection due to missing data:",
          JSON.stringify({
            groupPhone,
            joinedPhone,
            eventInstanceId,
            notificationParameters: notificationParams,
            participantPhone: webhook?.participantPhone,
            participant: webhook?.participant,
          }),
        );
      }

      return new Response("group_participant_event_handled", {
        status: 200,
        headers: corsHeaders,
      });
    }

    // === GROUP PARTICIPANT LEAVE DETECTION ===
    const isLeaveEvent = webhook?.isGroup === true &&
      !isStatusCallback &&
      noTextPayload &&
      hasLeaveNotificationText &&
      (hasParticipantHint || hasNotificationCode ||
        webhookAction === "remove" || webhookAction === "leave");

    if (isLeaveEvent) {
      const groupPhone = webhook?.phone || webhook?.chatPhone ||
        webhook?.groupId || "";
      const leaveInstanceId = webhook?.instanceId || webhook?.instance_id || "";

      let leftPhone = normalizeParticipantIdentifier(
        webhook?.participantPhone || webhook?.participant ||
          webhook?.senderPhone || webhook?.groupParticipant?.phone || "",
      );
      if (
        !leftPhone && Array.isArray(notificationParams) &&
        notificationParams.length > 0
      ) {
        leftPhone = normalizeParticipantIdentifier(notificationParams[0]);
      }
      const leftName = webhook?.participantName || webhook?.senderName ||
        webhook?.groupParticipant?.name || "";

      if (
        groupPhone && leaveInstanceId && leftPhone &&
        !leftPhone.includes("@lid") && leftPhone.length >= 8
      ) {
        const normalizedLeaveId = normalizeInstanceIdentifier(leaveInstanceId);
        const { data: leaveInstances } = await supabase
          .from("zapi_instances")
          .select("user_id, zapi_instance_id")
          .eq("is_active", true);

        const instData = (leaveInstances || []).find((item: any) =>
          normalizeInstanceIdentifier(item?.zapi_instance_id) ===
            normalizedLeaveId
        );

        if (instData) {
          let normalizedGroupId = groupPhone;
          if (groupPhone.includes("@g.us")) {
            normalizedGroupId = groupPhone.replace("@g.us", "-group");
          } else if (!groupPhone.includes("-group")) {
            normalizedGroupId = groupPhone + "-group";
          }

          await supabase.from("message_logs").insert({
            phone: leftPhone,
            message_received: normalizedGroupId,
            response_sent: leftName || "",
            keyword_matched: "__group_leave__",
            timestamp: new Date().toISOString(),
            user_id: instData.user_id,
            instance_id: instData.zapi_instance_id,
          });
          console.log(
            `📝 Logged group leave: ${leftPhone} left ${normalizedGroupId}`,
          );
        }
      }

      return new Response("group_leave_handled", {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Detect outgoing messages sent by this same WhatsApp instance
    const fromMe = resolveFromMe(webhook);

    const campaignSendStatus = mapCampaignSendStatusFromWebhook(webhook);

    if (campaignSendStatus) {
      const { raw: instanceId } = resolveWebhookInstanceReference(webhook);
      const phone = resolveWebhookPhone(webhook);
      const isGroupFromMeWithText = fromMe &&
        (phone?.includes("@g.us") || phone?.includes("-group"));

      if (!instanceId || !phone) {
        console.log(
          "⚠️ Status callback sem instanceId/phone suficiente para atualizar campaign_sends",
        );
        if (!isGroupFromMeWithText) {
          return new Response("status_callback_missing_data", {
            status: 200,
            headers: corsHeaders,
          });
        }
      } else {
        const normalizedCbInstanceId = normalizeInstanceIdentifier(instanceId);
        const { data: cbInstances } = await supabase
          .from("zapi_instances")
          .select("user_id, instance_name, zapi_instance_id")
          .eq("is_active", true);

        const matchingCbInstances = (cbInstances || []).filter((item: any) => {
          return normalizeInstanceIdentifier(item?.zapi_instance_id) ===
              normalizedCbInstanceId ||
            normalizeInstanceIdentifier(item?.instance_name) ===
              normalizedCbInstanceId;
        });

        let instanceData = matchingCbInstances[0] || null;
        if (matchingCbInstances.length > 1 && phone) {
          const { data: pendingCampaignOwner } = await supabase
            .from("campaign_sends")
            .select("user_id, created_at")
            .in("user_id", matchingCbInstances.map((item: any) => item.user_id))
            .eq("phone", phone)
            .in("status", ["pending", "sent"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const matchedOwner = pendingCampaignOwner?.user_id
            ? matchingCbInstances.find((item: any) => item.user_id === pendingCampaignOwner.user_id)
            : null;
          if (matchedOwner) {
            instanceData = matchedOwner;
            console.log(
              `🔀 Status callback para instância compartilhada resolvido pela campanha pendente: ${matchedOwner.user_id}`,
            );
          }
        }

        const userId = instanceData?.user_id;
        const instanceName = instanceData?.instance_name;
        if (!userId) {
          console.log(
            `⚠️ Status callback sem user encontrado para instance ${instanceId}`,
          );
          if (!isGroupFromMeWithText) {
            return new Response("status_callback_user_not_found", {
              status: 200,
              headers: corsHeaders,
            });
          }
        } else {
          let resolvedPhone = phone;
          if (resolvedPhone.includes("@lid")) {
            const { data: mapping } = await supabase
              .from("message_logs")
              .select("phone")
              .eq("keyword_matched", "__lid_map__")
              .eq("message_received", resolvedPhone)
              .eq("user_id", userId)
              .limit(1)
              .maybeSingle();

            if (mapping?.phone) {
              resolvedPhone = mapping.phone;
            }
          }

          const directLidCandidate = buildLidCandidateFromTechnicalId(phone);

          // === REVERSE LID LOOKUP ===
          // Quando o callback chega com número real, mas o campaign_send foi
          // gravado como @lid (vindo de extração de grupo), precisamos achar
          // todos os identificadores @lid mapeados para este número real
          // para conseguir bater na busca por phone abaixo.
          const reverseLidPhones: string[] = [];
          if (!phone.includes("@lid") && userId) {
            const { data: reverseMaps } = await supabase
              .from("message_logs")
              .select("message_received")
              .eq("keyword_matched", "__lid_map__")
              .eq("user_id", userId)
              .eq("phone", phone)
              .limit(20);
            if (reverseMaps && reverseMaps.length > 0) {
              for (const m of reverseMaps) {
                const lid = (m as any).message_received;
                if (lid && typeof lid === "string" && lid.includes("@lid")) {
                  reverseLidPhones.push(lid);
                }
              }
              if (reverseLidPhones.length > 0) {
                console.log(
                  `🔁 Reverse @lid lookup encontrou ${reverseLidPhones.length} mapeamento(s) para ${phone}`,
                );
              }
            }
          }

          const nowIso = new Date().toISOString();
          const expandCampaignCallbackPhones = (value?: string | null) => {
            if (!value) return [];

            const normalizedValue = normalizeGroupCampaignPhone(value);

            const candidates = new Set<string>(
              [value, normalizedValue].filter(Boolean),
            );

            if (normalizedValue.endsWith("@g.us")) {
              candidates.add(normalizedValue.replace(/@g\.us$/i, ""));
              candidates.add(normalizedValue.replace(/@g\.us$/i, "-group"));
              candidates.add(
                normalizedValue.replace(/@g\.us$/i, "-group@g.us"),
              );
            } else if (normalizedValue.endsWith("-group")) {
              candidates.add(normalizedValue.replace(/-group$/i, "@g.us"));
              candidates.add(normalizedValue.replace(/-group$/i, ""));
              candidates.add(`${normalizedValue}@g.us`);
            } else if (/^\d+$/.test(normalizedValue)) {
              candidates.add(`${normalizedValue}@g.us`);
              candidates.add(`${normalizedValue}-group`);
              candidates.add(`${normalizedValue}-group@g.us`);
            }

            return Array.from(candidates);
          };

          const candidatePhones = Array.from(
            new Set([
              ...expandCampaignCallbackPhones(phone),
              ...expandCampaignCallbackPhones(resolvedPhone),
              directLidCandidate,
              ...reverseLidPhones,
            ].filter(Boolean)),
          );

          // Match prioritário por message_id (mais preciso que por telefone,
          // especialmente quando o destino foi salvo como @lid e o callback
          // retorna o número real resolvido pelo WhatsApp).
          const callbackMessageId = String(
            (webhook as any)?.messageId ||
              (webhook as any)?.zaapId ||
              (webhook as any)?.zapiMessageId ||
              (webhook as any)?.id ||
              "",
          ).trim();

          const buildCampaignSendQuery = (selectFields: string) => {
            let query = supabase
              .from("campaign_sends")
              .select(selectFields)
              .eq("user_id", userId)
              .in("phone", candidatePhones);

            if (instanceName) {
              query = query.eq("instance_name", instanceName);
            }

            return query.order("created_at", { ascending: false }).limit(5);
          };

          const buildCampaignSendQueryByMessageId = (selectFields: string) => {
            let query = supabase
              .from("campaign_sends")
              .select(selectFields)
              .eq("user_id", userId)
              .eq("message_id", callbackMessageId);
            if (instanceName) {
              query = query.eq("instance_name", instanceName);
            }
            return query.order("created_at", { ascending: false }).limit(5);
          };

          const isMissingColumnError = (error: any, columnName: string) => {
            const message = String(error?.message || error?.details || "").toLowerCase();
            const column = columnName.toLowerCase();
            return error?.code === "42703" ||
              error?.code === "PGRST204" ||
              (message.includes(column) && (message.includes("column") || message.includes("schema cache")));
          };

          let hasReadAtColumn = true;
          let campaignSendRows: any[] | null = null;
          let campaignSendLookupError: any = null;

          // 1) Tenta primeiro por message_id (mais confiável).
          if (callbackMessageId) {
            const byMsgId = await buildCampaignSendQueryByMessageId(
              "id, campaign_id, status, phone, sent_at, delivered_at, read_at, instance_name, message_id",
            );
            if (isMissingColumnError(byMsgId.error, "message_id")) {
              // coluna ainda não criada; ignora e cai para busca por phone.
            } else if (isMissingColumnError(byMsgId.error, "read_at")) {
              hasReadAtColumn = false;
              const retryNoRead = await supabase
                .from("campaign_sends")
                .select("id, campaign_id, status, phone, sent_at, delivered_at, instance_name, message_id")
                .eq("user_id", userId)
                .eq("message_id", callbackMessageId)
                .limit(5);
              campaignSendRows = retryNoRead.data as any[] | null;
              campaignSendLookupError = retryNoRead.error;
            } else {
              campaignSendRows = byMsgId.data as any[] | null;
              campaignSendLookupError = byMsgId.error;
            }
          }

          // 2) Fallback: busca por telefone/variantes.
          if (!campaignSendRows || campaignSendRows.length === 0) {
            const initialCampaignSendLookup = await buildCampaignSendQuery(
              "id, campaign_id, status, phone, sent_at, delivered_at, read_at, instance_name",
            );
            campaignSendRows = initialCampaignSendLookup.data as any[] | null;
            campaignSendLookupError = initialCampaignSendLookup.error;
          }

          if (isMissingColumnError(campaignSendLookupError, "read_at")) {
            hasReadAtColumn = false;
            const retry = await buildCampaignSendQuery(
              "id, campaign_id, status, phone, sent_at, delivered_at, instance_name",
            );
            campaignSendRows = retry.data as any[] | null;
            campaignSendLookupError = retry.error;
          }

          if (campaignSendLookupError) {
            console.error(
              "❌ Erro buscando campaign_sends para callback:",
              campaignSendLookupError,
            );
          } else {
            const campaignSend = campaignSendRows?.find((row) =>
              row.status === "pending"
            ) || campaignSendRows?.[0];

            if (!campaignSend) {
              console.log(
                `⚠️ Nenhum campaign_send encontrado para callback ${campaignSendStatus} no telefone ${resolvedPhone}`,
              );
            } else {
              // For "read" status: mark read_at without downgrading current status
              // For "delivered" / "sent": maintain previous behavior
              const updatePayload: Record<string, string | null> = {};
              let nextStatus = campaignSend.status as string;

              if (campaignSendStatus === "read") {
                if (hasReadAtColumn && !(campaignSend as any).read_at) {
                  updatePayload.read_at = nowIso;
                }
                if (!campaignSend.delivered_at) {
                  updatePayload.delivered_at = nowIso;
                }
                if (!campaignSend.sent_at) {
                  updatePayload.sent_at = nowIso;
                }
                // Promote at minimum to delivered
                if (campaignSend.status !== "delivered" && campaignSend.status !== "sent") {
                  updatePayload.status = "delivered";
                  nextStatus = "delivered";
                } else if (campaignSend.status === "sent") {
                  updatePayload.status = "delivered";
                  nextStatus = "delivered";
                }
              } else {
                nextStatus = campaignSendStatus === "delivered" ||
                    campaignSend.status === "delivered"
                  ? "delivered"
                  : "sent";
                updatePayload.status = nextStatus;

                if (!campaignSend.sent_at) {
                  updatePayload.sent_at = nowIso;
                }

                if (nextStatus === "delivered") {
                  updatePayload.delivered_at = nowIso;
                  if (!campaignSend.sent_at) {
                    updatePayload.sent_at = nowIso;
                  }
                } else if (campaignSend.delivered_at) {
                  updatePayload.delivered_at = null;
                }
              }

              const hasUpdates = Object.keys(updatePayload).length > 0;
              const campaignSendUpdateError = hasUpdates
                ? (await supabase
                    .from("campaign_sends")
                    .update(updatePayload)
                    .eq("id", campaignSend.id)).error
                : null;

              if (!hasUpdates) {
                console.log(
                  `ℹ️ campaign_send ${campaignSend.id} já está em estado ${campaignSend.status}, nada a atualizar`,
                );
              } else if (campaignSendUpdateError) {
                console.error(
                  "❌ Erro atualizando campaign_send via callback:",
                  campaignSendUpdateError,
                );
              } else {
                console.log(
                  `✅ campaign_send atualizado via callback: ${campaignSend.id} -> ${nextStatus} (${campaignSend.phone})`,
                );

                if (campaignSend.campaign_id) {
                  const { data: campaignData, error: campaignLookupError } =
                    await supabase
                      .from("campaigns")
                      .select("status, target_audience")
                      .eq("id", campaignSend.campaign_id)
                      .maybeSingle();

                  if (campaignLookupError) {
                    console.error(
                      "❌ Erro carregando campanha após callback:",
                      campaignLookupError,
                    );
                  } else if (
                    campaignData &&
                    (campaignData.status === "active" ||
                      campaignData.status === "draft")
                  ) {
                    const targetContacts = Array.isArray(
                        (campaignData.target_audience as any)?.contacts,
                      )
                      ? (campaignData.target_audience as any).contacts.length
                      : 0;

                    const [
                      awaitingCallbackCountRes,
                      processedCountRes,
                      successCountRes,
                    ] = await Promise.all([
                      supabase
                        .from("campaign_sends")
                        .select("id", { count: "exact", head: true })
                        .eq("campaign_id", campaignSend.campaign_id)
                        .in("status", ["pending", "sent"]),
                      supabase
                        .from("campaign_sends")
                        .select("id", { count: "exact", head: true })
                        .eq("campaign_id", campaignSend.campaign_id),
                      supabase
                        .from("campaign_sends")
                        .select("id", { count: "exact", head: true })
                        .eq("campaign_id", campaignSend.campaign_id)
                        .eq("status", "delivered"),
                    ]);

                    const awaitingCallbackCount = awaitingCallbackCountRes.count ?? 0;
                    const processedCount = processedCountRes.count ?? 0;
                    const deliveredCount = successCountRes.count ?? 0;
                    const hasAllAudienceProcessed = targetContacts === 0 ||
                      processedCount >= targetContacts;

                    if (awaitingCallbackCount === 0 && hasAllAudienceProcessed) {
                      // Also check if there are contacts in target_audience that were never persisted as campaign_sends
                      const targetContacts = Array.isArray(
                          (campaignData.target_audience as any)?.contacts,
                        )
                        ? (campaignData.target_audience as any).contacts
                        : [];
                      const missingContacts = targetContacts.length > 0 &&
                        processedCount < targetContacts.length;
                      const effectiveTargetContacts = targetContacts.length > 0
                        ? targetContacts.length
                        : processedCount;
                      const nextCampaignStatus =
                        processedCount === 0 || missingContacts ||
                          deliveredCount < effectiveTargetContacts
                          ? "paused"
                          : "completed";
                      const { error: campaignStatusError } = await supabase
                        .from("campaigns")
                        .update({
                          status: nextCampaignStatus,
                          updated_at: nowIso,
                        })
                        .eq("id", campaignSend.campaign_id);

                      if (campaignStatusError) {
                        console.error(
                          "❌ Erro finalizando campanha após callback:",
                          campaignStatusError,
                        );
                      } else {
                        console.log(
                          `✅ Campanha ${campaignSend.campaign_id} finalizada após callback com status ${nextCampaignStatus}`,
                        );
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // For group fromMe messages with text, continue processing normally (don't return early)
      // so the message gets logged in message_logs for the chat
      if (!isGroupFromMeWithText) {
        return new Response("status_callback_processed", {
          status: 200,
          headers: corsHeaders,
        });
      }
    }

     const isManualFlowTriggerEarly = webhook?.__manual_flow_trigger__ === true;
     let messageRaw = extractMessageText(webhook);
     const mediaData = extractMediaUrl(webhook);
     const audioUrl = mediaData.type === "audio" ? mediaData.url : extractAudioUrl(webhook);

    if (!messageRaw) {
      const replyCandidates = extractButtonReplyCandidates(webhook);
      const looksLikeJidOrPhone = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return true;
        // JIDs: 12345@g.us, 12345@s.whatsapp.net, 12345@c.us, 12345@lid
        if (/@(g\.us|s\.whatsapp\.net|c\.us|lid|broadcast)$/i.test(trimmed)) return true;
        // Group suffix used internally
        if (/-group$/i.test(trimmed)) return true;
        // Pure long numeric string (likely chatId / phone) — 8+ digits with no letters/spaces
        if (/^\d{8,}$/.test(trimmed)) return true;
        return false;
      };
      const buttonReplyFallback = replyCandidates.find(
        (value) => typeof value === "string" && !looksLikeJidOrPhone(value),
      ) || "";
      if (buttonReplyFallback) {
        messageRaw = buttonReplyFallback;
        console.log(
          "🔁 Using button reply fallback as incoming message:",
          messageRaw,
        );
      } else if (replyCandidates.length > 0) {
        console.log(
          "⚠️ Button reply candidates were all JIDs/phones, ignoring. Sample:",
          replyCandidates.slice(0, 5),
          "| RAW body sample:",
          (rawBody || "").substring(0, 2000),
        );
      }
    }

    // For manual flow triggers from campaigns, inject a synthetic message text
    if (!messageRaw && isManualFlowTriggerEarly && webhook?.flowId) {
      messageRaw = `__flow_trigger_${webhook.flowId}__`;
      console.log(
        "🔄 Manual flow trigger detected, injecting synthetic message:",
        messageRaw,
      );
    }

    let messageText = messageRaw.toLowerCase();
    let normalizedMessage = normalizeForMatch(messageRaw);
    let audioTranscription = "";

     if (!messageRaw && !audioUrl && !mediaData.url) {
      console.log(
        "Evento sem texto detectado, ignorando. Chaves:",
        Object.keys(webhook || {}),
      );
      const webhookType = webhook?.type || "";
      if (webhookType) {
          console.log(
            "Webhook type:",
            webhookType,
            "| Full payload:",
            JSON.stringify(webhook).substring(0, 2000),
          );
      }
      // 🪲 DEBUG: when an interactive selection signal is present but no text
      // could be extracted, dump the raw body so we can discover where UAZAPI
      // is putting the button reply payload.
      if (webhook?.hasInteractiveSelection || webhook?.buttonReply || webhook?.isUazapi) {
        console.log(
          "🪲 UAZAPI no-text with interactive hint — RAW body:",
          (rawBody || "").substring(0, 4000),
        );
      }
      return new Response("ignored_no_text", {
        status: 200,
        headers: corsHeaders,
      });
    }

    // If audio message with no text, try to transcribe
    if (!messageRaw && audioUrl) {
      console.log("🎤 Audio message detected, attempting transcription...");
      audioTranscription = await transcribeAudio(audioUrl);
      if (
        audioTranscription && audioTranscription !== "[áudio não reconhecido]"
      ) {
        messageText = audioTranscription.toLowerCase();
        normalizedMessage = normalizeForMatch(audioTranscription);
        console.log(
          "✅ Audio transcribed successfully, using as message text for matching",
        );
      } else {
        console.log("⚠️ Audio could not be transcribed, logging as audio-only");
      }
    }

    // Extract phone — handle groups vs private chats differently
    let phone = "";
    const rawPhone = webhook?.phone || "";
    const participantPhone = webhook?.participantPhone || "";
    const senderPhone = webhook?.senderPhone || "";
    const chatPhone = webhook?.chatPhone || "";
    const chatLid = webhook?.chatLid || "";
     const senderName = webhook?.senderName || "";
     const senderPhoto = webhook?.senderPhoto || webhook?.data?.senderPhoto || "";
     const chatName = webhook?.chatName || "";
    const isGroupMessage = webhook?.isGroup === true;

    // Log ALL phone-related fields when @lid is detected for debugging
    if (rawPhone.includes("@lid") || chatLid) {
      console.log(
        "🔍 LID DETECTED — All phone fields:",
        JSON.stringify({
          phone: rawPhone,
          participantPhone,
          senderPhone,
          chatPhone,
          chatLid,
          senderName,
          chatName,
          isGroup: isGroupMessage,
          allKeys: Object.keys(webhook || {}),
        }),
      );
    }

    if (isGroupMessage) {
      // For group messages: use the group ID (rawPhone typically has @g.us format)
      // Convert @g.us to -group format for consistency with existing data
      if (rawPhone.includes("@g.us")) {
        phone = rawPhone.replace("@g.us", "-group");
      } else if (rawPhone.includes("-group")) {
        phone = rawPhone;
      } else {
        phone = rawPhone ? rawPhone + "-group" : "";
      }
      console.log(
        "👥 Group message from:",
        senderName || senderPhone || participantPhone,
        "| Group:",
        phone,
      );
    } else {
      // For private messages: trust webhook.phone first (UAZAPI provides the real chat phone here)
      if (rawPhone && !rawPhone.includes("@lid")) {
        phone = rawPhone;
      } else if (senderPhone && !senderPhone.includes("@lid")) {
        phone = senderPhone;
      } else if (participantPhone && !participantPhone.includes("@lid")) {
        phone = participantPhone;
      } else if (chatPhone && !chatPhone.includes("@lid")) {
        phone = chatPhone;
      } else if (
        chatLid && chatLid.includes("@lid") &&
        isLikelyTechnicalIdentifier(rawPhone)
      ) {
        phone = chatLid;
        console.log(
          "⚠️ Raw phone parece ID técnico; usando chatLid para tentar resolução real:",
          chatLid,
        );
      } else if (rawPhone && !rawPhone.includes("@lid")) {
        phone = rawPhone;
      } else {
        // Fallback: use @lid if nothing else available
        phone = rawPhone || participantPhone || chatLid || "";
        if (phone.includes("@lid")) {
          console.log(
            "⚠️ Using @lid phone as fallback — no clean number found:",
            phone,
          );
        }
      }
    }

    let instanceId = resolveWebhookInstanceReference(webhook).raw;
    const normalizedInstanceId =
      resolveWebhookInstanceReference(webhook).normalized;
    const isManualFlowTrigger = isManualFlowTriggerEarly;

    console.log("Processando mensagem:", messageText, "do telefone:", phone);
    console.log("🔎 Instance recebido no webhook:", {
      raw: instanceId,
      normalized: normalizedInstanceId,
      availableKeys: Object.keys(webhook || {}).filter((key) =>
        key.toLowerCase().includes("instance")
      ),
    });

    if (!normalizedInstanceId) {
      console.error("No instance reference in webhook data");
      return new Response("missing_instance_id", {
        status: 400,
        headers: corsHeaders,
      });
    }

    instanceId = normalizedInstanceId;

    // Find user and credentials by instanceId (prefer dedicated zapi_instances table)
    let userId: string | null = null;
    let zapiConfig: {
      zapi_instance_id: string;
      zapi_token: string | null;
      zapi_client_token: string | null;
      api_provider?: string | null;
      evolution_api_url?: string | null;
      evolution_api_key?: string | null;
    } | null = null;

    // Extract authenticated user ID from Authorization header (for manual triggers from the frontend)
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ") && isManualFlowTrigger) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user: authUser } } = await supabase.auth.getUser(token);
        if (authUser?.id) {
          authenticatedUserId = authUser.id;
          console.log(
            "🔑 Authenticated user for manual flow:",
            authenticatedUserId,
          );
        }
      } catch (authError) {
        console.log("⚠️ Could not extract authenticated user from token");
      }
    }

    const { data: instancesData, error: instancesError } = await supabase
      .from("zapi_instances")
      .select(
        "id, user_id, instance_name, zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key",
      )
      .eq("is_active", true);

    if (instancesError) {
      console.error("Erro ao buscar instâncias ativas:", instancesError);
    }

    // When multiple users share the same zapi_instance_id, prefer the authenticated user's instance
    const isIncomingUazapiWebhook = webhook?.isUazapi === true ||
      String(webhook?.provider || "").toLowerCase() === "uazapi";

    const matchingInstances = (instancesData || []).filter((item: any) => {
      const matchesId = normalizeInstanceIdentifier(item?.id) === normalizedInstanceId;
      const matchesExternalId = normalizeInstanceIdentifier(item?.zapi_instance_id) ===
        normalizedInstanceId;
      const matchesName = normalizeInstanceIdentifier(item?.instance_name) === normalizedInstanceId;

      return matchesId || matchesExternalId || matchesName;
    });

    let instanceData: any = null;
    if (matchingInstances.length > 1 && authenticatedUserId) {
      instanceData = matchingInstances.find((item: any) =>
        item.user_id === authenticatedUserId
      ) || matchingInstances[0];
      console.log(
        `🔀 Multiple instances found for ${normalizedInstanceId}, resolved to user: ${instanceData.user_id}`,
      );
    } else {
      instanceData = matchingInstances[0] || null;
    }

    // When multiple users share the same instance and it's NOT a manual trigger,
    // try to find which user has recent conversation with this phone number
    if (matchingInstances.length > 1 && !authenticatedUserId && phone) {
      const candidateUserIds = matchingInstances.map((item: any) =>
        item.user_id
      );
      const { data: recentLogs } = await supabase
        .from("message_logs")
        .select("user_id")
        .in("user_id", candidateUserIds)
        .eq("phone", phone)
        .not("keyword_matched", "eq", "__lid_map__")
        .not("keyword_matched", "eq", "__processing__")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentLogs && recentLogs.length > 0) {
        const bestUserId = recentLogs[0].user_id;
        const bestInstance = matchingInstances.find((item: any) =>
          item.user_id === bestUserId
        );
        if (bestInstance) {
          instanceData = bestInstance;
          console.log(
            `🔀 Multiple instances for ${normalizedInstanceId}, resolved via recent conversation to user: ${bestUserId}`,
          );
        }
      } else {
        // No conversation history — log the message for ALL users so nobody misses it
        console.log(
          `🔀 Multiple instances for ${normalizedInstanceId}, no conversation history for ${phone} — will process for all ${matchingInstances.length} users`,
        );
      }
    }

    const hasExplicitRequestedInstance = Boolean(
      webhook?.instanceId || webhook?.instance_id || webhook?.instanceName ||
        webhook?.instance_name,
    );

    // Fallback: if no instance matched but it's an UAZAPI webhook with instanceId,
    // try to resolve by checking all instances for a matching zapi_instance_id (case-insensitive)
    if (!instanceData && normalizedInstanceId) {
      instanceData = (instancesData || []).find((item: any) =>
        normalizeInstanceIdentifier(item?.zapi_instance_id) === normalizedInstanceId
      );
      if (instanceData) {
        console.log(`✅ Recovered instance ${normalizedInstanceId} via case-insensitive ID match`);
      }
    }

    if (instanceData) {
      userId = instanceData.user_id;
      instanceId = instanceData.zapi_instance_id;
      zapiConfig = {
        zapi_instance_id: instanceData.zapi_instance_id,
        zapi_token: instanceData.zapi_token,
        zapi_client_token: instanceData.zapi_client_token,
        api_provider: instanceData.api_provider || "zapi",
        evolution_api_url: instanceData.evolution_api_url || null,
        evolution_api_key: instanceData.evolution_api_key || null,
      };
    } else if (isManualFlowTrigger && hasExplicitRequestedInstance) {
      console.error("Manual flow requested invalid or inactive instance:", {
        requested: webhook?.instanceId || webhook?.instance_id,
        normalized: normalizedInstanceId,
      });
      return new Response("selected_instance_not_found", {
        status: 400,
        headers: corsHeaders,
      });
    } else {
      console.warn(
        `⚠️ No active instance matched for ${normalizedInstanceId} — skipping`,
      );
      return new Response("instance_not_found", {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Manual flow trigger safeguard:
    // Respect the explicitly requested instance from the UI.
    // Only auto-adjust when the trigger did not provide an instanceId.
    if (
      isManualFlowTrigger && userId && phone && !hasExplicitRequestedInstance
    ) {
      const { data: inboundCandidates } = await supabase
        .from("message_logs")
        .select("instance_id, created_at, keyword_matched, message_received")
        .eq("user_id", userId)
        .eq("phone", phone)
        .not("instance_id", "is", null)
        .not("message_received", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      const lastInbound = (inboundCandidates || []).find((row: any) => {
        const keyword = row?.keyword_matched || "";
        return keyword !== "__processing__" && keyword !== "__lid_map__";
      });

      if (lastInbound?.instance_id && lastInbound.instance_id !== instanceId) {
        const { data: contactInstance } = await supabase
          .from("zapi_instances")
          .select(
            "zapi_instance_id, zapi_token, zapi_client_token, api_provider, evolution_api_url, evolution_api_key",
          )
          .eq("user_id", userId)
          .eq("zapi_instance_id", lastInbound.instance_id)
          .eq("is_active", true)
          .maybeSingle();

        if (contactInstance) {
          console.log(
            `🔁 Manual trigger instance adjusted: ${instanceId} → ${contactInstance.zapi_instance_id}`,
          );
          instanceId = contactInstance.zapi_instance_id;
          zapiConfig = {
            zapi_instance_id: contactInstance.zapi_instance_id,
            zapi_token: contactInstance.zapi_token,
            zapi_client_token: contactInstance.zapi_client_token,
            api_provider: contactInstance.api_provider || "zapi",
            evolution_api_url: contactInstance.evolution_api_url || null,
            evolution_api_key: contactInstance.evolution_api_key || null,
          };
        }
      }
    }

    const isUazapiInstance =
      (zapiConfig?.api_provider || "").toLowerCase() === "uazapi";

    if (!userId || !zapiConfig?.zapi_instance_id) {
      console.error("User has incomplete instance credentials");
      return new Response("incomplete_credentials", {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (
      !isUazapiInstance &&
      (!zapiConfig?.zapi_token || !zapiConfig?.zapi_client_token)
    ) {
      console.error("User has incomplete Z-API credentials");
      return new Response("incomplete_credentials", {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (
      isManualFlowTrigger && !isUazapiInstance &&
      zapiConfig?.zapi_instance_id && zapiConfig?.zapi_token &&
      zapiConfig?.zapi_client_token
    ) {
      try {
        const statusResponse = await fetch(
          `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/status`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": zapiConfig.zapi_client_token,
            },
          },
        );
        const statusPayload = await statusResponse.json().catch(() => ({}));
        const status = String(statusPayload?.status || "").toLowerCase();
        const connectedFlag = statusPayload?.connected;
        const connected = connectedFlag === true ||
          (typeof connectedFlag === "string" &&
            connectedFlag.toLowerCase() === "true") ||
          status === "connected";
        const explicitlyDisconnected = connectedFlag === false ||
          status === "disconnected" || status === "close" ||
          status === "closed";

        if (!statusResponse.ok || (explicitlyDisconnected && !connected)) {
          console.error("Manual flow blocked: selected instance disconnected", {
            instanceId: zapiConfig.zapi_instance_id,
            status: statusPayload,
          });
          return new Response("selected_instance_disconnected", {
            status: 503,
            headers: corsHeaders,
          });
        }
      } catch (deviceError) {
        console.error(
          "Failed to validate selected instance connectivity before manual flow send:",
          deviceError,
        );
        return new Response("selected_instance_status_error", {
          status: 502,
          headers: corsHeaders,
        });
      }
    }

    // === LID ↔ PHONE MAPPING ===
    // When incoming message has clean phone + chatLid, store the mapping
    const webhookChatLid = webhook?.chatLid || "";
    if (
      !phone.includes("@lid") && webhookChatLid &&
      webhookChatLid.includes("@lid")
    ) {
      const { data: existingMap } = await supabase
        .from("message_logs")
        .select("id")
        .eq("keyword_matched", "__lid_map__")
        .eq("message_received", webhookChatLid)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (!existingMap) {
        console.log(`📌 Storing LID mapping: ${webhookChatLid} → ${phone}`);
        await supabase.from("message_logs").insert({
          phone,
          message_received: webhookChatLid,
          response_sent: null,
          keyword_matched: "__lid_map__",
          user_id: userId,
          instance_id: instanceId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // When phone is @lid, try to resolve to clean phone
    if (phone.includes("@lid") && userId) {
      const lidToResolve = phone;
      const { data: mapping } = await supabase
        .from("message_logs")
        .select("phone")
        .eq("keyword_matched", "__lid_map__")
        .eq("message_received", lidToResolve)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (mapping) {
        console.log(`✅ Resolved @lid: ${lidToResolve} → ${mapping.phone}`);
        phone = mapping.phone;
      } else {
        console.log(`⚠️ No LID mapping found for ${lidToResolve}, using as-is`);
      }
    }

    const isUazapiInteractiveSelfEcho = webhook?.isUazapi === true &&
      webhook?.hasInteractiveSelection === true;

    if (fromMe && !isUazapiInteractiveSelfEcho) {
      const rawTimestamp = webhook?.momment ?? webhook?.messageTimestamp ??
        webhook?.timestamp ?? webhook?.createdAt;
      const numericTimestamp = Number(rawTimestamp);
      const outgoingTimestamp =
        Number.isFinite(numericTimestamp) && numericTimestamp > 0
          ? new Date(
            numericTimestamp < 1_000_000_000_000
              ? numericTimestamp * 1000
              : numericTimestamp,
          ).toISOString()
          : new Date().toISOString();

      // Build outgoing content with audio tag if applicable
      let outgoingContent = sanitizeTechnicalMessageReference(messageRaw);
      if (audioUrl) {
        const audioTag = `[media:audio:${audioUrl}]`;
        outgoingContent = audioTag + (outgoingContent ? `\n${outgoingContent}` : "");
      }

      if (!outgoingContent) {
        return new Response("outgoing_technical_echo_ignored", {
          status: 200,
          headers: corsHeaders,
        });
      }

      const { error: outgoingLogError } = await supabase
        .from("message_logs")
        .insert({
          phone,
          message_received: null,
          response_sent: outgoingContent,
          keyword_matched: "__manual_send__",
          timestamp: outgoingTimestamp,
          user_id: userId,
          instance_id: instanceId || zapiConfig.zapi_instance_id || null,
        });

      if (outgoingLogError) {
        console.error(
          "Erro ao registrar mensagem enviada no histórico:",
          outgoingLogError,
        );
      }

      return new Response("outgoing_logged", {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (isUazapiInteractiveSelfEcho) {
      console.log(
        "🧭 UAZAPI interactive selection detected; bypassing outgoing-message block to continue the flow",
      );
    }

    // ============================================================
    // WARMUP SHORT-CIRCUIT
    // Se a mensagem recebida vem de um número que pertence a uma
    // instância UAZAPI doadora (cadastrada em /admin/aquecimento),
    // significa que é uma conversa de AQUECIMENTO. Nesse caso, NÃO
    // dispare auto-resposta nem agente de IA — a réplica correta já
    // é enviada pelo motor `run-warmup` usando o pool de mensagens.
    // ============================================================
    try {
      const senderDigits = String(phone || "").replace(/\D/g, "");
      if (senderDigits && senderDigits.length >= 8 && !isGroupMessage) {
        const { data: donorInstances } = await supabase
          .from("zapi_instances")
          .select("evolution_api_url, evolution_api_key, zapi_token")
          .ilike("api_provider", "uazapi")
          .eq("is_active", true);
        for (const di of donorInstances || []) {
          const apiUrl = String(di.evolution_api_url || "").replace(/\/+$/, "");
          const apiToken = String(di.evolution_api_key || di.zapi_token || "");
          if (!apiUrl || !apiToken) continue;
          try {
            const sr = await fetch(`${apiUrl}/status`, { headers: { token: apiToken } });
            if (!sr.ok) continue;
            const sj: any = await sr.json().catch(() => ({}));
            const cand = sj?.instance?.owner || sj?.owner || sj?.phone || sj?.id || sj?.wid;
            const donorDigits = String(cand || "").replace(/\D/g, "");
            if (donorDigits.length >= 8 && (donorDigits === senderDigits || donorDigits.endsWith(senderDigits) || senderDigits.endsWith(donorDigits))) {
              console.log(`🔥 Warmup conversation detected (sender=${senderDigits} matches donor=${donorDigits}). Bypassing auto-response & AI agent.`);
              return new Response("warmup_bypass", { status: 200, headers: corsHeaders });
            }
          } catch (_) { /* try next donor */ }
        }
      }
    } catch (e) {
      console.log("warmup-bypass check failed (continuing normally):", (e as any)?.message);
    }

    // Verifica se o sistema está ativo (filtra pelo user_id correto)
    const { data: config } = await supabase
      .from("auto_response_config")
      .select("active")
      .eq("user_id", userId)
      .maybeSingle();

    if (config && !config.active) {
      console.log("Sistema desativado para o usuário:", userId);
      return new Response("system_disabled", {
        status: 200,
        headers: corsHeaders,
      });
    }

     // Build the raw message content for storage (include media tag + transcription)
     let storedMessage = messageRaw;
     if (mediaData.url || audioUrl) {
       const mUrl = mediaData.url || audioUrl;
       const mType = mediaData.type || "audio";
       const mediaTag = `[media:${mType}:${mUrl}]`;
       
       if (mType === "audio" && audioTranscription && audioTranscription !== "[áudio não reconhecido]") {
         storedMessage = `${mediaTag}\n🎙️ ${audioTranscription}`;
       } else {
         storedMessage = mediaTag + (messageRaw ? `\n${messageRaw}` : "");
       }
     }

    // Dedupe idempotente: cria um lock por usuário+telefone+mensagem em janela de 15s
    const lockResult = await acquireMessageProcessingLock(supabase, {
      userId,
      phone,
      normalizedMessage: normalizedMessage || normalizeForMatch(storedMessage),
      rawMessage: storedMessage,
      instanceId,
      messageId: String(webhook?.messageId || "").trim() || undefined,
       senderName: senderName || undefined,
       senderPhone: senderPhone || participantPhone || undefined,
       senderPhoto: senderPhoto || undefined,
    });

    if (!lockResult.acquired) {
      console.log(
        "Mensagem duplicada detectada, ignorando para manter ordem do fluxo",
      );
      return new Response("ignored_duplicate", {
        status: 200,
        headers: corsHeaders,
      });
    }

    processingLockId = lockResult.lockId;
    const lockId = lockResult.lockId;

  // Check for campaign tag override if this is a manual trigger (e.g. from campaign)
  const tagIdOverride = webhook?.__tagId__;
  if (tagIdOverride && tagIdOverride !== 'none' && userId && phone && !isGroupMessage) {
    try {
      console.log(`🏷️ Applying campaign tag override: ${tagIdOverride} to ${phone}`);
      // Use direct fetch to Z-API as zapiConfig might not be fully populated yet if we return early
      if (zapiConfig?.zapi_instance_id && zapiConfig?.zapi_token) {
        const tagUrl = `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/add-tag-chat`;
        await fetch(tagUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': zapiConfig.zapi_client_token || '' },
          body: JSON.stringify({ phone, tagId: tagIdOverride }),
        });
      }
    } catch (tagErr) {
      console.error(`⚠️ Failed to apply tag override to ${phone}:`, tagErr);
    }
  }

      await releaseMessageProcessingLock(supabase, lockId).catch(inboxErr => {
        console.error("❌ Erro ao tornar mensagem visível no inbox:", inboxErr);
      });
 
     // Upsert into saved_contacts to keep name and photo updated in real-time
     if (userId && phone) {
       await upsertSavedContact(supabase, {
         userId,
         phone,
         name: senderName || chatName || "",
         photo: senderPhoto || undefined,
         instanceId: instanceId || undefined,
       }).catch(e => console.error("❌ Erro ao atualizar saved_contacts:", e));
     }
 
    // Do not forward regular inbound WhatsApp messages to payment/webhook integrations.
    // These integrations are reserved for gateway transaction events (approved, pending, refunded, etc).
    console.log(
      "Encaminhamento para gateway_integrations ignorado no webhook-zapi para evitar disparos indevidos",
    );

    const phoneLookupCandidates = Array.from(new Set([
      String(phone || "").trim(),
      normalizePhoneCandidate(webhook?.senderPhone),
      normalizePhoneCandidate(webhook?.participantPhone),
      normalizePhoneCandidate(webhook?.chatPhone),
      normalizePhoneCandidate(webhook?.author),
    ].filter((value) => typeof value === "string" && value.trim().length > 0)));

    const { data: pendingCaptureLog } = await supabase
      .from("message_logs")
      .select("id, response_sent, instance_id")
      .eq("user_id", userId)
      .in("phone", phoneLookupCandidates)
      .eq("keyword_matched", `${FLOW_CAPTURE_PREFIX}${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: pendingButtonLog } = await supabase
      .from("message_logs")
      .select("id, response_sent, instance_id")
      .eq("user_id", userId)
      .in("phone", phoneLookupCandidates)
      .like("keyword_matched", `${FLOW_BUTTON_PREFIX}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingCaptureLog?.response_sent) {
      try {
        const pendingState = JSON.parse(
          String(pendingCaptureLog.response_sent || "{}"),
        ) as PendingCaptureState;
        const flowId = pendingState.flowId;
        if (flowId) {
          const { data: pendingFlow } = await supabase
            .from("flow_automations")
            .select("*")
            .eq("id", flowId)
            .eq("user_id", userId)
            .eq("active", true)
            .maybeSingle();

          if (pendingFlow) {
            const pendingButtonMatch = findButtonEdgeMatch(
              [pendingFlow],
              normalizedMessage,
              messageRaw,
              webhook,
            );

            if (pendingButtonMatch) {
              console.log(
                "🎯 Button reply matched while capture was pending; prioritizing button branch",
                {
                  flowId: pendingFlow.id,
                  pendingField: pendingState.field,
                  button: pendingButtonMatch.buttonText,
                },
              );

              await supabase.from("message_logs").delete().eq(
                "id",
                pendingCaptureLog.id,
              );

              const routed = await routeMatchedButtonFlow({
                match: pendingButtonMatch,
                phone,
                zapiConfig,
                supabase,
                userId,
                lockId,
                flowId: pendingFlow.id,
                resumeCaptured: pendingState.captured || {},
              });

              if (routed) {
                return new Response("button_flow_sent", {
                  status: 200,
                  headers: corsHeaders,
                });
              }
            }

            const updatedCaptured = { ...(pendingState.captured || {}) };
            if (pendingState.field === "name") {
              updatedCaptured.nome = messageRaw;
            }
            if (pendingState.field === "whatsapp") {
              updatedCaptured.whatsapp = normalizePhoneCandidate(messageRaw) ||
                messageRaw;
            }
            if (pendingState.field === "email") {
              updatedCaptured.email = messageRaw.trim();
            }

            // Persist captured data for reporting (upsert by user_id + flow_id + phone)
            try {
              const { data: existingCapture } = await supabase
                .from("flow_captured_data")
                .select("id")
                .eq("user_id", userId)
                .eq("flow_id", pendingFlow.id)
                .eq("phone", phone)
                .maybeSingle();

              const captureRow = {
                user_id: userId,
                flow_id: pendingFlow.id,
                flow_name: pendingFlow.name,
                phone,
                nome: updatedCaptured.nome || null,
                whatsapp: updatedCaptured.whatsapp || null,
                email: updatedCaptured.email || null,
                source: "whatsapp",
                updated_at: new Date().toISOString(),
              };

              if (existingCapture) {
                await supabase.from("flow_captured_data").update(captureRow).eq(
                  "id",
                  existingCapture.id,
                );
              } else {
                await supabase.from("flow_captured_data").insert(captureRow);
              }
              console.log(
                `💾 Captured data saved for ${phone} on flow ${pendingFlow.name}`,
              );
            } catch (capSaveErr) {
              console.error("⚠️ Failed to save captured data:", capSaveErr);
            }

            const flowNodes: FlowNode[] = pendingFlow.nodes || [];
            const flowEdges: FlowEdge[] = pendingFlow.edges || [];
            const sourceNode = flowNodes.find((n) =>
              n.id === pendingState.nodeId
            );
            const resumeEdge = flowEdges.find((e) =>
              e.source === pendingState.nodeId &&
              e.sourceHandle === `collect-${pendingState.field}`
            );

            await supabase.from("message_logs").delete().eq(
              "id",
              pendingCaptureLog.id,
            );

            const sendResumeText = async (message: string) => {
              const isUazapiResume =
                (zapiConfig?.api_provider || "").toLowerCase() === "uazapi";
              if (isUazapiResume) {
                const apiUrl = String(zapiConfig?.evolution_api_url || "")
                  .replace(/\/+$/, "");
                const apiToken = String(zapiConfig?.evolution_api_key || "");
                if (!apiUrl || !apiToken) {
                  throw new Error(
                    "UAZAPI URL/Token não configurados para retomar captura",
                  );
                }
                const normalizedTarget = phone.includes("-group")
                  ? `${
                    String(phone).replace(/-group$/i, "").replace(/\D/g, "")
                  }@g.us`
                  : String(phone).replace(/^\+/, "").replace(/[@\-].*$/, "")
                    .replace(/\D/g, "");
                const resumeRes = await fetch(`${apiUrl}/send/text`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    token: apiToken,
                  },
                  body: JSON.stringify({
                    number: normalizedTarget,
                    text: message,
                  }),
                });
                if (!resumeRes.ok) {
                  throw new Error(
                    `UAZAPI não confirmou o follow-up da captura (${resumeRes.status})`,
                  );
                }
                return;
              }

              await fetch(
                `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/send-text`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Client-Token": String(zapiConfig.zapi_client_token || ""),
                  },
                  body: JSON.stringify({ phone, message }),
                },
              );
            };

            if (sourceNode) {
              const followUpMap = {
                name: sourceNode.data.nameFollowUp || "",
                whatsapp: sourceNode.data.whatsappFollowUp || "",
                email: sourceNode.data.emailFollowUp || "",
              };
              const followUpMessage = String(
                followUpMap[pendingState.field] || "",
              )
                .replace(/\{\{nome\}\}/gi, updatedCaptured.nome || "")
                .replace(
                  /\{\{whatsapp\}\}/gi,
                  updatedCaptured.whatsapp || phone || "",
                )
                .replace(
                  /\{\{telefone\}\}/gi,
                  updatedCaptured.whatsapp || phone || "",
                )
                .replace(/\{\{email\}\}/gi, updatedCaptured.email || "");

              if (followUpMessage.trim()) {
                await sendResumeText(followUpMessage);
              }
            }

            if (resumeEdge) {
              const visited = new Set<string>();
              const targetNode = flowNodes.find((n) =>
                n.id === resumeEdge.target
              );
              if (targetNode?.type === "blocoConteudo") {
                const shouldStop = await sendNodeContent(
                  targetNode,
                  flowNodes,
                  flowEdges,
                  phone,
                  zapiConfig,
                  visited,
                  supabase,
                  userId,
                  pendingFlow.name,
                  {
                    resumeCaptured: updatedCaptured,
                    flowId: pendingFlow.id,
                  },
                );
                if (!shouldStop) {
                  await processFlowNode(
                    targetNode.id,
                    flowNodes,
                    flowEdges,
                    phone,
                    zapiConfig,
                    supabase,
                    visited,
                    userId,
                    pendingFlow.name,
                    {
                      resumeCaptured: updatedCaptured,
                      flowId: pendingFlow.id,
                    },
                  );
                }
              } else if (targetNode) {
                await processFlowNode(
                  targetNode.id,
                  flowNodes,
                  flowEdges,
                  phone,
                  zapiConfig,
                  supabase,
                  visited,
                  userId,
                  pendingFlow.name,
                  {
                    resumeCaptured: updatedCaptured,
                    flowId: pendingFlow.id,
                  },
                );
              }

              await finalizeMessageLog(supabase, lockId, {
                keywordMatched: `__flow_capture_resume__:${pendingFlow.id}`,
                responseSent: `[Captura ${pendingState.field}]`,
              });
              await setVisibleIncomingMessage(supabase, lockId, messageRaw);
              return new Response("flow_capture_resumed", {
                status: 200,
                headers: corsHeaders,
              });
            }
          }
        }
      } catch (captureResumeError) {
        console.error("Erro ao retomar captura pendente:", captureResumeError);
      }
    }

    let hasPendingButtonContext = false;
    if (pendingButtonLog?.response_sent) {
      try {
        const pendingButtonState = JSON.parse(
          String(pendingButtonLog.response_sent || "{}"),
        ) as PendingButtonState;
        const pendingButtonFlowId = pendingButtonState.flowId;

        if (pendingButtonFlowId) {
          const { data: pendingButtonFlow } = await supabase
            .from("flow_automations")
            .select("*")
            .eq("id", pendingButtonFlowId)
            .eq("user_id", userId)
            .eq("active", true)
            .maybeSingle();

          if (pendingButtonFlow) {
            hasPendingButtonContext = true;

            if (
              isUazapiInstance &&
              pendingButtonState?.buttons?.length &&
              isUazapiTechnicalReplyReference(messageRaw)
            ) {
              const historyResolvedReply = await resolveUazapiPendingButtonReplyFromHistory({
                apiUrl: String(zapiConfig?.evolution_api_url || ""),
                apiToken: String(zapiConfig?.evolution_api_key || ""),
                phone,
                rawMessage: messageRaw,
                webhook,
                pendingState: pendingButtonState,
              });

              if (historyResolvedReply?.matchedText) {
                const resolvedCandidates = Array.from(new Set([
                  historyResolvedReply.matchedText,
                  historyResolvedReply.matchedButtonId,
                  messageRaw,
                ]));

                webhook = {
                  ...webhook,
                  text: {
                    ...(typeof webhook?.text === "object" && webhook?.text ? webhook.text : {}),
                    message: historyResolvedReply.matchedText,
                    selectedDisplayText: historyResolvedReply.matchedText,
                    selectedButtonId: historyResolvedReply.matchedButtonId,
                  },
                  buttonReply: {
                    ...(typeof webhook?.buttonReply === "object" && webhook?.buttonReply
                      ? webhook.buttonReply
                      : {}),
                    title: historyResolvedReply.matchedText,
                    text: historyResolvedReply.matchedText,
                    label: historyResolvedReply.matchedText,
                    selectedDisplayText: historyResolvedReply.matchedText,
                    selectedButtonId: historyResolvedReply.matchedButtonId,
                  },
                };

                messageRaw = historyResolvedReply.matchedText;
                messageText = messageRaw.toLowerCase();
                normalizedMessage = normalizeForMatch(messageRaw);

                console.log(
                  "🧭 Pending UAZAPI button reply rewritten from recent history",
                  { resolvedCandidates },
                );
              }
            }

            console.log(
              "🧩 Pending button context loaded",
              JSON.stringify({
                flowId: pendingButtonFlow.id,
                nodeId: pendingButtonState.nodeId,
                phone,
                messageRaw,
                replyCandidates: extractButtonReplyCandidates(webhook).slice(0, 12),
              }).substring(0, 1200),
            );

            const waitingButtonMatch = findButtonEdgeMatch(
              [pendingButtonFlow],
              normalizedMessage,
              messageRaw,
              webhook,
              {
                nodeId: pendingButtonState.nodeId,
                pendingState: pendingButtonState,
              },
            );

            if (waitingButtonMatch) {
              const { data: claimedPendingButton } = await supabase
                .from("message_logs")
                .update({
                  keyword_matched: `__button_claimed__:${lockId}`,
                })
                .eq("id", pendingButtonLog.id)
                .like("keyword_matched", `${FLOW_BUTTON_PREFIX}%`)
                .select("id")
                .maybeSingle();

              if (!claimedPendingButton) {
                console.log(
                  "⏭️ Reply de botão já foi consumido por outro webhook duplicado; ignorando repetição",
                  { pendingButtonLogId: pendingButtonLog.id, lockId },
                );
                return new Response("button_already_claimed", {
                  status: 200,
                  headers: corsHeaders,
                });
              }

              console.log(
                "🎯 Button reply matched for waiting node",
                {
                  flowId: pendingButtonFlow.id,
                  nodeId: pendingButtonState.nodeId,
                  button: waitingButtonMatch.buttonText,
                },
              );

              await supabase.from("message_logs").delete().eq(
                "id",
                pendingButtonLog.id,
              );

              const routed = await routeMatchedButtonFlow({
                match: waitingButtonMatch,
                phone,
                zapiConfig,
                supabase,
                userId,
                lockId,
                flowId: pendingButtonFlow.id,
                resumeCaptured: pendingButtonState.captured || {},
              });

              if (routed) {
                return new Response("button_flow_sent", {
                  status: 200,
                  headers: corsHeaders,
                });
              }
            } else {
              console.log(
                "⏸️ Pending button context found but no match for waiting node",
                {
                  flowId: pendingButtonFlow.id,
                  nodeId: pendingButtonState.nodeId,
                  messageRaw,
                },
              );
            }
          }
        }
      } catch (pendingButtonError) {
        console.error(
          "Erro ao resolver contexto pendente de botão:",
          pendingButtonError,
        );
      }
    }

    // === CHECK FLOW AUTOMATIONS FIRST ===
    const { data: flowAutomations, error: flowError } = await supabase
      .from("flow_automations")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true);

    if (!flowError && flowAutomations && flowAutomations.length > 0) {
      // Visual flow automations apply only to direct (1-on-1) conversations.
      // Group messages should never trigger button/keyword flows so we don't
      // spam groups with the user's flow content.
      const isGroupMessage = webhook?.isGroup === true ||
        String(phone || "").includes("@g.us") ||
        String(phone || "").includes("-group");

      if (isGroupMessage && !isManualFlowTrigger) {
        console.log(
          "👥 Mensagem de grupo detectada — ignorando automações de fluxo",
        );
        return new Response("group_message_ignored", {
          status: 200,
          headers: corsHeaders,
        });
      }

      if (isManualFlowTrigger && webhook?.flowId) {
        const directFlow = flowAutomations.find((flow: any) =>
          flow.id === webhook.flowId
        );

        if (directFlow) {
          console.log(
            "Fluxo manual encontrado por ID:",
            directFlow.id,
            directFlow.name,
          );

          const nodes: FlowNode[] = directFlow.nodes || [];
          const edges: FlowEdge[] = directFlow.edges || [];
          const initialNode = nodes.find((n) => n.type === "blocoInicial");

          if (initialNode) {
            await processFlowNode(
              initialNode.id,
              nodes,
              edges,
              phone,
              zapiConfig,
              supabase,
              new Set<string>(),
              userId,
              directFlow.name,
              { flowId: directFlow.id },
            );

            await finalizeMessageLog(supabase, lockId, {
              keywordMatched: `__manual_flow_trigger__:${directFlow.id}`,
              responseSent: `[Fluxo: ${directFlow.name}]`,
            });

            return new Response("manual_flow_sent", {
              status: 200,
              headers: corsHeaders,
            });
          }
        }

        console.log(
          "⚠️ Fluxo manual não encontrado por ID, tentando fallback por palavra-chave",
        );
      }

      // === CHECK IF MESSAGE IS A BUTTON REPLY THAT MATCHES A FLOW BUTTON ===
      // Só faz match global quando o payload traz um callback interativo real.
      // Isso evita que textos comuns como "outro" ou ecos técnicos da UAZAPI
      // disparem ramos de botão de fluxos não pendentes.
      if (!hasPendingButtonContext) {
        const buttonMatch = findButtonEdgeMatch(
          flowAutomations,
          normalizedMessage,
          messageRaw,
          webhook,
        );
        if (buttonMatch) {
          const routed = await routeMatchedButtonFlow({
            match: buttonMatch,
            phone,
            zapiConfig,
            supabase,
            userId,
            lockId,
            flowId: buttonMatch.flow.id,
          });

          if (routed) {
            return new Response("button_flow_sent", {
              status: 200,
              headers: corsHeaders,
            });
          }
        }
      }

      // === CHECK KEYWORD MATCH ===
      const matchedFlow = flowAutomations.find((flow: any) => {
        const keywords = extractFlowKeywords(flow);
        return keywords.some((keyword) =>
          isKeywordMatch(normalizedMessage, keyword)
        );
      });

      if (matchedFlow) {
        console.log(
          "Fluxo encontrado para palavra-chave:",
          matchedFlow.keyword,
        );

        const nodes: FlowNode[] = matchedFlow.nodes || [];
        const edges: FlowEdge[] = matchedFlow.edges || [];

        // Find initial node
        const initialNode = nodes.find((n) => n.type === "blocoInicial");
        if (initialNode) {
          // Process flow sequentially
          await processFlowNode(
            initialNode.id,
            nodes,
            edges,
            phone,
            zapiConfig,
            supabase,
            new Set<string>(),
            userId,
            matchedFlow.name,
            { flowId: matchedFlow.id },
          );

          // Log the interaction
          await finalizeMessageLog(supabase, lockId, {
            keywordMatched: matchedFlow.keyword,
            responseSent: `[Fluxo: ${matchedFlow.name}]`,
          });

          return new Response("flow_sent", {
            status: 200,
            headers: corsHeaders,
          });
        }
      }
    }

    // === FALLBACK: CHECK AUTO RESPONSES ===
    const { data: responses, error: responsesError } = await supabase
      .from("auto_responses")
      .select("*")
      .eq("active", true)
      .eq("user_id", userId);

    if (responsesError) {
      console.error("Erro ao buscar respostas:", responsesError);
      await releaseMessageProcessingLock(supabase, lockId);
      return new Response("responses_error", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const matchedResponse = responses?.find((response) =>
      messageText.includes(response.keyword.toLowerCase())
    );

    if (matchedResponse) {
      console.log("Palavra-chave encontrada:", matchedResponse.keyword);

      await finalizeMessageLog(supabase, lockId, {
        keywordMatched: matchedResponse.keyword,
        responseSent: matchedResponse.response,
      });

      const zapiResponse = await fetch(
        `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/send-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": String(zapiConfig.zapi_client_token || ""),
          },
          body: JSON.stringify({ phone, message: matchedResponse.response }),
        },
      );

      const zapiResult = await zapiResponse.text();
      console.log("Resposta Z-API:", zapiResponse.status, zapiResult);

      return new Response(zapiResponse.ok ? "response_sent" : "send_error", {
        status: zapiResponse.ok ? 200 : 500,
        headers: corsHeaders,
      });
    }

    // === FALLBACK: AI AGENT ===
    const { data: latestAgentConfig, error: agentConfigError } = await supabase
      .from("agent_config")
      .select("id, active, agent_name, system_prompt, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (agentConfigError) {
      console.error(
        "Erro ao carregar configuração do agente IA:",
        agentConfigError,
      );
    }

    const isAgentEnabled = latestAgentConfig?.active === true;

    if (!isAgentEnabled) {
      console.log(
        "🤖 Agente IA desativado para o usuário:",
        userId,
        "| instância:",
        zapiConfig.zapi_instance_id,
      );
      await releaseMessageProcessingLock(supabase, lockId);
      return new Response("ai_agent_disabled", {
        status: 200,
        headers: corsHeaders,
      });
    }

    console.log("🤖 Agente IA ativo, gerando resposta...", {
      userId,
      instanceId: zapiConfig.zapi_instance_id,
      agentConfigId: latestAgentConfig?.id,
    });

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error("SUPABASE_URL/SUPABASE_ANON_KEY não configuradas para agente IA");
      } else {
        const agentResponse = await fetch(`${supabaseUrl}/functions/v1/agent-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            phone,
            messages: [{ role: "user", content: messageRaw }],
          }),
        });

        if (agentResponse.ok) {
          const agentData = await agentResponse.json();
          const aiReply = String(agentData?.reply || "").trim();
          const ctaLabel = String(agentData?.cta?.label || "Abrir checkout").trim();
          const ctaUrl = String(agentData?.cta?.url || "").trim();
          const finalReply = aiReply;

          if (finalReply || ctaUrl) {
            const isUazapiProvider = String(zapiConfig?.api_provider || "").toLowerCase() === "uazapi";
            const normalizedTargetNumber = phone.includes("-group")
              ? `${String(phone).replace(/-group$/i, "").replace(/\D/g, "")}@g.us`
              : String(phone).replace(/^\+/, "").replace(/[@\-].*$/, "").replace(/\D/g, "");

            const hasCta = /^https?:\/\//i.test(ctaUrl);
            const cleanReply = String(finalReply || "")
              .replace(/https?:\/\/[^\s)]+/g, "")
              .replace(/[ \t]+\n/g, "\n")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
            const deliveryResponse = hasCta
              ? isUazapiProvider
                ? await fetch(`${String(zapiConfig?.evolution_api_url || "").replace(/\/+$/, "")}/send/menu`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      token: String(zapiConfig?.evolution_api_key || ""),
                    },
                    body: JSON.stringify({
                      number: normalizedTargetNumber,
                      type: "button",
                      text: cleanReply || "Selecione uma opção:",
                      choices: [`${ctaLabel || "Abrir checkout"}|url:${ctaUrl}`],
                    }),
                  })
                : await fetch(
                    `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/send-button-actions`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Client-Token": String(zapiConfig.zapi_client_token || ""),
                      },
                      body: JSON.stringify({
                        phone,
                        message: cleanReply || "Selecione uma opção:",
                        buttonActions: [{
                          id: "1",
                          type: "URL",
                          label: ctaLabel || "Abrir checkout",
                          url: ctaUrl,
                        }],
                      }),
                    },
                  )
              : isUazapiProvider
                ? await fetch(`${String(zapiConfig?.evolution_api_url || "").replace(/\/+$/, "")}/send/text`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      token: String(zapiConfig?.evolution_api_key || ""),
                    },
                    body: JSON.stringify({ number: normalizedTargetNumber, text: cleanReply }),
                  })
                : await fetch(
                    `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}/send-text`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Client-Token": String(zapiConfig.zapi_client_token || ""),
                      },
                      body: JSON.stringify({ phone, message: finalReply }),
                    },
                  );

            const deliveryResult = await deliveryResponse.text();
            console.log(
              "🤖 Resposta IA enviada:",
              deliveryResponse.status,
              deliveryResult.substring(0, 200),
            );

            if (!deliveryResponse.ok) {
              throw new Error(`Falha ao enviar resposta do agente via ${isUazapiProvider ? "UAZAPI" : "Z-API"}: ${deliveryResult.substring(0, 200)}`);
            }

            await finalizeMessageLog(supabase, lockId, {
              keywordMatched: "[Agente IA]",
              responseSent: [cleanReply, hasCta ? `[botao:${ctaLabel}|${ctaUrl}]` : null].filter(Boolean).join("\n\n"),
            });

            return new Response("ai_agent_response_sent", {
              status: 200,
              headers: corsHeaders,
            });
          }
        } else {
          const errText = await agentResponse.text();
          console.error(
            "Erro agent-chat:",
            agentResponse.status,
            errText.substring(0, 300),
          );
        }
      }
    } catch (aiError) {
      console.error("Erro ao processar agente IA:", aiError);
    }

    await releaseMessageProcessingLock(supabase, lockId);
    console.log(
      "Nenhuma palavra-chave correspondente encontrada e agente IA não disponível",
    );
    return new Response("no_match", { status: 200, headers: corsHeaders });
  } catch (error) {
    if (processingLockId) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await releaseMessageProcessingLock(supabase, processingLockId);
      } catch (releaseError) {
        console.error("Erro ao liberar lock de processamento:", releaseError);
      }
    }
    console.error("Erro no webhook:", error);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});

async function sendNodeContent(
  targetNode: any,
  nodes: FlowNode[],
  edges: FlowEdge[],
  phone: string,
  zapiConfig: any,
  visited: Set<string>,
  supabase?: any,
  userId?: string | null,
  flowName?: string,
  options?: {
    resumeCaptured?: PendingCaptureState["captured"];
    skipCapturePromptForField?: PendingCaptureState["field"] | null;
    flowId?: string | null;
  },
): Promise<boolean> {
  if (visited.has(targetNode.id)) return false;
  visited.add(targetNode.id);

  if (targetNode.type !== "blocoConteudo") return false;

  const getZapiAckId = (payload: any) => {
    return payload?.messageId || payload?.zapiMessageId || payload?.zaapId ||
      payload?.id || payload?.key?.id || payload?.message?.id || null;
  };

  const hasExplicitZapiError = (payload: any) => {
    return payload?.error || payload?.erro ||
      (payload?.success === false ? payload?.message : null) || null;
  };

  const isZapiSendConfirmed = (payload: any) => {
    const ackId = getZapiAckId(payload);
    const status = String(payload?.status || payload?.message?.status || "")
      .toUpperCase();
    const result = String(payload?.result || "").toUpperCase();
    const hasPositiveStatus =
      ["PENDING", "QUEUED", "QUEUE", "SENT", "SUCCESS", "OK"].includes(
        status,
      ) || ["PENDING", "QUEUED", "SUCCESS", "OK"].includes(result);
    return Boolean(ackId || hasPositiveStatus);
  };

  const parseZapiResponse = async (res: Response, context: string) => {
    const raw = await res.text();
    let payload: any = null;

    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { raw };
    }

    const explicitError = hasExplicitZapiError(payload);
    const confirmed = isZapiSendConfirmed(payload);

    console.log(
      `${context}: status=${res.status} confirmed=${confirmed} ack=${
        getZapiAckId(payload) || "none"
      } body=${raw.substring(0, 300)}`,
    );

    if (!res.ok || explicitError || !confirmed) {
      throw new Error(
        explicitError || `Z-API não confirmou o envio do bloco (${context})`,
      );
    }

    return payload;
  };

   // Handle delay before sending content
   const delaySeconds = Number(targetNode.data.delaySeconds || 0);
   if (delaySeconds > 0) {
     const safeDelay = Math.min(delaySeconds, 50); // Limit to 50s for backend
     console.log(`[webhook-zapi] Bloco de conteúdo com delay de ${safeDelay}s`);
     await new Promise(resolve => setTimeout(resolve, safeDelay * 1000));
   }
 
  const contentType = targetNode.data.contentType || "text";
  const isMediaContentType = ["image", "video", "audio", "document", "sticker", "gif"].includes(
    contentType,
  );
  const typeLabelForLog = (t: string) =>
    ({
      interactive: "Menu Interativo",
      "media-carousel": "Carrossel de Mídia",
      "request-location": "Solicitar Localização",
      "request-payment": "Solicitar Pagamento",
      pix: "Botão PIX",
    } as Record<string, string>)[t] || t;
  const stripButtonListFromMessage = (
    message: string,
    btns: Array<{ text?: string }>,
  ) => {
    const raw = String(message || "").trim();
    if (!raw) return "";

    const normalizedLabels = btns
      .map((btn) => String(btn?.text || "").trim().toLowerCase())
      .filter(Boolean);

    if (normalizedLabels.length === 0) return raw;

    const filtered = raw
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => {
        const normalizedLine = line
          .trim()
          .replace(/^[-*•]\s*/, "")
          .replace(/^\d+[.)-]?\s*/, "")
          .trim()
          .toLowerCase();

        if (!normalizedLine) return true;
        return !normalizedLabels.includes(normalizedLine);
      });

    return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  };
  const replaceCapturedVars = (text: string) => {
    const captured = options?.resumeCaptured || {};
    return String(text || "")
      .replace(/\{\{nome\}\}/gi, captured.nome || "")
      .replace(/\{\{whatsapp\}\}/gi, captured.whatsapp || phone || "")
      .replace(/\{\{telefone\}\}/gi, captured.whatsapp || phone || "")
      .replace(/\{\{email\}\}/gi, captured.email || "");
  };
  const content = replaceCapturedVars(targetNode.data.content || "");
  const mediaUrl = targetNode.data.mediaUrl || "";
  const getDocumentExtension = (fileUrl: string, fileName?: string) => {
    const source = String(fileName || fileUrl || "")
      .split("?")[0]
      .split("#")[0];
    const parts = source.split(".");
    if (parts.length < 2) return "pdf";
    const ext = parts.pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
    // Sanity: extensões válidas têm de 2 a 5 chars
    if (ext.length < 2 || ext.length > 5) return "pdf";
    return ext;
  };
  const buttons: Array<{
    text: string;
    type: string;
    value: string;
    id?: string | number | null;
  }> =
    targetNode.data.buttons || [];
  console.log(
    `🎥 Node data flags: isPtv=${targetNode.data?.isPtv}, viewOnce=${targetNode.data?.viewOnce}, contentType=${contentType}`,
  );

  const sendableButtons = buttons.filter((b) => b.type !== "flow");
  const flowButtons = buttons.filter((b) => b.type === "flow");
  const allSendButtons = [
    ...sendableButtons,
    ...flowButtons.map((b) => ({ ...b, type: "reply" })),
  ];
  const hasButtons = allSendButtons.length > 0;

  const isUazapiProvider =
    String(zapiConfig?.api_provider || "").toLowerCase() === "uazapi";
  const baseUrl =
    `https://api.z-api.io/instances/${zapiConfig.zapi_instance_id}/token/${zapiConfig.zapi_token}`;
  const headers = {
    "Content-Type": "application/json",
    "Client-Token": zapiConfig.zapi_client_token,
  };
  const uazapiUrl = String(zapiConfig?.evolution_api_url || "").replace(
    /\/+$/,
    "",
  );
  const uazapiToken = String(zapiConfig?.evolution_api_key || "");
  const normalizedTargetNumber = phone.includes("-group")
    ? `${String(phone).replace(/-group$/i, "").replace(/\D/g, "")}@g.us`
    : String(phone).replace(/^\+/, "").replace(/[@\-].*$/, "").replace(
      /\D/g,
      "",
    );

  const parseProviderResponse = async (res: Response, context: string) => {
    if (!isUazapiProvider) return parseZapiResponse(res, context);

    const raw = await res.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { raw };
    }

    console.log(
      `${context}: status=${res.status} provider=uazapi body=${
        raw.substring(0, 300)
      }`,
    );

    if (!res.ok || payload?.error || payload?.success === false) {
      throw new Error(
        payload?.error || payload?.message ||
          `UAZAPI não confirmou o envio do bloco (${context})`,
      );
    }

    return payload;
  };

  const sendProviderText = async (message: string, context: string) => {
    if (isUazapiProvider) {
      if (!uazapiUrl || !uazapiToken) {
        throw new Error("UAZAPI URL/Token não configurados");
      }
      const res = await fetch(`${uazapiUrl}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: uazapiToken },
        body: JSON.stringify({ number: normalizedTargetNumber, text: message }),
      });
      return parseProviderResponse(res, context);
    }

     const payload: any = { phone, message };
     if (targetNode.data?.mentionAll) {
       payload.mentionAll = true;
     }
 
     const res = await fetch(`${baseUrl}/send-text`, {
       method: "POST",
       headers,
       body: JSON.stringify(payload),
     });
    return parseProviderResponse(res, context);
  };

  const sendLocationWithFallback = async (lat: number, lng: number, title: string, address: string, context: string) => {
    const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
    const fallbackText = [title || "Localização", address, mapsUrl].filter(Boolean).join("\n");

    if (!lat || !lng) {
      // Tenta geocodificar o endereço/título via Nominatim (OpenStreetMap)
      const query = [address, title].filter(Boolean).join(", ").trim();
      if (query) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
            { headers: { "User-Agent": "ZapLynx/1.0 (flow-location)" } },
          );
          if (geoRes.ok) {
            const arr = await geoRes.json().catch(() => []);
            const first = Array.isArray(arr) && arr[0];
            if (first?.lat && first?.lon) {
              lat = Number(first.lat);
              lng = Number(first.lon);
              console.log(`📍 Geocoded "${query}" → ${lat},${lng}`);
            }
          }
        } catch (geoErr) {
          console.error("⚠️ Falha no geocoding:", geoErr);
        }
      }
      if (!lat || !lng) {
        const linkOnly = [title || "Localização", address].filter(Boolean).join("\n");
        await sendProviderText(linkOnly || "Localização não disponível", `${context} (sem coordenadas)`);
        return;
      }
    }

    try {
      if (isUazapiProvider) {
        if (!uazapiUrl || !uazapiToken) {
          throw new Error("UAZAPI URL/Token não configurados");
        }
        const res = await fetch(`${uazapiUrl}/send/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: uazapiToken },
          body: JSON.stringify({ number: normalizedTargetNumber, latitude: lat, longitude: lng, name: title || undefined, address: address || undefined }),
        });
        await parseProviderResponse(res, context);
      } else {
        const res = await fetch(`${baseUrl}/send-location`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            phone,
            latitude: String(lat),
            longitude: String(lng),
            title: title || "",
            address: address || "",
          }),
        });
        await parseProviderResponse(res, context);
      }
    } catch (error) {
      console.error(`⚠️ Falha ao enviar localização nativa; enviando link do mapa:`, error);
      const finalMaps = `https://maps.google.com/?q=${lat},${lng}`;
      const finalText = [title || "Localização", address, finalMaps].filter(Boolean).join("\n");
      await sendProviderText(finalText, `${context} (fallback link)`);
    }
  };

  const sendProviderMedia = async (
    type: "image" | "video" | "audio" | "document",
    file: string,
    caption: string,
    context: string,
    options?: { isPtv?: boolean; viewOnce?: boolean },
  ) => {
    if (isUazapiProvider) {
      if (!uazapiUrl || !uazapiToken) {
        throw new Error("UAZAPI URL/Token não configurados");
      }
      const mappedType = type === "audio"
        ? "ptt"
        : type === "video" && options?.isPtv
        ? "ptv"
        : type;
      const res = await fetch(`${uazapiUrl}/send/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: uazapiToken },
        body: JSON.stringify({
          number: normalizedTargetNumber,
          type: mappedType,
          file,
          ...(caption && mappedType !== "ptv" ? { text: caption } : {}),
          ...(options?.viewOnce ? { viewOnce: true } : {}),
        }),
      });
      return parseProviderResponse(res, context);
    }

    let endpoint = "";
    const body: any = { phone };
    if (type === "image") {
      endpoint = "/send-image";
      body.image = file;
      body.caption = caption;
    } else if (type === "video") {
      endpoint = "/send-video";
      body.video = file;
      body.caption = caption;
    } else if (type === "audio") {
      endpoint = "/send-audio";
      body.audio = file;
      body.waveform = true;
    } else {
      const extension = getDocumentExtension(file, targetNode.data?.fileName);
      endpoint = `/send-document/${extension}`;
      body.document = file;
      body.fileName = targetNode.data?.fileName || `documento.${extension}`;
      body.caption = caption;
    }

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return parseProviderResponse(res, context);
  };

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

  const captureSteps: Array<
    {
      field: PendingCaptureState["field"];
      enabled: boolean;
      prompt: string;
      followUp: string;
      handle: string;
    }
  > = [
    {
      field: "name" as const,
      enabled: !!targetNode.data.collectName,
      prompt: targetNode.data.content || targetNode.data.namePrompt ||
        "Qual o seu nome?",
      followUp: targetNode.data.nameFollowUp || "",
      handle: "collect-name",
    },
    {
      field: "whatsapp" as const,
      enabled: !!targetNode.data.collectWhatsapp,
      prompt: targetNode.data.content || targetNode.data.whatsappPrompt ||
        "Qual seu WhatsApp?",
      followUp: targetNode.data.whatsappFollowUp || "",
      handle: "collect-whatsapp",
    },
    {
      field: "email" as const,
      enabled: !!targetNode.data.collectEmail,
      prompt: targetNode.data.content || targetNode.data.emailPrompt ||
        "Qual seu melhor email?",
      followUp: targetNode.data.emailFollowUp || "",
      handle: "collect-email",
    },
  ].filter((step) => step.enabled);

  const nextCaptureStep = captureSteps.find((step) => {
    if (options?.skipCapturePromptForField === step.field) return false;
    if (step.field === "name") return !options?.resumeCaptured?.nome;
    if (step.field === "whatsapp") return !options?.resumeCaptured?.whatsapp;
    if (step.field === "email") return !options?.resumeCaptured?.email;
    return false;
  });

  function wrapUrlWithTracking(rawUrl: string, btnText: string): string {
    if (!flowName || !userId) return rawUrl;
    const finalUrl = rawUrl.match(/^https?:\/\//)
      ? rawUrl
      : `https://${rawUrl}`;
    const params = new URLSearchParams({
      url: finalUrl,
      flow: flowName,
      btn: btnText,
      uid: userId,
      ph: phone,
    });
    return `https://go.zaplynxpro.online/r?${params.toString()}`;
  }

  function buildReplyButtons(btns: typeof allSendButtons) {
    return btns
      .filter((b) => b.type === "reply" || b.type === "flow")
      .slice(0, 3)
      .map((btn, idx) => ({
        id: `button-${idx}`,
        label: (btn.text || "").trim() || "Botão",
      }));
  }

  function buildUazapiMenuChoices(btns: typeof allSendButtons) {
    return btns
      .slice(0, 10)
      .map((btn, idx) => {
        const label = (btn.text || "").trim() || `Botão ${idx + 1}`;
        const stableReplyId = `button-${idx}`;
        if (btn.type === "url" && btn.value) {
          return `${label}|url:${wrapUrlWithTracking(btn.value.trim(), label)}`;
        }
        if (btn.type === "call" && btn.value) {
          return `${label}|call:${btn.value.trim()}`;
        }
        return `${label}|${stableReplyId}`;
      });
  }

  function buildUrlCallSuffix(btns: typeof allSendButtons): string {
    const parts: string[] = [];
    for (const btn of btns) {
      const label = (btn.text || "").trim();
      if (btn.type === "url" && btn.value) {
        const url = wrapUrlWithTracking(btn.value.trim(), label || "Link");
        parts.push(`🔗 ${label}: ${url}`);
      } else if (btn.type === "call" && btn.value) {
        parts.push(`📞 ${label}: ${btn.value.trim()}`);
      }
    }
    return parts.length > 0 ? "\n\n" + parts.join("\n") : "";
  }

  try {
    console.log(
      `>>> Enviando bloco ${targetNode.id} tipo=${contentType} buttons=${allSendButtons.length}`,
    );

    if (isMediaContentType && !mediaUrl) {
      console.warn(
        `⚠️ Bloco ${targetNode.id} marcado como ${contentType}, mas sem mediaUrl — pulando envio do bloco para não travar o fluxo`,
      );
      return false;
    }

    // === Tipos especiais (contact / location / presence / status / interactive / carousel / pix / payment) ===
    // Suporta tanto UAZAPI quanto Z-API.
    if (!nextCaptureStep) {
      const sendUaz = async (path: string, body: any, ctx: string) => {
        if (!uazapiUrl || !uazapiToken) {
          throw new Error("UAZAPI URL/Token não configurados");
        }
        const res = await fetch(`${uazapiUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: uazapiToken },
          body: JSON.stringify(body),
        });
        return parseProviderResponse(res, ctx);
      };

      const sendZapi = async (path: string, body: any, ctx: string) => {
        const res = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        return parseProviderResponse(res, ctx);
      };

      if (contentType === "contact") {
        if (isUazapiProvider) {
          await sendUaz(
            "/send/contact",
            {
              number: normalizedTargetNumber,
              fullName: targetNode.data.contactName || "",
              phoneNumber: targetNode.data.contactPhone || "",
              organization: targetNode.data.contactOrg || undefined,
            },
            `Bloco ${targetNode.id} (contact)`,
          );
        } else {
          await sendZapi(
            "/send-contact",
            {
              phone,
              contactName: targetNode.data.contactName || "",
              contactPhone: String(targetNode.data.contactPhone || "").replace(/\D/g, ""),
            },
            `Bloco ${targetNode.id} (contact)`,
          );
        }
        if (!hasButtons) return false;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (contentType === "location" || contentType === "location-buttons") {
        const lat = Number(String(targetNode.data.locationLat || "0").replace(",", ".")) || 0;
        const lng = Number(String(targetNode.data.locationLng || "0").replace(",", ".")) || 0;
        await sendLocationWithFallback(
          lat,
          lng,
          targetNode.data.locationName || "",
          targetNode.data.locationAddress || "",
          `Bloco ${targetNode.id} (location)`,
        );
        if (!hasButtons) return false;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (contentType === "presence") {
        const presenceType = String(targetNode.data.presenceType || "composing");
        const duration = Number(targetNode.data.presenceDuration || 0);
        if (isUazapiProvider) {
          await sendUaz(
            "/send/presence",
            {
              number: normalizedTargetNumber,
              presence: presenceType,
              ...(duration > 0 ? { duration } : {}),
            },
            `Bloco ${targetNode.id} (presence)`,
          );
        } else {
          // Z-API: chat-state aceita apenas "typing" / "recording" / "paused"
          const zapiState =
            presenceType === "recording" || presenceType === "audio"
              ? "recording"
              : presenceType === "paused" || presenceType === "available" || presenceType === "unavailable"
                ? "paused"
                : "typing";
          try {
            await sendZapi(
              "/send-chat-state",
              { phone, chatState: zapiState },
              `Bloco ${targetNode.id} (presence)`,
            );
          } catch (err) {
            console.warn(`⚠️ /send-chat-state falhou, tentando /chat-state:`, err);
            await sendZapi(
              "/chat-state",
              { phone, chatState: zapiState },
              `Bloco ${targetNode.id} (presence-fallback)`,
            );
          }
          if (duration > 0) {
            await new Promise((r) => setTimeout(r, Math.min(duration, 30) * 1000));
            try {
              await sendZapi(
                "/send-chat-state",
                { phone, chatState: "paused" },
                `Bloco ${targetNode.id} (presence-stop)`,
              );
            } catch (err) {
              console.warn(`⚠️ presence-stop falhou:`, err);
            }
          }
        }
        return false;
      }

      if (contentType === "status") {
        const kind = String(targetNode.data.statusKind || "text");
        if (isUazapiProvider) {
          await sendUaz(
            "/send/status",
            {
              type: kind,
              text: content || undefined,
              file: kind !== "text" ? mediaUrl : undefined,
              backgroundColor: targetNode.data.statusBg || undefined,
            },
            `Bloco ${targetNode.id} (status)`,
          );
        } else {
          // Z-API: status broadcast — não usa "phone"
          // Garantindo que a mídia seja passada corretamente
          const statusMedia = mediaUrl || targetNode.data.mediaUrl;
          
          if (kind === "image" && statusMedia) {
            await sendZapi(
              "/send-image-status",
              { image: statusMedia, caption: content || "" },
              `Bloco ${targetNode.id} (status-image)`,
            );
          } else if (kind === "video" && statusMedia) {
            await sendZapi(
              "/send-video-status",
              { video: statusMedia, caption: content || "" },
              `Bloco ${targetNode.id} (status-video)`,
            );
          } else if (kind === "audio" && statusMedia) {
             // Fallback para áudio se necessário, embora Z-API Status seja focado em Imagem/Vídeo/Texto
             await sendZapi(
               "/send-audio-status",
               { audio: statusMedia },
               `Bloco ${targetNode.id} (status-audio)`,
             ).catch(async () => {
               // Fallback se o endpoint de áudio não existir/funcionar como esperado para status
               console.warn("Status áudio falhou, enviando como texto");
               await sendZapi("/send-text-status", { message: content || "Status de Áudio" }, `Bloco ${targetNode.id} (status-text-fallback)`);
             });
          } else {
            await sendZapi(
              "/send-text-status",
              { message: content || "" },
              `Bloco ${targetNode.id} (status-text)`,
            );
          }
        }
        return false;
      }

      if (contentType === "interactive") {
        const kind = String(targetNode.data.interactiveKind || "button");
        if (isUazapiProvider) {
          const choices = (targetNode.data.buttons || []).slice(0, 10).map(
            (b: any, i: number) => {
              const label = (b.text || `Opção ${i + 1}`).trim();
              if (b.type === "url" && b.value) return `${label}|url:${b.value}`;
              if (b.type === "call" && b.value) return `${label}|call:${b.value}`;
              return `${label}|button-${i}`;
            },
          );
          await sendUaz(
            "/send/menu",
            {
              number: normalizedTargetNumber,
              type: kind,
              text: content || "Selecione uma opção:",
              footerText: targetNode.data.footer || undefined,
              buttonText: targetNode.data.listButtonText || undefined,
              choices,
            },
            `Bloco ${targetNode.id} (interactive:${kind})`,
          );
        } else {
          // Z-API: button-actions / option-list
          const rawButtons = (targetNode.data.buttons || []) as any[];
          if (kind === "list") {
            const options = rawButtons.slice(0, 10).map((b: any, i: number) => ({
              id: b.id || String(i + 1),
              title: (b.text || `Opção ${i + 1}`).trim().slice(0, 24),
              description: b.description || "",
            }));
            await sendZapi(
              "/send-option-list",
              {
                phone,
                message: content || "Selecione uma opção:",
                optionList: {
                  title: targetNode.data.listButtonText || "Opções",
                  buttonLabel: targetNode.data.listButtonText || "Ver opções",
                  options,
                },
              },
              `Bloco ${targetNode.id} (interactive:list)`,
            );
          } else {
            const buttonActions = rawButtons.slice(0, 3).map((b: any, i: number) => {
              const t = String(b.type || "reply").toLowerCase();
              const action: any = {
                id: b.id || String(i + 1),
                label: (b.text || `Opção ${i + 1}`).trim().slice(0, 25),
              };
              if (t === "url" && b.value) {
                action.type = "URL";
                action.url = b.value;
              } else if (t === "call" && b.value) {
                action.type = "CALL";
                action.phone = b.value;
              } else {
                action.type = "REPLY";
              }
              return action;
            });
            await sendZapi(
              "/send-button-actions",
              {
                phone,
                message: content || "Selecione uma opção:",
                ...(targetNode.data.footer ? { footer: targetNode.data.footer } : {}),
                buttonActions,
              },
              `Bloco ${targetNode.id} (interactive:${kind})`,
            );
          }
        }
        return true; // pausa aguardando resposta
      }

            if (contentType === "sticker" && mediaUrl) {
        await sendZapi("/send-sticker", { phone, sticker: mediaUrl }, `Bloco ${targetNode.id} (sticker)`);
        return false;
      }
      if (contentType === "gif" && mediaUrl) {
        await sendZapi("/send-gif", { phone, gif: mediaUrl, caption: content || "" }, `Bloco ${targetNode.id} (gif)`);
        return false;
      }
      if (contentType === "link" && (mediaUrl || targetNode.data.linkUrl)) {
        await sendZapi("/send-link", { 
          phone, 
          message: content || "", 
          image: mediaUrl || undefined, 
          linkUrl: targetNode.data.linkUrl || mediaUrl 
        }, `Bloco ${targetNode.id} (link)`);
        return false;
      }
      if (contentType === "poll") {
        const pollOptions = (targetNode.data.buttons || []).map((b: any) => b.text || "Opção");
        await sendZapi("/send-poll", { phone, pollName: content || "Enquete", options: pollOptions, selectableOptionsCount: 1 }, `Bloco ${targetNode.id} (poll)`);
        return false;
      }
      if (contentType === "reaction") {
        await sendZapi("/send-message-reaction", { phone, messageId: targetNode.data.targetMessageId, emoji: targetNode.data.emoji || "👍" }, `Bloco ${targetNode.id} (reaction)`);
        return false;
      }
      if (contentType === "read") {
        await sendZapi("/read-message", { phone, messageId: targetNode.data.targetMessageId }, `Bloco ${targetNode.id} (read)`);
        return false;
      }
      if (contentType === "delete") {
        await sendZapi("/delete-message", { phone, messageId: targetNode.data.targetMessageId, owner: true }, `Bloco ${targetNode.id} (delete)`);
        return false;
      }
            if (contentType === "product") {
        await sendZapi("/send-message-product", { 
          phone, 
          productId: targetNode.data.productId,
          message: content || "",
          footer: targetNode.data.footer || ""
        }, `Bloco ${targetNode.id} (product)`);
        return false;
      }
      if (contentType === "catalog") {
        await sendZapi("/send-message-catalog", { 
          phone, 
          message: content || "",
          footer: targetNode.data.footer || ""
        }, `Bloco ${targetNode.id} (catalog)`);
        return false;
      }
      if (contentType === "order") {
        const total = parseFloat(String(targetNode.data.orderTotal || "0"));
        await sendZapi("/send-message-order", { 
          phone, 
          orderTitle: targetNode.data.orderTitle || "Pedido",
          message: content || "",
          items: [{
            name: targetNode.data.orderTitle || "Item",
            quantity: 1,
            price: total,
            currency: "BRL"
          }]
        }, `Bloco ${targetNode.id} (order)`);
        return false;
      }
      if (contentType === "reply" && targetNode.data.targetMessageId) {
        await sendZapi("/reply-message", { 
          phone, 
          message: content, 
          messageId: targetNode.data.targetMessageId 
        }, `Bloco ${targetNode.id} (reply)`);
        return false;
      }
      if (contentType === "forward" && targetNode.data.targetMessageId) {
        await sendZapi("/forward-message", { 
          phone, 
          messageId: targetNode.data.targetMessageId 
        }, `Bloco ${targetNode.id} (forward)`);
        return false;
      }
      if (contentType === "pin") {
        await sendZapi("/send-pin-message", { phone, messageId: targetNode.data.targetMessageId, pin: true, duration: 2592000 }, `Bloco ${targetNode.id} (pin)`);
        return false;
      }

      if (contentType === "request-location") {
        if (isUazapiProvider) {
          await sendUaz(
            "/send/request-location",
            {
              number: normalizedTargetNumber,
              text: content || "Por favor, compartilhe sua localização.",
            },
            `Bloco ${targetNode.id} (request-location)`,
          );
        } else {
          // Z-API não tem endpoint nativo de "solicitar localização" — fallback para texto
          await sendProviderText(
            content || "📍 Por favor, compartilhe sua localização.",
            `Bloco ${targetNode.id} (request-location)`,
          );
        }
        return false;
      }

      if (contentType === "request-payment" || contentType === "pix") {
        const source = String(
          targetNode.data[contentType === "pix" ? "pixSource" : "paymentSource"] || "manual",
        );
        const amountReais = parseFloat(
          String(
            targetNode.data[contentType === "pix" ? "pixAmount" : "paymentAmount"] || "0",
          ).replace(",", "."),
        );
        const amountCents = Math.round((amountReais || 0) * 100);
        const description = String(
          targetNode.data[contentType === "pix" ? "pixDescription" : "paymentDescription"] ||
            "Pagamento",
        );

        let brCode = "";
        let qrCodeImage = "";

        if (source === "gateway" && userId && amountCents > 0) {
          try {
            const chargeRes = await fetch(
              `${supabaseUrl}/functions/v1/gateway-flow-charge`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  userId,
                  amount: amountCents,
                  description,
                  customerName: options?.resumeCaptured?.nome || null,
                  customerEmail: options?.resumeCaptured?.email || null,
                  customerPhone: options?.resumeCaptured?.whatsapp || phone,
                }),
              },
            );
            const chargeData = await chargeRes.json();
            brCode = chargeData?.brCode || "";
            qrCodeImage = chargeData?.qrCodeImage || "";
          } catch (e) {
            console.error("Falha ao gerar cobrança no gateway:", e);
          }
        }

        if (isUazapiProvider) {
          if (contentType === "pix") {
            await sendUaz(
              "/send/pix",
              {
                number: normalizedTargetNumber,
                keyType: targetNode.data.pixKeyType || "random",
                key: brCode || targetNode.data.pixKey || "",
                receiver: targetNode.data.pixReceiver || null,
                amount: amountReais,
                description,
              },
              `Bloco ${targetNode.id} (pix)`,
            );
          } else {
            await sendUaz(
              "/send/request-payment",
              {
                number: normalizedTargetNumber,
                amount: amountReais,
                description,
                receiver: targetNode.data.paymentReceiver || null,
                brCode: brCode || undefined,
              },
              `Bloco ${targetNode.id} (request-payment)`,
            );
          }
        } else {
          // Z-API: /send-payment-pix (cobrança PIX nativa)
          const pixKey = brCode
            || (contentType === "pix"
              ? (targetNode.data.pixKey || "")
              : (targetNode.data.paymentReceiver || ""));
          const keyType = String(
            contentType === "pix"
              ? (targetNode.data.pixKeyType || "random")
              : (targetNode.data.paymentKeyType || "random"),
          ).toUpperCase();
          const merchantName = String(
            targetNode.data.pixMerchantName
              || targetNode.data.paymentReceiver
              || description
              || "Pagamento",
          ).slice(0, 25);
          await sendZapi(
            "/send-payment-pix",
            {
              phone,
              pixKey,
              type: keyType,
              merchantName,
              ...(amountReais > 0 ? { value: amountReais } : {}),
              ...(description ? { description } : {}),
            },
            `Bloco ${targetNode.id} (${contentType})`,
          );
        }

        // Envia também o copia-cola por texto para facilitar o cliente
        if (brCode) {
          await sendProviderText(
            `📋 PIX Copia e Cola:\n\n${brCode}`,
            `Bloco ${targetNode.id} (pix copia-cola)`,
          );
        }
        return false;
      }
    }

    if (nextCaptureStep) {
      await sendProviderText(
        replaceCapturedVars(nextCaptureStep.prompt),
        `Bloco ${targetNode.id} (capture:${nextCaptureStep.field})`,
      );

      if (supabase && userId) {
        await supabase.from("message_logs").insert({
          phone,
          message_received: null,
          response_sent: JSON.stringify({
            flowId: options?.flowId || null,
            flowName: flowName || null,
            nodeId: targetNode.id,
            field: nextCaptureStep.field,
            instanceId: zapiConfig?.zapi_instance_id || null,
            captured: options?.resumeCaptured || {},
          }),
          keyword_matched: `${FLOW_CAPTURE_PREFIX}${userId}`,
          timestamp: new Date().toISOString(),
          user_id: userId,
          instance_id: zapiConfig?.zapi_instance_id || null,
        });
      }

      return true;
    }

     if (hasButtons || contentType === "media-carousel") {
       if (contentType === "media-carousel") {
         let cards = [];
         try {
           cards = JSON.parse(targetNode.data.carouselCardsJson || "[]");
         } catch (e) {
           console.error("Erro ao parsear carrossel no webhook:", e);
         }
         if (cards.length > 0) {
           if (isUazapiProvider) {
             // Fallback for UAZAPI as it might not support carousel natively in some versions
             await sendProviderText(content || "🎠 Carrossel", `Bloco ${targetNode.id} (carousel-uaz-fallback)`);
           } else {
             await sendZapi("/send-carousel", { 
               phone, 
               carousel: cards, 
               message: content || "",
               ...(targetNode.data?.mentionAll ? { mentionAll: true } : {})
             }, `Bloco ${targetNode.id} (carousel)`);
           }
           await new Promise((resolve) => setTimeout(resolve, 1500));
         }
         return false;
       }
 
      if ((contentType === "image" || contentType === "video" || contentType === "audio" || contentType === "document") && mediaUrl) {
        let mediaEndpoint: string;
        const mediaBody: any = { phone };
        if (contentType === "video" && targetNode.data?.isPtv) {
          mediaEndpoint = "/send-ptv";
          mediaBody.ptv = mediaUrl;
        } else if (contentType === "video") {
          mediaEndpoint = "/send-video";
          mediaBody.video = mediaUrl;
          if (targetNode.data?.viewOnce) mediaBody.viewOnce = true;
        } else if (contentType === "audio") {
          mediaEndpoint = "/send-audio";
          mediaBody.audio = mediaUrl;
          mediaBody.waveform = true;
        } else if (contentType === "document") {
          const extension = getDocumentExtension(mediaUrl, targetNode.data?.fileName);
          mediaEndpoint = `/send-document/${extension}`;
          mediaBody.document = mediaUrl;
          mediaBody.fileName = targetNode.data?.fileName || `documento.${extension}`;
        } else {
          mediaEndpoint = "/send-image";
          mediaBody.image = mediaUrl;
        }
        if (isUazapiProvider) {
          await sendProviderMedia(
            contentType as "image" | "video" | "audio" | "document",
            mediaUrl,
            "",
            `Bloco ${targetNode.id} (${contentType} mídia pré-botões)`,
            {
              isPtv: Boolean(targetNode.data?.isPtv),
              viewOnce: Boolean(targetNode.data?.viewOnce),
            },
          );
        } else {
          const mediaRes = await fetch(`${baseUrl}${mediaEndpoint}`, {
            method: "POST",
            headers,
            body: JSON.stringify(mediaBody),
          });
          await parseProviderResponse(
            mediaRes,
            `Bloco ${targetNode.id} (${contentType} mídia pré-botões)`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const replyButtons = buildReplyButtons(allSendButtons);
      const urlCallSuffix = buildUrlCallSuffix(allSendButtons);
      const sanitizedContent = isUazapiProvider
        ? stripButtonListFromMessage(content || "", allSendButtons)
        : (content || "");
      // UAZAPI já entrega botões URL/CALL nativamente via /send/menu (choices),
      // então NÃO devemos anexar os links no texto (causa duplicação).
      // Para Z-API, anexamos o sufixo apenas quando vamos cair no fallback de texto puro.
      const fullMessage = isUazapiProvider
        ? sanitizedContent
        : sanitizedContent + urlCallSuffix;

      let res: Response | null = null;
      if (isUazapiProvider) {
        if (!uazapiUrl || !uazapiToken) {
          throw new Error("UAZAPI URL/Token não configurados");
        }
        const menuChoices = buildUazapiMenuChoices(allSendButtons);
        console.log(`📤 UAZAPI /send/menu → ${normalizedTargetNumber} | choices=${JSON.stringify(menuChoices)}`);
        res = await fetch(`${uazapiUrl}/send/menu`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: uazapiToken },
          body: JSON.stringify({
            number: normalizedTargetNumber,
            type: "button",
            text: fullMessage || "Selecione uma opção:",
            footerText: targetNode.data.footer || undefined,
            choices: menuChoices,
          }),
        });
      } else if (replyButtons.length > 0) {
        res = await fetch(`${baseUrl}/send-button-list`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            phone,
            message: fullMessage,
            buttonList: { buttons: replyButtons },
          }),
        });
      } else {
        // URL/Call buttons only — use send-button-actions
        const actionButtons = allSendButtons
          .filter((b) => b.type === "url" || b.type === "call")
          .slice(0, 3)
          .map((btn, idx) => {
            const action: any = {
              id: String(idx + 1),
              type: btn.type === "url" ? "URL" : "CALL",
              label: (btn.text || "").trim() || "Botão",
            };
            if (btn.type === "url" && btn.value) {
              const label = (btn.text || "").trim() || "Link";
              action.url = wrapUrlWithTracking(btn.value.trim(), label);
            }
            if (btn.type === "call" && btn.value) {
              action.phone = btn.value.trim();
            }
            return action;
          });

        if (actionButtons.length > 0) {
          res = await fetch(`${baseUrl}/send-button-actions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              phone,
              message: content || "Selecione uma opção:",
              buttonActions: actionButtons,
            }),
          });
        } else {
          res = await fetch(`${baseUrl}/send-text`, {
            method: "POST",
            headers,
            body: JSON.stringify({ phone, message: fullMessage }),
          });
        }
      }
      if (res) {
        await parseProviderResponse(
          res,
          `Bloco ${targetNode.id} (${contentType}+buttons)`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } else {
      let endpoint = "";
      let body: any = { phone };
      if (targetNode.data?.mentionAll) {
        body.mentionAll = true;
      }

      switch (contentType) {
        case "text":
          endpoint = "/send-text";
          body.message = content;
          break;
        case "image":
        case "image-buttons":
          endpoint = "/send-image";
          body.image = mediaUrl;
          body.caption = content;
          break;
        case "video":
        case "video-buttons":
          if (targetNode.data?.isPtv) {
            endpoint = "/send-ptv";
            body.ptv = mediaUrl;
          } else {
            endpoint = "/send-video";
            body.video = mediaUrl;
            body.caption = content;
            if (targetNode.data?.viewOnce) body.viewOnce = true;
          }
          break;
        case "audio":
        case "audio-buttons":
          endpoint = "/send-audio";
          body.audio = mediaUrl;
          body.waveform = true;
          break;
        case "document":
          endpoint = `/send-document/${getDocumentExtension(mediaUrl, targetNode.data?.fileName)}`;
          body.document = mediaUrl;
          body.fileName = targetNode.data?.fileName || `documento.${getDocumentExtension(mediaUrl, targetNode.data?.fileName)}`;
          body.caption = content;
          break;
        case "media-carousel": {
          endpoint = "/send-carousel";
          let cards = [];
          try {
            cards = JSON.parse(targetNode.data.carouselCardsJson || "[]");
          } catch (e) {
            console.error("Erro ao parsear carrossel no webhook:", e);
          }
          body.carousel = cards;
          body.message = content || "";
          break;
        }
        case "location":
        case "location-buttons":
        case "request-location":
          return await sendLocationWithFallback(
            Number(targetNode.data.locationLat || 0),
            Number(targetNode.data.locationLng || 0),
            targetNode.data.locationName || "",
            targetNode.data.locationAddress || "",
            `Bloco ${targetNode.id} (location)`,
          ).then(() => false);
        case "pix":
        case "request-payment": {
          endpoint = "/send-payment-pix";
          body.pixKey = targetNode.data.pixKey || targetNode.data.paymentReceiver || "";
          body.type = String(targetNode.data.pixKeyType || "cpf").toUpperCase();
          body.merchantName = targetNode.data.pixReceiver || targetNode.data.paymentReceiver || "";
          body.value = Number(targetNode.data.pixAmount || targetNode.data.paymentAmount || 0);
          body.description = targetNode.data.pixDescription || targetNode.data.paymentDescription || content || "";
          break;
        }
        case "contact": {
          endpoint = "/send-contact";
          body.contactName = targetNode.data.contactName || "";
          body.contactPhone = String(targetNode.data.contactPhone || "").replace(/\D/g, "");
          body.contactBusinessDescription = targetNode.data.contactOrg || "";
          break;
        }
        default:
          endpoint = "/send-text";
          body.message = content;
      }

      if (endpoint) {
        if (contentType !== "text" && !mediaUrl) {
          console.warn(
            `⚠️ Bloco ${targetNode.id} (${contentType}) sem arquivo; seguindo o fluxo sem tentar enviar mídia`,
          );
        } else if (isUazapiProvider && contentType !== "text") {
          await sendProviderMedia(
            contentType as "image" | "video" | "audio" | "document",
            mediaUrl,
            content,
            `Bloco ${targetNode.id} (${contentType})`,
              {
                isPtv: Boolean(targetNode.data?.isPtv),
                viewOnce: Boolean(targetNode.data?.viewOnce),
              },
          );
        } else if (isUazapiProvider && contentType === "text") {
          await sendProviderText(
            content,
            `Bloco ${targetNode.id} (${contentType})`,
          );
        } else {
          const res = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });
          await parseProviderResponse(
            res,
            `Bloco ${targetNode.id} (${contentType})`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    if (supabase && userId) {
      try {
        const buttonLabels = allSendButtons.map((b) => b.text).filter(Boolean)
          .join(" | ");
        let logContent = content || "";

        if (mediaUrl && contentType && contentType !== "text") {
          const mediaTag = `[media:${contentType}:${mediaUrl}]`;
          logContent = logContent ? `${mediaTag}\n${logContent}` : mediaTag;
        }

        if (buttonLabels) {
          logContent = logContent
            ? `${logContent}\n\n[Botões: ${buttonLabels}]`
            : `[Botões: ${buttonLabels}]`;
        }

        if (logContent) {
          await supabase.from("message_logs").insert({
            phone,
            message_received: null,
            response_sent: logContent,
            keyword_matched: `__flow_send__${flowName ? `:${flowName}` : ""}`,
            timestamp: new Date().toISOString(),
            user_id: userId,
            instance_id: zapiConfig?.zapi_instance_id || null,
          });
        }
      } catch (logErr) {
        console.error("Erro ao logar mensagem do fluxo:", logErr);
      }
    }
  } catch (e) {
    console.error(`Erro ao enviar bloco ${targetNode.id}:`, e);
    throw e;
  }

  const hasCaptureEdges = edges.some((e) =>
    e.source === targetNode.id &&
    String(e.sourceHandle || "").startsWith("collect-")
  );
  const hasButtonEdges = buttons.some((btn, idx) => {
    const aliases = getButtonHandleAliases(idx, btn);
    return edges.some((e) =>
      e.source === targetNode.id && aliases.includes(String(e.sourceHandle || ""))
    );
  });

  if (hasButtons && supabase && userId) {
    await supabase.from("message_logs").insert({
      phone,
      message_received: null,
      response_sent: JSON.stringify({
        flowId: options?.flowId || null,
        flowName: flowName || null,
        nodeId: targetNode.id,
        instanceId: zapiConfig?.zapi_instance_id || null,
        buttons: buttons.map((btn, idx) => ({
          text: String(btn?.text || "").trim(),
          handleAliases: getButtonHandleAliases(idx, btn),
          index: idx,
          menuIndex: idx + 1,
        })),
        captured: options?.resumeCaptured || {},
      }),
      keyword_matched: `${FLOW_BUTTON_PREFIX}${userId}`,
      timestamp: new Date().toISOString(),
      user_id: userId,
      instance_id: zapiConfig?.zapi_instance_id || null,
    });
  }

  if (hasButtons || hasCaptureEdges) {
    console.log(
      `Bloco ${targetNode.id} tem botões/captura — aguardando resposta do usuário`,
    );
    return true;
  }

  return false;
}

async function routeMatchedButtonFlow(
  params: {
    match: { flow: any; targetNodeId: string; buttonText: string; flowName: string };
    phone: string;
    zapiConfig: any;
    supabase: any;
    userId?: string | null;
    lockId: string;
    flowId?: string | null;
    resumeCaptured?: PendingCaptureState["captured"];
  },
) {
  const {
    match,
    phone,
    zapiConfig,
    supabase,
    userId,
    lockId,
    flowId,
    resumeCaptured,
  } = params;

  console.log("=== BOTÃO MATCH ===");
  console.log(
    "Fluxo:",
    match.flowName,
    "| Botão:",
    match.buttonText,
    "| Target:",
    match.targetNodeId,
  );

  const flowNodes: FlowNode[] = match.flow.nodes || [];
  const flowEdges: FlowEdge[] = match.flow.edges || [];
  const targetNode = flowNodes.find((n) => n.id === match.targetNodeId);

  console.log(
    "Total nodes:",
    flowNodes.length,
    "| Total edges:",
    flowEdges.length,
  );
  console.log("Target node:", JSON.stringify(targetNode?.data));

  if (!targetNode) return false;

  const visited = new Set<string>();
  const flowContext = {
    flowId: flowId || match.flow.id || null,
    resumeCaptured,
  };

      if (targetNode.type === "blocoConteudo" || targetNode.type === "blocoAcao") {
        const isActionDelay = targetNode.type === "blocoAcao" && targetNode.data.actionType === "delay";
        
        if (isActionDelay) {
          const seconds = Number(targetNode.data.delaySeconds ?? targetNode.data.actionConfig ?? 0) || 0;
          if (seconds > 0) {
            const safeSeconds = Math.min(seconds, 50);
            console.log(`[webhook-zapi] Aplicando delay de ${safeSeconds}s para o nó ${targetNode.id}`);
            await new Promise((resolve) => setTimeout(resolve, safeSeconds * 1000));
          }
        }

        if (targetNode.type === "blocoConteudo") {
    const shouldStop = await sendNodeContent(
      targetNode,
      flowNodes,
      flowEdges,
      phone,
      zapiConfig,
      visited,
      supabase,
      userId,
      match.flowName,
      flowContext,
    );

    if (!shouldStop) {
      await processFlowNode(
        targetNode.id,
        flowNodes,
        flowEdges,
        phone,
        zapiConfig,
        supabase,
        visited,
        userId,
        match.flowName,
        flowContext,
      );
    } else {
      console.log("Fluxo pausado no ram alvo - aguardando próximo clique de botão");
    }
  } else {
    await processFlowNode(
      targetNode.id,
      flowNodes,
      flowEdges,
      phone,
      zapiConfig,
      supabase,
      visited,
      userId,
      match.flowName,
      flowContext,
    );
  }

  await finalizeMessageLog(supabase, lockId, {
    keywordMatched: `[Botão: ${match.buttonText}]`,
    responseSent: `[Fluxo: ${match.flowName}]`,
  });
  await setVisibleIncomingMessage(supabase, lockId, match.buttonText || "[Botão]");

  return true;
}

async function processFlowNode(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  phone: string,
  zapiConfig: any,
  supabase: any,
  visited: Set<string>,
  userId?: string | null,
  flowName?: string,
  options?: {
    resumeCaptured?: PendingCaptureState["captured"];
    skipCapturePromptForField?: PendingCaptureState["field"] | null;
    flowId?: string | null;
  },
) {
  const currentNode = nodes.find((n) => n.id === nodeId);
  const currentNodeButtons = Array.isArray(currentNode?.data?.buttons)
    ? currentNode.data.buttons
    : [];
  const currentNodeHasCapture = Boolean(
    currentNode?.data?.collectName ||
      currentNode?.data?.collectWhatsapp ||
      currentNode?.data?.collectEmail ||
      edges.some((e) =>
        e.source === nodeId && String(e.sourceHandle || "").startsWith("collect-")
      ),
  );

  if (currentNode?.type === "blocoConteudo" && (currentNodeButtons.length > 0 || currentNodeHasCapture)) {
    console.log(
      `processFlowNode(${nodeId}): bloco de interação/captura não deve avançar automaticamente`,
    );
    return;
  }

  const sortEdgesByFlowPriority = (list: FlowEdge[]) => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return [...list].sort((a, b) => {
      const handlePriority = (handle?: string | null) => {
        if (!handle || handle === "default") return 0;
        if (isButtonHandle(handle)) return 2;
        return 1;
      };

      const priorityDiff = handlePriority(a.sourceHandle) -
        handlePriority(b.sourceHandle);
      if (priorityDiff !== 0) return priorityDiff;

      const aTarget = nodeMap.get(a.target);
      const bTarget = nodeMap.get(b.target);
      const ay = aTarget?.position?.y ?? 0;
      const by = bTarget?.position?.y ?? 0;
      if (ay !== by) return ay - by;
      const ax = aTarget?.position?.x ?? 0;
      const bx = bTarget?.position?.x ?? 0;
      return ax - bx;
    });
  };

  // Default path: any handle that is NOT a button-specific handle
  const isDefaultHandle = (handle: string | undefined | null) => {
    if (!handle) return true;
    if (handle === "default") return true;
    // Handles from the visual editor (source-right, source-bottom, etc.)
    if (handle.startsWith("source-") || handle.startsWith("target-")) {
      return true;
    }
    // Legacy handles padrão — NÃO incluir a/b, que são ramos de condição
    if (["right", "bottom", "left", "top"].includes(handle)) {
      return true;
    }
    return false;
  };

  const defaultOutgoing = edges.filter(
    (e) =>
      e.source === nodeId && !isButtonHandle(e.sourceHandle) &&
      isDefaultHandle(e.sourceHandle),
  );

  const outgoing = currentNode?.type === "blocoCondicao"
    ? sortEdgesByFlowPriority(
      edges.filter((e) =>
        e.source === nodeId && ["a", "b", "source-bottom", "bottom", "default", undefined, null].includes(
          e.sourceHandle as string | undefined | null,
        )
      ),
    )
    : sortEdgesByFlowPriority(defaultOutgoing);

  console.log(
    `processFlowNode(${nodeId}): ${outgoing.length} outgoing edges${
      currentNode?.type === "blocoCondicao" ? " (condicao)" : " (default)"
    }`,
  );

  // FIX: For condition blocks, only follow ONE edge (the highest priority) to avoid
  // duplicate sends. The button match upstream already routed to the correct branch;
  // when continuing past a condition block, follow the default/fallback path only.
  const edgesToFollow = currentNode?.type === "blocoCondicao"
    ? (() => {
        // Prefer a "default/bottom" fallback edge; otherwise take the first one.
        const fallback = outgoing.find((e) => {
          const h = String(e.sourceHandle || "").toLowerCase();
          return h === "" || h === "default" || h === "bottom" ||
            h === "source-bottom" || h === "b";
        });
        const chosen = fallback || outgoing[0];
        return chosen ? [chosen] : [];
      })()
    : outgoing;

  for (const edge of edgesToFollow) {
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!targetNode) continue;

    if (targetNode.type === "blocoConteudo" || targetNode.type === "blocoAcao") {
      const isActionDelay = targetNode.type === "blocoAcao" && targetNode.data.actionType === "delay";
      
      if (isActionDelay) {
        const seconds = Number(targetNode.data.delaySeconds ?? targetNode.data.actionConfig ?? 0) || 0;
        if (seconds > 0) {
          const safeSeconds = Math.min(seconds, 50);
          console.log(`[webhook-zapi] Aplicando delay de ${safeSeconds}s para o nó ${targetNode.id}`);
          await new Promise((resolve) => setTimeout(resolve, safeSeconds * 1000));
        }
      }

      if (targetNode.type === "blocoConteudo") {
        const shouldStop = await sendNodeContent(
          targetNode,
          nodes,
          edges,
          phone,
          zapiConfig,
          visited,
          supabase,
          userId,
          flowName,
          options,
        );
        if (shouldStop) continue;
      }
    }

    await processFlowNode(
      targetNode.id,
      nodes,
      edges,
      phone,
      zapiConfig,
      supabase,
      visited,
      userId,
      flowName,
      options,
    );
  }
}

async function acquireMessageProcessingLock(
  supabase: any,
  params: {
    userId: string;
    phone: string;
    normalizedMessage: string;
    rawMessage: string;
    instanceId?: string;
    messageId?: string;
    senderName?: string;
    senderPhone?: string;
  },
): Promise<{ acquired: boolean; lockId: string }> {
  const {
    userId,
    phone,
    normalizedMessage,
    rawMessage,
    instanceId,
    messageId,
    senderName,
    senderPhone,
  } = params;
  const norm = normalizedMessage || normalizeForMatch(rawMessage);
  const now = Date.now();
  const bucketSize = 15000;
  const currentBucket = Math.floor(now / bucketSize);
  const prevBucket = currentBucket - 1;
  const dedupeSubject = String(messageId || "").trim()
    ? `mid:${String(messageId || "").trim()}`
    : `txt:${norm}`;

  // Check both current and previous bucket to avoid boundary race conditions
  const currentKey = `${userId}|${phone}|${dedupeSubject}|${currentBucket}`;
  const prevKey = `${userId}|${phone}|${dedupeSubject}|${prevBucket}`;
  const lockId = await stableUuidFromText(currentKey);
  const prevLockId = await stableUuidFromText(prevKey);

  // First check if previous bucket lock exists (means message was just processed)
  const { data: prevLock } = await supabase
    .from("message_logs")
    .select("id")
    .eq("id", prevLockId)
    .maybeSingle();

  if (prevLock) {
    console.log("Lock do bucket anterior encontrado, mensagem duplicada");
    return { acquired: false, lockId };
  }

  // Try to acquire current bucket lock
  const { error } = await supabase
    .from("message_logs")
    .insert({
      id: lockId,
      phone,
      message_received: rawMessage,
      keyword_matched: "__processing__",
      response_sent: "__processing__",
      timestamp: new Date().toISOString(),
      user_id: userId,
      instance_id: instanceId || null,
      sender_name: senderName || null,
      sender_phone: senderPhone || null,
    });

  if (!error) return { acquired: true, lockId };

  const isDuplicate = error?.code === "23505" ||
    (typeof error?.message === "string" &&
      error.message.toLowerCase().includes("duplicate key"));

  if (isDuplicate) return { acquired: false, lockId };

  throw new Error(`Erro ao adquirir lock de dedupe: ${error.message}`);
}

async function finalizeMessageLog(
  supabase: any,
  lockId: string,
  params: { keywordMatched: string; responseSent: string },
) {
  const { keywordMatched, responseSent } = params;
  await supabase
    .from("message_logs")
    .update({
      keyword_matched: keywordMatched,
      response_sent: responseSent,
      timestamp: new Date().toISOString(),
    })
    .eq("id", lockId);
}

async function setVisibleIncomingMessage(
  supabase: any,
  lockId: string,
  visibleMessage: string,
) {
  const trimmed = String(visibleMessage || "").trim();
  if (!trimmed) return;

  await supabase
    .from("message_logs")
    .update({
      message_received: trimmed,
      timestamp: new Date().toISOString(),
    })
    .eq("id", lockId);
}


async function stableUuidFromText(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${
    hash.slice(16, 20)
  }-${hash.slice(20, 32)}`;
}

function extractButtonReplyCandidates(webhook: any): string[] {
  const values = new Set<string>();

  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed) values.add(trimmed);
  };

  const scanNestedInteractiveValues = (value: unknown, depth = 0) => {
    if (depth > 5 || value == null) return;

    if (typeof value === "string") {
      push(value);

      const trimmed = value.trim();
      if (
        trimmed &&
        ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]")))
      ) {
        try {
          scanNestedInteractiveValues(JSON.parse(trimmed), depth + 1);
        } catch {
          // ignore malformed JSON strings embedded in webhook payloads
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => scanNestedInteractiveValues(entry, depth + 1));
      return;
    }

    if (typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    const preferredKeys = [
      "title",
      "text",
      "label",
      "description",
      "message",
      "body",
      "conversation",
      "contentText",
      "selectedDisplayText",
      "selectedButtonText",
      "selectedButtonId",
      "selectedId",
      "selectedRowId",
      "buttonId",
      "id",
      "displayText",
      "display_text",
      "buttonParamsJSON",
      "paramsJson",
      "value",
    ];

    for (const key of preferredKeys) {
      if (key in record) scanNestedInteractiveValues(record[key], depth + 1);
    }

    Object.values(record).forEach((entry) => scanNestedInteractiveValues(entry, depth + 1));
  };

  const candidateValues = [
    webhook?.text?.title,
    webhook?.text?.description,
    webhook?.text?.selectedDisplayText,
    webhook?.text?.selectedButtonId,
    webhook?.text?.selectedId,
    webhook?.text?.selectedRowId,
    webhook?.text?.id,
    webhook?.buttonReply?.title,
    webhook?.buttonReply?.text,
    webhook?.buttonReply?.label,
    webhook?.buttonReply?.selectedDisplayText,
    webhook?.buttonReply?.selectedRowId,
    webhook?.buttonReply?.id,
    webhook?.buttonReply?.selectedId,
    webhook?.message?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.message?.buttonResponseMessage?.selectedDisplayText,
    webhook?.message?.buttonResponseMessage?.selectedButtonId,
    webhook?.message?.buttonResponseMessage?.selectedId,
    webhook?.buttonsResponseMessage?.selectedDisplayText,
    webhook?.buttonsResponseMessage?.selectedButtonId,
    webhook?.buttonsResponseMessage?.selectedButtonText,
    webhook?.buttonsResponseMessage?.message,
    webhook?.buttonsResponseMessage?.text,
    webhook?.buttonsResponseMessage?.buttonId,
    webhook?.buttonResponseMessage?.selectedDisplayText,
    webhook?.buttonResponseMessage?.selectedButtonId,
    webhook?.buttonResponseMessage?.selectedId,
    webhook?.buttonResponseMessage?.selectedButtonText,
    webhook?.listResponseMessage?.title,
    webhook?.listResponseMessage?.selectedRowId,
    webhook?.listResponseMessage?.singleSelectReply?.selectedRowId,
    webhook?.listResponseMessage?.singleSelectReply?.title,
    webhook?.listResponseMessage?.singleSelectReply?.selectedRowTitle,
    webhook?.interactiveResponse?.title,
    webhook?.interactiveResponse?.description,
    webhook?.title,
    webhook?.selectedButtonId,
    webhook?.selectedId,
    webhook?.response?.title,
    webhook?.response?.text,
    webhook?.response?.selectedDisplayText,
    webhook?.response?.selectedButtonId,
    webhook?.response?.selectedId,
    webhook?.data?.text?.title,
    webhook?.data?.text?.description,
    webhook?.data?.text?.selectedDisplayText,
    webhook?.data?.text?.selectedButtonId,
    webhook?.data?.text?.selectedId,
    webhook?.data?.text?.selectedRowId,
    webhook?.data?.text?.id,
    webhook?.message?.templateButtonReplyMessage?.selectedDisplayText,
    webhook?.message?.templateButtonReplyMessage?.selectedId,
    webhook?.templateButtonReplyMessage?.selectedDisplayText,
    webhook?.templateButtonReplyMessage?.selectedId,
    webhook?.waitingMessage?.buttonReply?.title,
    webhook?.waitingMessage?.buttonReply?.text,
    webhook?.waitingMessage?.buttonReply?.label,
    webhook?.waitingMessage?.buttonReply?.selectedDisplayText,
    webhook?.data?.buttonReply?.title,
    webhook?.data?.buttonReply?.text,
    webhook?.data?.buttonReply?.label,
    webhook?.data?.buttonReply?.selectedDisplayText,
    webhook?.contextInfo?.quotedMessage?.buttonsMessage?.contentText,
    webhook?.contextInfo?.quotedMessage?.templateMessage?.hydratedTemplate?.hydratedContentText,
    webhook?.message?.contextInfo?.quotedMessage?.buttonsMessage?.contentText,
    webhook?.message?.contextInfo?.quotedMessage?.templateMessage?.hydratedTemplate?.hydratedContentText,
    webhook?.event?.Message?.buttonsResponseMessage?.selectedButtonText,
    webhook?.event?.Message?.buttonsResponseMessage?.selectedButtonId,
    webhook?.event?.Message?.listResponseMessage?.singleSelectReply?.selectedRowId,
    webhook?.event?.Message?.listResponseMessage?.singleSelectReply?.title,
  ];

  const preferredDirectCandidate = pickPreferredInteractiveText(candidateValues);
  if (preferredDirectCandidate) {
    values.add(preferredDirectCandidate);
  }

  candidateValues.forEach(push);

  const paramsJsonCandidates = [
    webhook?.message?.interactiveResponseMessage?.nativeFlowResponseMessage
      ?.paramsJson,
    webhook?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson,
  ];

  for (const paramsJson of paramsJsonCandidates) {
    if (typeof paramsJson !== "string" || !paramsJson.trim()) continue;

    push(paramsJson);

    try {
      const parsed = JSON.parse(paramsJson);
      if (parsed && typeof parsed === "object") {
        [
          parsed.id,
          parsed.selectedId,
          parsed.selectedButtonId,
          parsed.selectedDisplayText,
          parsed.selectedButtonText,
          parsed.title,
          parsed.text,
          parsed.value,
        ].forEach(push);
      }
    } catch {
      // ignore malformed nativeFlow params
    }
  }

  [
    webhook?.rawPayload,
    webhook?.event,
    webhook?.message,
    webhook?.data,
    webhook?.data?.message,
    webhook?.data?.event,
    webhook?.interactiveResponseMessage,
    webhook?.message?.interactiveResponseMessage,
    webhook?.message?.interactiveResponseMessage?.nativeFlowResponseMessage,
    webhook?.buttonsResponseMessage,
    webhook?.buttonResponseMessage,
    webhook?.listResponseMessage,
  ].forEach((entry) => scanNestedInteractiveValues(entry));

  return Array.from(values);
}

function extractQuotedMessageTextCandidates(webhook: any): string[] {
  const values = new Set<string>();

  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed) values.add(trimmed);
  };

  [
    webhook?.contextInfo?.quotedMessage?.conversation,
    webhook?.contextInfo?.quotedMessage?.extendedTextMessage?.text,
    webhook?.contextInfo?.quotedMessage?.buttonsMessage?.contentText,
    webhook?.contextInfo?.quotedMessage?.templateMessage?.hydratedTemplate
      ?.hydratedContentText,
    webhook?.message?.contextInfo?.quotedMessage?.conversation,
    webhook?.message?.contextInfo?.quotedMessage?.extendedTextMessage?.text,
    webhook?.message?.contextInfo?.quotedMessage?.buttonsMessage?.contentText,
    webhook?.message?.contextInfo?.quotedMessage?.templateMessage
      ?.hydratedTemplate?.hydratedContentText,
    webhook?.data?.contextInfo?.quotedMessage?.conversation,
    webhook?.data?.contextInfo?.quotedMessage?.extendedTextMessage?.text,
    webhook?.data?.message?.contextInfo?.quotedMessage?.conversation,
    webhook?.data?.message?.contextInfo?.quotedMessage?.extendedTextMessage?.text,
  ].forEach(push);

  return Array.from(values);
}


function getPendingButtonHandleCandidates(
  pendingState: PendingButtonState | null | undefined,
  rawMessage: string,
): string[] {
  const trimmed = String(rawMessage || "").trim();
  if (!trimmed || !pendingState?.buttons?.length) return [];

  const technicalMatch = trimmed.match(/^\d{10,}:([A-Z0-9]{10,})$/i);
  if (!technicalMatch) return [];

  const suffix = technicalMatch[1].trim();
  const lastByte = suffix.match(/([A-F0-9]{2})$/i);
  if (!lastByte?.[1]) return [];

  const numericIndex = parseInt(lastByte[1], 16);
  if (!Number.isFinite(numericIndex) || numericIndex < 1 || numericIndex > 10) {
    return [];
  }

  const candidates = new Set<string>();
  const button = pendingState.buttons.find((entry) =>
    (entry.menuIndex ?? entry.index + 1) === numericIndex
  );

  if (!button) return [];

  candidates.add(String(numericIndex));
  candidates.add(`button-${button.index}`);
  candidates.add(button.text);
  for (const alias of button.handleAliases || []) {
    candidates.add(alias);
  }

  if (candidates.size > 0) {
    console.log(
      "🧭 UAZAPI technical reply mapped to pending button candidates:",
      Array.from(candidates),
    );
  }

  return Array.from(candidates);
}

function findButtonEdgeMatchInternal(
  flows: any[],
  normalizedMessage: string,
  rawMessage: string,
  webhook?: any,
  options?: {
    nodeId?: string | null;
    pendingState?: PendingButtonState | null;
  },
):
  | { flow: any; targetNodeId: string; buttonText: string; flowName: string }
  | null {
  const stripChoicePrefix = (value: string) =>
    value
      .replace(/^\s*(?:\d+\s*[.)\-:]+\s*|[\-•]\s*)+/u, "")
      .trim();

  const explodeChoiceCandidates = (value: string): string[] => {
    const raw = String(value || "").trim();
    if (!raw) return [];

    const candidates = new Set<string>([raw]);
    const flattened = raw.replace(/\r/g, "\n");
    const lines = flattened
      .split(/\n+/)
      .map((part) => part.trim())
      .filter(Boolean);

    const lastLine = lines.at(-1);
    if (lastLine) candidates.add(lastLine);

    lines.forEach((part) => candidates.add(part));

    flattened
      .split(/[|;,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => candidates.add(part));

    const numberedMatches = Array.from(
      flattened.matchAll(/(?:^|\n)\s*(\d+)\s*[.)\-:]+\s*([^\n]+)/gu),
    );

    const matchesToUse = numberedMatches.length > 1
      ? [numberedMatches[numberedMatches.length - 1]]
      : numberedMatches;

    for (const match of matchesToUse) {
      const numeric = String(match?.[1] || "").trim();
      const label = String(match?.[2] || "").trim();
      if (numeric) candidates.add(numeric);
      if (label) {
        candidates.add(label);
        candidates.add(`${numeric}. ${label}`);
      }
    }

    return Array.from(candidates);
  };

  const extractExplicitButtonHandle = (value: string): string | null => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const match = trimmed.match(/\bbutton[-_ ]?(\d+)\b/i);
    if (!match) return null;
    return `button-${match[1]}`;
  };

  const extractUazapiChoiceIndex = (value: string): number | null => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;

    const directNumberMatch = trimmed.match(/^([1-9]\d?)$/);
    if (directNumberMatch) {
      const parsed = Number.parseInt(directNumberMatch[1], 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const prefixedLabelMatch = trimmed.match(/^([1-9]\d?)\s*[.)\-:]+\s*.+$/u);
    if (prefixedLabelMatch) {
      const parsed = Number.parseInt(prefixedLabelMatch[1], 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };

  const normalizedRaw = normalizeForMatch(rawMessage);
  const pendingHandleCandidates = getPendingButtonHandleCandidates(
    options?.pendingState,
    rawMessage,
  );
  const quotedMessageCandidates = extractQuotedMessageTextCandidates(webhook);

  const baseCandidates = [
    rawMessage,
    normalizedMessage,
    ...extractButtonReplyCandidates(webhook),
    ...quotedMessageCandidates,
    ...pendingHandleCandidates,
  ].filter((value): value is string =>
    typeof value === "string" && value.trim().length > 0
  );

  const replyCandidates = Array.from(
    new Set(
      baseCandidates.flatMap((value) => {
        return explodeChoiceCandidates(value).flatMap((candidate) => {
          const trimmed = candidate.trim();
          const stripped = stripChoicePrefix(trimmed);
          return stripped && stripped !== trimmed ? [trimmed, stripped] : [trimmed];
        });
      }),
    ),
  );

  const normalizedCandidates = new Set(
    replyCandidates
      .map((value) => normalizeForMatch(value))
      .filter(Boolean),
  );

  const explicitHandleCandidates = new Set(
    replyCandidates
      .map((value) => extractExplicitButtonHandle(value))
      .filter((value): value is string => Boolean(value)),
  );

  const derivedIndexCandidates = new Set(
    replyCandidates
      .map((value) => extractUazapiChoiceIndex(value))
      .filter((value): value is number => Number.isFinite(value))
      .map((value) => normalizeForMatch(String(value))),
  );

  console.log("🎛️ Button reply candidates:", replyCandidates);

  for (const flow of flows) {
    const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
    const edges = Array.isArray(flow?.edges) ? flow.edges : [];

    for (const node of nodes) {
      if (node?.type !== "blocoConteudo") continue;
      if (options?.nodeId && node?.id !== options.nodeId) continue;
      const buttons = Array.isArray(node?.data?.buttons)
        ? node.data.buttons
        : [];

      for (let idx = 0; idx < buttons.length; idx++) {
        const btn = buttons[idx];
        if (btn.type !== "flow" && btn.type !== "reply") continue;
        const btnText = (btn.text || "").trim();
        if (!btnText) continue;

        const normalizedBtn = normalizeForMatch(btnText);
        if (!normalizedBtn) continue;

        const exactButtonHandleAliases = getExactButtonHandleAliases(idx, btn);
        const legacyButtonHandleAliases = getLegacyOneBasedButtonHandleAliases(idx);
        const buttonHandleAliases = [
          ...exactButtonHandleAliases,
          ...legacyButtonHandleAliases,
        ];
        const buttonIndexValues = [
          String(idx + 1),
          `btn-${idx + 1}`,
          `btn_${idx + 1}`,
          ...buttonHandleAliases,
        ];
        const normalizedIndexValues = buttonIndexValues
          .map((value) => normalizeForMatch(value))
          .filter(Boolean);

        const idxNormalized = normalizeForMatch(String(idx + 1));
        const didMatch = normalizedRaw === normalizedBtn ||
          normalizedMessage === normalizedBtn ||
          normalizedCandidates.has(normalizedBtn) ||
          exactButtonHandleAliases.some((alias) => explicitHandleCandidates.has(alias)) ||
          derivedIndexCandidates.has(idxNormalized) ||
          normalizedRaw === idxNormalized ||
          normalizedMessage === idxNormalized ||
          normalizedIndexValues.some((value) =>
            normalizedCandidates.has(value)
          );

        if (didMatch) {
          const buttonEdge = edges.find((e: any) =>
            e.source === node.id && exactButtonHandleAliases.includes(String(e.sourceHandle || ""))
          ) || edges.find((e: any) =>
            e.source === node.id && legacyButtonHandleAliases.includes(String(e.sourceHandle || ""))
          );

          if (!buttonEdge) {
            console.log(
              "⛔ Button reply matched text, but no specific button edge exists for this handle",
              {
                flowId: flow?.id,
                nodeId: node?.id,
                buttonText: btnText,
                exactButtonHandleAliases,
                legacyButtonHandleAliases,
              },
            );
            continue;
          }

          return {
            flow,
            targetNodeId: buttonEdge.target,
            buttonText: btnText,
            flowName: flow.name,
          };
        }
      }
    }
  }

  return null;
}

function extractFlowKeywords(flow: any): string[] {
  const keywords = new Set<string>();

  const flowKeyword = (flow?.keyword || "").trim();
  if (flowKeyword) keywords.add(flowKeyword);

  const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
  for (const node of nodes) {
    if (node?.type !== "blocoCondicao") continue;

    const conditionType = (node?.data?.conditionType || "keyword").toString()
      .toLowerCase();
    const condition = (node?.data?.condition || "").trim();

    if ((conditionType === "keyword" || !conditionType) && condition) {
      keywords.add(condition);
    }
  }

  return Array.from(keywords);
}

}


