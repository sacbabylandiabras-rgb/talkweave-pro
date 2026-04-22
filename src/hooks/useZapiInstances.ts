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
  api_provider: string;
  evolution_api_url?: string | null;
  evolution_api_key?: string | null;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await fromZapiInstances()
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const typed = (data || []) as ZapiInstance[];
      const dedupedMap = new Map<string, ZapiInstance>();

      for (const instance of typed) {
        const key = [instance.zapi_instance_id, instance.instance_name].join('::');
        const previous = dedupedMap.get(key);
        if (!previous) { dedupedMap.set(key, instance); continue; }
        dedupedMap.set(key, { ...instance, is_default: previous.is_default || instance.is_default });
      }

      const deduped = Array.from(dedupedMap.values()).sort((a, b) => {
        if (a.is_default === b.is_default) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return a.is_default ? -1 : 1;
      });

      setInstances(deduped);
      setActiveInstance(deduped.find(i => i.is_default) || deduped[0] || null);
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

  useEffect(() => { fetchInstances(); }, []);

  return { instances, activeInstance, selectInstance, loading, refetch: fetchInstances };
};

export const useAdminZapiInstances = (userId?: string) => {
  const [instances, setInstances] = useState<ZapiInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUserInstances = async (uid: string) => {
    try {
      setLoading(true);
      const { data, error } = await fromZapiInstances().select('*').eq('user_id', uid).order('created_at', { ascending: true });
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
    api_provider?: 'zapi' | 'uazapi';
    evolution_api_url?: string | null;
    evolution_api_key?: string | null;
  }) => {
    try {
      if (instances.length >= 20) {
        toast({ title: "Limite atingido", description: "Máximo de 20 instâncias por usuário", variant: "destructive" });
        return false;
      }

      const normalizedName = data.instance_name.trim().toLowerCase();
      const normalizedId = data.zapi_instance_id.trim().toLowerCase();
      const duplicated = instances.find(i => i.instance_name.trim().toLowerCase() === normalizedName || i.zapi_instance_id.trim().toLowerCase() === normalizedId);
      if (duplicated) {
        toast({ title: "Instância duplicada", description: "Essa instância já está cadastrada.", variant: "destructive" });
        return false;
      }

      if (data.is_default) {
        await fromZapiInstances().update({ is_default: false }).eq('user_id', uid);
      }

      const isFirst = instances.length === 0;
      const { error } = await fromZapiInstances().insert({
        user_id: uid,
        instance_name: data.instance_name,
        zapi_instance_id: data.zapi_instance_id,
        zapi_token: data.zapi_token,
        zapi_client_token: data.zapi_client_token,
        is_default: data.is_default || isFirst,
        api_provider: data.api_provider || 'zapi',
        evolution_api_url: data.evolution_api_url ?? null,
        evolution_api_key: data.evolution_api_key ?? null,
      });

      if (error) throw error;
      toast({ title: "✅ Instância adicionada" });
      await fetchUserInstances(uid);
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao adicionar instância", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const updateInstance = async (instanceId: string, uid: string, updates: Partial<{
    instance_name: string; zapi_instance_id: string; zapi_token: string; zapi_client_token: string; is_default: boolean; is_active: boolean;
    api_provider: 'zapi' | 'uazapi'; evolution_api_url: string | null; evolution_api_key: string | null;
  }>) => {
    try {
      if (updates.is_default) { await fromZapiInstances().update({ is_default: false }).eq('user_id', uid); }
      const { error } = await fromZapiInstances().update(updates).eq('id', instanceId);
      if (error) throw error;
      toast({ title: "✅ Instância atualizada" });
      await fetchUserInstances(uid);
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao atualizar instância", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const deleteInstance = async (instanceId: string, uid: string) => {
    try {
      const { data, error } = await fromZapiInstances().delete().eq('id', instanceId).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        const { error: fnError } = await supabase.functions.invoke('cleanup-orphan-data', { body: { action: 'delete-instance', instanceId } });
        if (fnError) throw new Error('Falha ao remover instância: permissão negada');
      }
      toast({ title: "✅ Instância removida" });
      await fetchUserInstances(uid);
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao remover instância", description: error.message, variant: "destructive" });
      return false;
    }
  };

  useEffect(() => { if (userId) fetchUserInstances(userId); }, [userId]);

  return { instances, loading, fetchUserInstances, addInstance, updateInstance, deleteInstance };
};