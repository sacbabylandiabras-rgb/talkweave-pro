import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      console.log('useUserRole - Verificando role para userId:', userId);
      
      if (!userId) {
        console.log('useUserRole - userId indefinido');
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        console.log('useUserRole - Resultado da query:', { data, error });

        if (error && error.code !== "PGRST116") {
          console.error("Error checking role:", error);
        }

        const hasAdmin = data && data.role === 'admin';
        console.log('useUserRole - É admin?', hasAdmin);
        setIsAdmin(hasAdmin);
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
