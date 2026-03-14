import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
}

export interface UnifiedMessage {
  id: string;
  phone: string;
  type: 'received' | 'sent';
  content: string;
  timestamp: string;
  source: 'message_log' | 'campaign' | 'flow' | 'manual';
  keyword_matched?: string | null;
}

export interface SavedContact {
  phone: string;
  name: string;
  profile_picture_url?: string | null;
}

export interface Conversation {
  phone: string;
  contactName: string | null;
  profilePictureUrl: string | null;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  messages: UnifiedMessage[];
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const savedContactsApi = {
  async getAll(token: string): Promise<SavedContact[]> {
    const res = await fetch(`${supabaseUrl}/rest/v1/saved_contacts?select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return res.json();
  },
  async upsert(token: string, data: { phone: string; name: string; user_id: string; profile_picture_url?: string | null }) {
    await fetch(`${supabaseUrl}/rest/v1/saved_contacts`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey, 'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(data),
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
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first?.link || first?.imgUrl || first?.profilePictureUrl || null;
  }
  return payload?.link || payload?.imgUrl || payload?.profilePictureUrl || payload?.data?.link || payload?.data?.imgUrl || payload?.data?.profilePictureUrl || null;
};

const toMillis = (value: string | null | undefined): number => {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

export const useMessageLogs = (filterInstanceId?: string, filterInstanceName?: string) => {
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const [campaignSends, setCampaignSends] = useState<CampaignSendMessage[]>([]);
  const [savedContacts, setSavedContacts] = useState<Map<string, SavedContact>>(new Map());
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const channelRef2 = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastLogsRef = useRef<string>('');
  const lastSendsRef = useRef<string>('');
  const fetchedPhotosRef = useRef<Set<string>>(new Set());
  const fetchedGroupNamesRef = useRef<boolean>(false);

  const fetchSavedContacts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await savedContactsApi.getAll(token);
      const map = new Map<string, SavedContact>();
      data.forEach((c) => map.set(c.phone, c));
      setSavedContacts(map);
    } catch { /* table might not exist */ }
  }, []);

  const fetchMessageLogs = useCallback(async () => {
    let allData: MessageLog[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('message_logs')
        .select('*')
        .order('timestamp', { ascending: true })
        .range(from, from + batchSize - 1);
      if (error || !data) { hasMore = false; break; }
      allData = [...allData, ...(data as unknown as MessageLog[])];
      hasMore = data.length === batchSize;
      from += batchSize;
    }
    // Filter out processing locks
    allData = allData.filter(m => m.keyword_matched !== '__processing__');
    const dataKey = JSON.stringify(allData.map(d => d.id));
    if (dataKey !== lastLogsRef.current) {
      lastLogsRef.current = dataKey;
      setMessageLogs(allData);
    }
  }, []);

  const fetchCampaignSends = useCallback(async () => {
    let allData: CampaignSendMessage[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('id, phone, message_content, contact_name, status, sent_at, created_at, instance_name')
        .order('created_at', { ascending: true })
        .range(from, from + batchSize - 1);
      if (error || !data) { hasMore = false; break; }
      allData = [...allData, ...data];
      hasMore = data.length === batchSize;
      from += batchSize;
    }
    const dataKey = JSON.stringify(allData.map(d => d.id));
    if (dataKey !== lastSendsRef.current) {
      lastSendsRef.current = dataKey;
      setCampaignSends(allData);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchMessageLogs(), fetchCampaignSends()]);
    setLoading(false);
  }, [fetchMessageLogs, fetchCampaignSends]);

  const saveContact = useCallback(async (phone: string, name: string) => {
    const token = await getToken();
    const userId = await getUserId();
    if (!token || !userId) return;
    await savedContactsApi.upsert(token, { phone, name, user_id: userId });
    await fetchSavedContacts();
  }, [fetchSavedContacts]);

  const fetchProfilePicture = useCallback(async (phone: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-profile-picture', { body: { phone } });
      if (error) return null;
      const url = extractProfilePictureUrl(data?.data ?? data);
      if (url) {
        const token = await getToken();
        const userId = await getUserId();
        if (token && userId) {
          const existing = savedContacts.get(phone);
          await savedContactsApi.upsert(token, { phone, name: existing?.name || '', user_id: userId, profile_picture_url: url });
          await fetchSavedContacts();
        }
      }
      return url;
    } catch { return null; }
  }, [savedContacts, fetchSavedContacts]);

  // Auto-fetch profile pictures for conversations that don't have one
  const autoFetchPhotos = useCallback(async (phones: string[]) => {
    const token = await getToken();
    const userId = await getUserId();
    if (!token || !userId) return;

    // Only fetch for phones we haven't tried yet and that look like real numbers (not @lid)
    const toFetch = phones.filter(p => 
      !fetchedPhotosRef.current.has(p) && 
      !savedContacts.get(p)?.profile_picture_url &&
      !p.includes('@')
    ).slice(0, 5); // Limit to 5 at a time to avoid rate limits

    for (const phone of toFetch) {
      fetchedPhotosRef.current.add(phone);
      try {
        const { data, error } = await supabase.functions.invoke('get-profile-picture', { body: { phone } });
        if (error) continue;
        const url = extractProfilePictureUrl(data?.data ?? data);
        if (url) {
          const existing = savedContacts.get(phone);
          await savedContactsApi.upsert(token, { phone, name: existing?.name || '', user_id: userId, profile_picture_url: url });
        }
        await new Promise(r => setTimeout(r, 500));
      } catch { /* ignore */ }
    }
    if (toFetch.length > 0) {
      await fetchSavedContacts();
    }
  }, [savedContacts, fetchSavedContacts]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
    fetchSavedContacts();

    // Realtime for message_logs
    const ch1 = supabase
      .channel(`msg-logs-rt-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_logs' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as MessageLog;
          if (newMsg.keyword_matched === '__processing__') return;
          setMessageLogs(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as MessageLog;
          if (updated.keyword_matched === '__processing__') return;
          setMessageLogs(prev => prev.map(m => m.id === updated.id ? updated : m));
        } else if (payload.eventType === 'DELETE') {
          setMessageLogs(prev => prev.filter(m => m.id !== (payload.old as any).id));
        }
      })
      .subscribe();
    channelRef.current = ch1;

    // Realtime for campaign_sends
    const ch2 = supabase
      .channel(`camp-sends-rt-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_sends' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCampaignSends(prev => {
            if (prev.some(s => s.id === (payload.new as any).id)) return prev;
            return [...prev, payload.new as CampaignSendMessage];
          });
        } else if (payload.eventType === 'UPDATE') {
          setCampaignSends(prev => prev.map(s => s.id === (payload.new as any).id ? payload.new as CampaignSendMessage : s));
        }
      })
      .subscribe();
    channelRef2.current = ch2;

    pollingRef.current = setInterval(fetchAll, 2000);

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      if (channelRef2.current) { supabase.removeChannel(channelRef2.current); channelRef2.current = null; }
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [fetchAll, fetchSavedContacts]);

  // Fetch group names when we detect group conversations
  useEffect(() => {
    if (loading || messageLogs.length === 0 || fetchedGroupNamesRef.current) return;
    const groupPhones = [...new Set(messageLogs.map(m => m.phone).filter(p => p.includes('-group') || p.includes('@g.us')))];
    if (groupPhones.length === 0) return;
    
    fetchedGroupNamesRef.current = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-whatsapp-groups');
        if (error || !data?.groups) return;
        const map = new Map<string, string>();
        for (const g of data.groups) {
          if (g.id && g.nome) {
            map.set(g.id, g.nome);
            // Also try without @g.us suffix for matching
            const cleanId = g.id.replace('@g.us', '');
            map.set(cleanId + '-group', g.nome);
          }
        }
        setGroupNames(map);
      } catch { /* ignore */ }
    })();
  }, [loading, messageLogs.length]);

  // Auto-fetch profile pictures when conversations are available
  useEffect(() => {
    if (loading || messageLogs.length === 0) return;
    const uniquePhones = [...new Set(messageLogs.map(m => m.phone))];
    autoFetchPhotos(uniquePhones);
  }, [loading, messageLogs.length, autoFetchPhotos]);

  // Build unified messages
  const conversations: Conversation[] = (() => {
    const allMessages: UnifiedMessage[] = [];

    // Filter message_logs by instance if specified
    const filteredLogs = filterInstanceId
      ? messageLogs.filter((log) => !log.instance_id || log.instance_id === filterInstanceId)
      : messageLogs;

    // From message_logs
    filteredLogs.forEach(log => {
      if (log.message_received) {
        allMessages.push({
          id: `log-recv-${log.id}`,
          phone: log.phone,
          type: 'received',
          content: log.message_received,
          // Use created_at for received messages because timestamp may be updated by flow processing.
          timestamp: log.created_at || log.timestamp,
          source: 'message_log',
          keyword_matched: log.keyword_matched,
        });
      }
      if (log.response_sent && log.response_sent !== '__processing__') {
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
          phone: log.phone,
          type: 'sent',
          content: log.response_sent,
          timestamp: log.timestamp || log.created_at,
          source,
          keyword_matched: displayKeyword,
        });
      }
    });

    // From campaign_sends (filter by instance_name if filtering is active)
    const filteredCampaignSends = filterInstanceName
      ? campaignSends.filter(send => send.instance_name === filterInstanceName)
      : filterInstanceId
        ? [] // If filtering by instance but no name match possible, exclude campaigns
        : campaignSends;

    filteredCampaignSends.forEach(send => {
      allMessages.push({
        id: `camp-${send.id}`,
        phone: send.phone,
        type: 'sent',
        content: send.message_content,
        timestamp: send.sent_at || send.created_at,
        source: 'campaign',
      });
    });

    // Group by phone
    const grouped = new Map<string, UnifiedMessage[]>();
    allMessages.forEach(msg => {
      const existing = grouped.get(msg.phone) || [];
      existing.push(msg);
      grouped.set(msg.phone, existing);
    });

    return Array.from(grouped.entries())
      .map(([phone, msgs]) => {
        const sorted = msgs.sort((a, b) => {
          const timeDiff = toMillis(a.timestamp) - toMillis(b.timestamp);
          if (timeDiff !== 0) return timeDiff;
          if (a.type !== b.type) return a.type === 'received' ? -1 : 1;
          return a.id.localeCompare(b.id);
        });
        const last = sorted[sorted.length - 1];
        const saved = savedContacts.get(phone);
        // Get name from campaign_sends if no saved contact
        const campaignName = !saved?.name ? campaignSends.find(s => s.phone === phone && s.contact_name)?.contact_name : null;
        // Get group name if it's a group conversation
        const isGroup = phone.includes('-group') || phone.includes('@g.us');
        const groupName = isGroup ? (groupNames.get(phone) || null) : null;
        return {
          phone,
          contactName: saved?.name || campaignName || groupName || null,
          profilePictureUrl: saved?.profile_picture_url || null,
          lastMessage: last.content,
          lastTimestamp: last.timestamp,
          unreadCount: 0,
          messages: sorted,
        };
      })
      .sort((a, b) => toMillis(b.lastTimestamp) - toMillis(a.lastTimestamp));
  })();

  const sendMessage = useCallback(async (phone: string, message: string, mediaUrl?: string, mediaType?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const body: any = { phone, message };
    if (mediaUrl) body.mediaUrl = mediaUrl;
    if (mediaType) body.mediaType = mediaType;
    const { data, error } = await supabase.functions.invoke('send-message', { body });
    if (error) throw error;
    return data;
  }, []);

  return { conversations, loading, refetch: fetchAll, saveContact, fetchProfilePicture, savedContacts, sendMessage };
};
