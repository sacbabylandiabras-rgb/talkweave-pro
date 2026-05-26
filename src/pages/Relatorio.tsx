import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Download, TrendingUp, Users, MessageSquare, Send, Loader2, Eye, CheckCircle, XCircle, Clock as ClockIcon, RefreshCw, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCampaignsRealtime, useAllCampaignSendsRealtime, useCampaignSendsRealtime } from "@/hooks/useCampaignRealtime";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

const safeFormat = (date: any, formatStr: string, options?: any) => {
  if (!date) return "";
  const d = new Date(date);
  if (!isValid(d)) return "Data inválida";
  return format(d, formatStr, options);
};

type ReportSend = {
  id: string;
  campaign_id: string;
  phone: string;
  contact_name: string | null;
  status: string | null;
  sent_at: string | null;
  delivered_at?: string | null;
  created_at: string;
  error_message: string | null;
};

const getSendTimestamp = (send: Pick<ReportSend, 'delivered_at' | 'sent_at' | 'created_at'>) => send?.delivered_at || send?.sent_at || send?.created_at || "";

const normalizePhone = (phone?: string | null) => {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.toLowerCase().includes("@lid")) return trimmed.toLowerCase();
  return trimmed.replace(/\D/g, "");
};

const buildLatestSendsMap = (sends: ReportSend[]) => {
  const latestMap = new Map<string, ReportSend>();

  sends.forEach((send) => {
    const phoneKey = normalizePhone(send.phone) || send.phone;
    const key = `${send.campaign_id}:${phoneKey}`;
    const current = latestMap.get(key);

    if (!current || new Date(getSendTimestamp(send)).getTime() >= new Date(getSendTimestamp(current)).getTime()) {
      latestMap.set(key, send);
    }
  });

  return latestMap;
};

const getLatestCampaignSends = (campaignId: string, sends: ReportSend[]) => {
  const latestMap = buildLatestSendsMap(sends);
  return Array.from(latestMap.values()).filter((send) => send.campaign_id === campaignId);
};

const countSuccessfulStatuses = (sends: Array<Pick<ReportSend, 'status'>>) => sends.filter(
  (send) => send.status === 'delivered' || send.status === 'sent'
).length;

const Relatorio = () => {
  const { campaigns: campaignList, loading: campaignsLoading } = useCampaignsRealtime();
  const { sends: allSends, loading: sendsLoading } = useAllCampaignSendsRealtime();
  const [templateStats, setTemplateStats] = useState<Array<{ name: string; usage: number }>>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsCampaignId, setDetailsCampaignId] = useState<string | null>(null);
  const [detailsCampaignName, setDetailsCampaignName] = useState("");

  // Realtime details for selected campaign
  const { sends: detailsSends, loading: detailsLoading } = useCampaignSendsRealtime(
    detailsOpen ? detailsCampaignId : null
  );

  const loading = campaignsLoading || sendsLoading;

  // Load template stats once
  useEffect(() => {
    const loadTemplates = async () => {
      const { data: templates } = await supabase
        .from('message_templates')
        .select('name, usage_count')
        .order('usage_count', { ascending: false })
        .limit(5);
      setTemplateStats(templates?.map(t => ({ name: t.name, usage: t.usage_count || 0 })) || []);
    };
    loadTemplates();
  }, []);

  // Helper to support legacy/new target_audience formats
  const getTargetContactsCount = (targetAudience: any): number => {
    if (!targetAudience) return 0;
    if (Array.isArray(targetAudience)) return targetAudience.length;
    if (Array.isArray(targetAudience.contacts)) return targetAudience.contacts.length;
    if (Array.isArray(targetAudience.phones)) return targetAudience.phones.length;
    if (Array.isArray(targetAudience.numbers)) return targetAudience.numbers.length;
    if (typeof targetAudience.total_contacts === 'number') return targetAudience.total_contacts;
    if (typeof targetAudience.total === 'number') return targetAudience.total;
    return 0;
  };

  // Compute stats from realtime data
  // Calculate total pending including contacts not yet processed
  const latestAllSends = Array.from(buildLatestSendsMap(allSends as ReportSend[]).values());

  const globalNotProcessed = campaignList.reduce((acc, campaign) => {
    const targetContacts = getTargetContactsCount(campaign.target_audience);
    const processedForCampaign = latestAllSends.filter(s => s.campaign_id === campaign.id).length;
    return acc + Math.max(0, targetContacts - processedForCampaign);
  }, 0);
  const dbPendingCount = latestAllSends.filter(s => s.status === 'pending' || (s.status === 'sent' && !s.error_message) || !s.status).length;
  const effectiveTotalMessages = latestAllSends.length + globalNotProcessed;

  const stats = {
    totalSent: countSuccessfulStatuses(latestAllSends),
    totalDelivered: latestAllSends.filter(s => s.status === 'delivered').length,
    totalFailed: latestAllSends.filter(s => s.status === 'failed').length,
    totalPending: dbPendingCount + globalNotProcessed,
    totalMessages: effectiveTotalMessages,
    totalContacts: new Set(latestAllSends.map(s => normalizePhone(s.phone) || s.phone)).size,
    deliveryRate: effectiveTotalMessages > 0
      ? (countSuccessfulStatuses(latestAllSends) / effectiveTotalMessages) * 100
      : 0,
  };

  // Compute campaign reports from realtime data
  const campaignReports = campaignList.map((campaign) => {
    const campaignSends = getLatestCampaignSends(campaign.id, allSends as ReportSend[]);
    const sent = countSuccessfulStatuses(campaignSends);
    const failed = campaignSends.filter(s => s.status === 'failed').length;
    const dbPending = campaignSends.filter(s => s.status === 'pending' || (s.status === 'sent' && !s.error_message) || !s.status).length;

    // Calculate real pending: total target contacts - processed sends
    const targetContacts = getTargetContactsCount(campaign.target_audience);
    const totalTarget = targetContacts > 0 ? targetContacts : campaignSends.length;
    const notYetProcessed = Math.max(0, totalTarget - campaignSends.length);
    const pending = dbPending + notYetProcessed;
    const total = totalTarget;
    const rate = total > 0 ? (sent / total) * 100 : 0;

    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      created_at: campaign.created_at,
      status: campaign.status || 'draft',
      sent,
      failed,
      pending,
      total,
      deliveryRate: rate,
      schedule_type: campaign.schedule_type,
    };
  });

  const selectedDetailsCampaign = campaignList.find(c => c.id === detailsCampaignId);
  const detailsTargetCount = getTargetContactsCount(selectedDetailsCampaign?.target_audience);
  const detailsLatestSends = getLatestCampaignSends(detailsCampaignId || '', detailsSends as ReportSend[]);
  const detailsDbPending = detailsLatestSends.filter(s => s.status === 'pending' || (s.status === 'sent' && !s.error_message) || !s.status).length;
  const detailsNotProcessed = Math.max(0, detailsTargetCount - detailsLatestSends.length);

  // Details dialog stats
  const detailsStats = {
    sent: countSuccessfulStatuses(detailsLatestSends),
    pending: detailsDbPending + detailsNotProcessed,
    failed: detailsLatestSends.filter(s => s.status === 'failed').length,
    total: detailsTargetCount > 0 ? detailsTargetCount : detailsLatestSends.length,
  };

  const openDetails = (campaignId: string, campaignName: string) => {
    setDetailsCampaignId(campaignId);
    setDetailsCampaignName(campaignName);
    setDetailsOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActiveCampaigns = campaignReports.some(c => c.status === 'active');

  const metricas = [
    { titulo: "Total de Mensagens", valor: stats.totalMessages.toLocaleString('pt-BR'), icon: Send, periodo: "Total de envios" },
    { titulo: "Taxa de Entrega", valor: `${stats.deliveryRate.toFixed(1)}%`, icon: TrendingUp, periodo: "Sucesso nos envios" },
    { titulo: "Contatos Alcançados", valor: stats.totalContacts.toLocaleString('pt-BR'), icon: Users, periodo: "Únicos" },
    { titulo: "Pendentes", valor: stats.totalPending.toLocaleString('pt-BR'), icon: ClockIcon, periodo: "Aguardando envio" },
  ];

  return (
    <div className="space-y-4">
       <h1 className="text-lg font-semibold text-foreground">Relatórios</h1>

      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          {hasActiveCampaigns && (
            <Badge variant="secondary" className="flex items-center gap-1 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Tempo real ativo
            </Badge>
          )}
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
                <h3 className="font-medium text-green-600 dark:text-green-400">Entregues com Sucesso</h3>
                <p className="text-sm text-muted-foreground">Confirmadas pelo WhatsApp</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-2xl text-green-600 dark:text-green-400">
                  {stats.totalSent.toLocaleString('pt-BR')}
                </p>
                <p className="text-sm text-muted-foreground">de {stats.totalMessages.toLocaleString('pt-BR')}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-yellow-500/10">
              <div>
                <h3 className="font-medium text-yellow-600 dark:text-yellow-400">Pendentes</h3>
                <p className="text-sm text-muted-foreground">Aguardando envio</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-2xl text-yellow-600 dark:text-yellow-400">
                  {stats.totalPending.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-red-500/10">
              <div>
                <h3 className="font-medium text-red-600 dark:text-red-400">Falhas no Envio</h3>
                <p className="text-sm text-muted-foreground">Mensagens que falharam</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-2xl text-red-600 dark:text-red-400">
                  {stats.totalFailed.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensagens por Instância */}
      {(() => {
        const instanceMap = new Map<string, { sent: number; failed: number; pending: number; total: number }>();
        latestAllSends.forEach(send => {
          const name = (send as any).instance_name || 'Sem instância';
          const current = instanceMap.get(name) || { sent: 0, failed: 0, pending: 0, total: 0 };
          current.total++;
          if (send.status === 'delivered') current.sent++;
          else if (send.status === 'failed' || (send.error_message && send.status !== 'delivered')) current.failed++;
          else current.pending++;
          instanceMap.set(name, current);
        });
        const instanceEntries = Array.from(instanceMap.entries()).sort((a, b) => b[1].total - a[1].total);
        
        if (instanceEntries.length === 0 || (instanceEntries.length === 1 && instanceEntries[0][0] === 'Sem instância')) return null;
        
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Mensagens por Instância
              </CardTitle>
              <CardDescription>Distribuição de envios por conexão WhatsApp</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {instanceEntries.map(([name, data]) => {
                  const successRate = data.total > 0 ? (data.sent / data.total) * 100 : 0;
                  return (
                    <div key={name} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-primary" />
                          <h3 className="font-semibold">{name}</h3>
                        </div>
                        <Badge variant="outline">{data.total.toLocaleString('pt-BR')} mensagens</Badge>
                      </div>
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Taxa de sucesso</span>
                          <span>{successRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={successRate} className="h-2" />
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div className="p-2 bg-green-500/10 rounded text-center">
                          <p className="text-xs text-green-600 dark:text-green-400">Entregues</p>
                          <p className="font-bold text-green-600 dark:text-green-400">{data.sent.toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="p-2 bg-yellow-500/10 rounded text-center">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">Pendentes</p>
                          <p className="font-bold text-yellow-600 dark:text-yellow-400">{data.pending.toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="p-2 bg-destructive/10 rounded text-center">
                          <p className="text-xs text-muted-foreground">Falhas</p>
                          <p className="font-bold text-destructive">{data.failed.toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

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
                            {safeFormat(campanha.created_at, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        {campanha.status === 'active' && (
                          <Badge variant="secondary" className="animate-pulse">
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
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
                         campanha.status === 'active' ? 'Em Envio' :
                         campanha.status === 'paused' ? 'Pausada' :
                         campanha.status === 'cancelled' ? 'Cancelada' : campanha.status}
                      </Badge>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progresso do envio</span>
                        <span>{progressPercent.toFixed(0)}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-muted-foreground text-xs">Total</p>
                        <p className="font-bold text-lg">{campanha.total.toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="p-3 bg-green-500/10 rounded-lg text-center">
                        <p className="text-xs text-green-600 dark:text-green-400">Entregues</p>
                        <p className="font-bold text-lg text-green-600 dark:text-green-400">
                          {campanha.sent.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">Pendentes</p>
                        <p className="font-bold text-lg text-yellow-600 dark:text-yellow-400">
                          {campanha.pending.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="p-3 bg-destructive/10 rounded-lg text-center">
                        <p className="text-muted-foreground text-xs">Falhas</p>
                        <p className="font-bold text-lg text-destructive">
                          {campanha.failed.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-lg text-center">
                        <p className="text-muted-foreground text-xs">Taxa de Sucesso</p>
                        <p className="font-bold text-lg text-primary">{campanha.deliveryRate.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={() => openDetails(campanha.id, campanha.name)}
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalhes
                      </Button>
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

      {/* Dialog de detalhes com tempo real */}
      <Dialog open={detailsOpen} onOpenChange={(open) => {
        setDetailsOpen(open);
        if (!open) {
          setDetailsCampaignId(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Detalhes - {detailsCampaignName}
            </DialogTitle>
          </DialogHeader>

          {!detailsLoading && detailsStats.total > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <p className="text-xs text-green-600 dark:text-green-400">Entregues</p>
                <p className="font-bold text-lg text-green-600 dark:text-green-400">{detailsStats.sent}</p>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                <p className="text-xs text-yellow-600 dark:text-yellow-400">Pendentes</p>
                <p className="font-bold text-lg text-yellow-600 dark:text-yellow-400">{detailsStats.pending}</p>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Falhas</p>
                <p className="font-bold text-lg text-destructive">{detailsStats.failed}</p>
              </div>
            </div>
          )}

          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : detailsLatestSends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {detailsStats.pending > 0
                ? `${detailsStats.pending} contato(s) pendente(s) aguardando processamento desta campanha`
                : 'Nenhum envio registrado para esta campanha'}
            </div>
          ) : (
            <ScrollArea className="max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entregue em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailsLatestSends.map((send) => (
                    <TableRow key={send.id}>
                      <TableCell className="font-medium">{send.contact_name || '-'}</TableCell>
                      <TableCell>{send.phone}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={send.status === 'delivered' ? 'default' : send.status === 'sent' ? 'secondary' : send.status === 'pending' ? 'outline' : 'destructive'}
                          className="flex items-center gap-1 w-fit"
                        >
                          {send.status === 'delivered' ? (
                            <><CheckCircle className="w-3 h-3" /> Entregue</>
                          ) : send.status === 'sent' ? (
                            <><CheckCircle className="w-3 h-3 text-green-500" /> Enviado</>
                          ) : send.status === 'pending' ? (
                            <><ClockIcon className="w-3 h-3" /> Pendente</>
                          ) : (
                            <><XCircle className="w-3 h-3" /> Falhou</>
                          )}
                        </Badge>
                        {send.error_message && (
                          <p className="text-xs text-destructive mt-1">{send.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {send.delivered_at ? safeFormat(send.delivered_at, "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Relatorio;
