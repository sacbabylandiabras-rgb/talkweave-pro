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
  isChannel?: boolean;
  isGroup?: boolean;
  typeLabel?: string;
}

export function useWhatsAppGroups(options?: { provider?: 'uazapi' | 'zapi' | 'zapi_no_warmup_meta'; source?: 'profile' }) {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const provider = options?.provider || 'zapi';
      const { data, error } = await supabase.functions.invoke('get-whatsapp-groups', {
        body: {
          provider,
          ...(options?.source ? { source: options.source, profileOnly: true } : {}),
        },
      });

      if (error) throw error;

      if (data?.groups) {
        setGroups(data.groups);
      } else {
        setGroups([]);
      }
    } catch (err: any) {
      console.error('Erro ao buscar grupos:', err);
      setGroups([]);
      toast.error('Erro ao buscar grupos do WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [options?.provider, options?.source]);

  return { groups, loading, refetch: fetchGroups };
}
