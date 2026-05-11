import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ZapiInstance } from './useZapiInstances';

export const useAdminWebInstances = (userId: string | undefined, currentInstances: ZapiInstance[], onUpdate: () => void) => {
  const { toast } = useToast();
  const [addingWeb, setAddingWeb] = useState(false);

  const addWebInstance = async (data: {
    instance_name: string;
    zapi_instance_id: string;
    zapi_token: string;
    zapi_client_token: string;
    is_default?: boolean;
  }) => {
    if (!userId) return false;

    try {
      setAddingWeb(true);

      // Fetch user's max_instances limit from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('max_instances')
        .eq('id', userId)
        .maybeSingle();

      const limit = Number(profile?.max_instances ?? 1);
      const webInstancesCount = currentInstances.filter(i => 
        (i.api_provider || 'zapi') === 'zapi' && 
        (i.instance_type === 'web' || !i.instance_type)
      ).length;

      if (webInstancesCount >= limit) {
        toast({ 
          title: "Limite atingido", 
          description: `Máximo de ${limit} instância(s) permitido para este usuário.`, 
          variant: "destructive" 
        });
        return false;
      }

      const normalizedName = data.instance_name.trim().toLowerCase();
      const normalizedId = (data.zapi_instance_id || '').trim().toLowerCase();
      
      const duplicated = currentInstances.find(i => {
        const nameMatch = i.instance_name.trim().toLowerCase() === normalizedName;
        const idMatch = normalizedId && i.zapi_instance_id && i.zapi_instance_id.trim().toLowerCase() === normalizedId;
        return nameMatch || idMatch;
      });

      if (duplicated) {
        toast({ 
          title: "Instância duplicada", 
          description: "Essa instância já está cadastrada.", 
          variant: "destructive" 
        });
        return false;
      }

      const isFirst = currentInstances.length === 0;
      const { error } = await supabase.from('zapi_instances').insert({
        user_id: userId,
        instance_name: data.instance_name,
        zapi_instance_id: data.zapi_instance_id,
        zapi_token: data.zapi_token,
        zapi_client_token: data.zapi_client_token,
        instance_type: 'web',
        api_provider: 'zapi',
        is_default: data.is_default || isFirst,
      });

      if (error) throw error;

      toast({ title: "✅ Instância Web adicionada" });
      onUpdate();
      return true;
    } catch (error: any) {
      console.error('Erro ao adicionar Web:', error);
      toast({ 
        title: "Erro ao adicionar Web", 
        description: error.message, 
        variant: "destructive" 
      });
      return false;
    } finally {
      setAddingWeb(false);
    }
  };

  return { addWebInstance, addingWeb };
};