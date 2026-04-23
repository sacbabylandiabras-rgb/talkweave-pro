import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getSelectedCampaignInstanceId } from '@/hooks/useZapi';
import type { MessageTemplate } from './useMessageTemplates';

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  template_id?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  target_audience: Record<string, any>;
  schedule_type: 'immediate' | 'scheduled' | 'recurring';
  scheduled_at?: string;
  recurrence_pattern?: string;
  delay_seconds?: number;
  created_at: string;
  updated_at: string;
  template?: MessageTemplate;
}

export interface CampaignSend {
  id: string;
  campaign_id: string;
  phone: string;
  contact_name?: string;
  message_content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  error_message?: string;
  created_at: string;
}

const normalizeCampaignPhone = (phone?: string | null) => {
  if (!phone) return '';
  return phone.replace(/@lid$/i, '').replace(/\D/g, '');
};

const getCampaignSendPriority = (status?: string | null) => {
  if (status === 'delivered') return 3;
  if (status === 'sent') return 2;
  if (status === 'failed') return 1;
  return 0;
};

export const useCampaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          template:message_templates(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns((data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || undefined,
        template_id: item.template_id || undefined,
        status: (item.status as Campaign['status']) || 'draft',
        target_audience: (typeof item.target_audience === 'object' && item.target_audience !== null) 
          ? item.target_audience as Record<string, any>
          : {},
        schedule_type: (item.schedule_type as Campaign['schedule_type']) || 'immediate',
        scheduled_at: item.scheduled_at || undefined,
        recurrence_pattern: item.recurrence_pattern || undefined,
        created_at: item.created_at,
        updated_at: item.updated_at,
        template: item.template ? {
          id: item.template.id,
          name: item.template.name,
          category: item.template.category,
          content: item.template.content,
          variables: Array.isArray(item.template.variables) ? item.template.variables.filter(v => typeof v === 'string') : [],
          usage_count: item.template.usage_count || 0,
          active: item.template.active || false,
          created_at: item.template.created_at,
          updated_at: item.template.updated_at,
        } : undefined
      })));
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar campanhas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async (campaignData: {
    name: string;
    description?: string;
    template_id?: string;
    target_audience?: Record<string, any>;
    schedule_type?: 'immediate' | 'scheduled' | 'recurring';
    scheduled_at?: string;
    recurrence_pattern?: string;
    delay_seconds?: number;
  }) => {
    try {
      // Obter o user_id do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          user_id: user.id, // CRÍTICO: Incluir user_id para RLS
          name: campaignData.name,
          description: campaignData.description,
          template_id: campaignData.template_id,
          target_audience: campaignData.target_audience || {},
          schedule_type: campaignData.schedule_type || 'immediate',
          scheduled_at: campaignData.scheduled_at,
          recurrence_pattern: campaignData.recurrence_pattern,
          delay_seconds: campaignData.delay_seconds || 2,
        })
        .select(`
          *,
          template:message_templates(*)
        `)
        .single();

      if (error) throw error;

      setCampaigns(prev => [{
        id: data.id,
        name: data.name,
        description: data.description || undefined,
        template_id: data.template_id || undefined,
        status: (data.status as Campaign['status']) || 'draft',
        target_audience: (typeof data.target_audience === 'object' && data.target_audience !== null) 
          ? data.target_audience as Record<string, any>
          : {},
        schedule_type: (data.schedule_type as Campaign['schedule_type']) || 'immediate',
        scheduled_at: data.scheduled_at || undefined,
        recurrence_pattern: data.recurrence_pattern || undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
        template: data.template ? {
          id: data.template.id,
          name: data.template.name,
          category: data.template.category,
          content: data.template.content,
          variables: Array.isArray(data.template.variables) ? data.template.variables.filter(v => typeof v === 'string') : [],
          usage_count: data.template.usage_count || 0,
          active: data.template.active || false,
          created_at: data.template.created_at,
          updated_at: data.template.updated_at,
        } : undefined
      }, ...prev]);
      toast({
        title: "Sucesso",
        description: "Campanha criada com sucesso",
      });
      
      return data;
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          template:message_templates(*)
        `)
        .single();

      if (error) throw error;

      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === id ? { 
            id: data.id || campaign.id,
            name: data.name || campaign.name,
            description: data.description !== undefined ? data.description : campaign.description,
            template_id: data.template_id !== undefined ? data.template_id : campaign.template_id,
            status: (data.status as Campaign['status']) || campaign.status,
            target_audience: (typeof data.target_audience === 'object' && data.target_audience !== null) 
              ? data.target_audience as Record<string, any>
              : campaign.target_audience,
            schedule_type: (data.schedule_type as Campaign['schedule_type']) || campaign.schedule_type,
            scheduled_at: data.scheduled_at !== undefined ? data.scheduled_at : campaign.scheduled_at,
            recurrence_pattern: data.recurrence_pattern !== undefined ? data.recurrence_pattern : campaign.recurrence_pattern,
            created_at: data.created_at || campaign.created_at,
            updated_at: data.updated_at || campaign.updated_at,
            template: data.template ? {
              id: data.template.id,
              name: data.template.name,
              category: data.template.category,
              content: data.template.content,
              variables: Array.isArray(data.template.variables) ? data.template.variables.filter(v => typeof v === 'string') : [],
              usage_count: data.template.usage_count || 0,
              active: data.template.active || false,
              created_at: data.template.created_at,
              updated_at: data.template.updated_at,
            } : campaign.template
          } : campaign
        )
      );

      toast({
        title: "Sucesso",
        description: "Campanha atualizada com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCampaigns(prev => prev.filter(campaign => campaign.id !== id));
      toast({
        title: "Sucesso",
        description: "Campanha removida com sucesso",
      });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getQueueClearPayload = (campaign?: Campaign) => {
    const sendConfig = campaign?.target_audience?.__sendConfig;

    if (sendConfig?.rotateAll) {
      return { clearAllActive: true };
    }

    if (sendConfig?.instanceId && sendConfig.instanceId !== '__rotate_all__') {
      return { instanceId: sendConfig.instanceId };
    }

    // Fallback seguro para campanhas antigas ou envios sem metadata persistida:
    // limpa todas as filas ativas para evitar disparos fantasmas na instância errada.
    return { clearAllActive: true };
  };

  const sendCampaign = async (
    campaignId: string,
    contacts: Array<{ phone: string; name?: string; variables?: Record<string, string> }>,
    instanceId?: string
  ) => {
    try {
      const currentCampaign = campaigns.find(campaign => campaign.id === campaignId);
      const sendConfig = {
        instanceId: instanceId && instanceId !== '__rotate_all__' ? instanceId : null,
        rotateAll: instanceId === '__rotate_all__',
      };

      // Persist send mode before invoking edge function so pause/cancel can clear the right queues
      await updateCampaign(campaignId, {
        status: 'active',
        target_audience: {
          ...(currentCampaign?.target_audience || {}),
          __sendConfig: sendConfig,
        },
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        // Rollback status
        await supabase.from('campaigns').update({ status: 'draft' }).eq('id', campaignId);
        throw new Error('Usuário não autenticado');
      }

      console.log(`📤 Invoking send-campaign Edge Function for campaign ${campaignId} with ${contacts.length} contacts`);

      const { data, error } = await supabase.functions.invoke('send-campaign', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          campaignId,
          contacts,
          instanceId,
        },
      });

      if (error) {
        console.error('❌ Edge Function send-campaign error:', error);
        let errorMessage = 'Erro ao enviar campanha';
        try {
          if (error instanceof Object && 'context' in error) {
            const ctx = (error as any).context;
            if (ctx?.body) {
              const bodyText = await new Response(ctx.body).text();
              const parsed = JSON.parse(bodyText);
              errorMessage = parsed?.error || parsed?.message || errorMessage;
            }
          }
        } catch {}
        console.error('❌ Detailed error:', errorMessage);

        // Check if messages were already sent before rolling back
        const { count: sentCount } = await supabase
          .from('campaign_sends')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .in('status', ['sent', 'delivered']);

        if ((sentCount ?? 0) > 0) {
          // Messages were already sent — pause instead of reverting to draft
          console.log(`⚠️ Campaign has ${sentCount} sent messages, pausing instead of reverting to draft`);
          await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
          setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'paused' } : c));
          toast({
            title: "Campanha pausada",
            description: `${sentCount} mensagem(ns) já enviada(s). A campanha foi pausada para que você possa retomá-la.`,
          });
          return;
        }

        // No messages sent — safe to rollback to draft
        await supabase.from('campaigns').update({ status: 'draft' }).eq('id', campaignId);
        setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'draft' } : c));
        throw new Error(errorMessage);
      }

      // Check if the response indicates an error
      if (data && typeof data === 'object' && data.error) {
        console.error('❌ Edge Function returned error in response:', data.error);

        const { count: sentCount } = await supabase
          .from('campaign_sends')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .in('status', ['sent', 'delivered']);

        if ((sentCount ?? 0) > 0) {
          console.log(`⚠️ Campaign has ${sentCount} sent messages, pausing instead of reverting to draft`);
          await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
          setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'paused' } : c));
          toast({
            title: "Campanha pausada",
            description: `${sentCount} mensagem(ns) já enviada(s). A campanha foi pausada para que você possa retomá-la.`,
          });
          return;
        }

        await supabase.from('campaigns').update({ status: 'draft' }).eq('id', campaignId);
        setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'draft' } : c));
        throw new Error(data.error);
      }

      console.log('✅ send-campaign invoked successfully:', data);

      if (data && typeof data === 'object' && 'stopped' in data && data.stopped) {
        await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
        setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'paused' } : c));
        throw new Error((data as { error?: string; message?: string }).error || (data as { message?: string }).message || 'Campanha pausada');
      }

      const batchResults = data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
        ? (data as { results: Array<{ success?: boolean }> }).results
        : [];
      const sentCount = batchResults.filter(result => result?.success).length;
      const failedCount = batchResults.filter(result => result?.success === false).length;
      const hasRemaining = Boolean(data && typeof data === 'object' && Number((data as { remaining?: number }).remaining || 0) > 0);

      if (failedCount > 0) {
        toast({
          title: sentCount > 0 ? "Atenção" : "Erro",
          description: sentCount > 0
            ? `Campanha iniciada com ${sentCount} envio(s) e ${failedCount} falha(s) neste lote`
            : "Nenhuma mensagem foi enviada neste lote",
          variant: sentCount > 0 ? undefined : "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: hasRemaining
            ? `Campanha iniciada para ${contacts.length} contatos`
            : `Lote enviado com sucesso para ${sentCount || contacts.length} contato(s)`,
        });
      }

      return data;
    } catch (error) {
      console.error('Error sending campaign:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getCampaignStats = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('phone, status')
        .eq('campaign_id', campaignId);

      if (error) throw error;

      // Get total contacts from campaign
      const campaign = campaigns.find(c => c.id === campaignId);
      const totalContacts = campaign?.target_audience?.contacts?.length || 0;
      const latestByPhone = new Map<string, typeof data[number]>();
      data.forEach((send) => {
        const phoneKey = normalizeCampaignPhone(send.phone) || send.phone;
        const existing = latestByPhone.get(phoneKey);
        const nextPriority = getCampaignSendPriority(send.status);
        const currentPriority = getCampaignSendPriority(existing?.status);

        if (!existing || nextPriority >= currentPriority) {
          latestByPhone.set(phoneKey, send);
        }
      });

      const latestSends = Array.from(latestByPhone.values());
      const pendingCount = latestSends.filter(send => send.status === 'pending').length;
      const finalizedCount = latestSends.filter(send => send.status === 'sent' || send.status === 'delivered' || send.status === 'failed').length;
      const remaining = Math.max(0, totalContacts - finalizedCount);

      const stats = {
        total: latestSends.length,
        totalContacts,
        remaining,
        pending: pendingCount,
        sent: latestSends.filter(send => send.status === 'sent').length,
        delivered: latestSends.filter(send => send.status === 'delivered').length,
        failed: latestSends.filter(send => send.status === 'failed').length,
      };

      return stats;
    } catch (error) {
      console.error('Error getting campaign stats:', error);
      return {
        total: 0,
        totalContacts: 0,
        remaining: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
      };
    }
  };

  const pauseCampaign = async (id: string) => {
    const campaign = campaigns.find(c => c.id === id);

    // 1. Update status to paused immediately
    const result = await updateCampaign(id, { status: 'paused' });
    
    // 2. Clear Z-API queue(s) to stop any messages already queued
    try {
      console.log('🧹 Clearing Z-API queue after pause...');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (token) {
        await supabase.functions.invoke('clear-zapi-queue', {
          headers: { Authorization: `Bearer ${token}` },
          body: getQueueClearPayload(campaign),
        });
        console.log('✅ Z-API queue cleared after pause');
      }
    } catch (err) {
      console.error('Error clearing Z-API queue on pause:', err);
    }
    
    return result;
  };

  const resumeCampaign = async (id: string) => {
    try {
      const campaign = campaigns.find(c => c.id === id);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const storedSendConfig = campaign.target_audience?.__sendConfig;
      const resumeInstanceId = storedSendConfig?.rotateAll
        ? '__rotate_all__'
        : (storedSendConfig?.instanceId || getSelectedCampaignInstanceId());

      console.log('=== RESUMING CAMPAIGN ===');
      console.log('Campaign ID:', id);

      // Get ALL campaign sends from database
      const { data: allSends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('phone, status, contact_name')
        .eq('campaign_id', id);

      if (sendsError) throw sendsError;

      console.log('All sends in database:', allSends?.length);

      const latestByPhone = new Map<string, { phone: string; status: string | null; contact_name?: string | null }>();

      for (const send of (allSends || [])) {
        const phoneKey = normalizeCampaignPhone(send.phone) || send.phone;
        const existing = latestByPhone.get(phoneKey);
        const nextPriority = getCampaignSendPriority(send.status);
        const currentPriority = getCampaignSendPriority(existing?.status);

        if (!existing || nextPriority >= currentPriority) {
          latestByPhone.set(phoneKey, send);
        }
      }

      // Build sets of phones already successfully sent
      const successfulPhones = new Set<string>();
      const failedOrPendingPhones: Array<{ phone: string; name?: string }> = [];

      for (const [phoneKey, send] of latestByPhone.entries()) {
        if (send.status === 'sent' || send.status === 'delivered') {
          successfulPhones.add(phoneKey);
        } else if (send.status === 'failed' || send.status === 'pending') {
          failedOrPendingPhones.push({
            phone: send.phone,
            name: send.contact_name || undefined,
          });
        }
      }

      console.log('Successfully sent phones:', successfulPhones.size);
      console.log('Failed/pending phones:', failedOrPendingPhones.length);

      // Get all target contacts from campaign
      const targetContacts: Array<{ phone: string; name?: string }> = 
        (campaign.target_audience?.contacts || []).map((c: any) => ({
          phone: c.phone,
          name: c.name,
        }));

      console.log('Total target contacts:', targetContacts.length);

      // Find contacts that were never processed (not in campaign_sends at all)
      const allProcessedPhones = new Set(Array.from(latestByPhone.keys()));
      const neverProcessedContacts = targetContacts.filter(
        c => !allProcessedPhones.has(normalizeCampaignPhone(c.phone) || c.phone)
      );

      // Combine: retry failed/pending + send never-processed, sem reintroduzir contatos já enviados
      const remainingContactsMap = new Map<string, { phone: string; name?: string }>();

      [...failedOrPendingPhones, ...neverProcessedContacts].forEach((contact) => {
        const phoneKey = normalizeCampaignPhone(contact.phone) || contact.phone;
        if (!phoneKey || successfulPhones.has(phoneKey)) return;
        if (!remainingContactsMap.has(phoneKey)) {
          remainingContactsMap.set(phoneKey, contact);
        }
      });

      const remainingContacts = Array.from(remainingContactsMap.values());

      console.log('Never processed:', neverProcessedContacts.length);
      console.log('Failed to retry:', failedOrPendingPhones.length);
      console.log('Total remaining to send:', remainingContacts.length);
      console.log('=== END RESUME INFO ===');

      if (remainingContacts.length === 0) {
        toast({
          title: "Campanha Finalizada",
          description: "Todos os contatos já foram processados com sucesso. Verifique em Relatórios.",
          variant: "default",
        });
        await updateCampaign(id, { status: 'completed' });
        return;
      }

      toast({
        title: "Retomando Campanha",
        description: `Enviando para ${remainingContacts.length} contato(s) restante(s)`,
      });

      // Update status to active and preserve original send mode
      await updateCampaign(id, {
        status: 'active',
        target_audience: {
          ...(campaign.target_audience || {}),
          __sendConfig: {
            instanceId: resumeInstanceId && resumeInstanceId !== '__rotate_all__' ? resumeInstanceId : null,
            rotateAll: resumeInstanceId === '__rotate_all__',
          },
        },
      });
      
      console.log(`🔄 Retomando campanha ${id} com ${remainingContacts.length} contatos restantes`);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        await supabase.from('campaigns').update({ status: 'paused' }).eq('id', id);
        throw new Error('Usuário não autenticado');
      }

      console.log(`📤 Invoking send-campaign for resume of campaign ${id}`);

      // Send to remaining contacts
      const { data, error } = await supabase.functions.invoke('send-campaign', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          campaignId: id,
          contacts: remainingContacts,
          instanceId: resumeInstanceId,
        },
      });

      if (error) {
        console.error('❌ Erro ao invocar edge function:', error);
        let errorMessage = 'Erro ao retomar campanha';
        try {
          if (error instanceof Object && 'context' in error) {
            const ctx = (error as any).context;
            if (ctx?.body) {
              const bodyText = await new Response(ctx.body).text();
              const parsed = JSON.parse(bodyText);
              errorMessage = parsed?.error || parsed?.message || errorMessage;
            }
          }
        } catch {}
        // Rollback to paused
        await supabase.from('campaigns').update({ status: 'paused' }).eq('id', id);
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'paused' } : c));
        throw new Error(errorMessage);
      }

      if (data && typeof data === 'object' && data.error) {
        console.error('❌ Edge Function returned error:', data.error);
        await supabase.from('campaigns').update({ status: 'paused' }).eq('id', id);
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'paused' } : c));
        throw new Error(data.error);
      }

      console.log('✅ Edge function invocada com sucesso:', data);
      return data;
    } catch (error) {
      console.error('Error resuming campaign:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao retomar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const cancelCampaign = async (id: string) => {
    const campaign = campaigns.find(c => c.id === id);
    const result = await updateCampaign(id, { status: 'cancelled' });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (token) {
        await supabase.functions.invoke('clear-zapi-queue', {
          headers: { Authorization: `Bearer ${token}` },
          body: getQueueClearPayload(campaign),
        });
      }
    } catch (err) {
      console.error('Error clearing Z-API queue on cancel:', err);
    }

    return result;
  };

  const duplicateCampaign = async (campaign: Campaign) => {
    try {
      const newCampaign = {
        name: `${campaign.name} (Cópia)`,
        description: campaign.description,
        template_id: campaign.template_id,
        target_audience: campaign.target_audience,
        schedule_type: campaign.schedule_type,
        recurrence_pattern: campaign.recurrence_pattern,
      };

      return await createCampaign(newCampaign);
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadCampaigns();

    const channel = supabase
      .channel('campaigns-local-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setCampaigns(prev => prev.filter(campaign => campaign.id !== payload.old.id));
            return;
          }

          const record = payload.new as Record<string, any>;
          const mappedCampaign: Campaign = {
            id: record.id,
            name: record.name,
            description: record.description || undefined,
            template_id: record.template_id || undefined,
            status: (record.status as Campaign['status']) || 'draft',
            target_audience: (typeof record.target_audience === 'object' && record.target_audience !== null)
              ? record.target_audience as Record<string, any>
              : {},
            schedule_type: (record.schedule_type as Campaign['schedule_type']) || 'immediate',
            scheduled_at: record.scheduled_at || undefined,
            recurrence_pattern: record.recurrence_pattern || undefined,
            delay_seconds: record.delay_seconds || undefined,
            created_at: record.created_at,
            updated_at: record.updated_at,
          };

          setCampaigns(prev => {
            const exists = prev.some(campaign => campaign.id === mappedCampaign.id);

            if (payload.eventType === 'INSERT') {
              return exists ? prev : [mappedCampaign, ...prev];
            }

            return exists
              ? prev.map(campaign => campaign.id === mappedCampaign.id ? { ...campaign, ...mappedCampaign } : campaign)
              : [mappedCampaign, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    campaigns,
    loading,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    sendCampaign,
    getCampaignStats,
    pauseCampaign,
    resumeCampaign,
    cancelCampaign,
    duplicateCampaign,
    refetch: loadCampaigns,
  };
};