import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  roles: string[];
  subscription_status: 'active' | 'pending' | 'expired' | 'cancelled';
  subscription_expires_at: string | null;
  zapi_instance_id: string | null;
  zapi_token: string | null;
  zapi_client_token: string | null;
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
        .select("id, email, full_name, is_active, created_at, subscription_status, subscription_expires_at, zapi_instance_id, zapi_token, zapi_client_token")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserProfile[] = (profiles || []).map((profile) => ({
        id: profile.id,
        email: profile.email || "",
        full_name: profile.full_name || "",
        is_active: profile.is_active,
        created_at: profile.created_at,
        subscription_status: (profile.subscription_status as any) || 'pending',
        subscription_expires_at: profile.subscription_expires_at,
        zapi_instance_id: profile.zapi_instance_id,
        zapi_token: profile.zapi_token,
        zapi_client_token: profile.zapi_client_token,
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
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !currentStatus })
        .eq("id", userId);

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

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    toggleUserStatus,
    toggleAdminRole,
    refetch: fetchUsers
  };
};
