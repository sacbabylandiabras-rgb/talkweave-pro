import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCampaigns, Campaign } from "@/hooks/useCampaigns";
import { useToast } from "@/hooks/use-toast";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { setZapiInstanceOverride } from "@/hooks/useZapi";
import InstanceSelector from "@/components/envio/InstanceSelector";
import { Play, Pause, Trash2, Copy, Users, Calendar, FileText, BarChart3, Plus, XCircle, Edit, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateCampaignDialog } from "@/components/campanhas/CreateCampaignDialog";
import { EditCampaignDialog } from "@/components/campanhas/EditCampaignDialog";
import { SendProgressDialog } from "@/components/campanhas/SendProgressDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Campanhas = () => {
  const { 
    campaigns, 
    loading, 
    pauseCampaign, 
    resumeCampaign,
    cancelCampaign, 
    deleteCampaign, 
    duplicateCampaign,
    getCampaignStats,
    sendCampaign,
    refetch
  } = useCampaigns();
  
  const { toast } = useToast();
  
  const [campaignStats, setCampaignStats] = useState<Record<string, any>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [campaignToCancel, setCampaignToCancel] = useState<string | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [totalContactsCount, setTotalContactsCount] = useState(0);

  const loadStats = async (campaignId: string) => {
    const stats = await getCampaignStats(campaignId);
    setCampaignStats(prev => ({ ...prev, [campaignId]: stats }));
  };

  // Auto-carregar stats para campanhas ativas ou pausadas
  useEffect(() => {
    const activeCampaigns = campaigns.filter(c => c.status === 'active' || c.status === 'paused');
    activeCampaigns.forEach(c => loadStats(c.id));

    // Polling para campanhas ativas (atualizar a cada 5s)
    if (activeCampaigns.some(c => c.status === 'active')) {
      const interval = setInterval(() => {
        campaigns.filter(c => c.status === 'active').forEach(c => loadStats(c.id));
        refetch();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [campaigns.map(c => `${c.id}-${c.status}`).join(',')]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Ativa</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500">Pausada</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500">Concluída</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500">Cancelada</Badge>;
      case 'draft':
        return <Badge variant="outline">Rascunho</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handlePauseCampaign = async (id: string) => {
    await pauseCampaign(id);
    await refetch();
  };

  const handleResumeCampaign = async (id: string) => {
    // CONFIRMAÇÃO obrigatória para evitar retomadas acidentais
    const campaign = campaigns.find(c => c.id === id);
    const confirmed = confirm(
      `⚠️ ATENÇÃO: Deseja realmente RETOMAR esta campanha?\n\n` +
      `📤 Campanha: ${campaign?.name || 'Desconhecida'}\n` +
      `🔄 A campanha continuará de onde parou\n\n` +
      `Esta ação iniciará o envio de mensagens!`
    );

    if (!confirmed) {
      console.log('❌ Retomada de campanha cancelada pelo usuário');
      return;
    }

    try {
      console.log(`✅ Usuário confirmou retomada da campanha ${id}`);
      await resumeCampaign(id);
      await refetch();
    } catch (error) {
      console.error('Error resuming campaign:', error);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta campanha?")) {
      await deleteCampaign(id);
    }
  };

  const handleDuplicateCampaign = async (campaign: any) => {
    await duplicateCampaign(campaign);
  };

  const handleCancelCampaign = async () => {
    if (campaignToCancel) {
      await cancelCampaign(campaignToCancel);
      await refetch();
      setCancelDialogOpen(false);
      setCampaignToCancel(null);
    }
  };

  const openCancelDialog = (campaignId: string) => {
    setCampaignToCancel(campaignId);
    setCancelDialogOpen(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setShowEditDialog(true);
  };

  const handleSendCampaign = async (campaign: Campaign) => {
    if (!campaign.target_audience?.contacts || campaign.target_audience.contacts.length === 0) {
      toast({
        title: "Erro",
        description: "Esta campanha não possui contatos configurados",
        variant: "destructive",
      });
      return;
    }

    // CONFIRMAÇÃO obrigatória para evitar envios acidentais
    const confirmed = confirm(
      `⚠️ ATENÇÃO: Deseja realmente ENVIAR esta campanha?\n\n` +
      `📤 Campanha: ${campaign.name}\n` +
      `👥 Total de contatos: ${campaign.target_audience.contacts.length}\n\n` +
      `Esta ação NÃO pode ser desfeita!`
    );

    if (!confirmed) {
      console.log('❌ Envio de campanha cancelado pelo usuário');
      return;
    }

    try {
      console.log(`✅ Usuário confirmou envio da campanha ${campaign.id}`);
      
      // Set up progress dialog
      setTotalContactsCount(campaign.target_audience.contacts.length);
      setSendingCampaignId(campaign.id);
      setShowProgressDialog(true);

      // Start sending (this will update status to 'active' internally)
      await sendCampaign(campaign.id, campaign.target_audience.contacts);
      
      // Force refresh to show updated status and pause button
      await refetch();
    } catch (error) {
      console.error('Error sending campaign:', error);
      setShowProgressDialog(false);
      setSendingCampaignId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando campanhas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="text-muted-foreground">Gerencie suas campanhas de mensagens</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      <CreateCampaignDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />

      <EditCampaignDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog}
        campaign={editingCampaign}
      />

      <SendProgressDialog 
        open={showProgressDialog}
        onOpenChange={(open) => {
          setShowProgressDialog(open);
          if (!open) {
            setSendingCampaignId(null);
            setTotalContactsCount(0);
            // Refresh campaigns list when closing
            refetch();
          }
        }}
        campaignId={sendingCampaignId}
        totalContacts={totalContactsCount}
        onPause={() => {
          // Refresh campaigns after pause
          refetch();
        }}
      />

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhuma campanha criada ainda. Crie sua primeira campanha agora!
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Campanha
              </Button>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {getStatusBadge(campaign.status)}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(campaign.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Botão Editar - sempre disponível para draft, paused */}
                    {(campaign.status === 'draft' || campaign.status === 'paused') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditCampaign(campaign)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                    )}

                    {/* Botão Enviar - para draft */}
                    {campaign.status === 'draft' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleSendCampaign(campaign)}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Enviar
                      </Button>
                    )}
                    
                    {/* Botões para campanhas ativas */}
                    {campaign.status === 'active' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePauseCampaign(campaign.id)}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pausar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCancelDialog(campaign.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </>
                    )}
                    
                    {/* Botões para campanhas pausadas */}
                    {campaign.status === 'paused' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleResumeCampaign(campaign.id)}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Retomar de onde parou
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCancelDialog(campaign.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </>
                    )}
                    
                    {/* Botão Duplicar - para completed e cancelled */}
                    {(campaign.status === 'completed' || campaign.status === 'cancelled') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateCampaign(campaign)}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Duplicar
                      </Button>
                    )}
                    
                    {/* Botão Deletar - sempre disponível */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteCampaign(campaign.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {campaign.description && (
                  <p className="text-sm text-muted-foreground">{campaign.description}</p>
                )}

                {campaign.template && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Modelo: {campaign.template.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {campaign.template.content}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => loadStats(campaign.id)}
                  >
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Ver Estatísticas
                  </Button>
                </div>

                {campaignStats[campaign.id] && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 bg-muted/30 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{campaignStats[campaign.id].totalContacts}</div>
                        <div className="text-xs text-muted-foreground">Total Contatos</div>
                      </div>
                      {campaign.status === 'paused' && campaignStats[campaign.id].remaining > 0 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">{campaignStats[campaign.id].remaining}</div>
                          <div className="text-xs text-muted-foreground">Restantes</div>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{campaignStats[campaign.id].pending}</div>
                        <div className="text-xs text-muted-foreground">Pendentes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{campaignStats[campaign.id].sent}</div>
                        <div className="text-xs text-muted-foreground">Enviadas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{campaignStats[campaign.id].delivered}</div>
                        <div className="text-xs text-muted-foreground">Entregues</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{campaignStats[campaign.id].failed}</div>
                        <div className="text-xs text-muted-foreground">Falhas</div>
                      </div>
                    </div>
                    
                    {/* Relatório de números não enviados para campanhas canceladas */}
                    {campaign.status === 'cancelled' && campaignStats[campaign.id].remaining > 0 && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold mb-2">
                          <XCircle className="w-4 h-4" />
                          <span>Campanha Cancelada - Números Não Enviados</span>
                        </div>
                        <p className="text-sm text-red-600 dark:text-red-300 mb-2">
                          Esta campanha foi cancelada. <strong>{campaignStats[campaign.id].remaining} números não receberam a mensagem</strong> devido à desconexão do dispositivo.
                        </p>
                        <div className="text-xs text-muted-foreground">
                          💡 Dica: Use o botão "Duplicar" para recriar a campanha e enviar aos números restantes.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <span>Tipo: {campaign.schedule_type === 'immediate' ? 'Imediato' : campaign.schedule_type === 'scheduled' ? 'Agendado' : 'Recorrente'}</span>
                  {campaign.scheduled_at && (
                    <>
                      <span>•</span>
                      <span>Agendado para: {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta campanha? Esta ação não pode ser desfeita.
              Os envios que já foram realizados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelCampaign} className="bg-red-600 hover:bg-red-700">
              Sim, Cancelar Campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Campanhas;
