import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CampaignSendRecord {
  id: string;
  campaign_id: string;
  phone: string;
  contact_name: string | null;
  message_content: string;
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  created_at: string;
  user_id: string | null;
  instance_name: string | null;
  message_id?: string | null;
}

interface CampaignRecord {
  id: string;
  name: string;
  status: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  schedule_type: string | null;
  target_audience: any;
  template_id: string | null;
  delay_seconds: number | null;
}

const useAuthSessionReady = () => {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (active) {
        setSessionReady(Boolean(session));
      }
    };

    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setSessionReady(Boolean(session));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return sessionReady;
};

/**
 * Hook for campaign_sends with Supabase Realtime.
 * Updates state directly from database change events.
 */
export const useCampaignSendsRealtime = (campaignId: string | null) => {
  const [sends, setSends] = useState<CampaignSendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const lastDataRef = useRef<string>('');
  const sessionReady = useAuthSessionReady();

  const sortSends = (items: CampaignSendRecord[]) => (
    [...items].sort((a, b) => {
      const timeA = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    })
  );

  const fetchSends = useCallback(async () => {
    if (!campaignId || !sessionReady) return;

    let allData: CampaignSendRecord[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true })
        .range(from, from + batchSize - 1) as { data: CampaignSendRecord[] | null; error: any };

      if (error) {
        console.error('[useCampaignSendsRealtime] Error fetching sends:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        hasMore = false;
        break;
      }

      allData = [...allData, ...data];
      if (data.length < batchSize) {
        hasMore = false;
      } else {
        from += batchSize;
      }
    }

    if (allData && allData.length > 0) {
      const sortedData = sortSends(allData);
      // Use a more efficient key calculation that doesn't create massive strings for large campaigns
      const dataKey = `${sortedData.length}:${sortedData[0]?.id || ''}:${sortedData[sortedData.length-1]?.status || ''}`;
      if (dataKey !== lastDataRef.current) {
        lastDataRef.current = dataKey;
        setSends(sortedData);
      }
    }

    setLoading(false);
  }, [campaignId, sessionReady]);

  useEffect(() => {
    if (!campaignId) {
      setSends([]);
      setLoading(false);
      lastDataRef.current = '';
      return;
    }

    if (!sessionReady) {
      setLoading(true);
      return;
    }

    setLoading(true);

    const channel = supabase
      .channel(`sends-${campaignId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_sends', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSends(prev => {
              if (prev.some(s => s.id === (payload.new as CampaignSendRecord).id)) return prev;
              return sortSends([...prev, payload.new as CampaignSendRecord]);
            });
          } else if (payload.eventType === 'UPDATE') {
            setSends(prev => sortSends(prev.map(s => s.id === (payload.new as CampaignSendRecord).id ? payload.new as CampaignSendRecord : s)));
          } else if (payload.eventType === 'DELETE') {
            setSends(prev => prev.filter(s => s.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchSends();
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [campaignId, fetchSends, sessionReady]);

  const isAcceptedSend = (send: CampaignSendRecord) =>
    send.status === 'sent' || send.status === 'delivered' || (send.status === 'pending' && Boolean(send.message_id || send.sent_at));

  const stats = {
    total: sends.length,
    sent: sends.filter(isAcceptedSend).length,
    pending: sends.filter(s => s.status === 'pending' && !Boolean(s.message_id || s.sent_at)).length,
    failed: sends.filter(s => s.status === 'failed').length,
    delivered: sends.filter(s => s.status === 'delivered').length,
  };

  return { sends, stats, loading, refetch: fetchSends };
};

/**
 * Hook for campaigns list with Realtime + polling fallback.
 * Compares data before updating to prevent flickering.
 */
export const useCampaignsRealtime = (statusFilter?: string[]) => {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const lastDataRef = useRef<string>('');
  const filterKey = statusFilter?.join(',') || 'all';
  const sessionReady = useAuthSessionReady();

  const fetchCampaigns = useCallback(async () => {
    if (!sessionReady) return;

    let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (statusFilter && statusFilter.length > 0) {
      query = query.in('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[useCampaignsRealtime] Error fetching campaigns:', error);
      setLoading(false);
      return;
    }

    if (data) {
      const dataKey = JSON.stringify(data.map(d => `${d.id}:${d.status}:${d.updated_at}`));
      if (dataKey !== lastDataRef.current) {
        lastDataRef.current = dataKey;
        setCampaigns(data);
      }
    }

    setLoading(false);
  }, [filterKey, sessionReady]);

  useEffect(() => {
    if (!sessionReady) {
      setLoading(true);
      return;
    }

    setLoading(true);
    fetchCampaigns();

    const channel = supabase
      .channel(`campaigns-rt-${filterKey}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as CampaignRecord;
            setCampaigns(prev => {
              if (statusFilter && !statusFilter.includes(updated.status || '')) {
                return prev.filter(c => c.id !== updated.id);
              }
              const exists = prev.some(c => c.id === updated.id);
              if (exists) {
                return prev.map(c => c.id === updated.id ? updated : c);
              }
              return [updated, ...prev];
            });
          } else if (payload.eventType === 'INSERT') {
            const newC = payload.new as CampaignRecord;
            if (!statusFilter || statusFilter.includes(newC.status || '')) {
              setCampaigns(prev => {
                if (prev.some(c => c.id === newC.id)) return prev;
                return [newC, ...prev];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setCampaigns(prev => prev.filter(c => c.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchCampaigns, filterKey, sessionReady]);

  return { campaigns, loading, refetch: fetchCampaigns };
};

/**
 * Hook for ALL campaign_sends with Realtime + polling fallback.
 */
export const useAllCampaignSendsRealtime = () => {
  const [sends, setSends] = useState<CampaignSendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const lastDataRef = useRef<string>('');
  const sessionReady = useAuthSessionReady();

  const sortSends = (items: CampaignSendRecord[]) => (
    [...items].sort((a, b) => {
      const timeA = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    })
  );

  const fetchSends = useCallback(async () => {
    if (!sessionReady) return;

    // Fetch all sends in batches to avoid the 1000-row default limit
    let allData: CampaignSendRecord[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('*')
        .order('created_at', { ascending: true })
        .range(from, from + batchSize - 1) as { data: CampaignSendRecord[] | null; error: any };

      if (error) {
        console.error('[useAllCampaignSendsRealtime] Error fetching sends:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        hasMore = false;
        break;
      }

      allData = [...allData, ...data];
      if (data.length < batchSize) {
        hasMore = false;
      } else {
        from += batchSize;
      }
    }

    // Always update state - use a hash that includes count + basic markers
    const sortedData = sortSends(allData);
    const dataKey = `${sortedData.length}:${sortedData[0]?.id || ''}:${sortedData[sortedData.length-1]?.status || ''}`;
    if (dataKey !== lastDataRef.current) {
      lastDataRef.current = dataKey;
      setSends(sortedData);
    }

    setLoading(false);
  }, [sessionReady]);

  useEffect(() => {
    if (!sessionReady) {
      setLoading(true);
      return;
    }

    setLoading(true);
    fetchSends();

    const channel = supabase
      .channel(`all-sends-rt-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_sends' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSends(prev => {
              if (prev.some(s => s.id === (payload.new as CampaignSendRecord).id)) return prev;
              return sortSends([...prev, payload.new as CampaignSendRecord]);
            });
          } else if (payload.eventType === 'UPDATE') {
            setSends(prev => sortSends(prev.map(s => s.id === (payload.new as CampaignSendRecord).id ? payload.new as CampaignSendRecord : s)));
          } else if (payload.eventType === 'DELETE') {
            setSends(prev => prev.filter(s => s.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchSends, sessionReady]);

  return { sends, loading, refetch: fetchSends };
};
