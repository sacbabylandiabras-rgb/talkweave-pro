import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Download, TrendingUp, Calendar, Users, MessageSquare, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReportStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalContacts: number;
  totalMessages: number;
  deliveryRate: number;
}

interface CampaignReport {
  id: string;
  name: string;
  created_at: string;
  status: string;
  sent: number;
  delivered: number;
  failed: number;
  total: number;
  deliveryRate: number;
}

const Relatorio = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReportStats>({
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalContacts: 0,
    totalMessages: 0,
    deliveryRate: 0,
  });
  const [campaignReports, setCampaignReports] = useState<CampaignReport[]>([]);
  const [templateStats, setTemplateStats] = useState<Array<{ name: string; usage: number }>>([]);

  useEffect(() => {
    loadReportData();
    
    // Set up real-time subscription for campaign_sends
    const channel = supabase
      .channel('campaign-sends-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'campaign_sends'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          // Reload data when there's a change
          loadReportData();
        }
      )
      .subscribe();

    // Set up auto-refresh every 3 seconds for active campaigns
    const autoRefreshInterval = setInterval(() => {
      loadReportData();
    }, 3000);

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
      clearInterval(autoRefreshInterval);
    };
  }, []);

  const loadReportData = async () => {
    try {
      setLoading(true);

      // Get all campaign sends
      const { data: sends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('*');

      if (sendsError) throw sendsError;

      // Calculate overall stats
      const totalSent = sends?.filter(s => s.status === 'sent' || s.status === 'delivered').length || 0;
      const totalDelivered = sends?.filter(s => s.status === 'delivered').length || 0;
      const totalFailed = sends?.filter(s => s.status === 'failed').length || 0;
      const totalMessages = sends?.length || 0;
      const deliveryRate = totalMessages > 0 ? (totalSent / totalMessages) * 100 : 0;

      // Get unique contacts
      const uniquePhones = new Set(sends?.map(s => s.phone) || []);
      const totalContacts = uniquePhones.size;

      setStats({
        totalSent,
        totalDelivered,
        totalFailed,
        totalContacts,
        totalMessages,
        deliveryRate,
      });

      // Get campaigns with their stats
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .in('status', ['completed', 'cancelled', 'active'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (campaignsError) throw campaignsError;

      // Calculate stats for each campaign
      const campaignReportsData = await Promise.all(
        (campaigns || []).map(async (campaign) => {
          const campaignSends = sends?.filter(s => s.campaign_id === campaign.id) || [];
          const sent = campaignSends.filter(s => s.status === 'sent' || s.status === 'delivered').length;
          const delivered = campaignSends.filter(s => s.status === 'delivered').length;
          const failed = campaignSends.filter(s => s.status === 'failed').length;
          const total = campaignSends.length;
          const rate = total > 0 ? (sent / total) * 100 : 0;

          return {
            id: campaign.id,
            name: campaign.name,
            created_at: campaign.created_at,
            status: campaign.status,
            sent,
            delivered,
            failed,
            total,
            deliveryRate: rate,
          };
        })
      );

      setCampaignReports(campaignReportsData);

      // Get template usage stats
      const { data: templates, error: templatesError } = await supabase
        .from('message_templates')
        .select('name, usage_count')
        .order('usage_count', { ascending: false })
        .limit(5);

      if (templatesError) throw templatesError;

      setTemplateStats(templates?.map(t => ({ name: t.name, usage: t.usage_count || 0 })) || []);

    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const metricas = [
    {
      titulo: "Total de Mensagens",
      valor: stats.totalMessages.toLocaleString('pt-BR'),
      icon: Send,
      periodo: "Total de envios"
    },
    {
      titulo: "Taxa de Entrega",
      valor: `${stats.deliveryRate.toFixed(1)}%`,
      icon: TrendingUp,
      periodo: "Sucesso nos envios"
    },
    {
      titulo: "Contatos Alcançados",
      valor: stats.totalContacts.toLocaleString('pt-BR'),
      icon: Users,
      periodo: "Únicos"
    },
    {
      titulo: "Mensagens Recebidas",
      valor: "Em breve",
      icon: MessageSquare,
      periodo: "Via webhook"
    }
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">Relatórios</h1>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2" onClick={loadReportData}>
            <Calendar className="w-4 h-4" />
            Atualizar Dados
          </Button>
          <Badge variant="secondary" className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Atualização em Tempo Real
          </Badge>
        </div>
        <Button className="flex items-center gap-2" disabled>
          <Download className="w-4 h-4" />
          Exportar Relatório
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricas.map((metrica, index) => {
          const Icon = metrica.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metrica.titulo}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrica.valor}</div>
                <p className="text-xs text-muted-foreground mt-1">{metrica.periodo}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Resumo Geral de Envios
          </CardTitle>
          <CardDescription>Estatísticas detalhadas dos envios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-green-500/10">
              <div>
                <h3 className="font-medium text-green-600 dark:text-green-400">Mensagens Enviadas com Sucesso</h3>
                <p className="text-sm text-muted-foreground">
                  Enviadas + Entregues
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-2xl text-green-600 dark:text-green-400">
                  {stats.totalSent.toLocaleString('pt-BR')}
                </p>
                <p className="text-sm text-muted-foreground">de {stats.totalMessages.toLocaleString('pt-BR')}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-red-500/10">
              <div>
                <h3 className="font-medium text-red-600 dark:text-red-400">Falhas no Envio</h3>
                <p className="text-sm text-muted-foreground">
                  Mensagens que falharam
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-2xl text-red-600 dark:text-red-400">
                  {stats.totalFailed.toLocaleString('pt-BR')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stats.totalMessages > 0 ? ((stats.totalFailed / stats.totalMessages) * 100).toFixed(1) : 0}% do total
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Campanhas Recentes</CardTitle>
              <CardDescription>Resultados das últimas campanhas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {campaignReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma campanha encontrada
            </div>
          ) : (
            <div className="space-y-4">
              {campaignReports.map((campanha) => (
                <div 
                  key={campanha.id} 
                  className={`border rounded-lg p-4 ${campanha.status === 'active' ? 'border-primary bg-primary/5 shadow-lg' : ''}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <h3 className="font-medium">{campanha.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(campanha.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {campanha.status === 'active' && (
                        <Badge variant="secondary" className="animate-pulse">
                          Enviando Agora
                        </Badge>
                      )}
                    </div>
                    <Badge variant={
                      campanha.status === 'completed' ? 'default' : 
                      campanha.status === 'active' ? 'secondary' :
                      campanha.status === 'paused' ? 'outline' : 
                      'destructive'
                    }>
                      {campanha.status === 'completed' ? 'Concluída' :
                       campanha.status === 'active' ? 'Ativa' :
                       campanha.status === 'paused' ? 'Pausada' :
                       campanha.status === 'cancelled' ? 'Cancelada' : 'Rascunho'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{campanha.total.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Enviadas</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {campanha.sent.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Falhas</p>
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        {campanha.failed.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taxa de Sucesso</p>
                      <p className="font-semibold text-primary">{campanha.deliveryRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Modelos de Mensagem</CardTitle>
          <CardDescription>Modelos mais utilizados em campanhas</CardDescription>
        </CardHeader>
        <CardContent>
          {templateStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum template utilizado ainda
            </div>
          ) : (
            <div className="space-y-3">
              {templateStats.map((template, index) => (
                <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                  <span className="font-medium">{template.name}</span>
                  <div className="text-right">
                    <p className="font-semibold text-primary">{template.usage}</p>
                    <p className="text-xs text-muted-foreground">Usos</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Relatorio;