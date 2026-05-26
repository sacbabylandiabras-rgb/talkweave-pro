import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Contact {
  phone: string;
  name?: string;
  lastMessage?: string;
  lastMessageDate?: string;
  status: 'ativo' | 'inativo' | 'bloqueado';
  messageCount: number;
  firstContactDate?: string;
  tags: string[];
  notes?: {
    id: string;
    content: string;
    createdAt: number;
    lastUpdateAt: number;
  };
  profilePictureUrl?: string;
  lastUpdated?: string;
  agent_stage?: string;
}

export interface ContactStats {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
}

export const useContacts = (options?: { enabled?: boolean }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats>({
    total: 0,
    active: 0,
    inactive: 0,
    blocked: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const fetchedPhotosRef = useRef(new Set<string>());
  const inFlightPhotosRef = useRef(new Set<string>());
  const enabled = options?.enabled ?? true;

  const extractProfilePictureUrl = (payload: any): string | null => {
    if (!payload) return null;
    if (typeof payload === 'string') {
      const str = payload.trim();
      if (!str || str.toLowerCase() === 'null' || !/^https?:\/\//i.test(str)) return null;
      return str;
    }
    if (Array.isArray(payload)) return extractProfilePictureUrl(payload[0]);
    const rawUrl = payload?.link || payload?.imgUrl || payload?.profilePictureUrl || payload?.imageUrl || payload?.data?.link || payload?.profileThumbnail || payload?.imagePreview || payload?.profilePicUrl || payload?.profilePicture || payload?.picture || payload?.image || payload?.photo || payload?.preview || payload?.pictureUrl;
    return extractProfilePictureUrl(rawUrl);
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      
      // Buscar todos os logs de mensagens para obter contatos únicos
      const { data: messageLogs, error: messageError } = await supabase
        .from('message_logs')
        .select('phone, message_received, created_at, keyword_matched')
        .order('created_at', { ascending: false });

      if (messageError) {
        throw messageError;
      }

      // Buscar contatos que receberam campanhas
      const { data: campaignSends, error: campaignError } = await supabase
        .from('campaign_sends')
        .select('phone, contact_name, created_at, status')
        .order('created_at', { ascending: false });

      if (campaignError) {
        throw campaignError;
      }

      // Processar contatos únicos (excluir grupos)
      const contactMap = new Map<string, Contact>();
      const isGroup = (phone: string) => phone.includes('-group') || phone.includes('@g.us');
      
      // Processar logs de mensagens recebidas (sem grupos)
      messageLogs?.filter(log => !isGroup(log.phone)).forEach(log => {
        if (!contactMap.has(log.phone)) {
          contactMap.set(log.phone, {
            phone: log.phone,
            name: extractNameFromPhone(log.phone),
            lastMessage: log.message_received,
            lastMessageDate: log.created_at,
            status: determineStatus(log.created_at),
            messageCount: 1,
            firstContactDate: log.created_at,
            tags: determingTags(log.keyword_matched)
          });
        } else {
          const contact = contactMap.get(log.phone)!;
          contact.messageCount++;
          
          // Atualizar última mensagem se for mais recente
          if (new Date(log.created_at) > new Date(contact.lastMessageDate || '')) {
            contact.lastMessage = log.message_received;
            contact.lastMessageDate = log.created_at;
          }
          
          // Atualizar primeira data de contato se for mais antiga
          if (new Date(log.created_at) < new Date(contact.firstContactDate || '')) {
            contact.firstContactDate = log.created_at;
          }
        }
      });

      // Processar envios de campanha (sem grupos)
      campaignSends?.filter(send => !isGroup(send.phone)).forEach(send => {
        if (!contactMap.has(send.phone)) {
          contactMap.set(send.phone, {
            phone: send.phone,
            name: send.contact_name || extractNameFromPhone(send.phone),
            lastMessage: 'Recebeu campanha',
            lastMessageDate: send.created_at,
            status: determineStatus(send.created_at),
            messageCount: 0,
            firstContactDate: send.created_at,
            tags: ['Campanha']
          });
        } else {
          const contact = contactMap.get(send.phone)!;
          if (send.contact_name && !contact.name?.includes('Contato')) {
            contact.name = send.contact_name;
          }
          
          // Adicionar tag de campanha se não existir
          if (!contact.tags.includes('Campanha')) {
            contact.tags.push('Campanha');
          }
        }
      });

      // Buscar contatos salvos para fotos de perfil e nomes
      const { data: savedContacts } = await supabase
        .from('saved_contacts')
        .select('phone, name, profile_picture_url, updated_at, agent_stage');

      // Mesclar dados dos contatos salvos
      if (savedContacts) {
        savedContacts.forEach(sc => {
          const existing = contactMap.get(sc.phone);
          if (existing) {
           if (sc.profile_picture_url) existing.profilePictureUrl = sc.profile_picture_url;
            if (sc.name) existing.name = sc.name;
            if (sc.updated_at) existing.lastUpdated = sc.updated_at;
            if (sc.agent_stage) existing.agent_stage = sc.agent_stage;
          }
        });
      }

      const contactsList = Array.from(contactMap.values());
      
      // Calcuar estatísticas
      const newStats = {
        total: contactsList.length,
        active: contactsList.filter(c => c.status === 'ativo').length,
        inactive: contactsList.filter(c => c.status === 'inativo').length,
        blocked: contactsList.filter(c => c.status === 'bloqueado').length
      };

      setContacts(contactsList);
      setStats(newStats);
      
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar contatos. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const autoFetchProfilePictures = async (contactsList: Contact[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const now = new Date();
    const toFetch = contactsList.filter(c => {
      if (fetchedPhotosRef.current.has(c.phone) || inFlightPhotosRef.current.has(c.phone)) return false;
      if (c.phone.includes('@lid')) return false;
      
      if (!c.profilePictureUrl) return true;
      
      if (c.lastUpdated) {
        const lastUpdate = new Date(c.lastUpdated);
        const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate > 24;
      }
      
      return false;
    }).slice(0, 20);

    if (toFetch.length === 0) return;

    toFetch.forEach(c => inFlightPhotosRef.current.add(c.phone));

    let updated = false;
    const CHUNK_SIZE = 3;
    for (let i = 0; i < toFetch.length; i += CHUNK_SIZE) {
      const chunk = toFetch.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (contact) => {
        try {
          const { data, error } = await supabase.functions.invoke('get-profile-picture', { body: { phone: contact.phone } });
          if (!error) {
            const url = extractProfilePictureUrl(data?.data ?? data);
            if (url) {
              contact.profilePictureUrl = url;
              updated = true;
              await supabase.from('saved_contacts').upsert(
                { phone: contact.phone, name: contact.name || '', user_id: session.user.id, profile_picture_url: url },
                { onConflict: 'phone,user_id' }
              );
            }
          }
          fetchedPhotosRef.current.add(contact.phone);
        } catch { /* ignore */ } finally {
          inFlightPhotosRef.current.delete(contact.phone);
        }
      }));
    }
    
    if (updated) {
      setContacts([...contactsList]);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    fetchContacts();
  }, [enabled]);

  // Auto-fetch profile pictures after contacts load
  useEffect(() => {
    if (enabled && !loading && contacts.length > 0) {
      const timer = setTimeout(() => {
        autoFetchProfilePictures(contacts);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [enabled, loading, contacts.length]);


  const refreshProfilePicture = async (phone: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    try {
      const { data, error } = await supabase.functions.invoke('get-profile-picture', { body: { phone } });
      if (error) return null;
      const url = extractProfilePictureUrl(data?.data ?? data);
      if (url) {
        // Update local state
        setContacts(prev => prev.map(c => c.phone === phone ? { ...c, profilePictureUrl: url, lastUpdated: new Date().toISOString() } : c));
        
        // Save to DB
        await supabase.from('saved_contacts').upsert(
          { phone, user_id: session.user.id, profile_picture_url: url },
          { onConflict: 'phone,user_id' }
        );
        return url;
      }
    } catch { /* ignore */ }
    return null;
  };

   const forceUpdateAllPhotos = async () => {
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) return;
     
     setLoading(true);
     try {
       toast({
         title: "Atualizando fotos",
         description: "Buscando fotos de perfil de todos os contatos...",
       });
       
       const uniquePhones = [...new Set(contacts.map(c => c.phone))];
       let updatedCount = 0;
       
       for (const phone of uniquePhones) {
         try {
           const { data, error } = await supabase.functions.invoke('get-profile-picture', { body: { phone } });
           if (error) continue;
           const url = extractProfilePictureUrl(data?.data ?? data);
           if (url) {
             updatedCount++;
             await supabase.from('saved_contacts').upsert(
               { phone, user_id: session.user.id, profile_picture_url: url },
               { onConflict: 'phone,user_id' }
             );
           }
           // Small delay to avoid rate limits
           await new Promise(r => setTimeout(r, 100));
         } catch { /* ignore individual errors */ }
       }
       
       await fetchContacts();
       
       toast({
         title: "Atualização concluída",
         description: `${updatedCount} fotos de perfil foram atualizadas.`,
       });
     } finally {
       setLoading(false);
     }
   };

   return { contacts, stats, loading, refetch: fetchContacts, refreshProfilePicture, forceUpdateAllPhotos };
};

// Função auxiliar para extrair nome do telefone
const extractNameFromPhone = (phone: string): string => {
  // Remove formatação do telefone e retorna nome genérico
  const cleanPhone = phone.replace(/\D/g, '');
  return `Contato ${cleanPhone.slice(-4)}`;
};

// Função para determinar status baseado na última atividade
const determineStatus = (lastActivity: string): 'ativo' | 'inativo' | 'bloqueado' => {
  const now = new Date();
  const lastDate = new Date(lastActivity);
  const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 7) return 'ativo';
  if (daysDiff <= 30) return 'inativo';
  return 'inativo'; // Não temos lógica de bloqueio automático ainda
};

// Função para determinar tags baseadas no tipo de interação
const determingTags = (keywordMatched?: string): string[] => {
  const tags: string[] = [];
  
  if (keywordMatched === 'WELCOME_MESSAGE') {
    tags.push('Novo');
  } else if (keywordMatched) {
    tags.push('Resposta Automática');
  }
  
  return tags;
};