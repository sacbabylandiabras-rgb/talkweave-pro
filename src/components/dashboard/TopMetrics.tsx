import { useState, useEffect, useCallback } from "react";
import { MetricCard } from "./MetricCard";
import { BarChart3, FileText, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TopMetricsProps {
  dateFrom?: Date;
  dateTo?: Date;
}

const startOfDayIso = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
const endOfDayIso = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();

export function TopMetrics({ dateFrom, dateTo }: TopMetricsProps = {}) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ campaigns: 0, templates: 0, contacts: 0 });

  const loadMetrics = useCallback(async () => {
    try {
      let campaignsQ = supabase.from('campaigns').select('id', { count: 'exact', head: true });
      let sendsQ = supabase.from('campaign_sends').select('phone');
      if (dateFrom) {
        campaignsQ = campaignsQ.gte('created_at', startOfDayIso(dateFrom));
        sendsQ = sendsQ.gte('created_at', startOfDayIso(dateFrom));
      }
      if (dateTo) {
        campaignsQ = campaignsQ.lte('created_at', endOfDayIso(dateTo));
        sendsQ = sendsQ.lte('created_at', endOfDayIso(dateTo));
      }
      const [campaignsRes, templatesRes, contactsRes] = await Promise.all([
        campaignsQ,
        supabase.from('message_templates').select('id', { count: 'exact', head: true }).eq('active', true),
        sendsQ,
      ]);

      // Paginate to get all unique phones if over 1000
      let allPhones: string[] = contactsRes.data?.map(s => s.phone) || [];
      if (contactsRes.data?.length === 1000) {
        let from = 1000;
        const batchSize = 1000;
        let hasMore = true;
        while (hasMore) {
          let pageQ = supabase.from('campaign_sends').select('phone').range(from, from + batchSize - 1);
          if (dateFrom) pageQ = pageQ.gte('created_at', startOfDayIso(dateFrom));
          if (dateTo) pageQ = pageQ.lte('created_at', endOfDayIso(dateTo));
          const { data } = await pageQ;
          if (!data || data.length === 0) { hasMore = false; break; }
          allPhones = [...allPhones, ...data.map(s => s.phone)];
          hasMore = data.length === batchSize;
          from += batchSize;
        }
      }

      setMetrics({
        campaigns: campaignsRes.count || 0,
        templates: templatesRes.count || 0,
        contacts: new Set(allPhones).size,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) loadMetrics();
      else setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadMetrics();
    });

    const channel = supabase
      .channel('top-metrics-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_sends' }, () => {
        loadMetrics();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaigns' }, () => {
        loadMetrics();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'campaigns' }, () => {
        loadMetrics();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [loadMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <MetricCard title="Campanhas" value={metrics.campaigns} subtitle="Criadas" icon={BarChart3} variant="warning" />
      <MetricCard title="Modelos" value={metrics.templates} subtitle="Templates" icon={FileText} variant="info" />
      <MetricCard title="Contatos" value={metrics.contacts} subtitle="Alcançados" icon={Users} variant="success" />
    </div>
  );
}
