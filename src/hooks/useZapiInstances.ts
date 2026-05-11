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
    instance_type?: 'web' | 'mobile' | null;
}

const fromZapiInstances = () => (supabase as any).from('zapi_instances');
const INSTANCES_CACHE_PREFIX = 'zapi_instances_cache:';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isMobileZapiInstance = (instance: Pick<ZapiInstance, 'instance_name' | 'instance_type'>) => {
  const type = String(instance.instance_type || '').trim().toLowerCase();
  const name = String(instance.instance_name || '').trim().toLowerCase();
  return type === 'mobile' || /^mobile\b/.test(name);
};

const readCachedInstances = (userId: string): ZapiInstance[] | null => {
  try {
    const raw = localStorage.getItem(`${INSTANCES_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.instances) ? parsed.instances : null;
  } catch {
    return null;
  }
};

const writeCachedInstances = (userId: string, instances: ZapiInstance[]) => {
  try {
    const safeInstances = instances.map((instance) => ({
      ...instance,
      zapi_token: '',
      zapi_client_token: '',
      evolution_api_key: null,
    }));
    localStorage.setItem(`${INSTANCES_CACHE_PREFIX}${userId}`, JSON.stringify({ instances: safeInstances, savedAt: Date.now() }));
  } catch {
    // cache is best-effort only
  }
};

const normalizeInstances = (items: ZapiInstance[]) => {
  const dedupedMap = new Map<string, ZapiInstance>();

  for (const instance of items.filter((item) => !isMobileZapiInstance(item))) {
    const key = [instance.zapi_instance_id, instance.instance_name].join('::');
    const previous = dedupedMap.get(key);
    if (!previous) { dedupedMap.set(key, instance); continue; }
    dedupedMap.set(key, { ...instance, is_default: previous.is_default || instance.is_default });
  }

  return Array.from(dedupedMap.values()).sort((a, b) => {
    if (a.is_default === b.is_default) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return a.is_default ? -1 : 1;
  });
};

const fetchInstancesWithRetry = async (userId: string) => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await fromZapiInstances()
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (!error) return (data || []) as ZapiInstance[];
    lastError = error;

    if (error.code !== 'PGRST003') break;
    await wait(350 * (attempt + 1));
  }

  throw lastError;
};

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

      const cached = readCachedInstances(user.id);
      if (cached?.length) {
        const cachedInstances = normalizeInstances(cached);
        setInstances((current) => current.length ? current : cachedInstances);
        setActiveInstance((current) => current || cachedInstances.find(i => i.is_default) || cachedInstances[0] || null);
      }

      const allInstances = await fetchInstancesWithRetry(user.id);
      const deduped = normalizeInstances(allInstances);

      setInstances(deduped);
      setActiveInstance((current) => deduped.find(i => i.id === current?.id) || deduped.find(i => i.is_default) || deduped[0] || null);
      writeCachedInstances(user.id, deduped);
    } catch (error: any) {
      console.error('Erro ao buscar instâncias:', error);
      const { data: { user } } = await supabase.auth.getUser();
      const cached = user ? readCachedInstances(user.id) : null;
      if (cached?.length) {
        const cachedInstances = normalizeInstances(cached);
        setInstances((current) => current.length ? current : cachedInstances);
        setActiveInstance((current) => current || cachedInstances.find(i => i.is_default) || cachedInstances[0] || null);
      }
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
      setInstances(((data || []) as ZapiInstance[]).filter((item) => !isMobileZapiInstance(item)));
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
      api_provider?: 'zapi' | 'uazapi' | 'uazapi_warmup';
      evolution_api_url?: string;
      evolution_api_key?: string;
    instance_type?: 'web';
  }) => {
    try {
      // Fetch user's max_instances limit from profile
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('max_instances')
        .eq('id', uid)
        .maybeSingle();

      const normalizedName = data.instance_name.trim().toLowerCase();
      const normalizedId = (data.zapi_instance_id || '').trim().toLowerCase();
       const duplicated = instances.find(i => {
         const nameMatch = i.instance_name.trim().toLowerCase() === normalizedName;
         const idMatch = normalizedId && i.zapi_instance_id && i.zapi_instance_id.trim().toLowerCase() === normalizedId;
         return nameMatch || idMatch;
       });
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
        zapi_instance_id: data.zapi_instance_id || null,
        zapi_token: data.zapi_token || null,
        zapi_client_token: data.zapi_client_token || null,
        evolution_api_url: data.evolution_api_url || null,
        evolution_api_key: data.evolution_api_key || null,
        is_default: data.is_default || isFirst,
          api_provider: data.api_provider || 'zapi',
         instance_type: 'web',
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
       api_provider: 'zapi' | 'uazapi' | 'uazapi_warmup';
       evolution_api_url: string;
       evolution_api_key: string;
         instance_type: 'web';
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