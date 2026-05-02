import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GroupWelcomeConfig {
  id: string;
  user_id: string;
  group_id: string;
  group_name: string;
  message: string;
  response_type: 'text' | 'template' | 'flow';
  template_id: string | null;
  flow_id: string | null;
  instance_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useGroupWelcome() {
  const [configs, setConfigs] = useState<GroupWelcomeConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('group_welcome_config' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching group welcome configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (
    groupId: string,
    groupName: string,
    active: boolean,
    data: {
      message?: string;
      response_type?: 'text' | 'template' | 'flow';
      template_id?: string | null;
      flow_id?: string | null;
      instance_id?: string | null;
    },
    options: { silent?: boolean; refetch?: boolean } = {}
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const targetInstanceId = data.instance_id || null;
      const existing = configs.find((config) => config.group_id === groupId);

      if (existing) {
        const updateData: any = { active, ...data, instance_id: targetInstanceId };
        const { error } = await supabase
          .from('group_welcome_config' as any)
          .update(updateData)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('group_welcome_config' as any)
          .insert({
            user_id: user.id,
            group_id: groupId,
            group_name: groupName,
            message: data.message || 'Olá {{nome}}! 👋 Bem-vindo ao grupo!',
            response_type: data.response_type || 'text',
            template_id: data.template_id || null,
            flow_id: data.flow_id || null,
            instance_id: targetInstanceId,
            active,
          });
        if (error) throw error;
      }

      if (options.refetch !== false) {
        await fetchConfigs();
      }
      if (!options.silent) {
        toast.success(active ? 'Configuração de boas-vindas salva!' : 'Boas-vindas desativada!');
      }
    } catch (err) {
      console.error('Error saving group welcome:', err);
      if (!options.silent) {
        toast.error('Erro ao salvar configuração');
      }
      throw err;
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  return { configs, loading, saveConfig, refetch: fetchConfigs };
}
