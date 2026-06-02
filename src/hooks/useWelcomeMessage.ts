import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WelcomeMessageConfig {
  id: string;
  active: boolean;
  message: string;
  response_type: 'text' | 'template' | 'flow';
  template_id: string | null;
  flow_id: string | null;
  instance_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WelcomeMessageStats {
  sent: number;
  viewed: number;
  replied: number;
}

export const useWelcomeMessage = () => {
  const [config, setConfig] = useState<WelcomeMessageConfig | null>(null);
  const [stats, setStats] = useState<WelcomeMessageStats>({ sent: 0, viewed: 0, replied: 0 });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('welcome_message_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data as unknown as WelcomeMessageConfig);
      } else {
        // Criar configuração padrão se não existir
        const { data: newConfig, error: createError } = await supabase
          .from('welcome_message_config')
          .insert({
            active: false,
            message: 'Olá! 👋 Bem-vindo à nossa empresa! Como podemos ajudá-lo hoje?'
          })
          .select()
          .single();

        if (createError) throw createError;
        setConfig(newConfig as unknown as WelcomeMessageConfig);
      }
    } catch (error) {
      console.error('Error loading welcome message config:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar configurações da mensagem de boas-vindas',
        variant: 'destructive',
      });
    }
  };

  const loadStats = async () => {
    try {
      // Buscar estatísticas dos logs
      const { data: sentData, error: sentError } = await supabase
        .from('message_logs')
        .select('id')
        .eq('keyword_matched', 'WELCOME_MESSAGE');

      if (sentError) throw sentError;

      // Por enquanto, usar dados simulados para viewed e replied
      // Em uma implementação real, você coletaria esses dados dos webhooks
      setStats({
        sent: sentData?.length || 0,
        viewed: Math.floor((sentData?.length || 0) * 0.8), // 80% visualizado
        replied: Math.floor((sentData?.length || 0) * 0.35), // 35% respondido
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const saveConfig = async (
    active: boolean,
    message: string,
    extras: {
      response_type?: 'text' | 'template' | 'flow';
      template_id?: string | null;
      flow_id?: string | null;
      instance_id?: string | null;
    } = {}
  ) => {
    setLoading(true);
    try {
      if (!config) throw new Error('Config not loaded');

      const payload: Record<string, unknown> = { active, message };
      if (extras.response_type !== undefined) payload.response_type = extras.response_type;
      if (extras.template_id !== undefined) payload.template_id = extras.template_id;
      if (extras.flow_id !== undefined) payload.flow_id = extras.flow_id;
      if (extras.instance_id !== undefined) payload.instance_id = extras.instance_id;

      const { error } = await supabase
        .from('welcome_message_config')
        .update(payload as any)
        .eq('id', config.id);

      if (error) throw error;

      setConfig(prev => prev ? { ...prev, active, message, ...extras } as WelcomeMessageConfig : null);
      
      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso!',
      });

      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configurações',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const sendWelcomeMessage = async (phone: string, contactName?: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-welcome-message', {
        body: { phone, contactName }
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Mensagem de boas-vindas enviada!',
      });

      // Recarregar estatísticas
      loadStats();

      return true;
    } catch (error) {
      console.error('Error sending welcome message:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao enviar mensagem de boas-vindas',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    loadConfig();
    loadStats();
  }, []);

  return {
    config,
    stats,
    loading,
    saveConfig,
    sendWelcomeMessage,
    refreshStats: loadStats,
  };
};