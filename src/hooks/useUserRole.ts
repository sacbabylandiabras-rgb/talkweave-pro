import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const checkRole = async () => {
      if (!userId) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Busca TODAS as roles do usuário
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (error) {
          console.error("Error checking role:", error);
          setIsAdmin(false);
        } else {
          // Verifica se existe alguma role 'admin' na lista
          const hasAdminRole = data?.some(r => r.role === 'admin') || false;
          setIsAdmin(hasAdminRole);
        }
      } catch (error) {
        console.error("Error in checkRole:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();

    // Set up realtime subscription for role changes
    const channel = supabase
      .channel('user_roles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${userId}`
        },
        () => {
          checkRole();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { isAdmin, loading };
};
