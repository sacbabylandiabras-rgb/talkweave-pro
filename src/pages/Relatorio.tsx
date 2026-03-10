import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, TrendingUp, Calendar, Users, MessageSquare, Send, Loader2, Eye, CheckCircle, XCircle, Clock as ClockIcon } from "lucide-react";
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
  description: string | null;
  created_at: string;
  status: string;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  total: number;
  deliveryRate: number;
  schedule_type: string | null;
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsCampaignId, setDetailsCampaignId] = useState<string | null>(null);
  const [detailsCampaignName, setDetailsCampaignName] = useState("");
  const [detailsSends, setDetailsSends] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const openDetails = async (campaignId: string, campaignName: string) => {
    setDetailsCampaignId(campaignId);
    setDetailsCampaignName(campaignName);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setDetailsSends(data || []);
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
      setDetailsSends([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
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
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Calculate stats for each campaign
      const campaignReportsData = (campaigns || []).map((campaign) => {
        const campaignSends = sends?.filter(s => s.campaign_id === campaign.id) || [];
        const sent = campaignSends.filter(s => s.status === 'sent' || s.status === 'delivered').length;
        const delivered = campaignSends.filter(s => s.status === 'delivered').length;
        const failed = campaignSends.filter(s => s.status === 'failed').length;
        const pending = campaignSends.filter(s => s.status === 'pending').length;
        const total = campaignSends.length;
        const rate = total > 0 ? (sent / total) * 100 : 0;

        return {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          created_at: campaign.created_at,
          status: campaign.status,
          sent,
          delivered,
          failed,
          pending,
          total,
          deliveryRate: rate,
          schedule_type: campaign.schedule_type,
        };
      });

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
            Dados carregados
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
              <CardTitle>Relatório de Campanhas e Envios em Massa</CardTitle>
              <CardDescription>Detalhamento individual de cada campanha e envio</CardDescription>
            </div>
            <Badge variant="outline">{campaignReports.length} registro(s)</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {campaignReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma campanha ou envio em massa encontrado
            </div>
          ) : (
            <div className="space-y-6">
              {campaignReports.map((campanha) => {
                const progressPercent = campanha.total > 0 ? ((campanha.sent + campanha.failed) / campanha.total) * 100 : 0;
                const isEnvioMassa = campanha.schedule_type === 'immediate' && !campanha.description;
                
                return (
                  <div 
                    key={campanha.id} 
                    className={`border rounded-lg p-5 ${campanha.status === 'active' ? 'border-primary bg-primary/5 shadow-lg' : 'bg-card'}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base">{campanha.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {isEnvioMassa ? 'Envio em Massa' : 'Campanha'}
                            </Badge>
                          </div>
                          {campanha.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{campanha.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
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
                        'destructive'
                      }>
                        {campanha.status === 'completed' ? 'Concluída' :
                         campanha.status === 'active' ? 'Em Envio' :
                         campanha.status === 'cancelled' ? 'Cancelada' : campanha.status}
                      </Badge>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progresso do envio</span>
                        <span>{progressPercent.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all" 
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-muted-foreground text-xs">Total</p>
                        <p className="font-bold text-lg">{campanha.total.toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-lg text-center">
                        <p className="text-muted-foreground text-xs">Enviadas</p>
                        <p className="font-bold text-lg text-primary">
                          {campanha.sent.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="p-3 bg-destructive/10 rounded-lg text-center">
                        <p className="text-muted-foreground text-xs">Falhas</p>
                        <p className="font-bold text-lg text-destructive">
                          {campanha.failed.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-muted-foreground text-xs">Pendentes</p>
                        <p className="font-bold text-lg">
                          {campanha.pending.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-lg text-center">
                        <p className="text-muted-foreground text-xs">Taxa de Sucesso</p>
                        <p className="font-bold text-lg text-primary">{campanha.deliveryRate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
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