import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WhatsAppGroup {
  id: string;
  nome: string;
  descricao: string;
  membros: number;
  foto: string | null;
  ultimaMensagem: string | null;
  isAdmin: boolean;
  participantes: any[];
  sourceInstanceId?: string | null;
  sourceInstanceName?: string | null;
  isCommunity?: boolean;
}

export function useWhatsAppGroups(options?: { provider?: 'uazapi' | 'zapi' }) {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-whatsapp-groups', {
        body: options?.provider ? { provider: options.provider } : {},
      });

      if (error) throw error;

      if (data?.groups) {
        setGroups(data.groups);
      }
    } catch (err: any) {
      console.error('Erro ao buscar grupos:', err);
      toast.error('Erro ao buscar grupos do WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [options?.provider]);

  return { groups, loading, refetch: fetchGroups };
}
