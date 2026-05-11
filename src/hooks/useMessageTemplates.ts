import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  type?: string;
  content: string;
  header?: string;
  footer?: string;
  mediaUrl?: string;
  fileName?: string;
  fileType?: string;
  variables: string[];
  usage_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
   buttons?: Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}>;
  listItems?: Array<{id: string, title: string, description?: string}>;
  carouselCards?: Array<{
    id: string;
    image: string;
    title: string;
    description: string;
     buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}>;
  }>;
}

export const useMessageTemplates = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        type: item.type || "texto",
        content: item.content,
        header: item.header || "",
        footer: item.footer || "",
        mediaUrl: item.media_url || "",
        fileName: item.file_name || "",
        fileType: item.file_type || "",
        variables: Array.isArray(item.variables) ? item.variables.filter(v => typeof v === 'string') : [],
        usage_count: item.usage_count || 0,
        active: item.active || false,
        created_at: item.created_at,
        updated_at: item.updated_at,
         buttons: Array.isArray(item.buttons) ? item.buttons as Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}> : [],
        listItems: Array.isArray(item.list_items) ? item.list_items as Array<{id: string, title: string, description?: string}> : [],
         carouselCards: Array.isArray((item as any).carousel_cards) ? (item as any).carousel_cards as Array<{id: string, image: string, title: string, description: string, buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}>}> : [],
      })));
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar modelos de mensagem",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (templateData: {
    name: string;
    category: string;
    type?: string;
    content: string;
    header?: string;
    footer?: string;
    mediaUrl?: string;
    fileName?: string;
    fileType?: string;
    variables?: string[];
     buttons?: Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}>;
    listItems?: Array<{id: string, title: string, description?: string}>;
     carouselCards?: Array<{id: string, image: string, title: string, description: string, buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}>}>;
  }) => {
    try {
      // Obter o user_id do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          user_id: user.id, // CRÍTICO: Incluir user_id para RLS
          name: templateData.name,
          category: templateData.category,
          type: templateData.type || "texto",
          content: templateData.content,
          header: templateData.header,
          footer: templateData.footer,
          media_url: templateData.mediaUrl,
          file_name: templateData.fileName,
          file_type: templateData.fileType,
          variables: templateData.variables || [],
          buttons: templateData.buttons || [],
          list_items: templateData.listItems || [],
          carousel_cards: templateData.carouselCards || [],
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [{
        id: data.id,
        name: data.name,
        category: data.category,
        type: data.type || "texto",
        content: data.content,
        header: data.header || "",
        footer: data.footer || "",
        mediaUrl: data.media_url || "",
        fileName: data.file_name || "",
        fileType: data.file_type || "",
        variables: Array.isArray(data.variables) ? data.variables.filter(v => typeof v === 'string') : [],
        usage_count: data.usage_count || 0,
        active: data.active || false,
        created_at: data.created_at,
        updated_at: data.updated_at,
         buttons: Array.isArray(data.buttons) ? data.buttons as Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}> : [],
        listItems: Array.isArray(data.list_items) ? data.list_items as Array<{id: string, title: string, description?: string}> : [],
         carouselCards: Array.isArray((data as any).carousel_cards) ? (data as any).carousel_cards as Array<{id: string, image: string, title: string, description: string, buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}>}> : [],
      }, ...prev]);
      toast({
        title: "Sucesso",
        description: "Modelo criado com sucesso",
      });
      
      return data;
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar modelo",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateTemplate = async (id: string, updates: Partial<MessageTemplate>) => {
    try {
      // Mapear campos camelCase para snake_case para o banco de dados
      const dbUpdates: any = {};
      
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.header !== undefined) dbUpdates.header = updates.header;
      if (updates.footer !== undefined) dbUpdates.footer = updates.footer;
      if (updates.mediaUrl !== undefined) dbUpdates.media_url = updates.mediaUrl;
      if (updates.fileName !== undefined) dbUpdates.file_name = updates.fileName;
      if (updates.fileType !== undefined) dbUpdates.file_type = updates.fileType;
      if (updates.variables !== undefined) dbUpdates.variables = updates.variables;
      if (updates.buttons !== undefined) dbUpdates.buttons = updates.buttons;
      if (updates.listItems !== undefined) dbUpdates.list_items = updates.listItems;
      if (updates.carouselCards !== undefined) dbUpdates.carousel_cards = updates.carouselCards;
      
      const { data, error } = await supabase
        .from('message_templates')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => 
        prev.map(template => 
          template.id === id ? { 
            id: data.id,
            name: data.name,
            category: data.category,
            type: data.type || template.type || "texto",
            content: data.content,
            header: data.header || template.header || "",
            footer: data.footer || template.footer || "",
            mediaUrl: data.media_url || template.mediaUrl || "",
            fileName: data.file_name || template.fileName || "",
            fileType: data.file_type || template.fileType || "",
            variables: Array.isArray(data.variables) ? data.variables.filter(v => typeof v === 'string') : template.variables,
            usage_count: data.usage_count || template.usage_count,
            active: data.active !== undefined ? data.active : template.active,
            created_at: data.created_at || template.created_at,
            updated_at: data.updated_at || template.updated_at,
             buttons: Array.isArray(data.buttons) ? data.buttons as Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}> : template.buttons || [],
            listItems: Array.isArray(data.list_items) ? data.list_items as Array<{id: string, title: string, description?: string}> : template.listItems || [],
             carouselCards: Array.isArray((data as any).carousel_cards) ? (data as any).carousel_cards as Array<{id: string, image: string, title: string, description: string, buttons: Array<{id: string, text: string, type: 'reply' | 'url' | 'call' | 'copy', value?: string}>}> : template.carouselCards || [],
          } : template
        )
      );

      toast({
        title: "Sucesso",
        description: "Modelo atualizado com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar modelo",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .update({ active: false })
        .eq('id', id);

      if (error) throw error;

      setTemplates(prev => prev.filter(template => template.id !== id));
      toast({
        title: "Sucesso",
        description: "Modelo removido com sucesso",
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover modelo",
        variant: "destructive",
      });
      throw error;
    }
  };

  const duplicateTemplate = async (template: MessageTemplate) => {
    try {
      const newTemplate = {
        name: `${template.name} (Cópia)`,
        category: template.category,
        type: template.type,
        content: template.content,
        header: template.header,
        footer: template.footer,
        mediaUrl: template.mediaUrl,
        fileName: template.fileName,
        fileType: template.fileType,
        variables: template.variables,
        buttons: template.buttons || [],
        listItems: template.listItems || [],
        carouselCards: template.carouselCards || [],
      };

      return await createTemplate(newTemplate);
    } catch (error) {
      console.error('Error duplicating template:', error);
      throw error;
    }
  };

  const incrementUsage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .update({ 
          usage_count: (templates.find(t => t.id === id)?.usage_count || 0) + 1
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setTemplates(prev => 
        prev.map(template => 
          template.id === id 
            ? { ...template, usage_count: template.usage_count + 1 }
            : template
        )
      );
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  };

  const getUniqueCategories = () => {
    const categories = templates.map(template => template.category);
    return [...new Set(categories)];
  };

  const filterByCategory = (category: string) => {
    if (category === 'Todos') return templates;
    return templates.filter(template => template.category === category);
  };

  const processVariables = (content: string, variables: Record<string, string>) => {
    let processedContent = content;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      processedContent = processedContent.replace(regex, value);
    });

    return processedContent;
  };

  useEffect(() => {
    loadTemplates();
  }, []);

   const deleteAllTemplates = async () => {
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) throw new Error('Usuário não autenticado');
 
       const { error } = await supabase
         .from('message_templates')
         .update({ active: false })
         .eq('user_id', user.id)
         .eq('active', true);
 
       if (error) throw error;
 
       setTemplates([]);
       toast({
         title: "Sucesso",
         description: "Todos os modelos foram removidos",
       });
     } catch (error) {
       console.error('Error deleting all templates:', error);
       toast({
         title: "Erro",
         description: "Erro ao remover todos os modelos",
         variant: "destructive",
       });
       throw error;
     }
   };
 
   return {
     templates,
     loading,
     createTemplate,
     updateTemplate,
     deleteTemplate,
     deleteAllTemplates,
     duplicateTemplate,
     incrementUsage,
     getUniqueCategories,
     filterByCategory,
     processVariables,
     refetch: loadTemplates,
   };
 };