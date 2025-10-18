import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
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

  const sendCampaign = async (
    campaignId: string,
    contacts: Array<{ phone: string; name?: string; variables?: Record<string, string> }>
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-campaign', {
        body: {
          campaignId,
          contacts,
        },
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Campanha enviada para ${contacts.length} contatos`,
      });

      // Update campaign status
      await updateCampaign(campaignId, { status: 'active' });

      return data;
    } catch (error) {
      console.error('Error sending campaign:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getCampaignStats = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('status')
        .eq('campaign_id', campaignId);

      if (error) throw error;

      // Get total contacts from campaign
      const campaign = campaigns.find(c => c.id === campaignId);
      const totalContacts = campaign?.target_audience?.contacts?.length || 0;
      const processedCount = data.length;
      const remaining = Math.max(0, totalContacts - processedCount);

      const stats = {
        total: data.length,
        totalContacts,
        remaining,
        pending: data.filter(send => send.status === 'pending').length,
        sent: data.filter(send => send.status === 'sent').length,
        delivered: data.filter(send => send.status === 'delivered').length,
        failed: data.filter(send => send.status === 'failed').length,
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
    return await updateCampaign(id, { status: 'paused' });
  };

  const resumeCampaign = async (id: string) => {
    try {
      // Get campaign data to access contacts
      const campaign = campaigns.find(c => c.id === id);
      if (!campaign || !campaign.target_audience?.contacts) {
        throw new Error('Campaign or contacts not found');
      }

      // Get already processed contacts
      const { data: processedSends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('phone, status')
        .eq('campaign_id', id)
        .in('status', ['sent', 'delivered']);

      if (sendsError) throw sendsError;

      // Filter out already processed contacts
      const processedPhones = new Set(
        processedSends?.map(send => send.phone) || []
      );
      
      const remainingContacts = campaign.target_audience.contacts.filter(
        (contact: any) => !processedPhones.has(contact.phone)
      );

      if (remainingContacts.length === 0) {
        toast({
          title: "Aviso",
          description: "Todos os contatos já foram processados nesta campanha",
          variant: "default",
        });
        // Mark as completed
        return await updateCampaign(id, { status: 'completed' });
      }

      // Resume sending only to remaining contacts
      await sendCampaign(id, remainingContacts);
      
      toast({
        title: "Campanha Retomada",
        description: `Retomando envio para ${remainingContacts.length} contatos restantes`,
      });

      return await updateCampaign(id, { status: 'active' });
    } catch (error) {
      console.error('Error resuming campaign:', error);
      toast({
        title: "Erro",
        description: "Erro ao retomar campanha",
        variant: "destructive",
      });
      throw error;
    }
  };

  const cancelCampaign = async (id: string) => {
    return await updateCampaign(id, { status: 'cancelled' });
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