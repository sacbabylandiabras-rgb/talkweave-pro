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

export const useMessageLogs = () => {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [savedContacts, setSavedContacts] = useState<Map<string, SavedContact>>(new Map());
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>('');

  const fetchSavedContacts = useCallback(async () => {
    const { data } = await supabase
      .from('saved_contacts')
      .select('*');
    if (data) {
      const map = new Map<string, SavedContact>();
      data.forEach((c: any) => map.set(c.phone, { phone: c.phone, name: c.name, profile_picture_url: c.profile_picture_url }));
      setSavedContacts(map);
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
    const existing = savedContacts.get(phone);
    if (existing) {
      await supabase.from('saved_contacts').update({ name }).eq('phone', phone);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('saved_contacts').insert({ phone, name, user_id: user.id });
    }
    await fetchSavedContacts();
  }, [savedContacts, fetchSavedContacts]);

  const fetchProfilePicture = useCallback(async (phone: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-profile-picture', {
        body: { phone }
      });
      if (error) return null;
      const url = data?.data?.link || data?.data?.imgUrl || data?.data?.profilePictureUrl || null;
      if (url) {
        // Save to contact
        const existing = savedContacts.get(phone);
        if (existing) {
          await supabase.from('saved_contacts').update({ profile_picture_url: url }).eq('phone', phone);
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('saved_contacts').upsert({ phone, name: '', profile_picture_url: url, user_id: user.id }, { onConflict: 'phone,user_id' });
          }
        }
        await fetchSavedContacts();
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
