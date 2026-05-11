 import { useState } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 import { ZapiInstance } from './useZapiInstances';
 
 export const useAdminUazapi = (userId: string | undefined, onUpdate: () => void) => {
   const { toast } = useToast();
   const [addingInstance, setAddingInstance] = useState(false);
 
   const addUazapiInstance = async (data: {
     instance_name: string;
     evolution_api_url: string;
     evolution_api_key: string;
     api_provider: 'uazapi' | 'uazapi_warmup';
     is_default?: boolean;
   }) => {
     if (!userId) return false;
     
     try {
       setAddingInstance(true);
       
       const { error } = await supabase.from('zapi_instances').insert({
         user_id: userId,
         instance_name: data.instance_name,
         evolution_api_url: data.evolution_api_url,
         evolution_api_key: data.evolution_api_key,
         api_provider: data.api_provider,
          instance_type: 'web',
         is_default: data.is_default || false,
         // These are nullable now but let's be explicit
          zapi_instance_id: `uazapi_${Date.now()}`,
          zapi_token: 'uazapi_internal',
          zapi_client_token: 'uazapi_internal',
       });
 
       if (error) throw error;
 
       toast({ title: "✅ Instância UAZAPI adicionada" });
       onUpdate();
       return true;
     } catch (error: any) {
       console.error('Erro ao adicionar UAZAPI:', error);
       toast({ 
         title: "Erro ao adicionar", 
         description: error.message, 
         variant: "destructive" 
       });
       return false;
     } finally {
       setAddingInstance(false);
     }
   };
 
   const toggleUazapiType = async (instanceId: string, currentProvider: string) => {
     if (!userId) return false;
     const newProvider = currentProvider === 'uazapi' ? 'uazapi_warmup' : 'uazapi';
     
     try {
       const { error } = await supabase
         .from('zapi_instances')
         .update({ api_provider: newProvider })
         .eq('id', instanceId);
 
       if (error) throw error;
       
       toast({ title: "✅ Tipo alterado com sucesso" });
       onUpdate();
       return true;
     } catch (error: any) {
       toast({ title: "Erro ao alterar tipo", description: error.message, variant: "destructive" });
       return false;
     }
   };
 
   return { addUazapiInstance, toggleUazapiType, addingInstance };
 };