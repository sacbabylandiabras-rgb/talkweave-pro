// Pure helpers for resolving the display name of a group conversation.
// Extracted from useMessageLogs so we can unit-test the regression where a
// generic placeholder ("Grupo", numeric id, "Conversa com Grupo") would
// override an already resolved real name after a sync/refresh cycle.

export interface MessageLogLike {
  id: string;
  phone: string;
  message_received: string | null;
  response_sent?: string | null;
  keyword_matched: string | null;
  timestamp: string;
  created_at?: string;
}

export interface SavedContactLike {
  phone: string;
  name: string;
  profile_picture_url?: string | null;
}

export const isGroupPhone = (phone: string): boolean => {
  return phone.includes('-group') || phone.includes('@g.us') || /^12036\d{13,}$/.test(phone);
};

export const isUsableGroupDisplayName = (value: string | null | undefined): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  if (/^\d+$/.test(normalized.replace(/\s+/g, ''))) return false;
  if (/^(grupo|grupo sem nome|conversa com grupo)$/i.test(normalized)) return false;
  // "Conversa com 5511..." is also generic
  if (/^conversa com\s+\+?\d[\d\s()-]*$/i.test(normalized)) return false;
  return true;
};

export const normalizeConversationPhone = (phone: string): string => {
  if (!isGroupPhone(phone)) return phone;
  const numericId = phone.replace(/@g\.us$/i, '').replace(/-group$/i, '').replace(/\D/g, '');
  return numericId ? `${numericId}-group` : phone;
};

export const rememberGroupDisplayName = (
  store: Map<string, string>,
  phone: string,
  name: string | null | undefined,
) => {
  if (!isGroupPhone(phone) || !isUsableGroupDisplayName(name)) return;
  store.set(normalizeConversationPhone(phone), String(name).trim());
};

const toMillis = (value: string | null | undefined): number => {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

export interface ResolveGroupNameInput {
  phone: string;
  logs: MessageLogLike[];
  savedContacts: Map<string, SavedContactLike>;
  groupNames: Map<string, string>;
  stableGroupNames: Map<string, string>;
  campaignContactName?: string | null;
}

/**
 * Resolves the display name for a group conversation following the same
 * priority used in useMessageLogs:
 *   1. Live group name from get-whatsapp-groups (if usable)
 *   2. Saved contact name (if usable)
 *   3. Placeholder log "💬 Conversa com <nome>" from sync-zapi-history (if usable)
 *   4. Campaign contact name (if usable)
 *   5. Stable name remembered from a previous render (lock-in)
 *
 * The function MUST NOT return generic labels like "Grupo", "Grupo sem nome",
 * "Conversa com Grupo", or numeric ids — those are treated as missing names.
 */
export const resolveGroupConversationName = ({
  phone,
  logs,
  savedContacts,
  groupNames,
  stableGroupNames,
  campaignContactName,
}: ResolveGroupNameInput): string | null => {
  if (!isGroupPhone(phone)) {
    return savedContacts.get(phone)?.name?.trim() || null;
  }

  const normalizedPhone = normalizeConversationPhone(phone);
  const liveName = groupNames.get(normalizedPhone) || groupNames.get(phone) || null;
  const savedName = savedContacts.get(normalizedPhone)?.name
    || savedContacts.get(phone)?.name
    || null;

  // Placeholder log written by sync-zapi-history when no real message exists yet.
  // We pick the FIRST log whose extracted name is usable (skip the generic ones).
  const sortedLogs = [...logs].sort((a, b) => {
    const diff = toMillis(b.timestamp || b.created_at) - toMillis(a.timestamp || a.created_at);
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });

  let placeholderName: string | null = null;
  for (const log of sortedLogs) {
    if (log.keyword_matched !== '__history_import__') continue;
    const text = String(log.message_received || '').trim();
    if (!text.startsWith('💬 Conversa com ')) continue;
    const extracted = text.replace(/^💬\s*Conversa com\s*/i, '').trim();
    if (isUsableGroupDisplayName(extracted)) {
      placeholderName = extracted;
      break;
    }
  }

  const usableLive = isUsableGroupDisplayName(liveName) ? liveName!.trim() : null;
  const usableSaved = isUsableGroupDisplayName(savedName) ? savedName!.trim() : null;
  const usableCampaign = isUsableGroupDisplayName(campaignContactName)
    ? String(campaignContactName).trim()
    : null;
  const usableStable = stableGroupNames.get(normalizedPhone)
    || stableGroupNames.get(phone)
    || null;

  const resolved = usableLive
    || usableSaved
    || placeholderName
    || usableCampaign
    || usableStable
    || null;

  if (resolved) {
    rememberGroupDisplayName(stableGroupNames, normalizedPhone, resolved);
  }

  return resolved;
};
