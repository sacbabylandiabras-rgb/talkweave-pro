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

export interface Conversation {
  phone: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  messages: MessageLog[];
}

export const useMessageLogs = () => {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>('');

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
      if (error || !data) {
        hasMore = false;
        break;
      }
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

  useEffect(() => {
    setLoading(true);
    fetchMessages();

    const channel = supabase
      .channel(`message-logs-rt-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_logs' },
        (payload) => {
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
        }
      )
      .subscribe();

    channelRef.current = channel;
    pollingRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchMessages]);

  // Group messages by phone into conversations
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
        return {
          phone,
          lastMessage: last.message_received || last.response_sent || '',
          lastTimestamp: last.timestamp,
          unreadCount: 0,
          messages: sorted,
        };
      })
      .sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
  })();

  return { messages, conversations, loading, refetch: fetchMessages };
};
