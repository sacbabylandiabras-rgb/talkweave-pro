import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCampaigns, Campaign } from "@/hooks/useCampaigns";
import { useToast } from "@/hooks/use-toast";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { setZapiInstanceOverride, setZapiRotateMode, getSelectedCampaignInstanceId } from "@/hooks/useZapi";
import InstanceSelector, { ROTATE_ALL } from "@/components/envio/InstanceSelector";
import { Play, Pause, Trash2, Copy, Users, Calendar, FileText, BarChart3, Plus, XCircle, Edit, Send, CheckCircle, Clock as ClockIcon, MessageSquare, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateCampaignDialog } from "@/components/campanhas/CreateCampaignDialog";
import { EditCampaignDialog } from "@/components/campanhas/EditCampaignDialog";
import { SendProgressDialog } from "@/components/campanhas/SendProgressDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useCampaignSendsRealtime } from "@/hooks/useCampaignRealtime";
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
    sendCampaign
  } = useCampaigns();
  
  const { toast } = useToast();
  const { instances, activeInstance } = useZapiInstances();
  
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [campaignToCancel, setCampaignToCancel] = useState<string | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [totalContactsCount, setTotalContactsCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [campaignToResume, setCampaignToResume] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [campaignToSend, setCampaignToSend] = useState<Campaign | null>(null);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDialogCampaignId, setStatsDialogCampaignId] = useState<string | null>(null);
  const [statsDialogCampaignName, setStatsDialogCampaignName] = useState("");
  const [instanceSelectionMode, setInstanceSelectionMode] = useState<'default' | 'single' | 'rotate'>('default');

  // Realtime sends for stats dialog
  const { sends: statsDialogSends, loading: statsDialogLoading } = useCampaignSendsRealtime(
    statsDialogOpen ? statsDialogCampaignId : null
  );

  const statsDialogStats = {
    sent: statsDialogSends.filter(s => s.status === 'sent' || s.status === 'delivered').length,
    delivered: statsDialogSends.filter(s => s.status === 'delivered').length,
    pending: statsDialogSends.filter(s => s.status === 'pending').length,
    failed: statsDialogSends.filter(s => s.status === 'failed').length,
    total: statsDialogSends.length,
  };

  const openStatsDialog = (campaignId: string, campaignName: string) => {
    setStatsDialogCampaignId(campaignId);
    setStatsDialogCampaignName(campaignName);
    setStatsDialogOpen(true);
  };

  // Set default instance only when no manual selection
  useEffect(() => {
    if (instanceSelectionMode === 'default' && activeInstance) {
      setZapiInstanceOverride(activeInstance);
    }
  }, [activeInstance, instanceSelectionMode]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => setZapiInstanceOverride(null);
  }, []);

  // Track campaign IDs that were active during this session
  const [sessionActiveIds, setSessionActiveIds] = useState<Set<string>>(new Set());
  const campaignStatusKey = campaigns.map(c => `${c.id}-${c.status}`).join(',');

  // Track active campaigns and show toast when they complete
  useEffect(() => {
    const currentActiveIds = campaigns.filter(c => c.status === 'active').map(c => c.id);
    if (currentActiveIds.length > 0) {
      setSessionActiveIds(prev => {
        const next = new Set(prev);
        let changed = false;
        currentActiveIds.forEach(id => { if (!next.has(id)) { next.add(id); changed = true; } });
        return changed ? next : prev;
      });
    }

    campaigns.forEach(c => {
      if (sessionActiveIds.has(c.id) && c.status === 'completed') {
        toast({
          title: "✅ Campanha Concluída",
          description: `"${c.name}" terminou de enviar. Disponível em Relatórios.`,
        });
        setSessionActiveIds(prev => {
          const next = new Set(prev);
          next.delete(c.id);
          return next;
        });
      }
    });
  }, [campaignStatusKey]);

  // Status da lista é sincronizado localmente pelo hook; o diálogo cuida dos envios em tempo real.

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
  };

  const handleResumeCampaign = (id: string) => {
    setCampaignToResume(id);
    setResumeDialogOpen(true);
  };

  const confirmResumeCampaign = async () => {
    if (!campaignToResume) return;
    setResumeDialogOpen(false);
    
    try {
      const campaign = campaigns.find(c => c.id === campaignToResume);
      const targetContacts = campaign?.target_audience?.contacts || [];
      setTotalContactsCount(targetContacts.length);
      setSendingCampaignId(campaignToResume);

      // Start resuming FIRST so status changes to 'active' before dialog polls
      const resumePromise = resumeCampaign(campaignToResume);
      
      // Small delay to let status update propagate, then open dialog
      await new Promise(resolve => setTimeout(resolve, 500));
      setShowProgressDialog(true);
      
      await resumePromise;
    } catch (error) {
      console.error('Error resuming campaign:', error);
      setShowProgressDialog(false);
    }
    setCampaignToResume(null);
  };

  const handleDeleteCampaign = (id: string) => {
    setCampaignToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteCampaign = async () => {
    if (campaignToDelete) {
      await deleteCampaign(campaignToDelete);
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  const handleDuplicateCampaign = async (campaign: any) => {
    await duplicateCampaign(campaign);
  };

  const handleForceStopQueue = async (campaignId: string) => {
    try {
      const { data: sessionData } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
        return;
      }
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.functions.invoke('clear-zapi-queue', {
        headers: { Authorization: `Bearer ${token}` },
        body: { clearAllActive: true },
      });
      toast({ title: "Fila limpa", description: "Filas de todas as instâncias foram limpas com sucesso." });
    } catch (error) {
      console.error('Error clearing queue:', error);
      toast({ title: "Erro", description: "Erro ao limpar fila da Z-API", variant: "destructive" });
    }
  };

  const handleCancelCampaign = async () => {
    if (campaignToCancel) {
      await cancelCampaign(campaignToCancel);
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

    setCampaignToSend(campaign);
    setSendDialogOpen(true);
  };

  const confirmSendCampaign = async () => {
    if (!campaignToSend) return;
    const campaign = campaignToSend;
    setSendDialogOpen(false);
    setCampaignToSend(null);

    try {
      console.log(`✅ Usuário confirmou envio da campanha ${campaign.id}`);
      
      // Set up progress dialog
      setTotalContactsCount(campaign.target_audience?.contacts?.length || 0);
      setSendingCampaignId(campaign.id);
      setShowProgressDialog(true);

      // Start sending (this will update status to 'active' internally)
      await sendCampaign(campaign.id, campaign.target_audience.contacts, getSelectedCampaignInstanceId());
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Campanhas</h1>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Nova
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <InstanceSelector onInstanceChange={(id) => {
            if (id === ROTATE_ALL) {
              setInstanceSelectionMode('rotate');
              setZapiRotateMode(instances);
            } else {
              const inst = instances.find(i => i.id === id);
              if (inst) {
                setInstanceSelectionMode('single');
                setZapiInstanceOverride(inst);
              }
            }
          }} />
        </CardContent>
      </Card>

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
          }
        }}
        campaignId={sendingCampaignId}
        totalContacts={totalContactsCount}
        onPause={() => {
          if (sendingCampaignId) {
            console.log('🛑 Pause triggered from progress dialog');
          }
        }}
      />

      <div className="grid gap-4">
        {(() => {
          const visibleCampaigns = campaigns;
          
          if (visibleCampaigns.length === 0) {
            return (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhuma campanha pendente ou pausada. Crie uma nova campanha!
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Campanha
                  </Button>
                </CardContent>
              </Card>
            );
          }
          
          return visibleCampaigns.map((campaign) => (
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
                    
                    {/* Botão Retomar - para cancelled (continuar de onde parou) */}
                    {campaign.status === 'cancelled' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleResumeCampaign(campaign.id)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Continuar Envio
                      </Button>
                    )}

                    {/* Botões para completed - Forçar Parada + Duplicar */}
                    {campaign.status === 'completed' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleForceStopQueue(campaign.id)}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Forçar Parada
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateCampaign(campaign)}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Duplicar
                        </Button>
                      </>
                    )}

                    {/* Botão Duplicar - para cancelled */}
                    {campaign.status === 'cancelled' && (
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
                    onClick={() => openStatsDialog(campaign.id, campaign.name)}
                  >
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Ver Estatísticas
                  </Button>
                </div>

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
          ));
        })()}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCampaign} className="bg-destructive hover:bg-destructive/90">
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retomar Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente retomar esta campanha? A campanha continuará de onde parou e iniciará o envio de mensagens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResumeCampaign}>
              Sim, Retomar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar Campanha</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {campaignToSend && (
                  <>
                    Deseja realmente enviar a campanha <strong>{campaignToSend.name}</strong>?
                    <br />
                    👥 Total de contatos: {campaignToSend.target_audience?.contacts?.length || 0}
                    <br /><br />
                    Esta ação não pode ser desfeita!
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSendCampaign}>
              Sim, Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Estatísticas em Tempo Real */}
      <Dialog open={statsDialogOpen} onOpenChange={(open) => {
        setStatsDialogOpen(open);
        if (!open) setStatsDialogCampaignId(null);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Estatísticas - {statsDialogCampaignName}
              {statsDialogStats.pending > 0 && (
                <Badge variant="secondary" className="animate-pulse ml-2">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Tempo real
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {statsDialogLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (() => {
            // Build full contact list from target_audience + sends
            const campaign = campaigns.find(c => c.id === statsDialogCampaignId);
            const targetContacts: Array<{ phone: string; name?: string }> = 
              campaign?.target_audience?.contacts || [];
            
            // Map sends by phone for quick lookup
            const sendsByPhone = new Map<string, typeof statsDialogSends[0]>();
            statsDialogSends.forEach(send => {
              const existing = sendsByPhone.get(send.phone);
              // Keep the most recent or most successful send
              if (!existing || 
                  (send.status === 'sent' || send.status === 'delivered') ||
                  (existing.status !== 'sent' && existing.status !== 'delivered' && send.sent_at && (!existing.sent_at || send.sent_at > existing.sent_at))) {
                sendsByPhone.set(send.phone, send);
              }
            });

            // Build full list: all target contacts with their status
            const fullContactList = targetContacts.map((contact, index) => {
              const send = sendsByPhone.get(contact.phone);
              let status: 'enviado' | 'pendente' | 'cancelado' = 'pendente';
              let sentAt: string | null = null;
              let errorMessage: string | null = null;

              if (send) {
                if (send.status === 'sent' || send.status === 'delivered') {
                  status = 'enviado';
                  sentAt = send.sent_at || null;
                } else if (send.status === 'failed') {
                  status = 'cancelado';
                  errorMessage = send.error_message || null;
                } else {
                  status = 'pendente';
                }
              }

              return {
                id: send?.id || `target-${index}`,
                phone: contact.phone,
                name: send?.contact_name || contact.name || '',
                status,
                sentAt,
                errorMessage,
              };
            });

            // Also add any sends that might not be in target_audience
            statsDialogSends.forEach(send => {
              if (!targetContacts.find(c => c.phone === send.phone)) {
                let status: 'enviado' | 'pendente' | 'cancelado' = 'pendente';
                if (send.status === 'sent' || send.status === 'delivered') status = 'enviado';
                else if (send.status === 'failed') status = 'cancelado';
                fullContactList.push({
                  id: send.id,
                  phone: send.phone,
                  name: send.contact_name || '',
                  status,
                  sentAt: send.sent_at || null,
                  errorMessage: send.error_message || null,
                });
              }
            });

            const sentCount = fullContactList.filter(c => c.status === 'enviado').length;
            const pendingCount = fullContactList.filter(c => c.status === 'pendente').length;
            const cancelledCount = fullContactList.filter(c => c.status === 'cancelado').length;
            const totalCount = fullContactList.length;

            const handleRetryCancelled = async () => {
              const cancelledContacts = fullContactList
                .filter(c => c.status === 'cancelado')
                .map(c => ({ phone: c.phone, name: c.name || undefined }));

              if (cancelledContacts.length === 0) return;

              try {
                const campaignId = statsDialogCampaignId;

                // Close stats dialog
                setStatsDialogOpen(false);
                setStatsDialogCampaignId(null);

                // Set up progress dialog
                setTotalContactsCount(cancelledContacts.length);
                
                // Reuse hook flow (reactivates campaign when needed)
                if (campaignId) {
                  setSendingCampaignId(campaignId);
                  setShowProgressDialog(true);

                  await sendCampaign(campaignId, cancelledContacts, getSelectedCampaignInstanceId());
                }
              } catch (error) {
                console.error('Error retrying cancelled contacts:', error);
                toast({
                  title: "Erro",
                  description: "Erro ao reenviar para contatos cancelados",
                  variant: "destructive",
                });
                setShowProgressDialog(false);
                setSendingCampaignId(null);
              }
            };

            if (totalCount === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum envio registrado para esta campanha
                </div>
              );
            }

            return (
              <>
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progresso do envio</span>
                    <span>{totalCount > 0 ? (((sentCount + cancelledCount) / totalCount) * 100).toFixed(0) : 0}%</span>
                  </div>
                  <Progress value={totalCount > 0 ? ((sentCount + cancelledCount) / totalCount) * 100 : 0} className="h-2" />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-bold text-lg">{totalCount}</p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg text-center">
                    <p className="text-xs text-green-600 dark:text-green-400">Enviadas</p>
                    <p className="font-bold text-lg text-green-600 dark:text-green-400">{sentCount}</p>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">Pendentes</p>
                    <p className="font-bold text-lg text-yellow-600 dark:text-yellow-400">{pendingCount}</p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg text-center">
                    <p className="text-xs text-red-600 dark:text-red-400">Canceladas</p>
                    <p className="font-bold text-lg text-red-600 dark:text-red-400">{cancelledCount}</p>
                  </div>
                </div>

                {/* Retry cancelled button */}
                {cancelledCount > 0 && (
                  <Button 
                    onClick={handleRetryCancelled}
                    className="w-full"
                    variant="outline"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reenviar {cancelledCount} contato(s) cancelado(s)
                  </Button>
                )}

                {/* Table with full contact list */}
                <ScrollArea className="max-h-[40vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contato</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fullContactList.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">{contact.name || '-'}</TableCell>
                          <TableCell>{contact.phone}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={contact.status === 'enviado' ? 'default' : contact.status === 'pendente' ? 'secondary' : 'destructive'}
                              className="flex items-center gap-1 w-fit"
                            >
                              {contact.status === 'enviado' ? (
                                <><CheckCircle className="w-3 h-3" /> Enviado</>
                              ) : contact.status === 'pendente' ? (
                                <><ClockIcon className="w-3 h-3" /> Pendente</>
                              ) : (
                                <><XCircle className="w-3 h-3" /> Cancelado</>
                              )}
                            </Badge>
                            {contact.errorMessage && (
                              <p className="text-xs text-destructive mt-1">{contact.errorMessage}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {contact.sentAt ? format(new Date(contact.sentAt), "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Campanhas;
