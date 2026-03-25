import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ZapiInstance {
  id: string;
  user_id: string;
  instance_name: string;
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  api_provider: 'zapi' | 'evolution';
  evolution_api_url?: string;
  evolution_api_key?: string;
}

const fromZapiInstances = () => (supabase as any).from('zapi_instances');

export const useZapiInstances = () => {
  const [instances, setInstances] = useState<ZapiInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInstance, setActiveInstance] = useState<ZapiInstance | null>(null);
  const { toast } = useToast();

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const { data, error } = await fromZapiInstances()
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const typed = (data || []) as ZapiInstance[];
      const deduped = typed.filter((instance, index, list) => {
        const duplicateIndex = list.findIndex((candidate) =>
          candidate.api_provider === instance.api_provider &&
          candidate.zapi_instance_id === instance.zapi_instance_id &&
          candidate.instance_name === instance.instance_name
        );
        return duplicateIndex === index;
      });

      setInstances(deduped);

      const defaultInst = deduped.find(i => i.is_default) || deduped[0] || null;
      setActiveInstance(defaultInst);
    } catch (error: any) {
      console.error('Erro ao buscar instâncias:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectInstance = (instanceId: string) => {
    const inst = instances.find(i => i.id === instanceId);
    if (inst) setActiveInstance(inst);
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  return {
    instances,
    activeInstance,
    selectInstance,
    loading,
    refetch: fetchInstances,
  };
};

export const useAdminZapiInstances = (userId?: string) => {
  const [instances, setInstances] = useState<ZapiInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUserInstances = async (uid: string) => {
    try {
      setLoading(true);
      const { data, error } = await fromZapiInstances()
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setInstances((data || []) as ZapiInstance[]);
    } catch (error: any) {
      console.error('Erro ao buscar instâncias do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const addInstance = async (uid: string, data: {
    instance_name: string;
    zapi_instance_id: string;
    zapi_token: string;
    zapi_client_token: string;
    is_default?: boolean;
    api_provider?: 'zapi' | 'evolution';
    evolution_api_url?: string;
    evolution_api_key?: string;
  }) => {
    try {
      if (instances.length >= 5) {
        toast({
          title: "Limite atingido",
          description: "Máximo de 5 instâncias por usuário",
          variant: "destructive"
        });
        return false;
      }

      const normalizedName = data.instance_name.trim().toLowerCase();
      const normalizedId = data.zapi_instance_id.trim().toLowerCase();
      const duplicatedInstance = instances.find((instance) => {
        const sameProvider = instance.api_provider === (data.api_provider || 'zapi');
        const sameName = instance.instance_name.trim().toLowerCase() === normalizedName;
        const sameId = instance.zapi_instance_id.trim().toLowerCase() === normalizedId;
        return sameProvider && (sameName || sameId);
      });

      if (duplicatedInstance) {
        toast({
          title: "Instância duplicada",
          description: "Essa instância já está cadastrada para este usuário.",
          variant: "destructive"
        });
        return false;
      }

      if (data.is_default) {
        await fromZapiInstances()
          .update({ is_default: false })
          .eq('user_id', uid);
      }

      const isFirst = instances.length === 0;

      const { error } = await fromZapiInstances()
        .insert({
          user_id: uid,
          instance_name: data.instance_name,
          zapi_instance_id: data.zapi_instance_id,
          zapi_token: data.zapi_token,
          zapi_client_token: data.zapi_client_token,
          is_default: data.is_default || isFirst,
          api_provider: data.api_provider || 'zapi',
          evolution_api_url: data.evolution_api_url || null,
          evolution_api_key: data.evolution_api_key || null,
        });

      if (error) throw error;

      toast({ title: "✅ Instância adicionada" });
      await fetchUserInstances(uid);
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar instância",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const updateInstance = async (instanceId: string, uid: string, updates: Partial<{
    instance_name: string;
    zapi_instance_id: string;
    zapi_token: string;
    zapi_client_token: string;
    is_default: boolean;
    is_active: boolean;
  }>) => {
    try {
      if (updates.is_default) {
        await fromZapiInstances()
          .update({ is_default: false })
          .eq('user_id', uid);
      }

      const { error } = await fromZapiInstances()
        .update(updates)
        .eq('id', instanceId);

      if (error) throw error;

      toast({ title: "✅ Instância atualizada" });
      await fetchUserInstances(uid);
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar instância",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  const deleteInstance = async (instanceId: string, uid: string) => {
    try {
      const { error } = await fromZapiInstances()
        .delete()
        .eq('id', instanceId);

      if (error) throw error;

      toast({ title: "✅ Instância removida" });
      await fetchUserInstances(uid);
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao remover instância",
        description: error.message,
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    if (userId) fetchUserInstances(userId);
  }, [userId]);

  return {
    instances,
    loading,
    fetchUserInstances,
    addInstance,
    updateInstance,
    deleteInstance,
  };
};
