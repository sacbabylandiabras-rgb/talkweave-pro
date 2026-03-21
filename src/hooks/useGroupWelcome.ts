import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GroupWelcomeConfig {
  id: string;
  user_id: string;
  group_id: string;
  group_name: string;
  message: string;
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

  const toggleConfig = async (groupId: string, groupName: string, active: boolean, message?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const existing = configs.find(c => c.group_id === groupId);

      if (existing) {
        const updateData: any = { active };
        if (message !== undefined) updateData.message = message;

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
            message: message || 'Olá {{nome}}! 👋 Bem-vindo ao grupo!',
            active,
          });

        if (error) throw error;
      }

      await fetchConfigs();
      toast.success(active ? 'Mensagem de boas-vindas ativada!' : 'Mensagem de boas-vindas desativada!');
    } catch (err) {
      console.error('Error toggling group welcome:', err);
      toast.error('Erro ao salvar configuração');
    }
  };

  const updateMessage = async (groupId: string, message: string) => {
    try {
      const existing = configs.find(c => c.group_id === groupId);
      if (!existing) return;

      const { error } = await supabase
        .from('group_welcome_config' as any)
        .update({ message })
        .eq('id', existing.id);

      if (error) throw error;
      await fetchConfigs();
      toast.success('Mensagem atualizada!');
    } catch (err) {
      console.error('Error updating message:', err);
      toast.error('Erro ao atualizar mensagem');
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  return { configs, loading, toggleConfig, updateMessage, refetch: fetchConfigs };
}
