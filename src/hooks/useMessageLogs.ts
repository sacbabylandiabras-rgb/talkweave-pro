import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  isGroupPhone,
  isUsableGroupDisplayName,
  normalizeConversationPhone,
  rememberGroupDisplayName,
  resolveGroupConversationName,
} from '@/lib/group-name-resolution';

export interface MessageLog {
  id: string;
  phone: string;
  message_received: string | null;
  response_sent: string | null;
  keyword_matched: string | null;
  timestamp: string;
  created_at: string;
  user_id: string | null;
  instance_id: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
}

export interface CampaignSendMessage {
  id: string;
  phone: string;
  message_content: string;
  contact_name: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string;
  instance_name: string | null;
  campaign_id?: string | null;
}

export interface UnifiedMessage {
  id: string;
  phone: string;
  type: 'received' | 'sent';
  content: string;
  timestamp: string;
  source: 'message_log' | 'campaign' | 'flow' | 'manual';
  keyword_matched?: string | null;
  campaign_id?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
}

export interface SavedContact {
  phone: string;
  name: string;
  profile_picture_url?: string | null;
  updated_at?: string | null;
}

export interface Conversation {
  phone: string;
  contactName: string | null;
  profilePictureUrl: string | null;
  lastPictureSync?: string | null;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  messages: UnifiedMessage[];
  preferredInstanceId?: string | null;
}

type OutboundButtonAction = {
  id: string;
  type: 'CALL' | 'URL' | 'REPLY';
  label: string;
  phone?: string;
  url?: string;
};

type SendMessageOptions = {
  mediaUrl?: string;
  mediaType?: string;
  viewOnce?: boolean;
  isPtv?: boolean;
  preferredInstanceId?: string | null;
  title?: string;
  footer?: string;
  buttonActions?: OutboundButtonAction[];
  carouselCards?: Array<{
    id?: string;
    image?: string;
    title?: string;
    description?: string;
    buttons?: Array<{ id?: string; text?: string; type?: string; value?: string }>;
  }>;
  templateId?: string;
};

const isRealInboundKeyword = (keyword?: string | null) => {
  const value = (keyword || '').trim();
  return !value.startsWith('__');
};

const isConversationBoundInstanceLog = (log: Pick<MessageLog, 'instance_id' | 'message_received' | 'keyword_matched'>) => {
  if (!log.instance_id) return false;
  // Accept manual sends
  if (log.keyword_matched === '__manual_send__') return true;
  // Accept flow sends (they carry the correct instance)
  if (log.keyword_matched?.startsWith('__flow_send__')) return true;
  if (log.keyword_matched?.startsWith('__manual_flow_trigger__')) return true;
  // Accept real inbound messages
  return Boolean(log.message_received) && isRealInboundKeyword(log.keyword_matched);
};

const getInboundMessageTimestamp = (log: Pick<MessageLog, 'keyword_matched' | 'timestamp' | 'created_at'>) => {
  if (log.keyword_matched === '__history_import__') {
    return log.timestamp || log.created_at;
  }

  return log.created_at || log.timestamp;
};

const isCampaignMessageVisible = (send: CampaignSendMessage) => send.status === 'delivered';

const getCampaignSendTimestamp = (send: Pick<CampaignSendMessage, 'sent_at' | 'created_at'>) => send.sent_at || send.created_at;

const isHistoryPlaceholderText = (content?: string | null) => /^💬\s*Conversa com\s+/i.test(String(content || '').trim());

const isHistoryPlaceholderMessage = (message: Pick<UnifiedMessage, 'source' | 'keyword_matched' | 'content'>) => (
  message.source === 'message_log' &&
  message.keyword_matched === '__history_import__' &&
  isHistoryPlaceholderText(message.content)
);

const isInternalFlowStateKeyword = (keyword?: string | null) => {
  const value = String(keyword || '').trim();
  return value.startsWith('__flow_button__:') ||
    value.startsWith('__flow_capture__:') ||
    value.startsWith('__button_claimed__:') ||
    value.startsWith('__flow_capture_resume__:');
};

const extractButtonTextFromKeyword = (keyword?: string | null) => {
  const match = String(keyword || '').match(/^\[Botão:\s*(.+?)\]$/i);
  return match?.[1]?.trim() || '';
};

const isTechnicalMessageReference = (content?: string | null) => /^\d{10,}:[A-Z0-9]{10,}$/i.test(String(content || '').trim());

const normalizeSentMessageForComparison = (content?: string | null) => String(content || '')
  .replace(/\[media:[^\]]+\]\s*/gi, '')
  .replace(/\n\n\[Botões:\s*[\s\S]*$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const isRedundantManualFlowEcho = (
  log: Pick<MessageLog, 'id' | 'phone' | 'response_sent' | 'keyword_matched' | 'timestamp' | 'created_at'>,
  logs: Array<Pick<MessageLog, 'id' | 'phone' | 'response_sent' | 'keyword_matched' | 'timestamp' | 'created_at'>>,
) => {
  if (log.keyword_matched !== '__manual_send__' || !log.response_sent) return false;

  const manualContent = normalizeSentMessageForComparison(log.response_sent);
  if (!manualContent) return false;

  const logTs = toMillis(log.timestamp || log.created_at);

  return logs.some((candidate) => {
    if (candidate.id === log.id) return false;
    if (candidate.phone !== log.phone) return false;
    if (!candidate.keyword_matched?.startsWith('__flow_send__')) return false;
    if (!candidate.response_sent) return false;

    const flowContent = normalizeSentMessageForComparison(candidate.response_sent);
    if (!flowContent) return false;

    const samePayload = flowContent === manualContent || flowContent.startsWith(`${manualContent} `) || flowContent.startsWith(manualContent);
    if (!samePayload) return false;

    const candidateTs = toMillis(candidate.timestamp || candidate.created_at);
    return Math.abs(candidateTs - logTs) <= 15 * 1000;
  });
};

const SENDER_PREFIX_REGEX = /^\[sender:([^|\]]*)\|([^\]]*)\]\s*/;

const parseSenderFromContent = (raw: string): { name: string | null; phone: string | null; rest: string } => {
  const match = raw.match(SENDER_PREFIX_REGEX);
  if (!match) return { name: null, phone: null, rest: raw };
  const name = (match[1] || '').trim() || null;
  const phone = (match[2] || '').trim() || null;
  return { name, phone, rest: raw.replace(SENDER_PREFIX_REGEX, '') };
};

const resolveVisibleInboundContent = (log: Pick<MessageLog, 'message_received' | 'keyword_matched'>) => {
  const buttonText = extractButtonTextFromKeyword(log.keyword_matched);
  if (buttonText) return buttonText;
  const rawContent = parseSenderFromContent(String(log.message_received || '')).rest.trim();
  if (isTechnicalMessageReference(rawContent)) return '';
  return rawContent;
};

const isGroupMembershipLog = (log: Pick<MessageLog, 'message_received' | 'keyword_matched'>) => {
  return (log.keyword_matched === '__group_join__' || log.keyword_matched === '__group_leave__') && isGroupPhone(String(log.message_received || ''));
};

const resolveGroupMembershipContent = (log: Pick<MessageLog, 'phone' | 'response_sent' | 'keyword_matched'>) => {
  const joinedName = String(log.response_sent || '').trim();
  const joinedPhone = String(log.phone || '').replace(/\D/g, '');
  const action = log.keyword_matched === '__group_leave__' ? 'saiu da comunidade' : 'entrou na comunidade';
  return `${joinedName || (joinedPhone ? `+${joinedPhone}` : 'Membro')} ${action}`;
};

const getLatestSuccessfulCampaignSends = (sends: CampaignSendMessage[]) => {
  const latestByPhone = new Map<string, CampaignSendMessage>();

  sends
    .filter(isCampaignMessageVisible)
    .forEach((send) => {
      const current = latestByPhone.get(send.phone);

      if (!current || new Date(getCampaignSendTimestamp(send)).getTime() >= new Date(getCampaignSendTimestamp(current)).getTime()) {
        latestByPhone.set(send.phone, send);
      }
    });

  return Array.from(latestByPhone.values());
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const savedContactsApi = {
  async getAll(token: string): Promise<SavedContact[]> {
    const allContacts: SavedContact[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore && allContacts.length < 5000) {
      const res = await fetch(`${supabaseUrl}/rest/v1/saved_contacts?select=*&order=phone.asc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`,
          'Range-Unit': 'items',
          'Range': `${from}-${from + pageSize - 1}`,
        },
      });

      if (!res.ok) break;

      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;

      allContacts.push(...batch);
      hasMore = batch.length === pageSize;
      from += pageSize;
    }

    return allContacts;
  },
   async upsert(token: string, data: { phone: string; name: string; user_id: string; profile_picture_url?: string | null }) {
     const payload = { ...data };
    await fetch(`${supabaseUrl}/rest/v1/saved_contacts`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
    });
  },
};

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

const extractProfilePictureUrl = (payload: any): string | null => {
  if (!payload) return null;
  if (typeof payload === 'string') {
    const str = payload.trim();
    if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || !/^https?:\/\//i.test(str)) return null;
    return str;
  }
  if (Array.isArray(payload)) return extractProfilePictureUrl(payload[0]);
  const rawUrl = payload?.link || payload?.imgUrl || payload?.profilePictureUrl || payload?.imageUrl || payload?.data?.link || payload?.data?.imageUrl;
  return extractProfilePictureUrl(rawUrl);
};

const extractResolvedGroupName = (payload: any): string | null => {
  if (!payload) return null;
  if (typeof payload?.name === 'string' && isUsableGroupDisplayName(payload.name)) return payload.name.trim();
  if (typeof payload?.data?.name === 'string' && isUsableGroupDisplayName(payload.data.name)) return payload.data.name.trim();
  return null;
};

const toMillis = (value: string | null | undefined): number => {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const isLikelyTechnicalIdentifier = (phone: string): boolean => {
  const clean = phone.replace(/\D/g, '');
  return !phone.includes('@') && !phone.includes('-group') && /^\d{14,16}$/.test(clean) && !clean.startsWith('55');
};

const safeMapGet = <K, V>(map: Map<K, V> | null | undefined, key: K): V | undefined => {
  if (!map || typeof map.get !== 'function') return undefined;
  return map.get(key);
};

export const useMessageLogs = (
  filterInstanceId?: string,
  filterInstanceName?: string,
  knownInstanceIds?: string[],
  knownInstanceNames?: string[],
) => {
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [campaignSends, setCampaignSends] = useState<CampaignSendMessage[]>([]);
  const [savedContacts, setSavedContacts] = useState<Map<string, SavedContact>>(new Map());
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map());
  const [groupPhotos, setGroupPhotos] = useState<Map<string, string>>(new Map());
  const [localManualPhotos, setLocalManualPhotos] = useState<Map<string, string>>(new Map());
  const [groupSourceInstances, setGroupSourceInstances] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const channelRef2 = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastLogsRef = useRef<string>('');
  const lastSendsRef = useRef<string>('');
  const fetchedPhotosRef = useRef<Set<string>>(new Set());
  const inFlightPhotosRef = useRef<Set<string>>(new Set());
  const fetchedGroupNamesRef = useRef<string>('');
  const stableGroupNamesRef = useRef<Map<string, string>>(new Map());

  const fetchSavedContacts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await savedContactsApi.getAll(token);
      const map = new Map<string, SavedContact>();
      data.forEach((c) => {
        map.set(c.phone, c);
        if (isGroupPhone(c.phone)) {
          map.set(normalizeConversationPhone(c.phone), c);
        }
        rememberGroupDisplayName(stableGroupNamesRef.current, c.phone, c.name);
      });
      setSavedContacts(map);
    } catch { /* table might not exist */ }
  }, []);

   const syncMetadata = useCallback(async () => {
     try {
       const { data, error } = await supabase.functions.invoke('sync-chat-metadata', {
         body: { instanceId: filterInstanceId }
       });
       if (error) throw error;
       await fetchSavedContacts();
       return data;
     } catch (error) {
       console.error('Error syncing metadata:', error);
       throw error;
     }
   }, [filterInstanceId, fetchSavedContacts]);
 
  const fetchMessageLogs = useCallback(async () => {
    // Limit to last 30 days to avoid loading tens of thousands of records
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceISO = since.toISOString();

    let allData: MessageLog[] = [];
    let from = 0;
    const batchSize = 1000;
    const maxRecords = 3000;
    let hasMore = true;
    while (hasMore && allData.length < maxRecords) {
      const { data, error } = await supabase
        .from('message_logs')
        .select('id, phone, message_received, response_sent, keyword_matched, timestamp, created_at, user_id, instance_id')
        .gte('timestamp', sinceISO)
        .order('timestamp', { ascending: false })
        .range(from, from + batchSize - 1);
      if (error || !data) { hasMore = false; break; }
      allData = [...allData, ...(data as unknown as MessageLog[])];
      hasMore = data.length === batchSize;
      from += batchSize;
    }

    let importedHistoryData: MessageLog[] = [];
    from = 0;
    hasMore = true;
    while (hasMore && importedHistoryData.length < maxRecords) {
      const { data, error } = await supabase
        .from('message_logs')
        .select('id, phone, message_received, response_sent, keyword_matched, timestamp, created_at, user_id, instance_id')
        .eq('keyword_matched', '__history_import__')
        .lt('timestamp', sinceISO)
        .order('timestamp', { ascending: false })
        .range(from, from + batchSize - 1);

      if (error || !data) { hasMore = false; break; }
      importedHistoryData = [...importedHistoryData, ...(data as unknown as MessageLog[])];
      hasMore = data.length === batchSize;
      from += batchSize;
    }

    const mergedLogs = new Map<string, MessageLog>();
    [...allData, ...importedHistoryData].forEach((log) => mergedLogs.set(log.id, log));
    allData = Array.from(mergedLogs.values()).sort((a, b) => {
      const timeDiff = toMillis(a.timestamp || a.created_at) - toMillis(b.timestamp || b.created_at);
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });

    // Filter out processing locks and LID mapping entries
    allData = allData.filter(m => 
      m.keyword_matched !== '__processing__' && 
      m.keyword_matched !== '__lid_map__' &&
      !isInternalFlowStateKeyword(m.keyword_matched)
    );
    const lidEvidence = new Set<string>();
    allData.forEach((row) => {
      if (row.phone.includes('@lid')) lidEvidence.add(row.phone);
      if (row.message_received?.includes('@lid')) lidEvidence.add(row.message_received);
    });
    // Resolve @lid phones to real numbers using LID map
    allData = allData.map(m => {
      let normalizedPhone = m.phone;
      if (isLikelyTechnicalIdentifier(normalizedPhone)) {
        const suspectLid = `${normalizedPhone.replace(/\D/g, '')}@lid`;
        if (lidEvidence.has(suspectLid)) {
          normalizedPhone = suspectLid;
        }
      }
      if (normalizedPhone.includes('@lid')) {
        const resolved = lidMapRef.current.get(normalizedPhone);
        if (resolved) return { ...m, phone: resolved };
        if (normalizedPhone !== m.phone) return { ...m, phone: normalizedPhone };
      }
      return m;
    });
    // Keep messages with unresolved @lid - show them with the LID identifier
    const dataKey = JSON.stringify(
      allData.map((d) => [
        d.id,
        d.timestamp || d.created_at,
        d.message_received || '',
        d.response_sent || '',
        d.instance_id || '',
        d.keyword_matched || '',
      ])
    );
    if (dataKey !== lastLogsRef.current) {
      lastLogsRef.current = dataKey;
      // Merge with current state to preserve realtime-inserted messages
      // that may not yet appear in the polled result (eventual consistency)
      setMessageLogs(prev => {
        const byId = new Map<string, MessageLog>();
        allData.forEach(m => byId.set(m.id, m));
        // Preserve realtime-inserted messages from the last 30 min not yet in
        // polled data, so the chat doesn't flicker back to an old state while
        // replication catches up (Realtime can be 1-2s ahead of read replicas).
        const cutoff = Date.now() - 30 * 60_000;
        prev.forEach(m => {
          if (byId.has(m.id)) return;
          const ts = toMillis(m.timestamp || m.created_at);
          // Keep recent OR keep entries with no usable timestamp (just-inserted realtime rows)
          if (ts === 0 || ts >= cutoff) byId.set(m.id, m);
        });
        const merged = Array.from(byId.values()).sort((a, b) => {
          const timeDiff = toMillis(a.timestamp || a.created_at) - toMillis(b.timestamp || b.created_at);
          if (timeDiff !== 0) return timeDiff;
          return a.id.localeCompare(b.id);
        });
        lastLogsRef.current = JSON.stringify(
          merged.map((d) => [
            d.id,
            d.timestamp || d.created_at,
            d.message_received || '',
            d.response_sent || '',
            d.instance_id || '',
            d.keyword_matched || '',
          ])
        );
        return merged;
      });
    }
  }, []);

  // Build LID → real phone mapping from message_logs
  const lidMapRef = useRef<Map<string, string>>(new Map());

  const fetchLidMap = useCallback(async () => {
    const { data } = await supabase
      .from('message_logs')
      .select('phone, message_received')
      .eq('keyword_matched', '__lid_map__');
    if (data) {
      const map = new Map<string, string>();
      data.forEach((r: any) => {
        if (r.message_received && r.phone) {
          map.set(r.message_received, r.phone); // @lid → real phone
        }
      });
      lidMapRef.current = map;
    }
  }, []);

  const fetchCampaignSends = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceISO = since.toISOString();

    let allData: CampaignSendMessage[] = [];
    let from = 0;
    const batchSize = 1000;
    const maxRecords = 3000;
    let hasMore = true;
    while (hasMore && allData.length < maxRecords) {
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('id, phone, message_content, contact_name, status, sent_at, created_at, instance_name, campaign_id')
        .eq('status', 'delivered')
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false })
        .range(from, from + batchSize - 1);
      if (error || !data) { hasMore = false; break; }
      allData = [...allData, ...data];
      hasMore = data.length === batchSize;
      from += batchSize;
    }
    // Resolve @lid phones to real numbers
    allData = allData.map(send => {
      if (send.phone.includes('@lid')) {
        const resolved = lidMapRef.current.get(send.phone);
        if (resolved) return { ...send, phone: resolved };
      }
      return send;
    });
    const dataKey = JSON.stringify(
      allData.map((d) => [
        d.id,
        d.sent_at || d.created_at,
        d.status || '',
        d.instance_name || '',
        d.message_content || '',
      ])
    );
    if (dataKey !== lastSendsRef.current) {
      lastSendsRef.current = dataKey;
      // Merge with current state to preserve realtime-inserted sends that may
      // not yet appear in the polled result (eventual consistency / replication lag).
      setCampaignSends(prev => {
        const byId = new Map<string, CampaignSendMessage>();
        allData.forEach(s => byId.set(s.id, s));
        const cutoff = Date.now() - 60_000;
        prev.forEach(s => {
          if (byId.has(s.id)) return;
          const ts = new Date(getCampaignSendTimestamp(s)).getTime();
          if (Number.isFinite(ts) && ts >= cutoff) byId.set(s.id, s);
        });
        const merged = Array.from(byId.values());
        lastSendsRef.current = JSON.stringify(
          merged.map((d) => [
            d.id,
            d.sent_at || d.created_at,
            d.status || '',
            d.instance_name || '',
            d.message_content || '',
          ])
        );
        return merged;
      });
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await fetchLidMap();
    await Promise.all([fetchMessageLogs(), fetchCampaignSends(), fetchSavedContacts()]);
    setLoading(false);
  }, [fetchLidMap, fetchMessageLogs, fetchCampaignSends, fetchSavedContacts]);

  const saveContact = useCallback(async (phone: string, name: string) => {
    const token = await getToken();
    const userId = await getUserId();
    if (!token || !userId) return;
    await savedContactsApi.upsert(token, { phone, name, user_id: userId });
    await fetchSavedContacts();
  }, [fetchSavedContacts]);

   const fetchProfilePicture = useCallback(async (phone: string, force = false, instanceId?: string | null): Promise<string | null> => {
    try {
      if (!force && fetchedPhotosRef.current.has(phone)) {
        return localManualPhotos.get(phone) || null;
      }
      fetchedPhotosRef.current.add(phone);

      const body: Record<string, unknown> = { phone };
      if (instanceId) body.instanceId = instanceId;
      else if (filterInstanceId && filterInstanceId !== 'all') body.instanceId = filterInstanceId;

      const { data: rawData, error } = await supabase.functions.invoke('get-profile-picture', { body });
      if (error) return null;
      
      const responsePayload = rawData?.data ?? rawData;
      const resolvedName = isGroupPhone(phone) ? extractResolvedGroupName(responsePayload) : null;
      const finalUrl = extractProfilePictureUrl(responsePayload);

      setLocalManualPhotos(prev => {
        const next = new Map(prev);
        if (finalUrl) {
          next.set(phone, finalUrl);
        } else {
          next.delete(phone);
        }
        return next;
      });

      if (finalUrl || resolvedName || (!finalUrl && !isGroupPhone(phone))) {
        const token = await getToken();
        const userId = await getUserId();
        if (token && userId) {
          const existing = safeMapGet(savedContacts, phone);
          await savedContactsApi.upsert(token, {
            phone,
            name: resolvedName || existing?.name || '',
            user_id: userId,
            profile_picture_url: finalUrl || (isGroupPhone(phone) ? (existing?.profile_picture_url || null) : null),
          });
          await fetchSavedContacts();
        }
      }
      return finalUrl;
    } catch { return null; }
  }, [savedContacts, fetchSavedContacts, filterInstanceId]);

  const autoFetchPhotos = useCallback(async (phones: string[]) => {
    const token = await getToken();
    const userId = await getUserId();
    if (!token || !userId) return;

    const now = new Date();
    const toFetch = phones.filter(p => {
      if (fetchedPhotosRef.current.has(p) || inFlightPhotosRef.current.has(p)) return false;
      if (p.includes('@lid') || isLikelyTechnicalIdentifier(p)) return false;

      const saved = safeMapGet(savedContacts, p) || safeMapGet(savedContacts, normalizeConversationPhone(p));
      if (!saved?.profile_picture_url || saved.profile_picture_url.includes('undefined')) return true;

      if (saved.updated_at) {
        const lastUpdate = new Date(saved.updated_at);
        const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate > 24;
      }
      return false;
    }).slice(0, 20); // Smaller chunks for responsiveness

    if (toFetch.length === 0) return;

    toFetch.forEach(p => inFlightPhotosRef.current.add(p));

    // Process in small parallel chunks to speed up without overloading
    const CHUNK_SIZE = 3;
    for (let i = 0; i < toFetch.length; i += CHUNK_SIZE) {
      const chunk = toFetch.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (phone) => {
        try {
          const body: Record<string, unknown> = { phone };
          if (filterInstanceId && filterInstanceId !== 'all') body.instanceId = filterInstanceId;
          const { data, error } = await supabase.functions.invoke('get-profile-picture', { body });
          if (!error) {
            const payload = data?.data ?? data;
            const url = extractProfilePictureUrl(payload);
            if (url) {
              const existing = safeMapGet(savedContacts, phone);
              await savedContactsApi.upsert(token, { 
                phone, 
                name: existing?.name || '', 
                user_id: userId, 
                profile_picture_url: url 
              });
            }
          }
          fetchedPhotosRef.current.add(phone);
        } catch { /* ignore */ } finally {
          inFlightPhotosRef.current.delete(phone);
        }
      }));
    }

    await fetchSavedContacts();
  }, [savedContacts, fetchSavedContacts, filterInstanceId]);

  const autoResolveGroupMetadata = useCallback(async (conversationsToCheck: Conversation[]) => {
    const token = await getToken();
    const userId = await getUserId();
    if (!token || !userId) return;

    const unresolvedGroups = conversationsToCheck.filter((conversation) => {
      if (!isGroupPhone(conversation.phone)) return false;
      if (conversation.contactName && conversation.contactName !== 'Grupo') return false;
      const saved = safeMapGet(savedContacts, conversation.phone) || safeMapGet(savedContacts, normalizeConversationPhone(conversation.phone));
      return !saved || !isUsableGroupDisplayName(saved.name) || !saved.profile_picture_url;
    }).slice(0, 4);

    for (const conversation of unresolvedGroups) {
      const phone = conversation.phone;
      if (fetchedPhotosRef.current.has(`group-meta:${phone}`)) continue;
      fetchedPhotosRef.current.add(`group-meta:${phone}`);

      try {
        const { data, error } = await supabase.functions.invoke('get-profile-picture', {
          body: { phone, instanceId: conversation.preferredInstanceId || filterInstanceId || null },
        });
        if (error) continue;

        const responsePayload = data?.data ?? data;
        const url = extractProfilePictureUrl(responsePayload);
        const resolvedName = extractResolvedGroupName(responsePayload);
        if (!url && !resolvedName) continue;

        const existing = safeMapGet(savedContacts, phone) || safeMapGet(savedContacts, normalizeConversationPhone(phone));
        await savedContactsApi.upsert(token, {
          phone,
          name: resolvedName || existing?.name || '',
          user_id: userId,
          profile_picture_url: url || existing?.profile_picture_url || null,
        });
      } catch {
        // ignore
      }
    }

    if (unresolvedGroups.length > 0) {
      await fetchSavedContacts();
    }
  }, [filterInstanceId, savedContacts, fetchSavedContacts]);

   useEffect(() => {
     setLoading(true);
     fetchAll().then(() => {
       console.log('[Realtime] Initial fetch complete, setting up subscriptions...');
       
       // Realtime for message_logs
       const ch1 = supabase
         .channel(`msg-logs-rt-${Date.now()}`)
         .on('postgres_changes', { event: '*', schema: 'public', table: 'message_logs' }, (payload) => {
           console.log('[Realtime] message_logs event:', payload.eventType, (payload.new as any)?.id);
           if (payload.eventType === 'INSERT') {
             const newMsg = payload.new as MessageLog;
             if (newMsg.keyword_matched === '__processing__' || newMsg.keyword_matched === '__lid_map__' || isInternalFlowStateKeyword(newMsg.keyword_matched)) return;
             setMessageLogs(prev => {
               if (prev.some(m => m.id === newMsg.id)) return prev;
               const next = [...prev, newMsg].sort((a, b) => {
                 const timeDiff = toMillis(a.timestamp || a.created_at) - toMillis(b.timestamp || b.created_at);
                 return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id);
               });
               return next;
             });
           } else if (payload.eventType === 'UPDATE') {
             const updated = payload.new as MessageLog;
             if (updated.keyword_matched === '__processing__' || updated.keyword_matched === '__lid_map__' || isInternalFlowStateKeyword(updated.keyword_matched)) return;
             setMessageLogs(prev => {
               const exists = prev.some(m => m.id === updated.id);
               if (exists) return prev.map(m => m.id === updated.id ? updated : m);
               const next = [...prev, updated].sort((a, b) => {
                 const timeDiff = toMillis(a.timestamp || a.created_at) - toMillis(b.timestamp || b.created_at);
                 return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id);
               });
               return next;
             });
           } else if (payload.eventType === 'DELETE') {
             setMessageLogs(prev => prev.filter(m => m.id !== (payload.old as any).id));
           }
         })
         .subscribe((status) => {
           console.log('[Realtime] message_logs channel status:', status);
         });
       channelRef.current = ch1;
 
       // Realtime for campaign_sends
       const ch2 = supabase
         .channel(`camp-sends-rt-${Date.now()}`)
         .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_sends' }, (payload) => {
           console.log('[Realtime] campaign_sends event:', payload.eventType);
           const record = payload.new as CampaignSendMessage;
           const isVisible = record?.status === 'delivered';
           if (payload.eventType === 'INSERT') {
             if (!isVisible) return;
             setCampaignSends(prev => {
               if (prev.some(s => s.id === record.id)) return prev;
               return [...prev, record];
             });
           } else if (payload.eventType === 'UPDATE') {
             if (isVisible) {
               setCampaignSends(prev => {
                 const exists = prev.some(s => s.id === record.id);
                 if (exists) return prev.map(s => s.id === record.id ? record : s);
                 return [...prev, record];
               });
             } else {
               setCampaignSends(prev => prev.filter(s => s.id !== record.id));
             }
           }
         })
         .subscribe((status) => {
           console.log('[Realtime] campaign_sends channel status:', status);
         });
       channelRef2.current = ch2;
     });
 
     fetchSavedContacts();
 
     // Polling at 30s as safety net only.
     pollingRef.current = setInterval(fetchAll, 30000);
 
     return () => {
       if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
       if (channelRef2.current) { supabase.removeChannel(channelRef2.current); channelRef2.current = null; }
       if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
     };
   }, [fetchAll, fetchSavedContacts]);

  // Fetch group names when we detect group conversations
  useEffect(() => {
    const groupPhones = [...new Set([
      ...messageLogs.map((m) => normalizeConversationPhone(m.phone)),
      ...campaignSends.map((s) => normalizeConversationPhone(s.phone)),
    ].filter(isGroupPhone))];
    if (groupPhones.length === 0) return;

    const groupKey = groupPhones.sort().join('|');
    if (loading || fetchedGroupNamesRef.current === groupKey) return;
    fetchedGroupNamesRef.current = groupKey;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-whatsapp-groups');
        if (error || !data?.groups) return;
        const map = new Map(groupNames);
        const photoMap = new Map(groupPhotos);
        const instanceMap = new Map<string, string>();
        for (const g of data.groups) {
          if (!g.id) continue;

          const rawId = String(g.id);
          const normalizedId = normalizeConversationPhone(rawId);

          if (isUsableGroupDisplayName(g.nome)) {
            map.set(rawId, g.nome);
            map.set(normalizedId, g.nome);
            rememberGroupDisplayName(stableGroupNamesRef.current, rawId, g.nome);
            rememberGroupDisplayName(stableGroupNamesRef.current, normalizedId, g.nome);
          }

          if (g.foto) {
            photoMap.set(rawId, g.foto);
            photoMap.set(normalizedId, g.foto);
          }

          if (g.sourceInstanceId) {
            instanceMap.set(rawId, g.sourceInstanceId);
            instanceMap.set(normalizedId, g.sourceInstanceId);
          }
        }
        setGroupNames(map);
        setGroupPhotos(photoMap);
        setGroupSourceInstances(instanceMap);
      } catch { /* ignore */ }
    })();
  }, [loading, messageLogs, campaignSends, groupNames, groupPhotos]);

  // Auto-fetch profile pictures when conversations are available
  useEffect(() => {
    if (loading || messageLogs.length === 0) return;
    const timer = setTimeout(() => {
      const uniquePhones = [...new Set(messageLogs.map(m => m.phone))];
      autoFetchPhotos(uniquePhones);
    }, 1000); // Debounce to avoid storming on initial load
    return () => clearTimeout(timer);
  }, [loading, messageLogs.length, autoFetchPhotos]);

  // Build unified messages
  const conversations: Conversation[] = (() => {
    const allMessages: UnifiedMessage[] = [];

    // When a specific instance is selected, filter to that one.
    // Otherwise (all/none), restrict to the user's currently known instances so logs from
    // removed/disconnected instances don't pollute the list.
    const hasKnownInstanceFilter = Array.isArray(knownInstanceIds);
    const knownIdSet = hasKnownInstanceFilter ? new Set(knownInstanceIds) : null;
    const filteredLogs = filterInstanceId
      ? messageLogs.filter(m => m.instance_id === filterInstanceId)
      : hasKnownInstanceFilter
        ? messageLogs.filter(m => !!m.instance_id && knownIdSet!.has(m.instance_id))
        : messageLogs;

    // From message_logs
    filteredLogs.forEach(log => {
      if (isGroupMembershipLog(log)) {
        allMessages.push({
          id: `log-group-membership-${log.id}`,
          phone: normalizeConversationPhone(String(log.message_received || '')),
          type: 'received',
          content: resolveGroupMembershipContent(log),
          timestamp: getInboundMessageTimestamp(log),
          source: 'message_log',
          keyword_matched: log.keyword_matched,
        });
        return;
      }

      const inboundContent = resolveVisibleInboundContent(log);
      if (inboundContent) {
        const isManualTrigger = log.keyword_matched?.startsWith('__manual_flow_trigger__:');
        const parsed = parseSenderFromContent(String(log.message_received || ''));
        let senderName = log.sender_name || parsed.name || null;
        let senderPhone = log.sender_phone || parsed.phone || null;

        if (isManualTrigger) {
          senderName = log.keyword_matched?.replace('__manual_flow_trigger__:', '') || null;
        }

        allMessages.push({
          id: `log-recv-${log.id}`,
          phone: normalizeConversationPhone(log.phone),
          type: 'received',
          content: inboundContent,
          timestamp: getInboundMessageTimestamp(log),
          source: 'message_log',
          keyword_matched: log.keyword_matched,
          sender_name: senderName,
          sender_phone: senderPhone,
        });
      }
      if (log.response_sent && log.response_sent !== '__processing__') {
        if (isInternalFlowStateKeyword(log.keyword_matched)) return;
        if (isTechnicalMessageReference(log.response_sent)) return;
        if (isRedundantManualFlowEcho(log, messageLogs)) return;
        // Legacy compatibility: keep old summary entries when no detailed flow logs exist nearby.
        // New flow engine writes detailed __flow_send__ logs, so summary rows are redundant only then.
        const isSummary = /^\[Fluxo:.*\]$/.test(log.response_sent.trim());
        if (isSummary) {
          const hasDetailedFlowAround = messageLogs.some((candidate) => {
            if (candidate.id === log.id) return false;
            if (candidate.phone !== log.phone) return false;
            if (!candidate.response_sent || candidate.response_sent === '__processing__') return false;
            if (!candidate.keyword_matched?.startsWith('__flow_send__')) return false;

            const candidateTs = candidate.timestamp || candidate.created_at;
            const logTs = log.timestamp || log.created_at;
            const timeDiff = Math.abs(toMillis(candidateTs) - toMillis(logTs));
            return timeDiff <= 3 * 60 * 1000;
          });

          if (hasDetailedFlowAround) return;
        }

        const isManual = log.keyword_matched === '__manual_send__';
        const isFlowSend = log.keyword_matched?.startsWith('__flow_send__');
        const source = isManual ? 'manual' as const : isFlowSend ? 'flow' as const : 'flow' as const;

        // Extract flow name from keyword like "__flow_send__:Novo Fluxo"
        let displayKeyword = log.keyword_matched;
        if (isFlowSend) {
          displayKeyword = log.keyword_matched?.replace('__flow_send__:', '') || null;
        } else if (isManual) {
          displayKeyword = null;
        }

        allMessages.push({
          id: `log-sent-${log.id}`,
          phone: normalizeConversationPhone(log.phone),
          type: 'sent',
          content: log.response_sent,
          timestamp: log.timestamp || log.created_at,
          source,
          keyword_matched: displayKeyword,
        });
      }
    });

    // Filter campaign sends by instance when a filter is active.
    // Otherwise, restrict to known instance names so old campaign data from removed instances is hidden.
    const hasKnownInstanceNameFilter = Array.isArray(knownInstanceNames);
    const knownNameSet = hasKnownInstanceNameFilter ? new Set(knownInstanceNames) : null;
    const filteredCampaignSends = filterInstanceName
      ? campaignSends.filter(s => s.instance_name === filterInstanceName)
      : hasKnownInstanceNameFilter
        ? campaignSends.filter(s => !!s.instance_name && knownNameSet!.has(s.instance_name))
        : campaignSends;

    getLatestSuccessfulCampaignSends(filteredCampaignSends).forEach(send => {
      allMessages.push({
        id: `camp-${send.id}`,
        phone: normalizeConversationPhone(send.phone),
        type: 'sent',
        content: send.message_content,
        timestamp: send.sent_at || send.created_at,
        source: 'campaign',
        campaign_id: send.campaign_id ?? null,
      });
    });

    // Group by phone
    const grouped = new Map<string, UnifiedMessage[]>();
    const groupedLogs = new Map<string, MessageLog[]>();
    allMessages.forEach(msg => {
      const existing = grouped.get(msg.phone) || [];
      existing.push(msg);
      grouped.set(msg.phone, existing);
    });

    filteredLogs.forEach(log => {
      const conversationPhone = normalizeConversationPhone(log.phone);
      const existing = groupedLogs.get(conversationPhone) || [];
      existing.push(log);
      groupedLogs.set(conversationPhone, existing);
    });

    return Array.from(grouped.entries())
      .map(([phone, msgs]) => {
        const sorted = msgs.sort((a, b) => {
          const timeDiff = toMillis(a.timestamp) - toMillis(b.timestamp);
          if (timeDiff !== 0) return timeDiff;
          if (a.type !== b.type) return a.type === 'received' ? -1 : 1;
          return a.id.localeCompare(b.id);
        });
        const visibleMessages = sorted.filter((message) => !isHistoryPlaceholderMessage(message));
        const last = sorted[sorted.length - 1];
        const lastVisibleMessage = visibleMessages[visibleMessages.length - 1] || null;
        const conversationLogs = safeMapGet(groupedLogs, phone) || [];
        const sortedConversationLogs = [...conversationLogs].sort((a, b) => {
          const timeDiff = toMillis(b.timestamp || b.created_at) - toMillis(a.timestamp || a.created_at);
          if (timeDiff !== 0) return timeDiff;
          return b.id.localeCompare(a.id);
        });
        const latestInboundLog = sortedConversationLogs.find(isConversationBoundInstanceLog);
        const normalizedPhone = normalizeConversationPhone(phone);
        const saved = safeMapGet(savedContacts, phone) || safeMapGet(savedContacts, normalizedPhone);
        // Get name from campaign_sends if no saved contact
        const campaignName = !saved?.name
          ? campaignSends.find((s) => normalizeConversationPhone(s.phone) === phone && s.contact_name)?.contact_name
          : null;
        const isGroup = isGroupPhone(phone);
        const preferredInstanceId = filterInstanceId && filterInstanceId !== 'all'
          ? filterInstanceId
          : latestInboundLog?.instance_id || safeMapGet(groupSourceInstances, phone) || safeMapGet(groupSourceInstances, normalizedPhone) || null;
        const resolvedContactName = isGroup
          ? resolveGroupConversationName({
              phone,
              logs: sortedConversationLogs,
              savedContacts,
              groupNames,
              stableGroupNames: stableGroupNamesRef.current,
              campaignContactName: campaignName,
            })
          : (saved?.name || campaignName || null);

        if (isGroup && resolvedContactName) {
          rememberGroupDisplayName(stableGroupNamesRef.current, phone, resolvedContactName);
        }

       let groupOnlyPhoto = isGroup
         ? (safeMapGet(groupPhotos, phone) || safeMapGet(groupPhotos, normalizedPhone))
         : null;
       
       if (groupOnlyPhoto === 'null' || groupOnlyPhoto === 'undefined') groupOnlyPhoto = null;
       
       let savedPhoto = saved?.profile_picture_url || null;
       if (savedPhoto === 'null' || savedPhoto === 'undefined') savedPhoto = null;
       
       const profilePictureUrl = localManualPhotos.get(phone) || savedPhoto || groupOnlyPhoto || null;

        return {
          phone,
          contactName: resolvedContactName,
         profilePictureUrl,
          lastPictureSync: saved?.updated_at || null,
          lastMessage: typeof lastVisibleMessage?.content === 'string' ? lastVisibleMessage.content : '',
          lastTimestamp: last?.timestamp || new Date(0).toISOString(),
          unreadCount: 0,
          messages: visibleMessages,
          preferredInstanceId,
        };
      })
      .sort((a, b) => toMillis(b.lastTimestamp) - toMillis(a.lastTimestamp));
  })();

  const unresolvedGroupKey = conversations
    .filter((c) => isGroupPhone(c.phone) && (!c.contactName || c.contactName === 'Grupo'))
    .map((c) => c.phone)
    .sort()
    .join('|');

  useEffect(() => {
    if (loading || !unresolvedGroupKey) return;
    const targets = unresolvedGroupKey.split('|').filter(Boolean);
    const toResolve = conversations.filter((c) => targets.includes(c.phone));
    if (toResolve.length === 0) return;
    autoResolveGroupMetadata(toResolve);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, unresolvedGroupKey]);

  // Sync de fotos: TODOS os grupos sem foto têm avatar buscado em tempo real,
  // independentemente do nome estar resolvido. Mantém o avatar mesmo após refresh.
  const groupsMissingPhotoKey = conversations
    .filter((c) => isGroupPhone(c.phone) && !c.profilePictureUrl)
    .map((c) => `${c.phone}::${c.preferredInstanceId || ''}`)
    .sort()
    .join('|');

  useEffect(() => {
    if (loading || !groupsMissingPhotoKey) return;
    const entries = groupsMissingPhotoKey.split('|').filter(Boolean).slice(0, 20);
    if (entries.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const entry of entries) {
        if (cancelled) return;
         const [phone, instanceId] = entry.split('::');
         const cacheKey = `group-photo-sync:${phone}`;
         if (fetchedPhotosRef.current.has(cacheKey)) continue;
         fetchedPhotosRef.current.add(cacheKey);
         try {
           await fetchProfilePicture(phone, false, instanceId || null);
         } catch { /* ignore */ }
        await new Promise((r) => setTimeout(r, 200));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, groupsMissingPhotoKey]);

  const sendMessage = useCallback(async (phone: string, message: string, options: SendMessageOptions = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const body: any = { phone, message };
    if (options.mediaUrl) body.mediaUrl = options.mediaUrl;
    if (options.mediaType) body.mediaType = options.mediaType;
    if (options.viewOnce) body.viewOnce = true;
    if (options.isPtv) body.isPtv = true;
    if (options.title) body.title = options.title;
    if (options.footer) body.footer = options.footer;
    if (options.buttonActions?.length) body.buttonActions = options.buttonActions;
    if (options.carouselCards?.length) body.carouselCards = options.carouselCards;
    if (options.templateId) body.templateId = options.templateId;
    if (options.preferredInstanceId) {
      body.instanceId = options.preferredInstanceId;
    } else if (filterInstanceId && filterInstanceId !== 'all') {
      body.instanceId = filterInstanceId;
    }

    const { data, error } = await supabase.functions.invoke('send-message', { body });

    if (error) {
      const response = (error as any)?.context;

      if (response?.json && typeof response.json === 'function') {
        try {
          const errorData = await response.json();
          throw new Error(
            errorData?.message ||
            errorData?.error ||
            errorData?.details?.message ||
            errorData?.details?.error ||
            'Falha ao enviar mensagem'
          );
        } catch {
          // fall through
        }
      }

      if (response instanceof Response) {
        try {
          const errorData = await response.clone().json();
          throw new Error(
            errorData?.message ||
            errorData?.error ||
            errorData?.details?.message ||
            errorData?.details?.error ||
            `Falha ao enviar mensagem (status ${response.status})`
          );
        } catch {
          try {
            const errorText = await response.clone().text();
            throw new Error(errorText || `Falha ao enviar mensagem (status ${response.status})`);
          } catch {
            throw new Error(`Falha ao enviar mensagem (status ${response.status})`);
          }
        }
      }

      throw error;
    }

    // Aguarda o registro real vindo do backend/realtime para evitar falso sucesso visual.
    setTimeout(() => fetchAll(), 1000);

    return data;
  }, [fetchAll, filterInstanceId]);

   const forceUpdateAllPhotos = async () => {
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) return;

     setLoading(true);
     try {
       const uniquePhones = [...new Set(conversations.map(c => c.phone))];
       let updatedCount = 0;

       for (const phone of uniquePhones) {
         try {
           const body: Record<string, unknown> = { phone };
           if (filterInstanceId && filterInstanceId !== 'all') body.instanceId = filterInstanceId;
           
           const { data: rawData, error } = await supabase.functions.invoke('get-profile-picture', { body });
           if (error) continue;

           const responsePayload = rawData?.data ?? rawData;
           const finalUrl = extractProfilePictureUrl(responsePayload);

           if (finalUrl) {
             updatedCount++;
             const userId = session.user.id;
             const existing = safeMapGet(savedContacts, phone);
             await savedContactsApi.upsert(session.access_token, {
               phone,
               name: existing?.name || '',
               user_id: userId,
               profile_picture_url: finalUrl,
             });
           }
           await new Promise(r => setTimeout(r, 100));
         } catch { /* ignore individual errors */ }
       }
       
       await fetchAll();
     } finally {
       setLoading(false);
     }
   };

   return { 
     conversations, 
     loading, 
     refetch: fetchAll, 
     saveContact, 
     fetchProfilePicture, 
     savedContacts, 
     sendMessage, 
     forceUpdateAllPhotos,
     syncMetadata,
     syncHistory: fetchAll
   };
};
