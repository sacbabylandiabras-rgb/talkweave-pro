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
  messages: MessageLog[];
}

// Use raw fetch to interact with saved_contacts table (not in generated types)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const savedContactsApi = {
  async getAll(token: string): Promise<SavedContact[]> {
    const res = await fetch(`${supabaseUrl}/rest/v1/saved_contacts?select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) return [];
    return res.json();
  },
  async upsert(token: string, data: { phone: string; name: string; user_id: string; profile_picture_url?: string | null }) {
    await fetch(`${supabaseUrl}/rest/v1/saved_contacts`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(data),
    });
  },
  async update(token: string, phone: string, data: Record<string, any>) {
    await fetch(`${supabaseUrl}/rest/v1/saved_contacts?phone=eq.${encodeURIComponent(phone)}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
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

export const useMessageLogs = () => {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [savedContacts, setSavedContacts] = useState<Map<string, SavedContact>>(new Map());
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>('');

  const fetchSavedContacts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await savedContactsApi.getAll(token);
      const map = new Map<string, SavedContact>();
      data.forEach((c) => map.set(c.phone, c));
      setSavedContacts(map);
    } catch {
      // Table might not exist yet
    }
  }, []);

  const fetchMessages = useCallback(async () => {
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
      allData = [...allData, ...data];
      hasMore = data.length === batchSize;
      from += batchSize;
    }

    const dataKey = JSON.stringify(allData.map(d => d.id));
    if (dataKey !== lastDataRef.current) {
      lastDataRef.current = dataKey;
      setMessages(allData);
    }
    setLoading(false);
  }, []);

  const saveContact = useCallback(async (phone: string, name: string) => {
    const token = await getToken();
    const userId = await getUserId();
    if (!token || !userId) return;
    await savedContactsApi.upsert(token, { phone, name, user_id: userId });
    await fetchSavedContacts();
  }, [fetchSavedContacts]);

  const fetchProfilePicture = useCallback(async (phone: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-profile-picture', {
        body: { phone }
      });
      if (error) return null;
      const url = data?.data?.link || data?.data?.imgUrl || data?.data?.profilePictureUrl || null;
      if (url) {
        const token = await getToken();
        const userId = await getUserId();
        if (token && userId) {
          const existing = savedContacts.get(phone);
          await savedContactsApi.upsert(token, {
            phone,
            name: existing?.name || '',
            user_id: userId,
            profile_picture_url: url,
          });
          await fetchSavedContacts();
        }
      }
      return url;
    } catch {
      return null;
    }
  }, [savedContacts, fetchSavedContacts]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
    fetchSavedContacts();

    const channel = supabase
      .channel(`message-logs-rt-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_logs' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => {
            if (prev.some(m => m.id === (payload.new as MessageLog).id)) return prev;
            return [...prev, payload.new as MessageLog];
          });
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === (payload.new as MessageLog).id ? payload.new as MessageLog : m));
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    channelRef.current = channel;
    pollingRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [fetchMessages, fetchSavedContacts]);

  const conversations: Conversation[] = (() => {
    const grouped = new Map<string, MessageLog[]>();
    messages.forEach(msg => {
      const existing = grouped.get(msg.phone) || [];
      existing.push(msg);
      grouped.set(msg.phone, existing);
    });

    return Array.from(grouped.entries())
      .map(([phone, msgs]) => {
        const sorted = msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const last = sorted[sorted.length - 1];
        const saved = savedContacts.get(phone);
        return {
          phone,
          contactName: saved?.name || null,
          profilePictureUrl: saved?.profile_picture_url || null,
          lastMessage: last.message_received || last.response_sent || '',
          lastTimestamp: last.timestamp,
          unreadCount: 0,
          messages: sorted,
        };
      })
      .sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
  })();

  return { messages, conversations, loading, refetch: fetchMessages, saveContact, fetchProfilePicture, savedContacts };
};
