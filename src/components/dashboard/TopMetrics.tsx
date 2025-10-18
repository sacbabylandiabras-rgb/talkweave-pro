import { useState, useEffect } from "react";
import { MetricCard } from "./MetricCard";
import { 
  Smartphone, 
  FileText, 
  BarChart3,
  Users,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function TopMetrics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    campaigns: 0,
    templates: 0,
    contacts: 0,
  });

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      // Buscar total de campanhas
      const { count: campaignsCount } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true });

      // Buscar total de templates
      const { count: templatesCount } = await supabase
        .from('message_templates')
        .select('*', { count: 'exact', head: true });

      // Buscar contatos únicos dos envios
      const { data: sends } = await supabase
        .from('campaign_sends')
        .select('phone');
      
      const uniqueContacts = new Set(sends?.map(s => s.phone) || []).size;

      setMetrics({
        campaigns: campaignsCount || 0,
        templates: templatesCount || 0,
        contacts: uniqueContacts,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <MetricCard
        title="Total de Campanhas"
        value={metrics.campaigns.toString()}
        subtitle="Criadas"
        icon={BarChart3}
        variant="warning"
      />
      <MetricCard
        title="Modelos"
        value={metrics.templates.toString()}
        subtitle="Templates cadastrados"
        icon={FileText}
        variant="info"
      />
      <MetricCard
        title="Contatos Únicos"
        value={metrics.contacts.toString()}
        subtitle="Alcançados"
        icon={Users}
        variant="success"
      />
    </div>
  );
}