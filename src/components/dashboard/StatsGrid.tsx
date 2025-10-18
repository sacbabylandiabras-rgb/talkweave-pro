import { useState, useEffect } from "react";
import { MetricCard } from "./MetricCard";
import { 
  MessageSquare, 
  Send,
  X,
  PhoneOff,
  UserX,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function StatsGrid() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMessages: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    cancelled: 0,
    invalidNumber: 0,
    notWhatsapp: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: sends } = await supabase
        .from('campaign_sends')
        .select('status');

      if (sends) {
        setStats({
          totalMessages: sends.length,
          sent: sends.filter(s => s.status === 'sent').length,
          delivered: sends.filter(s => s.status === 'delivered').length,
          failed: sends.filter(s => s.status === 'failed').length,
          cancelled: 0, // Não temos este status ainda
          invalidNumber: 0, // Não temos este status ainda
          notWhatsapp: 0, // Não temos este status ainda
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
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

  const statsData = [
    {
      title: "Total de Mensagens",
      value: stats.totalMessages.toString(),
      subtitle: "Processadas",
      icon: MessageSquare,
      variant: "info" as const
    },
    {
      title: "Mensagens Enviadas",
      value: stats.sent.toString(),
      subtitle: "Status: Enviada",
      icon: Send,
      variant: "success" as const
    },
    {
      title: "Mensagens Entregues",
      value: stats.delivered.toString(),
      subtitle: "Status: Entregue",
      icon: CheckCircle2,
      variant: "success" as const
    },
    {
      title: "Falhas no Envio",
      value: stats.failed.toString(),
      subtitle: "Erros gerais",
      icon: X,
      variant: "error" as const
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat, index) => (
        <MetricCard
          key={index}
          title={stat.title}
          value={stat.value}
          subtitle={stat.subtitle}
          icon={stat.icon}
          variant={stat.variant}
        />
      ))}
    </div>
  );
}