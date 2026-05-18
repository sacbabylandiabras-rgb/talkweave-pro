import { useState, useEffect, useCallback } from "react";
import { MetricCard } from "./MetricCard";
 import { MessageSquare, Send, CheckCircle2, X, Loader2, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StatsGridProps {
  dateFrom?: Date;
  dateTo?: Date;
}

const startOfDayIso = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
const endOfDayIso = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();

export function StatsGrid({ dateFrom, dateTo }: StatsGridProps = {}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, sent: 0, delivered: 0, failed: 0 });

  const loadStats = useCallback(async () => {
    try {
      const applyRange = <T extends { gte: any; lte: any }>(q: T): T => {
        let r: any = q;
        if (dateFrom) r = r.gte('created_at', startOfDayIso(dateFrom));
        if (dateTo) r = r.lte('created_at', endOfDayIso(dateTo));
        return r as T;
      };
       const [sentRes, deliveredRes, failedRes, totalRes] = await Promise.all([
         applyRange(supabase.from('campaign_sends').select('id', { count: 'exact', head: true }).in('status', ['sent', 'delivered'])),
         applyRange(supabase.from('campaign_sends').select('id', { count: 'exact', head: true }).eq('status', 'delivered')),
         applyRange(supabase.from('campaign_sends').select('id', { count: 'exact', head: true }).eq('status', 'failed')),
         applyRange(supabase.from('campaign_sends').select('id', { count: 'exact', head: true })),
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
  }, [dateFrom, dateTo]);

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_sends' }, () => loadStats())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_sends' }, () => loadStats())
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
       <MetricCard title="Enviadas" value={stats.sent} icon={Check} variant="info" />
       <MetricCard title="Entregues" value={stats.delivered} icon={CheckCheck} variant="success" />
      <MetricCard title="Falhas" value={stats.failed} icon={X} variant="error" />
    </div>
  );
}
