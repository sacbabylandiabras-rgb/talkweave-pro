import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCampaigns, Campaign } from "@/hooks/useCampaigns";
import { useToast } from "@/hooks/use-toast";
import { useZapiInstances } from "@/hooks/useZapiInstances";
import { setZapiInstanceOverride, setZapiRotateMode, getSelectedCampaignInstanceId } from "@/hooks/useZapi";
import InstanceSelector, { ROTATE_ALL } from "@/components/envio/InstanceSelector";
import { Play, Pause, Trash2, Copy, Users, Calendar, FileText, BarChart3, Plus, XCircle, Edit, Send, CheckCircle, Clock as ClockIcon, RefreshCw, Filter, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateCampaignDialog } from "@/components/campanhas/CreateCampaignDialog";
import { CreateGroupCampaignDialog } from "@/components/campanhas/CreateGroupCampaignDialog";
import { EditCampaignDialog } from "@/components/campanhas/EditCampaignDialog";
import { SendProgressDialog } from "@/components/campanhas/SendProgressDialog";
import { FilterNumbersDialog } from "@/components/campanhas/FilterNumbersDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useCampaignSendsRealtime } from "@/hooks/useCampaignRealtime";
import { supabase } from "@/integrations/supabase/client";
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

interface CampanhasProps {
  mode?: "contacts" | "groups";
}

const formatErrorMessage = (msg: string | null): string | null => {
  if (!msg) return null;
  if (msg === 'NOT_FOUND' || msg.includes('user_not_found')) {
    return 'Número não cadastrado no WhatsApp';
  }
  if (msg === 'Enqueue message is disabled for this instance when whatsapp is disconnected. You can update this setting on instance configuration.') {
    return 'Instância desconectada';
  }
  return msg;
};

const Campanhas = ({ mode = "contacts" }: CampanhasProps = {}) => {
  const isGroupsMode = mode === "groups";
  const navigate = useNavigate();
  const { 
    campaigns, 
    loading, 
    pauseCampaign, 
    resumeCampaign,
    cancelCampaign, 
    deleteCampaign, 
    duplicateCampaign,
    sendCampaign,
    refetch: refetchCampaigns
  } = useCampaigns();
  
  const { toast } = useToast();
  const { instances: allInstances, activeInstance } = useZapiInstances();
  const instances = useMemo(() => allInstances.filter(i => (i.api_provider || 'zapi').toLowerCase() !== 'uazapi'), [allInstances]);
  
  
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
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [campaignToResume, setCampaignToResume] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [campaignToSend, setCampaignToSend] = useState<Campaign | null>(null);
  const [sendDialogRemoveDuplicates, setSendDialogRemoveDuplicates] = useState(true);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDialogCampaignId, setStatsDialogCampaignId] = useState<string | null>(null);
  const [statsDialogCampaignName, setStatsDialogCampaignName] = useState("");
  const [statsDialogHasUrlButton, setStatsDialogHasUrlButton] = useState(false);
  const [statsDialogClickMap, setStatsDialogClickMap] = useState<Map<string, string>>(new Map());
  const [statsDialogTargetContacts, setStatsDialogTargetContacts] = useState<Array<{ phone: string; name?: string }>>([]);
  const [statsDialogLinkClicks, setStatsDialogLinkClicks] = useState<Array<{
    id: string;
    created_at: string;
    ip: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    user_agent: string | null;
    phone: string | null;
    btn_text: string | null;
  }>>([]);
   const [instanceSelectionMode, setInstanceSelectionMode] = useState<'default' | 'single' | 'rotate'>('default');
   const [showFilterDialog, setShowFilterDialog] = useState(false);
   const [removeDuplicatesGlobal, setRemoveDuplicatesGlobal] = useState(true);

  // Realtime sends for stats dialog
  const { sends: statsDialogSends, loading: statsDialogLoading } = useCampaignSendsRealtime(
    statsDialogOpen ? statsDialogCampaignId : null
  );

   const normalizePhoneKey = (phone?: string | null) => {
     if (!phone) return '';
     return phone.replace(/\D/g, '');
   };

  const normalizeGroupDisplayPhone = (phone?: string | null) => {
    if (!phone) return '';
    if (phone.includes('-group@g.us')) return phone.replace(/-group@g\.us$/i, '@g.us');
    if (phone.endsWith('-group')) return phone.replace(/-group$/i, '@g.us');
    return phone;
  };

   const resolvePhoneKey = (phone?: string | null) => normalizePhoneKey(phone);
   const resolveDisplayPhone = (phone?: string | null) => normalizeGroupDisplayPhone(phone);

   useEffect(() => {
     if (!statsDialogOpen) {
       setStatsDialogClickMap(new Map());
     }
   }, [statsDialogOpen]);

  // Detect if the campaign template has trackable links (to show click metrics)
  useEffect(() => {
    if (!statsDialogOpen || !statsDialogCampaignId) {
      setStatsDialogHasUrlButton(false);
      return;
    }

    let active = true;
    const fetchTemplateButtons = async () => {
      const { data: campaignRow } = await supabase
        .from('campaigns')
        .select('template_id')
        .eq('id', statsDialogCampaignId)
        .maybeSingle();

      if (!active || !campaignRow?.template_id) {
        if (active) setStatsDialogHasUrlButton(false);
        return;
      }

      const { data: tpl } = await supabase
        .from('message_templates')
        .select('buttons')
        .eq('id', campaignRow.template_id)
        .maybeSingle();

      if (!active) return;
      const buttons = Array.isArray((tpl as any)?.buttons) ? (tpl as any).buttons : [];
      const hasUrl = buttons.some((b: any) => {
        const type = String(b?.type || '').toUpperCase();
        return type === 'URL' || Boolean(b?.url || b?.value);
      });
      setStatsDialogHasUrlButton(hasUrl);
    };

    fetchTemplateButtons();
    return () => { active = false; };
  }, [statsDialogOpen, statsDialogCampaignId]);

  // Always fetch the most up-to-date target_audience contacts directly from DB
  // (the in-memory `campaigns` list can be stale or partially hydrated for very large audiences).
  useEffect(() => {
    if (!statsDialogOpen || !statsDialogCampaignId) {
      setStatsDialogTargetContacts([]);
      return;
    }

    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('target_audience')
        .eq('id', statsDialogCampaignId)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error('Erro ao carregar audiência da campanha:', error);
        setStatsDialogTargetContacts([]);
        return;
      }

      const rawContacts = (data?.target_audience as any)?.contacts;
      const contacts: Array<{ phone: string; name?: string }> = Array.isArray(rawContacts)
        ? rawContacts
            .map((c: any) => ({
              phone: String(c?.phone || '').trim(),
              name: c?.name ? String(c.name) : undefined,
            }))
            .filter((c) => Boolean(c.phone))
        : [];
      setStatsDialogTargetContacts(contacts);
    })();

    return () => { active = false; };
  }, [statsDialogOpen, statsDialogCampaignId]);

  useEffect(() => {
    if (!statsDialogOpen || !statsDialogCampaignId || !statsDialogCampaignName) {
      setStatsDialogClickMap(new Map());
      return;
    }

    let active = true;

    const fetchCampaignClicks = async () => {
      const campaign = campaigns.find(c => c.id === statsDialogCampaignId);
      const campaignStartedAt = campaign?.created_at;

      let query = supabase
        .from('message_logs')
        .select('phone, created_at, message_received, response_sent')
        .eq('response_sent', `[Fluxo: ${statsDialogCampaignName}]`)
        .ilike('message_received', '[URL Click]%')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (campaignStartedAt) {
        query = query.gte('created_at', campaignStartedAt);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao carregar cliques reais da campanha:', error);
        return;
      }

      if (!active) return;

      const nextMap = new Map<string, string>();
      (data || []).forEach((row: any) => {
        const phoneKey = normalizePhoneKey(row.phone);
        if (!phoneKey || nextMap.has(phoneKey)) return;
        nextMap.set(phoneKey, row.created_at);
      });

      const { data: linkRows, error: linkError } = await (supabase as any)
        .from('link_clicks')
        .select('phone, created_at')
        .eq('campaign_id', statsDialogCampaignId)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (linkError) {
        console.error('Erro ao carregar cliques da campanha:', linkError);
      }

      (linkRows || []).forEach((row: any) => {
        const phoneKey = normalizePhoneKey(row.phone);
        if (!phoneKey || nextMap.has(phoneKey)) return;
        nextMap.set(phoneKey, row.created_at);
      });

      setStatsDialogClickMap(nextMap);
    };

    fetchCampaignClicks();

    return () => {
      active = false;
    };
  }, [statsDialogOpen, statsDialogCampaignId, statsDialogCampaignName, campaigns]);

  // Carrega cliques aproximados (IP, país, cidade, user agent)
  useEffect(() => {
    if (!statsDialogOpen || !statsDialogCampaignId) {
      setStatsDialogLinkClicks([]);
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('link_clicks')
        .select('id, created_at, ip, country, city, region, user_agent, phone, btn_text')
        .eq('campaign_id', statsDialogCampaignId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (!active) return;
      if (error) {
        console.error('Erro ao carregar link_clicks:', error);
        setStatsDialogLinkClicks([]);
        return;
      }
      setStatsDialogLinkClicks((data || []) as any);
    })();

    const channel = supabase
      .channel(`campaign-link-clicks-${statsDialogCampaignId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'link_clicks', filter: `campaign_id=eq.${statsDialogCampaignId}` },
        (payload) => {
          const row = payload.new as any;
          setStatsDialogLinkClicks((prev) => [row, ...prev].slice(0, 500));
          const phoneKey = normalizePhoneKey(row.phone);
          if (phoneKey) {
            setStatsDialogClickMap((prev) => {
              if (prev.has(phoneKey)) return prev;
              const next = new Map(prev);
              next.set(phoneKey, row.created_at);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [statsDialogOpen, statsDialogCampaignId]);

  const isCancelledSendStatus = (status?: string | null) =>
    status === 'failed' || status === 'cancelled' || status === 'canceled' || status === 'error' || status === 'rejected';

  const statsDialogStats = {
    // "Entregue" só com confirmação real via callback (status delivered).
    sent: statsDialogSends.filter(s => s.status === 'delivered').length,
    delivered: statsDialogSends.filter(s => s.status === 'delivered').length,
    // "sent" é só enviando; "pending" continua pendente.
    sending: statsDialogSends.filter(s => s.status === 'sent').length,
    pending: statsDialogSends.filter(s => s.status === 'pending').length,
    failed: statsDialogSends.filter(s => isCancelledSendStatus(s.status)).length,
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

  const getStatusBadge = (status: string, campaign?: Campaign) => {
    // Check if it's a scheduled draft
    if (status === 'draft' && campaign?.schedule_type === 'scheduled' && campaign?.scheduled_at) {
      return <Badge className="bg-purple-500 text-white"><ClockIcon className="w-3 h-3 mr-1" />Agendada</Badge>;
    }
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
      const selectedInstanceId = getSelectedCampaignInstanceId();
      console.log(`✅ Usuário confirmou retomada da campanha ${campaignToResume} via ${selectedInstanceId}`);
      
      const campaign = campaigns.find(c => c.id === campaignToResume);
      const targetContacts = campaign?.target_audience?.contacts || [];
      setTotalContactsCount(targetContacts.length);
      setSendingCampaignId(campaignToResume);

      // Start resuming FIRST so status changes to 'active' before dialog polls
      const resumePromise = resumeCampaign(campaignToResume, selectedInstanceId);
      
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
      toast({ title: "Erro", description: "Erro ao limpar fila de envio", variant: "destructive" });
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
      const selectedInstanceId = getSelectedCampaignInstanceId();
      console.log(`✅ Usuário confirmou envio da campanha ${campaign.id} via ${selectedInstanceId}`);
      
      // Apply dedup if enabled
      let contactsToSend = campaign.target_audience?.contacts || [];
      if (sendDialogRemoveDuplicates) {
        const seen = new Set<string>();
        const before = contactsToSend.length;
        contactsToSend = contactsToSend.filter((c: any) => {
          const key = String(c?.phone || '').replace(/@lid$/i, '').replace(/\D/g, '') || c?.phone;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const removed = before - contactsToSend.length;
        if (removed > 0) {
          toast({
            title: "Duplicados removidos",
            description: `${removed} número(s) duplicado(s) foram ignorados.`,
          });
        }
      }

      // Set up progress dialog
      setTotalContactsCount(contactsToSend.length);
      setSendingCampaignId(campaign.id);
      setShowProgressDialog(true);

      // Start sending (this will update status to 'active' internally)
      await sendCampaign(campaign.id, contactsToSend, selectedInstanceId);
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

  const contactCampaigns = isGroupsMode
    ? campaigns.filter(c => c.target_audience?.type === 'groups')
    : campaigns.filter(c => c.target_audience?.type !== 'groups');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">
          {isGroupsMode ? "Campanhas em Grupo" : "Campanhas"}
        </h1>
        <div className="flex items-center gap-2">
          {campaigns.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteAllDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Apagar todas
            </Button>
          )}
           <div className="flex items-center bg-accent/30 rounded-lg border border-border/50 px-2 py-1 mr-2">
             <label htmlFor="remove-duplicates-global" className="flex items-center gap-2 cursor-pointer">
               <div className="flex flex-col items-end mr-1">
                 <span className="text-[10px] font-semibold text-foreground leading-none">Remover</span>
                 <span className="text-[9px] text-muted-foreground leading-none">Duplicados</span>
               </div>
               <input 
                 id="remove-duplicates-global"
                 type="checkbox"
                 className="w-3.5 h-3.5 accent-primary cursor-pointer"
                 checked={removeDuplicatesGlobal}
                 onChange={(e) => setRemoveDuplicatesGlobal(e.target.checked)}
               />
             </label>
           </div>
           <Button size="sm" variant="outline" onClick={() => setShowFilterDialog(true)}>
             <Filter className="w-4 h-4 mr-1" />
             Filtrar Números
           </Button>
          <Button size="sm" onClick={() => isGroupsMode ? navigate('/campanhas-grupo/nova') : setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Nova
          </Button>
        </div>
      </div>

       <FilterNumbersDialog 
         open={showFilterDialog} 
         onOpenChange={setShowFilterDialog} 
         removeDuplicates={removeDuplicatesGlobal}
         onRemoveDuplicatesChange={setRemoveDuplicatesGlobal}
       />

      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar todas as campanhas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as {campaigns.length} campanhas e seus envios serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingAll}
              onClick={async (e) => {
                e.preventDefault();
                setDeletingAll(true);
                try {
                  for (const c of campaigns) {
                    await deleteCampaign(c.id);
                  }
                  toast({ title: "Campanhas apagadas", description: "Todas as campanhas foram removidas." });
                  setDeleteAllDialogOpen(false);
                  refetchCampaigns();
                } catch (err) {
                  toast({
                    title: "Erro ao apagar",
                    description: err instanceof Error ? err.message : "Tente novamente.",
                    variant: "destructive",
                  });
                } finally {
                  setDeletingAll(false);
                }
              }}
            >
              {deletingAll ? "Apagando..." : "Apagar todas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isGroupsMode ? (
        <CreateGroupCampaignDialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) refetchCampaigns();
          }}
        />
      ) : (
        <CreateCampaignDialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) refetchCampaigns();
          }}
        />
      )}

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
          const visibleCampaigns = contactCampaigns;
          
          if (visibleCampaigns.length === 0) {
            return (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {isGroupsMode
                      ? "Nenhuma campanha em grupo. Crie uma nova campanha!"
                      : "Nenhuma campanha de contatos. Crie uma nova campanha!"}
                  </p>
                  <Button onClick={() => isGroupsMode ? navigate('/campanhas-grupo/nova') : setShowCreateDialog(true)}>
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
                        {getStatusBadge(campaign.status, campaign)}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {campaign.schedule_type === 'scheduled' && campaign.scheduled_at
                            ? `Agendada: ${format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                            : format(new Date(campaign.created_at), "dd 'de' MMMM, yyyy", { locale: ptBR })}
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

                    {/* Botões para completed - Retomar + Forçar Parada + Duplicar */}
                    {campaign.status === 'completed' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleResumeCampaign(campaign.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Retomar de onde parou
                        </Button>
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
          <div className="py-2">
            <InstanceSelector
              useSavedSelection={false}
              onInstanceChange={(id) => {
                if (id === ROTATE_ALL) {
                  setInstanceSelectionMode('rotate');
                } else {
                  const inst = instances.find(i => i.id === id);
                  if (inst) {
                    setInstanceSelectionMode('single');
                    setZapiInstanceOverride(inst);
                  }
                }
              }}
              onMultiInstanceChange={(ids) => {
                if (ids.length > 1) {
                  const selected = instances.filter(i => ids.includes(i.id));
                  setZapiRotateMode(selected);
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-accent/30 rounded-lg border border-border/50 mt-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Remover Duplicados</p>
                <p className="text-[10px] text-muted-foreground">Filtra números repetidos antes de iniciar o envio</p>
              </div>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 accent-primary cursor-pointer"
              checked={sendDialogRemoveDuplicates}
              onChange={(e) => setSendDialogRemoveDuplicates(e.target.checked)}
            />
          </div>
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
          <div className="py-2">
            <InstanceSelector
              useSavedSelection={false}
              onInstanceChange={(id) => {
                if (id === ROTATE_ALL) {
                  setInstanceSelectionMode('rotate');
                } else {
                  const inst = instances.find(i => i.id === id);
                  if (inst) {
                    setInstanceSelectionMode('single');
                    setZapiInstanceOverride(inst);
                  }
                }
              }}
              onMultiInstanceChange={(ids) => {
                if (ids.length > 1) {
                  const selected = instances.filter(i => ids.includes(i.id));
                  setZapiRotateMode(selected);
                }
              }}
            />
          </div>
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
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Estatísticas - {statsDialogCampaignName}
              {statsDialogStats.sending > 0 && (
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
              statsDialogTargetContacts.length > 0
                ? statsDialogTargetContacts
                : (campaign?.target_audience?.contacts || []);
            const campaignCancelled = campaign?.status === 'cancelled';
            const canTreatPendingAsCancelled = campaignCancelled && !showProgressDialog;
            const getSendPriority = (status?: string | null) => {
              if (status === 'delivered') return 4;
              if (status === 'sent' || status === 'pending') return 2;
              if (isCancelledSendStatus(status)) return 1;
              return 0;
            };

            const getSendTimestamp = (send: typeof statsDialogSends[number]) =>
              send.delivered_at || send.sent_at || send.created_at || '';
            
            // Map sends by normalized phone for quick lookup
            const sendsByPhone = new Map<string, typeof statsDialogSends[0]>();
            statsDialogSends.forEach(send => {
              const phoneKey = resolvePhoneKey(send.phone);
              const existing = sendsByPhone.get(phoneKey);
              const sendPriority = getSendPriority(send.status);
              const existingPriority = getSendPriority(existing?.status);

              if (
                !existing ||
                sendPriority > existingPriority ||
                (sendPriority === existingPriority && getSendTimestamp(send) > getSendTimestamp(existing))
              ) {
                sendsByPhone.set(phoneKey, send);
              }
            });

            const targetPhoneKeys = new Set(
              targetContacts.map((contact) => resolvePhoneKey(contact.phone)).filter(Boolean)
            );

            type CampaignContactStatus = 'entregue' | 'enviando' | 'pendente' | 'cancelado';
            // Build full list: all target contacts with their latest persisted status
            const fullContactList: Array<{
              id: string;
              phone: string;
              name: string;
              status: CampaignContactStatus;
              sentAt: string | null;
              errorMessage: string | null;
              readAt: string | null;
              clickedAt: string | null;
            }> = targetContacts.map((contact, index) => {
              const phoneKey = resolvePhoneKey(contact.phone);
              const send = sendsByPhone.get(phoneKey);
              let status: CampaignContactStatus = 'pendente';
              let sentAt: string | null = null;
              let errorMessage: string | null = null;

              if (send) {
                if (send.status === 'delivered') {
                  status = 'entregue';
                  sentAt = send.delivered_at || send.sent_at || null;
                } else if (send.status === 'sent') {
                  if (canTreatPendingAsCancelled) {
                    status = 'cancelado';
                    errorMessage = send.error_message || 'Campanha cancelada antes da entrega';
                  } else {
                    status = 'enviando';
                    sentAt = send.sent_at || null;
                  }
                } else if (send.status === 'pending') {
                  if (canTreatPendingAsCancelled) {
                    status = 'cancelado';
                    errorMessage = send.error_message || 'Campanha cancelada antes da entrega';
                  } else {
                    status = 'pendente';
                    sentAt = send.sent_at || null;
                  }
                } else if (isCancelledSendStatus(send.status)) {
                  status = 'cancelado';
                  errorMessage = send.error_message || null;
                }
              }

              return {
                id: send?.id || `target-${index}`,
                phone: resolveDisplayPhone(contact.phone) || resolveDisplayPhone(send?.phone),
                name: send?.contact_name || contact.name || '',
                status,
                sentAt,
                errorMessage,
                readAt: (send as any)?.read_at || null,
                clickedAt: statsDialogClickMap.get(phoneKey) || (send as any)?.clicked_at || null,
              };
            });

            // Also add any sends that might not be in target_audience
            statsDialogSends.forEach(send => {
              const sendKey = resolvePhoneKey(send.phone);
              const existsInTarget = targetPhoneKeys.has(sendKey);

              if (!existsInTarget) {
                let status: CampaignContactStatus = 'pendente';
                if (send.status === 'delivered') status = 'entregue';
                else if (send.status === 'sent') status = canTreatPendingAsCancelled ? 'cancelado' : 'enviando';
                else if (send.status === 'pending') status = canTreatPendingAsCancelled ? 'cancelado' : 'pendente';
                else if (isCancelledSendStatus(send.status)) status = 'cancelado';
                fullContactList.push({
                  id: send.id,
                  phone: resolveDisplayPhone(send.phone),
                  name: send.contact_name || '',
                  status,
                  sentAt: send.sent_at || null,
                  errorMessage: send.error_message || null,
                  readAt: (send as any)?.read_at || null,
                  clickedAt: statsDialogClickMap.get(sendKey) || (send as any)?.clicked_at || null,
                });
              }
            });

            const deliveredCount = fullContactList.filter(c => c.status === 'entregue').length;
            const sendingCount = fullContactList.filter(c => c.status === 'enviando').length;
            const pendingCount = fullContactList.filter(c => c.status === 'pendente').length;
            const cancelledCount = fullContactList.filter(c => c.status === 'cancelado').length;
            const totalCount = fullContactList.length;
            const readCount = fullContactList.filter(c => c.readAt).length;
            const identifiedClickCount = fullContactList.filter(c => c.clickedAt).length;
            const clickedCount = Math.max(identifiedClickCount, statsDialogLinkClicks.length);

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
                    <span>{totalCount > 0 ? (((deliveredCount + cancelledCount) / totalCount) * 100).toFixed(0) : 0}%</span>
                  </div>
                  <Progress value={totalCount > 0 ? ((deliveredCount + cancelledCount) / totalCount) * 100 : 0} className="h-2" />
                </div>

                {/* Stats grid */}
                <div className={`grid grid-cols-2 ${statsDialogHasUrlButton ? 'md:grid-cols-7' : 'md:grid-cols-6'} gap-3`}>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-bold text-lg">{totalCount}</p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg text-center">
                    <p className="text-xs text-green-600 dark:text-green-400">Entregues</p>
                    <p className="font-bold text-lg text-green-600 dark:text-green-400">{deliveredCount}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Enviando</p>
                    <p className="font-bold text-lg">{sendingCount}</p>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">Pendentes</p>
                    <p className="font-bold text-lg text-yellow-600 dark:text-yellow-400">{pendingCount}</p>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg text-center">
                    <p className="text-xs text-red-600 dark:text-red-400">Canceladas</p>
                    <p className="font-bold text-lg text-red-600 dark:text-red-400">{cancelledCount}</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                    <p className="text-xs text-blue-600 dark:text-blue-400">Lidas</p>
                    <p className="font-bold text-lg text-blue-600 dark:text-blue-400">{readCount}</p>
                  </div>
                  {statsDialogHasUrlButton && (
                    <div className="p-3 bg-purple-500/10 rounded-lg text-center">
                      <p className="text-xs text-purple-600 dark:text-purple-400">Cliques</p>
                      <p className="font-bold text-lg text-purple-600 dark:text-purple-400">{clickedCount}</p>
                    </div>
                  )}
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

                {/* Export CSV */}
                <Button
                  onClick={() => {
                    const escape = (v: any) => {
                      const s = v == null ? '' : String(v);
                      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                    };
                    const headers = ['Nome', 'Telefone', 'Status', 'Lida', ...(statsDialogHasUrlButton ? ['Clique no link'] : []), 'Data', 'Erro'];
                    const rows = fullContactList.map((c) => [
                      c.name || '',
                      c.phone || '',
                      c.status,
                      c.readAt ? 'Sim' : 'Não',
                      ...(statsDialogHasUrlButton ? [c.clickedAt ? 'Sim' : 'Não'] : []),
                      c.sentAt ? format(new Date(c.sentAt), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }) : '',
                      c.errorMessage || '',
                    ]);
                    const brandingRows = [
                      ['ZapLynx - Relatório de Campanha'],
                      ['Campanha', statsDialogCampaignName || ''],
                      ['Gerado em', format(new Date(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })],
                      [],
                    ];
                    const csv = '\uFEFF' + [...brandingRows, headers, ...rows].map((r) => r.map(escape).join(';')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const safeName = (statsDialogCampaignName || 'campanha').replace(/[^a-z0-9-_]+/gi, '_');
                    a.href = url;
                    a.download = `zaplynx_relatorio_${safeName}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full"
                  variant="outline"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar relatório (CSV)
                </Button>

                {/* Table with full contact list */}
                <ScrollArea className="max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contato</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lida</TableHead>
                        {statsDialogHasUrlButton && <TableHead>Clique no link</TableHead>}
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
                              variant={contact.status === 'entregue' ? 'default' : contact.status === 'cancelado' ? 'destructive' : 'secondary'}
                              className="flex items-center gap-1 w-fit"
                            >
                              {contact.status === 'entregue' ? (
                                <><CheckCircle className="w-3 h-3" /> Entregue</>
                              ) : contact.status === 'enviando' ? (
                                <><RefreshCw className="w-3 h-3 animate-spin" /> Enviando</>
                              ) : contact.status === 'pendente' ? (
                                <><ClockIcon className="w-3 h-3" /> Pendente</>
                              ) : (
                                <><XCircle className="w-3 h-3" /> Cancelado</>
                              )}
                            </Badge>
                            {contact.errorMessage && (
                              <p className="text-xs text-destructive mt-1" title={contact.errorMessage}>
                                {formatErrorMessage(contact.errorMessage)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            {contact.readAt ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1 w-fit">
                                <CheckCircle className="w-3 h-3" /> Lida
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          {statsDialogHasUrlButton && (
                            <TableCell>
                              {contact.clickedAt ? (
                                (() => {
                                  const phoneKey = normalizePhoneKey(contact.phone);
                                  const click = statsDialogLinkClicks.find(
                                    (c: any) => normalizePhoneKey(c.phone) === phoneKey
                                  );
                                  const loc = click ? [click.city, click.region, click.country].filter(Boolean).join(', ') : '';
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1 w-fit">
                                        <CheckCircle className="w-3 h-3" /> Clicou
                                      </Badge>
                                      {click?.ip && (
                                        <span className="text-[10px] font-mono text-muted-foreground" title={loc}>
                                          {click.ip}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-muted-foreground">
                            {contact.sentAt ? format(new Date(contact.sentAt), "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {statsDialogHasUrlButton && statsDialogLinkClicks.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {statsDialogLinkClicks.length} clique(s) registrado(s). IP e localização aproximada exibidos ao lado de cada contato que clicou.
                  </p>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Campanhas;
