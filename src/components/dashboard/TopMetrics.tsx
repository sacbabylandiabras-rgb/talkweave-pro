import { useState, useEffect } from "react";
import { MetricCard } from "./MetricCard";
import { BarChart3, FileText, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function TopMetrics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ campaigns: 0, templates: 0, contacts: 0 });

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const [campaignsRes, templatesRes, sendsRes] = await Promise.all([
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('message_templates').select('*', { count: 'exact', head: true }),
        supabase.from('campaign_sends').select('phone'),
      ]);

      setMetrics({
        campaigns: campaignsRes.count || 0,
        templates: templatesRes.count || 0,
        contacts: new Set(sendsRes.data?.map(s => s.phone) || []).size,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

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
