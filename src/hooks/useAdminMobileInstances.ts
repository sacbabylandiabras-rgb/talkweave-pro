 import { useState } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export const useAdminMobileInstances = (userId: string | undefined, onUpdate: () => void) => {
   const { toast } = useToast();
   const [addingMobile, setAddingMobile] = useState(false);
 
   const addMobileInstance = async (data: {
     instance_name: string;
     zapi_instance_id: string;
     zapi_token: string;
     zapi_client_token: string;
     is_default?: boolean;
   }) => {
     if (!userId) return false;
     
     try {
       setAddingMobile(true);
       
       const { error } = await supabase.from('zapi_instances').insert({
         user_id: userId,
         instance_name: data.instance_name,
         zapi_instance_id: data.zapi_instance_id,
         zapi_token: data.zapi_token,
         zapi_client_token: data.zapi_client_token,
         instance_type: 'mobile',
         api_provider: 'zapi',
         is_default: data.is_default || false,
       });
 
       if (error) throw error;
 
       toast({ title: "✅ Instância Mobile adicionada" });
       onUpdate();
       return true;
     } catch (error: any) {
       console.error('Erro ao adicionar Mobile:', error);
       toast({ 
         title: "Erro ao adicionar Mobile", 
         description: error.message, 
         variant: "destructive" 
       });
       return false;
     } finally {
       setAddingMobile(false);
     }
   };
 
   return { addMobileInstance, addingMobile };
 };