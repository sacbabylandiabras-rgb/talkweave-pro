import { useState, useEffect, useCallback } from "react";
import { MetricCard } from "./MetricCard";
import { MessageSquare, Send, CheckCircle2, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function StatsGrid() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, sent: 0, delivered: 0, failed: 0 });

  const loadStats = useCallback(async () => {
    try {
      // Use individual count queries to avoid the 1000-row default limit
      const [sentRes, deliveredRes, failedRes, totalRes] = await Promise.all([
        supabase.from('campaign_sends').select('id', { count: 'exact', head: true }).in('status', ['sent', 'delivered']),
        supabase.from('campaign_sends').select('id', { count: 'exact', head: true }).in('status', ['sent', 'delivered']),
        supabase.from('campaign_sends').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('campaign_sends').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        total: totalRes.count ?? 0,
        sent: sentRes.count ?? 0,
        delivered: deliveredRes.count ?? 0,
        failed: failedRes.count ?? 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) loadStats();
      else setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadStats();
    });

    const channel = supabase
      .channel('stats-grid-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_sends' }, (payload) => {
        const status = (payload.new as any)?.status;
        setStats(prev => ({
          total: prev.total + 1,
          sent: (status === 'sent' || status === 'delivered') ? prev.sent + 1 : prev.sent,
          delivered: (status === 'sent' || status === 'delivered') ? prev.delivered + 1 : prev.delivered,
          failed: status === 'failed' ? prev.failed + 1 : prev.failed,
        }));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_sends' }, (payload) => {
        const oldStatus = (payload.old as any)?.status;
        const newStatus = (payload.new as any)?.status;
        if (oldStatus === newStatus) return;
        setStats(prev => ({
          total: prev.total,
          sent: prev.sent + (newStatus === 'sent' ? 1 : 0) - (oldStatus === 'sent' ? 1 : 0),
          delivered: prev.delivered + (newStatus === 'delivered' ? 1 : 0) - (oldStatus === 'delivered' ? 1 : 0),
          failed: prev.failed + (newStatus === 'failed' ? 1 : 0) - (oldStatus === 'failed' ? 1 : 0),
        }));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'campaign_sends' }, () => loadStats())
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <MetricCard title="Total" value={stats.total} icon={MessageSquare} variant="info" />
      <MetricCard title="Enviadas" value={stats.sent} icon={Send} variant="success" />
      <MetricCard title="Entregues" value={stats.delivered} icon={CheckCircle2} variant="success" />
      <MetricCard title="Falhas" value={stats.failed} icon={X} variant="error" />
    </div>
  );
}
