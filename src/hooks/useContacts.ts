import { useState, useEffect } from "react";
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
  profilePictureUrl?: string;
}

export interface ContactStats {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
}

export const useContacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats>({
    total: 0,
    active: 0,
    inactive: 0,
    blocked: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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

      // Processar contatos únicos
      const contactMap = new Map<string, Contact>();
      
      // Processar logs de mensagens recebidas
      messageLogs?.forEach(log => {
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

      // Processar envios de campanha
      campaignSends?.forEach(send => {
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

  useEffect(() => {
    fetchContacts();
  }, []);

  return { contacts, stats, loading, refetch: fetchContacts };
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