import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  whatsapp: string | null;
  is_active: boolean;
  created_at: string;
  roles: string[];
  subscription_status: 'active' | 'pending' | 'expired' | 'cancelled';
  subscription_expires_at: string | null;
  zapi_instance_id: string | null;
  zapi_token: string | null;
  zapi_client_token: string | null;
  plan_id: string | null;
  custom_plan_value: number | null;
}

export const useAdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, whatsapp, is_active, created_at, subscription_status, subscription_expires_at, zapi_instance_id, zapi_token, zapi_client_token, plan_id, custom_plan_value" as any)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserProfile[] = (profiles as any[] || []).map((profile: any) => ({
        id: profile.id,
        email: profile.email || "",
        full_name: profile.full_name || "",
        whatsapp: profile.whatsapp || null,
        is_active: profile.is_active,
        created_at: profile.created_at,
        subscription_status: (profile.subscription_status as any) || 'pending',
        subscription_expires_at: profile.subscription_expires_at,
        zapi_instance_id: profile.zapi_instance_id,
        zapi_token: profile.zapi_token,
        zapi_client_token: profile.zapi_client_token,
        plan_id: (profile as any).plan_id ?? null,
        custom_plan_value: (profile as any).custom_plan_value ?? null,
        roles: roles
          ?.filter((r) => r.user_id === profile.id)
          .map((r) => r.role) || []
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.functions.invoke("admin-update-profile", {
        body: { userId, patch: { is_active: !currentStatus } },
      });

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Usuário ${!currentStatus ? "ativado" : "desativado"} com sucesso`
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const toggleAdminRole = async (userId: string, currentRoles: string[]) => {
    try {
      const isAdmin = currentRoles.includes("admin");

      if (isAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;

        toast({
          title: "Permissão removida",
          description: "Usuário não é mais administrador"
        });
      } else {
        // Add admin role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;

        toast({
          title: "Permissão concedida",
          description: "Usuário agora é administrador"
        });
      }

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar permissões",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Remove roles first
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      // Remove profile
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;

      toast({
        title: "Usuário removido",
        description: "O usuário foi removido com sucesso"
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao remover usuário",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    toggleUserStatus,
    toggleAdminRole,
     deleteUser,
     activateUserSubscription: async (userId: string) => {
       try {
          const { error } = await supabase.functions.invoke("admin-update-profile", {
            body: {
              userId,
              patch: {
                is_active: true,
                subscription_status: 'active',
                subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              },
            },
          });
 
         if (error) throw error;
 
         toast({
           title: "Conta ativada",
           description: "Assinatura ativada por 30 dias com sucesso"
         });
 
         await fetchUsers();
       } catch (error: any) {
         toast({
           title: "Erro ao ativar conta",
           description: error.message,
           variant: "destructive"
         });
       }
     },
     refetch: fetchUsers
  };
};
