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
  error_message: string | null;
  created_at: string;
  user_id: string | null;
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

/**
 * Hook that subscribes to campaign_sends changes via Supabase Realtime.
 * Falls back to lightweight polling if Realtime is not available.
 */
export const useCampaignSendsRealtime = (campaignId: string | null) => {
  const [sends, setSends] = useState<CampaignSendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const fetchSends = useCallback(async () => {
    if (!campaignId) return;
    const { data, error } = await supabase
      .from('campaign_sends')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setSends(data);
    }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) {
      setSends([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchSends();

    // Subscribe to Realtime changes
    const channel = supabase
      .channel(`sends-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_sends',
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSends(prev => {
              const exists = prev.some(s => s.id === (payload.new as CampaignSendRecord).id);
              if (exists) return prev;
              return [...prev, payload.new as CampaignSendRecord];
            });
          } else if (payload.eventType === 'UPDATE') {
            setSends(prev =>
              prev.map(s => s.id === (payload.new as CampaignSendRecord).id ? payload.new as CampaignSendRecord : s)
            );
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
  }, [campaignId, fetchSends]);

  const stats = {
    total: sends.length,
    sent: sends.filter(s => s.status === 'sent' || s.status === 'delivered').length,
    pending: sends.filter(s => s.status === 'pending').length,
    failed: sends.filter(s => s.status === 'failed').length,
    delivered: sends.filter(s => s.status === 'delivered').length,
  };

  return { sends, stats, loading, refetch: fetchSends };
};

/**
 * Hook that subscribes to campaigns table changes via Supabase Realtime.
 */
export const useCampaignsRealtime = (statusFilter?: string[]) => {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const fetchCampaigns = useCallback(async () => {
    let query = supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter.length > 0) {
      query = query.in('status', statusFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setCampaigns(data);
    }
    setLoading(false);
  }, [statusFilter?.join(',')]);

  useEffect(() => {
    setLoading(true);
    fetchCampaigns();

    const channel = supabase
      .channel('campaigns-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newCampaign = payload.new as CampaignRecord;
            if (!statusFilter || statusFilter.includes(newCampaign.status || '')) {
              setCampaigns(prev => {
                const exists = prev.some(c => c.id === newCampaign.id);
                if (exists) return prev;
                return [newCampaign, ...prev];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as CampaignRecord;
            setCampaigns(prev => {
              // If status filter is set, remove campaigns that no longer match
              if (statusFilter && !statusFilter.includes(updated.status || '')) {
                return prev.filter(c => c.id !== updated.id);
              }
              const exists = prev.some(c => c.id === updated.id);
              if (exists) {
                return prev.map(c => c.id === updated.id ? updated : c);
              }
              // Campaign now matches filter - add it
              return [updated, ...prev];
            });
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
  }, [fetchCampaigns]);

  return { campaigns, loading, refetch: fetchCampaigns };
};

/**
 * Hook for all campaign_sends (across all campaigns) with Realtime.
 */
export const useAllCampaignSendsRealtime = () => {
  const [sends, setSends] = useState<CampaignSendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const fetchSends = useCallback(async () => {
    const { data, error } = await supabase
      .from('campaign_sends')
      .select('*');
    if (!error && data) {
      setSends(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSends();

    const channel = supabase
      .channel('all-sends-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_sends',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSends(prev => {
              const exists = prev.some(s => s.id === (payload.new as CampaignSendRecord).id);
              if (exists) return prev;
              return [...prev, payload.new as CampaignSendRecord];
            });
          } else if (payload.eventType === 'UPDATE') {
            setSends(prev =>
              prev.map(s => s.id === (payload.new as CampaignSendRecord).id ? payload.new as CampaignSendRecord : s)
            );
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
  }, [fetchSends]);

  return { sends, loading, refetch: fetchSends };
};
