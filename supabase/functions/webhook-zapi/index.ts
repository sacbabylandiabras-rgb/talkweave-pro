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
function findButtonEdgeMatch(
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



