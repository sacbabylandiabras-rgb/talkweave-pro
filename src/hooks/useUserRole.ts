import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!userId) {
        console.log('[useUserRole] No userId provided');
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      console.log('[useUserRole] Checking role for userId:', userId);

      try {
        // Force a fresh query without cache
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        console.log('[useUserRole] Query result:', { data, error });

        if (error && error.code !== "PGRST116") {
          console.error("Error checking role:", error);
        }

        const hasAdminRole = !!data;
        console.log('[useUserRole] Is admin?', hasAdminRole);
        setIsAdmin(hasAdminRole);
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
          console.log('[useUserRole] Role changed, rechecking...');
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
